import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenant } from '@/lib/tenant';
import { getMembersForAdmin } from '@/lib/data/repo';
import { logAudit } from '@/lib/audit/log';
import type { MemberDetail } from '@/lib/data/types';
import { clientIp, fail, HttpError, json, limit, readJson } from '../../../_lib/http';

/**
 * Bulk contact export.
 *
 * The single most sensitive endpoint in the product, and the one whose
 * rules are least negotiable:
 *
 *  - **`member.export` and nothing else opens it.** Not the alumni cell
 *    operator, not the placement officer, not an HOD. Staff leave, and an
 *    exportable directory leaves with them. There is no fallback branch
 *    here that accepts a different capability.
 *  - **A written reason is mandatory.** "Who exported the alumni list,
 *    what did it cover, and why" is the first question asked after a
 *    leak, and an empty column is not an answer.
 *  - **The audit entry is written before the file is built.** If the CSV
 *    generation fails halfway, the attempt is still on the record.
 *  - **Academic columns are opt-in and separately gated.** CGPA and
 *    placement status are placement-side data; they do not ride along in
 *    a contact export just because the exporter happens to hold the
 *    capability for both.
 *
 * Each row carries the member's own visibility setting. A college admin's
 * audited export is the documented exception to the two-gate release
 * rule, not a reason to forget that the member expressed a preference —
 * whoever receives this file needs to know which rows were `private`.
 */

const MIN_REASON = 25;

const Body = z.object({
  reason: z
    .string()
    .trim()
    .min(
      MIN_REASON,
      'Write a real reason — what the file is for and who asked for it. This is the line that gets read back to you if the list leaks.',
    )
    .max(500),
  /** The exporter has to say they know the export is attributable to them. */
  acknowledged: z.boolean().refine((v) => v === true, {
    message: 'Confirm that you understand this export is recorded against your name.',
  }),
  scope: z
    .object({
      q: z.string().trim().max(120).optional(),
      status: z.string().trim().max(32).optional(),
      department: z.string().trim().max(12).optional(),
      batchFrom: z.number().int().min(1990).max(2100).optional(),
      batchTo: z.number().int().min(1990).max(2100).optional(),
      cohort: z.enum(['alumni', 'students', 'all']).optional(),
    })
    .default({}),
  /** Off by default. Placement data is not part of a contact export. */
  includeAcademic: z.boolean().default(false),
});

type Row = MemberDetail;

const BASE_COLUMNS: Array<{ key: string; label: string; get: (m: Row) => unknown }> = [
  { key: 'rollNumber', label: 'Roll number', get: (m) => m.rollNumber ?? '' },
  { key: 'fullName', label: 'Name', get: (m) => m.fullName },
  { key: 'status', label: 'Status', get: (m) => m.status },
  { key: 'departmentCode', label: 'Branch', get: (m) => m.departmentCode ?? '' },
  { key: 'batchYear', label: 'Year of passing', get: (m) => m.batchYear ?? '' },
  { key: 'programme', label: 'Programme', get: (m) => m.programme ?? '' },
  { key: 'currentCompany', label: 'Company', get: (m) => m.currentCompany ?? '' },
  { key: 'designation', label: 'Designation', get: (m) => m.designation ?? '' },
  { key: 'city', label: 'City', get: (m) => m.city ?? '' },
  { key: 'state', label: 'State', get: (m) => m.state ?? '' },
  { key: 'country', label: 'Country', get: (m) => m.country ?? '' },
  { key: 'email', label: 'Email', get: (m) => m.contact?.email ?? '' },
  { key: 'mobile', label: 'Mobile', get: (m) => m.contact?.mobile ?? '' },
  { key: 'linkedin', label: 'LinkedIn', get: (m) => m.contact?.linkedin ?? '' },
  {
    key: 'visibility',
    label: 'Member visibility setting',
    get: (m) => m.contact?.visibility ?? 'unknown',
  },
  { key: 'verifiedAt', label: 'Verified on', get: (m) => m.verifiedAt ?? '' },
];

const ACADEMIC_COLUMNS: Array<{ key: string; label: string; get: (m: Row) => unknown }> = [
  { key: 'cgpa', label: 'CGPA', get: (m) => m.cgpa ?? '' },
  { key: 'placementStatus', label: 'Placement status', get: (m) => m.placementStatus ?? '' },
];

/**
 * CSV escaping, including the leading-character guard.
 *
 * A cell beginning `=`, `+`, `-` or `@` is executed as a formula when the
 * file is opened in Excel, and this file is opened in Excel by definition.
 * A name legitimately starting with `-` is rare; a spreadsheet running
 * somebody else's formula is not a risk worth carrying for it.
 */
function cell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    // The only capability that opens this endpoint. Do not add a fallback.
    requireCap(session, 'member.export');

    const tenant = await getTenant();
    if (!tenant) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');

    limit(
      `member-export:${session.memberId}`,
      3,
      60 * 60,
      'Three exports in an hour is the limit. If you need a different cut of the data, adjust the filters rather than exporting the whole list again.',
    );

    const body = await readJson(request, Body);

    if (body.includeAcademic && !can(session, 'directory.view.cgpa')) {
      throw new HttpError(
        403,
        'forbidden',
        'CGPA and placement status are placement-side data. Your account cannot include them in an export.',
      );
    }

    const page = getMembersForAdmin({
      q: body.scope.q,
      status: body.scope.status,
      department: body.scope.department,
      page: 1,
      perPage: 100000,
    });

    let rows = page.items;
    if (body.scope.batchFrom) rows = rows.filter((m) => (m.batchYear ?? 0) >= body.scope.batchFrom!);
    if (body.scope.batchTo) rows = rows.filter((m) => (m.batchYear ?? 9999) <= body.scope.batchTo!);
    if (body.scope.cohort === 'alumni') rows = rows.filter((m) => !m.isStudent);
    if (body.scope.cohort === 'students') rows = rows.filter((m) => m.isStudent);

    if (rows.length === 0) {
      // Refused rather than served: an empty CSV that looks like a
      // successful export is how a filter typo becomes "the data is gone".
      throw new HttpError(
        422,
        'empty_scope',
        'Those filters match no members, so there is nothing to export. Check the branch and batch range.',
        { scope: body.scope },
      );
    }

    const columns = body.includeAcademic ? [...BASE_COLUMNS, ...ACADEMIC_COLUMNS] : BASE_COLUMNS;

    const scopeLabel = [
      body.scope.cohort && body.scope.cohort !== 'all' ? body.scope.cohort : 'all members',
      body.scope.department ? `branch ${body.scope.department}` : null,
      body.scope.status && body.scope.status !== 'all' ? `status ${body.scope.status}` : null,
      body.scope.batchFrom || body.scope.batchTo
        ? `batches ${body.scope.batchFrom ?? 'earliest'}–${body.scope.batchTo ?? 'latest'}`
        : null,
      body.scope.q ? `matching “${body.scope.q}”` : null,
    ]
      .filter(Boolean)
      .join(', ');

    // Written before the file is built. An export that fails halfway is
    // still an export that was attempted, and the log must show it.
    await logAudit({
      tenantId: tenant.id,
      session,
      action: 'member.export',
      resource: 'members',
      resourceId: null,
      reason: body.reason,
      before: null,
      after: {
        scope: body.scope,
        scopeLabel,
        rowCount: rows.length,
        columns: columns.map((c) => c.key),
        includeAcademic: body.includeAcademic,
        format: 'csv',
      },
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const header = columns.map((c) => cell(c.label)).join(',');
    const lines = rows.map((m) => columns.map((c) => cell(c.get(m))).join(','));
    // BOM first: without it Excel on Windows reads the file as ANSI and
    // mangles every name with a diacritic in it.
    const csv = `\uFEFF${header}\r\n${lines.join('\r\n')}\r\n`;

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `${tenant.subdomain}-members-${stamp}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store, no-cache, must-revalidate, private',
        'x-row-count': String(rows.length),
        'x-audit-action': 'member.export',
        // The scope label is deliberately *not* echoed in a header. It is
        // built from user-supplied filters and contains en dashes and
        // curly quotes; header values are Latin-1 only, and a Unicode
        // character in one throws after the audit row is already written.
        // The scope lives in the audit entry, which is where it is read.
      },
    });
  } catch (err) {
    return fail(err);
  }
}

/**
 * GET describes the export without performing one, so the confirmation
 * dialog can show the row count and the exact column list before anybody
 * commits to a reason. It is behind the same capability: telling an
 * unauthorised caller how many rows they would get is still telling them
 * something about the list.
 */
export async function GET() {
  try {
    const session = await getSession();
    requireCap(session, 'member.export');

    const all = getMembersForAdmin({ page: 1, perPage: 100000 });

    return json({
      totalMembers: all.total,
      minReasonLength: MIN_REASON,
      columns: BASE_COLUMNS.map((c) => c.label),
      academicColumns: ACADEMIC_COLUMNS.map((c) => c.label),
      canIncludeAcademic: can(session, 'directory.view.cgpa'),
      auditedAs: 'member.export',
      note: 'Every export is written to the audit log with your name, the scope and the reason. Audit rows are append-only and cannot be removed, including by you.',
    });
  } catch (err) {
    return fail(err);
  }
}
