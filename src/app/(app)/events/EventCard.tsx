import Link from 'next/link';
import { Images, Ticket } from 'lucide-react';
import { Badge, ButtonLink, MediaFrame } from '@/components/ui';
import { EventSummary, SeatBadge } from '@/components/content';
import { BandChip } from '@/components/brand/PageBand';
import { formatCurrency } from '@/lib/format';
import { seatStatus } from '@/lib/event-status';
import { cn } from '@/lib/cn';
import type { LocaleSpec } from '@/lib/branding/pack';
import type { EventItem } from '@/lib/data/types';

/**
 * One event on the events hub.
 *
 * A thin wrapper around the shared `EventSummary`: the card draws the
 * event the same way everywhere, and this file decides only the two slots
 * that depend on the viewer — the status chip and the one action. Both
 * are worked out from flags the page already holds (`event.register`,
 * `event.create.any`, the viewer's own registration), never from a rule
 * invented here. Eligibility itself stays in the repo.
 */

export interface EventAction {
  label: string;
  href: string;
  primary: boolean;
  icon?: 'ticket' | 'photos';
}

export interface ViewerFlags {
  canRegister: boolean;
  canManage: boolean;
}

/** The one thing a viewer can do with this event from the list. */
export function eventAction(event: EventItem, { canRegister, canManage }: ViewerFlags): EventAction | null {
  const page = `/events/${event.slug}`;
  if (!event.published) return { label: 'Preview', href: page, primary: false };
  if (event.viewerRegistration) {
    return { label: 'Show ticket', href: `${page}/ticket`, primary: false, icon: 'ticket' };
  }
  if (!canRegister) {
    return canManage ? { label: 'Manage', href: `/admin/events/${event.id}`, primary: false } : null;
  }
  if (seatStatus(event).full) return { label: 'Full — ask for a seat', href: `${page}#register`, primary: false };
  return { label: 'Register', href: `${page}#register`, primary: true };
}

function ActionButton({ action, className }: { action: EventAction; className?: string }) {
  return (
    <ButtonLink
      href={action.href}
      variant={action.primary ? 'primary' : 'secondary'}
      className={cn('min-h-11', className)}
    >
      {action.icon === 'ticket' ? <Ticket className="size-4" aria-hidden="true" /> : null}
      {action.icon === 'photos' ? <Images className="size-4" aria-hidden="true" /> : null}
      {action.label}
    </ButtonLink>
  );
}

function statusFor(event: EventItem, { canRegister }: ViewerFlags) {
  if (event.viewerRegistration) return <Badge tone="success">Registered</Badge>;
  if (!event.published) return <Badge tone="neutral">Draft</Badge>;
  return <SeatBadge event={event} audience={canRegister ? 'member' : 'organiser'} />;
}

/**
 * An upcoming event. `card` in the desktop grid; `row` on phones, with the
 * action under it at full width and no description.
 */
export function EventCard({
  event,
  locale,
  flags,
  layout,
}: {
  event: EventItem;
  locale: LocaleSpec;
  flags: ViewerFlags;
  layout: 'card' | 'row';
}) {
  const action = eventAction(event, flags);
  const status = statusFor(event, flags);
  const href = `/events/${event.slug}`;

  if (layout === 'row') {
    return (
      <div className="py-3">
        <EventSummary event={event} href={href} locale={locale} variant="row" status={status} className="py-0" />
        {action ? (
          <div className="relative z-10 mt-3">
            <ActionButton action={action} className="w-full" />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <EventSummary
      event={event}
      href={href}
      locale={locale}
      variant="card"
      showThumbnail
      status={status}
      action={action ? <ActionButton action={action} /> : undefined}
    />
  );
}

/**
 * The date tile, drawn on the band.
 *
 * The same month / day / weekday stack as `DateTile`, set in the band's own
 * colours instead of on a page-surface chip. The band is identical in both
 * themes, so this is too; a surface chip turns into a near-black block on
 * the band in dark mode.
 */
export function BandDate({ iso, locale, timeZone }: { iso: string; locale: string; timeZone: string }) {
  const d = new Date(iso);
  const part = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...opts, timeZone }).format(d);
  return (
    <span
      aria-hidden="true"
      className="block w-16 shrink-0 self-start rounded-lg border border-band-rule py-2 text-center"
    >
      <span className="block text-xs font-semibold uppercase tracking-wider text-band-accent">{part({ month: 'short' })}</span>
      <span className="block font-display text-2xl font-bold leading-tight tabular text-band-fg">{part({ day: 'numeric' })}</span>
      <span className="block text-xs text-band-muted">{part({ weekday: 'short' })}</span>
    </span>
  );
}

/** The album from the day, as the past list needs it. */
export interface PastAlbum {
  href: string;
  coverSrc: string | null;
  photoCount: number;
  motif: string;
  contributed: boolean;
}

/**
 * A past event: the cover of the album from the day when there is one,
 * and a way into the photographs. "You attended" only when a check-in was
 * recorded against the viewer.
 */
export function PastEventCard({
  event,
  locale,
  album,
}: {
  event: EventItem;
  locale: LocaleSpec;
  album: PastAlbum | null;
}) {
  // An album with no photo to show gets no art and no count: a strip that
  // holds only a year reads as a picture that failed to load.
  const photos =
    album?.coverSrc ? `${album.photoCount.toLocaleString('en-IN')} photo${album.photoCount === 1 ? '' : 's'}` : null;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface-raised shadow-sm">
      {album?.coverSrc ? (
        <MediaFrame
          src={album.coverSrc}
          alt=""
          aspect="21/9"
          rounded={false}
          className="[&>div]:border-0 [&>div]:border-b"
        />
      ) : null}
      <EventSummary
        event={event}
        href={`/events/${event.slug}`}
        locale={locale}
        variant="row"
        status={event.viewerRegistration?.checkedIn ? <Badge tone="success">You attended</Badge> : undefined}
        className="px-4 pt-4"
      />
      {album ? (
        <div className="relative z-10 mt-auto px-4 pb-4 pt-1">
          <ActionButton
            action={{ label: photos ? `See ${photos}` : 'See the album', href: album.href, primary: false, icon: 'photos' }}
            className="w-full sm:w-auto"
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * "Next up": the one event the hub leads with.
 *
 * With its own cover photo, a 21:9 frame with the facts on the scrim. Without
 * one — every event today — a band card led by the date, set in band colours.
 * Never a campus photo: a picture of last year's crowd under this year's
 * title is a claim about who is coming.
 */
export function NextUpCard({
  event,
  locale,
  eyebrow,
  when,
  action,
}: {
  event: EventItem;
  locale: LocaleSpec;
  eyebrow: string;
  /** "Thu 24 Sept · 9:30 am – 7:00 pm IST". */
  when: string;
  action: EventAction | null;
}) {
  const href = `/events/${event.slug}`;
  const seats = seatStatus(event);
  const price =
    event.ticketPrice > 0
      ? `${formatCurrency(event.ticketPrice, { locale: locale.locale, currency: locale.currency })} per person`
      : 'Free';
  const seatFact = !seats.capped
    ? null
    : seats.full
      ? 'Full'
      : seats.left !== null && seats.left <= 10
        ? `Only ${seats.left} left`
        : seats.registered > 2
          ? `${seats.registered.toLocaleString('en-IN')} going`
          : null;
  const where = event.venue ?? 'Venue to be announced';

  const heading = (
    <h2 id="next-up-title" className="font-display text-display-xs font-bold text-band-fg">
      <Link href={href} className="underline-offset-4 hover:underline">
        {event.title}
      </Link>
    </h2>
  );

  const buttons = (
    <div className="flex flex-wrap gap-2 [&>*]:min-h-11 [&>*]:flex-1 sm:[&>*]:flex-none">
      {action ? (
        <ButtonLink href={action.href} variant="band">
          {action.icon === 'ticket' ? <Ticket className="size-4" aria-hidden="true" /> : null}
          {action.label === 'Show ticket' ? 'Show my ticket' : action.label}
        </ButtonLink>
      ) : null}
      <ButtonLink href={href} variant="band-outline">
        Details
      </ButtonLink>
    </div>
  );

  if (event.coverImage) {
    return (
      <section aria-labelledby="next-up-title" className="band-surface overflow-hidden rounded-xl">
        <MediaFrame
          src={event.coverImage}
          alt=""
          aspect="21/9"
          loading="eager"
          rounded={false}
          className="[&>div]:border-0"
          overlay={
            <div className="space-y-1">
              <p className="text-sm font-semibold">{eyebrow}</p>
              {heading}
              <p className="text-sm">
                {when} · {where}
              </p>
            </div>
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap gap-2">
            <BandChip>{price}</BandChip>
            {seatFact ? <BandChip>{seatFact}</BandChip> : null}
          </div>
          {buttons}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="next-up-title"
      className="band-surface grid gap-5 rounded-xl px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-8"
    >
      <div className="flex min-w-0 items-start gap-4 sm:gap-5">
        <BandDate iso={event.startsAt} locale={locale.locale} timeZone={locale.timeZone} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-band-accent">{eyebrow}</p>
          <div className="mt-1">{heading}</div>
          <p className="mt-2 text-md text-band-muted">
            {when} · {where}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <BandChip>{price}</BandChip>
            {event.alumniOnly ? <BandChip>Alumni only</BandChip> : null}
            {seatFact ? <BandChip>{seatFact}</BandChip> : null}
          </div>
        </div>
      </div>
      {buttons}
    </section>
  );
}
