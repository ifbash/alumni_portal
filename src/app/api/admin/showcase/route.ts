import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { findMemberById, getDepartments } from '@/lib/data/repo';
import { showcaseSlugTaken } from '@/lib/data/showcase';
import { slugify } from '@/lib/community';
import { ShowcaseCurate } from '@/lib/schemas/showcase';
import { logAudit } from '@/lib/audit/log';
import { clientIp, draftId, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../_lib/http';
import { requireFeature } from '../../_lib/feature';

/**
 * Staff adding an entry to the showcase.
 *
 * Behind `showcase.manage`. An entry is content about a named person, so the
 * route enforces what the console cannot be trusted to remember: about a
 * member of the portal, `consentConfirmed` must be true (the person agreed to
 * be featured, and the audit entry records who confirmed it); about somebody
 * who is not on the portal, a public source must be given. Both are in the
 * schema, so neither can be skipped by leaving a field out.
 *
 * `publish` has no default, for the same reason it has none on events and
 * pages: an entry that goes live the moment it is saved is one nobody
 * re-read.
 */

export async function POST(request: Request) {
  try {
    const session = await getSession();
    requireCap(session, 'showcase.manage');
    const { tenant } = await requireFeature('showcase', 'The showcase is');

    const body = await readJson(request, ShowcaseCurate);
    limit(`showcase-curate:${session.memberId}`, 60, 60 * 60, 'Sixty entries in an hour is the limit.');

    if (body.memberId && !findMemberById(body.memberId)) {
      throw new HttpError(422, 'invalid_input', 'That member is not on the portal.', {
        fieldErrors: { memberId: 'Choose a member from the list, or leave it blank and give a public source.' },
      });
    }
    if (body.departmentCode && !getDepartments().some((d) => d.code === body.departmentCode)) {
      throw new HttpError(422, 'invalid_input', 'That branch does not exist on this college.', {
        fieldErrors: { departmentCode: 'Pick a branch from the list, or leave it blank.' },
      });
    }

    const slug = body.slug ?? slugify(body.headline, 90, 'entry');
    if (showcaseSlugTaken(slug)) {
      throw new HttpError(409, 'slug_taken', `An entry already uses /showcase/${slug}. Make the headline a little more specific.`, {
        slug,
        fieldErrors: { slug: 'Choose a different address.' },
      });
    }

    const entry = {
      id: draftId('show'),
      slug,
      kind: body.kind,
      category: body.category,
      headline: body.headline,
      summary: body.summary,
      displayName: body.displayName,
      memberId: body.memberId ?? null,
      sourceUrl: body.sourceUrl ?? null,
      featured: body.featured,
      source: 'curated' as const,
      state: body.publish ? ('published' as const) : ('pending_moderation' as const),
    };

    await logAudit({
      tenantId: tenant.id,
      session,
      action: body.publish ? 'showcase.publish' : 'showcase.create',
      resource: 'showcase_entries',
      resourceId: entry.id,
      before: null,
      after: {
        ...entry,
        // Who attested that the person agreed, and on what basis.
        basis: body.memberId ? { consent: 'confirmed_by_staff', confirmedBy: session.memberId } : { publicSource: body.sourceUrl },
      },
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();
    return json(
      {
        ok: true,
        ...write,
        entry,
        href: `/showcase/${slug}`,
        note: body.publish ? 'Published. Members can read it now.' : 'Saved, not published. It is visible only to you and the people who curate the showcase.',
      },
      { status: 201 },
    );
  } catch (err) {
    return fail(err);
  }
}
