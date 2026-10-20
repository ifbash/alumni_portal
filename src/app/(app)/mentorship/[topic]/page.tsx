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
  MessageSquare,
  Repeat,
  Rocket,
  Users,
  Wrench,
} from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getConnectionQuota, getConnections } from '@/lib/data/repo';
import { getMentorTopics, getMentorsByTopic, type MentorTopic } from '@/lib/data/content';
import { Badge, Breadcrumbs, ButtonLink, ChipNav, EmptyState, HowThisWorks } from '@/components/ui';
import { BandChip, PageBand } from '@/components/brand/PageBand';
import { MemberCard } from '@/components/members/MemberCard';
import { RequestIntroButton } from '@/components/directory/RequestIntroButton';
import { yearsOut } from '@/lib/format';
import { viewerBranch } from '@/lib/identity';
import type { ConnectionKind, MemberSummary } from '@/lib/data/types';

/**
 * One question, and the graduates the register says can answer it.
 *
 * The grouping is a heuristic, not a declaration — asking eight thousand
 * alumni to tick eight boxes produces eight empty boxes, so the topic is
 * derived from branch, batch, employment history and location. That is a
 * defensible way to build the list and an indefensible thing to hide, so
 * the chips under the question state the rule, and the disclosure says
 * it in full.
 */

const SHOWN = 24;

/** The same glyphs the hub draws, so a topic keeps its mark when you open it. */
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

interface TopicCopy {
  /** The topic restated as the question a final-year actually asks. */
  question: string;
  /** The literal grouping rule, in words, given the branch codes present. Must match `getMentorsByTopic`. */
  heuristic: (codes: string) => string;
  /** What the list is therefore good and bad for. */
  caveat: string;
  /** The rule as a chip, where branches alone do not say it. */
  rule: string | null;
}

const COPY: Record<string, TopicCopy> = {
  interviews: {
    question: 'What should I be studying, in what order, and how long does it really take?',
    heuristic: (codes) =>
      `Graduates from the software branches${codes ? ` (${codes})` : ''} who left at least two years ago.`,
    caveat:
      'Two years out is deliberate: someone who sat the same interviews recently enough to remember the questions, and has since been on the other side of at least a few.',
    rule: '2+ years out',
  },
  'first-job': {
    question: 'Do I take the offer in hand, or hold out for something better?',
    heuristic: () => 'Graduates who are between three and eight years out of college.',
    caveat:
      'Close enough to remember making the same decision, far enough to know how it turned out. A graduate twenty years out has a good answer to a different question.',
    rule: '3 to 8 years out',
  },
  'higher-studies': {
    question: 'Is a masters worth it for my branch, and when should I go?',
    heuristic: () => 'Graduates who have themselves done a masters or a second qualification.',
    caveat:
      'Taken from the education section of their profile, so it is only as complete as they filled it in. Someone who studied further and never updated their record will not appear here.',
    rule: 'Further study on their record',
  },
  'core-vs-software': {
    question: 'Do I stay in my branch, or move to software like everyone else seems to?',
    heuristic: (codes) => `Graduates from the branches outside software${codes ? ` (${codes})` : ''}.`,
    caveat:
      'The list holds both outcomes on purpose. Some of these graduates stayed in core and some left for software, and the ones who stayed are usually the more useful conversation.',
    rule: null,
  },
  abroad: {
    question: 'How do people actually get out, and what is nobody telling me about the first year?',
    heuristic: () => 'Graduates whose current location on their profile is outside India.',
    caveat: 'Allow for the time difference and write; do not expect a call.',
    rule: 'Working outside India',
  },
  startups: {
    question: 'Should I join something small, or start something, instead of taking a job?',
    heuristic: () => 'Graduates whose current designation contains the word founder or co-founder.',
    caveat:
      'A small list by nature, and it includes the ones it did not work out for — which is the half of the picture a founder profile never shows you.',
    rule: 'Founders and co-founders',
  },
  resume: {
    question: 'Why is my resume not getting shortlisted?',
    heuristic: () => 'Graduates at least five years out of college.',
    caveat:
      'Five years is roughly when a graduate starts sitting on the screening side of a hiring loop, reading the pile rather than being in it.',
    rule: '5+ years out',
  },
  'career-change': {
    question: 'I think I picked wrong. Can I still change direction?',
    heuristic: () => 'Graduates who have more than one employer on their record.',
    caveat:
      'A change of employer is a rough proxy for a change of direction and it will catch some people who simply switched companies doing the same work. Read the profile before you write.',
    rule: 'More than one employer',
  },
};

const FALLBACK: TopicCopy = {
  question: 'Who can help me with this?',
  heuristic: () => 'Graduates who have switched mentoring on and have skills listed on their profile.',
  caveat: 'A broad list. Filter it yourself by branch, batch or company from the directory.',
  rule: null,
};

/**
 * Why this person is on this list, from fields the viewer may already
 * see. Null when the card already says it: the card prints the work line
 * and, when a city is shared, the place.
 */
function reasonFor(topicId: string, m: MemberSummary): string | null {
  switch (topicId) {
    case 'abroad':
      return m.city ? null : m.country ? `Works outside India · ${m.country}` : null;
    case 'startups':
      return m.designation || m.currentCompany ? null : 'Founder';
    case 'first-job':
    case 'resume':
    case 'interviews':
      return yearsOut(m.batchYear);
    default:
      return null;
  }
}

/** What a graduate has said yes to, in the directory's order. */
function offeredKinds(m: MemberSummary): ConnectionKind[] {
  const kinds: ConnectionKind[] = [];
  if (m.openToMentoring) kinds.push('mentorship');
  if (m.openToReferrals) kinds.push('referral');
  if (m.openToSpeaking) kinds.push('speaking');
  kinds.push('introduction');
  return kinds;
}

function findTopic(id: string): MentorTopic | null {
  return getMentorTopics().find((t) => t.id === id) ?? null;
}

const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ topic: string }>;
}): Promise<Metadata> {
  const { topic: id } = await params;
  const topic = findTopic(id);
  if (!topic) return { title: 'Topic not found' };

  return {
    title: topic.label,
    description: (COPY[topic.id] ?? FALLBACK).question,
  };
}

export default async function MentorTopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ topic: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  if (!resolved.brand.pack.features.mentorship) notFound();

  requireCap(session, 'connection.send');

  const { topic: id } = await params;
  const topic = findTopic(id);
  if (!topic) notFound();

  const copy = COPY[topic.id] ?? FALLBACK;
  const mentors = getMentorsByTopic(session, topic.id, SHOWN);
  const isStudent = session.roles.some((r) => r.role === 'student');
  const quota = isStudent ? getConnectionQuota(session) : null;

  const pack = resolved.brand.pack;
  const mine = viewerBranch(session);

  // The fetched list, without the viewer's own card, the viewer's own
  // branch first for a student. Every filter below narrows this array
  // and nothing else.
  const pool = mentors
    .filter((m) => m.id !== session.memberId)
    .sort((a, b) =>
      isStudent && mine ? Number(b.departmentCode === mine) - Number(a.departmentCode === mine) : 0,
    );

  const byBranch = new Map<string, number>();
  for (const m of pool) if (m.departmentCode) byBranch.set(m.departmentCode, (byBranch.get(m.departmentCode) ?? 0) + 1);
  const codes = [...byBranch.entries()]
    .sort((a, b) => (isStudent && mine ? Number(b[0] === mine) - Number(a[0] === mine) : 0) || b[1] - a[1])
    .map(([c]) => c);
  const abroad = pool.filter((m) => m.country && m.country !== 'IN');
  const refers = pool.filter((m) => m.openToReferrals);

  const sp = await searchParams;
  const show = one(sp.show);
  const requestedBranch = one(sp.branch)?.toUpperCase();
  const branch = requestedBranch && byBranch.has(requestedBranch) ? requestedBranch : null;
  const filtered =
    branch !== null
      ? pool.filter((m) => m.departmentCode === branch)
      : show === 'abroad'
        ? abroad
        : show === 'refers'
          ? refers
          : pool;

  const base = `/mentorship/${topic.id}`;
  const codeList = codes.length > 5 ? `${codes.slice(0, 5).join(', ')} and ${codes.length - 5} more` : codes.join(', ');

  // Ask, under the same conditions the profile page applies before it
  // offers the request button. The connections API checks them again.
  const askQuota = quota ?? getConnectionQuota(session);
  const sent = getConnections(session, 'sent');
  const asked = new Set(sent.filter((c) => c.state === 'pending').map((c) => c.to.id));
  const connected = new Set(getConnections(session, 'accepted').flatMap((c) => [c.from.id, c.to.id]));
  const mayAsk = pack.features.connections && can(session, 'connection.send') && askQuota.canSend;

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
        quota={askQuota}
        label="Ask"
        variant="secondary"
        size="sm"
        className="min-h-11 sm:min-h-0"
      />
    ) : null;

  const openLeft = quota ? Math.max(0, quota.openLimit - quota.openRequests) : 0;
  const monthLeft = quota ? Math.max(0, quota.monthlyLimit - quota.usedThisMonth) : 0;
  const available = Math.min(openLeft, monthLeft);

  const Icon = TOPIC_ICON[topic.id] ?? Compass;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Mentorship', href: '/mentorship' }, { label: topic.label }]} />

      <PageBand
        pack={pack}
        size="compact"
        eyebrow={topic.label}
        title={copy.question}
        meta={
          <>
            <BandChip icon={<Icon />}>
              {topic.mentorCount.toLocaleString('en-IN')} {topic.mentorCount === 1 ? 'graduate' : 'graduates'}
            </BandChip>
            {codeList ? <BandChip>{codeList}</BandChip> : null}
            {copy.rule ? <BandChip>{copy.rule}</BandChip> : null}
            {quota ? (
              <BandChip href="/connections?tab=sent">
                {available > 0
                  ? `${available} ${available === 1 ? 'request' : 'requests'} available`
                  : monthLeft === 0
                    ? 'No requests left this month'
                    : 'Your requests are all waiting for replies'}
              </BandChip>
            ) : null}
          </>
        }
      />

      <HowThisWorks summary="How we grouped them" className="max-w-prose">
        <p>
          {copy.heuristic(codes.join(', '))} {copy.caveat}
        </p>
        <p>
          Nobody on this page chose this topic by hand. The portal grouped them from their own record, and any of
          them can correct it from their profile.
        </p>
      </HowThisWorks>

      {pool.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title="Nobody matches this question yet"
          description="It fills as more graduates verify their records and switch mentoring on."
          action={
            <ButtonLink href="/directory?mentoring=1" variant="secondary">
              Everyone open to mentoring
            </ButtonLink>
          }
        />
      ) : (
        <section aria-labelledby="topic-mentors" className="space-y-4">
          <h2 id="topic-mentors" className="sr-only">
            Graduates for this question
          </h2>
          <ChipNav
            ariaLabel="Filter graduates"
            items={[
              { label: 'All', href: base, active: !branch && show !== 'abroad' && show !== 'refers', count: pool.length },
              ...codes.map((c) => ({
                label: c,
                href: `${base}?branch=${encodeURIComponent(c)}`,
                active: branch === c,
                count: byBranch.get(c),
              })),
              ...(abroad.length > 0
                ? [{ label: 'Works abroad', href: `${base}?show=abroad`, active: !branch && show === 'abroad', count: abroad.length }]
                : []),
              ...(refers.length > 0
                ? [{ label: 'Also refers', href: `${base}?show=refers`, active: !branch && show === 'refers', count: refers.length }]
                : []),
            ]}
          />

          <ul className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((member, i) => (
              // `relative` so the card's overlay link covers the tile and
              // nothing outside it.
              <li
                key={member.id}
                className="relative min-w-0"
                style={i < 9 ? ({ '--i': i } as React.CSSProperties) : undefined}
              >
                <MemberCard
                  member={member}
                  className="h-full"
                  note={reasonFor(topic.id, member)}
                  action={action(member)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-1 border-t border-line pt-4 text-sm text-secondary sm:flex-row sm:items-center sm:justify-between">
        <p>Contact details show on a profile only when the graduate&rsquo;s own privacy setting allows it.</p>
        <Link href="/directory?mentoring=1" className="link inline-flex min-h-11 items-center gap-1.5 font-medium">
          See all mentors in the directory
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
