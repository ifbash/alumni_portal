import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  CalendarDays,
  CalendarOff,
  History,
  Info,
  LogIn,
  MapPin,
  Ticket,
  UserRoundCheck,
  Video,
} from 'lucide-react';
import { getTenantBrand } from '@/lib/tenant';
import { getEvents } from '@/lib/data/repo';
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
import type { EventItem } from '@/lib/data/types';

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
 */

/**
 * Everything about an event that a signed-out visitor may see, and
 * nothing else. Notably absent: `registeredCount`, `capacity`,
 * `published`, `alumniOnly` and `viewerRegistration`.
 */
interface PublicEvent {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  venue: string | null;
  startsAt: string;
  endsAt: string | null;
  departmentCode: string | null;
  studentEligible: boolean;
  ticketPrice: number;
}

const isPublic = (e: EventItem): boolean => !e.alumniOnly;

function toPublic(e: EventItem): PublicEvent {
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    description: e.description,
    venue: e.venue,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    departmentCode: e.departmentCode,
    studentEligible: e.studentEligible,
    ticketPrice: e.ticketPrice,
  };
}

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

  // Two gates, both hard. A college that has not bought the events module
  // has nothing to list; a college with no public marketing surface
  // (`publicLanding: false`) must 404 here rather than leak a list of its
  // campus dates to anyone who guesses the path.
  if (!features.events || !features.publicLanding) notFound();

  const fmt = { locale: locale.locale, currency: locale.currency, timeZone: locale.timeZone };

  // `null` session: published events only, no drafts, no viewer
  // registration. The alumni-only filter is ours — see the note above.
  //
  // `toPublic` then narrows each row to the fields this page draws, and
  // that projection is not cosmetic. Passing whole `EventItem`s down to
  // the card put the complete objects — `registeredCount` and `capacity`
  // among them — into the RSC payload embedded in this page's HTML, where
  // view-source on a public page found them. React carries
  // server-component props as debug info in a development build; rather
  // than rely on a production build stripping it, the fields are not
  // carried at all. It is also the house rule: build a response by
  // selecting *into* a projection, never by fetching a full record and
  // declining to render half of it.
  const upcoming = getEvents(null, { when: 'upcoming' }).filter(isPublic).map(toPublic);
  const past = getEvents(null, { when: 'past' }).filter(isPublic).slice(0, 4).map(toPublic);

  return (
    <>
      <section className="border-b border-line bg-surface-sunken py-16">
        <div className="page-shell max-w-prose space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-fg">
            {copy.institutionName}
          </p>
          <h1 className="font-display text-display-md font-bold">Events on campus</h1>
          <p className="text-md text-secondary">
            Reunions, department sessions and online panels, run by the alumni cell. Dates, venues
            and what each session is for are public — you do not need an account to plan around
            them. Registration does need one, because the list at the gate has to be a list of
            people the college can actually place.
          </p>
        </div>
      </section>

      <div className="page-shell space-y-16 py-section">
        {/* --------------------------------------------------------- Upcoming */}
        <Section
          title="Coming up"
          description={
            upcoming.length === 1
              ? 'One session on the calendar at the moment.'
              : `${upcoming.length} sessions on the calendar at the moment.`
          }
          actions={
            <ButtonLink href="/login" variant="secondary" size="sm">
              <LogIn className="size-4" aria-hidden="true" />
              Sign in
            </ButtonLink>
          }
        >
          {upcoming.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="size-5" />}
              title="Nothing published for the public calendar yet"
              description="The alumni cell puts the annual meet, department panels and workshops here once the dates are fixed with the campus. Members are emailed the moment one goes up, which is the argument for claiming your profile now rather than checking back."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <ButtonLink href="/claim" size="sm">
                    Claim your profile
                  </ButtonLink>
                  <ButtonLink href="/contact" variant="secondary" size="sm">
                    Ask the alumni cell
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
              Batch reunions and anything else marked alumni-only are not listed publicly — the
              venue and date of a private dinner for one batch is not something to publish on the
              open internet. Sign in and they appear on your own events list. Sessions still being
              planned are not here either; they go up when the date is confirmed, not before.
            </p>
          </Alert>
        </Section>

        <Separator />

        {/* --------------------------------------------------- How registering works */}
        <Section
          title="How registering works"
          description="Three steps, and the first one is the only one that ever causes trouble."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <Step n={1} title="Sign in, or claim your profile">
              If the college already holds your email address, a six-digit code arrives in a few
              seconds. If it does not — and for most batches before 2018 it does not — claim your
              profile with your roll number and the alumni cell matches you against the degree
              register.
            </Step>
            <Step n={2} title="Open the event and register">
              Seats, the waiting list, the ticket amount and how many guests you may bring are all
              shown on the event page once you are signed in. Paid events are settled by UPI or
              card at that point.
            </Step>
            <Step n={3} title="Come to the desk with your name">
              The alumni cell works from the registration list at the gate. There is no printed
              pass to lose — your name and batch are on the desk&apos;s list, and check-in is a
              tick against it.
            </Step>
          </div>

          <p className="text-sm text-secondary">
            Final-year students are registered through the placement cell and can attend anything
            marked open to students. Family and guests are counted at registration, not at the
            gate, so the caterers get an honest number.
          </p>
        </Section>

        {past.length > 0 ? (
          <>
            <Separator />

            {/* ----------------------------------------------------- Already held */}
            <Section
              title="Recently held"
              description="Kept public so you can see the cell actually runs these, not just announces them."
            >
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
                    <span className="text-xs text-muted">{formatRelative(event.startsAt, fmt)}</span>
                  </li>
                ))}
              </ul>

              <p className="text-sm text-secondary">
                Photographs from past events sit inside the portal rather than out here — they are
                pictures of identifiable students and alumni, and those are not published without
                an account behind them.
              </p>
            </Section>
          </>
        ) : null}

        <Separator />

        {/* ---------------------------------------------------------- Closing */}
        <Card>
          <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <h2 className="font-display text-lg font-semibold">
                Want to speak at one of these?
              </h2>
              <p className="max-w-prose text-sm text-secondary">
                Department sessions are run by alumni, not by the cell. If you have something the
                final-year batch should hear — how interviews actually run at your company, what
                the first two years out are like — say so and the branch will find you a slot.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <ButtonLink href="/contact">Offer a session</ButtonLink>
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

  const online = Boolean(event.venue && /online|zoom|meet|webinar|link/i.test(event.venue));

  // Straight to sign-in, with the member-side event page as the landing
  // spot afterwards. `next` is re-sanitised by the login screen before it
  // is used, which is why encoding it here is enough.
  const registerHref = `/login?next=${encodeURIComponent(`/events/${event.slug}`)}`;

  return (
    <Card as="article">
      <CardBody className="flex flex-col gap-4 sm:flex-row">
        <div className="flex w-full shrink-0 flex-row items-center gap-3 rounded border border-line bg-surface-sunken px-3 py-2 sm:w-20 sm:flex-col sm:gap-0 sm:py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-fg">{month}</span>
          <span className="font-display text-xl font-bold leading-none tabular">{day}</span>
          <span className="text-xs text-muted">{weekday}</span>
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
              <span className="text-muted">Venue to be announced</span>
            )}
          </p>

          {event.description ? (
            <p className="text-sm text-secondary">{event.description}</p>
          ) : null}
        </div>

        <div className="w-full shrink-0 space-y-2 border-t border-line pt-3 sm:w-52 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
          <ButtonLink href={registerHref} size="sm">
            <LogIn className="size-4" aria-hidden="true" />
            Sign in to register
          </ButtonLink>
          <p className="flex items-start gap-1.5 text-xs text-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Seats left, the waiting list and guest numbers are shown once you are signed in.
            </span>
          </p>
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
