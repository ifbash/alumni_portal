import { getSession } from '@/lib/auth/session';
import { requireActive } from '@/lib/auth/guard';
import { getGroupBySlug, getGroupMembers, joinVerdict } from '@/lib/data/groups';
import { Membership } from '@/lib/schemas/groups';
import { logAudit } from '@/lib/audit/log';
import { clientIp, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../../_lib/http';
import { requireFeature } from '../../../_lib/feature';

/**
 * Join or leave a group.
 *
 * Open to every active member, with two rules the verdict function states:
 * students join interest groups and not chapters, and a group that asks
 * answers a join with a request a lead decides, never with membership.
 * There is no request field that turns a request into membership.
 *
 * Leaving is always allowed, with one exception that protects the group:
 * the last lead cannot walk away, because a group with nobody running it
 * falls to the alumni cell without anyone having said so.
 */

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await getSession();
    requireActive(session);
    const { tenant } = await requireFeature('groups', 'Groups are');

    const { slug } = await params;
    const { action } = await readJson(request, Membership);

    limit(
      `group-membership:${session.memberId}`,
      40,
      60 * 60,
      'Forty joins and leaves in an hour is the limit. Take a breath and choose the groups you actually want.',
    );

    const group = getGroupBySlug(session, slug);
    if (!group) throw new HttpError(404, 'not_found', 'There is no group at that address.');

    if (action === 'join') {
      const verdict = joinVerdict(session, group);
      if (!verdict.ok) throw new HttpError(409, 'cannot_join', verdict.reason);

      await logAudit({
        tenantId: tenant.id,
        session,
        action: verdict.becomes === 'active' ? 'group.join' : 'group.join_request',
        resource: 'group_members',
        resourceId: group.id,
        before: null,
        after: { groupSlug: group.slug, state: verdict.becomes },
        ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
      });

      const write = fixtureWrite();
      return json({
        ok: true,
        ...write,
        membership: { groupSlug: group.slug, state: verdict.becomes },
        note:
          verdict.becomes === 'active'
            ? `You are in ${group.name}.`
            : `Your request is with the leads of ${group.name}. You are in once one of them approves it.`,
      });
    }

    if (group.viewer.state === null) {
      throw new HttpError(409, 'not_a_member', 'You are not in this group, and you have no request waiting.');
    }

    if (group.viewer.role === 'lead' && group.viewer.state === 'active') {
      const leads = getGroupMembers(session, slug).filter((m) => m.role === 'lead');
      if (leads.length <= 1) {
        throw new HttpError(
          409,
          'last_lead',
          'You are the only lead. Ask another member to take over (or ask the alumni cell to appoint one) before you leave.',
        );
      }
    }

    await logAudit({
      tenantId: tenant.id,
      session,
      action: 'group.leave',
      resource: 'group_members',
      resourceId: group.id,
      before: { groupSlug: group.slug, state: group.viewer.state, role: group.viewer.role },
      after: null,
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();
    return json({
      ok: true,
      ...write,
      membership: { groupSlug: group.slug, state: null },
      note: group.viewer.state === 'requested' ? 'Request withdrawn.' : `You have left ${group.name}.`,
    });
  } catch (err) {
    return fail(err);
  }
}
