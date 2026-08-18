import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { AuthzError, can, canInDepartment, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getEvents, getEventRegistrations } from '@/lib/data/repo';
import { logAudit } from '@/lib/audit/log';
import { clientIp, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../../_lib/http';

/**
 * The check-in desk.
 *
 * Two separate questions, and both have to be answered yes:
 *
 *  1. **Can this account mark attendance at all?** `event.checkin`, which
 *     the alumni cell operator and the college admin hold and nobody else
 *     does.
 *  2. **Is this their event to run?** Holding the capability is not the
 *     same as administering the VLSI workshop. A department-scoped
 *     organiser may work their own branch's desk; anything wider needs
 *     `event.create.any`. Without that second check, one capability
 *     handed out for one reunion becomes attendance-editing rights over
 *     every event the college has ever held.
 *
 * The registration is looked up *within the event*, so a registration id
 * belonging to a different event is a 404 rather than a cross-event
 * write. Reversals carry a written reason: attendance is the record a
 * department quotes back at an accreditation visit, and a row that
 * flipped twice with nothing beside it is the one nobody can explain.
 *
 * Route note: the dynamic segment is `[slug]` because Next allows only
 * one parameter name per path position and `/api/events/[slug]/register`
 * claimed it first. The value is matched against the event id *and* the
 * slug, exactly as `/admin/events/[id]` does, so both forms work.
 */

const Body = z
  .object({
    registrationId: z.string().trim().min(1).max(64),
    /** Reversing a check-in is a different act from recording one. */
    action: z.enum(['check_in', 'undo']).default('check_in'),
    reason: z.string().trim().max(300).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === 'undo' && (value.reason?.length ?? 0) < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message:
          'Say why the check-in is being reversed — marked the wrong row, the person left before the session, a duplicate at the desk. An attendance record that flipped for no stated reason is the one that gets queried later.',
      });
    }
  });

/** The desk opens on the day. Marking a reunion attended a month early is a mistake, not a workflow. */
const DESK_OPENS_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await getSession();
    requireCap(session, 'event.checkin');

    const resolved = await getTenantBrand();
    if (!resolved) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');
    if (!resolved.brand.pack.features.events) {
      throw new HttpError(404, 'feature_off', 'Events are not enabled for this college.');
    }

    const { slug } = await params;

    // Drafts included: a desk sometimes runs before the listing is
    // published. `getEvents` only hands drafts to `event.create.any`.
    const event = getEvents(session, { when: 'all', includeDrafts: true }).find(
      (e) => e.id === slug || e.slug === slug,
    );
    if (!event) {
      throw new HttpError(404, 'not_found', 'There is no event with that id or slug.');
    }

    // The second gate. `event.checkin` says what this account may do;
    // this says which events it may do it to.
    const wide = can(session, 'event.create.any');
    if (!wide && !canInDepartment(session, 'event.create.department', event.departmentCode)) {
      throw new AuthzError(
        403,
        'forbidden',
        event.departmentCode
          ? `This event is run by ${event.departmentCode}, which is outside your scope. Ask the alumni cell or that department to work the desk.`
          : 'This is a college-wide event. Marking attendance on it needs event.create.any, which the alumni cell and the college admin hold.',
      );
    }

    const body = await readJson(request, Body);

    // A desk moves fast and a queue is a burst by nature; the cap is here
    // to stop a script, not to slow down whoever is scanning IDs.
    limit(
      `event-checkin:${session.memberId}:${event.id}`,
      400,
      15 * 60,
      'That is faster than any queue moves. If two people are working the same desk, sign in as yourselves rather than sharing one account.',
    );

    // Scoped to this event. A registration id from another event is not
    // "forbidden", it simply is not here.
    const registration = getEventRegistrations(event.id).find((r) => r.id === body.registrationId);
    if (!registration) {
      throw new HttpError(
        404,
        'not_found',
        `There is no registration with that id for ${event.title}. Check the id against the roster — a ticket from another event will not scan here.`,
      );
    }

    const alreadyIn = Boolean(registration.checkedInAt);

    if (body.action === 'check_in' && alreadyIn) {
      throw new HttpError(
        409,
        'already_checked_in',
        `${registration.memberName} was already checked in. Two people with the same name in one batch is common — confirm the roll number on the roster before marking the other row.`,
        { registrationId: registration.id, checkedInAt: registration.checkedInAt },
      );
    }

    if (body.action === 'undo' && !alreadyIn) {
      throw new HttpError(
        409,
        'not_checked_in',
        `${registration.memberName} has not been checked in, so there is nothing to reverse.`,
        { registrationId: registration.id },
      );
    }

    if (body.action === 'check_in' && new Date(event.startsAt).getTime() - Date.now() > DESK_OPENS_MS) {
      throw new HttpError(
        409,
        'desk_not_open',
        `${event.title} starts on ${event.startsAt.slice(0, 10)}. Attendance can be recorded from the day before it begins — marking it now would put an attendance record against a day nobody was on campus.`,
        { startsAt: event.startsAt },
      );
    }

    const checkedInAt = body.action === 'check_in' ? new Date().toISOString() : null;

    const before = {
      registrationId: registration.id,
      memberId: registration.memberId,
      checkedInAt: registration.checkedInAt,
      guests: registration.guests,
    };
    const after = { ...before, checkedInAt };

    await logAudit({
      tenantId: resolved.tenant.id,
      session,
      action: body.action === 'check_in' ? 'event.checkin' : 'event.checkin.undo',
      resource: 'event_registrations',
      resourceId: registration.id,
      before,
      after,
      reason: body.reason ?? null,
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();

    return json({
      ok: true,
      ...write,
      action: body.action,
      event: { id: event.id, slug: event.slug, title: event.title },
      registration: {
        id: registration.id,
        memberName: registration.memberName,
        batchYear: registration.batchYear,
        guests: registration.guests,
        seats: 1 + registration.guests,
        checkedIn: body.action === 'check_in',
        checkedInAt,
      },
      note:
        body.action === 'check_in'
          ? registration.guests
            ? `${registration.memberName} is in, with ${registration.guests} guest${registration.guests === 1 ? '' : 's'}. ${1 + registration.guests} seats accounted for.`
            : `${registration.memberName} is in.`
          : `The check-in for ${registration.memberName} is reversed. Both the original entry and this reversal stay in the audit log — neither can be removed.`,
    });
  } catch (err) {
    return fail(err);
  }
}
