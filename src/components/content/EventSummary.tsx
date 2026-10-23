import * as React from 'react';
import Link from 'next/link';
import { Clock, MapPin, Video } from 'lucide-react';
import { Badge, DateTile, MediaFrame } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatCurrency, formatDateRange, formatTimeZoneLabel } from '@/lib/format';
import { isOnlineVenue, seatStatus } from '@/lib/event-status';
import { eventKindLabel } from '@/lib/community';
import type { LocaleSpec } from '@/lib/branding/pack';
import type { EventItem } from '@/lib/data/types';

/**
 * One event, the same way everywhere: the home page, the events hub, and
 * the staff console's previews. Isomorphic — no hooks, no server imports —
 * so a client-side form can preview exactly what members will see.
 *
 * The card never decides what a viewer may do: the page passes `status`
 * (a "Registered" badge, a `SeatBadge`) and `action` (Register, Show
 * ticket, Manage). It never shows seat numbers on its own; only a page
 * that passes a `SeatBadge` does, and the public pages never do.
 */

export type EventSummaryData = Pick<
  EventItem,
  | 'slug'
  | 'title'
  | 'venue'
  | 'startsAt'
  | 'endsAt'
  | 'departmentCode'
  | 'alumniOnly'
  | 'ticketPrice'
  | 'coverImage'
  | 'capacity'
  | 'registeredCount'
> &
  // Optional so a preview or a public row that carries neither still draws.
  Partial<Pick<EventItem, 'kind' | 'mode'>>;

/** Held online, from what the event says, else from the venue as it always was. */
function heldOnline(event: Pick<EventItem, 'venue'> & Partial<Pick<EventItem, 'mode'>>): boolean {
  return event.mode ? event.mode === 'online' : isOnlineVenue(event.venue);
}

function fmtOf(locale: LocaleSpec) {
  return { locale: locale.locale, currency: locale.currency, timeZone: locale.timeZone };
}

/** "24 Sept 2026, 9:30 am – 7:00 pm · Main Auditorium", or "· Online". */
export function eventMetaLine(event: Pick<EventItem, 'startsAt' | 'endsAt' | 'venue'>, locale: LocaleSpec): string {
  const where = isOnlineVenue(event.venue) ? 'Online' : (event.venue ?? 'Venue to be announced');
  return `${formatDateRange(event.startsAt, event.endsAt, fmtOf(locale))} · ${where}`;
}

/**
 * The date as a calendar leaf: a brand-tinted month cap over a large day
 * numeral. It is what the eye lands on first in a list of events, so it
 * carries the date's weight and the title can be quieter. Decorative; the
 * line beside it states the date in words.
 */
export function EventDateBlock({
  iso,
  locale,
  timeZone,
  size = 'md',
  className,
}: {
  iso: string;
  locale: string;
  timeZone: string;
  size?: 'md' | 'lg';
  className?: string;
}) {
  const d = new Date(iso);
  const part = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...opts, timeZone }).format(d);
  const lg = size === 'lg';
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block shrink-0 self-start overflow-hidden rounded-lg border border-line bg-surface text-center shadow-sm',
        lg ? 'w-[4.5rem]' : 'w-14',
        className,
      )}
    >
      <span className="block bg-brand-soft py-0.5 text-xs font-semibold uppercase tracking-wider text-brand-soft-fg">
        {part({ month: 'short' })}
      </span>
      <span className={cn('block font-display font-bold leading-none tabular', lg ? 'pt-2 text-3xl' : 'pt-1.5 text-2xl')}>
        {part({ day: 'numeric' })}
      </span>
      <span className="block pb-1.5 pt-1 text-xs text-secondary">{part({ weekday: 'short' })}</span>
    </span>
  );
}

/**
 * The line beside the date block. A same-day event needs only its hours
 * (the block already says which day); one that runs over a night needs
 * both ends, so it keeps the full range.
 */
function whenText(event: EventSummaryData, locale: LocaleSpec): string {
  const tz = { timeZone: locale.timeZone };
  const day = (iso: string) => new Intl.DateTimeFormat('en-CA', tz).format(new Date(iso));
  const time = (iso: string) =>
    new Intl.DateTimeFormat(locale.locale, { hour: 'numeric', minute: '2-digit', ...tz }).format(new Date(iso));
  if (!event.endsAt || day(event.endsAt) !== day(event.startsAt)) {
    return formatDateRange(event.startsAt, event.endsAt, fmtOf(locale));
  }
  return `${time(event.startsAt)} – ${time(event.endsAt)} ${formatTimeZoneLabel(locale.timeZone, locale.locale)}`;
}

function EventFacts({ event, locale }: { event: EventSummaryData; locale: LocaleSpec }) {
  const online = heldOnline(event);
  const Where = online || event.mode === 'hybrid' ? Video : MapPin;
  return (
    <dl className="space-y-1 text-sm text-secondary">
      <div className="flex items-start gap-2">
        <dt className="mt-0.5 shrink-0 text-muted">
          <Clock className="size-3.5" aria-hidden="true" />
          <span className="sr-only">When</span>
        </dt>
        <dd className="min-w-0 tabular">{whenText(event, locale)}</dd>
      </div>
      <div className="flex items-start gap-2">
        <dt className="mt-0.5 shrink-0 text-muted">
          <Where className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Where</span>
        </dt>
        <dd className="min-w-0 line-clamp-1">
          {online ? 'Online' : (event.venue ?? 'Venue to be announced')}
          {event.mode === 'hybrid' ? ' · also online' : ''}
        </dd>
      </div>
    </dl>
  );
}

function EventBadges({ event, locale }: { event: EventSummaryData; locale: LocaleSpec }) {
  return (
    <>
      {event.kind && event.kind !== 'other' ? <Badge tone="outline">{eventKindLabel(event.kind)}</Badge> : null}
      {event.alumniOnly ? <Badge tone="accent">Alumni only</Badge> : null}
      {event.ticketPrice > 0 ? (
        <Badge tone="neutral">{formatCurrency(event.ticketPrice, fmtOf(locale))}</Badge>
      ) : (
        <Badge tone="success">Free</Badge>
      )}
      {event.departmentCode ? <Badge tone="brand">{event.departmentCode}</Badge> : null}
    </>
  );
}

export function EventSummary({
  event,
  href,
  locale,
  variant = 'card',
  status,
  action,
  showThumbnail = false,
  className,
}: {
  event: EventSummaryData;
  href: string;
  locale: LocaleSpec;
  variant?: 'card' | 'row' | 'compact';
  /** A status chip: "Registered", or a `SeatBadge`. */
  status?: React.ReactNode;
  /** The page's call to action. Full width below `sm` on a card. */
  action?: React.ReactNode;
  /** Card only: the event's own cover photo above the text, when it has one. Never a campus photo. */
  showThumbnail?: boolean;
  className?: string;
}) {
  const title = (
    <Link href={href} className="link-quiet after:absolute after:inset-0 after:rounded-lg">
      {event.title}
    </Link>
  );

  if (variant === 'compact') {
    return (
      <article className={cn('relative flex min-h-11 items-center gap-3', className)}>
        <DateTile iso={event.startsAt} locale={locale.locale} timeZone={locale.timeZone} size="sm" />
        <h3 className="line-clamp-2 min-w-0 text-sm font-semibold leading-snug">{title}</h3>
      </article>
    );
  }

  if (variant === 'row') {
    return (
      <article className={cn('relative flex items-start gap-3 py-3', className)}>
        <EventDateBlock iso={event.startsAt} locale={locale.locale} timeZone={locale.timeZone} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <h3 className="line-clamp-2 font-display text-md font-semibold leading-snug">{title}</h3>
          <EventFacts event={event} locale={locale} />
          <div className="flex flex-wrap items-center gap-1.5">
            <EventBadges event={event} locale={locale} />
            {status}
          </div>
        </div>
        {action ? <div className="relative z-10 shrink-0 self-center">{action}</div> : null}
      </article>
    );
  }

  return (
    <article
      className={cn(
        'lift relative flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface-raised shadow-sm',
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-[var(--surface)]',
        className,
      )}
    >
      {showThumbnail && event.coverImage ? (
        <MediaFrame src={event.coverImage} alt="" aspect="16/9" rounded={false} className="[&>div]:border-0 [&>div]:border-b" />
      ) : null}
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start gap-4">
          <EventDateBlock iso={event.startsAt} locale={locale.locale} timeZone={locale.timeZone} size="lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <h3 className="line-clamp-3 font-display text-lg font-semibold leading-snug">{title}</h3>
            <EventFacts event={event} locale={locale} />
          </div>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-1.5">
          <EventBadges event={event} locale={locale} />
          {status}
        </div>
      </div>
      {action ? (
        <div className="relative z-10 border-t border-line px-5 py-3.5 [&>*]:w-full sm:[&>*]:w-auto">{action}</div>
      ) : null}
    </article>
  );
}

/**
 * Seats, when there is something worth saying.
 *
 *  - Member view: "Full" or "Only 6 left" (warning); otherwise a quiet
 *    "341 going", or nothing when two or fewer are going.
 *  - Organiser view: "Full · 40 of 40" (success — a full room is the
 *    goal), "Almost full" at 90% (accent), otherwise "118 of 120".
 *  - An event with no capacity: nothing.
 */
export function SeatBadge({
  event,
  audience,
}: {
  event: Pick<EventItem, 'capacity' | 'registeredCount'>;
  audience: 'member' | 'organiser';
}) {
  const s = seatStatus(event);
  if (!s.capped) return null;
  const n = (v: number) => v.toLocaleString('en-IN');

  if (audience === 'organiser') {
    if (s.full) return <Badge tone="success">Full · {n(s.registered)} of {n(s.capacity!)}</Badge>;
    if (s.ratio >= 0.9) return <Badge tone="accent">Almost full</Badge>;
    return <Badge tone="neutral">{n(s.registered)} of {n(s.capacity!)}</Badge>;
  }

  if (s.full) return <Badge tone="warning">Full</Badge>;
  if (s.left !== null && s.left <= 10) return <Badge tone="warning">Only {n(s.left)} left</Badge>;
  if (s.registered <= 2) return null;
  return <Badge tone="outline">{n(s.registered)} going</Badge>;
}
