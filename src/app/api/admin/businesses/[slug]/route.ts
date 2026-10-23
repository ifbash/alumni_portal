import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getPendingBusinesses } from '@/lib/data/businesses';
import { BusinessDecision } from '@/lib/schemas/businesses';
import { logAudit } from '@/lib/audit/log';
import { clientIp, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../../_lib/http';
import { requireFeature } from '../../../_lib/feature';

/**
 * Decide a business listing.
 *
 * Behind `business.moderate`: the alumni cell and the college admin. A
 * listing is the college's name over somebody's business, so approving one
 * is a decision with a name on it, and the audit entry carries the
 * moderator's.
 *
 * Declining carries a reason the owner reads as written, and the listing
 * stays on file so they can resubmit. A moderator cannot edit the owner's
 * description: approve what was written, or say what to change.
 */

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await getSession();
    requireCap(session, 'business.moderate');
    const { tenant } = await requireFeature('businesses', 'The business directory is');

    const { slug } = await params;
    const decision = await readJson(request, BusinessDecision);
    limit(`business-review:${session.memberId}`, 120, 60 * 60, 'A hundred and twenty decisions in an hour is the limit.');

    const listing = getPendingBusinesses(session).find((b) => b.slug === slug);
    if (!listing) {
      throw new HttpError(404, 'not_found', 'There is no listing waiting at that address. It may already have been decided.');
    }

    const approved = decision.action === 'approve';

    await logAudit({
      tenantId: tenant.id,
      session,
      action: approved ? 'business.approve' : 'business.decline',
      resource: 'businesses',
      resourceId: listing.id,
      before: { status: 'pending_moderation' },
      after: { status: approved ? 'live' : 'rejected', moderationNote: decision.action === 'decline' ? decision.message : null },
      reason: decision.action === 'decline' ? decision.message : null,
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();
    return json({
      ok: true,
      ...write,
      business: { slug, status: approved ? 'live' : 'rejected' },
      note: approved ? 'Approved. It is in the directory now.' : 'Declined. The owner sees the reason on their listing and can resubmit.',
    });
  } catch (err) {
    return fail(err);
  }
}
