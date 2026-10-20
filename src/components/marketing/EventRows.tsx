import { ArrowRight } from 'lucide-react';
import { Badge, ButtonLink } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatCurrency, formatDate, formatDateRange } from '@/lib/format';
import { isOnlineVenue, type PublicEvent } from '@/lib/data/public-events';
import type { LocaleSpec } from '@/lib/branding/pack';
import { SectionHead } from './SectionHead';

/**
 * "Coming up" — the landing page's events, led by their dates.
 *
 * Every alumni home page leads with events (research §4), and a date
 * works with no photograph at all, which is DIET today. The first event
 * is the lead: a large card with the day set as display type. The others
 * are compact rows with the same date block, so an alumnus scanning the
 * page reads dates first and titles second.
 *
 * The rows take `PublicEvent`s only: the projection has no registration
 * count and no capacity, so a batch dinner's headcount cannot reach the
 * open internet from here.
 *
 * With nothing upcoming, the two most recent past events stand in, so
 * the section says "this college holds events" rather than showing an
 * empty box. With neither, the section is omitted.
 */
export function EventRows({
  upcoming,
  past,
  shortName,
  locale,
}: {
  upcoming: PublicEvent[];
  /** Newest first. Only read when `upcoming` is empty. */
  past: PublicEvent[];
  shortName: string;
  locale: LocaleSpec;
}) {
  const isUpcoming = upcoming.length > 0;
  const rows = isUpcoming ? upcoming.slice(0, 3) : past.slice(0, 2);
  if (!rows.length) return null;

  const fmt = { locale: locale.locale, currency: locale.currency, timeZone: locale.timeZone };
  const part = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale.locale, { ...opts, timeZone: locale.timeZone }).format(new Date(iso));

  const seeAll = (className: string) => (
    <ButtonLink href="/campus-events" variant="secondary" size="md" className={className}>
      See all events
      <ArrowRight className="size-4" aria-hidden="true" />
    </ButtonLink>
  );

  const when = (e: PublicEvent) =>
    isUpcoming
      ? `${formatDateRange(e.startsAt, e.endsAt, fmt)} · ${e.venue ?? 'Venue to be announced'}`
      : `Held on ${formatDate(e.startsAt, fmt)}`;

  const badges = (e: PublicEvent) => (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {e.departmentCode ? <Badge tone="brand">{e.departmentCode}</Badge> : <Badge tone="outline">All branches</Badge>}
      {isOnlineVenue(e.venue) ? <Badge tone="neutral">Online</Badge> : null}
      {e.ticketPrice > 0 ? <Badge tone="neutral">{formatCurrency(e.ticketPrice, fmt)}</Badge> : <Badge tone="success">Free</Badge>}
    </div>
  );

  // The whole card is the link for an upcoming event; a past one is a plain block.
  const wrap = (e: PublicEvent, className: string, children: React.ReactNode) =>
    isUpcoming ? (
      <a
        href={`/campus-events#event-${e.slug}`}
        className={cn(className, 'lift block h-full focus-visible:outline-offset-[-2px]')}
      >
        {children}
      </a>
    ) : (
      <div className={cn(className, 'h-full')}>{children}</div>
    );

  const [lead, ...rest] = rows as [PublicEvent, ...PublicEvent[]];
  const card = 'overflow-hidden rounded-xl border border-line bg-surface-raised ring-hairline';

  return (
    <section id="events" aria-labelledby="events-title" className="scroll-mt-20 py-10 md:py-section">
      <div className="page-shell">
        <SectionHead
          id="events-title"
          eyebrow={isUpcoming ? 'Events' : 'Recent events'}
          title={isUpcoming ? `Coming up at ${shortName}` : `Recently at ${shortName}`}
          description={
            isUpcoming
              ? 'Dates and venues are public. You sign in to register.'
              : 'New dates go up here as soon as they are fixed.'
          }
          actions={seeAll('hidden min-h-11 md:inline-flex')}
        />

        <ol className="reveal mt-6 grid gap-3 md:mt-10 md:grid-cols-12 md:gap-5">
          {/* The lead: the day is the picture. */}
          <li className={cn(rest.length === 0 ? 'md:col-span-12' : 'md:col-span-7', rest.length > 1 && 'md:row-span-2')}>
            {wrap(
              lead,
              card,
              <div className="relative flex h-full flex-col p-5 md:p-8">
                <div aria-hidden="true" className="flex items-end gap-4">
                  <span className="font-display text-[clamp(3.5rem,9vw,7.5rem)] font-bold leading-[0.8] tabular">
                    {part(lead.startsAt, { day: 'numeric' })}
                  </span>
                  <span className="pb-1">
                    <span className="block text-sm font-semibold uppercase tracking-[0.14em] text-brand-fg">
                      {part(lead.startsAt, { month: 'long' })}
                    </span>
                    <span className="block text-sm text-secondary">{part(lead.startsAt, { weekday: 'long' })}</span>
                  </span>
                </div>

                <h3 className="mt-4 font-display text-display-xs md:mt-6 font-bold leading-snug">{lead.title}</h3>
                <p className="mt-2 text-secondary">{when(lead)}</p>
                {badges(lead)}

                {isUpcoming ? (
                  <span className="mt-auto inline-flex min-h-11 items-center gap-2 pt-4 text-sm font-semibold text-brand-fg md:pt-6">
                    See the event
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </span>
                ) : null}
              </div>,
            )}
          </li>

          {rest.map((e, i) => (
            <li key={e.id} className={cn('md:col-span-5', i === 1 && 'hidden md:block')}>
              {wrap(
                e,
                card,
                <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 p-5">
                  <span
                    aria-hidden="true"
                    className="self-start rounded-lg border border-line bg-surface py-2.5 text-center"
                  >
                    <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-brand-fg">
                      {part(e.startsAt, { month: 'short' })}
                    </span>
                    <span className="block font-display text-display-sm font-bold leading-none tabular">
                      {part(e.startsAt, { day: 'numeric' })}
                    </span>
                    <span className="block text-xs text-secondary">{part(e.startsAt, { weekday: 'short' })}</span>
                  </span>
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 font-display text-lg font-bold leading-snug">{e.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-secondary">{when(e)}</p>
                    {badges(e)}
                  </div>
                </div>,
              )}
            </li>
          ))}
        </ol>

        {seeAll('mt-3 w-full min-h-11 md:hidden')}
      </div>
    </section>
  );
}
