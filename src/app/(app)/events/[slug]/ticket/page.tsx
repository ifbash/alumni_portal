import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CalendarPlus, Images, Lock, MapPin } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap, can } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getEventBySlug, getEventRegistrations, getEvents } from '@/lib/data/repo';
import { getAlbums } from '@/lib/data/content';
import { Breadcrumbs, ButtonLink, DetailRow, Disclosure } from '@/components/ui';
import { Crest } from '@/components/brand/Crest';
import { Logo } from '@/components/brand/Logo';
import { formatCurrency, formatDate } from '@/lib/format';
import { isOnlineVenue, seatStatus } from '@/lib/event-status';
import { directionsUrl } from '@/lib/maps';
import { mailto } from '@/lib/mailto';
import { siteOrigin } from '@/lib/share';
import { calendarLinks, whenLine } from '../../calendar';
import { ShowAtDesk, TicketCode } from './TicketCode';

/**
 * The viewer's own pass.
 *
 * Eligibility is decided upstream by `getEventBySlug()` — an alumni-only
 * event is not addressable by a student and an unpublished draft needs
 * `event.create.any` — so a 404 here is the same authorisation outcome as
 * on the event page itself.
 *
 * Not being registered is *not* one of those outcomes. Somebody who taps
 * a ticket link on WhatsApp before they have signed up has made an
 * ordinary mistake, and the answer to it is the way to register, not a
 * dead end.
 *
 * The pass is built to fit one phone screen: the college on the band, the
 * event, the holder, and the code, with the rest behind "Details".
 */

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
    title: `Your ticket · ${event.title}`,
    description: `Your pass for ${event.title}.`,
  };
}

export default async function EventTicketPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
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

  const locale = pack.locale.locale;
  const timeZone = pack.locale.timeZone;
  const currency = pack.locale.currency;
  const timing = { locale, timeZone };
  const money = (n: number) => formatCurrency(n, { locale, currency });
  const office = pack.copy.officeName;

  // Past-or-upcoming comes from the repo's own clock rather than a second
  // one invented here, so this page and the event page cannot disagree
  // about whether the reunion has already happened.
  const isPast = getEvents(session, { when: 'past', includeDrafts: canManage }).some(
    (e) => e.id === event.id,
  );

  // The viewer's own row and nothing else. `getEventRegistrations` returns
  // the whole roster — the filter to `session.memberId` is what makes this
  // a ticket rather than an attendee list.
  const registration =
    getEventRegistrations(event.id).find((r) => r.memberId === session.memberId) ?? null;

  const online = isOnlineVenue(event.venue);
  const eventHref = `/events/${event.slug}`;
  const origin = await siteOrigin();
  const calendar = calendarLinks(event, {
    url: `${origin}${eventHref}`,
    addressLines: pack.copy.addressLines,
    timeZone,
  });
  const directions = isPast ? null : directionsUrl(event.venue, pack.copy.addressLines);
  const album = pack.features.gallery ? (getAlbums().find((a) => a.eventSlug === event.slug) ?? null) : null;
  const guests = registration?.guests ?? 0;

  // ---------------------------------------------------------------
  // What sits in the pass below the perforation
  // ---------------------------------------------------------------

  let stub: ReactNode;
  let actions: ReactNode = null;
  let note: ReactNode = null;

  if (registration && !isPast) {
    stub = (
      <>
        {/* The desk finds people by name and batch first, so they lead. */}
        <div className="flex items-end justify-between gap-4">
          <p className="min-w-0">
            <span className="block truncate font-display text-xl font-semibold">{registration.memberName}</span>
            {registration.batchYear ? (
              <span className="block text-sm text-secondary">Batch of {registration.batchYear}</span>
            ) : null}
          </p>
          {guests > 0 ? (
            <p className="shrink-0 text-right font-medium tabular">
              +{guests} guest{guests === 1 ? '' : 's'}
            </p>
          ) : null}
        </div>
        <TicketCode registrationId={registration.id} />
      </>
    );
    note = online ? (
      <p className="text-sm text-secondary">An online event, so there is no desk to show this at. Keep it for your record.</p>
    ) : (
      <p className="text-sm text-secondary">
        Show this at the registration desk. They find you by name, batch or this code. Carry a photo ID.
      </p>
    );
    actions = (
      <div className="grid grid-cols-2 gap-2 [&>*]:min-h-11">
        {online ? null : (
          <ShowAtDesk
            registrationId={registration.id}
            holderName={registration.memberName}
            holderLine={registration.batchYear ? `Batch of ${registration.batchYear}` : null}
            eventTitle={event.title}
            guests={guests}
            brand={<Logo pack={pack} variant="band" height={20} />}
            className="col-span-2 w-full"
          />
        )}
        <ButtonLink
          href={calendar.icsHref}
          download={calendar.icsFilename}
          variant="secondary"
          className={online || !directions ? 'col-span-2' : undefined}
        >
          <CalendarPlus className="size-4 shrink-0" aria-hidden="true" />
          Add to calendar
        </ButtonLink>
        {directions ? (
          <ButtonLink href={directions} target="_blank" rel="noreferrer noopener" variant="secondary">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            Directions
            <span className="sr-only"> (opens Google Maps in a new tab)</span>
          </ButtonLink>
        ) : null}
      </div>
    );
  } else if (registration && isPast) {
    const reportHref = pack.copy.supportEmail
      ? mailto(pack.copy.supportEmail, `Check-in not recorded — ${event.title}`, [
          `Registration reference: ${registration.id}`,
          'I attended, but my check-in was not recorded.',
          '',
        ])
      : null;
    stub = (
      <p className="text-sm">
        {registration.checkedInAt ? (
          <span className="font-medium">You attended on {formatDate(registration.checkedInAt, timing)}.</span>
        ) : (
          <>
            No check-in was recorded.{' '}
            {reportHref ? (
              <a href={reportHref} className="link">
                Tell the {office}
              </a>
            ) : (
              `Tell the ${office}`
            )}{' '}
            if that is wrong.
          </>
        )}
      </p>
    );
  } else if (canManage) {
    stub = <p className="text-sm font-medium">Organisers do not need a pass.</p>;
    actions = (
      <div className="grid gap-2 [&>*]:min-h-11">
        <ButtonLink href={`/admin/events/${event.id}`} variant="secondary">
          Open the attendee list
        </ButtonLink>
        {canRegister && !isPast && event.published ? (
          <ButtonLink href={`${eventHref}#register`} variant="ghost">
            Register for yourself
          </ButtonLink>
        ) : null}
      </div>
    );
  } else if (isPast) {
    stub = <p className="text-sm text-secondary">You were not registered for this event.</p>;
  } else {
    const full = seatStatus(event).full;
    stub = (
      <p className="text-sm text-secondary">
        You are not registered for this event yet. Your pass appears here when you are.
      </p>
    );
    actions = (
      <ButtonLink href={`${eventHref}#register`} variant={full ? 'secondary' : 'primary'} className="min-h-11 w-full">
        {full ? 'Full — ask for a seat' : 'Register'}
      </ButtonLink>
    );
  }

  if (isPast && album) {
    actions = (
      <ButtonLink href={`/gallery/${album.slug}`} className="min-h-11 w-full">
        <Images className="size-4 shrink-0" aria-hidden="true" />
        See photos from the day
      </ButtonLink>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Breadcrumbs items={[{ label: 'Events', href: '/events' }, { label: event.title, href: eventHref }]} />

      <article aria-labelledby="pass-title" className="overflow-hidden rounded-xl border border-line shadow-sm">
        <header className="band-surface flex min-h-14 items-center justify-between gap-3 px-4 py-2.5">
          <span className="flex min-w-0 items-center gap-2.5">
            <Crest pack={pack} size={40} />
            <Logo pack={pack} variant="band" height={20} />
          </span>
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-band-accent">Event pass</span>
        </header>

        {event.coverImage ? (
          // The event's own cover only; never a campus photo. See next.config.ts on tenant URLs.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.coverImage} alt="" className="h-16 w-full object-cover" loading="eager" />
        ) : null}

        <div className="band-exit space-y-4 bg-surface-raised px-4 py-4">
          <div>
            <h1 id="pass-title" className="font-display text-xl font-bold leading-snug">
              <Link href={eventHref} className="link-quiet">
                {event.title}
              </Link>
            </h1>
            <p className="mt-1 text-sm text-secondary">{whenLine(event, locale, timeZone)}</p>
            <p className="text-sm text-secondary">{event.venue ?? 'Venue to be announced'}</p>
          </div>

          <div aria-hidden="true" className="-mx-4 border-t border-dashed border-line-strong" />

          {stub}

          {registration ? (
            <Disclosure summary="Details" className="-mx-1">
              <dl className="divide-y divide-line">
                <DetailRow label="Reference">
                  <span className="font-mono text-xs">{registration.id}</span>
                </DetailRow>
                <DetailRow label="Registered on">{formatDate(registration.createdAt, timing)}</DetailRow>
                {registration.amountPaid > 0 ? (
                  <DetailRow label="Ticket">
                    <span className="tabular">
                      {money(registration.amountPaid * (1 + guests))}
                      {guests > 0 ? ` for ${guests + 1} people` : ''}
                    </span>
                  </DetailRow>
                ) : null}
              </dl>
            </Disclosure>
          ) : null}
        </div>
      </article>

      {note}
      {actions}

      {registration ? (
        <p className="flex items-start gap-2 text-xs text-secondary">
          <Lock className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
          <span>Only you and the organisers can see this registration.</span>
        </p>
      ) : null}
    </div>
  );
}
