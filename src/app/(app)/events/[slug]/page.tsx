import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';
import {
  Building2,
  CalendarDays,
  CircleCheck,
  Clock,
  GraduationCap,
  History,
  Lock,
  MapPin,
  ShieldCheck,
  Ticket,
  Users,
  Video,
} from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { require as requireCap, can } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDepartments, getEventBySlug, getEvents } from '@/lib/data/repo';
import {
  Alert,
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardTitle,
  DetailRow,
  PageHeader,
  Progress,
  Section,
} from '@/components/ui';
import { formatCurrency, formatDate, formatDateRange, formatNumber, formatRelative } from '@/lib/format';
import type { EventItem } from '@/lib/data/types';
import { RegisterForm, type GuestOption } from './RegisterForm';

/**
 * One event.
 *
 * Eligibility is decided by `getEventBySlug()` — an alumni-only event is
 * not addressable by a student and an unpublished draft needs
 * `event.create.any`, both enforced in the repo. When it returns null this
 * page 404s rather than explaining which rule caught you; the not-found
 * screen lists the possibilities without confirming any of them.
 */

const MAX_GUESTS = 3;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const session = await getSession();
  const event = session ? getEventBySlug(session, slug) : null;

  if (!event) return { title: 'Event not found' };

  return {
    title: event.title,
    description: event.description?.slice(0, 180) ?? undefined,
  };
}

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const pack = resolved.brand.pack;
  if (!pack.features.events) notFound();

  const canRegister = can(session, 'event.register');
  const canManage = can(session, 'event.create.any');
  if (!canRegister && !canManage) requireCap(session, 'event.register');

  const { slug } = await params;
  const event = getEventBySlug(session, slug);
  if (!event) notFound();

  // Upcoming vs past comes from the repo's own clock, not a second one
  // invented here — otherwise the list and the detail page can disagree.
  const isPast = getEvents(session, { when: 'past', includeDrafts: canManage }).some(
    (e) => e.id === event.id,
  );

  const locale = pack.locale.locale;
  const timeZone = pack.locale.timeZone;
  const currency = pack.locale.currency;
  const money = (n: number) => formatCurrency(n, { locale, currency });

  const department = event.departmentCode
    ? getDepartments().find((d) => d.code === event.departmentCode)
    : null;

  const seats = seatState(event);
  const online = Boolean(event.venue && /online|zoom|meet|webinar|link/i.test(event.venue));
  const paragraphs = (event.description ?? '').split(/\n{2,}/).filter(Boolean);

  const guestOptions: GuestOption[] = Array.from({ length: MAX_GUESTS + 1 }, (_, g) => ({
    value: g,
    label: g === 0 ? 'Just me' : `${g} guest${g === 1 ? '' : 's'}`,
    totalLabel: event.ticketPrice > 0 ? money(event.ticketPrice * (1 + g)) : null,
  }));

  const registration = event.viewerRegistration
    ? {
        guests: event.viewerRegistration.guests,
        checkedIn: event.viewerRegistration.checkedIn,
        amountLabel:
          event.ticketPrice > 0
            ? money(event.ticketPrice * (1 + event.viewerRegistration.guests))
            : 'Free',
      }
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs items={[{ label: 'Events', href: '/events' }, { label: event.title }]} />
        }
        eyebrow={department ? department.name : 'Open to every branch'}
        title={event.title}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5 text-muted" aria-hidden="true" />
              {formatDateRange(event.startsAt, event.endsAt, { locale, timeZone })}
            </span>
            {event.venue ? (
              <span className="inline-flex items-center gap-1.5">
                {online ? (
                  <Video className="size-3.5 text-muted" aria-hidden="true" />
                ) : (
                  <MapPin className="size-3.5 text-muted" aria-hidden="true" />
                )}
                {event.venue}
              </span>
            ) : null}
          </span>
        }
        actions={
          canManage ? (
            <ButtonLink href="/admin/events" variant="secondary" size="sm">
              Manage in admin
            </ButtonLink>
          ) : null
        }
      />

      {!event.published ? (
        <Alert tone="warning" title="Draft — no member can see this yet" icon={<Lock className="size-4" />}>
          <p>
            You are looking at it because you hold event.create.any. Nothing is registrable and no
            one has been told it exists. Publish it from the admin console when the date and venue
            are fixed.
          </p>
        </Alert>
      ) : null}

      {isPast ? (
        <Alert tone="neutral" title="This event has already taken place" icon={<History className="size-4" />}>
          <p>
            Held {formatRelative(event.startsAt, { locale })} —{' '}
            {formatDate(event.startsAt, { locale, timeZone })}.{' '}
            {formatNumber(event.registeredCount, { locale })} people registered.
            {event.viewerRegistration?.checkedIn
              ? ' You were checked in at the gate.'
              : event.viewerRegistration
                ? ' Your registration is on record, though no check-in was scanned for you.'
                : ''}
          </p>
        </Alert>
      ) : null}

      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <Section title="About this event">
            {paragraphs.length ? (
              <div className="max-w-prose space-y-3 text-md leading-relaxed text-secondary">
                {paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">
                The organisers have not written a description yet. The date, venue and ticket on the
                right are confirmed.
              </p>
            )}
          </Section>

          <Section title="Who can attend">
            <Card>
              <CardBody>
                <ul className="space-y-3 text-sm">
                  <Eligibility
                    icon={<GraduationCap className="size-4" />}
                    title={
                      event.alumniOnly
                        ? 'Alumni only'
                        : event.studentEligible
                          ? 'Alumni and final-year students'
                          : 'Alumni and faculty'
                    }
                    body={
                      event.alumniOnly
                        ? 'A batch event. Final-year students do not see it in their portal at all — it is not hidden from them so much as not addressed to them.'
                        : event.studentEligible
                          ? 'Students in their final year can register alongside alumni. Most of the value of a session like this is the questions they ask.'
                          : 'Not open to the student cohort. Registration is limited to alumni and faculty.'
                    }
                  />

                  <Eligibility
                    icon={<Building2 className="size-4" />}
                    title={department ? `Organised by ${department.name}` : 'Open to every branch'}
                    body={
                      department
                        ? `Run by the ${department.code} department. Alumni and students from other branches are welcome unless the seat count says otherwise.`
                        : 'Not tied to a single branch — everyone from every department is invited.'
                    }
                  />

                  <Eligibility
                    icon={<Ticket className="size-4" />}
                    title={event.ticketPrice > 0 ? `${money(event.ticketPrice)} per person` : 'Free to attend'}
                    body={
                      event.ticketPrice > 0
                        ? 'Guests are charged the same as you. The ticket covers the venue and catering; the alumni cell publishes the account after the event.'
                        : 'No ticket. Register anyway — the desk works from the list, and the count decides how many chairs are put out.'
                    }
                  />

                  <Eligibility
                    icon={<ShieldCheck className="size-4" />}
                    title="Verified members only"
                    body="Registration is tied to your verified record against the college's degree register. That is what keeps a public reunion from turning into an open guest list."
                  />
                </ul>
              </CardBody>
            </Card>
          </Section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardBody className="space-y-1">
              <CardTitle as="h2" className="text-md">
                When and where
              </CardTitle>
              <dl className="divide-y divide-line">
                <DetailRow label="Date">
                  {formatDateRange(event.startsAt, event.endsAt, { locale, timeZone })}
                </DetailRow>
                <DetailRow label={online ? 'Joining' : 'Venue'}>
                  {event.venue ?? 'To be announced'}
                </DetailRow>
                <DetailRow label="Format">{online ? 'Online' : 'In person, on campus or at the listed venue'}</DetailRow>
                <DetailRow label="Ticket">
                  {event.ticketPrice > 0 ? (
                    <span className="tabular">{money(event.ticketPrice)}</span>
                  ) : (
                    <Badge tone="success">Free</Badge>
                  )}
                </DetailRow>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-2.5">
              <CardTitle as="h2" className="text-md">
                Seats
              </CardTitle>

              <p className={seats.full ? 'text-sm font-semibold text-warning-fg' : 'text-sm font-semibold'}>
                {seats.headline}
              </p>

              {seats.max !== null ? (
                <Progress
                  value={seats.taken}
                  max={seats.max}
                  tone={seats.tone}
                  label={`${seats.taken} of ${seats.max} seats taken`}
                />
              ) : null}

              <p className="flex items-start gap-2 text-xs text-muted">
                <Users className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>{seats.detail}</span>
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <CardTitle as="h2" className="text-md">
                {isPast ? 'Your record' : registration ? 'Your registration' : 'Register'}
              </CardTitle>

              {isPast ? (
                <PastRecord event={event} locale={locale} timeZone={timeZone} />
              ) : !event.published ? (
                <p className="text-sm text-secondary">
                  Registration opens when this draft is published. Nothing on this page is live for
                  members yet.
                </p>
              ) : !canRegister ? (
                <div className="space-y-2 text-sm text-secondary">
                  <p>
                    You are here as an organiser. Registration is a member action — your roles carry
                    event.create.any and event.checkin, not event.register.
                  </p>
                  <ButtonLink href="/admin/events" variant="secondary" size="sm">
                    Open the attendee list
                  </ButtonLink>
                </div>
              ) : (
                <RegisterForm
                  eventTitle={event.title}
                  mode={registration ? 'registered' : seats.full ? 'waitlist' : 'register'}
                  isPaid={event.ticketPrice > 0}
                  priceLabel={event.ticketPrice > 0 ? money(event.ticketPrice) : 'Free'}
                  guestOptions={guestOptions}
                  registration={registration}
                  seatsLeft={seats.max === null ? null : Math.max(0, seats.max - seats.taken)}
                  supportEmail={pack.copy.supportEmail ?? null}
                />
              )}
            </CardBody>
          </Card>

          <p className="flex items-start gap-2 px-1 text-xs text-muted">
            <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              All times are {timeZone.replace('_', ' ')}. Registration lists are visible to the
              alumni cell and to the department organising the event, and to nobody else.
            </span>
          </p>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------

function Eligibility({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-muted" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium">{title}</p>
        <p className="text-secondary">{body}</p>
      </div>
    </li>
  );
}

function PastRecord({
  event,
  locale,
  timeZone,
}: {
  event: EventItem;
  locale: string;
  timeZone: string;
}) {
  if (!event.viewerRegistration) {
    return (
      <div className="space-y-2 text-sm text-secondary">
        <p>
          You were not registered for this one. It ran on{' '}
          {formatDate(event.startsAt, { locale, timeZone })} with{' '}
          {formatNumber(event.registeredCount, { locale })} people on the list.
        </p>
        <ButtonLink href="/events?when=upcoming" variant="secondary" size="sm">
          What is coming up
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <CircleCheck className="size-4 text-success-fg" aria-hidden="true" />
        {event.viewerRegistration.checkedIn ? 'You attended' : 'You registered'}
      </p>
      <p className="text-secondary">
        {event.viewerRegistration.guests > 0
          ? `You brought ${event.viewerRegistration.guests} guest${event.viewerRegistration.guests === 1 ? '' : 's'}. `
          : ''}
        {event.viewerRegistration.checkedIn
          ? 'Your check-in was scanned at the desk.'
          : 'No check-in was scanned against your name — if you did attend, tell the alumni cell so the record matches.'}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------
// Seats
// ---------------------------------------------------------------

function seatState(event: EventItem) {
  const taken = event.registeredCount;
  const max = event.capacity;

  if (max === null) {
    return {
      taken,
      max: null as number | null,
      full: false,
      tone: 'brand' as const,
      headline: `${taken} registered`,
      detail: 'No seat limit on this one. Register anyway so the organisers know the numbers.',
    };
  }

  const left = Math.max(0, max - taken);

  if (left === 0) {
    return {
      taken,
      max,
      full: true,
      tone: 'warning' as const,
      headline: 'Full — join the waiting list',
      detail: `All ${max} seats are taken. Cancellations are offered down the waiting list in the order people joined, so joining early is worth it.`,
    };
  }

  if (left <= Math.max(3, Math.round(max * 0.05))) {
    return {
      taken,
      max,
      full: false,
      tone: 'warning' as const,
      headline: `Only ${left} ${left === 1 ? 'seat' : 'seats'} left`,
      detail: `${taken} of ${max} seats are gone. Guests count against the same limit.`,
    };
  }

  return {
    taken,
    max,
    full: false,
    tone: 'brand' as const,
    headline: `${taken} of ${max} registered`,
    detail: `${left} seats still open. Guests count against the same limit.`,
  };
}
