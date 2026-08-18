import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { AuthzError, can, requireSession } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { searchDirectory } from '@/lib/data/repo';
import { fail, flagParam, HttpError, json, parseQuery } from '../_lib/http';

/**
 * Directory search.
 *
 * The directory is never anonymous — `searchDirectory` calls
 * `requireDirectoryAccess()` before it reads a row, and this handler
 * refuses first anyway. A competitor shipped this list publicly; that is
 * the failure this route exists not to repeat.
 *
 * The response is *projected*, not filtered: the repository selects into
 * a tier's field list, so contact details, CGPA and placement status
 * cannot appear here by accident. There is no query parameter that widens
 * it, because the width is a property of the viewer, not of the request.
 */

const Query = z.object({
  q: z.string().trim().max(120).optional(),
  department: z.string().trim().max(12).optional(),
  batchFrom: z.coerce.number().int().min(1990).max(2100).optional(),
  batchTo: z.coerce.number().int().min(1990).max(2100).optional(),
  company: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional(),
  industry: z.string().trim().max(80).optional(),
  skill: z.string().trim().max(60).optional(),
  mentoring: flagParam,
  referrals: flagParam,
  speaking: flagParam,
  cohort: z.enum(['alumni', 'students', 'all']).optional(),
  sort: z.enum(['relevance', 'recent', 'batch', 'name']).optional(),
  page: z.coerce.number().int().min(1).max(500).optional(),
  // Capped hard. An unbounded page size turns a paginated directory into
  // a bulk export with no audit entry against it.
  perPage: z.coerce.number().int().min(1).max(60).optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getSession();
    requireSession(session);

    const resolved = await getTenantBrand();
    if (!resolved) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');
    if (!resolved.brand.pack.features.directory) {
      throw new HttpError(404, 'feature_off', 'The directory is not enabled for this college.');
    }

    // An HOD holds `directory.search.students` and not the alumni one;
    // requiring a single capability here would lock out half the staff.
    const searchesAlumni = can(session, 'directory.search.alumni');
    const searchesStudents = can(session, 'directory.search.students');
    if (!searchesAlumni && !searchesStudents) {
      throw new AuthzError(403, 'forbidden', 'Your account cannot search the directory.');
    }

    const query = parseQuery(request, Query);

    // Students may not enumerate students. The repository enforces this
    // through `visibleStatusesFor()` regardless; refusing here means the
    // caller is told why instead of receiving a silently empty page.
    if (query.cohort === 'students' && !searchesStudents) {
      throw new AuthzError(403, 'forbidden', 'Students are not listed in the directory you can search.');
    }

    if (query.batchFrom && query.batchTo && query.batchFrom > query.batchTo) {
      throw new HttpError(422, 'invalid_query', 'The batch range starts after it ends.', {
        fieldErrors: { batchFrom: 'This year is later than the "to" year.' },
      });
    }

    const result = searchDirectory(session, query);

    return json({
      items: result.items,
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      pageCount: result.pageCount,
      facets: result.facets,
      // Naming the tier in the payload is how a client explains a missing
      // field honestly — "your account does not see city" beats a blank.
      tier: result.tier,
    });
  } catch (err) {
    return fail(err);
  }
}
