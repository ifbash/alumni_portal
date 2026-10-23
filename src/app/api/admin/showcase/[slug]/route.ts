import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getShowcaseBySlug, publicationProblemFor } from '@/lib/data/showcase';
import { ShowcaseDecision } from '@/lib/schemas/showcase';
import { logAudit } from '@/lib/audit/log';
import { clientIp, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../../_lib/http';
import { requireFeature } from '../../../_lib/feature';

/**
 * Decide a submission, or take a published entry down.
 *
 * Approving publishes. Declining carries a reason the member reads as
 * written and keeps the entry on file so they can resubmit. Unpublishing is
 * for the case that matters most in a module about named people: a featured
 * person asks to be taken out. It happens at once, the reason is recorded,
 * and nothing about it needs the person to justify themselves.
 */

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await getSession();
    requireCap(session, 'showcase.manage');
    const { tenant } = await requireFeature('showcase', 'The showcase is');

    const { slug } = await params;
    const decision = await readJson(request, ShowcaseDecision);
    limit(`showcase-review:${session.memberId}`, 120, 60 * 60, 'A hundred and twenty decisions in an hour is the limit.');

    const entry = getShowcaseBySlug(session, slug);
    if (!entry) throw new HttpError(404, 'not_found', 'There is no entry at that address.');

    if (decision.action === 'unpublish') {
      if (entry.state !== 'published') throw new HttpError(409, 'not_published', 'That entry is not published.');
    } else if (entry.state !== 'pending_moderation') {
      throw new HttpError(409, 'already_decided', 'That entry has already been decided.');
    }

    // The same rule the database holds as a constraint, said in a sentence a
    // curator can act on instead of surfacing as a failed write.
    if (decision.action === 'approve') {
      const problem = publicationProblemFor(slug);
      if (problem) throw new HttpError(409, 'cannot_publish', problem);
    }

    const nextState =
      decision.action === 'approve' ? 'published' : decision.action === 'decline' ? 'rejected' : 'pending_moderation';

    await logAudit({
      tenantId: tenant.id,
      session,
      action: decision.action === 'approve' ? 'showcase.approve' : decision.action === 'decline' ? 'showcase.decline' : 'showcase.unpublish',
      resource: 'showcase_entries',
      resourceId: entry.id,
      before: { state: entry.state },
      after: { state: nextState, moderationNote: decision.action === 'approve' ? null : decision.message },
      reason: decision.action === 'approve' ? null : decision.message,
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();
    return json({
      ok: true,
      ...write,
      entry: { slug, state: nextState },
      note:
        decision.action === 'approve'
          ? 'Approved and published.'
          : decision.action === 'decline'
            ? 'Declined. The member sees the reason under their submissions and can resubmit.'
            : 'Taken down. It is no longer visible to members.',
    });
  } catch (err) {
    return fail(err);
  }
}
