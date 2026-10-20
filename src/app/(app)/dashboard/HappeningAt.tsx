import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Award, Flag, Megaphone, Newspaper } from 'lucide-react';
import { Badge, ButtonLink, Card, DateTile, EmptyState, MediaFrame } from '@/components/ui';
import {
  AlbumCard,
  EventSummary,
  SeatBadge,
  StoryCard,
  eventMetaLine,
  parseContributor,
} from '@/components/content';
import { getAlbumPhotos, getAlbums, getNews, type NewsItem, type NewsKind } from '@/lib/data/content';
import { cn } from '@/lib/cn';
import { seatStatus } from '@/lib/event-status';
import { daysUntil } from '@/lib/format';
import type { BrandPack } from '@/lib/branding/pack';
import type { EventItem } from '@/lib/data/types';

/**
 * What the college is running, on both homes.
 *
 * Laid out as a small bento. The next event is the lead tile: the date in
 * display type, the title, where and when, and the one step. The events
 * after it sit beside it as a quiet list (stacked under it where the
 * column is narrow). News follows, one lead story and two rows, then the
 * newest photo album. Every image here belongs to the item it sits on (an
 * event's own cover, a story's own cover, an album's own photos). Where
 * there is none, a story is set in type alone and an event gets its date
 * tile; the photos block appears only when the newest album has a photo to
 * show. A campus photo never stands in for any of them.
 *
 * The caller decides whether events show at all: `events` is null when
 * the viewer cannot register for events (a finance officer), so the
 * block is not rendered rather than rendered empty.
 */

const KIND: Record<NewsKind, { label: string; icon: React.ReactNode }> = {
  achievement: { label: 'Achievement', icon: <Award aria-hidden="true" /> },
  announcement: { label: 'Announcement', icon: <Megaphone aria-hidden="true" /> },
  milestone: { label: 'Milestone', icon: <Flag aria-hidden="true" /> },
  press: { label: 'In the press', icon: <Newspaper aria-hidden="true" /> },
  // Never dressed: no icon, no art, no colour.
  obituary: { label: 'In memoriam', icon: null },
};

export function HappeningAt({
  pack,
  events,
  showPhotos,
  className,
}: {
  pack: BrandPack;
  /** Up to three upcoming events, or null when the viewer cannot register for events. */
  events: EventItem[] | null;
  /**
   * Whether the viewer may open the gallery. The caller passes
   * `isActive(session)`, the same rule /gallery redirects on, so a lapsed
   * or rejected account never sees an album here that it cannot open.
   */
  showPhotos: boolean;
  className?: string;
}) {
  const { copy, features, locale } = pack;

  const showEvents = features.events && events !== null;

  // ---- News: one lead story, then two rows --------------------------
  const stories = features.news ? getNews() : [];
  // getNews() already sorts pinned first, then newest. An obituary is
  // never the lead; it may appear as a plain row.
  const lead = stories.find((s) => s.kind !== 'obituary') ?? null;
  const rows = stories.filter((s) => s !== lead).slice(0, 2);

  // ---- Photos: the newest album -------------------------------------
  // Only when it has a photo to show: a home page tile that holds nothing
  // but a year and a count reads as a picture that failed to load.
  const newest = features.gallery && showPhotos ? (getAlbums()[0] ?? null) : null;
  const coverSrc = newest
    ? (newest.coverImage ?? getAlbumPhotos(newest.id).find((p) => p.url)?.url ?? null)
    : null;
  const album = coverSrc ? newest : null;
  const contributor = album ? parseContributor(album.contributedBy) : null;

  if (!showEvents && !lead && !album) return null;

  const story = (s: NewsItem, variant: 'lead' | 'row') => (
    <StoryCard
      story={s}
      href={`/news/${s.slug}`}
      locale={locale}
      variant={variant}
      eyebrow={
        <>
          {KIND[s.kind].icon}
          {KIND[s.kind].label}
        </>
      }
    />
  );

  const [next, ...later] = events ?? [];

  return (
    <section aria-labelledby="happening-title" className={cn('space-y-6', className)}>
      <h2
        id="happening-title"
        className="font-display text-display-xs font-bold tracking-tight"
      >
        Happening at {copy.shortName}
      </h2>

      {showEvents ? (
        <div className="space-y-3">
          <BlockHead title="Events" href="/events" linkLabel="All events" />
          {next ? (
            <div
              className={cn(
                'grid grid-cols-1 gap-4',
                later.length && 'min-[1360px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]',
              )}
            >
              <LeadEvent event={next} pack={pack} />
              {later.length ? (
                <Card as="section" aria-label="Also coming up" className="min-w-0 p-card">
                  <h3 className="text-sm font-semibold text-secondary">Also coming up</h3>
                  <ul className="mt-2 divide-y divide-line">
                    {later.map((e) => (
                      <li key={e.id} className="space-y-1.5 py-3 first:pt-1 last:pb-0">
                        <EventSummary event={e} href={`/events/${e.slug}`} locale={locale} variant="compact" />
                        <div className="flex flex-wrap items-center gap-1.5 pl-[3.75rem]">
                          {e.viewerRegistration ? (
                            <Badge tone="success" dot>
                              Registered
                            </Badge>
                          ) : (
                            <SeatBadge event={e} audience="member" />
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}
            </div>
          ) : (
            <EmptyState
              variant="inline"
              title={`Nothing is scheduled yet. Events appear here when the ${copy.officeName} announces them.`}
            />
          )}
        </div>
      ) : null}

      {lead || album ? (
        <div
          className={cn(
            'grid grid-cols-1 gap-6',
            lead && album && 'sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,17rem)]',
          )}
        >
          {lead ? (
            <div className="min-w-0 space-y-3">
              <BlockHead title="News" href="/news" linkLabel="All news" />
              {/* The lead card at sm and up; on a phone the art would cost a
                  screen, so the same story is a plain row there. */}
              <div className="hidden sm:block">{story(lead, 'lead')}</div>
              <ul className="divide-y divide-line">
                <li className="sm:hidden">{story(lead, 'row')}</li>
                {rows.map((s) => (
                  <li key={s.id}>{story(s, 'row')}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {album ? (
            // Not on a phone: the album would cost a full screen there, and
            // Gallery is one tap away in the menu.
            <div className="hidden min-w-0 space-y-3 sm:block">
              <BlockHead title="Photos" href="/gallery" linkLabel="All photos" />
              <AlbumCard
                album={album}
                coverSrc={coverSrc}
                href={`/gallery/${album.slug}`}
                locale={locale}
                variant="tile"
                credit={contributor ? `Sent in by ${contributor.name}` : `Posted by the ${copy.officeName}`}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * The next event as the page's lead tile. The title is the link (its
 * `after` stretches over the tile); the button inside is lifted above it
 * so it stays its own target. A tint from the brand soft fill washes in
 * from the corner behind the date, so the tile has a place the eye lands.
 */
function LeadEvent({ event, pack }: { event: EventItem; pack: BrandPack }) {
  const { locale } = pack;
  const seats = seatStatus(event);
  const days = daysUntil(event.startsAt, locale.timeZone);
  const when = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days > 1 ? `In ${days} days` : null;
  const registered = Boolean(event.viewerRegistration);

  return (
    <article className="lift ring-hairline relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface-raised shadow-sm">
      {event.coverImage ? (
        <MediaFrame src={event.coverImage} alt="" aspect="21/9" rounded={false} className="[&>div]:rounded-none [&>div]:border-0" />
      ) : null}
      <div className="relative flex flex-1 flex-col gap-4 bg-[linear-gradient(135deg,var(--brand-soft),transparent_60%)] p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <DateTile iso={event.startsAt} locale={locale.locale} timeZone={locale.timeZone} size="lg" className="shadow-sm" />
          <div className="min-w-0 space-y-1.5">
            <p className="eyebrow text-xs text-brand-soft-fg">{when ? `Next up · ${when}` : 'Next up'}</p>
            <h3 className="font-display text-lg font-bold leading-snug tracking-tight">
              <Link href={`/events/${event.slug}`} className="link-quiet after:absolute after:inset-0">
                {event.title}
              </Link>
            </h3>
            <p className="text-sm text-secondary">{eventMetaLine(event, locale)}</p>
          </div>
        </div>

        {event.description ? <p className="line-clamp-3 max-w-prose text-sm text-secondary">{event.description}</p> : null}

        <div className="mt-auto flex flex-wrap items-center gap-2">
          {registered ? (
            <Badge tone="success" dot>
              Registered
            </Badge>
          ) : seats.full ? (
            <Badge tone="warning">Full</Badge>
          ) : (
            <SeatBadge event={event} audience="member" />
          )}
          {event.alumniOnly ? <Badge tone="accent">Alumni only</Badge> : null}
          {event.departmentCode ? <Badge tone="brand">{event.departmentCode}</Badge> : null}
          <ButtonLink
            href={registered ? `/events/${event.slug}/ticket` : `/events/${event.slug}`}
            variant={registered ? 'secondary' : 'primary'}
            size="sm"
            className="relative z-10 ml-auto min-h-11"
          >
            {registered ? 'Show my ticket' : 'Register'}
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
        </div>
      </div>
    </article>
  );
}

/** A block's small heading with its "see all" link on the right. */
export function BlockHead({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="eyebrow min-w-0 text-secondary">{title}</h3>
      <Link
        href={href}
        className="group -my-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-fg hover:underline"
      >
        {linkLabel}
        <ArrowRight
          className="size-4 transition-transform duration-fast ease-brand group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    </div>
  );
}

/**
 * A row of cards that scrolls sideways on a phone, one card and a peek of
 * the next per screen, and becomes a grid from `sm`. The row bleeds to the
 * screen edge so the peek reads as "more this way"; its own overflow
 * keeps the page itself from scrolling sideways.
 */
export const SNAP_ROW =
  '-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 ' +
  'sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-3';

export const SNAP_ITEM = 'w-[85%] min-w-0 shrink-0 snap-start sm:w-auto';
