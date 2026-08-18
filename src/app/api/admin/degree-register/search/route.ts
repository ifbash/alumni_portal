import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenant } from '@/lib/tenant';
import { getDepartments, searchDegreeRegister } from '@/lib/data/repo';
import { clientIp, fail, HttpError, json, limit, parseQuery } from '../../../_lib/http';

/**
 * Typeahead over the degree register.
 *
 * The register is the source of truth for verification: it exists for
 * every graduate whether or not they have signed up, and a claim is
 * approved by matching it to a row here. This endpoint is what a reviewer
 * types into when the matcher surfaced nothing and they need to find the
 * row by hand — a 2013 graduate whose year came from a different file, a
 * name spelled two ways between the certificate and the form.
 *
 * **`verification.review.any`, not `.department`.** The register is
 * searched whole, across every branch, and a department-scoped reviewer
 * has no business enumerating another branch's graduates. An HOD reviews
 * with the candidates the matcher has already attached to the claim,
 * which are narrowed to their department before they ever reach them.
 *
 * **A search needs something to search for.** Two characters, or a branch,
 * or a year — a bare call returns 422 rather than the first page of every
 * graduate since 2013. An endpoint that will hand over the register in
 * pages, without a filter and without an audit entry, is a bulk export
 * with a different name on it, and `perPage` is capped for the same
 * reason.
 *
 * The register carries no contact data — roll number, name, branch,
 * programme, years, and the file the row was loaded from. Nothing here
 * needs the two-gate contact release, because there is nothing here to
 * release.
 */

const MIN_TERM = 2;
const MAX_PER_PAGE = 25;

const Query = z.object({
  q: z.string().trim().max(60).optional(),
  department: z.string().trim().max(12).optional(),
  year: z.coerce.number().int().min(1960).max(2100).optional(),
  page: z.coerce.number().int().min(1).max(200).optional(),
  perPage: z.coerce.number().int().min(1).max(MAX_PER_PAGE).optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getSession();
    requireCap(session, 'verification.review.any');

    const tenant = await getTenant();
    if (!tenant) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');

    const query = parseQuery(request, Query);

    const term = query.q?.trim() ?? '';
    if (term.length < MIN_TERM && !query.department && !query.year) {
      throw new HttpError(
        422,
        'query_too_broad',
        'Type at least two characters of a name or roll number, or narrow by branch or year of passing. The register is not browsable page by page.',
        {
          fieldErrors: { q: 'At least two characters.' },
          minTermLength: MIN_TERM,
        },
      );
    }

    if (query.department && !getDepartments().some((d) => d.code === query.department)) {
      throw new HttpError(422, 'invalid_query', 'That branch does not exist on this tenant.', {
        fieldErrors: { department: 'Pick a branch from the list.' },
      });
    }

    // Generous: a reviewer typing a roll number sends a request per
    // keystroke. The cap is here to stop a script walking the register,
    // and a person typing will never reach it.
    limit(
      `degree-register-search:${session.memberId}:${clientIp(request)}`,
      150,
      60,
      'That is a lot of searches in a minute. Wait a moment — if you are trying to pull the whole register, the examinations branch holds the file.',
    );

    const result = searchDegreeRegister(term, {
      department: query.department,
      year: query.year,
      page: query.page,
      perPage: query.perPage ?? 10,
    });

    return json({
      // Selected into a shape rather than spread: the stored row is narrow
      // today, and a column added to it later must not widen this response
      // by accident.
      items: result.items.map((r) => ({
        id: r.id,
        rollNumber: r.rollNumber,
        name: r.name,
        departmentCode: r.departmentCode,
        programme: r.programme,
        admissionYear: r.admissionYear,
        yearOfPassing: r.yearOfPassing,
        // Provenance. "Which file did this row come from" is the first
        // question when two rows disagree about a spelling.
        sourceFile: r.sourceFile,
      })),
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      pageCount: result.pageCount,
      truncated: result.total > result.items.length,
      note:
        result.total === 0
          ? 'No register row matches. The examinations branch has not supplied every batch since 2013 — a missing year is common, and approving against no row needs the override capability.'
          : null,
    });
  } catch (err) {
    return fail(err);
  }
}
