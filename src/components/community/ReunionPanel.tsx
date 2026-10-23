import Link from 'next/link';
import { CalendarHeart } from 'lucide-react';

import { Card, CardBody } from '@/components/ui';
import { EventSummary } from '@/components/content';
import { ButtonLink } from '@/components/ui';
import type { LocaleSpec } from '@/lib/branding/pack';
import type { ReunionMilestone } from '@/lib/community';
import type { EventItem } from '@/lib/data/types';

/**
 * What a batch page says about reunions.
 *
 * Three states, and only one of them is ever shown:
 *
 *  - **A reunion is on.** The event itself, with the way to it. A batch page
 *    is forwarded to a batch group; the most useful thing on it is the date.
 *  - **A milestone is coming and nobody has put one forward.** An honest
 *    nudge: the batch reaches ten years this year, and here is how to start.
 *    It never invents a milestone, and it never says "your reunion" when
 *    there is none.
 *  - **Neither.** Nothing at all. An empty panel that says "no reunion
 *    planned" is a reproach to the people who are not planning one.
 */
export function ReunionPanel({
  year,
  locale,
  events,
  milestone,
  canPropose,
  officeName,
  currentYear,
}: {
  year: number;
  /** The year it is now in the college's time zone, from the portal's clock, never the wall clock. */
  currentYear: number;
  locale: LocaleSpec;
  /** Upcoming reunions for this batch the viewer may see. */
  events: EventItem[];
  /** The milestone this batch reaches this year or next, if any. */
  milestone: ReunionMilestone | null;
  /** Whether the viewer may put an event forward. */
  canPropose: boolean;
  officeName: string;
}) {
  if (events.length > 0) {
    return (
      <section aria-labelledby="reunion-heading" className="space-y-3">
        <h2 id="reunion-heading" className="font-display text-xl font-semibold">
          {events.length === 1 ? 'The reunion' : 'Reunions'}
        </h2>
        <Card>
          <CardBody className="divide-y divide-line py-1">
            {events.map((e) => (
              <EventSummary
                key={e.id}
                event={e}
                href={`/events/${e.slug}`}
                locale={locale}
                variant="row"
                action={
                  <ButtonLink href={`/events/${e.slug}`} variant="secondary" className="min-h-11">
                    {e.viewerRegistration ? 'Show ticket' : 'See details'}
                  </ButtonLink>
                }
              />
            ))}
          </CardBody>
        </Card>
      </section>
    );
  }

  if (!milestone) return null;

  const when = milestone.year === currentYear ? 'this year' : `in ${milestone.year}`;

  return (
    <aside aria-label="Reunion" className="flex flex-col gap-3 rounded-lg border border-line bg-surface-raised px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:gap-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-soft-fg" aria-hidden="true">
        <CalendarHeart className="size-5" />
      </span>
      <p className="min-w-0 text-md text-primary sm:flex-1">
        The batch of {year} reaches {milestone.years} years {when}: a {milestone.label.toLowerCase()}.{' '}
        {canPropose ? 'Nobody has put one forward yet.' : `Ask the ${officeName} about planning one.`}
      </p>
      {canPropose ? (
        <ButtonLink href={`/events/propose?kind=reunion&batch=${year}`} variant="secondary" className="min-h-11 shrink-0">
          Propose a reunion
        </ButtonLink>
      ) : (
        <Link href="/contact" className="link inline-flex min-h-11 shrink-0 items-center text-sm">
          Contact the {officeName}
        </Link>
      )}
    </aside>
  );
}
