import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Clock, Images, Info, MapPin, Ticket, Users, Video } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { require as requireCap, can } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDepartments, getEventBySlug, getEvents } from '@/lib/data/repo';
import { getAlbumPhotos, getAlbums } from '@/lib/data/content';
import { getGroupBySlug } from '@/lib/data/groups';
import { eventKindLabel } from '@/lib/community';
import {
  Alert,
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
import { OutlineNumeral } from '@/app/(app)/directory/batch/OutlineNumeral';
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
  // An event states how it is held; older rows that do not are read from the venue, as before.
  const online = event.mode ? event.mode === 'online' : isOnlineVenue(event.venue);
  const hybrid = event.mode === 'hybrid';
  const heldOnline = online || hybrid;
  const group = event.groupSlug && pack.features.groups ? getGroupBySlug(session, event.groupSlug) : null;
  const batchPage =
    event.kind === 'reunion' && event.batchYear && pack.features.directory ? `/directory/batch/${event.batchYear}` : null;
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

  type State = 'past' | 'draft' | 'proposal' | 'organiser' | 'registered' | 'full' | 'open';
  // A proposal is not a draft the organisers are holding: it is something a
  // member sent in and is waiting to hear about.
  const proposal = !canManage && event.reviewState !== 'approved';
  const state: State = isPast
    ? 'past'
    : proposal
      ? 'proposal'
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
      {event.kind !== 'other' ? <BandChip>{eventKindLabel(event.kind)}</BandChip> : null}
      {online ? <BandChip>Online</BandChip> : hybrid ? <BandChip>In person and online</BandChip> : null}
    </>
  );

  // A cover photo shows at lg behind the scrim, text held to its solid
  // zone, and as a plain strip above the text on phones: the same contract
  // as `PageBand`. Without one the band carries the aurora and a large date
  // leaf, which is the main case; no tenant is promised a photo.
  const onPhoto = heroImage ? 'lg:text-band-fg' : '';
  const hero = (
    <section
      aria-labelledby="event-title"
      className="band-surface grain relative isolate -mx-4 overflow-hidden sm:mx-0 sm:rounded-xl sm:shadow-lg"
    >
      {heroImage ? null : <div className="aurora" aria-hidden="true" />}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] hidden rounded-[inherit] ring-1 ring-inset ring-[color-mix(in_srgb,var(--band-fg)_16%,transparent)] sm:block"
      />
      {heroImage ? (
        <>
          {/* Tenant-supplied URLs; see next.config.ts. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImage}
            alt=""
            decoding="async"
            className="absolute inset-0 -z-10 hidden size-full object-cover lg:block"
          />
          <div aria-hidden="true" className="scrim-hero absolute inset-0 -z-10 hidden lg:block" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroImage} alt="" decoding="async" className="block aspect-[16/9] w-full object-cover lg:hidden" />
        </>
      ) : null}

      <div
        className={`relative z-[2] flex flex-col gap-5 px-5 py-6 sm:px-8 lg:flex-row lg:gap-8 lg:py-10 ${
          heroImage ? 'lg:min-h-[22rem] lg:items-end' : 'lg:items-center'
        }`}
      >
        <HeroDate iso={event.startsAt} locale={locale} timeZone={timeZone} />
        <div className={`min-w-0 flex-1 ${heroImage ? 'lg:max-w-[60%]' : 'lg:max-w-3xl'}`}>
          <p className={`eyebrow max-w-full text-xs text-band-accent ${onPhoto}`}>{eyebrow}</p>
          {/* Plain string: tailwind-merge would drop the display size beside a colour. */}
          <h1
            id="event-title"
            className="mt-2 font-display text-display-md font-bold tracking-tight text-band-fg [text-wrap:balance]"
          >
            {event.title}
          </h1>
          <ul className={`mt-4 space-y-1.5 text-md text-band-muted ${onPhoto}`}>
            <li className="flex items-start gap-2.5">
              <Clock className="mt-1 size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0">{when}</span>
            </li>
            <li className="flex items-start gap-2.5">
              {online ? (
                <Video className="mt-1 size-4 shrink-0" aria-hidden="true" />
              ) : (
                <MapPin className="mt-1 size-4 shrink-0" aria-hidden="true" />
              )}
              <span className="min-w-0">{where}</span>
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">{chips}</div>
        </div>
        {/* The month, outlined, fills the empty right of a band with no photo. */}
        {heroImage ? null : (
          <div className="min-w-0 lg:ml-auto">
            <OutlineNumeral>
              {new Intl.DateTimeFormat(locale, { month: 'short', timeZone }).format(new Date(event.startsAt)).toUpperCase()}
            </OutlineNumeral>
          </div>
        )}
      </div>
    </section>
  );

  // ---------------------------------------------------------------
  // The one action
  // ---------------------------------------------------------------

  const cardTitle: Record<State, string> = {
    past: pastLine,
    draft: 'Draft',
    proposal: 'Your proposal',
    organiser: 'Organiser view',
    registered: 'You are going',
    full: 'Register',
    open: 'Register',
  };

  const actionCard = (
    <Card id="register" className="ring-hairline scroll-mt-20 shadow-lg">
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">{cardTitle[state]}</h2>
          {state === 'open' || state === 'full' ? <SeatBadge event={event} audience="member" /> : null}
          {state === 'organiser' || state === 'draft' ? <SeatBadge event={event} audience="organiser" /> : null}
        </div>

        {/* The bar repeats what the badge says in words, so it is decoration. */}
        {seats.capped && (state === 'open' || state === 'full' || state === 'organiser') ? (
          <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-chart-track">
            <div
              className={`h-full rounded-full ${seats.ratio >= 0.9 ? 'bg-warning' : 'bg-chart-bar'}`}
              style={{ width: `${Math.min(100, Math.max(4, Math.round(seats.ratio * 100)))}%` }}
            />
          </div>
        ) : null}

        {state === 'open' ? (
          <div className="flex items-baseline gap-2">
            <p className="font-display text-display-xs font-bold tabular">
              {event.ticketPrice > 0 ? money(event.ticketPrice) : 'Free'}
            </p>
            <p className="min-w-0 text-sm text-secondary">
              {event.ticketPrice > 0 ? 'per person. Guests pay the same ticket price.' : 'Guests are welcome.'}
            </p>
          </div>
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
        ) : state === 'proposal' ? (
          <p className="text-sm text-secondary">
            {event.reviewState === 'pending'
              ? `The ${office} will decide, and you are told either way. Until then only you and the people who run events can see it.`
              : 'This was not approved. The note below says why; you can put a changed version forward.'}
          </p>
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

      {proposal ? (
        <Alert
          tone={event.reviewState === 'rejected' ? 'warning' : 'neutral'}
          icon={<Info className="size-4 text-brand-fg" />}
          title={event.reviewState === 'rejected' ? 'This proposal was not approved' : `Waiting for the ${office}`}
        >
          {event.reviewState === 'rejected' && event.moderationNote ? (
            <p>{event.moderationNote}</p>
          ) : (
            <p>You put this forward. It appears for other members once it is approved.</p>
          )}
        </Alert>
      ) : null}

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
          {group || batchPage ? (
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              {group ? (
                <li>
                  <Link href={`/groups/${group.slug}`} className="link inline-flex min-h-11 items-center gap-2">
                    <Users className="size-4 text-muted" aria-hidden="true" />
                    Hosted by {group.name}
                  </Link>
                </li>
              ) : null}
              {batchPage ? (
                <li>
                  <Link href={batchPage} className="link inline-flex min-h-11 items-center gap-2">
                    <Users className="size-4 text-muted" aria-hidden="true" />
                    See the batch of {event.batchYear}
                  </Link>
                </li>
              ) : null}
            </ul>
          ) : null}

          {paragraphs.length ? (
            <Section title="About this event">
              <div className="max-w-prose space-y-4 text-md leading-relaxed text-secondary">
                {paragraphs.map((p, i) => (
                  <p key={i} className={i === 0 ? 'text-lg leading-relaxed text-primary' : undefined}>
                    {p}
                  </p>
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

                  {heldOnline ? (
                    <div className="space-y-2 border-t border-line pt-4">
                      <p className="text-sm font-medium">Joining online</p>
                      {event.meetingUrl ? (
                        <ButtonLink href={event.meetingUrl} target="_blank" rel="noreferrer noopener" className="min-h-11">
                          <Video className="size-4" aria-hidden="true" />
                          Open the meeting link
                          <span className="sr-only"> (opens in a new tab)</span>
                        </ButtonLink>
                      ) : (
                        <p className="text-sm text-secondary">The link is shown here once you have registered.</p>
                      )}
                    </div>
                  ) : null}

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


/**
 * The date as a large leaf on the band. Decorative: the line beside the
 * title states it in words. Set in the band's own colours, which are the
 * same in both themes, so it needs no dark variant.
 */
function HeroDate({ iso, locale, timeZone }: { iso: string; locale: string; timeZone: string }) {
  const d = new Date(iso);
  const part = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...opts, timeZone }).format(d);
  return (
    <span
      aria-hidden="true"
      className="block w-24 shrink-0 self-start rounded-xl border border-band-rule px-1 py-3 text-center sm:w-28 lg:self-auto"
    >
      <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-band-accent">
        {part({ month: 'short' })}
      </span>
      <span className="block font-display text-6xl font-bold leading-none tabular text-band-fg sm:text-7xl">
        {part({ day: 'numeric' })}
      </span>
      <span className="mt-1 block text-xs text-band-muted">{part({ weekday: 'short' })}</span>
    </span>
  );
}
