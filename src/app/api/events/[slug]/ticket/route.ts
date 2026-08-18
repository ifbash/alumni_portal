import { getSession } from '@/lib/auth/session';
import { requireSession } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getEventBySlug, getEventRegistrations } from '@/lib/data/repo';
import { fail, HttpError, json } from '../../../_lib/http';

/**
 * The viewer's own ticket for an event.
 *
 * The registration is resolved from the session and from nothing else.
 * There is no member id in the path, no `?memberId=`, and no branch that
 * would accept one — the only registration this route can return is the
 * caller's, so there is no shape of request that turns it into a roster.
 * The roster is a separate, capability-gated thing; see the check-in
 * endpoint beside this one.
 *
 * `getEventBySlug` has already decided whether this viewer may see the
 * event at all, so a student asking for an alumni-only reunion gets the
 * same 404 the events list gave them, rather than a 403 that confirms the
 * reunion exists.
 *
 * A member with no registration is a 404 and not an empty object. "You
 * have no ticket" and "here is your ticket, with nothing in it" are
 * different answers, and a client that renders the second one puts
 * somebody at a registration desk holding a blank pass.
 */

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await getSession();
    // Reading your own ticket is not gated on `event.register`: a member
    // whose roles changed after they registered — a final-year rolled over
    // to alumni, an alumnus who took on a staff role — still has to be
    // able to produce the ticket they hold.
    requireSession(session);

    const resolved = await getTenantBrand();
    if (!resolved) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');
    if (!resolved.brand.pack.features.events) {
      throw new HttpError(404, 'feature_off', 'Events are not enabled for this college.');
    }

    const { slug } = await params;

    const event = getEventBySlug(session, slug);
    if (!event) {
      throw new HttpError(404, 'not_found', 'That event is not available to you.');
    }

    // Matched on the session's member id. The registration row carries the
    // amount and the check-in stamp, which the event projection does not.
    const registration = getEventRegistrations(event.id).find((r) => r.memberId === session.memberId);

    if (!registration) {
      throw new HttpError(
        404,
        'not_registered',
        'You do not have a registration for this event. If somebody registered on your behalf, it is held against their account, not yours.',
        { eventSlug: event.slug, eventTitle: event.title },
      );
    }

    const seats = 1 + registration.guests;
    const checkedIn = Boolean(registration.checkedInAt);

    return json({
      registration: {
        id: registration.id,
        eventId: event.id,
        eventSlug: event.slug,
        guests: registration.guests,
        seats,
        amountPaid: registration.amountPaid,
        currency: resolved.brand.pack.locale.currency,
        checkedIn,
        checkedInAt: registration.checkedInAt,
        registeredAt: registration.createdAt,
      },
      event: {
        id: event.id,
        slug: event.slug,
        title: event.title,
        venue: event.venue,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        ticketPrice: event.ticketPrice,
      },
      note: checkedIn
        ? 'You have already been checked in at the venue. If that is wrong, the registration desk can reverse it.'
        : registration.amountPaid > 0
          ? 'Show this registration id at the desk with a photo ID. Payment is already recorded against it.'
          : 'Show this registration id at the desk with a photo ID.',
    });
  } catch (err) {
    return fail(err);
  }
}
