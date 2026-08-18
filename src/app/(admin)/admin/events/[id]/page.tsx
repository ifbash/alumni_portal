import { redirect, notFound } from 'next/navigation';
import { CalendarDays, MapPin, Ticket, Users, UserCheck, IndianRupee, ScanLine } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, canInDepartment, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getEvents, getEventRegistrations, getDepartments, getMembersForAdmin } from '@/lib/data/repo';
import {
  PageHeader,
  Breadcrumbs,
  Alert,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Stat,
  Progress,
  DetailRow,
  Section,
  ButtonLink,
} from '@/components/ui';
import { ProportionBar } from '@/components/charts';
import {
  formatDateRange,
  formatRelative,
  formatCurrency,
  formatCompactINR,
  formatDate,
  formatPercent,
} from '@/lib/format';
import { CheckInPanel } from './CheckInPanel';

export const metadata = { title: 'Event roster' };

export default async function AdminEventPage({ params }: { params: Promise<{ id: string }> }) {
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
  const checkInAllowed = can(session, 'event.checkin');

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

  const rows = registrations.map((r) => ({
    id: r.id,
    memberName: r.memberName,
    batchYear: r.batchYear,
    rollNumber: rollById.get(r.memberId) ?? null,
    guests: r.guests,
    amountLabel: r.amountPaid > 0 ? formatCurrency(r.amountPaid) : 'Free',
    checkedIn: Boolean(r.checkedInAt),
    checkedInLabel: r.checkedInAt ? formatDate(r.checkedInAt) : null,
    registeredOn: formatDate(r.createdAt),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Admin', href: '/admin' },
              { label: 'Events', href: '/admin/events' },
              { label: event.title },
            ]}
          />
        }
        eyebrow={event.published ? 'Published' : 'Draft'}
        title={event.title}
        description={event.description ?? 'No description was written for this event.'}
        actions={
          <ButtonLink href="/admin/events" variant="secondary">
            All events
          </ButtonLink>
        }
      />

      {!event.published ? (
        <Alert tone="warning" title="This is a draft">
          <p>
            Members cannot see it, cannot register for it and will not be reminded about it. Nothing below is a real
            roster yet: registration opens only once the event is published, and the counters stay at nought until
            then.
          </p>
        </Alert>
      ) : null}

      {!manageable ? (
        <Alert tone="info" title="Read-only for you">
          <p>
            This event is scoped to {deptName}, which is outside your <code className="font-mono text-xs">event.create.department</code>{' '}
            grant. You can read the roster; changing the event belongs to whoever owns that scope.
          </p>
        </Alert>
      ) : null}

      {event.published && registrations.length < event.registeredCount ? (
        <Alert tone="warning" title="The roster is shorter than the registration counter">
          <p>
            The event records{' '}
            <strong className="tabular">{event.registeredCount.toLocaleString('en-IN')}</strong> registrations, but{' '}
            <strong className="tabular">{registrations.length.toLocaleString('en-IN')}</strong> rows are on file. The
            check-in desk can only find the rows it has — reconcile before the doors open, or {event.registeredCount - registrations.length}{' '}
            people arrive holding a confirmation nobody can match.
          </p>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Registered"
              value={event.registeredCount.toLocaleString('en-IN')}
              hint={event.capacity ? `of ${event.capacity.toLocaleString('en-IN')} seats` : 'No capacity set'}
              icon={<Users className="size-4" />}
            />
            <Stat
              label="Guests on file"
              value={guests.toLocaleString('en-IN')}
              hint="Seats beyond the registrant"
            />
            <Stat
              label="Collected"
              value={formatCompactINR(collected)}
              hint={
                event.ticketPrice > 0
                  ? `${formatCurrency(collected)} across ${registrations.length} rows`
                  : 'Free event — nothing to collect'
              }
              icon={<IndianRupee className="size-4" />}
            />
            <Stat
              label="Checked in"
              value={`${checkedIn} / ${registrations.length}`}
              hint={
                registrations.length
                  ? `${formatPercent(checkedIn / registrations.length)} of the roster`
                  : 'Nobody has registered'
              }
              icon={<UserCheck className="size-4" />}
            />
          </div>

          <CheckInPanel
            eventTitle={event.title}
            rows={rows}
            canCheckIn={checkInAllowed}
            showRoll={showRoll}
            isPast={isPast}
          />
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">Event detail</CardTitle>
                <CardDescription>{formatRelative(event.startsAt)}</CardDescription>
              </div>
              <Badge tone={event.published ? 'success' : 'warning'} dot>
                {event.published ? 'Published' : 'Draft'}
              </Badge>
            </CardHeader>
            <CardBody>
              <dl className="divide-y divide-line">
                <DetailRow label="When">
                  <span className="flex items-start gap-2">
                    <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                    {formatDateRange(event.startsAt, event.endsAt)}
                  </span>
                </DetailRow>
                <DetailRow label="Venue">
                  <span className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                    {event.venue ?? 'Not set'}
                  </span>
                </DetailRow>
                <DetailRow label="Branch">{deptName}</DetailRow>
                <DetailRow label="Audience">
                  {event.alumniOnly
                    ? 'Alumni only — students cannot see or register for this'
                    : event.studentEligible
                      ? 'Alumni and students'
                      : 'Alumni'}
                </DetailRow>
                <DetailRow label="Ticket">
                  <span className="flex items-center gap-2">
                    <Ticket className="size-4 shrink-0 text-muted" aria-hidden="true" />
                    {event.ticketPrice > 0 ? formatCurrency(event.ticketPrice) : 'Free'}
                  </span>
                </DetailRow>
                <DetailRow label="Capacity">
                  {event.capacity ? event.capacity.toLocaleString('en-IN') : 'No cap'}
                </DetailRow>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">Seats</CardTitle>
                <CardDescription>
                  {event.capacity
                    ? `${event.registeredCount.toLocaleString('en-IN')} of ${event.capacity.toLocaleString('en-IN')} taken`
                    : 'No capacity was set for this event'}
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              {event.capacity ? (
                <>
                  <Progress
                    value={event.registeredCount}
                    max={event.capacity}
                    tone={
                      event.registeredCount >= event.capacity
                        ? 'danger'
                        : event.registeredCount / event.capacity >= 0.9
                          ? 'warning'
                          : 'brand'
                    }
                    label={`${event.registeredCount} of ${event.capacity} seats taken`}
                  />
                  <ProportionBar
                    label="Seats taken against capacity"
                    segments={[
                      { label: 'Registered', value: event.registeredCount, tone: 'brand' },
                      {
                        label: 'Free seats',
                        value: Math.max(0, event.capacity - event.registeredCount),
                        tone: 'neutral',
                      },
                    ]}
                  />
                  {event.registeredCount >= event.capacity ? (
                    <p className="text-sm text-danger-fg">
                      Full. Registration is closed on the members&rsquo; side; raise the capacity if the venue can take
                      more.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-secondary">
                  An uncapped event never turns anyone away, which is right for an online panel and wrong for a hall
                  with 120 chairs. Set a capacity if the venue has one.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">Ticket income</CardTitle>
                <CardDescription>
                  {event.ticketPrice > 0 ? 'Against the rows on file' : 'This event is free'}
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              {event.ticketPrice > 0 ? (
                <dl className="divide-y divide-line">
                  <DetailRow label="Ticket price">{formatCurrency(event.ticketPrice)}</DetailRow>
                  <DetailRow label="Collected">
                    <span className="tabular">{formatCurrency(collected)}</span>
                  </DetailRow>
                  <DetailRow label="Expected at full roster">
                    <span className="tabular">{formatCurrency(expected)}</span>
                  </DetailRow>
                </dl>
              ) : (
                <p className="text-sm text-secondary">
                  Nothing is collected for this event, so there is nothing to reconcile against the gateway.
                </p>
              )}
            </CardBody>
          </Card>
        </aside>
      </div>

      {isPast ? (
        <Section
          title="After the event"
          description="Attendance is the only figure that tells you whether the invitation worked."
        >
          <Card>
            <CardBody className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-secondary">Turnout against the roster</p>
                <p className="mt-1 font-display text-display-xs font-bold tabular">
                  {registrations.length ? formatPercent(checkedIn / registrations.length) : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-secondary">Did not arrive</p>
                <p className="mt-1 font-display text-display-xs font-bold tabular">
                  {registrations.length - checkedIn}
                </p>
              </div>
              <div>
                <p className="text-sm text-secondary">Guests brought</p>
                <p className="mt-1 font-display text-display-xs font-bold tabular">{guests}</p>
              </div>
            </CardBody>
          </Card>
        </Section>
      ) : (
        <Alert tone="neutral" title="Check-in opens at the door" icon={<ScanLine className="size-4" />}>
          <p>
            The desk searches this roster by name{showRoll ? ' or roll number' : ' or batch'} and marks people
            attended one at a time. Nothing about a registration can be edited from here — a wrong name is a profile
            correction, not a check-in.
          </p>
        </Alert>
      )}
    </div>
  );
}
