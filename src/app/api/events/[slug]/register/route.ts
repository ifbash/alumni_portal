import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getEventBySlug } from '@/lib/data/repo';
import {
  draftId,
  fail,
  fixtureWrite,
  HttpError,
  json,
  limit,
  readJsonOptional,
} from '../../../_lib/http';

/**
 * Event registration.
 *
 * `getEventBySlug` has already decided whether this viewer may see the
 * event at all: an alumni-only reunion is not merely hidden from a
 * student's list, it is not addressable by them anywhere, so a student
 * posting the slug directly gets the same 404 the list gave them.
 *
 * Everything after that is capacity arithmetic and honesty about money.
 * Fixture mode holds no registrations, so the response says so rather
 * than returning a ticket that does not exist.
 */

const Body = z.object({
  guests: z.coerce
    .number()
    .int()
    .min(0)
    .max(4, 'Four guests is the most any registration can carry. Larger groups: email the alumni cell.')
    .optional(),
});

async function loadEvent(slug: string) {
  const session = await getSession();
  requireCap(session, 'event.register');

  const resolved = await getTenantBrand();
  if (!resolved) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');
  if (!resolved.brand.pack.features.events) {
    throw new HttpError(404, 'feature_off', 'Events are not enabled for this college.');
  }

  const event = getEventBySlug(session, slug);
  if (!event) {
    throw new HttpError(404, 'not_found', 'That event is not available to you.');
  }

  return { session, event, pack: resolved.brand.pack };
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { session, event, pack } = await loadEvent(slug);

    // Registration is cheap to attempt and expensive to process; a burst
    // from one account is a script, not a person changing their mind.
    limit(
      `event-register:${session.memberId}`,
      12,
      10 * 60,
      'That is a lot of registration attempts in a short time. Wait a few minutes.',
    );

    const { guests = 0 } = await readJsonOptional(request, Body);

    if (event.viewerRegistration) {
      throw new HttpError(409, 'already_registered', 'You are already registered for this event.', {
        registrationId: event.viewerRegistration.id,
      });
    }

    if (new Date(event.startsAt).getTime() < Date.now()) {
      throw new HttpError(409, 'closed', 'This event has already started. Registration is closed.');
    }

    const seats = 1 + guests;
    const remaining = event.capacity === null ? null : event.capacity - event.registeredCount;

    if (remaining !== null && remaining < seats) {
      throw new HttpError(
        409,
        remaining <= 0 ? 'full' : 'not_enough_seats',
        remaining <= 0
          ? 'This event is full. The alumni cell keeps a waiting list — write to them and they will add you.'
          : `Only ${remaining} ${remaining === 1 ? 'seat is' : 'seats are'} left, and you asked for ${seats}. Register for fewer and add guests later if seats free up.`,
        { remaining, requested: seats },
      );
    }

    const amountDue = event.ticketPrice * seats;
    const write = fixtureWrite();

    return json(
      {
        ok: true,
        ...write,
        registration: {
          id: draftId('reg'),
          eventId: event.id,
          eventTitle: event.title,
          memberId: session.memberId,
          guests,
          seats,
          amountDue,
          currency: pack.locale.currency,
          checkedInAt: null,
          createdAt: new Date().toISOString(),
        },
        // A paid event is not confirmed by this call. Saying so here keeps
        // the client from printing a ticket for an unpaid registration.
        requiresPayment: amountDue > 0,
        note:
          amountDue > 0
            ? 'Your seat is held until payment completes. Pay by UPI from the event page to confirm it.'
            : 'Your seat is confirmed. Bring a photo ID to the registration desk.',
      },
      { status: 201 },
    );
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { event } = await loadEvent(slug);

    if (!event.viewerRegistration) {
      throw new HttpError(404, 'not_registered', 'You do not have a registration for this event.');
    }

    if (event.viewerRegistration.checkedIn) {
      throw new HttpError(
        409,
        'already_checked_in',
        'You have already been checked in at the venue, so this registration cannot be cancelled. Speak to the desk.',
      );
    }

    const write = fixtureWrite();

    return json({
      ok: true,
      ...write,
      cancelled: {
        registrationId: event.viewerRegistration.id,
        eventId: event.id,
        eventTitle: event.title,
        seatsReleased: 1 + event.viewerRegistration.guests,
        cancelledAt: new Date().toISOString(),
      },
      // The college refunds by hand; promising an automatic one here would
      // be claiming an outcome the product cannot show.
      note:
        event.ticketPrice > 0
          ? 'Your seat is released. Refunds for paid events are handled by the alumni cell — write to them with your registration id.'
          : 'Your seat is released and is available to somebody else immediately.',
    });
  } catch (err) {
    return fail(err);
  }
}
