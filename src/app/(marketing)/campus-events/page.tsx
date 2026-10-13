import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  CalendarDays,
  CalendarOff,
  History,
  LogIn,
  MapPin,
  Ticket,
  UserRoundCheck,
  Video,
} from 'lucide-react';
import { getTenantBrand } from '@/lib/tenant';
import { getPublicEvents, isOnlineVenue, type PublicEvent } from '@/lib/data/public-events';
import { inSentence } from '@/lib/branding/copy';
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  EmptyState,
  Section,
  Separator,
} from '@/components/ui';
import { formatCurrency, formatDateRange, formatRelative } from '@/lib/format';

/**
 * The public events list.
 *
 * ─────────────────────────────────────────────────────────────────────
 *  URL NOTE — this is `/campus-events`, not `/events`.
 *
 *  `src/app/(app)/events/page.tsx` already resolves to `/events`, and two
 *  pages in different route groups that resolve to the same path is a
 *  hard Next build error, not a warning ("You cannot have two parallel
 *  pages that resolve to the same path"). `/events` is also
 *  `requiresSession: true` in `ROUTE_POLICY`, so middleware would 307 an
 *  anonymous visitor to /login before this page rendered at all — which
 *  is the one visitor it exists for.
 *
 *  Moving it to `/events` means merging the two listings into one page
 *  that branches on the session, and opening the `/events` prefix in
 *  `src/lib/auth/route-policy.ts`. Both files belong to someone else.
 * ─────────────────────────────────────────────────────────────────────
 *
 * What a signed-out visitor gets: what is on, when, where, and what it is
 * for. What they do not get, deliberately:
 *
 *  - **Alumni-only events.** `getEvents()` filters those for *students*,
 *    not for anonymous callers — an anonymous session has no student role,
 *    so the alumni-only reunion falls straight through. The filter below
 *    is therefore load-bearing rather than belt-and-braces. A batch dinner
 *    at a named hotel is not something to publish to the open internet.
 *  - **Attendee and registration counts.** How many people are coming is
 *    an internal figure; publishing "42 registered" for a batch reunion is
 *    an attendance list by another name and tells a stranger how many
 *    people will be at that hotel.
 *  - **A registration form.** The gate list has to be a list of real,
 *    verified members, so registering starts at sign-in.
 *
 * Nor does it describe event-day procedure, payment methods or catering
 * the college has not confirmed: the event page a member reaches after
 * signing in says what applies to that event.
 */

export async function generateMetadata(): Promise<Metadata> {
  const resolved = await getTenantBrand();
  const pack = resolved?.brand.pack;

  if (!pack || !pack.features.events || !pack.features.publicLanding) {
    return { title: 'Events' };
  }

  return {
    title: 'Events on campus',
    description: `Reunions, department sessions and alumni panels at ${pack.copy.institutionName}. Dates, venues and what each one is for.`,
  };
}

export default async function PublicEventsPage() {
  const resolved = await getTenantBrand();
  if (!resolved) notFound();

  const { copy, features, locale } = resolved.brand.pack;
  const office = copy.officeName;
  const rollMid = inSentence(copy.rollNumberLabel);

  // Two gates, both hard. A college that has not bought the events module
  // has nothing to list; a college with no public marketing surface
  // (`publicLanding: false`) must 404 here rather than leak a list of its
  // campus dates to anyone who guesses the path.
  if (!features.events || !features.publicLanding) notFound();

  const fmt = { locale: locale.locale, currency: locale.currency, timeZone: locale.timeZone };

  // The alumni-only filter and the projection live in `getPublicEvents`,
  // and neither is cosmetic. Passing whole `EventItem`s down to the card
  // put the complete objects — `registeredCount` and `capacity` among
  // them — into the RSC payload embedded in this page's HTML, where
  // view-source on a public page found them. React carries
  // server-component props as debug info in a development build; rather
  // than rely on a production build stripping it, the fields are not
  // carried at all. It is also the house rule: build a response by
  // selecting *into* a projection, never by fetching a full record and
  // declining to render half of it.
  const upcoming = getPublicEvents('upcoming');
  const past = getPublicEvents('past').slice(0, 4);

  return (
    <>
      <section aria-labelledby="events-title" className="band-surface">
        <div className="page-shell py-12 lg:py-16">
          <div className="max-w-prose space-y-3">
            <p className="text-sm font-semibold text-band-accent">{copy.institutionName}</p>
            <h1 id="events-title" className="font-display text-display-md font-bold text-band-fg">
              Events on campus
            </h1>
            <p className="text-md text-band-muted">
              Reunions, department sessions and online panels. Dates and venues are public;
              registering needs an account, because the college needs to know who is coming.
            </p>
          </div>
        </div>
      </section>

      <div className="page-shell space-y-12 py-12 md:space-y-16 md:py-section">
        {/* --------------------------------------------------------- Upcoming */}
        <Section
          title="Coming up"
          description={
            upcoming.length
              ? `${upcoming.length === 1 ? 'One session' : `${upcoming.length} sessions`} on the calendar. Sign in to see seats and register.`
              : undefined
          }
          actions={
            <ButtonLink href="/login" variant="secondary" className="min-h-11">
              <LogIn className="size-4" aria-hidden="true" />
              Sign in
            </ButtonLink>
          }
        >
          {upcoming.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="size-5" />}
              title="Nothing published for the public calendar yet"
              description={`The ${office} adds reunions, department sessions and workshops here once their dates are fixed.`}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <ButtonLink href="/claim" className="min-h-11">
                    Register
                  </ButtonLink>
                  <ButtonLink href="/contact" variant="secondary" className="min-h-11">
                    Ask the {office}
                  </ButtonLink>
                </div>
              }
            />
          ) : (
            <ul className="space-y-4">
              {upcoming.map((event) => (
                <li key={event.id}>
                  <PublicEventCard event={event} fmt={fmt} />
                </li>
              ))}
            </ul>
          )}

          <Alert
            tone="neutral"
            title="What is not on this page"
            icon={<CalendarOff className="size-4" />}
          >
            <p>
              Batch reunions and anything else for alumni only are not listed publicly. Sign in and
              they appear on your own events list. Sessions still being planned go up once their date
              is confirmed.
            </p>
          </Alert>
        </Section>

        <Separator />

        {/* --------------------------------------------------- How registering works */}
        <Section title="How registering works" description="From your first sign-in to the day itself.">
          <div className="grid gap-4 md:grid-cols-3">
            <Step n={1} title="Sign in, or register">
              If the college already holds your email address, sign in with a six-digit code. If it
              does not, register with your {rollMid} first.
            </Step>
            <Step n={2} title="Open the event and register">
              The ticket amount and how to pay, the seats and how many guests you may bring are shown
              on the event page once you are signed in.
            </Step>
            <Step n={3} title="Come on the day">
              Your name is on the registration list the {office} checks people in against.
            </Step>
          </div>

          <p className="text-sm text-secondary">
            Final-year students can register for anything marked open to them.
          </p>
        </Section>

        {past.length > 0 ? (
          <>
            <Separator />

            {/* ----------------------------------------------------- Already held */}
            <Section title="Recently held" description="Sessions from the last few months.">
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface-raised">
                {past.map((event) => (
                  <li key={event.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 p-card">
                    <span className="grid size-8 shrink-0 place-items-center self-start rounded-full bg-surface-sunken text-muted">
                      <History className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium">{event.title}</p>
                      <p className="text-sm text-secondary">
                        {formatDateRange(event.startsAt, event.endsAt, fmt)}
                        {event.venue ? ` · ${event.venue}` : ''}
                      </p>
                    </div>
                    <span className="text-xs text-secondary">{formatRelative(event.startsAt, fmt)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          </>
        ) : null}

        <Separator />

        {/* ---------------------------------------------------------- Closing */}
        <Card>
          <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <h2 className="font-display text-lg font-semibold">Want to speak at one of these?</h2>
              <p className="max-w-prose text-sm text-secondary">
                If you have something the final-year batch should hear — how interviews run at your
                company, what the first two years out are like — tell the {office}. Sessions can be on
                campus or online.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <ButtonLink href="/contact#help" className="min-h-11">
                Offer a session
              </ButtonLink>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

// ---------------------------------------------------------------
// Card
// ---------------------------------------------------------------

function PublicEventCard({
  event,
  fmt,
}: {
  event: PublicEvent;
  fmt: { locale: string; currency: string; timeZone: string };
}) {
  const start = new Date(event.startsAt);
  const day = new Intl.DateTimeFormat(fmt.locale, { day: '2-digit', timeZone: fmt.timeZone }).format(start);
  const month = new Intl.DateTimeFormat(fmt.locale, { month: 'short', timeZone: fmt.timeZone }).format(start);
  const weekday = new Intl.DateTimeFormat(fmt.locale, { weekday: 'short', timeZone: fmt.timeZone }).format(start);

  const online = isOnlineVenue(event.venue);

  // Straight to sign-in, with the member-side event page as the landing
  // spot afterwards. `next` is re-sanitised by the login screen before it
  // is used, which is why encoding it here is enough.
  const registerHref = `/login?next=${encodeURIComponent(`/events/${event.slug}`)}`;

  // `#event-{slug}` is the landing page's deep link to this card; the
  // scroll margin keeps its title clear of the sticky header.
  return (
    <Card as="article" id={`event-${event.slug}`} className="scroll-mt-20">
      <CardBody className="flex flex-col gap-4 sm:flex-row">
        {/* `self-start`: as a flex child the tile stretched to the card's
            full height, a tall grey slab with the date stuck at its top. */}
        <div
          aria-hidden="true"
          className="flex w-full shrink-0 flex-row items-center gap-3 rounded border border-line bg-surface-sunken px-3 py-2 sm:w-20 sm:flex-col sm:gap-1 sm:self-start sm:py-3"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-fg">{month}</span>
          <span className="font-display text-xl font-bold leading-none tabular">{day}</span>
          <span className="text-xs text-secondary">{weekday}</span>
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={event.departmentCode ? 'brand' : 'outline'}>
              {event.departmentCode ?? 'All branches'}
            </Badge>

            {event.ticketPrice > 0 ? (
              <Badge tone="neutral">
                <Ticket className="size-3" aria-hidden="true" />
                {formatCurrency(event.ticketPrice, fmt)}
              </Badge>
            ) : (
              <Badge tone="success">Free</Badge>
            )}

            {event.studentEligible ? (
              <Badge tone="accent">
                <UserRoundCheck className="size-3" aria-hidden="true" />
                Open to final-year students
              </Badge>
            ) : (
              <Badge tone="neutral">Alumni and staff</Badge>
            )}
          </div>

          {/* Not a link. There is no public event page to go to, and a title
              that navigates to a sign-in wall is a promise the card cannot
              keep — the button below says where it goes. */}
          <h3 className="font-display text-lg font-semibold leading-snug">{event.title}</h3>

          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
              {formatDateRange(event.startsAt, event.endsAt, fmt)}
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
              <span>Venue to be announced</span>
            )}
          </p>

          {event.description ? (
            <p className="max-w-prose text-sm text-secondary">{event.description}</p>
          ) : null}

          <div className="pt-1">
            <ButtonLink href={registerHref} variant="secondary" className="min-h-11">
              <LogIn className="size-4" aria-hidden="true" />
              Sign in to register
              <span className="sr-only"> for {event.title}</span>
            </ButtonLink>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------
// Local pieces
// ---------------------------------------------------------------

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card className="h-full">
      <CardBody className="space-y-2">
        <span className="grid size-9 place-items-center rounded-full bg-brand-soft font-display text-sm font-bold text-brand-soft-fg tabular">
          {n}
        </span>
        <h3 className="font-display text-base font-semibold">{title}</h3>
        <p className="text-sm text-secondary">{children}</p>
      </CardBody>
    </Card>
  );
}
