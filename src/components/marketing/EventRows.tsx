import { ArrowRight } from 'lucide-react';
import { Badge, ButtonLink } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatCurrency, formatDate, formatDateRange } from '@/lib/format';
import { isOnlineVenue, type PublicEvent } from '@/lib/data/public-events';
import type { LocaleSpec } from '@/lib/branding/pack';

/**
 * "Coming up" — the landing page's events, as date-tile rows.
 *
 * Every alumni home page leads with events (research §4), and a date
 * tile works with no photograph at all, which is DIET today. The rows
 * take `PublicEvent`s only: the projection has no registration count and
 * no capacity, so a batch dinner's headcount cannot reach the open
 * internet from here.
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

  const rowClass = 'grid min-h-11 grid-cols-[3.5rem_minmax(0,1fr)] gap-3 p-4';

  return (
    <section id="events" aria-labelledby="events-title" className="scroll-mt-20 py-10 md:py-section">
      <div className="page-shell">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="events-title" className="font-display text-display-xs font-bold">
              {isUpcoming ? `Coming up at ${shortName}` : `Recently at ${shortName}`}
            </h2>
            <p className="mt-2 text-secondary">
              {isUpcoming
                ? 'Dates and venues are public. You sign in to register.'
                : 'New dates go up here as soon as they are fixed.'}
            </p>
          </div>
          {seeAll('hidden min-h-11 sm:inline-flex')}
        </div>

        <ol className="mt-6 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface-raised md:grid md:grid-cols-3 md:divide-x md:divide-y-0">
          {rows.map((e, i) => {
            const body = (
              <>
                <span aria-hidden="true" className="self-start rounded border border-line bg-surface py-2 text-center">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-brand-fg">
                    {part(e.startsAt, { month: 'short' })}
                  </span>
                  <span className="block font-display text-xl font-bold leading-none tabular">
                    {part(e.startsAt, { day: 'numeric' })}
                  </span>
                  <span className="block text-xs text-secondary">{part(e.startsAt, { weekday: 'short' })}</span>
                </span>
                <div className="min-w-0">
                  <h3 className="line-clamp-2 font-semibold leading-snug">{e.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-secondary">
                    {isUpcoming
                      ? `${formatDateRange(e.startsAt, e.endsAt, fmt)} · ${e.venue ?? 'Venue to be announced'}`
                      : `Held on ${formatDate(e.startsAt, fmt)}`}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {e.departmentCode ? (
                      <Badge tone="brand">{e.departmentCode}</Badge>
                    ) : (
                      <Badge tone="outline">All branches</Badge>
                    )}
                    {isOnlineVenue(e.venue) ? <Badge tone="neutral">Online</Badge> : null}
                    {e.ticketPrice > 0 ? (
                      <Badge tone="neutral">{formatCurrency(e.ticketPrice, fmt)}</Badge>
                    ) : (
                      <Badge tone="success">Free</Badge>
                    )}
                  </div>
                </div>
              </>
            );

            return (
              <li key={e.id} className={cn(i === 2 && 'hidden md:block')}>
                {isUpcoming ? (
                  <a
                    href={`/campus-events#event-${e.slug}`}
                    className={cn(
                      rowClass,
                      'h-full transition-colors duration-fast ease-brand hover:bg-surface-sunken focus-visible:outline-offset-[-2px]',
                    )}
                  >
                    {body}
                  </a>
                ) : (
                  <div className={rowClass}>{body}</div>
                )}
              </li>
            );
          })}
        </ol>

        {seeAll('mt-4 w-full min-h-11 sm:hidden')}
      </div>
    </section>
  );
}
