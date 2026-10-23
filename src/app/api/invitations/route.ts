import { getSession } from '@/lib/auth/session';
import { requireActive } from '@/lib/auth/guard';
import { getInviteQuota, getMyInvitations } from '@/lib/data/invites';
import { InvitationCreate } from '@/lib/schemas/invitations';
import { logAudit } from '@/lib/audit/log';
import { clientIp, draftId, fail, fixtureWrite, HttpError, json, limit, readJson } from '../_lib/http';
import { requireFeature } from '../_lib/feature';

/**
 * Invitations.
 *
 * Any active member can invite a batchmate who has not registered, within a
 * weekly limit. Three rules shape the handler:
 *
 *  - **It never says whether an address is registered.** A reply that
 *    differed for a member and a stranger would let this endpoint be used to
 *    ask "is this person on the portal", which is a question about someone
 *    who has not agreed to be asked. Every address gets the same answer.
 *  - **The list is the inviter's own.** The college does not read it and the
 *    vendor cannot. It is somebody's friends, entered by them.
 *  - **Volume is capped.** Ten a week per member, five a call, and a
 *    per-address cap: inviting somebody twice in a week is a no-op.
 */

export async function GET() {
  try {
    const session = await getSession();
    requireActive(session);
    await requireFeature('invites', 'Invitations are');

    return json({ quota: getInviteQuota(session), invitations: getMyInvitations(session) });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    requireActive(session);
    const { tenant } = await requireFeature('invites', 'Invitations are');

    const body = await readJson(request, InvitationCreate);

    limit(`invite-call:${session.memberId}`, 20, 60 * 60, 'That is a lot of invitations in an hour. Slow down a little.');
    limit(`invite-ip:${clientIp(request)}`, 60, 60 * 60, 'Too many invitations from this connection in an hour.');

    const quota = getInviteQuota(session);
    const already = new Set(getMyInvitations(session).map((i) => i.email));
    const fresh = body.invitations.filter((p, i, all) => !already.has(p.email) && all.findIndex((q) => q.email === p.email) === i);

    if (fresh.length > quota.remaining) {
      throw new HttpError(
        429,
        'invite_quota',
        quota.canSend
          ? `You can send ${quota.remaining} more this week and you are trying to send ${fresh.length}. Send fewer, or share the link instead.`
          : (quota.reason ?? 'You have reached this week’s limit.'),
        { retryAfter: 24 * 60 * 60 },
      );
    }

    const created = fresh.map((p) => ({
      id: draftId('inv'),
      email: p.email,
      name: p.name ?? null,
      batchYear: p.batchYear ?? null,
      message: body.message ?? null,
      state: 'sent' as const,
      createdAt: new Date().toISOString(),
    }));

    if (created.length > 0) {
      await logAudit({
        tenantId: tenant.id,
        session,
        action: 'invitation.create',
        resource: 'invitations',
        resourceId: created[0]!.id,
        before: null,
        // The addresses are not copied into the audit log: a count, and nothing about who.
        after: { count: created.length },
        ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
      });
    }

    const write = fixtureWrite();
    return json(
      {
        ok: true,
        ...write,
        // The same shape and wording whether any address was new, already invited or already a member.
        accepted: body.invitations.length,
        invitations: created,
        note: 'Done. Each person can register against the college’s records from the link; the invitation stays open for 30 days.',
      },
      { status: 201 },
    );
  } catch (err) {
    return fail(err);
  }
}
