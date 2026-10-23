import { getSession } from '@/lib/auth/session';
import { requireActive } from '@/lib/auth/guard';
import { canRunGroup, getGroupBySlug, getGroupRequests } from '@/lib/data/groups';
import { JoinDecision } from '@/lib/schemas/groups';
import { logAudit } from '@/lib/audit/log';
import { clientIp, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../../_lib/http';
import { requireFeature } from '../../../_lib/feature';

/**
 * Decide a request to join a group that asks.
 *
 * The people who may decide are the group's leads and the staff who run
 * groups (`group.manage`). `canRunGroup` is the one check, and it is
 * repeated here rather than trusted from the page: a lead of one group is
 * not a lead of another, and the request names a group in the address.
 *
 * Declining is quiet by design. A decline is not explained to the person,
 * because a lead telling a stranger why they are not good enough for a
 * noticeboard is a conversation the portal should not host; they can ask the
 * lead directly, through a connection request, if they want to know.
 */

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await getSession();
    requireActive(session);
    const { tenant } = await requireFeature('groups', 'Groups are');

    const { slug } = await params;
    const { memberId, action } = await readJson(request, JoinDecision);

    if (!canRunGroup(session, slug)) {
      throw new HttpError(403, 'forbidden', 'Only the leads of this group, and the staff who run groups, can decide requests.');
    }
    limit(`group-decide:${session.memberId}`, 200, 60 * 60, 'Two hundred decisions in an hour is the limit.');

    const group = getGroupBySlug(session, slug);
    if (!group) throw new HttpError(404, 'not_found', 'There is no group at that address.');

    const waiting = getGroupRequests(session, slug).find((r) => r.member.id === memberId);
    if (!waiting) throw new HttpError(404, 'not_found', 'That person has no request waiting for this group.');

    await logAudit({
      tenantId: tenant.id,
      session,
      action: action === 'approve' ? 'group.request.approve' : 'group.request.decline',
      resource: 'group_members',
      resourceId: `${group.id}:${memberId}`,
      before: { state: 'requested' },
      after: { state: action === 'approve' ? 'active' : null },
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();
    return json({
      ok: true,
      ...write,
      decision: { groupSlug: slug, memberId, action },
      note: action === 'approve' ? 'They are in the group.' : 'Request declined.',
    });
  } catch (err) {
    return fail(err);
  }
}
