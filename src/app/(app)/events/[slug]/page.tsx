import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Clock, Images, MapPin, Ticket, Video } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { require as requireCap, can } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDepartments, getEventBySlug, getEvents } from '@/lib/data/repo';
import { getAlbumPhotos, getAlbums } from '@/lib/data/content';
import {
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  MediaFrame,
  Section,
  ShareActions,
  StickyActionBar,
} from '@/components/ui';
import { AlbumCard, SeatBadge } from '@/components/content';
import { BandChip } from '@/components/brand/PageBand';
import { formatCurrency, formatDate } from '@/lib/format';
import { isOnlineVenue, seatStatus } from '@/lib/event-status';
import { directionsUrl } from '@/lib/maps';
import { eventShareText } from '@/lib/share-text';
import { siteOrigin, whatsappShareUrl } from '@/lib/share';
import { BandDate } from '../EventCard';
import { calendarLinks, whenLine } from '../calendar';
import { RegisterForm, type GuestOption } from './RegisterForm';

/**
 * One event.
 *
 * Eligibility is decided by `getEventBySlug()` — an alumni-only event is
 * not addressable by a student and an unpublished draft needs
 * `event.create.any`, both enforced in the repo. When it returns null this
 * page 404s rather than explaining which rule caught you.
 *
 * The page is one hero and one action. The hero says what, when and for
 * whom; the action card holds the single thing the viewer can do next
 * (register, show their ticket, ask for a seat, see the photos), pinned
 * in the rail on a desktop and to the bottom of the screen on a phone.
 */

const MAX_GUESTS = 3;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const session = await getSession();
  const event = session ? getEventBySlug(session, slug) : null;

  if (!event) return { title: 'Event not found' };

  return {
    title: event.title,
    description: event.description?.slice(0, 180) ?? undefined,
  };
}

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const pack = resolved.brand.pack;
  if (!pack.features.events) notFound();

  const canRegister = can(session, 'event.register');
  const canManage = can(session, 'event.create.any');
  if (!canRegister && !canManage) requireCap(session, 'event.register');

  const { slug } = await params;
  const event = getEventBySlug(session, slug);
  if (!event) notFound();

  // Upcoming vs past comes from the repo's own clock, not a second one
  // invented here — otherwise the list and the detail page can disagree.
  const isPast = getEvents(session, { when: 'past', includeDrafts: canManage }).some(
    (e) => e.id === event.id,
  );

  const locale = pack.locale.locale;
  const timeZone = pack.locale.timeZone;
  const currency = pack.locale.currency;
  const money = (n: number) => formatCurrency(n, { locale, currency });
  const office = pack.copy.officeName;

  const department = event.departmentCode
    ? getDepartments().find((d) => d.code === event.departmentCode)
    : null;

  const seats = seatStatus(event);
  const online = isOnlineVenue(event.venue);
  const paragraphs = (event.description ?? '').split(/\n{2,}/).filter(Boolean);
  const when = whenLine(event, locale, timeZone);
  const where = event.venue ?? 'Venue to be announced';

  const guestOptions: GuestOption[] = Array.from({ length: MAX_GUESTS + 1 }, (_, g) => ({
    value: g,
    label: g === 0 ? 'Just me' : `${g} guest${g === 1 ? '' : 's'}`,
    totalLabel: event.ticketPrice > 0 ? money(event.ticketPrice * (1 + g)) : null,
  }));

  const registration = event.viewerRegistration
    ? {
        id: event.viewerRegistration.id,
        guests: event.viewerRegistration.guests,
        checkedIn: event.viewerRegistration.checkedIn,
        amountLabel:
          event.ticketPrice > 0
            ? money(event.ticketPrice * (1 + event.viewerRegistration.guests))
            : 'Free',
      }
    : null;

  const origin = await siteOrigin();
  const url = `${origin}/events/${event.slug}`;
  const ticketHref = `/events/${event.slug}/ticket`;
  const calendar = calendarLinks(event, { url, addressLines: pack.copy.addressLines, timeZone });
  const directions = isPast ? null : directionsUrl(event.venue, pack.copy.addressLines);

  // The album from the day, when the college has filed one. Its cover is
  // the only photo a past event page shows; an upcoming one shows only the
  // event's own cover. Never a campus photo.
  const album = pack.features.gallery ? (getAlbums().find((a) => a.eventSlug === event.slug) ?? null) : null;
  const albumPhotos = album ? getAlbumPhotos(album.id).filter((p) => p.url) : [];
  const albumCover = album ? (album.coverImage ?? albumPhotos[0]?.url ?? null) : null;
  const heroImage = isPast ? (albumCover ?? event.coverImage) : event.coverImage;

  type State = 'past' | 'draft' | 'organiser' | 'registered' | 'full' | 'open';
  const state: State = isPast
    ? 'past'
    : !event.published
      ? 'draft'
      : !canRegister
        ? 'organiser'
        : registration
          ? 'registered'
          : seats.full
            ? 'full'
            : 'open';

  const attendee = `/admin/events/${event.id}`;
  const pastLine = event.viewerRegistration?.checkedIn
    ? 'You attended'
    : event.viewerRegistration
      ? 'You registered. No check-in was recorded.'
      : 'You were not registered';

  // ---------------------------------------------------------------
  // Hero
  // ---------------------------------------------------------------

  const eyebrow = department ? department.name : 'All branches';
  const chips = (
    <>
      {isPast ? null : event.alumniOnly ? (
        <BandChip>Alumni only</BandChip>
      ) : (
        <BandChip>{event.studentEligible ? 'Alumni and final-year students' : 'Alumni and faculty'}</BandChip>
      )}
      {isPast ? null : <BandChip>{event.ticketPrice > 0 ? `${money(event.ticketPrice)} per person` : 'Free'}</BandChip>}
      {online ? <BandChip>Online</BandChip> : null}
    </>
  );

  const hero = heroImage ? (
    <section aria-labelledby="event-title" className="band-surface -mx-4 overflow-hidden sm:mx-0 sm:rounded-xl">
      <MediaFrame
        src={heroImage}
        alt=""
        aspect="16/9"
        loading="eager"
        rounded={false}
        className="[&>div]:border-0 lg:[&>div]:aspect-[21/9]"
        overlay={
          <div className="space-y-1">
            <p className="text-sm font-semibold">{eyebrow}</p>
            <h1 id="event-title" className="font-display text-display-sm font-bold text-band-fg">
              {event.title}
            </h1>
          </div>
        }
      />
      <div className="space-y-3 px-5 py-4 sm:px-8">
        <p className="text-md text-band-muted">
          {when} · {where}
        </p>
        <div className="flex flex-wrap gap-2">{chips}</div>
      </div>
    </section>
  ) : (
    <section
      aria-labelledby="event-title"
      className="band-surface -mx-4 px-5 py-6 sm:mx-0 sm:rounded-xl sm:px-8 lg:py-8"
    >
      <div className="flex items-start gap-4 sm:gap-5">
        <BandDate iso={event.startsAt} locale={locale} timeZone={timeZone} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-band-accent">{eyebrow}</p>
          <h1 id="event-title" className="mt-1 font-display text-display-sm font-bold text-band-fg">
            {event.title}
          </h1>
          <p className="mt-2 text-md text-band-muted">
            {when} · {where}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">{chips}</div>
        </div>
      </div>
    </section>
  );

  // ---------------------------------------------------------------
  // The one action
  // ---------------------------------------------------------------

  const cardTitle: Record<State, string> = {
    past: pastLine,
    draft: 'Draft',
    organiser: 'Organiser view',
    registered: 'You are going',
    full: 'Register',
    open: 'Register',
  };

  const actionCard = (
    <Card id="register" className="scroll-mt-20">
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">{cardTitle[state]}</h2>
          {state === 'open' || state === 'full' ? <SeatBadge event={event} audience="member" /> : null}
          {state === 'organiser' || state === 'draft' ? <SeatBadge event={event} audience="organiser" /> : null}
        </div>

        {state === 'open' ? (
          <p className="text-sm text-secondary">
            <span className="font-semibold tabular text-primary">
              {event.ticketPrice > 0 ? money(event.ticketPrice) : 'Free'}
            </span>
            {event.ticketPrice > 0 ? ' per person. Guests pay the same ticket price.' : '. Guests are welcome.'}
          </p>
        ) : null}

        {state === 'past' ? (
          album ? (
            <ButtonLink href={`/gallery/${album.slug}`} className="min-h-11 w-full">
              <Images className="size-4" aria-hidden="true" />
              See photos
            </ButtonLink>
          ) : (
            <p className="text-sm text-secondary">
              Photos from the day appear here when the {office} files them.
            </p>
          )
        ) : state === 'draft' ? (
          <div className="space-y-3">
            <p className="text-sm text-secondary">Draft — only organisers can see this. Publish it from Manage events.</p>
            <ButtonLink href={attendee} variant="secondary" className="min-h-11 w-full">
              Open in Manage events
            </ButtonLink>
          </div>
        ) : state === 'organiser' ? (
          <div className="space-y-3">
            <p className="text-sm text-secondary">You are viewing as an organiser.</p>
            <ButtonLink href={attendee} variant="secondary" className="min-h-11 w-full">
              Open the attendee list
            </ButtonLink>
          </div>
        ) : (
          <RegisterForm
            eventTitle={event.title}
            mode={registration ? 'registered' : seats.full ? 'full' : 'register'}
            isPaid={event.ticketPrice > 0}
            priceLabel={event.ticketPrice > 0 ? money(event.ticketPrice) : 'Free'}
            guestOptions={guestOptions}
            registration={registration}
            seatsLeft={seats.left}
            capacity={event.capacity}
            supportEmail={pack.copy.supportEmail ?? null}
            officeName={office}
            ticketHref={ticketHref}
            calendar={calendar}
          />
        )}
      </CardBody>
    </Card>
  );

  const sticky =
    state === 'open' ? (
      <ButtonLink href="#register">{event.ticketPrice > 0 ? 'Hold my seat' : 'Register'}</ButtonLink>
    ) : state === 'full' ? (
      <ButtonLink href="#register" variant="secondary">
        Full — ask for a seat
      </ButtonLink>
    ) : state === 'registered' ? (
      <ButtonLink href={ticketHref}>
        <Ticket className="size-4" aria-hidden="true" />
        Show my ticket
      </ButtonLink>
    ) : state === 'past' && album ? (
      <ButtonLink href={`/gallery/${album.slug}`}>
        <Images className="size-4" aria-hidden="true" />
        See photos
      </ButtonLink>
    ) : state === 'organiser' ? (
      <ButtonLink href={attendee} variant="secondary">
        Open the attendee list
      </ButtonLink>
    ) : null;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Events', href: '/events' }, { label: event.title }]} />

      {hero}

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_22rem]">
        <aside
          aria-label={state === 'past' ? 'After the event' : 'Registration'}
          className="order-first min-w-0 space-y-4 lg:order-none lg:col-start-2 lg:row-start-1 lg:sticky lg:top-20 lg:self-start"
        >
          {actionCard}

          {canManage && state !== 'organiser' && state !== 'draft' ? (
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-line bg-surface-sunken px-4 py-2 text-sm">
              <span className="text-secondary">You are viewing as an organiser.</span>
              <Link href={attendee} className="link inline-flex min-h-11 items-center">
                Open the attendee list
              </Link>
            </div>
          ) : null}

          {isPast ? null : (
            <p className="flex items-start gap-2 px-1 text-xs text-secondary">
              <Clock className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
              <span>
                All times are IST. Registration lists are visible to the {office} and to the department organising the
                event, and to nobody else.
              </span>
            </p>
          )}
        </aside>

        <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-1">
          {paragraphs.length ? (
            <Section title="About this event">
              <div className="max-w-prose space-y-3 text-md leading-relaxed text-secondary">
                {paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </Section>
          ) : null}

          {isPast && album ? (
            <Section
              title="Photos from the day"
              actions={
                <Link href={`/gallery/${album.slug}`} className="link inline-flex min-h-11 items-center text-sm">
                  See all {album.photoCount.toLocaleString('en-IN')}
                </Link>
              }
            >
              {albumPhotos.length > 0 ? (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {albumPhotos.slice(0, 6).map((p) => (
                    <li key={p.id} className="min-w-0">
                      <Link href={`/gallery/${album.slug}`} aria-label={p.caption ?? `Photo from ${album.title}`}>
                        <MediaFrame src={p.url} alt={p.caption ?? ''} aspect="1/1" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="max-w-md">
                  <AlbumCard
                    album={album}
                    coverSrc={albumCover}
                    href={`/gallery/${album.slug}`}
                    locale={pack.locale}
                    credit={`Taken ${formatDate(album.takenOn, { locale, timeZone })}`}
                  />
                </div>
              )}
            </Section>
          ) : null}

          {isPast ? null : (
            <Section title="Getting there">
              <Card>
                <CardBody className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="flex min-w-0 items-start gap-2 text-sm">
                      {online ? (
                        <Video className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                      ) : (
                        <MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                      )}
                      <span className="min-w-0">
                        <span className="block font-medium">{where}</span>
                        {!online && directions && pack.copy.addressLines.length > 0 && !where.includes(',') ? (
                          <span className="block text-secondary">{pack.copy.addressLines.join(', ')}</span>
                        ) : null}
                      </span>
                    </p>
                    {directions ? (
                      <ButtonLink
                        href={directions}
                        target="_blank"
                        rel="noreferrer noopener"
                        variant="secondary"
                        className="min-h-11"
                      >
                        Get directions
                        <span className="sr-only"> (opens Google Maps in a new tab)</span>
                      </ButtonLink>
                    ) : null}
                  </div>

                  {event.published ? (
                    <div className="space-y-2 border-t border-line pt-4">
                      <p className="text-sm font-medium">Tell your batch</p>
                      <ShareActions
                        url={url}
                        whatsappHref={whatsappShareUrl(eventShareText(pack, event), url)}
                        title={event.title}
                        size="sm"
                      />
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            </Section>
          )}
        </div>
      </div>

      {sticky ? <StickyActionBar label="Event action">{sticky}</StickyActionBar> : null}
    </div>
  );
}

