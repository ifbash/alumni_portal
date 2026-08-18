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
  GraduationCap,
  Inbox,
  Megaphone,
  MessageSquare,
  Repeat,
  Rocket,
  Send,
  TriangleAlert,
  Users,
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
  getMentorsForDepartment,
  getMentorshipStats,
  type MentorTopic,
} from '@/lib/data/content';
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  EmptyState,
  PageHeader,
  Progress,
  Section,
  Stat,
} from '@/components/ui';
import { BarList } from '@/components/charts';
import { MemberCard } from '@/components/members/MemberCard';
import { CircleMark, MarginNote } from '@/components/brand/Marks';
import { cn } from '@/lib/cn';
import type { ConnectionQuota, ConnectionRequest } from '@/lib/data/types';
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
 * The page branches on who is looking, because the two cohorts arrive with
 * opposite problems. A student needs to know who is nearest to them and
 * how many requests they have left. An alumnus needs to know exactly what
 * they are signing up for before they flip a switch that puts their name
 * in front of four hundred final-years.
 */

export const metadata: Metadata = {
  title: 'Mentorship',
  description:
    'Graduates who have agreed to be asked, grouped by the question a final-year actually has.',
};

/** Roughly a month, for "how busy has your inbox been" — presentation only. */
const RECENT_WINDOW_MS = 30 * 86400000;

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

  // The busiest topic is what a dead-end topic offers instead of nothing.
  const busiest = topics.reduce<MentorTopic | null>(
    (best, t) => (t.mentorCount > (best?.mentorCount ?? 0) ? t : best),
    null,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`${pack.copy.shortName} mentorship`}
        title="Ask a graduate"
        description={
          stats.mentors > 0
            ? `${stats.mentors} graduates have said, in writing, that final-years may write to them. They are grouped below by the question you have, not by the job title they hold — the useful person is rarely the most senior one.`
            : 'No graduate has switched mentoring on yet, so the topics below are all empty. They are the questions this hub groups by, and they fill as batches verify their records and set their preferences.'
        }
        actions={
          stats.mentors > 0 ? (
            <ButtonLink href="/directory?mentoring=1" variant="secondary">
              <Users className="size-4" aria-hidden="true" />
              Browse all {stats.mentors}
            </ButtonLink>
          ) : (
            <ButtonLink href="/directory" variant="secondary">
              <Users className="size-4" aria-hidden="true" />
              Open the directory
            </ButtonLink>
          )
        }
      />

      {isStudent ? (
        <StudentPanel
          session={session}
          departmentCode={session.departmentId}
          quota={getConnectionQuota(session)}
        />
      ) : (
        <AlumnusPanel
          openToMentoring={own?.openToMentoring ?? false}
          openToReferrals={own?.openToReferrals ?? false}
          openToSpeaking={own?.openToSpeaking ?? false}
          received={can(session, 'connection.receive') ? getConnections(session, 'received') : []}
        />
      )}

      <Section
        title="Start from the question"
        description="Every topic below is a real question the alumni cell has been forwarded more than once. Pick the one you are actually stuck on."
      >
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {topics.map((topic) => (
            <li key={topic.id} className="relative">
              <TopicCard topic={topic} fallback={busiest} />
            </li>
          ))}
        </ul>
      </Section>

      <StatsStrip stats={stats} />

      <MarginNote className="max-w-prose border-t border-line pt-4">
        Nobody here is paid, rostered or obliged. A graduate who has switched mentoring on has
        agreed to read a message — not to answer within a day, not to get you a job. Treat the
        list as a set of people who said yes once, because that is exactly what it is.
      </MarginNote>
    </div>
  );
}

// ---------------------------------------------------------------
// Topic cards
// ---------------------------------------------------------------

function TopicCard({ topic, fallback }: { topic: MentorTopic; fallback: MentorTopic | null }) {
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
      className={cn('flex h-full flex-col p-card', empty && 'border-dashed')}
    >
      <div className="flex items-start gap-3 pb-4">
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded',
            empty ? 'bg-surface-sunken text-muted' : 'bg-brand-soft text-brand-soft-fg',
          )}
          aria-hidden="true"
        >
          <Icon className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-md font-semibold leading-snug">
            {empty ? (
              topic.label
            ) : (
              <Link
                href={`/mentorship/${topic.id}`}
                className="link-quiet after:absolute after:inset-0"
              >
                {topic.label}
              </Link>
            )}
          </h3>
          <p className="mt-1 text-sm text-secondary">{topic.description}</p>
        </div>
      </div>

      <div className="mt-auto border-t border-line pt-3">
        {empty ? (
          // A topic nobody has been matched to is left on the page and told
          // the truth. Hiding it would make the hub look complete and send
          // the student who needed it straight out of the portal.
          <p className="text-xs text-secondary">
            No graduate matches this one yet.{' '}
            {alternative ? (
              <>
                The nearest question with people behind it is{' '}
                <Link href={`/mentorship/${alternative.id}`} className="link">
                  {alternative.label}
                </Link>
                , with {alternative.mentorCount} listed.
              </>
            ) : (
              <>
                Try the{' '}
                <Link href="/directory?mentoring=1" className="link">
                  full list of graduates open to mentoring
                </Link>
                .
              </>
            )}
          </p>
        ) : (
          <p className="flex items-center justify-between gap-2 text-sm">
            <span className="text-secondary">
              <span className="font-semibold tabular text-primary">{topic.mentorCount}</span>{' '}
              {topic.mentorCount === 1 ? 'graduate' : 'graduates'}
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
          </p>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------
// Student view
// ---------------------------------------------------------------

/**
 * A student's own branch first.
 *
 * The strongest predictor of a reply is that the graduate sat the same
 * papers under the same lecturers. `getMentorsForDepartment` pads the list
 * with other branches when a branch is thin, so the two groups are split
 * here rather than presented as one undifferentiated wall — a MECH student
 * shown six CSE names without explanation concludes the portal is broken.
 */
function StudentPanel({
  session,
  departmentCode,
  quota,
}: {
  session: Session;
  departmentCode: string | null;
  quota: ConnectionQuota;
}) {
  // The viewer is threaded through so this list narrows through the same
  // projection the directory uses. Without it a student saw fields here
  // that /directory withholds from them.
  const mentors = getMentorsForDepartment(session, departmentCode, 8);
  const ownBranch = departmentCode
    ? mentors.filter((m) => m.departmentCode === departmentCode)
    : [];
  const otherBranches = mentors.filter((m) => !ownBranch.includes(m));

  const branchName =
    getDepartments().find((d) => d.code === departmentCode)?.name ?? departmentCode;

  const openLeft = Math.max(0, quota.openLimit - quota.openRequests);
  const monthLeft = Math.max(0, quota.monthlyLimit - quota.usedThisMonth);
  const tone = openLeft === 0 ? 'danger' : openLeft <= 1 ? 'warning' : 'brand';

  return (
    <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Section
        title={branchName ? `Graduates of ${branchName}` : 'Graduates open to mentoring'}
        description={
          !departmentCode
            ? 'Your branch is not on your record, so this list is not sorted by it. The alumni cell can correct your branch from your member record.'
            : ownBranch.length > 0
              ? 'They sat the same papers in the same building. That is usually worth more than a bigger company name.'
              : 'Nobody from your branch has volunteered yet — these graduates from other branches have, and a question about interview preparation or higher studies rarely turns on the branch.'
        }
        actions={
          departmentCode ? (
            <ButtonLink
              href={`/directory?department=${encodeURIComponent(departmentCode)}&mentoring=1`}
              variant="ghost"
              size="sm"
            >
              See all
              <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
          ) : null
        }
      >
        {mentors.length === 0 ? (
          <EmptyState
            icon={<GraduationCap className="size-5" />}
            title="No graduate has switched mentoring on yet"
            description="Availability is opt-in, and the list fills up as graduates verify their records and set their preferences. The alumni cell is writing to the batches that are already registered."
            action={
              <ButtonLink href="/directory" variant="secondary">
                Browse the directory instead
              </ButtonLink>
            }
          />
        ) : (
          <div className="space-y-5">
            {ownBranch.length > 0 ? (
              <ul className="grid gap-4 sm:grid-cols-2">
                {ownBranch.map((m) => (
                  <li key={m.id} className="relative">
                    <MemberCard member={m} className="h-full" />
                  </li>
                ))}
              </ul>
            ) : null}

            {otherBranches.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {!departmentCode
                    ? 'Open to being asked'
                    : ownBranch.length > 0
                      ? 'Also open to being asked, from other branches'
                      : 'From other branches'}
                </p>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {otherBranches.map((m) => (
                    <li key={m.id} className="relative">
                      <MemberCard member={m} className="h-full" />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </Section>

      <div className="space-y-4">
        <Card>
          <CardBody className="space-y-2.5">
            <p className="text-sm font-medium text-secondary">Requests open right now</p>
            <p className="font-display text-display-xs font-bold tabular">
              {quota.openRequests} <span className="text-lg font-semibold text-muted">of {quota.openLimit}</span>
            </p>
            <Progress
              value={quota.openRequests}
              max={quota.openLimit}
              tone={tone}
              label={`Open requests: ${quota.openRequests} of ${quota.openLimit}`}
            />
            <p className="text-xs text-muted">
              {openLeft > 0
                ? `${openLeft} more you can send today. ${monthLeft} left this month.`
                : `Every slot is in use. A slot comes back the moment somebody replies, and ${monthLeft} of this month's allowance is still unspent.`}
            </p>
            <p className="border-t border-line pt-2.5 text-xs text-secondary">
              The cap is the reason graduates still reply. It is per student, not per college —
              an alumnus who volunteered gets three considered messages a month instead of ninety.
            </p>
          </CardBody>
        </Card>

        {quota.reason ? (
          <Alert
            tone="warning"
            title="You cannot send another request just yet"
            icon={<TriangleAlert className="size-4" />}
          >
            <p>{quota.reason}</p>
            <p className="mt-1.5">
              <Link href="/connections?tab=sent" className="link">
                See what you have already sent
              </Link>
              .
            </p>
          </Alert>
        ) : null}

        <Card>
          <CardBody className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Send className="size-4 text-muted" aria-hidden="true" />
              How to ask so you get an answer
            </p>
            <p className="text-sm leading-relaxed text-secondary">
              Keep it to four lines — who you are, the single decision you are stuck on, and what
              you have already tried — and send it <em>before</em> you apply somewhere, not after
              the rejection, because that is the only point at which a graduate&apos;s answer can
              still change anything.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Alumnus view
// ---------------------------------------------------------------

function AlumnusPanel({
  openToMentoring,
  openToReferrals,
  openToSpeaking,
  received,
}: {
  openToMentoring: boolean;
  openToReferrals: boolean;
  openToSpeaking: boolean;
  received: ConnectionRequest[];
}) {
  const since = Date.now() - RECENT_WINDOW_MS;
  const recent = received.filter((c) => new Date(c.createdAt).getTime() >= since);
  const answered = recent.filter((c) => c.respondedAt !== null);
  const fromStudents = recent.filter((c) => c.from.isStudent).length;
  const waiting = received.filter((c) => c.state === 'pending');

  const anyOn = openToMentoring || openToReferrals || openToSpeaking;

  return (
    <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_22rem]">
      <BecomeMentorCard
        mentoring={openToMentoring}
        referrals={openToReferrals}
        speaking={openToSpeaking}
      />

      <div className="space-y-4">
        <Card>
          <CardBody className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-secondary">Your last thirty days</p>
              <p className="font-display text-display-xs font-bold tabular">
                {recent.length}{' '}
                <span className="text-lg font-semibold text-muted">
                  {recent.length === 1 ? 'request' : 'requests'}
                </span>
              </p>
              <p className="text-xs text-muted">
                {recent.length === 0
                  ? anyOn
                    ? 'Nobody has written to you this month. That is normal outside placement season.'
                    : 'Nobody can write to you while all three switches are off.'
                  : fromStudents === 0
                    ? `None of them from final-year students — these came from other graduates. You answered ${answered.length} of ${recent.length}.`
                    : `${fromStudents} of them from final-year students. You answered ${answered.length} of ${recent.length}.`}
              </p>
            </div>

            {recent.length > 0 ? (
              <Progress
                value={answered.length}
                max={recent.length}
                tone={answered.length === recent.length ? 'success' : 'brand'}
                label={`Answered ${answered.length} of ${recent.length} requests in the last thirty days`}
              />
            ) : null}

            <div className="border-t border-line pt-3">
              {waiting.length > 0 ? (
                <p className="text-sm text-secondary">
                  <Link href="/connections?tab=received" className="link font-medium">
                    {waiting.length} {waiting.length === 1 ? 'request is' : 'requests are'} still
                    waiting on you
                  </Link>
                  . Declining is a complete answer; a request left alone expires quietly and the
                  sender is never told you ignored it.
                </p>
              ) : (
                <p className="flex items-start gap-2 text-sm text-secondary">
                  <Inbox className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                  <span>Nothing is waiting on you. Your inbox is clear.</span>
                </p>
              )}
            </div>
          </CardBody>
        </Card>

        {!anyOn ? (
          <Alert tone="neutral" icon={<Megaphone className="size-4" />}>
            <p>
              With all three off you are still listed in the directory and can still be found by
              name — you are simply not offered to a student browsing for someone to ask. Turning
              one on adds you to that list and changes nothing else about your record.
            </p>
          </Alert>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Stats
// ---------------------------------------------------------------

function StatsStrip({ stats }: { stats: ReturnType<typeof getMentorshipStats> }) {
  return (
    <Section
      title="What the network currently offers"
      description="Three different commitments, counted separately, because a graduate who will read a resume is not necessarily one who will put their name on a referral."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Open to mentoring"
          value={stats.mentors.toLocaleString('en-IN')}
          hint="Will answer a question"
          icon={<MessageSquare className="size-4" />}
        />
        <Stat
          label="Open to referrals"
          value={stats.referrers.toLocaleString('en-IN')}
          hint="Will put a name forward internally"
          icon={<Briefcase className="size-4" />}
        />
        <Stat
          label="Open to speaking"
          value={stats.speakers.toLocaleString('en-IN')}
          hint="Will come back for a session"
          icon={<Megaphone className="size-4" />}
        />
        <Stat
          label="Mentoring from abroad"
          value={stats.abroad.toLocaleString('en-IN')}
          hint="Outside India, reachable here"
          icon={<Earth className="size-4" />}
        />
      </div>

      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardBody className="space-y-3">
            <div className="space-y-1">
              <h3 className="font-display text-md font-semibold">Mentors by branch</h3>
              <p className="text-sm text-secondary">
                Uneven, and worth saying so: the branches that graduated first have had longer to
                build a habit of coming back.
              </p>
            </div>
            <BarList
              data={stats.byDepartment}
              label="Graduates open to mentoring, by branch"
              formatValue={(n) => n.toLocaleString('en-IN')}
            />
            {stats.byDepartment.length === 0 ? null : (
              <p className="border-t border-line pt-3 text-xs text-muted">
                Branch codes as they appear on the degree register.
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex h-full flex-col justify-center gap-3">
            <h3 className="font-display text-md font-semibold">
              The number that surprises people
            </h3>
            <p className="text-md leading-relaxed text-secondary">
              <CircleMark className="font-semibold text-primary tabular">
                {stats.abroad.toLocaleString('en-IN')}
              </CircleMark>{' '}
              of the {stats.mentors.toLocaleString('en-IN')} graduates offering mentoring are
              working outside India.
            </p>
            <p className="text-sm text-secondary">
              That is the cohort no other channel reaches. They do not come to the annual meet,
              they are not on the batch WhatsApp group any more, and a phone call to them costs
              somebody an awkward hour. A written question they can answer on a Sunday is the only
              format that works — which is the entire argument for this module existing.
            </p>
            <p>
              <Badge tone="accent" dot>
                Higher studies and visas
              </Badge>
            </p>
          </CardBody>
        </Card>
      </div>
    </Section>
  );
}
