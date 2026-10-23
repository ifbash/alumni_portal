import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getBusinessBySlug } from '@/lib/data/businesses';
import { BusinessOwnerAction } from '@/lib/schemas/businesses';
import { logAudit } from '@/lib/audit/log';
import { clientIp, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../_lib/http';
import { requireFeature } from '../../_lib/feature';

/**
 * The owner's two things to do with a listing: close it, or resubmit it.
 *
 * Only the owner. A moderator decides listings through the staff route and
 * cannot edit someone's description, only approve or refuse it with a
 * reason, so what the directory says is always what the owner wrote.
 *
 * A resubmission replaces the content and goes back for review, whatever its
 * state was. A live listing edited into something else would otherwise skip
 * the review it passed once; the cost is that an edit takes the listing off
 * the directory until it is approved again, which the response says.
 */

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await getSession();
    requireCap(session, 'business.list');
    const { tenant } = await requireFeature('businesses', 'The business directory is');

    const { slug } = await params;
    const body = await readJson(request, BusinessOwnerAction);
    limit(`business-edit:${session.memberId}`, 20, 60 * 60, 'Twenty edits in an hour is the limit.');

    const before = getBusinessBySlug(session, slug);
    // Not the owner reads as not found: whether somebody else's listing exists is not for you to learn from an error.
    if (!before || before.owner.id !== session.memberId) {
      throw new HttpError(404, 'not_found', 'There is no listing of yours at that address.');
    }

    if (body.action === 'close') {
      if (before.status === 'closed') throw new HttpError(409, 'already_closed', 'That listing is already closed.');

      await logAudit({
        tenantId: tenant.id,
        session,
        action: 'business.close',
        resource: 'businesses',
        resourceId: before.id,
        before: { status: before.status },
        after: { status: 'closed' },
        ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
      });
      const write = fixtureWrite();
      return json({ ok: true, ...write, business: { slug, status: 'closed' }, note: 'Closed. It no longer appears in the directory.' });
    }

    await logAudit({
      tenantId: tenant.id,
      session,
      action: 'business.resubmit',
      resource: 'businesses',
      resourceId: before.id,
      before: { status: before.status, name: before.name },
      after: { status: 'pending_moderation', name: body.business.name, industry: body.business.industry },
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();
    return json({
      ok: true,
      ...write,
      business: { slug, status: 'pending_moderation' },
      note:
        before.status === 'live'
          ? 'Saved and sent for review. It is out of the directory until the alumni cell approves the change.'
          : 'Sent for review again.',
    });
  } catch (err) {
    return fail(err);
  }
}
