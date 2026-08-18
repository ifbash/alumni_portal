import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Compass, Info, Users } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getConnectionQuota } from '@/lib/data/repo';
import { getMentorTopics, getMentorsByTopic, type MentorTopic } from '@/lib/data/content';
import {
  Alert,
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  EmptyState,
  PageHeader,
  Section,
} from '@/components/ui';
import { MemberCard } from '@/components/members/MemberCard';
import { MarginNote } from '@/components/brand/Marks';

/**
 * One question, and the graduates the register says can answer it.
 *
 * The grouping is a heuristic, not a declaration — asking eight thousand
 * alumni to tick eight boxes produces eight empty boxes, so the topic is
 * derived from branch, batch, employment history and location. That is a
 * defensible way to build the list and an indefensible thing to hide, so
 * every page states the rule it used in one sentence. A student who knows
 * "these are graduates at least five years out" can judge the list; one
 * who thinks each person hand-picked this topic cannot.
 */

const SHOWN = 24;

interface TopicCopy {
  /** The topic restated as the question a final-year actually asks. */
  question: string;
  /** The literal grouping rule, in words. Must match `getMentorsByTopic`. */
  heuristic: string;
  /** What the list is therefore good and bad for. */
  caveat: string;
}

const COPY: Record<string, TopicCopy> = {
  interviews: {
    question: 'What should I be studying, in what order, and how long does it really take?',
    heuristic:
      'Graduates from the software branches — CSE, IT and AIML — who left at least two years ago.',
    caveat:
      'Two years out is deliberate: someone who sat the same interviews recently enough to remember the questions, and has since been on the other side of at least a few.',
  },
  'first-job': {
    question: 'Do I take the offer in hand, or hold out for something better?',
    heuristic: 'Graduates who are between three and eight years out of college.',
    caveat:
      'Close enough to remember making the same decision, far enough to know how it turned out. A graduate twenty years out has a good answer to a different question.',
  },
  'higher-studies': {
    question: 'Is a masters worth it for my branch, and when should I go?',
    heuristic: 'Graduates who have themselves done a masters or a second qualification.',
    caveat:
      'Taken from the education section of their profile, so it is only as complete as they filled it in. Someone who studied further and never updated their record will not appear here.',
  },
  'core-vs-software': {
    question: 'Do I stay in my branch, or move to software like everyone else seems to?',
    heuristic:
      'Graduates from the non-software branches — ECE, EEE, MECH, CIVIL and the rest of the core disciplines.',
    caveat:
      'The list holds both outcomes on purpose. Some of these graduates stayed in core and some left for software, and the ones who stayed are usually the more useful conversation.',
  },
  abroad: {
    question: 'How do people actually get out, and what is nobody telling me about the first year?',
    heuristic: 'Graduates whose current location on their profile is outside India.',
    caveat:
      'This is the cohort no other channel reaches — they miss the annual meet and drop off the batch WhatsApp group. Allow for the time difference and write, do not expect a call.',
  },
  startups: {
    question: 'Should I join something small, or start something, instead of taking a job?',
    heuristic:
      'Graduates whose current designation contains the word founder or co-founder.',
    caveat:
      'A small list by nature, and it includes the ones it did not work out for — which is the half of the picture a founder profile on LinkedIn never shows you.',
  },
  resume: {
    question: 'Why is my resume not getting shortlisted?',
    heuristic: 'Graduates at least five years out of college.',
    caveat:
      'Five years is roughly when a graduate starts sitting on the screening side of a hiring loop, reading the pile rather than being in it.',
  },
  'career-change': {
    question: 'I think I picked wrong. Can I still change direction?',
    heuristic: 'Graduates who have more than one employer on their record.',
    caveat:
      'A change of employer is a rough proxy for a change of direction and it will catch some people who simply switched companies doing the same work. Read the profile before you write.',
  },
};

const FALLBACK: TopicCopy = {
  question: 'Who can help me with this?',
  heuristic: 'Graduates who have switched mentoring on and have skills listed on their profile.',
  caveat: 'A broad list. Filter it yourself by branch, batch or company from the directory.',
};

function findTopic(id: string): MentorTopic | null {
  return getMentorTopics().find((t) => t.id === id) ?? null;
}

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
}: {
  params: Promise<{ topic: string }>;
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
  const openLeft = quota ? Math.max(0, quota.openLimit - quota.openRequests) : 0;
  const more = Math.max(0, topic.mentorCount - mentors.length);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[{ label: 'Mentorship', href: '/mentorship' }, { label: topic.label }]}
          />
        }
        eyebrow={topic.label}
        title={copy.question}
        description={topic.description}
        actions={
          <ButtonLink href="/mentorship" variant="secondary">
            <ArrowLeft className="size-4" aria-hidden="true" />
            All topics
          </ButtonLink>
        }
      />

      {/* The heuristic, stated before the list rather than in a footnote. A
          derived grouping is only fair to the reader if the reader knows it
          is derived. */}
      <Card>
        <CardBody className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Compass className="size-4 text-muted" aria-hidden="true" />
            What these graduates have in common
          </p>
          <p className="max-w-prose text-sm leading-relaxed text-secondary">
            {copy.heuristic} {copy.caveat}
          </p>
          <p className="max-w-prose border-t border-line pt-2 text-xs text-muted">
            Nobody on this page chose this topic by hand. The portal grouped them from their own
            record, and any of them can correct it from their profile — which is a far easier ask
            than filling in a form from nothing.
          </p>
        </CardBody>
      </Card>

      {mentors.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title="Nobody matches this question yet"
          description="The grouping rule above found no graduate who is also open to mentoring. That is a thin register rather than a closed door — it fills as more batches verify their records and set their preferences."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/mentorship">Back to the other topics</ButtonLink>
              <ButtonLink href="/directory?mentoring=1" variant="secondary">
                Everyone open to mentoring
              </ButtonLink>
            </div>
          }
        />
      ) : (
        <Section
          title={`${topic.mentorCount} ${topic.mentorCount === 1 ? 'graduate' : 'graduates'}`}
          description={
            more > 0
              ? `Showing the first ${mentors.length}. The rest are reachable through the directory with the same availability filter.`
              : 'Everyone the rule matched, in full.'
          }
          actions={
            <Badge tone="success" dot>
              All open to mentoring
            </Badge>
          }
        >
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {mentors.map((member) => (
              // `relative` so the card's overlay link covers the tile and
              // nothing outside it.
              <li key={member.id} className="relative">
                <MemberCard member={member} className="h-full" />
              </li>
            ))}
          </ul>

          {more > 0 ? (
            <p className="text-sm text-secondary">
              <Link href="/directory?mentoring=1" className="link">
                Open the directory
              </Link>{' '}
              to see the remaining {more} and filter them by branch, batch, company or city.
            </p>
          ) : null}
        </Section>
      )}

      {quota ? (
        <Alert
          tone={openLeft === 0 ? 'warning' : 'info'}
          title={
            openLeft === 0
              ? 'You have no request slots free right now'
              : `You can send ${openLeft} more ${openLeft === 1 ? 'request' : 'requests'} right now`
          }
          icon={<Info className="size-4" />}
        >
          <p>
            {quota.reason ??
              'Open a profile to send one. Say who you are, the single decision you are stuck on, and what you have already tried — and ask before you apply somewhere, not after the rejection.'}{' '}
            <Link href="/connections?tab=sent" className="link">
              See what you have sent
            </Link>
            .
          </p>
        </Alert>
      ) : null}

      <MarginNote className="max-w-prose border-t border-line pt-4">
        Contact details are not on this page and are not released by opening a profile. A
        graduate&apos;s email or number appears only when they have consented to it in their own
        privacy settings <em>and</em> you are entitled to see it — both, never either.
      </MarginNote>
    </div>
  );
}

