import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { groupSlugTaken } from '@/lib/data/groups';
import { GroupCreate } from '@/lib/schemas/groups';
import { slugify } from '@/lib/community';
import { logAudit } from '@/lib/audit/log';
import { clientIp, draftId, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../_lib/http';
import { requireFeature } from '../../_lib/feature';

/**
 * Create a group or a chapter.
 *
 * Behind `group.manage`: the alumni cell and the college admin. Members do
 * not start groups. A group is something a college stands behind, with a
 * name on it and leads appointed, and one anybody could open would be a
 * noticeboard nobody is watching. The route says so in its refusal.
 */

export async function POST(request: Request) {
  try {
    const session = await getSession();
    requireCap(session, 'group.manage');
    const { tenant } = await requireFeature('groups', 'Groups are');

    const body = await readJson(request, GroupCreate);

    limit(`group-create:${session.memberId}`, 30, 60 * 60, 'Thirty groups in an hour is the limit.');

    const slug = body.slug ?? slugify(body.name, 80, 'group');
    if (groupSlugTaken(slug)) {
      throw new HttpError(409, 'slug_taken', `A group already uses /groups/${slug}. Add a word to tell them apart.`, {
        slug,
        fieldErrors: { slug: 'Choose a different address.' },
      });
    }

    const after = {
      id: draftId('grp'),
      slug,
      name: body.name,
      kind: body.kind,
      description: body.description,
      city: body.city ?? null,
      country: body.country ?? null,
      joinPolicy: body.joinPolicy,
      archived: false,
      memberCount: 0,
    };

    await logAudit({
      tenantId: tenant.id,
      session,
      action: 'group.create',
      resource: 'groups',
      resourceId: after.id,
      before: null,
      after,
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();
    return json(
      {
        ok: true,
        ...write,
        group: after,
        href: `/groups/${slug}`,
        note: 'Created. It has no members and no leads yet: appoint a lead from the group’s page in the console, so somebody is looking after it.',
      },
      { status: 201 },
    );
  } catch (err) {
    return fail(err);
  }
}
