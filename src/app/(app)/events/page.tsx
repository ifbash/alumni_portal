import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CalendarDays, Ticket } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { require as requireCap, can } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDepartments, getEvents } from '@/lib/data/repo';
import { getAlbumPhotos, getAlbums } from '@/lib/data/content';
import { ButtonLink, ChipNav, EmptyState, PageHeader, Tabs, type TabItem } from '@/components/ui';
import { isContributed } from '@/components/content';
import { isOnlineVenue } from '@/lib/event-status';
import { viewerBatchYear, viewerBranch } from '@/lib/identity';
import { mailto } from '@/lib/mailto';
import type { EventItem } from '@/lib/data/types';
import { EventCard, NextUpCard, PastEventCard, eventAction, type PastAlbum } from './EventCard';
import { dayLabel, whenLine } from './calendar';

/**
 * Events.
 *
 * The list does not decide who may see what — `getEvents()` already
 * applies the eligibility rules (alumni-only events are not addressable by
 * a student anywhere, and unpublished drafts need `event.create.any`).
 * This page leads with the one event most people are coming to, puts the
 * viewer's own tickets one tap away, and gives every other event a single
 * action worked out from what the viewer holds.
 */

export const metadata: Metadata = { title: 'Events' };

type When = 'upcoming' | 'past';

function eventsHref(when: When, branch: string | null): string {
  const q = new URLSearchParams();
  if (when === 'past') q.set('when', 'past');
  if (branch) q.set('branch', branch);
  const s = q.toString();
  return s ? `/events?${s}` : '/events';
}

/**
 * The event the hub leads with: the first upcoming in-person event for
 * every branch, the biggest room (or a paid one) first. Failing that, the
 * first upcoming event of any kind.
 */
function leadEvent(list: EventItem[]): EventItem | null {
  const published = list.filter((e) => e.published);
  const candidates = published.filter((e) => e.departmentCode === null && !isOnlineVenue(e.venue));
  if (candidates.length === 0) return published[0] ?? null;
  const weight = (e: EventItem) => (e.capacity ?? 0) + (e.ticketPrice > 0 ? 1 : 0);
  const top = Math.max(...candidates.map(weight));
  return candidates.find((e) => weight(e) === top) ?? candidates[0] ?? null;
}

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

  // Branch filter. College-wide events stay in the list under every
  // branch; that rule lives in `getEvents`, which is why the filter is
  // passed to it rather than applied here.
  const codes = getDepartments().map((d) => d.code);
  const rawBranch = (Array.isArray(params.branch) ? params.branch[0] : params.branch)?.trim().toUpperCase() ?? '';
  const branch = codes.includes(rawBranch) ? rawBranch : null;
  const list = branch
    ? getEvents(session, { when, includeDrafts: canManage, department: branch })
    : when === 'past'
      ? past
      : upcoming;

  const locale = pack.locale;
  const office = pack.copy.officeName;
  const flags = { canRegister, canManage };
  const draftCount = upcoming.filter((e) => !e.published).length;
  const tickets = upcoming.filter((e) => e.viewerRegistration && e.published);

  const tabs: TabItem[] = [
    { label: 'Upcoming', href: eventsHref('upcoming', branch), count: upcoming.length, active: when === 'upcoming' },
    { label: 'Past', href: eventsHref('past', branch), count: past.length, active: when === 'past' },
  ];

  // "All · Mine: CSE · ECE …" — only branches that have an event in this tab.
  const mine = viewerBranch(session);
  const tabList = when === 'past' ? past : upcoming;
  const withEvents = codes.filter((c) => c !== mine && tabList.some((e) => e.departmentCode === c));
  const chips = [
    { label: 'All', href: eventsHref(when, null), active: branch === null },
    ...(mine ? [{ label: `Mine: ${mine}`, href: eventsHref(when, mine), active: branch === mine }] : []),
    ...withEvents.map((c) => ({ label: c, href: eventsHref(when, c), active: branch === c })),
  ];
  const showChips = chips.length > 2 || branch !== null;

  const lead = when === 'upcoming' ? leadEvent(list) : null;
  const rest = lead ? list.filter((e) => e.id !== lead.id) : list;

  // Past events: the album from the day, when the college has filed one.
  const albums = pack.features.gallery ? getAlbums() : [];
  const albumFor = (event: EventItem): PastAlbum | null => {
    const album = albums.find((a) => a.eventSlug === event.slug);
    if (!album) return null;
    const firstPhoto = getAlbumPhotos(album.id).find((p) => p.url)?.url ?? null;
    return {
      href: `/gallery/${album.slug}`,
      coverSrc: album.coverImage ?? firstPhoto,
      photoCount: album.photoCount,
      motif: String(album.batchYear ?? album.departmentCode ?? new Date(album.takenOn).getUTCFullYear()),
      contributed: isContributed(album),
    };
  };

  const batch = viewerBatchYear(session);
  const suggestHref = pack.copy.supportEmail
    ? mailto(pack.copy.supportEmail, batch ? `Suggesting a meet — Batch of ${batch}` : 'Suggesting a meet', [
        'What I would like to see:',
        '',
        'Where and roughly when:',
        '',
      ])
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Events"
        title="Events"
        description={`Reunions, department sessions and talks from ${pack.copy.shortName}.`}
      />

      {canManage ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-line bg-surface-sunken px-4 py-2">
          <p className="text-sm text-secondary">
            <span className="font-medium text-primary">Organiser view.</span>{' '}
            {draftCount > 0
              ? `${draftCount} ${draftCount === 1 ? 'draft is' : 'drafts are'} listed that members cannot see yet.`
              : 'Drafts you create show here before members can see them.'}
          </p>
          <ButtonLink href="/admin/events" variant="secondary" size="sm" className="min-h-11 sm:min-h-0">
            Manage events
          </ButtonLink>
        </div>
      ) : null}

      {tickets.length > 0 ? (
        <section aria-labelledby="your-tickets" className="space-y-2">
          <h2 id="your-tickets" className="text-sm font-semibold">
            Your tickets
          </h2>
          <ul className="scroll-fade-x flex gap-2 overflow-x-auto pb-1">
            {tickets.map((e) => (
              <li key={e.id} className="shrink-0">
                <Link
                  href={`/events/${e.slug}/ticket`}
                  className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface-raised px-4 text-sm transition-colors duration-fast ease-brand hover:border-line-strong"
                >
                  <Ticket className="size-4 text-brand-fg" aria-hidden="true" />
                  <span className="font-medium">{dayLabel(e.startsAt, locale.locale, locale.timeZone)}</span>
                  <span className="text-secondary">· {e.title} —</span>
                  <span className="font-semibold text-brand-fg">Show ticket</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {lead ? (
        <NextUpCard
          event={lead}
          locale={locale}
          eyebrow={!lead.venue || lead.venue.includes(',') ? 'Next up' : 'Next on campus'}
          when={whenLine(lead, locale.locale, locale.timeZone)}
          action={eventAction(lead, flags)}
        />
      ) : null}

      <div className="space-y-3">
        <Tabs items={tabs} ariaLabel="Event periods" />
        {showChips ? <ChipNav items={chips} ariaLabel="Branch" /> : null}
      </div>

      {list.length === 0 ? (
        when === 'past' ? (
          <EmptyState
            variant="inline"
            title="Past events and their photos appear here once they have happened."
            action={
              <Link href={eventsHref('upcoming', branch)} className="link inline-flex min-h-11 items-center">
                See what is coming up
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={<CalendarDays className="size-5" />}
            title="Nothing is scheduled yet"
            description={`New dates appear here as soon as the ${office} fixes them.`}
            action={
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                {pack.features.gallery ? (
                  <ButtonLink href="/gallery" variant="secondary" className="min-h-11">
                    See photos from past events
                  </ButtonLink>
                ) : null}
                {suggestHref ? (
                  <a href={suggestHref} className="link inline-flex min-h-11 items-center text-sm">
                    Suggest a meet
                  </a>
                ) : null}
              </div>
            }
          />
        )
      ) : when === 'past' ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {list.map((event) => (
            <li key={event.id} className="min-w-0">
              <PastEventCard event={event} locale={locale} album={albumFor(event)} />
            </li>
          ))}
        </ul>
      ) : rest.length > 0 ? (
        <section aria-labelledby="more-events" className="space-y-3">
          <h2 id="more-events" className="sr-only">
            {lead ? 'More events' : 'Upcoming events'}
          </h2>
          <ul className="hidden grid-cols-1 gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-3">
            {rest.map((event) => (
              <li key={event.id} className="min-w-0">
                <EventCard event={event} locale={locale} flags={flags} layout="card" />
              </li>
            ))}
          </ul>
          <ul className="divide-y divide-line sm:hidden">
            {rest.map((event) => (
              <li key={event.id} className="min-w-0">
                <EventCard event={event} locale={locale} flags={flags} layout="row" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

