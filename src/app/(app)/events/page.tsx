import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  Armchair,
  CalendarDays,
  CalendarOff,
  CircleCheck,
  History,
  MapPin,
  Ticket,
  Users,
  Video,
} from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { require as requireCap, can } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getEvents } from '@/lib/data/repo';
import {
  Badge,
  ButtonLink,
  Card,
  CardBody,
  EmptyState,
  PageHeader,
  Progress,
  Tabs,
  type TabItem,
} from '@/components/ui';
import { formatCurrency, formatDateRange, formatNumber, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { EventItem } from '@/lib/data/types';

/**
 * Events.
 *
 * The list does not decide who may see what — `getEvents()` already
 * applies the eligibility rules (alumni-only events are not addressable by
 * a student anywhere, and unpublished drafts need `event.create.any`).
 * What this page owes the viewer is the *reason*: a card that says "Alumni
 * only" or "Draft — members cannot see this yet" is the difference between
 * a filtered list and a list that looks broken.
 */

export const metadata: Metadata = { title: 'Events' };

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const pack = resolved.brand.pack;
  if (!pack.features.events) notFound();

  // Members register; the alumni cell and college admins organise. Either
  // is enough to be here, neither is assumed.
  const canRegister = can(session, 'event.register');
  const canManage = can(session, 'event.create.any');
  if (!canRegister && !canManage) requireCap(session, 'event.register');

  const params = await searchParams;
  const requested = Array.isArray(params.when) ? params.when[0] : params.when;
  const when: 'upcoming' | 'past' = requested === 'past' ? 'past' : 'upcoming';

  const upcoming = getEvents(session, { when: 'upcoming', includeDrafts: canManage });
  const past = getEvents(session, { when: 'past', includeDrafts: canManage });
  const list = when === 'past' ? past : upcoming;

  const registeredCount = upcoming.filter((e) => e.viewerRegistration).length;
  const draftCount = upcoming.filter((e) => !e.published).length;

  const tabs: TabItem[] = [
    { label: 'Upcoming', href: '/events?when=upcoming', count: upcoming.length, active: when === 'upcoming' },
    { label: 'Past', href: '/events?when=past', count: past.length, active: when === 'past' },
  ];

  const locale = pack.locale.locale;
  const timeZone = pack.locale.timeZone;
  const currency = pack.locale.currency;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={pack.copy.shortName ? `${pack.copy.shortName} campus and chapter events` : undefined}
        title="Events"
        description={
          when === 'past'
            ? 'What has already happened, kept so a batch can find the reunion they attended and the alumni cell can point at attendance.'
            : 'Reunions, department sessions and online panels. Register here — the alumni cell works from this list at the gate.'
        }
        actions={
          canManage ? (
            <ButtonLink href="/admin/events" variant="secondary">
              Manage events
            </ButtonLink>
          ) : null
        }
      />

      {when === 'upcoming' && (registeredCount > 0 || draftCount > 0) ? (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-secondary">
          {registeredCount > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <CircleCheck className="size-4 text-success-fg" aria-hidden="true" />
              You are registered for {registeredCount} of {upcoming.length}
            </span>
          ) : null}
          {draftCount > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarOff className="size-4 text-warning-fg" aria-hidden="true" />
              {draftCount} draft {draftCount === 1 ? 'event is' : 'events are'} visible only to you
            </span>
          ) : null}
        </p>
      ) : null}

      <Tabs items={tabs} ariaLabel="Event periods" />

      {list.length === 0 ? (
        when === 'past' ? (
          <EmptyState
            icon={<History className="size-5" />}
            title="Nothing in the archive yet"
            description="Past events appear here after they finish, with the final registration count. The first one to land will be whatever is next on the calendar."
            action={
              <ButtonLink href="/events?when=upcoming" variant="secondary">
                See what is coming up
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            icon={<CalendarDays className="size-5" />}
            title="Nothing on the calendar right now"
            description="The alumni cell publishes reunions, department sessions and online panels here. Meanwhile the archive has what the last few months looked like."
            action={
              <ButtonLink href="/events?when=past" variant="secondary">
                Browse past events
              </ButtonLink>
            }
          />
        )
      ) : (
        <ul className="space-y-4">
          {list.map((event) => (
            <li key={event.id}>
              <EventCard
                event={event}
                past={when === 'past'}
                locale={locale}
                timeZone={timeZone}
                currency={currency}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Card
// ---------------------------------------------------------------

function EventCard({
  event,
  past,
  locale,
  timeZone,
  currency,
}: {
  event: EventItem;
  past: boolean;
  locale: string;
  timeZone: string;
  currency: string;
}) {
  const parts = dateParts(event.startsAt, locale, timeZone);
  const seats = seatState(event);
  const online = isOnline(event.venue);

  return (
    <Card as="article" interactive className="relative">
      <CardBody className="flex flex-col gap-4 sm:flex-row">
        <div
          className={cn(
            'flex w-full shrink-0 flex-row items-center gap-3 rounded border border-line',
            'bg-surface-sunken px-3 py-2 sm:w-20 sm:flex-col sm:gap-0 sm:py-3',
          )}
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-fg">
            {parts.month}
          </span>
          <span className="font-display text-xl font-bold tabular leading-none">{parts.day}</span>
          <span className="text-xs text-muted">{parts.weekday}</span>
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={event.departmentCode ? 'brand' : 'outline'}>
              {event.departmentCode ?? 'All branches'}
            </Badge>

            {event.ticketPrice > 0 ? (
              <Badge tone="neutral">
                <Ticket className="size-3" aria-hidden="true" />
                {formatCurrency(event.ticketPrice, { locale, currency })}
              </Badge>
            ) : (
              <Badge tone="success">Free</Badge>
            )}

            {event.alumniOnly ? <Badge tone="accent">Alumni only</Badge> : null}
            {!event.alumniOnly && !event.studentEligible ? (
              <Badge tone="neutral">Not open to students</Badge>
            ) : null}
            {!event.published ? <Badge tone="warning">Draft — not published</Badge> : null}
            {event.viewerRegistration ? (
              <Badge tone="info" dot>
                {past
                  ? event.viewerRegistration.checkedIn
                    ? 'You attended'
                    : 'You registered'
                  : 'You are registered'}
              </Badge>
            ) : null}
          </div>

          <h2 className="font-display text-lg font-semibold leading-snug">
            <Link href={`/events/${event.slug}`} className="link-quiet after:absolute after:inset-0">
              {event.title}
            </Link>
          </h2>

          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
              {formatDateRange(event.startsAt, event.endsAt, { locale, timeZone })}
            </span>
            {event.venue ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                {online ? (
                  <Video className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                ) : (
                  <MapPin className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                )}
                <span className="truncate">{event.venue}</span>
              </span>
            ) : (
              <span className="text-muted">Venue to be announced</span>
            )}
          </p>

          {event.description ? (
            <p className="line-clamp-2 text-sm text-secondary">{event.description}</p>
          ) : null}
        </div>

        <div className="w-full shrink-0 space-y-2 border-t border-line pt-3 sm:w-52 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
          {past ? (
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {formatNumber(event.registeredCount, { locale })} registered
              </p>
              <p className="text-xs text-muted">
                Held {formatRelative(event.startsAt, { locale })}.
                {event.viewerRegistration?.checkedIn
                  ? ' You were checked in at the gate.'
                  : event.viewerRegistration
                    ? ' Your registration is on record; no check-in was scanned.'
                    : ''}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className={cn('text-sm font-medium', seats.emphasis)}>{seats.headline}</p>
              {seats.max !== null ? (
                <Progress
                  value={seats.taken}
                  max={seats.max}
                  tone={seats.tone}
                  label={`${seats.taken} of ${seats.max} seats taken`}
                />
              ) : null}
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <Users className="size-3.5" aria-hidden="true" />
                {seats.detail}
              </p>
            </div>
          )}

          {/* Positioned so it sits above the title link's full-card overlay;
              both go to the same place, so a stray click is never wrong. */}
          <div className="relative pt-1">
            {past ? (
              <ButtonLink href={`/events/${event.slug}`} variant="secondary" size="sm">
                <History className="size-4" aria-hidden="true" />
                Event record
              </ButtonLink>
            ) : event.viewerRegistration ? (
              <ButtonLink href={`/events/${event.slug}`} variant="secondary" size="sm">
                View your registration
              </ButtonLink>
            ) : seats.full ? (
              <ButtonLink href={`/events/${event.slug}`} variant="secondary" size="sm">
                <Armchair className="size-4" aria-hidden="true" />
                Join the waiting list
              </ButtonLink>
            ) : (
              <ButtonLink href={`/events/${event.slug}`} size="sm">
                Register
              </ButtonLink>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function dateParts(iso: string, locale: string, timeZone: string) {
  const d = new Date(iso);
  return {
    day: new Intl.DateTimeFormat(locale, { day: '2-digit', timeZone }).format(d),
    month: new Intl.DateTimeFormat(locale, { month: 'short', timeZone }).format(d),
    weekday: new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone }).format(d),
  };
}

function isOnline(venue: string | null): boolean {
  return Boolean(venue && /online|zoom|meet|webinar|link/i.test(venue));
}

function seatState(event: EventItem) {
  const taken = event.registeredCount;
  const max = event.capacity;

  if (max === null) {
    return {
      taken,
      max: null as number | null,
      full: false,
      tone: 'brand' as const,
      emphasis: '',
      headline: `${taken} registered`,
      detail: 'No seat limit on this one — bring whoever you like.',
    };
  }

  const left = Math.max(0, max - taken);

  if (left === 0) {
    return {
      taken,
      max,
      full: true,
      tone: 'warning' as const,
      emphasis: 'text-warning-fg',
      headline: 'Full — join the waiting list',
      detail: `All ${max} seats are taken. Returned seats go to the waiting list in order.`,
    };
  }

  if (left <= Math.max(3, Math.round(max * 0.05))) {
    return {
      taken,
      max,
      full: false,
      tone: 'warning' as const,
      emphasis: 'text-warning-fg',
      headline: `Only ${left} ${left === 1 ? 'seat' : 'seats'} left`,
      detail: `${taken} of ${max} registered.`,
    };
  }

  return {
    taken,
    max,
    full: false,
    tone: 'brand' as const,
    emphasis: '',
    headline: `${taken} of ${max} registered`,
    detail: `${left} seats still open.`,
  };
}
