import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { findMemberById, getJobApplications, getJobById, projectMemberSummary } from '@/lib/data/repo';
import { logAudit } from '@/lib/audit/log';
import { clientIp, fail, HttpError, json, limit, readJson } from '../../../../_lib/http';

/**
 * The applicant list, as a file.
 *
 * Reading the list on screen and walking away with it are two different
 * acts, so they are two different endpoints. `GET ../applicants` is open
 * to the alumnus who posted the role *or* the placement cell; this one is
 * `job.applicants.export` and nothing else. Posting a role does not carry
 * the right to keep a copy of the students who answered it.
 *
 *  - **A written reason, twenty-five characters minimum.** Which drive
 *    this is for and who asked for it. It is the line that gets read back
 *    to whoever exported it if the file turns up somewhere it should not.
 *  - **Rate-limited per person.** The list does not change between one
 *    download and the next.
 *  - **The audit row is written before the file is built**, carrying the
 *    row count and the exact column list. An export that fails halfway is
 *    still an export that was attempted.
 *  - **No contact data, ever.** Not email, not mobile, in any tier. Bulk
 *    contact export is `member.export`, `college_admin` only, and an
 *    applicant list is not a side door into it. Roll numbers are a
 *    `privileged` projection field and are included only for a viewer
 *    already at that tier — two students with the same name in one branch
 *    is not rare in a cohort of 240, so at a placement desk the roll
 *    number earns its place; for anyone else it is one identifier more
 *    than the file needs.
 *
 * **Why the CSV comes back inside JSON.** Every interactive control in
 * this build posts through `@/lib/client/api`, which reads JSON so that a
 * refusal, a 422 with field errors and a fixture write stay legible
 * outcomes rather than an unparsed body behind a download prompt. The file
 * is still assembled here — the browser is handed finished bytes and never
 * decides a column — and the audit entry still precedes it.
 */

const MIN_REASON = 25;

const Body = z
  .object({
    reason: z
      .string()
      .trim()
      .min(
        MIN_REASON,
        'Write a real reason — which drive this is for and who asked for it. This is the line that gets read back to you if the file turns up somewhere it should not.',
      )
      .max(500),
  })
  .strict();

/**
 * CSV escaping with the leading-character guard: a cell starting `=`,
 * `+`, `-` or `@` is executed as a formula by Excel, and a placement
 * officer's applicant list is opened in Excel by definition.
 */
function cell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/** Byte-order mark, spelled by code point so it is visible in the source. */
const BOM = String.fromCharCode(0xfeff);

interface ExportRow {
  note: string | null;
  createdAt: string;
  rollNumber: string | null;
  fullName: string;
  batchYear: number | null;
  departmentCode: string | null;
}

/**
 * Resolve the posting and the caller's right to export it. Shared by both
 * handlers so the description and the file can never disagree about who
 * is allowed to ask.
 */
async function resolveExport(id: string) {
  const session = await getSession();
  // Not an OR with authorship. The poster reads the list on the page.
  requireCap(session, 'job.applicants.export');

  const resolved = await getTenantBrand();
  if (!resolved) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');
  if (!resolved.brand.pack.features.jobs) {
    throw new HttpError(404, 'feature_off', 'The jobs board is not enabled for this college.');
  }

  const job = getJobById(session, id);
  if (!job) throw new HttpError(404, 'not_found', 'That posting is not available.');

  // Mirrors `tierFor()`: the two capabilities that reach the privileged
  // field list, and the only ones that put a roll number in this file.
  const privileged = can(session, 'directory.view.contact') || can(session, 'directory.view.cgpa');

  const rows: ExportRow[] = getJobApplications(job.id).map((a) => {
    const stored = findMemberById(a.applicant.id);
    // Re-projected for *this* viewer rather than exported as stored. Two
    // lists of the same person under two different rules is how a
    // projection stops being a guarantee.
    const applicant = stored ? projectMemberSummary(stored, session) : a.applicant;
    return {
      note: a.note,
      createdAt: a.createdAt,
      rollNumber: privileged ? stored?.rollNumber ?? null : null,
      fullName: applicant.fullName,
      batchYear: applicant.batchYear,
      departmentCode: applicant.departmentCode,
    };
  });

  const columns: Array<{ label: string; get: (r: ExportRow) => unknown }> = [
    ...(privileged ? [{ label: 'Roll number', get: (r: ExportRow) => r.rollNumber ?? '' }] : []),
    { label: 'Name', get: (r) => r.fullName },
    { label: 'Branch', get: (r) => r.departmentCode ?? '' },
    { label: 'Year of passing', get: (r) => r.batchYear ?? '' },
    { label: 'Applied on', get: (r) => r.createdAt.slice(0, 10) },
    { label: 'Note from applicant', get: (r) => r.note ?? '' },
  ];

  return { session, tenant: resolved.tenant, job, rows, columns, privileged };
}

/**
 * Describes the export without performing one, so the dialog can show the
 * row count and the exact column list before anybody commits to a reason.
 * Behind the same capability: telling an unauthorised caller how many
 * students applied is still telling them something about the list.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { job, rows, columns, privileged } = await resolveExport(id);

    return json({
      job: { id: job.id, title: job.title, company: job.company, state: job.state },
      rowCount: rows.length,
      columns: columns.map((c) => c.label),
      includesRollNumbers: privileged,
      neverIncluded: ['Email', 'Mobile'],
      minReasonLength: MIN_REASON,
      auditedAs: 'job.applicants.export',
      note: 'The audit row — your name, this posting, the row count and the reason you type — is written before the file is built. Audit rows are append-only; you cannot remove your own.',
    });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { session, tenant, job, rows, columns, privileged } = await resolveExport(id);

    const body = await readJson(request, Body);

    limit(
      `applicants-export:${session.memberId}`,
      10,
      60 * 60,
      'Ten applicant downloads in an hour is the limit. The list does not change between one download and the next — open the posting if you only need to check a name.',
    );

    if (rows.length === 0) {
      // Refused rather than served: an empty CSV that looks like a
      // successful export is how "nobody applied" becomes "the data is gone".
      throw new HttpError(
        422,
        'empty_scope',
        `Nobody has applied to ${job.title} at ${job.company} through the portal yet, so there is nothing to export.`,
      );
    }

    // Before the file, not after it.
    await logAudit({
      tenantId: tenant.id,
      session,
      action: 'job.applicants.export',
      resource: 'job_applications',
      resourceId: job.id,
      reason: body.reason,
      before: null,
      after: {
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        postedById: job.postedBy.id,
        rowCount: rows.length,
        columns: columns.map((c) => c.label),
        includesRollNumbers: privileged,
        includesContactData: false,
        format: 'csv',
      },
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const header = columns.map((c) => cell(c.label)).join(',');
    const lines = rows.map((r) => columns.map((c) => cell(c.get(r))).join(','));
    // Without the mark, Excel on Windows reads the file as ANSI and mangles
    // every name with a diacritic in it.
    const csv = `${BOM}${header}\r\n${lines.join('\r\n')}\r\n`;

    const safeCompany = job.company
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const filename = `${tenant.subdomain}-applicants-${safeCompany || 'posting'}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    return json({
      ok: true,
      job: { id: job.id, title: job.title, company: job.company },
      rowCount: rows.length,
      columns: columns.map((c) => c.label),
      includesRollNumbers: privileged,
      filename,
      contentType: 'text/csv; charset=utf-8',
      csv,
      auditedAs: 'job.applicants.export',
      note: 'Recorded against your name with the row count and the column list. Delete the file once the drive it was taken for is over — the audit row outlives it, and it names you.',
    });
  } catch (err) {
    return fail(err);
  }
}
