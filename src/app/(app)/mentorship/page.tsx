import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Compass,
  Earth,
  FileText,
  Inbox,
  MessageSquare,
  Repeat,
  Rocket,
  Wrench,
} from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { can, require as requireCap, type Session } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import {
  getConnectionQuota,
  getConnections,
  getDepartments,
  getOwnProfile,
} from '@/lib/data/repo';
import {
  getMentorTopics,
  getMentorsByTopic,
  getMentorsForDepartment,
  getMentorshipStats,
  type MentorTopic,
} from '@/lib/data/content';
import {
  Avatar,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  CopyButton,
  Disclosure,
  EmptyState,
  Section,
} from '@/components/ui';
import { BandChip, PageBand } from '@/components/brand/PageBand';
import { MemberCard } from '@/components/members/MemberCard';
import { RequestIntroButton } from '@/components/directory/RequestIntroButton';
import { availabilityEntries } from '@/lib/availability-copy';
import { joinList } from '@/lib/branding/copy';
import { CONNECTION_LIMITS } from '@/lib/config';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import { viewerBranch } from '@/lib/identity';
import { siteOrigin } from '@/lib/share';
import type { ConnectionKind, ConnectionQuota, ConnectionRequest, MemberSummary } from '@/lib/data/types';
import { BecomeMentorCard } from './BecomeMentorCard';

/**
 * The mentorship hub — organised by question, not by job title.
 *
 * A final-year does not know they are looking for "a Senior Software
 * Engineer at a product company". They know they are trying to decide
 * whether to take the service-company offer already in hand. Every entry
 * point on this page is therefore a question somebody actually has, and
 * the seniority of whoever answers it is a detail on their card.
 *
 * The page branches on who is looking. A student starts from the
 * questions and their own branch; a graduate or a member of faculty
 * starts from what is waiting for them and what they are open to.
 */

export const metadata: Metadata = {
  title: 'Mentorship',
  description: 'Graduates who have agreed to be asked, grouped by the question a final-year actually has.',
};

const TOPIC_ICON: Record<string, typeof Compass> = {
  interviews: MessageSquare,
  'first-job': Briefcase,
  'higher-studies': BookOpen,
  'core-vs-software': Wrench,
  abroad: Earth,
  startups: Rocket,
  resume: FileText,
  'career-change': Repeat,
};

/** Below this, "{n} work abroad" is not worth a line of its own. */
const ABROAD_LINE_FROM = 3;

export default async function MentorshipPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.mentorship) notFound();

  // Hiding the sidebar link is presentation. This is the authorisation:
  // mentorship is the directory's request channel wearing a friendlier
  // name, and it needs the same capability the channel does.
  requireCap(session, 'connection.send');

  const isStudent = session.roles.some((r) => r.role === 'student');
  const topics = getMentorTopics();
  const stats = getMentorshipStats();
  const own = getOwnProfile(session);
  const shortName = pack.copy.shortName;

  // Three faces per question, projected for this viewer exactly as the
  // directory would project them.
  const faces = new Map(topics.map((t) => [t.id, getMentorsByTopic(session, t.id, 3)]));

  // The busiest topic is what a dead-end topic offers instead of nothing.
  const busiest = topics.reduce<MentorTopic | null>(
    (best, t) => (t.mentorCount > (best?.mentorCount ?? 0) ? t : best),
    null,
  );

  // The question with the most graduates behind it leads at double width on
  // a wide screen, and the rest keep their order. Nothing is dropped.
  const ranked = busiest && busiest.mentorCount > 0 ? [busiest, ...topics.filter((t) => t.id !== busiest.id)] : topics;
  const grid = (
    <ul className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {ranked.map((topic, i) => {
        const lead = i === 0 && busiest?.id === topic.id && topic.mentorCount > 0;
        return (
          <li
            key={topic.id}
            style={{ '--i': i } as React.CSSProperties}
            className={cn('relative min-w-0', lead && 'xl:col-span-2')}
          >
            <TopicCard topic={topic} faces={faces.get(topic.id) ?? []} fallback={busiest} lead={lead} />
          </li>
        );
      })}
    </ul>
  );

  if (isStudent) {
    const quota = getConnectionQuota(session);
    const openLeft = Math.max(0, quota.openLimit - quota.openRequests);
    const monthLeft = Math.max(0, quota.monthlyLimit - quota.usedThisMonth);
    const available = Math.min(openLeft, monthLeft);

    return (
      <div className="space-y-8">
        <PageBand
          pack={pack}
          size="compact"
          eyebrow="Mentorship"
          title={`Ask a ${shortName} graduate`}
          lead={
            stats.mentors > 0
              ? `Pick your question. ${stats.mentors.toLocaleString('en-IN')} graduates have said yes to being asked.`
              : 'Pick your question. Graduates appear here as they say yes to being asked.'
          }
          meta={
            <BandChip href="/connections?tab=sent">
              {available > 0
                ? `${available} ${available === 1 ? 'request' : 'requests'} available · ${monthLeft} left this month`
                : monthLeft === 0
                  ? 'No requests left this month'
                  : 'Your requests are all waiting for replies'}
            </BandChip>
          }
        />

        <Section title="Pick your question">
          {grid}
          {stats.abroad >= ABROAD_LINE_FROM ? (
            <p className="text-sm text-secondary">
              <Link href="/mentorship/abroad" className="link inline-flex min-h-11 items-center gap-1.5 font-medium">
                {stats.abroad.toLocaleString('en-IN')} graduates who mentor work outside India
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </p>
          ) : null}
        </Section>

        <StudentBranch session={session} quota={quota} openLeft={openLeft} monthLeft={monthLeft} connectionsOn={pack.features.connections} />

        <p className="max-w-prose border-t border-line pt-4 text-sm text-secondary">
          Graduates reply when they can. A short, specific question gets the fastest answer.
        </p>
      </div>
    );
  }

  // ---- Graduates and faculty ----------------------------------------
  const received: ConnectionRequest[] = can(session, 'connection.receive') ? getConnections(session, 'received') : [];
  const isAlumnus = session.roles.some((r) => r.role === 'alumni');
  const audience = isAlumnus ? ('alumni' as const) : ('faculty' as const);
  const ctx = {
    audience,
    company: own?.currentCompany ?? null,
    officeName: pack.copy.officeName,
    openLimit: CONNECTION_LIMITS.studentOpenRequests,
  };
  const current = {
    mentoring: own?.openToMentoring ?? false,
    referrals: own?.openToReferrals ?? false,
    speaking: own?.openToSpeaking ?? false,
  };
  const on = availabilityEntries(ctx).filter((e) => current[e.key]);
  const lead = on.length
    ? `You are open to ${joinList(on.map((e) => e.label.replace(/^Open to /, '')))}.`
    : 'Switch on what you are open to, and students can find you by the question they have.';

  const waiting = received.filter((c) => c.state === 'pending');
  const oldest = waiting.reduce<ConnectionRequest | null>(
    (o, c) => (!o || c.createdAt < o.createdAt ? c : o),
    null,
  );
  const timing = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };
  const hubUrl = isAlumnus ? null : `${await siteOrigin()}/mentorship`;

  return (
    <div className="space-y-8">
      <PageBand
        pack={pack}
        size="compact"
        eyebrow="Mentorship"
        title={`Help ${shortName} final-year students`}
        lead={lead}
      />

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_22rem]">
        <aside
          aria-label="Requests for you"
          className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:col-start-2 lg:row-start-1 lg:self-start"
        >
          <Card>
            <CardBody className="space-y-3">
              {waiting.length > 0 ? (
                <>
                  <p className="flex items-center gap-3">
                    <span
                      className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-soft-fg"
                      aria-hidden="true"
                    >
                      <Inbox className="size-5" />
                    </span>
                    <span className="font-display text-display-sm font-bold leading-none tabular">{waiting.length}</span>
                    <span className="font-display text-lg font-semibold leading-tight">
                      {waiting.length === 1 ? 'request' : 'requests'} waiting
                    </span>
                  </p>
                  {oldest ? (
                    <p className="text-sm text-secondary">The oldest arrived {formatRelative(oldest.createdAt, timing)}.</p>
                  ) : null}
                  <ButtonLink href="/connections?tab=received" className="min-h-11 w-full">
                    Reply
                  </ButtonLink>
                </>
              ) : current.mentoring ? (
                <>
                  <p className="font-display text-lg font-semibold">You are listed for final-year students.</p>
                  <p className="text-sm text-secondary">Nothing is waiting for you right now.</p>
                  <ButtonLink href="/profile/preview" variant="secondary" className="min-h-11 w-full">
                    See how students see your card
                  </ButtonLink>
                </>
              ) : (
                <>
                  <p className="font-display text-lg font-semibold">You are not listed for students yet.</p>
                  <p className="text-sm text-secondary">Turn on mentoring and you appear under the questions your record matches.</p>
                  <ButtonLink href="#availability" variant="secondary" className="min-h-11 w-full">
                    Choose what you are open to
                  </ButtonLink>
                </>
              )}
            </CardBody>
          </Card>

          {hubUrl ? (
            <Card>
              <CardHeader variant="stack">
                <CardTitle as="h2" className="text-md">
                  Point your students here
                </CardTitle>
                <CardDescription>Students find graduates by the question they have.</CardDescription>
              </CardHeader>
              <CardBody>
                <CopyButton text={hubUrl} label="Copy the link" copiedLabel="Link copied" />
              </CardBody>
            </Card>
          ) : null}
        </aside>

        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <BecomeMentorCard
            mentoring={current.mentoring}
            referrals={current.referrals}
            speaking={current.speaking}
            audience={audience}
            company={ctx.company}
            officeName={ctx.officeName}
            openLimit={ctx.openLimit}
          />
        </div>
      </div>

      <Section
        title="The questions students pick from"
        description="With mentoring on, you appear under each question your record matches."
      >
        {grid}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------
// Topic cards
// ---------------------------------------------------------------

function TopicCard({
  topic,
  faces,
  fallback,
  lead = false,
}: {
  topic: MentorTopic;
  faces: MemberSummary[];
  fallback: MentorTopic | null;
  lead?: boolean;
}) {
  const Icon = TOPIC_ICON[topic.id] ?? Compass;
  const empty = topic.mentorCount === 0;
  // Only worth offering if it actually has people behind it — pointing a
  // dead end at another dead end is worse than saying nothing.
  const alternative =
    fallback && fallback.id !== topic.id && fallback.mentorCount > 0 ? fallback : null;

  return (
    <Card
      as="article"
      interactive={!empty}
      className={cn('relative isolate flex h-full flex-col overflow-hidden p-card', lead && 'xl:p-7')}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'grid shrink-0 place-items-center rounded-full',
            lead ? 'size-14' : 'size-11',
            empty
              ? 'bg-surface-sunken text-secondary'
              : 'bg-brand-soft text-brand-soft-fg shadow-[0_0_0_5px_color-mix(in_srgb,var(--brand-soft)_45%,transparent)]',
          )}
          aria-hidden="true"
        >
          <Icon className={lead ? 'size-6' : 'size-5'} />
        </span>
        {empty ? null : (
          <p className="text-right leading-none">
            <span
              className={`block font-display ${lead ? 'text-display-sm' : 'text-display-xs'} font-bold tabular text-primary`}
            >
              {topic.mentorCount.toLocaleString('en-IN')}
            </span>
            <span className="mt-1 block text-xs font-medium text-secondary">
              {topic.mentorCount === 1 ? 'graduate' : 'graduates'}
            </span>
          </p>
        )}
      </div>

      <div className="mt-4 min-w-0 flex-1">
        <h3
          className={cn(
            'font-display font-semibold leading-snug tracking-tight',
            lead ? 'text-xl' : 'text-md',
          )}
        >
          {empty ? (
            topic.label
          ) : (
            <Link href={`/mentorship/${topic.id}`} className="link-quiet after:absolute after:inset-0 after:rounded-lg">
              {topic.label}
            </Link>
          )}
        </h3>
        <p className={cn('mt-1.5 text-sm text-secondary', lead ? 'max-w-prose' : 'line-clamp-3')}>
          {topic.description}
        </p>
      </div>

      <div className="mt-5">
        {empty ? (
          <p className="relative z-10 text-sm text-secondary">
            No graduate matches this one yet.{' '}
            {alternative ? (
              <Link href={`/mentorship/${alternative.id}`} className="link">
                Try {alternative.label}
              </Link>
            ) : null}
          </p>
        ) : (
          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            <span className="flex -space-x-2" aria-hidden="true">
              {faces.map((m) => (
                <span key={m.id} className="rounded-full ring-2 ring-surface-raised">
                  <Avatar name={m.fullName} src={m.photoUrl} size={lead ? 'md' : 'sm'} />
                </span>
              ))}
            </span>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-fg">
              See who
              <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------
// Student view: their own branch, their requests
// ---------------------------------------------------------------

/** What a graduate has said yes to, in the directory's order. */
function offeredKinds(m: MemberSummary): ConnectionKind[] {
  const kinds: ConnectionKind[] = [];
  if (m.openToMentoring) kinds.push('mentorship');
  if (m.openToReferrals) kinds.push('referral');
  if (m.openToSpeaking) kinds.push('speaking');
  kinds.push('introduction');
  return kinds;
}

function StudentBranch({
  session,
  quota,
  openLeft,
  monthLeft,
  connectionsOn,
}: {
  session: Session;
  quota: ConnectionQuota;
  openLeft: number;
  monthLeft: number;
  connectionsOn: boolean;
}) {
  const departmentCode = viewerBranch(session);
  // The viewer is threaded through so this list narrows through the same
  // projection the directory uses.
  const mentors = getMentorsForDepartment(session, departmentCode, 8).filter((m) => m.id !== session.memberId);
  const ownBranch = departmentCode ? mentors.filter((m) => m.departmentCode === departmentCode) : [];
  // Six at most: the rest are one "See all" away in the directory.
  const shown = (ownBranch.length > 0 ? ownBranch : mentors).slice(0, 6);
  const branchName = getDepartments().find((d) => d.code === departmentCode)?.name ?? departmentCode;

  // The same conditions the profile page applies before it offers the
  // request button. The connections API checks all of them again.
  const sent = getConnections(session, 'sent');
  const asked = new Set(sent.filter((c) => c.state === 'pending').map((c) => c.to.id));
  const connected = new Set(
    getConnections(session, 'accepted').flatMap((c) => [c.from.id, c.to.id]),
  );
  const mayAsk = connectionsOn && can(session, 'connection.send') && quota.canSend;

  const action = (m: MemberSummary) =>
    asked.has(m.id) ? (
      <Badge tone="brand">Asked</Badge>
    ) : connected.has(m.id) ? (
      <Badge tone="success">Connected</Badge>
    ) : mayAsk ? (
      <RequestIntroButton
        toMemberId={m.id}
        toName={m.fullName}
        kinds={offeredKinds(m)}
        defaultKind={offeredKinds(m)[0]!}
        quota={quota}
        label="Ask"
        variant="secondary"
        size="sm"
        className="min-h-11 sm:min-h-0"
      />
    ) : null;

  const inUse = Math.max(0, quota.openLimit - openLeft);

  return (
    <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Section
        className="min-w-0"
        title={ownBranch.length > 0 ? 'From your branch' : 'Open to being asked'}
        description={
          ownBranch.length > 0
            ? `${branchName} graduates who sat the same papers you are sitting now.`
            : departmentCode
              ? `Nobody from ${departmentCode} has said yes yet. These graduates from other branches have.`
              : undefined
        }
        actions={
          departmentCode && ownBranch.length > 0 ? (
            <ButtonLink
              href={`/directory?department=${encodeURIComponent(departmentCode)}&mentoring=1`}
              variant="ghost"
              size="sm"
              className="min-h-11 sm:min-h-0"
            >
              See all
              <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
          ) : null
        }
      >
        {shown.length === 0 ? (
          <EmptyState
            variant="inline"
            title="No graduate has said yes to being asked yet."
            action={
              <Link href="/directory" className="link inline-flex min-h-11 items-center">
                Browse the directory
              </Link>
            }
          />
        ) : (
          // A sideways rail on a phone, two columns from sm.
          <ul className="scroll-fade-x -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0">
            {shown.map((m) => (
              <li key={m.id} className="relative w-[17rem] shrink-0 snap-start sm:w-auto sm:min-w-0">
                <MemberCard member={m} className="h-full" action={action(m)} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <aside aria-label="Your requests" className="min-w-0 space-y-4 lg:pt-12">
        <Card>
          <CardBody className="space-y-3">
            <p className="font-sans text-sm font-semibold">Your requests</p>
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {Array.from({ length: quota.openLimit }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    'size-3.5 rounded-full',
                    i < openLeft ? 'bg-[var(--button-primary-bg)]' : 'border-2 border-line-strong',
                  )}
                />
              ))}
            </div>
            <p className="text-sm">
              <span className="font-semibold">{openLeft} available</span>
              {inUse > 0 ? <span className="text-secondary"> · {inUse} waiting for a reply</span> : null}
            </p>
            <p className="text-sm text-secondary">
              A slot comes back when a graduate replies. {monthLeft} left this month.
            </p>
            <Link href="/connections?tab=sent" className="link inline-flex min-h-11 items-center text-sm font-medium">
              See what you have sent
            </Link>
          </CardBody>
        </Card>

        <Disclosure summary="How to ask">
          <p>
            Keep it to four lines: who you are, the one decision you are stuck on, and what you have already tried.
            Ask before you apply somewhere, not after a rejection, while an answer can still change something.
          </p>
        </Disclosure>
      </aside>
    </div>
  );
}
