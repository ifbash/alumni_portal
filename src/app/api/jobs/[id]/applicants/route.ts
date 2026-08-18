import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { AuthzError, can, requireSession } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { findMemberById, getJobApplications, getJobById, projectMemberSummary } from '@/lib/data/repo';
import { logAudit } from '@/lib/audit/log';
import { clientIp, fail, HttpError, json, limit, parseQuery } from '../../../_lib/http';

/**
 * Who applied to a posting.
 *
 * Two ways in, deliberately checked as an OR rather than a hierarchy:
 *
 *  - **The person who posted it.** An alumnus who put up a role at their
 *    company must be able to see who applied, or the board is a form that
 *    sends applications nowhere. Authorship is compared explicitly
 *    against the session — one alumnus's posting never opens another's.
 *  - **A holder of `job.applicants.export`**, which is the placement
 *    officer. They run the season and need the list across postings.
 *
 * A holder of `job.moderate` is *not* on that list. Moderation decides
 * whether a posting belongs on the board; it does not come with the names
 * of the students who answered it.
 *
 * **No contact details, in either path.** Not in the JSON, not in the
 * CSV. Contact release needs both gates — viewer entitled *and* owner
 * consented — and bulk contact export is `college_admin` only, audited,
 * with a reason. An applicant list is not a side door into either of
 * those. What a poster gets is the applicant's directory profile,
 * projected exactly as the directory would project it, plus the note the
 * applicant chose to write. To reach an applicant, the connection flow is
 * the route, and the applicant decides.
 *
 * `?format=csv` is the export path and is gated separately: the poster
 * reads the list on screen, the placement officer downloads it with a
 * written reason attached to an audit entry.
 */

const MIN_REASON = 25;

const Query = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  reason: z.string().trim().max(500).optional(),
});

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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    requireSession(session);

    const resolved = await getTenantBrand();
    if (!resolved) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');
    if (!resolved.brand.pack.features.jobs) {
      throw new HttpError(404, 'feature_off', 'The jobs board is not enabled for this college.');
    }

    const { id } = await params;
    const query = parseQuery(request, Query);

    const job = getJobById(session, id);
    if (!job) {
      throw new HttpError(404, 'not_found', 'That posting is not available.');
    }

    // The OR, written out. `isPoster` is an identity comparison against the
    // session and can never be widened by a role; `canExport` is a
    // capability and can never be narrowed to one posting. Both are needed,
    // and neither implies the other.
    const isPoster = job.postedBy.id === session.memberId;
    const canExport = can(session, 'job.applicants.export');

    if (!isPoster && !canExport) {
      throw new AuthzError(
        403,
        'forbidden',
        'Applicants are visible to the person who posted the role and to the placement cell. Moderating the board does not include reading who applied.',
      );
    }

    const applications = getJobApplications(job.id);

    // Re-projected for *this* viewer rather than returned as stored. The
    // stored application carries a full summary; handing it back unchanged
    // would make this list wider than /directory for the same people, and
    // two lists of the same person under two different rules is how a
    // projection stops being a guarantee.
    const items = applications.map((a) => {
      const row = findMemberById(a.applicant.id);
      return {
        id: a.id,
        note: a.note,
        createdAt: a.createdAt,
        applicant: row ? projectMemberSummary(row, session) : a.applicant,
      };
    });

    if (query.format === 'json') {
      return json({
        job: {
          id: job.id,
          title: job.title,
          company: job.company,
          state: job.state,
          closesOn: job.closesOn,
          postedBy: { id: job.postedBy.id, fullName: job.postedBy.fullName },
        },
        items,
        total: items.length,
        // Named so a client can explain what it is showing, and why the
        // download button is or is not there.
        viewerIs: isPoster ? (canExport ? 'poster_and_exporter' : 'poster') : 'exporter',
        canExport,
        note: 'Contact details are not part of this list. Send a connection request from the applicant’s profile; they decide whether their email is released.',
      });
    }

    // ---------------------------------------------------------------
    // The export path
    // ---------------------------------------------------------------

    if (!canExport) {
      throw new AuthzError(
        403,
        'forbidden',
        'Downloading the applicant list as a file needs job.applicants.export, which the placement cell holds. You can read every applicant for your own posting on the page.',
      );
    }

    const reason = query.reason?.trim() ?? '';
    if (reason.length < MIN_REASON) {
      throw new HttpError(422, 'reason_required', 'A downloaded applicant list needs a written reason.', {
        fieldErrors: {
          reason:
            'Write a real reason — which drive this is for and who asked for it. This is the line that gets read back to you if the file turns up somewhere it should not.',
        },
      });
    }

    limit(
      `applicants-export:${session.memberId}`,
      10,
      60 * 60,
      'Ten applicant downloads in an hour is the limit. The list does not change between one download and the next — open the posting if you only need to check a name.',
    );

    if (items.length === 0) {
      // Refused rather than served: an empty CSV that looks like a
      // successful export is how "nobody applied" becomes "the data is gone".
      throw new HttpError(
        422,
        'empty_scope',
        `Nobody has applied to ${job.title} at ${job.company} yet, so there is nothing to export.`,
      );
    }

    // Roll numbers are a `privileged` projection field. At a placement desk
    // they earn their place — two students with the same name in one branch
    // is not rare in a cohort of 240 — so they are included for viewers
    // already at that tier and omitted for everyone else.
    const privileged = can(session, 'directory.view.contact') || can(session, 'directory.view.cgpa');

    const columns: Array<{ label: string; get: (row: (typeof items)[number]) => unknown }> = [
      ...(privileged
        ? [
            {
              label: 'Roll number',
              get: (r: (typeof items)[number]) => findMemberById(r.applicant.id)?.rollNumber ?? '',
            },
          ]
        : []),
      { label: 'Name', get: (r) => r.applicant.fullName },
      { label: 'Batch', get: (r) => r.applicant.batchYear ?? '' },
      { label: 'Branch', get: (r) => r.applicant.departmentCode ?? '' },
      { label: 'Current company', get: (r) => r.applicant.currentCompany ?? '' },
      { label: 'Designation', get: (r) => r.applicant.designation ?? '' },
      { label: 'Applied on', get: (r) => r.createdAt.slice(0, 10) },
      { label: 'Note from applicant', get: (r) => r.note ?? '' },
    ];

    // Written before the file is built. An export that fails halfway is
    // still an export that was attempted, and the log must show it.
    await logAudit({
      tenantId: resolved.tenant.id,
      session,
      action: 'job.applicants.export',
      resource: 'job_applications',
      resourceId: job.id,
      reason,
      before: null,
      after: {
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        postedById: job.postedBy.id,
        rowCount: items.length,
        columns: columns.map((c) => c.label),
        includesContactData: false,
        includesRollNumbers: privileged,
        format: 'csv',
      },
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const header = columns.map((c) => cell(c.label)).join(',');
    const lines = items.map((r) => columns.map((c) => cell(c.get(r))).join(','));
    // Without the mark, Excel on Windows reads the file as ANSI and mangles
    // every name with a diacritic in it.
    const csv = `${BOM}${header}\r\n${lines.join('\r\n')}\r\n`;

    const safeCompany = job.company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const filename = `${resolved.tenant.subdomain}-applicants-${safeCompany || 'posting'}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store, no-cache, must-revalidate, private',
        'x-row-count': String(items.length),
        'x-audit-action': 'job.applicants.export',
      },
    });
  } catch (err) {
    return fail(err);
  }
}
