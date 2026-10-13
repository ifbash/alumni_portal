import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { ArrowLeft, DoorOpen, Eye, HandHeart, ImagePlus, Send } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, canInDepartment, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getEvents, getEventRegistrations, getDepartments, getMembersForAdmin } from '@/lib/data/repo';
import { getAlbumPhotos, getAlbums } from '@/lib/data/content';
import type { EventItem } from '@/lib/data/types';
import {
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CopyButton,
  DateTile,
  DetailRow,
  MediaFrame,
} from '@/components/ui';
import { AlbumCard, SeatBadge, eventMetaLine, parseContributor } from '@/components/content';
import { daysUntil, formatCompactINR, formatCurrency, formatDate, formatDateRange, formatPercent } from '@/lib/format';
import { seatStatus } from '@/lib/event-status';
import { eventShareText } from '@/lib/share-text';
import { siteOrigin } from '@/lib/share';
import { CheckInPanel, EventActionsMenu, type EventMenuItem } from './CheckInPanel';

export const metadata = { title: 'Event · Staff console' };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  if (!resolved.brand.pack.features.events) notFound();

  const wide = can(session, 'event.create.any');
  const scoped = can(session, 'event.create.department');
  if (!wide && !scoped) requireCap(session, 'event.create.department');

  const { id } = await params;

  const all = getEvents(session, { when: 'all', includeDrafts: true });
  const event = all.find((e) => e.id === id || e.slug === id);
  if (!event) notFound();

  const isPast = getEvents(session, { when: 'past', includeDrafts: true }).some((e) => e.id === event.id);
  const manageable = wide || canInDepartment(session, 'event.create.department', event.departmentCode);
  // The roster - names, batch years, what each person paid - belongs to the
  // people who run the event. An HOD of another branch gets the same 404 as
  // for an event that does not exist. A college-wide event (no department)
  // stays open to every HOD, as before.
  if (!manageable && event.departmentCode !== null) notFound();
  const checkInAllowed = can(session, 'event.checkin');

  const pack = resolved.brand.pack;
  const locale = pack.locale;
  const timing = { locale: locale.locale, timeZone: locale.timeZone, currency: locale.currency };

  const departments = getDepartments();
  const deptName = event.departmentCode
    ? (departments.find((d) => d.code === event.departmentCode)?.name ?? event.departmentCode)
    : 'All branches';

  const registrations = getEventRegistrations(event.id);
  const guests = registrations.reduce((n, r) => n + r.guests, 0);
  const collected = registrations.reduce((n, r) => n + r.amountPaid, 0);
  const checkedIn = registrations.filter((r) => r.checkedInAt).length;
  const expected = event.registeredCount * event.ticketPrice;

  // Roll numbers are a `privileged` projection field, and the check-in desk
  // is exactly where they earn their place: the fixture contains two people
  // with the same name in the same branch and year, and a name alone cannot
  // separate them at a queue. Viewers below that tier get name and batch.
  const showRoll = can(session, 'directory.view.contact');
  const rollById = new Map<string, string | null>();
  if (showRoll && registrations.length) {
    const wanted = new Set(registrations.map((r) => r.memberId));
    for (const m of getMembersForAdmin({ perPage: 5000 }).items) {
      if (wanted.has(m.id)) rollById.set(m.id, m.rollNumber ?? null);
    }
  }

  // Dates are formatted here, on the server, in the college's time zone,
  // so the client desk renders exactly the strings the server sent.
  const rows = registrations.map((r) => ({
    id: r.id,
    memberName: r.memberName,
    batchYear: r.batchYear,
    rollNumber: rollById.get(r.memberId) ?? null,
    guests: r.guests,
    amountLabel: r.amountPaid > 0 ? formatCurrency(r.amountPaid, timing) : 'Free',
    checkedIn: Boolean(r.checkedInAt),
    checkedInLabel: r.checkedInAt ? formatDate(r.checkedInAt, timing) : null,
    registeredOn: formatDate(r.createdAt, timing),
  }));

  const sp = await searchParams;
  const upcoming = !isPast && event.published;
  const door = upcoming && one(sp.mode) === 'door';

  const origin = await siteOrigin();
  const shareText = `${eventShareText(pack, event)} ${origin}/events/${event.slug}`;
  const canInvite =
    can(session, 'comms.send.all') || can(session, 'comms.send.segment') || can(session, 'comms.send.department');
  const canAlbum = manageable && pack.features.gallery && can(session, 'event.create.any');
  const officeName = pack.copy.officeName;

  const rosterNote =
    upcoming && registrations.length < event.registeredCount
      ? `The roster lists ${registrations.length.toLocaleString('en-IN')} of ${event.registeredCount.toLocaleString('en-IN')} registrations.`
      : null;

  const desk = (
    <CheckInPanel
      eventTitle={event.title}
      rows={rows}
      canCheckIn={checkInAllowed}
      showRoll={showRoll}
      isPast={isPast}
      door={door}
      rosterNote={rosterNote}
      officeName={officeName}
      collapsed={isPast}
    />
  );

  // ---------------------------------------------------------------
  // Door mode: the desk and nothing else.
  // ---------------------------------------------------------------

  if (door) {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold leading-snug">{event.title}</h1>
            <p className="truncate text-sm text-secondary">{eventMetaLine(event, locale)}</p>
          </div>
          <ButtonLink href={`/admin/events/${event.id}`} variant="secondary" size="sm" className="min-h-11 shrink-0 sm:min-h-0">
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Leave door mode</span>
            <span className="sm:hidden">Exit</span>
          </ButtonLink>
        </div>
        {desk}
      </div>
    );
  }

  // ---------------------------------------------------------------
  // The event page
  // ---------------------------------------------------------------

  const seats = seatStatus(event);
  const days = daysUntil(event.startsAt, locale.timeZone);

  const status = !event.published ? (
    <Badge tone="neutral">Draft</Badge>
  ) : isPast ? (
    <Badge tone="neutral">Finished</Badge>
  ) : seats.full ? (
    <SeatBadge event={event} audience="organiser" />
  ) : days === 0 ? (
    <Badge tone="brand" dot>
      Today
    </Badge>
  ) : (
    <Badge tone="brand" dot>
      Registration open
    </Badge>
  );

  const seatLine = seats.capped
    ? seats.full
      ? null
      : `${event.registeredCount.toLocaleString('en-IN')} of ${seats.capacity!.toLocaleString('en-IN')} seats taken`
    : `${event.registeredCount.toLocaleString('en-IN')} registered · no seat limit`;

  const inviteHref = inviteLink(event, can(session, 'directory.search.students'));
  const album = getAlbums({ includeDrafts: true }).find((a) => a.eventSlug === event.slug) ?? null;

  const menu: EventMenuItem[] = canAlbum && !album
    ? [{ kind: 'link', label: 'Create album', href: `/admin/gallery/new?event=${event.slug}`, icon: 'album' }]
    : [];
  if (isPast && event.published) menu.push({ kind: 'copy', label: 'Copy for WhatsApp', text: shareText });

  const money = (n: number) => formatCompactINR(n);

  const details = (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="text-md">
          Details
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-3 pt-3">
        {event.description ? <p className="text-sm leading-relaxed text-secondary">{event.description}</p> : null}
        <dl className="divide-y divide-line">
          <DetailRow className="grid-cols-[7rem_1fr]" label="When">
            {formatDateRange(event.startsAt, event.endsAt, timing)}
          </DetailRow>
          <DetailRow className="grid-cols-[7rem_1fr]" label="Where">
            {event.venue ?? 'Not set'}
          </DetailRow>
          <DetailRow className="grid-cols-[7rem_1fr]" label="Branch">
            {deptName}
          </DetailRow>
          <DetailRow className="grid-cols-[7rem_1fr]" label="Audience">
            {event.alumniOnly ? 'Alumni only' : event.studentEligible ? 'Alumni and final-year students' : 'Alumni'}
          </DetailRow>
          <DetailRow className="grid-cols-[7rem_1fr]" label="Ticket">
            {event.ticketPrice > 0 ? formatCurrency(event.ticketPrice, timing) : 'Free'}
          </DetailRow>
          {guests > 0 ? (
            <DetailRow className="grid-cols-[7rem_1fr]" label="Guests">
              <span className="tabular">{guests.toLocaleString('en-IN')}</span> on the roster
            </DetailRow>
          ) : null}
          {event.ticketPrice > 0 ? (
            <>
              <DetailRow className="grid-cols-[7rem_1fr]" label="Collected">
                <span className="tabular">{money(collected)}</span>
                <span className="block text-xs font-normal text-secondary">From the roster</span>
              </DetailRow>
              <DetailRow className="grid-cols-[7rem_1fr]" label="At full list">
                <span className="tabular">{money(expected)}</span>
                <span className="block text-xs font-normal text-secondary">
                  {event.registeredCount.toLocaleString('en-IN')} registrations
                </span>
              </DetailRow>
            </>
          ) : null}
        </dl>
      </CardBody>
    </Card>
  );

  const recap = isPast ? (
    <Card>
      <CardHeader>
        <CardTitle as="h2">How it went</CardTitle>
      </CardHeader>
      <CardBody className={album ? 'grid gap-6 sm:grid-cols-[minmax(0,1fr)_13rem]' : 'space-y-6'}>
        <div className="min-w-0 space-y-6">
          {registrations.length ? (
            <dl className="grid grid-cols-3 gap-4">
              <div>
                <dt className="text-sm text-secondary">Arrived</dt>
                <dd className="mt-1">
                  <span className="font-display text-display-xs font-bold tabular">{checkedIn}</span>{' '}
                  <span className="text-sm text-secondary">
                    of {registrations.length} · {formatPercent(checkedIn / registrations.length)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-secondary">Did not arrive</dt>
                <dd className="mt-1 font-display text-display-xs font-bold tabular">{registrations.length - checkedIn}</dd>
              </div>
              <div>
                <dt className="text-sm text-secondary">Guests</dt>
                <dd className="mt-1 font-display text-display-xs font-bold tabular">{guests}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-secondary">Nobody was on the roster for this event.</p>
          )}

          <div className="flex flex-wrap gap-2">
            {canInvite ? (
              <ButtonLink href={`/admin/comms/new?event=${event.slug}&channel=whatsapp-draft`}>
                <HandHeart className="size-4" aria-hidden="true" />
                Thank the people who came
              </ButtonLink>
            ) : null}
            {!album && canAlbum ? (
              <ButtonLink href={`/admin/gallery/new?event=${event.slug}`} variant="secondary">
                <ImagePlus className="size-4" aria-hidden="true" />
                Create the album for this event
              </ButtonLink>
            ) : null}
          </div>
        </div>
        {album ? (
          <div className="min-w-0">
            <AlbumCard
              album={album}
              coverSrc={album.coverImage ?? getAlbumPhotos(album.id).find((p) => p.url)?.url ?? null}
              href={album.published ? `/gallery/${album.slug}` : '/admin/gallery?view=review'}
              locale={locale}
              credit={albumCredit(album.contributedBy, officeName)}
              state={album.published ? undefined : <Badge tone="neutral">Not published</Badge>}
            />
          </div>
        ) : null}

      </CardBody>
    </Card>
  ) : null;

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <Breadcrumbs
          items={[
            { label: 'Staff console', href: '/admin' },
            { label: 'Events', href: '/admin/events' },
            { label: event.title },
          ]}
        />
        {event.coverImage ? <MediaFrame src={event.coverImage} alt="" aspect="21/9" loading="eager" /> : null}
        <div className="flex items-start gap-4">
          {event.coverImage ? null : (
            <DateTile iso={event.startsAt} locale={locale.locale} timeZone={locale.timeZone} size="lg" />
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-fg">Events</p>
            <h1 className="font-display text-display-xs font-bold">{event.title}</h1>
            <p className="text-sm text-secondary">{eventMetaLine(event, locale)}</p>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {status}
              {event.alumniOnly ? <Badge tone="accent">Alumni only</Badge> : null}
              {seatLine && event.published ? <span className="text-sm text-secondary">{seatLine}</span> : null}
            </div>
          </div>
        </div>

        {event.published ? (
          <div className="flex flex-wrap items-center gap-2">
            {upcoming && checkInAllowed ? (
              <ButtonLink href={`/admin/events/${event.id}?mode=door`} className="min-h-11 sm:min-h-0">
                <DoorOpen className="size-4" aria-hidden="true" />
                Door mode
              </ButtonLink>
            ) : null}
            {upcoming && canInvite ? (
              <ButtonLink href={inviteHref} variant="secondary" className="min-h-11 sm:min-h-0">
                <Send className="size-4" aria-hidden="true" />
                Invite people
              </ButtonLink>
            ) : null}
            {upcoming ? <CopyButton text={shareText} label="Copy for WhatsApp" copiedLabel="Copied for WhatsApp" /> : null}
            <ButtonLink href={`/events/${event.slug}`} variant="ghost" className="min-h-11 sm:min-h-0">
              <Eye className="size-4" aria-hidden="true" />
              View as member
            </ButtonLink>
            {menu.length ? <EventActionsMenu label="More actions for this event" items={menu} /> : null}
          </div>
        ) : (
          <p className="text-sm text-secondary">
            Members cannot see this event until it is published.{' '}
            {menu.length ? (
              <Link href={`/admin/gallery/new?event=${event.slug}`} className="link">
                Create its album
              </Link>
            ) : null}
          </p>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          {recap}
          {desk}
        </div>
        <aside aria-label="Event details" className="min-w-0">
          {details}
        </aside>
      </div>
    </div>
  );
}

/** The composer, with the audience this event is for. */
function inviteLink(e: EventItem, canReachStudents: boolean): string {
  const qs = new URLSearchParams({ event: e.slug });
  if (e.alumniOnly || !e.studentEligible || !canReachStudents) qs.set('cohort', 'alumni');
  if (e.departmentCode) qs.set('department', e.departmentCode);
  return `/admin/comms/new?${qs.toString()}`;
}

function albumCredit(contributedBy: string | null, officeName: string): string {
  const who = parseContributor(contributedBy);
  if (who) return `Sent in by ${who.name.split(/\s+/)[0]} · ${who.branch} ’${String(who.year).slice(-2)}`;
  return contributedBy ? `By ${contributedBy}` : `By the ${officeName}`;
}
