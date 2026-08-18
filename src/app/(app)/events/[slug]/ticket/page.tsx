import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  CalendarDays,
  CircleCheck,
  Clock,
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
import { getEventBySlug, getEventRegistrations, getEvents } from '@/lib/data/repo';
import {
  Alert,
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  DetailRow,
  EmptyState,
  PageHeader,
} from '@/components/ui';
import {
  formatCurrency,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatRelative,
} from '@/lib/format';
import { TicketCode } from './TicketCode';

/**
 * The viewer's own registration.
 *
 * Eligibility is decided upstream by `getEventBySlug()` — an alumni-only
 * event is not addressable by a student and an unpublished draft needs
 * `event.create.any` — so a 404 here is the same authorisation outcome as
 * on the event page itself.
 *
 * Not being registered is *not* one of those outcomes. Somebody who taps
 * a ticket link on WhatsApp before they have signed up has made an
 * ordinary mistake, and the answer to it is the registration form, not a
 * dead end.
 */

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
    title: `Your ticket · ${event.title}`,
    description: `Check-in code and registration details for ${event.title}.`,
  };
}

export default async function EventTicketPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
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

  const locale = pack.locale.locale;
  const timeZone = pack.locale.timeZone;
  const currency = pack.locale.currency;
  const timing = { locale, timeZone };
  const money = (n: number) => formatCurrency(n, { locale, currency });

  // Past-or-upcoming comes from the repo's own clock rather than a second
  // one invented here, so this page and the event page cannot disagree
  // about whether the reunion has already happened.
  const isPast = getEvents(session, { when: 'past', includeDrafts: canManage }).some(
    (e) => e.id === event.id,
  );

  // The viewer's own row and nothing else. `getEventRegistrations` returns
  // the whole roster — the filter to `session.memberId` is what makes this
  // a ticket rather than an attendee list.
  const registration =
    getEventRegistrations(event.id).find((r) => r.memberId === session.memberId) ?? null;

  const online = Boolean(event.venue && /online|zoom|meet|webinar|link/i.test(event.venue));
  const amountLabel = registration
    ? registration.amountPaid > 0
      ? money(registration.amountPaid * (1 + registration.guests))
      : 'Free'
    : 'Free';

  const heading = (
    <PageHeader
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: 'Events', href: '/events' },
            { label: event.title, href: `/events/${event.slug}` },
            { label: 'Your ticket' },
          ]}
        />
      }
      eyebrow={event.title}
      title="Your ticket"
      description={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5 text-muted" aria-hidden="true" />
            {formatDateRange(event.startsAt, event.endsAt, timing)}
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
        registration ? (
          <Badge tone={registration.checkedInAt ? 'success' : isPast ? 'neutral' : 'brand'} dot>
            {registration.checkedInAt ? 'Checked in' : isPast ? 'On the list' : 'Registered'}
          </Badge>
        ) : null
      }
    />
  );

  // ---------------------------------------------------------------
  // No registration — an ordinary mistake, not a refusal
  // ---------------------------------------------------------------

  if (!registration) {
    return (
      <div className="space-y-6">
        {heading}

        <EmptyState
          icon={<Ticket className="size-5" />}
          title="You do not have a ticket for this one"
          description={
            isPast
              ? `${event.title} has already been held, and there is no registration on file against your name.`
              : `Nothing is held for you at the desk for ${event.title}. Registering takes one tap and puts you on the check-in list.`
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href={`/events/${event.slug}`}>
                {isPast ? 'Open the event' : 'Open the event and register'}
              </ButtonLink>
              <ButtonLink href="/events?when=upcoming" variant="secondary">
                What is coming up
              </ButtonLink>
            </div>
          }
        />

        <Card className="mx-auto max-w-prose">
          <CardBody className="space-y-3 text-sm text-secondary">
            <p>
              {canRegister
                ? 'A ticket appears here the moment you register. It carries a check-in code the alumni cell scans or types at the desk — there is no printed pass and nothing arrives by post.'
                : 'You are here as an organiser. Registration is a member action — your roles carry event.create.any and event.checkin, not event.register, so there is no ticket to issue against your name.'}
            </p>
            {canManage ? (
              <p>
                The full roster, with check-in, is in{' '}
                <Link href="/admin/events" className="link">
                  the events console
                </Link>
                .
              </p>
            ) : (
              <p>
                If someone registered on your behalf, they will have used their own account — the
                ticket sits with them, and the desk needs whoever holds the code.
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // The ticket
  // ---------------------------------------------------------------

  const attended = Boolean(registration.checkedInAt);

  return (
    <div className="space-y-6">
      {heading}

      {isPast ? (
        <Alert
          tone={attended ? 'success' : 'neutral'}
          title={attended ? 'You attended' : 'You were on the list, but no check-in was scanned'}
          icon={attended ? <CircleCheck className="size-4" /> : <History className="size-4" />}
        >
          <p>
            {event.title} was held {formatRelative(event.startsAt, timing)} —{' '}
            {formatDate(event.startsAt, timing)}.{' '}
            {attended
              ? `Your check-in was recorded at the desk on ${formatDateTime(registration.checkedInAt, timing)}, and it counts towards the turnout the alumni cell reports for this event.`
              : 'If you did attend, tell the alumni cell so the record matches — attendance is what the department quotes when it asks for the next event to be funded.'}
          </p>
        </Alert>
      ) : null}

      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h2">
                {isPast ? 'This ticket has been used' : 'Show this at the desk'}
              </CardTitle>
              <CardDescription>
                {isPast
                  ? 'The code stopped working when the event closed. It is kept here so your record of the day is complete.'
                  : 'One code, one registration. It is tied to your account, so it identifies you whether it is scanned or typed.'}
              </CardDescription>
            </CardHeader>

            <CardBody className="pt-4">
              {isPast ? (
                <div className="space-y-4">
                  <div className="flex flex-col items-start gap-3 rounded-lg border border-line bg-surface-sunken p-card">
                    <Badge tone={attended ? 'success' : 'neutral'} dot>
                      {attended ? 'Checked in at the desk' : 'No check-in recorded'}
                    </Badge>
                    <p className="text-sm text-secondary">
                      {attended
                        ? `Marked present on ${formatDateTime(registration.checkedInAt, timing)}${
                            registration.guests > 0
                              ? `, with ${registration.guests} guest${registration.guests === 1 ? '' : 's'} counted alongside you`
                              : ''
                          }.`
                        : 'Your registration is on file. Nobody scanned or typed your code on the day, which usually means you did not make it — or that the queue at the door moved faster than the desk did.'}
                    </p>
                  </div>

                  <p className="text-xs text-muted">
                    Attendance is never removed from a past event by this screen. If it is wrong,
                    the alumni cell corrects it against the check-in list, and the correction is
                    recorded.
                  </p>
                </div>
              ) : (
                <TicketCode
                  registrationId={registration.id}
                  eventTitle={event.title}
                  holderName={registration.memberName}
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h2">Your registration</CardTitle>
              <CardDescription>
                Exactly what the desk sees against your name, and nothing that belongs to anyone
                else on the list.
              </CardDescription>
            </CardHeader>
            <CardBody className="pt-2">
              <dl className="divide-y divide-line">
                <DetailRow label="Event">{event.title}</DetailRow>
                <DetailRow label="When">
                  {formatDateRange(event.startsAt, event.endsAt, timing)}
                </DetailRow>
                <DetailRow label={online ? 'Joining' : 'Where'}>
                  {event.venue ?? <span className="font-normal text-muted">To be announced</span>}
                </DetailRow>
                <DetailRow label="In your name">{registration.memberName}</DetailRow>
                <DetailRow label="Guests">
                  {registration.guests > 0 ? (
                    <span className="tabular">
                      {registration.guests}
                      <span className="ml-2 font-normal text-secondary">
                        counted with you at the gate
                      </span>
                    </span>
                  ) : (
                    <span className="font-normal text-muted">Just you</span>
                  )}
                </DetailRow>
                <DetailRow label="Amount paid">
                  {registration.amountPaid > 0 ? (
                    <span className="space-y-0.5">
                      <span className="block tabular">{amountLabel}</span>
                      {registration.guests > 0 ? (
                        <span className="block text-xs font-normal text-secondary">
                          {money(registration.amountPaid)} a head, {registration.guests + 1} people
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <Badge tone="success">Free — no ticket to pay for</Badge>
                  )}
                </DetailRow>
                <DetailRow label="Registered on">
                  {formatDate(registration.createdAt, timing)}{' '}
                  <span className="font-normal text-muted">
                    ({formatRelative(registration.createdAt, timing)})
                  </span>
                </DetailRow>
                <DetailRow label="Reference">
                  <span className="font-mono text-xs text-secondary">{registration.id}</span>
                </DetailRow>
              </dl>
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {!isPast ? (
            <Card>
              <CardHeader className="flex-col items-start gap-1">
                <CardTitle as="h2" className="text-md">
                  At the desk
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-3 pt-4 text-xs text-secondary">
                <p className="flex gap-2">
                  <Users className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
                  <span>
                    Carry a photo ID as well. The code identifies the registration; the ID is what
                    the volunteer checks it against when two people on the roster share a name,
                    which in a branch of 240 happens more often than you would think.
                  </span>
                </p>
                <p className="flex gap-2">
                  <Ticket className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
                  <span>
                    {registration.guests > 0
                      ? `Your ${registration.guests} guest${registration.guests === 1 ? '' : 's'} come in on this one code — they do not need their own. Bringing more than you registered for slows the queue behind you.`
                      : 'You registered for a seat on your own. If someone is coming with you, change the guest count on the event page before the day rather than at the door.'}
                  </span>
                </p>
                <p className="flex gap-2">
                  <Clock className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
                  <span>
                    All times are {timeZone.replace('_', ' ')}. The desk opens before the start time
                    shown above, and the queue is longest in the first twenty minutes.
                  </span>
                </p>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h2" className="text-md">
                Who sees this
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3 pt-4 text-xs text-secondary">
              <p className="flex gap-2">
                <Lock className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
                <span>
                  This page is your own registration. The roster it is drawn from is visible to the
                  alumni cell and to the department organising the event, and to no other member —
                  who else is coming to a reunion is not public information.
                </span>
              </p>
              <p className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
                <span>
                  The code is derived from your registration reference, not from anything about you.
                  Somebody reading it over your shoulder learns the reference and nothing more — no
                  name, no batch, no contact detail.
                </span>
              </p>
            </CardBody>
          </Card>

          <ButtonLink
            href={`/events/${event.slug}`}
            variant="secondary"
            size="sm"
            className="w-full"
          >
            Back to the event
          </ButtonLink>
        </aside>
      </div>
    </div>
  );
}
