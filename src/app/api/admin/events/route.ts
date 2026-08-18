import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { AuthzError, can, canInDepartment, require as requireCap, requireSession } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDepartments, getEvents } from '@/lib/data/repo';
import { logAudit } from '@/lib/audit/log';
import { clientIp, draftId, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../_lib/http';

/**
 * Create an event.
 *
 * Two capabilities reach this handler and the difference between them is
 * the whole point:
 *
 *  - `event.create.any` — the alumni cell and the college admin. A
 *    college-wide event, or any single branch.
 *  - `event.create.department` — an HOD, for their own branch and nothing
 *    else.
 *
 * **The department is clamped on the server, not chosen on the client.**
 * The composer already builds its branch select from the one option a
 * scoped organiser may pick, but a select is presentation. An HOD who
 * posts `departmentCode: "ECE"` is refused with a 403 that names the
 * scope they actually hold, and an HOD who posts *nothing* gets their own
 * branch written in rather than a college-wide event — omitting a field
 * must never be a way to widen a grant. Narrowing a request is safe;
 * widening one is the failure this endpoint exists to prevent.
 *
 * Three validations that are cheap here and expensive later:
 *
 *  - **`endsAt` after `startsAt`.** An event that finishes before it
 *    begins sorts wrongly on every listing and reads as a data error to
 *    the member who spots it first.
 *  - **Capacity is a positive number of seats.** Zero seats is not a
 *    sold-out event, it is a registration form nobody can complete.
 *  - **A ticketed event has a price, and a free one has none.** Both
 *    halves matter: "paid, ₹0" sends members through Razorpay for
 *    nothing, and "free, ₹500" charges people for an event advertised as
 *    free.
 *
 * `publish` is explicit. A draft is invisible to members and opens no
 * registration; publishing opens it the same second, so the two are not
 * allowed to share a default.
 */

const ISO_DATETIME = 'Send the date and time as an ISO 8601 instant, e.g. 2027-09-24T10:00:00.000Z.';

const instant = (message: string) =>
  z
    .string()
    .trim()
    .min(1)
    .max(40)
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: `${message} ${ISO_DATETIME}` });

const Body = z
  .object({
    title: z
      .string()
      .trim()
      .min(4, 'Give the event a title members will recognise in a list.')
      .max(140),
    description: z.string().trim().max(4000).optional(),
    venue: z
      .string()
      .trim()
      .min(2, 'Say where it is, even if that is “Online — link sent on registration”.')
      .max(240),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase words separated by hyphens.')
      .min(4)
      .max(90)
      .optional(),
    /** Absent means college-wide — and only `event.create.any` may mean it. */
    departmentCode: z.string().trim().max(12).optional(),
    startsAt: instant('That start date and time could not be read.'),
    endsAt: instant('That end date and time could not be read.').optional(),
    audience: z.enum(['both', 'alumni_only']).default('both'),
    capacity: z
      .number()
      .int('Capacity is a whole number of seats.')
      .positive('Capacity is a whole number of seats, or left out entirely for no cap. Zero seats is not a sold-out event.')
      .max(100000)
      .optional(),
    /** Declared rather than inferred, so "paid" and "₹0" cannot both be true. */
    ticketed: z.boolean().default(false),
    ticketPrice: z
      .number()
      .int('Ticket prices are whole rupees.')
      .min(0)
      .max(500000)
      .default(0),
    publish: z.boolean({
      required_error:
        'Say whether this is a draft or a publish. Publishing opens registration to members immediately.',
      invalid_type_error: 'publish is true or false.',
    }),
  })
  .superRefine((value, ctx) => {
    if (value.endsAt && Date.parse(value.endsAt) <= Date.parse(value.startsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsAt'],
        message: 'The event cannot finish before it starts. Check the end date as well as the time.',
      });
    }

    if (value.ticketed && value.ticketPrice <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ticketPrice'],
        message:
          'A ticketed event needs a price above zero. If it is free, make it free — a ₹0 ticket still sends every member through the payment step.',
      });
    }

    if (!value.ticketed && value.ticketPrice > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ticketPrice'],
        message: 'This event is marked free but carries a price. Set the price to 0, or mark it ticketed.',
      });
    }
  });

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'event'
  );
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    requireSession(session);

    // Composed rather than nested: two grants legitimately reach this
    // endpoint, and requiring either one of them alone would lock out a
    // role that holds the other. The refusal is expressed as the narrower
    // grant, so a caller holding neither is told the one they might
    // plausibly be given.
    const wide = can(session, 'event.create.any');
    const scoped = can(session, 'event.create.department');
    if (!wide && !scoped) requireCap(session, 'event.create.department');

    const resolved = await getTenantBrand();
    if (!resolved) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');
    if (!resolved.brand.pack.features.events) {
      throw new HttpError(404, 'feature_off', 'Events are not enabled for this college.');
    }

    const body = await readJson(request, Body);

    limit(
      `event-create:${session.memberId}`,
      20,
      60 * 60,
      'Twenty events in an hour is the limit. A programme with more sessions than that is one event with a schedule in it, not twenty listings.',
    );

    let departmentCode = body.departmentCode || undefined;

    if (!wide) {
      const myDepartment = session.roles.find((r) => r.role === 'hod')?.departmentId ?? session.departmentId;

      if (!myDepartment) {
        throw new AuthzError(
          403,
          'no_department_scope',
          'Your grant creates events for one branch, and no branch is recorded against your account. Ask the college admin to set your department before creating an event.',
        );
      }

      // An explicitly foreign branch is refused rather than quietly
      // rewritten: somebody who typed ECE needs to know they cannot have
      // it, not to find a CSE event they did not ask for.
      if (departmentCode && departmentCode !== myDepartment) {
        throw new AuthzError(
          403,
          'outside_department_scope',
          `Your grant is event.create.department for ${myDepartment}. It does not reach ${departmentCode}, and it does not reach a college-wide event — that is event.create.any, which the alumni cell and the college admin hold.`,
        );
      }

      // Clamped, not defaulted. An omitted branch would otherwise be a
      // college-wide event created by a department-scoped account.
      departmentCode = myDepartment;

      // Belt and braces: the grant is re-checked against the branch the
      // event will actually carry, through the same helper every other
      // department-scoped decision uses.
      if (!canInDepartment(session, 'event.create.department', departmentCode)) {
        throw new AuthzError(
          403,
          'outside_department_scope',
          `Your event.create.department grant does not cover ${departmentCode}.`,
        );
      }
    }

    if (departmentCode && !getDepartments().some((d) => d.code === departmentCode)) {
      throw new HttpError(422, 'invalid_input', 'That branch does not exist on this tenant.', {
        fieldErrors: {
          departmentCode: 'Pick a branch from the list, or leave it blank for a college-wide event.',
        },
      });
    }

    const slug = body.slug ?? slugify(body.title);

    // Drafts included where the viewer can see them. A published event and
    // an unpublished one cannot share an address: the draft goes live
    // later and the collision surfaces with links already in circulation.
    // A department-scoped organiser cannot see the alumni cell's drafts,
    // so this catches what it can rather than everything — the database
    // unique index is the real guarantee once the write path is wired.
    const existing = getEvents(session, { when: 'all', includeDrafts: true }).find((e) => e.slug === slug);
    if (existing) {
      throw new HttpError(
        409,
        'slug_taken',
        `“${existing.title}” already uses the address /events/${slug}. Add the year, or the branch, to tell them apart.`,
        { slug, fieldErrors: { slug: 'Choose a different address.' } },
      );
    }

    const after = {
      id: draftId('evt'),
      slug,
      title: body.title,
      description: body.description ?? null,
      venue: body.venue,
      startsAt: new Date(body.startsAt).toISOString(),
      endsAt: body.endsAt ? new Date(body.endsAt).toISOString() : null,
      departmentCode: departmentCode ?? null,
      // An alumni-only event is not merely hidden from students in the
      // list — it is not addressable by them anywhere in the portal.
      alumniOnly: body.audience === 'alumni_only',
      studentEligible: body.audience === 'both',
      capacity: body.capacity ?? null,
      ticketPrice: body.ticketed ? body.ticketPrice : 0,
      published: body.publish,
      registeredCount: 0,
    };

    await logAudit({
      tenantId: resolved.tenant.id,
      session,
      action: body.publish ? 'event.publish' : 'event.create',
      resource: 'events',
      resourceId: after.id,
      reason: null,
      // A create has no before. Recorded as null rather than omitted, so
      // the entry reads the same shape as an edit does.
      before: null,
      after: { ...after, scopedBy: wide ? 'event.create.any' : 'event.create.department' },
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();

    return json(
      {
        ok: true,
        ...write,
        event: after,
        href: `/events/${slug}`,
        scope: {
          departmentCode: after.departmentCode,
          clamped: !wide,
          grant: wide ? 'event.create.any' : 'event.create.department',
        },
        note: body.publish
          ? `Published. ${after.alumniOnly ? 'Alumni' : 'Alumni and final-year students'} can register from now, ${after.capacity ? `up to ${after.capacity.toLocaleString('en-IN')} seats` : 'with no seat limit'}.`
          : 'Saved as a draft. Members cannot see it and nobody can register until you publish it.',
      },
      { status: 201 },
    );
  } catch (err) {
    return fail(err);
  }
}
