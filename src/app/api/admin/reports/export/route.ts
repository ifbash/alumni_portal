import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenant } from '@/lib/tenant';
import { logAudit } from '@/lib/audit/log';
import { getReportSections, perceptionSurveyList, reportToCsv } from '@/lib/data/reports';
import { clientIp, fail, HttpError, limit, parseQuery, readJson } from '../../../_lib/http';

/**
 * Accreditation exports.
 *
 * Two endpoints with deliberately different rules, because they hand over
 * two very different things.
 *
 *  - **GET** returns the report itself: aggregate figures, one row per
 *    metric, no contact data of any kind. `audit.read` opens it, and the
 *    framework requested is written to the audit log — "who pulled the
 *    NAAC numbers, and on what date" is a question the IQAC asks itself
 *    every cycle, and the answer should not depend on somebody's memory.
 *    The `Definition` column travels with every figure on purpose: it is
 *    the part that makes next cycle's submission reproducible rather than
 *    merely defensible.
 *
 *  - **POST** returns the NIRF perception-survey list: roll number, name
 *    and email address for every contactable graduate. That is bulk
 *    contact data, so it is `member.export` — `college_admin` and nothing
 *    else — and it will not run without a written reason. Same rules as
 *    `/api/admin/members/export`, for the same reason: an exportable
 *    alumni list leaves with whoever exported it.
 *
 * Neither endpoint recomputes anything. Both call the reporting module, so
 * the spreadsheet and the screen can never disagree.
 */

const MIN_REASON = 25;

const Query = z.object({
  framework: z.enum(['all', 'NAAC', 'NIRF', 'AICTE', 'Internal']).default('all'),
});

const PerceptionBody = z.object({
  dataset: z.literal('nirf-perception'),
  reason: z
    .string()
    .trim()
    .min(
      MIN_REASON,
      'Write a real reason — the submission this is for and who asked for it. This is the line that gets read back to you if the list leaks.',
    )
    .max(500),
  acknowledged: z.boolean().refine((v) => v === true, {
    message: 'Confirm that you understand this export is recorded against your name.',
  }),
});

/**
 * CSV escaping with the leading-character guard.
 *
 * A cell beginning `=`, `+`, `-` or `@` is executed as a formula when the
 * file is opened in Excel, and a perception-survey list is opened in Excel
 * by definition. `reportToCsv` escapes the report itself; this is for the
 * contact list, which is built here.
 */
function cell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Byte-order mark, spelled by code point so it is visible in the source. */
const BOM = String.fromCharCode(0xfeff);

/**
 * Excel on Windows reads a CSV without a byte-order mark as ANSI, which
 * turns every ₹ and every en dash in the definitions into mojibake. The
 * registrar then retypes the figure, and a retyped figure is the one that
 * gets defended badly.
 */
function attach(csv: string, filename: string, rowCount: number, action: string): NextResponse {
  return new NextResponse(`${BOM}${csv}\n`, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store, no-cache, must-revalidate, private',
      'x-row-count': String(rowCount),
      'x-audit-action': action,
    },
  });
}

// ---------------------------------------------------------------
// The report
// ---------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const session = await getSession();
    // Same capability that opens the console. Aggregate figures, but they
    // are still the college's internal position on its own numbers.
    requireCap(session, 'audit.read');

    const tenant = await getTenant();
    if (!tenant) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');

    limit(
      `report-export:${session.memberId}`,
      20,
      60 * 60,
      'Twenty report downloads in an hour is the limit. The figures do not change between one download and the next — open the console if you need to check one.',
    );

    const { framework } = parseQuery(request, Query);

    const all = getReportSections();
    const sections = framework === 'all' ? all : all.filter((s) => s.framework === framework);

    if (sections.length === 0) {
      // Refused rather than served empty. A CSV with nothing but a header
      // row looks like an answer, and somebody will submit it as one.
      throw new HttpError(
        422,
        'nothing_computed',
        `No ${framework} figures are computed yet, so there is nothing to export. The reporting module only produces a section once the data behind it exists.`,
        { framework },
      );
    }

    const metrics = sections.flatMap((s) => s.metrics);

    await logAudit({
      tenantId: tenant.id,
      session,
      action: 'report.export',
      resource: 'reports',
      resourceId: framework,
      reason: null,
      before: null,
      after: {
        framework,
        sections: sections.map((s) => `${s.framework} ${s.criterion} — ${s.title}`),
        metricCount: metrics.length,
        caveatedMetrics: metrics.filter((m) => m.caveat).length,
        columns: ['Framework', 'Criterion', 'Section', 'Metric', 'Value', 'Denominator', 'Definition', 'Caveat'],
        format: 'csv',
      },
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const slug = framework === 'all' ? 'all-frameworks' : framework.toLowerCase();
    return attach(
      reportToCsv(sections),
      `${tenant.subdomain}-accreditation-${slug}-${stamp()}.csv`,
      metrics.length,
      'report.export',
    );
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------
// The NIRF perception-survey list
// ---------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const session = await getSession();
    // The only capability that opens this. Do not add a fallback for the
    // alumni cell operator, however often they ask.
    requireCap(session, 'member.export');

    const tenant = await getTenant();
    if (!tenant) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');

    limit(
      `perception-export:${session.memberId}`,
      2,
      60 * 60,
      'Two perception-list exports in an hour is the limit. This file is the whole contactable alumni body; if it needs to be pulled a third time, something upstream is wrong.',
    );

    const body = await readJson(request, PerceptionBody);

    const rows = perceptionSurveyList();
    if (rows.length === 0) {
      throw new HttpError(
        422,
        'empty_scope',
        'No verified alumni currently hold a confirmed email address, so the list is empty. Nothing has been exported.',
      );
    }

    const columns = ['Roll number', 'Name', 'Year of passing', 'Branch', 'Email'];
    const scopeLabel = `NIRF perception survey — ${rows.length} verified alumni holding a confirmed email address`;

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
        dataset: 'nirf-perception',
        scopeLabel,
        rowCount: rows.length,
        columns,
        includesContactData: true,
        format: 'csv',
      },
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const header = columns.map(cell).join(',');
    const lines = rows.map((r) =>
      [r.rollNumber ?? '', r.name, r.batchYear ?? '', r.department ?? '', r.email ?? ''].map(cell).join(','),
    );

    return attach(
      `${header}\r\n${lines.join('\r\n')}`,
      `${tenant.subdomain}-nirf-perception-list-${stamp()}.csv`,
      rows.length,
      'member.export',
    );
  } catch (err) {
    return fail(err);
  }
}
