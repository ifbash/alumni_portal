import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowRight,
  Ban,
  CircleCheck,
  Clock,
  Handshake,
  Hourglass,
  Inbox,
  Lock,
  MessageSquare,
  Search,
  Send,
  TriangleAlert,
  UserCheck,
} from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { require as requireCap, can } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getConnections, getConnectionQuota } from '@/lib/data/repo';
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
  Section,
  Separator,
  Tabs,
  type TabItem,
} from '@/components/ui';
import { MarginNote } from '@/components/brand/Marks';
import { formatDate, formatRelative, memberLine } from '@/lib/format';
import { cn } from '@/lib/cn';
import type {
  ConnectionKind,
  ConnectionQuota,
  ConnectionRequest,
  ConnectionState,
  MemberSummary,
} from '@/lib/data/types';
import { ConnectionActions } from './ConnectionActions';

/**
 * Connections — the student → alumni valve.
 *
 * The quota is the product, not an error path. If four hundred final-years
 * can message eight thousand alumni without limit, the alumni disengage
 * inside a month and the directory is a phone book nobody answers. So the
 * meter is the first thing on the page, it is phrased as an allowance
 * rather than a restriction, and it always says what frees a slot.
 *
 * Contact details are never rendered here. An accepted request is the
 * *reason* details may appear on a profile — it is not itself permission,
 * because the owner's visibility setting is the second gate and this page
 * has no business second-guessing it.
 */

export const metadata: Metadata = { title: 'Connections' };

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

  const labels: Record<TabKey, string> = {
    received: 'Waiting on you',
    sent: 'Sent',
    accepted: 'Connected',
  };
  const counts: Record<TabKey, number> = {
    received: waiting.length,
    sent: sent.length,
    accepted: accepted.length,
  };

  const tabs: TabItem[] = available.map((key) => ({
    label: labels[key],
    href: `/connections?tab=${key}`,
    count: counts[key],
    active: tab === key,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mentorship, referrals and introductions"
        title="Connections"
        description={
          isStudent
            ? 'Every request here goes to a real person who volunteers their evenings. You get a small number of open requests at a time — that limit is why alumni still reply.'
            : 'Requests waiting on you, requests you have sent, and the people you are already connected to.'
        }
        actions={
          quota.canSend ? (
            <ButtonLink href="/directory">
              <Search className="size-4" aria-hidden="true" />
              Find someone to ask
            </ButtonLink>
          ) : (
            <ButtonLink href="/directory" variant="secondary">
              Browse the directory
            </ButtonLink>
          )
        }
      />

      <QuotaPanel quota={quota} isStudent={isStudent} />

      <Tabs items={tabs} ariaLabel="Connection views" />

      {tab === 'received' ? <ReceivedTab waiting={waiting} answered={answered} /> : null}
      {tab === 'sent' ? <SentTab sent={sent} quota={quota} /> : null}
      {tab === 'accepted' ? (
        <AcceptedTab accepted={accepted} viewerId={session.memberId} sentCount={sent.length} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------
// Quota
// ---------------------------------------------------------------

function QuotaPanel({ quota, isStudent }: { quota: ConnectionQuota; isStudent: boolean }) {
  const openLeft = Math.max(0, quota.openLimit - quota.openRequests);
  const monthLeft = Math.max(0, quota.monthlyLimit - quota.usedThisMonth);

  const openTone = quota.openRequests >= quota.openLimit ? 'danger' : openLeft <= 1 ? 'warning' : 'brand';
  const monthTone =
    quota.usedThisMonth >= quota.monthlyLimit ? 'danger' : monthLeft <= 2 ? 'warning' : 'brand';

  return (
    <Card>
      <CardBody className="grid gap-gutter md:grid-cols-3">
        <Meter
          label="Open requests"
          value={quota.openRequests}
          limit={quota.openLimit}
          tone={openTone}
          hint={
            openLeft > 0
              ? `${openLeft} more you can send right now`
              : 'Every slot is currently in use'
          }
        />
        <Meter
          label="Sent this month"
          value={quota.usedThisMonth}
          limit={quota.monthlyLimit}
          tone={monthTone}
          hint={monthLeft > 0 ? `${monthLeft} left before the month resets` : 'Resets on the 1st'}
        />

        <div className="space-y-2 md:border-l md:border-line md:pl-gutter">
          <p className="text-sm font-medium text-secondary">What frees a slot</p>
          <ul className="space-y-1.5 text-sm text-secondary">
            <li className="flex gap-2">
              <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
              <span>Someone accepts or declines — either way the slot comes back.</span>
            </li>
            <li className="flex gap-2">
              <Hourglass className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
              <span>A request nobody answers expires on its own and returns the slot.</span>
            </li>
            <li className="flex gap-2">
              <Send className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
              <span>
                You withdraw one from{' '}
                <Link href="/connections?tab=sent" className="link">
                  Sent
                </Link>
                .
              </span>
            </li>
          </ul>
        </div>
      </CardBody>

      {quota.reason ? (
        <div className="border-t border-line p-card">
          <Alert
            tone="warning"
            title="You cannot send another request just yet"
            icon={<TriangleAlert className="size-4" />}
          >
            <p>{quota.reason}</p>
            <p className="mt-1.5">
              {isStudent
                ? 'The cap is per student, not per college. It exists so that an alumnus who agreed to help gets three thoughtful messages a month instead of ninety.'
                : 'The cap keeps the directory answerable. It is not a penalty and nothing is recorded against you.'}
            </p>
          </Alert>
        </div>
      ) : null}
    </Card>
  );
}

function Meter({
  label,
  value,
  limit,
  tone,
  hint,
}: {
  label: string;
  value: number;
  limit: number;
  tone: 'brand' | 'warning' | 'danger';
  hint: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-secondary">{label}</p>
      <p className="font-display text-display-xs font-bold tabular">
        {value} <span className="text-lg font-semibold text-muted">of {limit}</span>
      </p>
      <Progress value={value} max={limit} tone={tone} label={`${label}: ${value} of ${limit}`} />
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

// ---------------------------------------------------------------
// Received
// ---------------------------------------------------------------

function ReceivedTab({
  waiting,
  answered,
}: {
  waiting: ConnectionRequest[];
  answered: ConnectionRequest[];
}) {
  if (waiting.length === 0 && answered.length === 0) {
    return (
      <EmptyState
        icon={<Inbox className="size-5" />}
        title="Nobody is waiting on you"
        description="Students find alumni through the directory, and the ones marked open to mentoring or referrals come up first. Turn those on in your profile and requests will start arriving."
        action={
          <ButtonLink href="/profile" variant="secondary">
            Check what you are open to
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      {waiting.length > 0 ? (
        <Section
          title={`${waiting.length} ${waiting.length === 1 ? 'request needs' : 'requests need'} a reply`}
          description="Declining is a complete answer. A request left alone expires quietly, and the sender is never told you ignored it."
        >
          <div className="space-y-4">
            {waiting.map((c) => (
              <RequestCard key={c.id} request={c} />
            ))}
          </div>
        </Section>
      ) : null}

      {answered.length > 0 ? (
        <Section
          title="Already answered"
          description="Kept so you can see who asked and what you decided."
        >
          <Card>
            <ul className="divide-y divide-line px-card">
              {answered.map((c) => (
                <li key={c.id}>
                  <AnsweredRow request={c} person={c.from} />
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      ) : null}
    </div>
  );
}

function RequestCard({ request }: { request: ConnectionRequest }) {
  const sender = request.from;
  const expiring = isExpiringSoon(request.expiresAt);

  return (
    <Card as="article" className="animate-fade-up">
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-start gap-3">
          <Avatar name={sender.fullName} src={sender.photoUrl} size="lg" />

          <div className="min-w-0 flex-1">
            <h3 className="font-display text-md font-semibold leading-snug">
              <Link href={`/directory/${sender.slug}`} className="link-quiet">
                {sender.fullName}
              </Link>
            </h3>
            <p className="mt-0.5 text-sm text-secondary">
              {memberLine([
                sender.departmentCode,
                sender.batchYear ? `Batch of ${sender.batchYear}` : null,
                sender.isStudent ? 'Final year' : sender.currentCompany,
                sender.isStudent ? null : sender.city,
              ]) || 'No branch or batch recorded'}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <KindBadge kind={request.kind} />
            {sender.isStudent ? <Badge tone="info">Student</Badge> : null}
          </div>
        </div>

        {request.message ? (
          <blockquote className="rounded border-l-2 border-line-strong bg-surface-sunken px-4 py-3 text-sm leading-relaxed text-secondary">
            <MessageSquare className="mb-1.5 size-3.5 text-muted" aria-hidden="true" />
            <p>{request.message}</p>
          </blockquote>
        ) : (
          <p className="rounded bg-surface-sunken px-4 py-3 text-sm text-muted">
            They sent no message — only the request itself. That usually means a first-timer, not
            a mass mailing.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Send className="size-3.5" aria-hidden="true" />
            Sent {formatDate(request.createdAt)}
          </span>
          {request.expiresAt ? (
            <span
              className={cn(
                'inline-flex items-center gap-1.5',
                expiring ? 'font-medium text-warning-fg' : null,
              )}
            >
              <Clock className="size-3.5" aria-hidden="true" />
              Closes {formatRelative(request.expiresAt)}
              {expiring ? ' — nearly out of time' : ''}
            </span>
          ) : null}
        </div>
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

function AnsweredRow({ request, person }: { request: ConnectionRequest; person: MemberSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <Avatar name={person.fullName} src={person.photoUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <Link href={`/directory/${person.slug}`} className="block truncate text-sm font-medium link-quiet">
          {person.fullName}
        </Link>
        <p className="truncate text-xs text-muted">
          {memberLine([
            KIND_LABEL[request.kind],
            `asked ${formatDate(request.createdAt)}`,
            request.respondedAt ? `answered ${formatDate(request.respondedAt)}` : null,
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

function SentTab({ sent, quota }: { sent: ConnectionRequest[]; quota: ConnectionQuota }) {
  if (sent.length === 0) {
    return (
      <EmptyState
        icon={<Send className="size-5" />}
        title="You have not asked anyone yet"
        description="Filter the directory by branch, batch, company or city. Members who have opted into mentoring or referrals are marked — they have already said yes to being asked, so start there."
        action={<ButtonLink href="/directory">Open the directory</ButtonLink>}
      />
    );
  }

  const open = sent.filter((c) => c.state === 'pending');
  const closed = sent.filter((c) => c.state !== 'pending');

  return (
    <div className="space-y-8">
      {open.length > 0 ? (
        <Section
          title={`${open.length} waiting for a reply`}
          description={`Each of these is holding one of your ${quota.openLimit} open slots.`}
        >
          <div className="space-y-4">
            {open.map((c) => (
              <SentCard key={c.id} request={c} />
            ))}
          </div>
        </Section>
      ) : null}

      {closed.length > 0 ? (
        <Section title="Closed" description="What happened, and what you can do next.">
          <div className="space-y-4">
            {closed.map((c) => (
              <SentCard key={c.id} request={c} />
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

function SentCard({ request }: { request: ConnectionRequest }) {
  const person = request.to;
  const next = NEXT_STEP[request.state];
  const expiring = isExpiringSoon(request.expiresAt);

  return (
    <Card as="article">
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-start gap-3">
          <Avatar name={person.fullName} src={person.photoUrl} size="md" />

          <div className="min-w-0 flex-1">
            <h3 className="font-display text-md font-semibold leading-snug">
              <Link href={`/directory/${person.slug}`} className="link-quiet">
                {person.fullName}
              </Link>
            </h3>
            <p className="mt-0.5 truncate text-sm text-secondary">
              {memberLine([
                person.designation,
                person.currentCompany,
                person.city,
                person.batchYear ? `Batch of ${person.batchYear}` : null,
              ]) || 'No company or city shared'}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <KindBadge kind={request.kind} />
            <StateBadge state={request.state} />
          </div>
        </div>

        {request.message ? (
          <p className="line-clamp-2 border-l-2 border-line pl-3 text-sm text-secondary">
            {request.message}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Send className="size-3.5" aria-hidden="true" />
            Sent {formatDate(request.createdAt)}
          </span>
          {request.state === 'pending' && request.expiresAt ? (
            <span
              className={cn(
                'inline-flex items-center gap-1.5',
                expiring ? 'font-medium text-warning-fg' : null,
              )}
            >
              <Hourglass className="size-3.5" aria-hidden="true" />
              Expires {formatRelative(request.expiresAt)}
            </span>
          ) : null}
          {request.respondedAt ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" aria-hidden="true" />
              Answered {formatDate(request.respondedAt)}
            </span>
          ) : null}
        </div>

        {next ? (
          <div className="rounded bg-surface-sunken px-3.5 py-3 text-sm text-secondary">
            <p className="font-medium text-primary">{next.title}</p>
            <p className="mt-0.5">{next.body}</p>
          </div>
        ) : null}
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
          <ButtonLink href={`/directory/${person.slug}`} variant="secondary" size="sm">
            Open their profile
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
        </div>
      ) : null}
    </Card>
  );
}

const NEXT_STEP: Partial<Record<ConnectionState, { title: string; body: string }>> = {
  declined: {
    title: 'They said no this time',
    body: 'You will not be told why, and you should not read much into it — most declines are timing. Your slot is already back. Someone else in the same company or batch is usually the better next move.',
  },
  expired: {
    title: 'It closed without an answer',
    body: 'The slot is back. If you still need this, send it again with a shorter, more specific ask — one question, and what you have already tried.',
  },
  withdrawn: {
    title: 'You withdrew this one',
    body: 'Nothing was sent on. You can approach the same person again whenever you are ready.',
  },
  blocked: {
    title: 'This member is not accepting requests from you',
    body: 'Do not send another. If you think this is a mistake, write to the alumni cell rather than to them.',
  },
  accepted: {
    title: 'Accepted',
    body: 'Their profile is open to you now. Contact details appear there only if their own visibility setting shares them.',
  },
};

// ---------------------------------------------------------------
// Accepted
// ---------------------------------------------------------------

function AcceptedTab({
  accepted,
  viewerId,
  sentCount,
}: {
  accepted: ConnectionRequest[];
  viewerId: string;
  sentCount: number;
}) {
  if (accepted.length === 0) {
    return (
      <EmptyState
        icon={<Handshake className="size-5" />}
        title="No accepted connections yet"
        description="This is where an accepted request lands — and where contact details appear, if the other person has chosen to share them on accept. Nothing here means nobody has replied yet, not that you did anything wrong."
        action={
          sentCount > 0 ? (
            <ButtonLink href="/connections?tab=sent" variant="secondary">
              See what you have sent
            </ButtonLink>
          ) : (
            <ButtonLink href="/directory">Find someone to ask</ButtonLink>
          )
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <Alert tone="info" title="This is where contact details unlock" icon={<Lock className="size-4" />}>
        <p>
          An accepted request opens the other person&apos;s profile to you. Whether their email or
          mobile appears there is still their decision — a member who keeps contact details private
          stays private, accepted or not. Use whatever they share for the reason you asked; the
          college logs every release.
        </p>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2">
        {accepted.map((c) => {
          const person = c.from.id === viewerId ? c.to : c.from;
          const theyAsked = c.to.id === viewerId;

          return (
            <Card key={c.id} as="article" interactive className="relative">
              <CardBody className="space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar name={person.fullName} src={person.photoUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-md font-semibold leading-snug">
                      <Link
                        href={`/directory/${person.slug}`}
                        className="link-quiet after:absolute after:inset-0"
                      >
                        {person.fullName}
                      </Link>
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-secondary">
                      {memberLine([
                        person.departmentCode,
                        person.batchYear,
                        person.currentCompany ?? (person.isStudent ? 'Final year' : null),
                      ]) || 'No details shared yet'}
                    </p>
                  </div>
                  <UserCheck className="size-4 shrink-0 text-success-fg" aria-hidden="true" />
                </div>

                <Separator />

                <p className="text-xs text-muted">
                  {theyAsked ? 'They asked you' : 'You asked'} for{' '}
                  {KIND_LABEL[c.kind].toLowerCase()} ·{' '}
                  {c.respondedAt ? `connected ${formatDate(c.respondedAt)}` : 'connected'}
                </p>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <MarginNote>
        A connection is not a subscription — it does not give either of you a channel the other
        cannot close. Either side can ask the alumni cell to end it.
      </MarginNote>
    </div>
  );
}

// ---------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------

const KIND_LABEL: Record<ConnectionKind, string> = {
  mentorship: 'Mentorship',
  referral: 'Referral',
  introduction: 'Introduction',
  speaking: 'Speaking invitation',
};

const KIND_TONE: Record<ConnectionKind, 'success' | 'brand' | 'info' | 'accent'> = {
  mentorship: 'success',
  referral: 'brand',
  introduction: 'info',
  speaking: 'accent',
};

function KindBadge({ kind }: { kind: ConnectionKind }) {
  return <Badge tone={KIND_TONE[kind]}>{KIND_LABEL[kind]}</Badge>;
}

const STATE_LABEL: Record<ConnectionState, string> = {
  pending: 'Awaiting reply',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
  withdrawn: 'Withdrawn',
  blocked: 'Blocked',
};

const STATE_TONE: Record<ConnectionState, 'warning' | 'success' | 'neutral' | 'danger'> = {
  pending: 'warning',
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

/** Under a week left. Presentation only — the repo owns the real clock. */
function isExpiringSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return ms > 0 && ms < 7 * 86400000;
}
