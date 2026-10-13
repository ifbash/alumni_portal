import * as React from 'react';
import Link from 'next/link';
import { Badge, DateTile, MediaFrame } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatCurrency, formatDateRange } from '@/lib/format';
import { isOnlineVenue, seatStatus } from '@/lib/event-status';
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
>;

function fmtOf(locale: LocaleSpec) {
  return { locale: locale.locale, currency: locale.currency, timeZone: locale.timeZone };
}

/** "24 Sept 2026, 9:30 am – 7:00 pm · Main Auditorium", or "· Online". */
export function eventMetaLine(event: Pick<EventItem, 'startsAt' | 'endsAt' | 'venue'>, locale: LocaleSpec): string {
  const where = isOnlineVenue(event.venue) ? 'Online' : (event.venue ?? 'Venue to be announced');
  return `${formatDateRange(event.startsAt, event.endsAt, fmtOf(locale))} · ${where}`;
}

function EventBadges({ event, locale }: { event: EventSummaryData; locale: LocaleSpec }) {
  return (
    <>
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
        <DateTile iso={event.startsAt} locale={locale.locale} timeZone={locale.timeZone} size="md" />
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="line-clamp-2 font-semibold leading-snug">{title}</h3>
          <p className="truncate text-sm text-secondary">{eventMetaLine(event, locale)}</p>
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
        'relative flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface-raised shadow-sm',
        'transition-colors duration-fast ease-brand hover:border-line-strong',
        className,
      )}
    >
      {showThumbnail && event.coverImage ? (
        <MediaFrame src={event.coverImage} alt="" aspect="16/9" rounded={false} className="[&>div]:border-0 [&>div]:border-b" />
      ) : null}
      <div className="flex flex-1 gap-3 p-4">
        <DateTile iso={event.startsAt} locale={locale.locale} timeZone={locale.timeZone} size="md" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <h3 className="line-clamp-2 font-semibold leading-snug">{title}</h3>
          <p className="line-clamp-2 text-sm text-secondary">{eventMetaLine(event, locale)}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <EventBadges event={event} locale={locale} />
            {status}
          </div>
        </div>
      </div>
      {action ? (
        <div className="relative z-10 px-4 pb-4 [&>*]:w-full sm:[&>*]:w-auto">{action}</div>
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
