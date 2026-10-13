import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight, Ban, Clock, Handshake, Hourglass, Inbox, Send } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { require as requireCap, can } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getConnections, getConnectionQuota, getOwnProfile, searchDirectory } from '@/lib/data/repo';
import {
  Alert,
  Avatar,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  EmptyState,
  PageHeader,
  Progress,
  Tabs,
  type TabItem,
} from '@/components/ui';
import { displayNow, formatDate, formatRelative, memberLine } from '@/lib/format';
import { firstNameOf, viewerBranch } from '@/lib/identity';
import { REQUEST_EXPIRY_DAYS } from '@/lib/availability-copy';
import { cn } from '@/lib/cn';
import type {
  ConnectionKind,
  ConnectionQuota,
  ConnectionRequest,
  ConnectionState,
  MemberSummary,
} from '@/lib/data/types';
import { MemberCard } from '@/components/members/MemberCard';
import { RequestIntroButton } from '@/components/directory/RequestIntroButton';
import { ConnectionActions } from './ConnectionActions';

/**
 * Requests — asking for help and answering it.
 *
 * Ordered by what the viewer does here. Alumni and faculty mostly answer,
 * so they open on the people waiting for them; the quota they almost
 * never approach is a footnote until it matters. Students mostly ask, so
 * they open on their own requests, each with its state and next step, and
 * a one-line meter of what they have left.
 *
 * Contact details are never rendered here. An accepted request is the
 * *reason* details may appear on a profile — it is not itself permission,
 * because the owner's visibility setting is the second gate and this page
 * has no business second-guessing it.
 */

export const metadata: Metadata = { title: 'Requests' };

type TabKey = 'received' | 'sent' | 'accepted';

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  if (!resolved.brand.pack.features.connections) notFound();

  // Hiding the sidebar link is presentation. This is the authorisation.
  requireCap(session, 'connection.send');

  const params = await searchParams;
  const requested = Array.isArray(params.tab) ? params.tab[0] : params.tab;

  const canReceive = can(session, 'connection.receive');
  const isStudent = session.roles.some((r) => r.role === 'student');

  const received = canReceive ? getConnections(session, 'received') : [];
  const sent = getConnections(session, 'sent');
  const accepted = getConnections(session, 'accepted');
  const quota = getConnectionQuota(session);

  const waiting = received.filter((c) => c.state === 'pending');
  const answered = received.filter((c) => c.state !== 'pending');

  // Students hold `connection.send` but not `connection.receive`: they ask,
  // alumni answer. A tab that can never fill is worse than no tab.
  const available: TabKey[] = canReceive ? ['received', 'sent', 'accepted'] : ['sent', 'accepted'];
  const tab: TabKey = available.includes(requested as TabKey) ? (requested as TabKey) : available[0];

  const { pack } = resolved.brand;
  const timing = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };
  const now = displayNow();
  const openSent = sent.filter((c) => c.state === 'pending');

  // A student may only open profiles of alumni. A request from a student
  // still arrives here for an alumnus, but a link to that student's
  // profile would be a not-found page for them.
  const canOpen = (m: MemberSummary) => !m.isStudent || can(session, 'directory.search.students');

  const labels: Record<TabKey, string> = {
    received: 'To answer',
    sent: isStudent ? 'Your requests' : 'You asked',
    accepted: 'Connected',
  };
  const counts: Record<TabKey, number> = {
    received: waiting.length,
    sent: openSent.length,
    accepted: accepted.length,
  };

  const tabs: TabItem[] = available.map((key) => ({
    label: labels[key],
    href: `/connections?tab=${key}`,
    count: counts[key],
    active: tab === key,
  }));

  const resetsOn = firstOfNextMonth(timing.locale, timing.timeZone);
  const hasAlumniRole = session.roles.some((r) => r.role === 'alumni');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requests"
        description={
          isStudent
            ? 'Your requests to alumni, and what to do next with each one.'
            : 'People asking for your help, and the requests you have sent.'
        }
        meta={isStudent ? <StudentMeter quota={quota} resetsOn={resetsOn} /> : undefined}
        actions={
          isStudent && quota.canSend ? (
            <ButtonLink href="/directory?mentoring=1" className="min-h-11 sm:min-h-0">
              Find a mentor
            </ButtonLink>
          ) : !isStudent ? (
            <ButtonLink href="/directory" variant="secondary" className="min-h-11 sm:min-h-0">
              Open the directory
            </ButtonLink>
          ) : null
        }
      />

      {isStudent && quota.reason ? (
        <Alert tone="warning" title="You cannot send another request yet">
          <p>
            {quota.reason} A slot frees when one of your requests is answered or closes.
          </p>
        </Alert>
      ) : null}

      <Tabs items={tabs} ariaLabel="Requests" />

      {/* Held to a reading width: a request is a message to read, and a
          150-character line across a wide screen is not. */}
      <div className="max-w-4xl space-y-6">
        {tab === 'received' ? (
          <ReceivedTab
            waiting={waiting}
            answered={answered}
            canOpen={canOpen}
            timing={timing}
            now={now}
            hasAlumniRole={hasAlumniRole}
            mentoringOn={getOwnProfile(session)?.openToMentoring ?? false}
          />
        ) : null}
        {tab === 'sent' ? (
          <SentTab
            sent={sent}
            isStudent={isStudent}
            timing={timing}
            now={now}
            officeName={pack.copy.officeName}
            suggestions={
              isStudent && sent.length === 0
                ? searchDirectory(session, {
                    mentoring: true,
                    department: viewerBranch(session) ?? undefined,
                    perPage: 3,
                  }).items
                : []
            }
            quota={quota}
            placeholder={
              isStudent
                ? `I am in final year ${viewerBranch(session) ? `${viewerBranch(session)} ` : ''}at ${pack.copy.shortName}. I would like to ask about…`
                : undefined
            }
          />
        ) : null}
        {tab === 'accepted' ? (
          <AcceptedTab
            accepted={accepted}
            viewerId={session.memberId}
            sentCount={sent.length}
            canOpen={canOpen}
            timing={timing}
          />
        ) : null}

        {!isStudent ? <QuotaFootnote quota={quota} resetsOn={resetsOn} /> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Quota
// ---------------------------------------------------------------

/** A student's allowance in one line: "2 of 5 open · monthly count resets 1 September". */
function StudentMeter({ quota, resetsOn }: { quota: ConnectionQuota; resetsOn: string }) {
  const left = Math.max(0, quota.openLimit - quota.openRequests);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <Progress
        className="w-24"
        value={quota.openRequests}
        max={quota.openLimit}
        tone={quota.openRequests >= quota.openLimit ? 'warning' : 'brand'}
        label={`${quota.openRequests} of ${quota.openLimit} requests open`}
      />
      <p className="text-sm text-secondary">
        <span className="tabular font-medium text-primary">
          {quota.openRequests > 0
            ? `${quota.openRequests} of ${quota.openLimit} open`
            : `${left} requests available`}
        </span>
        {' · '}monthly count resets {resetsOn}
      </p>
    </div>
  );
}

/**
 * Alumni and faculty send few requests, so their allowance stays out of
 * the way until 60% of either limit is in use.
 */
function QuotaFootnote({ quota, resetsOn }: { quota: ConnectionQuota; resetsOn: string }) {
  const openShare = quota.openRequests / Math.max(1, quota.openLimit);
  const monthShare = quota.usedThisMonth / Math.max(1, quota.monthlyLimit);
  if (openShare < 0.6 && monthShare < 0.6) return null;

  return (
    <p className={cn('border-t border-line pt-4 text-sm', quota.canSend ? 'text-secondary' : 'text-warning-fg')}>
      {quota.reason ??
        `${quota.openRequests} of ${quota.openLimit} requests open, ${quota.usedThisMonth} of ${quota.monthlyLimit} sent this month.`}{' '}
      A slot frees when one is answered or closes; the monthly count resets {resetsOn}.
    </p>
  );
}

// ---------------------------------------------------------------
// Received
// ---------------------------------------------------------------

interface Timing {
  locale: string;
  timeZone: string;
}

function ReceivedTab({
  waiting,
  answered,
  canOpen,
  timing,
  now,
  hasAlumniRole,
  mentoringOn,
}: {
  waiting: ConnectionRequest[];
  answered: ConnectionRequest[];
  canOpen: (m: MemberSummary) => boolean;
  timing: Timing;
  now: Date;
  hasAlumniRole: boolean;
  mentoringOn: boolean;
}) {
  if (waiting.length === 0 && answered.length === 0) {
    return (
      <EmptyState
        icon={<Inbox className="size-5" />}
        title="No one has asked you yet"
        description={
          hasAlumniRole
            ? 'Final-year students find you through the directory, and people open to mentoring come up first.'
            : 'Final-year students can ask faculty who are open to mentoring for advice or an introduction.'
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/profile/preview" variant="secondary" className="min-h-11 sm:min-h-0">
              See how students see your card
            </ButtonLink>
            {!mentoringOn ? (
              <ButtonLink href="/profile/edit#availability" className="min-h-11 sm:min-h-0">
                Turn on mentoring
              </ButtonLink>
            ) : null}
          </div>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      {waiting.length > 0 ? (
        <section aria-labelledby="to-answer" className="space-y-4">
          <div className="space-y-1">
            <h2 id="to-answer" className="font-display text-xl font-semibold">
              {waiting.length === 1 ? '1 person asked for your help' : `${waiting.length} people asked for your help`}
            </h2>
            <p className="text-sm text-secondary">
              A request you leave closes by itself after {REQUEST_EXPIRY_DAYS} days.
            </p>
          </div>
          <div className="space-y-4">
            {waiting.map((c) => (
              <RequestCard key={c.id} request={c} linkable={canOpen(c.from)} now={now} />
            ))}
          </div>
        </section>
      ) : (
        <EmptyState variant="inline" title="Nothing is waiting for you." description="Every request has an answer." />
      )}

      {answered.length > 0 ? (
        <section aria-labelledby="answered" className="space-y-3">
          <h2 id="answered" className="font-display text-lg font-semibold">
            Already answered
          </h2>
          <Card>
            <ul className="divide-y divide-line px-card">
              {answered.map((c) => (
                <li key={c.id}>
                  <AnsweredRow request={c} person={c.from} linkable={canOpen(c.from)} timing={timing} />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function RequestCard({
  request,
  linkable,
  now,
}: {
  request: ConnectionRequest;
  linkable: boolean;
  now: Date;
}) {
  const sender = request.from;
  const expiring = isExpiringSoon(request.expiresAt, now);

  return (
    <Card as="article">
      <CardBody className="space-y-3">
        <div className="flex items-start gap-3">
          <Avatar name={sender.fullName} src={sender.photoUrl} size="md" />

          <div className="min-w-0 flex-1">
            <h3 className="font-display text-md font-semibold leading-snug">
              {linkable ? (
                <Link href={`/directory/${sender.slug}`} className="link-quiet">
                  {sender.fullName}
                </Link>
              ) : (
                sender.fullName
              )}
            </h3>
            <p className="mt-0.5 text-sm text-secondary">
              {memberLine([
                sender.departmentCode,
                sender.isStudent ? 'Final year' : sender.batchYear ? `Batch of ${sender.batchYear}` : null,
              ]) || 'Branch and batch not recorded'}
            </p>
          </div>

          <KindBadge kind={request.kind} />
        </div>

        {request.message ? (
          <blockquote className="line-clamp-3 border-l-2 border-line-strong pl-3 text-sm leading-relaxed text-primary">
            {request.message}
          </blockquote>
        ) : (
          <p className="text-sm text-secondary">No message included.</p>
        )}

        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <Send className="size-3.5 text-muted" aria-hidden="true" />
            Sent {formatRelative(request.createdAt)}
          </span>
          {request.expiresAt ? (
            <span className={cn('inline-flex items-center gap-1.5', expiring && 'font-medium text-warning-fg')}>
              <Clock className="size-3.5" aria-hidden="true" />
              Closes {formatRelative(request.expiresAt)}
            </span>
          ) : null}
        </p>
      </CardBody>

      <div className="border-t border-line px-card py-3">
        <ConnectionActions
          connectionId={request.id}
          memberName={sender.fullName}
          memberSlug={sender.slug}
          variant="received"
        />
      </div>
    </Card>
  );
}

function AnsweredRow({
  request,
  person,
  linkable,
  timing,
}: {
  request: ConnectionRequest;
  person: MemberSummary;
  linkable: boolean;
  timing: Timing;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <Avatar name={person.fullName} src={person.photoUrl} size="sm" />
      <div className="min-w-0 flex-1">
        {linkable ? (
          <Link href={`/directory/${person.slug}`} className="block truncate text-sm font-medium link-quiet">
            {person.fullName}
          </Link>
        ) : (
          <p className="truncate text-sm font-medium">{person.fullName}</p>
        )}
        <p className="truncate text-xs text-secondary">
          {memberLine([
            KIND_LABEL[request.kind],
            `asked ${formatDate(request.createdAt, timing)}`,
            request.respondedAt ? `answered ${formatDate(request.respondedAt, timing)}` : null,
          ])}
        </p>
      </div>
      <StateBadge state={request.state} />
    </div>
  );
}

// ---------------------------------------------------------------
// Sent
// ---------------------------------------------------------------

function SentTab({
  sent,
  isStudent,
  timing,
  now,
  officeName,
  suggestions,
  quota,
  placeholder,
}: {
  sent: ConnectionRequest[];
  isStudent: boolean;
  timing: Timing;
  now: Date;
  officeName: string;
  suggestions: MemberSummary[];
  quota: ConnectionQuota;
  placeholder?: string;
}) {
  if (sent.length === 0) {
    if (isStudent && suggestions.length > 0) {
      return (
        <section aria-labelledby="start-with" className="space-y-4">
          <div className="space-y-1">
            <h2 id="start-with" className="font-display text-xl font-semibold">
              Start with a mentor from your branch
            </h2>
            <p className="text-sm text-secondary">They have said yes to being asked.</p>
          </div>
          <ul className="grid grid-cols-1 gap-3">
            {suggestions.map((m) => (
              <li key={m.id} className="relative min-w-0">
                <MemberCard
                  member={m}
                  variant="row"
                  action={
                    quota.canSend ? (
                      <RequestIntroButton
                        toMemberId={m.id}
                        toName={m.fullName}
                        kinds={mentorKinds(m)}
                        defaultKind="mentorship"
                        quota={quota}
                        placeholder={placeholder}
                        label="Ask"
                        variant="secondary"
                        size="sm"
                        className="min-h-11 sm:min-h-0"
                      />
                    ) : undefined
                  }
                />
              </li>
            ))}
          </ul>
          <Link href="/directory?mentoring=1" className="link inline-flex min-h-11 items-center text-sm font-medium sm:min-h-0">
            See every mentor
          </Link>
        </section>
      );
    }

    return (
      <EmptyState
        icon={<Send className="size-5" />}
        title="You have not asked anyone yet"
        description="People marked Mentors in the directory have said yes to being asked."
        action={
          <ButtonLink href="/directory?mentoring=1" className="min-h-11 sm:min-h-0">
            Find a mentor
          </ButtonLink>
        }
      />
    );
  }

  const open = sent.filter((c) => c.state === 'pending');
  const closed = sent.filter((c) => c.state !== 'pending');

  return (
    <div className="space-y-8">
      {open.length > 0 ? (
        <section aria-labelledby="sent-open" className="space-y-4">
          <h2 id="sent-open" className="font-display text-xl font-semibold">
            Waiting for a reply
          </h2>
          <div className="space-y-4">
            {open.map((c) => (
              <SentCard key={c.id} request={c} timing={timing} now={now} officeName={officeName} />
            ))}
          </div>
        </section>
      ) : null}

      {closed.length > 0 ? (
        <section aria-labelledby="sent-closed" className="space-y-4">
          <h2 id="sent-closed" className="font-display text-xl font-semibold">
            Answered and closed
          </h2>
          <div className="space-y-4">
            {closed.map((c) => (
              <SentCard key={c.id} request={c} timing={timing} now={now} officeName={officeName} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SentCard({
  request,
  timing,
  now,
  officeName,
}: {
  request: ConnectionRequest;
  timing: Timing;
  now: Date;
  officeName: string;
}) {
  const person = request.to;
  const next = nextStep(request.state, firstNameOf(person.fullName), officeName);
  const expiring = isExpiringSoon(request.expiresAt, now);

  return (
    <Card as="article">
      <CardBody className="space-y-3">
        <div className="flex items-start gap-3">
          <Avatar name={person.fullName} src={person.photoUrl} size="md" />

          <div className="min-w-0 flex-1">
            <h3 className="font-display text-md font-semibold leading-snug">
              <Link href={`/directory/${person.slug}`} className="link-quiet">
                {person.fullName}
              </Link>
            </h3>
            <p className="mt-0.5 truncate text-sm text-secondary">
              {memberLine([person.designation, person.currentCompany]) ||
                memberLine([person.departmentCode, person.batchYear ? `Batch of ${person.batchYear}` : null])}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
            <KindBadge kind={request.kind} />
            <StateBadge state={request.state} />
          </div>
        </div>

        {request.message ? (
          <p className="line-clamp-2 border-l-2 border-line pl-3 text-sm text-secondary">{request.message}</p>
        ) : null}

        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <Send className="size-3.5 text-muted" aria-hidden="true" />
            Sent {formatDate(request.createdAt, timing)}
          </span>
          {request.state === 'pending' && request.expiresAt ? (
            <span className={cn('inline-flex items-center gap-1.5', expiring && 'font-medium text-warning-fg')}>
              <Hourglass className="size-3.5" aria-hidden="true" />
              Closes {formatRelative(request.expiresAt)}
            </span>
          ) : null}
          {request.respondedAt ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5 text-muted" aria-hidden="true" />
              Answered {formatDate(request.respondedAt, timing)}
            </span>
          ) : null}
        </p>

        {next ? <p className="rounded bg-surface-sunken px-3.5 py-2.5 text-sm text-secondary">{next}</p> : null}
      </CardBody>

      {request.state === 'pending' ? (
        <div className="border-t border-line px-card py-3">
          <ConnectionActions
            connectionId={request.id}
            memberName={person.fullName}
            memberSlug={person.slug}
            variant="sent"
          />
        </div>
      ) : null}

      {request.state === 'accepted' ? (
        <div className="border-t border-line px-card py-3">
          <ButtonLink href={`/directory/${person.slug}`} variant="secondary" size="sm" className="min-h-11 sm:min-h-0">
            Open profile
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
        </div>
      ) : null}
    </Card>
  );
}

/**
 * What to do next, per state. A decline reads as "closed": the sender is
 * told the request was answered, never that it was refused, and the
 * person who answered is told exactly that.
 */
function nextStep(state: ConnectionState, first: string, officeName: string): string | null {
  switch (state) {
    case 'pending':
      return null;
    case 'accepted':
      return `${first} accepted. Their profile shows what they share with you.`;
    case 'declined':
      return 'Closed without a connection. Your slot is back; someone else at the same company or batch may be the better person to ask.';
    case 'expired':
      return 'It closed without an answer and your slot is back. If you ask again, make it one specific question.';
    case 'withdrawn':
      return 'You withdrew this one. You can ask the same person again whenever you are ready.';
    case 'blocked':
      return `This member is not accepting requests from you. If you think that is a mistake, write to the ${officeName}.`;
  }
}

// ---------------------------------------------------------------
// Accepted
// ---------------------------------------------------------------

function AcceptedTab({
  accepted,
  viewerId,
  sentCount,
  canOpen,
  timing,
}: {
  accepted: ConnectionRequest[];
  viewerId: string;
  sentCount: number;
  canOpen: (m: MemberSummary) => boolean;
  timing: Timing;
}) {
  if (accepted.length === 0) {
    return (
      <EmptyState
        icon={<Handshake className="size-5" />}
        title="No connections yet"
        description="When someone accepts your request, or you accept theirs, it shows here."
        action={
          sentCount > 0 ? (
            <ButtonLink href="/connections?tab=sent" variant="secondary" className="min-h-11 sm:min-h-0">
              See what you asked
            </ButtonLink>
          ) : (
            <ButtonLink href="/directory?mentoring=1" className="min-h-11 sm:min-h-0">
              Find a mentor
            </ButtonLink>
          )
        }
      />
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {accepted.map((c) => {
        const person = c.from.id === viewerId ? c.to : c.from;
        const theyAsked = c.to.id === viewerId;
        const linkable = canOpen(person);

        return (
          <li key={c.id} className="min-w-0">
            <Card as="article" className="flex h-full flex-col">
              <CardBody className="flex-1 space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar name={person.fullName} src={person.photoUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-md font-semibold leading-snug">{person.fullName}</h3>
                    <p className="mt-0.5 truncate text-sm text-secondary">
                      {memberLine([
                        person.departmentCode,
                        person.isStudent ? 'Final year' : person.batchYear ? `Batch of ${person.batchYear}` : null,
                        person.isStudent ? null : person.currentCompany,
                      ])}
                    </p>
                  </div>
                  <Badge tone="success" dot>
                    Connected
                  </Badge>
                </div>

                <p className="text-xs text-secondary">
                  {theyAsked ? 'They asked you' : 'You asked'} for {KIND_LABEL[c.kind].toLowerCase()}
                  {c.respondedAt ? ` · accepted ${formatDate(c.respondedAt, timing)}` : ''}
                </p>

                {c.message ? (
                  <p className="line-clamp-2 border-l-2 border-line pl-3 text-sm text-secondary">{c.message}</p>
                ) : null}
              </CardBody>

              {linkable ? (
                <div className="border-t border-line px-card py-3">
                  <ButtonLink href={`/directory/${person.slug}`} variant="secondary" size="sm" className="min-h-11 sm:min-h-0">
                    Open profile
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </ButtonLink>
                </div>
              ) : null}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------

const KIND_LABEL: Record<ConnectionKind, string> = {
  mentorship: 'Mentoring',
  referral: 'Referral',
  introduction: 'Introduction',
  speaking: 'Speaking invitation',
};

const KIND_TONE: Record<ConnectionKind, 'success' | 'brand' | 'neutral' | 'accent'> = {
  mentorship: 'success',
  referral: 'brand',
  introduction: 'neutral',
  speaking: 'accent',
};

function KindBadge({ kind }: { kind: ConnectionKind }) {
  return <Badge tone={KIND_TONE[kind]}>{KIND_LABEL[kind]}</Badge>;
}

const STATE_LABEL: Record<ConnectionState, string> = {
  pending: 'Awaiting reply',
  accepted: 'Accepted',
  // The sender is told a declined request was answered, not refused.
  declined: 'Closed',
  expired: 'Expired',
  withdrawn: 'Withdrawn',
  blocked: 'Blocked',
};

const STATE_TONE: Record<ConnectionState, 'brand' | 'success' | 'neutral' | 'danger'> = {
  pending: 'brand',
  accepted: 'success',
  declined: 'neutral',
  expired: 'neutral',
  withdrawn: 'neutral',
  blocked: 'danger',
};

function StateBadge({ state }: { state: ConnectionState }) {
  return (
    <Badge tone={STATE_TONE[state]} dot={state === 'pending'}>
      {state === 'blocked' ? <Ban className="size-3" aria-hidden="true" /> : null}
      {STATE_LABEL[state]}
    </Badge>
  );
}

/** What a mentor has said yes to, for the inline request. */
function mentorKinds(m: MemberSummary): ConnectionKind[] {
  const kinds: ConnectionKind[] = ['mentorship'];
  if (m.openToReferrals) kinds.push('referral');
  kinds.push('introduction');
  return kinds;
}

/** Under five days left, measured from the fixture clock. */
function isExpiringSoon(expiresAt: string | null, now: Date): boolean {
  if (!expiresAt) return false;
  const ms = new Date(expiresAt).getTime() - now.getTime();
  return ms > 0 && ms < 5 * 86400000;
}

/** "1 September": when a monthly allowance starts again, in the college's time zone. */
function firstOfNextMonth(locale: string, timeZone: string): string {
  const now = displayNow();
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const m = Number(parts.find((p) => p.type === 'month')?.value);
  // Noon UTC on the 1st is the 1st in every Indian and most other zones.
  const next = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1, 12));
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone }).format(next);
}
