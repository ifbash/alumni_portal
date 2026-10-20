import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { CalendarDays, CalendarPlus, ChevronRight, ClipboardList, DoorOpen, Send } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, canInDepartment, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getEvents, getDepartments, getEventRegistrations } from '@/lib/data/repo';
import type { EventItem } from '@/lib/data/types';
import type { LocaleSpec } from '@/lib/branding/pack';
import {
  Badge,
  ButtonLink,
  Card,
  CopyButton,
  DateTile,
  EmptyState,
  MediaFrame,
  PageHeader,
  SummaryLine,
  Tabs,
  TrustChip,
} from '@/components/ui';
import { EventSummary, SeatBadge, eventMetaLine } from '@/components/content';
import { daysUntil } from '@/lib/format';
import { isOnlineVenue, seatStatus } from '@/lib/event-status';
import { eventShareText } from '@/lib/share-text';
import { siteOrigin } from '@/lib/share';
import { EventActionsMenu, type EventMenuItem } from './[id]/CheckInPanel';

export const metadata = { title: 'Events · Staff console' };

type View = 'upcoming' | 'past' | 'drafts' | 'mine';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { brand } = resolved;
  if (!brand.pack.features.events) notFound();

  // Two capabilities reach this console. `event.create.any` is the alumni
  // cell and the college admin; `event.create.department` is an HOD, and
  // everything they can do here is bounded by their own branch.
  const wide = can(session, 'event.create.any');
  const scoped = can(session, 'event.create.department');
  // Either capability opens the console; holding neither is a 403 from the
  // guard rather than a redirect, because the nav should never have shown it.
  if (!wide && !scoped) requireCap(session, 'event.create.department');

  const params = await searchParams;
  const requested = one(params.view);
  const view: View =
    requested === 'past' || requested === 'drafts' || (requested === 'mine' && !wide) ? requested : 'upcoming';

  const upcoming = getEvents(session, { when: 'upcoming', includeDrafts: true }).filter((e) => e.published);
  const past = getEvents(session, { when: 'past', includeDrafts: true }).filter((e) => e.published);
  // `getEvents` only surfaces unpublished rows to `event.create.any`, so an
  // HOD never sees another department's half-written draft.
  const drafts = wide ? getEvents(session, { when: 'all', includeDrafts: true }).filter((e) => !e.published) : [];

  const pack = brand.pack;
  const locale = pack.locale;
  const tz = locale.timeZone;

  const departments = getDepartments();
  const myDepartment = session.roles.find((r) => r.role === 'hod')?.departmentId ?? session.departmentId;
  const myDepartmentCode = !wide ? (departments.find((d) => d.code === myDepartment)?.code ?? myDepartment) : null;
  const mine = myDepartmentCode ? [...upcoming, ...past].filter((e) => e.departmentCode === myDepartmentCode) : [];

  const rows = view === 'past' ? past : view === 'drafts' ? drafts : view === 'mine' ? mine : upcoming;

  const manageable = (e: EventItem) => wide || canInDepartment(session, 'event.create.department', e.departmentCode);

  const origin = await siteOrigin();
  const shareText = (e: EventItem) => `${eventShareText(pack, e)} ${origin}/events/${e.slug}`;
  const canInvite =
    can(session, 'comms.send.all') || can(session, 'comms.send.segment') || can(session, 'comms.send.department');
  const canReachStudents = can(session, 'directory.search.students');
  const canCheckIn = can(session, 'event.checkin');
  const canAlbum = pack.features.gallery && can(session, 'event.create.any');
  const isPast = (e: EventItem) => past.some((p) => p.id === e.id);

  const menuFor = (e: EventItem): EventMenuItem[] => {
    const items: EventMenuItem[] = [
      { kind: 'link', label: 'Open roster', href: `/admin/events/${e.id}`, icon: 'roster' },
    ];
    if (e.published) {
      items.push({ kind: 'link', label: 'View as member', href: `/events/${e.slug}`, icon: 'member' });
      items.push({ kind: 'copy', label: 'Copy for WhatsApp', text: shareText(e) });
      if (canInvite && !isPast(e)) {
        items.push({ kind: 'link', label: 'Invite people', href: inviteLink(e, canReachStudents), icon: 'invite' });
      }
    }
    if (canAlbum && manageable(e)) {
      items.push({ kind: 'link', label: 'Create album', href: `/admin/gallery/new?event=${e.slug}`, icon: 'album' });
    }
    return items;
  };

  // ---------------------------------------------------------------
  // Up next, and what needs attention
  // ---------------------------------------------------------------

  const pool = wide ? upcoming : upcoming.filter(manageable);
  const next = pool[0] ?? upcoming[0] ?? null;

  // The event in the Up next card already shows its seats, so it is not repeated here.
  const attention = pool.filter((e) => e.id !== next?.id).flatMap((e) => {
    const s = seatStatus(e);
    const d = daysUntil(e.startsAt, tz);
    // An online session is right to have no cap; a hall is not.
    if (!s.capped && d >= 0 && d < 7 && !isOnlineVenue(e.venue)) {
      return [{ event: e, chip: <Badge tone="warning">No seat limit</Badge>, line: dayWords(d) }];
    }
    if (s.capped && s.ratio >= 0.9) {
      return [
        {
          event: e,
          chip: <SeatBadge event={e} audience="organiser" />,
          line: s.full
            ? dayWords(d)
            : `${e.registeredCount.toLocaleString('en-IN')} of ${s.capacity!.toLocaleString('en-IN')} taken`,
        },
      ];
    }
    return [];
  });

  const tabs = [
    { label: 'Upcoming', href: '/admin/events', count: upcoming.length, active: view === 'upcoming' },
    ...(myDepartmentCode
      ? [{ label: 'My branch', href: '/admin/events?view=mine', count: mine.length, active: view === 'mine' }]
      : []),
    { label: 'Past', href: '/admin/events?view=past', count: past.length, active: view === 'past' },
    ...(wide
      ? [{ label: 'Drafts', href: '/admin/events?view=drafts', count: drafts.length, active: view === 'drafts' }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Events"
        description="Reunions, branch sessions and workshops, and who is coming."
        meta={
          myDepartmentCode ? (
            <TrustChip icon={<CalendarDays />}>
              You manage {myDepartmentCode} events. College-wide events are run by the {pack.copy.officeName}.
            </TrustChip>
          ) : undefined
        }
        actions={
          <ButtonLink href="/admin/events/new">
            <CalendarPlus className="size-4" aria-hidden="true" />
            New event
          </ButtonLink>
        }
      />

      <SummaryLine
        items={[
          { value: upcoming.length, label: 'upcoming', href: '/admin/events' },
          {
            value: upcoming.reduce((n, e) => n + e.registeredCount, 0).toLocaleString('en-IN'),
            label: 'registered across them',
          },
          { value: drafts.length, label: drafts.length === 1 ? 'draft waiting' : 'drafts waiting', href: '/admin/events?view=drafts' },
          { value: attention.length, label: 'to look at', tone: 'attention' },
        ]}
      />

      {view === 'upcoming' && next ? (
        <UpNext
          event={next}
          locale={locale}
          deskHref={
            canCheckIn && !isOnlineVenue(next.venue) ? `/admin/events/${next.id}?mode=door` : `/admin/events/${next.id}`
          }
          deskLabel={canCheckIn && !isOnlineVenue(next.venue) ? 'Open the door desk' : 'Open the roster'}
          inviteHref={canInvite ? inviteLink(next, canReachStudents) : null}
          shareText={shareText(next)}
        />
      ) : null}

      {view === 'upcoming' && attention.length > 0 ? (
        <section aria-labelledby="attention-heading" className="space-y-3">
          <h2 id="attention-heading" className="text-sm font-semibold text-secondary">
            Needs attention
          </h2>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {attention.map(({ event: e, chip, line }) => (
              <li key={e.id} className="min-w-0">
                <Link
                  href={`/admin/events/${e.id}`}
                  className="group flex h-full min-h-11 items-center gap-3 rounded-lg border border-line bg-surface-raised p-3 shadow-sm transition-colors duration-fast ease-brand hover:border-line-strong"
                >
                  <DateTile iso={e.startsAt} locale={locale.locale} timeZone={tz} size="sm" />
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block truncate font-medium text-primary">{e.title}</span>
                    <span className="flex flex-wrap items-center gap-2 text-sm text-secondary">
                      {chip}
                      {line}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="space-y-4">
        <Tabs ariaLabel="Event lists" items={tabs} />

        {view === 'drafts' && rows.length > 0 ? (
          <p className="text-sm text-secondary">Members cannot see a draft until it is published.</p>
        ) : null}

        {rows.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-5" />}
            title={
              view === 'drafts'
                ? 'No drafts'
                : view === 'past'
                  ? 'Nothing has happened yet'
                  : view === 'mine'
                    ? `No ${myDepartmentCode} events yet`
                    : 'No events coming up'
            }
            description={
              view === 'drafts'
                ? 'An event saved without publishing waits here.'
                : view === 'past'
                  ? 'Events move here the day after they finish, with their roster.'
                  : 'Members see an event the moment it is published.'
            }
            action={
              view !== 'past' ? (
                <ButtonLink href="/admin/events/new" variant="secondary">
                  Create an event
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <Card>
            <ul className="divide-y divide-line px-4">
              {rows.map((e) => (
                <li key={e.id} className="relative has-[[aria-expanded=true]]:z-20">
                  <EventSummary
                    event={e}
                    href={`/admin/events/${e.id}`}
                    locale={locale}
                    variant="row"
                    status={<RowStatus event={e} past={isPast(e)} manageable={manageable(e)} />}
                    action={<EventActionsMenu label={`More actions for ${e.title}`} items={menuFor(e)} />}
                  />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------

function dayWords(d: number): string {
  return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`;
}

/** The composer, with the audience this event is for. */
function inviteLink(e: EventItem, canReachStudents: boolean): string {
  const qs = new URLSearchParams({ event: e.slug });
  if (e.alumniOnly || !e.studentEligible || !canReachStudents) qs.set('cohort', 'alumni');
  if (e.departmentCode) qs.set('department', e.departmentCode);
  return `/admin/comms/new?${qs.toString()}`;
}

function RowStatus({ event, past, manageable }: { event: EventItem; past: boolean; manageable: boolean }) {
  const chips: ReactNode[] = [];
  if (!event.published) {
    chips.push(
      <Badge key="draft" tone="neutral">
        Draft
      </Badge>,
    );
  } else if (past) {
    const regs = getEventRegistrations(event.id);
    const arrived = regs.filter((r) => r.checkedInAt).length;
    if (regs.length) {
      chips.push(
        <Badge key="turnout" tone="outline">
          {arrived} of {regs.length} arrived
        </Badge>,
      );
    }
  } else {
    const s = seatStatus(event);
    chips.push(
      s.capped ? (
        <SeatBadge key="seats" event={event} audience="organiser" />
      ) : event.registeredCount > 2 ? (
        <Badge key="seats" tone="outline">
          {event.registeredCount.toLocaleString('en-IN')} registered
        </Badge>
      ) : null,
    );
  }
  if (!manageable) {
    chips.push(
      <span key="view-only" className="text-xs text-secondary">
        View only
      </span>,
    );
  }
  return <>{chips}</>;
}

function UpNext({
  event,
  locale,
  deskHref,
  deskLabel,
  inviteHref,
  shareText,
}: {
  event: EventItem;
  locale: LocaleSpec;
  deskHref: string;
  deskLabel: string;
  inviteHref: string | null;
  shareText: string;
}) {
  const d = daysUntil(event.startsAt, locale.timeZone);
  const s = seatStatus(event);
  const registered = s.capped
    ? `${event.registeredCount.toLocaleString('en-IN')} of ${s.capacity!.toLocaleString('en-IN')} registered`
    : `${event.registeredCount.toLocaleString('en-IN')} registered`;

  return (
    <section aria-labelledby="up-next-title">
      <Card className="overflow-hidden">
        <div className={event.coverImage ? 'grid md:grid-cols-[minmax(0,18rem)_1fr]' : undefined}>
          {event.coverImage ? (
            <MediaFrame src={event.coverImage} alt="" aspect="16/9" rounded={false} className="[&>div]:h-full [&>div]:border-0" />
          ) : null}
          <div className="flex items-start gap-4 p-card">
            {event.coverImage ? null : (
              <DateTile iso={event.startsAt} locale={locale.locale} timeZone={locale.timeZone} size="lg" />
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-fg">Up next</p>
              <h2 id="up-next-title" className="font-display text-xl font-semibold leading-snug">
                <Link href={`/admin/events/${event.id}`} className="link-quiet">
                  {event.title}
                </Link>
              </h2>
              <p className="text-sm text-secondary">{eventMetaLine(event, locale)}</p>
              <p className="text-sm text-primary">
                <span className="font-semibold">{dayWords(d)}</span>
                <span aria-hidden="true" className="text-muted">
                  {' '}
                  ·{' '}
                </span>
                <span className="sr-only">, </span>
                <span className="tabular">{registered}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <ButtonLink href={deskHref} className="min-h-11 sm:min-h-0">
                  {deskHref.includes('mode=door') ? (
                    <DoorOpen className="size-4" aria-hidden="true" />
                  ) : (
                    <ClipboardList className="size-4" aria-hidden="true" />
                  )}
                  {deskLabel}
                </ButtonLink>
                {inviteHref ? (
                  <ButtonLink href={inviteHref} variant="secondary" className="min-h-11 sm:min-h-0">
                    <Send className="size-4" aria-hidden="true" />
                    Invite people
                  </ButtonLink>
                ) : null}
                <CopyButton text={shareText} label="Copy for WhatsApp" copiedLabel="Copied for WhatsApp" />
              </div>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
