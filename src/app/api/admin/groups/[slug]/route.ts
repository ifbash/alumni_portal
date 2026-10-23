import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getGroupBySlug } from '@/lib/data/groups';
import { GroupUpdate } from '@/lib/schemas/groups';
import { logAudit } from '@/lib/audit/log';
import { clientIp, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../../_lib/http';
import { requireFeature } from '../../../_lib/feature';

/**
 * Change a group.
 *
 * The address and the kind never change: links to a group are forwarded, and
 * a chapter that becomes an interest group is a different group. Archiving
 * is the way to retire one; it hides the group from members and keeps its
 * history. Every change is audited with the group as it was and as it is.
 */

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await getSession();
    requireCap(session, 'group.manage');
    const { tenant } = await requireFeature('groups', 'Groups are');

    const { slug } = await params;
    const body = await readJson(request, GroupUpdate);
    limit(`group-edit:${session.memberId}`, 120, 60 * 60, 'A hundred and twenty group edits in an hour is the limit.');

    const before = getGroupBySlug(session, slug);
    if (!before) throw new HttpError(404, 'not_found', 'There is no group at that address.');

    const after = {
      name: body.name ?? before.name,
      description: body.description ?? before.description,
      joinPolicy: body.joinPolicy ?? before.joinPolicy,
      archived: body.archived ?? before.archived,
    };

    await logAudit({
      tenantId: tenant.id,
      session,
      action:
        body.archived === true && !before.archived ? 'group.archive' : body.archived === false && before.archived ? 'group.restore' : 'group.update',
      resource: 'groups',
      resourceId: before.id,
      before: { name: before.name, description: before.description, joinPolicy: before.joinPolicy, archived: before.archived },
      after,
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();
    return json({
      ok: true,
      ...write,
      group: { slug, ...after },
      note: after.archived ? 'Archived. Members no longer see it; its history is kept.' : 'Saved.',
    });
  } catch (err) {
    return fail(err);
  }
}
