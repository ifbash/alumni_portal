import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { CalendarPlus, CalendarDays, Ticket, Users, FileWarning } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, canInDepartment, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getEvents, getDepartments } from '@/lib/data/repo';
import type { EventItem } from '@/lib/data/types';
import {
  PageHeader,
  Tabs,
  Alert,
  Badge,
  Stat,
  Card,
  CardBody,
  ButtonLink,
  EmptyState,
  Progress,
  TableWrap,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  DefinitionCard,
} from '@/components/ui';
import { MarginNote } from '@/components/brand/Marks';
import { formatDateRange, formatRelative, formatCurrency, formatCompactINR, memberLine } from '@/lib/format';

export const metadata = { title: 'Events' };

type View = 'upcoming' | 'past' | 'drafts';

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
  const view: View = ((v) => (v === 'past' || v === 'drafts' ? v : 'upcoming'))(one(params.view));

  const upcoming = getEvents(session, { when: 'upcoming', includeDrafts: true }).filter((e) => e.published);
  const past = getEvents(session, { when: 'past', includeDrafts: true }).filter((e) => e.published);
  // `getEvents` only surfaces unpublished rows to `event.create.any`, so an
  // HOD never sees another department's half-written draft.
  const drafts = wide ? getEvents(session, { when: 'all', includeDrafts: true }).filter((e) => !e.published) : [];

  const departments = getDepartments();
  const deptName = (code: string | null) =>
    code ? (departments.find((d) => d.code === code)?.name ?? code) : 'All branches';

  const seats = upcoming.reduce((n, e) => n + e.registeredCount, 0);
  const expected = upcoming.reduce((n, e) => n + e.registeredCount * e.ticketPrice, 0);
  const paid = upcoming.filter((e) => e.ticketPrice > 0).length;

  const rows = view === 'past' ? past : view === 'drafts' ? drafts : upcoming;

  const myDepartment = session.roles.find((r) => r.role === 'hod')?.departmentId ?? session.departmentId;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Events"
        description="Reunions, department sessions and workshops. A draft is invisible to members until you publish it — registration does not open before then."
        actions={
          <ButtonLink href="/admin/events/new">
            <CalendarPlus className="size-4" aria-hidden="true" />
            New event
          </ButtonLink>
        }
      />

      {!wide ? (
        <Alert
          tone="info"
          title={`Your scope is ${myDepartment ?? 'your department'}`}
          icon={<FileWarning className="size-4" />}
        >
          <p>
            You hold <code className="font-mono text-xs">event.create.department</code>. You can create and manage{' '}
            {deptName(myDepartment)} events. College-wide events and other branches belong to the alumni cell, and
            unpublished drafts are not shown to you at all.
          </p>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Published, upcoming"
          value={upcoming.length}
          hint={past.length ? `${past.length} in the archive` : 'Nothing archived yet'}
          icon={<CalendarDays className="size-4" />}
        />
        <Stat
          label="Registrations"
          value={seats.toLocaleString('en-IN')}
          hint="Across every upcoming event"
          icon={<Users className="size-4" />}
        />
        <Stat
          label="Expected ticket income"
          value={formatCompactINR(expected)}
          hint={paid ? `${paid} of ${upcoming.length} events are ticketed` : 'Every upcoming event is free'}
          icon={<Ticket className="size-4" />}
        />
        <Stat
          label={wide ? 'Drafts' : 'Drafts (alumni cell)'}
          value={wide ? drafts.length : '—'}
          hint={wide ? 'Not visible to members' : 'Only the alumni cell sees drafts'}
        />
      </div>

      <Tabs
        ariaLabel="Event lists"
        items={[
          { label: 'Upcoming', href: '/admin/events?view=upcoming', count: upcoming.length, active: view === 'upcoming' },
          { label: 'Past', href: '/admin/events?view=past', count: past.length, active: view === 'past' },
          ...(wide
            ? [{ label: 'Drafts', href: '/admin/events?view=drafts', count: drafts.length, active: view === 'drafts' }]
            : []),
        ]}
      />

      {view === 'drafts' && drafts.length > 0 ? (
        <Alert tone="warning" title="These events do not exist as far as members are concerned">
          <p>
            A draft is absent from the members&rsquo; event list, has no registration page and sends no reminder. It
            becomes real the moment you publish it — check the date, the venue and the ticket price first, because
            registrations begin immediately.
          </p>
        </Alert>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="size-5" />}
          title={
            view === 'drafts'
              ? 'No drafts'
              : view === 'past'
                ? 'Nothing in the archive yet'
                : 'No events scheduled'
          }
          description={
            view === 'drafts'
              ? 'Anything you save without publishing waits here. Use a draft when the speaker is confirmed but the date is not.'
              : view === 'past'
                ? 'Events move here the day after they finish, with their roster and check-in record intact.'
                : 'The alumni meet, department sessions and workshops all start here. Members see an event the moment it is published.'
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
        <>
          <TableWrap caption="Events with their registration counts and publication state" className="hidden sm:block">
            <Table>
              <THead>
                <TR>
                  <TH>Event</TH>
                  <TH>When</TH>
                  <TH>Audience</TH>
                  <TH align="right">Registered</TH>
                  <TH align="right">Ticket</TH>
                  <TH>State</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((e) => {
                  const manageable = wide || canInDepartment(session, 'event.create.department', e.departmentCode);
                  return (
                    <TR key={e.id} interactive className={e.published ? undefined : 'bg-surface-sunken'}>
                      <TD>
                        <Link href={`/admin/events/${e.id}`} className="font-semibold hover:text-brand-fg hover:underline">
                          {e.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-secondary">{e.venue ?? 'Venue not set'}</p>
                      </TD>
                      <TD>
                        <p className="text-sm">{formatDateRange(e.startsAt, e.endsAt)}</p>
                        <p className="text-xs text-muted">{formatRelative(e.startsAt)}</p>
                      </TD>
                      <TD>
                        <p className="text-sm">{deptName(e.departmentCode)}</p>
                        <p className="text-xs text-muted">
                          {e.alumniOnly ? 'Alumni only' : e.studentEligible ? 'Alumni and students' : 'Alumni'}
                        </p>
                      </TD>
                      <TD align="right">
                        <CapacityCell event={e} />
                      </TD>
                      <TD numeric>{e.ticketPrice > 0 ? formatCurrency(e.ticketPrice) : 'Free'}</TD>
                      <TD>
                        <div className="flex flex-col items-start gap-1">
                          <StateBadge event={e} />
                          {!manageable ? (
                            <span className="text-xs text-muted">Read-only for you</span>
                          ) : null}
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>

          <div className="space-y-3 sm:hidden">
            {rows.map((e) => (
              <DefinitionCard
                key={e.id}
                title={e.title}
                subtitle={memberLine([e.venue, deptName(e.departmentCode)])}
                rows={[
                  { label: 'When', value: formatDateRange(e.startsAt, e.endsAt) },
                  {
                    label: 'Registered',
                    value: `${e.registeredCount.toLocaleString('en-IN')}${e.capacity ? ` / ${e.capacity}` : ''}`,
                  },
                  { label: 'Ticket', value: e.ticketPrice > 0 ? formatCurrency(e.ticketPrice) : 'Free' },
                  { label: 'State', value: <StateBadge event={e} /> },
                ]}
                actions={
                  <ButtonLink href={`/admin/events/${e.id}`} variant="secondary" size="sm">
                    Roster and check-in
                  </ButtonLink>
                }
              />
            ))}
          </div>
        </>
      )}

      {view === 'upcoming' && upcoming.some((e) => e.capacity && e.registeredCount >= e.capacity) ? (
        <Card>
          <CardBody className="space-y-2">
            <p className="font-display text-lg font-semibold">One event is full</p>
            <MarginNote>
              A full event still accepts nothing further — the registration page closes itself rather than building a
              waiting list nobody has agreed to run. If you want the extra seats, raise the capacity; if you do not,
              leave it and tell the batch coordinators.
            </MarginNote>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function StateBadge({ event }: { event: EventItem }) {
  if (!event.published) {
    return (
      <Badge tone="warning" dot>
        Draft — not visible to members
      </Badge>
    );
  }
  if (event.capacity && event.registeredCount >= event.capacity) {
    return (
      <Badge tone="danger" dot>
        Full
      </Badge>
    );
  }
  return (
    <Badge tone="success" dot>
      Published
    </Badge>
  );
}

function CapacityCell({ event }: { event: EventItem }) {
  if (!event.capacity) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-semibold tabular">{event.registeredCount.toLocaleString('en-IN')}</p>
        <p className="text-xs text-muted">No cap</p>
      </div>
    );
  }

  const pct = event.registeredCount / event.capacity;
  const tone = pct >= 1 ? 'danger' : pct >= 0.9 ? 'warning' : 'brand';

  return (
    <div className="ml-auto w-28 space-y-1">
      <p className="text-sm font-semibold tabular">
        {event.registeredCount.toLocaleString('en-IN')} / {event.capacity.toLocaleString('en-IN')}
      </p>
      <Progress
        value={event.registeredCount}
        max={event.capacity}
        tone={tone}
        label={`${event.title}: ${event.registeredCount} of ${event.capacity} seats taken`}
      />
    </div>
  );
}
