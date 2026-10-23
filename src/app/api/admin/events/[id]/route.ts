import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getPendingEventProposals } from '@/lib/data/repo';
import { ProposalDecision } from '@/lib/schemas/events';
import { logAudit } from '@/lib/audit/log';
import { clientIp, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../../_lib/http';
import { requireFeature } from '../../../_lib/feature';

/**
 * Decide a member's event proposal.
 *
 * Behind `event.create.any`: deciding what the college puts its name to is
 * the same act as creating an event, and the people who hold it are the
 * alumni cell and the college admin. An HOD, who holds only the
 * department grant, does not decide proposals.
 *
 * Both outcomes are written back to the proposer. A proposal that leaves
 * the queue without a word is a member who assumes the college ignored them
 * and never proposes again, so declining carries a reason the proposer
 * reads verbatim, and approving says so on their Events page.
 *
 * Approving publishes: the event becomes visible to the members its
 * audience allows and registration opens in the same second. Declining is
 * not deleting: the proposal stays on file, with the reason, and the
 * proposer can put a changed version forward.
 */

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    requireCap(session, 'event.create.any');
    const { tenant } = await requireFeature('events', 'Events are');

    const { id } = await params;
    const decision = await readJson(request, ProposalDecision);

    limit(`event-review:${session.memberId}`, 60, 60 * 60, 'Sixty decisions in an hour is the limit.');

    const proposal = getPendingEventProposals(session).find((e) => e.id === id);
    if (!proposal) {
      throw new HttpError(404, 'not_found', 'There is no proposal waiting with that id. It may already have been decided.');
    }

    const approved = decision.action === 'approve';
    const after = {
      id: proposal.id,
      slug: proposal.slug,
      title: proposal.title,
      published: approved,
      reviewState: approved ? ('approved' as const) : ('rejected' as const),
      moderationNote: decision.action === 'decline' ? decision.message : null,
    };

    await logAudit({
      tenantId: tenant.id,
      session,
      action: approved ? 'event.proposal.approve' : 'event.proposal.decline',
      resource: 'events',
      resourceId: proposal.id,
      before: { published: false, reviewState: 'pending' },
      after,
      reason: decision.action === 'decline' ? decision.message : null,
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();

    return json({
      ok: true,
      ...write,
      event: after,
      href: `/events/${proposal.slug}`,
      note: approved
        ? 'Approved and published. Registration is open to the members its audience allows.'
        : 'Declined. The proposer sees the reason on their Events page.',
    });
  } catch (err) {
    return fail(err);
  }
}
