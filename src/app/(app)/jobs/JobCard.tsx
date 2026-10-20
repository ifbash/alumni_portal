import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, CircleCheck } from 'lucide-react';

import { closesLabel, posterLine, type JobSummaryData } from '@/components/content';
import { Avatar, Badge, Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import { isFresherFriendly } from '@/lib/event-status';
import { memberLine } from '@/lib/format';
import type { LocaleSpec } from '@/lib/branding/pack';
import type { JobPosting } from '@/lib/data/types';

/**
 * The board's list of postings.
 *
 * A posting reads as a company monogram, a title, and one fact row (pay,
 * experience, deadline) set in tabular type, so a student can compare six
 * roles by running an eye down a column. The first posting of an
 * unfiltered board leads at double width with a few lines of what the
 * work is; phones get compact rows in one card, where a stack of bordered
 * cards costs a screen per two roles.
 *
 * The page decides what goes under each posting (a state, the way to the
 * applicants, the review link) and hands it in as `footer`. Nothing here
 * decides what a viewer may see.
 */

export interface JobListItem {
  job: JobPosting;
  footer?: React.ReactNode;
}

/** What a tile needs; a full posting satisfies it, and so does the form's preview. */
export type JobTileData = JobSummaryData & Partial<Pick<JobPosting, 'skills' | 'description'>>;

export function JobList({
  items,
  locale,
  lead,
  className,
}: {
  items: JobListItem[];
  locale: LocaleSpec;
  /** Words for the first posting ("Closing next"); it then spans two columns. */
  lead?: string | null;
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className={className}>
      <ul className="stagger hidden grid-cols-1 gap-gutter sm:grid sm:grid-cols-2 xl:grid-cols-3">
        {items.map(({ job, footer }, i) => {
          const leads = Boolean(lead) && i === 0;
          return (
            <li
              key={job.id}
              style={i < 9 ? ({ '--i': i } as React.CSSProperties) : undefined}
              className={cn('min-w-0', leads && 'sm:col-span-2')}
            >
              <JobTile
                job={job}
                href={`/jobs/${job.id}`}
                locale={locale}
                lead={leads ? lead : null}
                showPoster
                footer={footer}
              />
            </li>
          );
        })}
      </ul>

      <Card as="ul" className="divide-y divide-line px-4 sm:hidden">
        {items.map(({ job, footer }) => (
          <li key={job.id} className="min-w-0">
            <JobRow job={job} href={`/jobs/${job.id}`} locale={locale} footer={footer} />
          </li>
        ))}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------

/** Pay, experience and deadline: the three things every student compares. */
export function FactRow({
  job,
  timeZone,
  className,
}: {
  job: JobTileData;
  timeZone: string;
  className?: string;
}) {
  const closes = closesLabel(job.closesOn, timeZone);
  const level = job.isInternship ? 'Internship' : job.experienceYears;
  const cells: Array<{ label: string; value: string; warn?: boolean }> = [];
  if (job.salaryRange) cells.push({ label: 'Pay', value: job.salaryRange });
  if (level) cells.push({ label: 'Experience', value: level });
  cells.push(
    closes
      ? { label: 'Closes', value: closes.text.replace(/^Closes /, ''), warn: closes.soon }
      : { label: 'Closes', value: 'Open until filled' },
  );

  return (
    <dl className={cn('flex divide-x divide-line rounded-lg bg-surface-sunken py-2.5', className)}>
      {cells.map((c) => (
        <div key={c.label} className="flex-auto px-2.5 first:pl-3 last:pr-3">
          <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-secondary">
            {c.label}
          </dt>
          <dd
            className={cn(
              'mt-0.5 text-sm font-semibold leading-snug tabular',
              c.warn ? 'text-warning-fg' : 'text-primary',
            )}
          >
            {c.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Flags({ job }: { job: JobTileData }) {
  const fresher = isFresherFriendly(job);
  if (!job.isInternship && !fresher && !job.viewerHasApplied) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {job.viewerHasApplied ? (
        <Badge tone="brand">
          <CircleCheck className="size-3" aria-hidden="true" />
          You applied
        </Badge>
      ) : null}
      {job.isInternship ? <Badge tone="outline">Internship</Badge> : null}
      {fresher ? <Badge tone="accent">Open to freshers</Badge> : null}
    </div>
  );
}

function Skills({ skills, max }: { skills?: string[]; max: number }) {
  if (!skills?.length) return null;
  const shown = skills.slice(0, max);
  const more = skills.length - shown.length;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Skills they screen for">
      {shown.map((s) => (
        <li key={s} className="rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs font-medium text-secondary">
          {s}
        </li>
      ))}
      {more > 0 ? <li className="px-1 py-0.5 text-xs text-secondary">+{more}</li> : null}
    </ul>
  );
}

/**
 * One posting as a tile. `lead` (a few words) makes it the wide first tile
 * with a clamp of the description beside the monogram.
 */
export function JobTile({
  job,
  href,
  locale,
  lead = null,
  showPoster = false,
  footer,
  className,
}: {
  job: JobTileData;
  href: string;
  locale: LocaleSpec;
  lead?: string | null;
  showPoster?: boolean;
  footer?: React.ReactNode;
  className?: string;
}) {
  const where = memberLine([job.company, job.location]);
  const leading = Boolean(lead);

  return (
    <article
      className={cn(
        'lift ring-hairline relative isolate flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface-raised shadow-sm',
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-[var(--surface)]',
        className,
      )}
    >
      <div className={cn('flex flex-1 flex-col gap-4', leading ? 'p-5 md:p-7' : 'p-5')}>
        {lead ? <p className="eyebrow text-xs text-brand-fg">{lead}</p> : null}

        <div className="flex items-start gap-4">
          <Avatar
            name={job.company}
            size="lg"
            shape="square"
            className={cn('rounded-lg', leading ? 'size-16 text-xl' : 'size-12 text-md')}
          />
          <div className="min-w-0 flex-1 space-y-1">
            <h3
              className={cn(
                'font-display font-semibold leading-snug tracking-tight',
                leading ? 'text-xl md:text-2xl' : 'line-clamp-2 text-lg',
              )}
            >
              <Link href={href} className="link-quiet after:absolute after:inset-0 after:rounded-lg">
                {job.title}
              </Link>
            </h3>
            <p className="truncate text-sm font-medium text-secondary">{where}</p>
          </div>
        </div>

        {leading && job.description ? (
          <p className="line-clamp-2 max-w-prose text-sm leading-relaxed text-secondary">
            {job.description.split('\n').find((l) => l.trim()) ?? ''}
          </p>
        ) : null}

        {/* Pinned to the foot so tiles of unequal height still line up their facts. */}
        <div className="mt-auto space-y-4">
          <FactRow job={job} timeZone={locale.timeZone} />
          <Flags job={job} />
          <Skills skills={job.skills} max={leading ? 5 : 3} />
        </div>
      </div>

      {showPoster || footer ? (
        <div className="relative z-10 space-y-1 border-t border-line px-5 py-3">
          {showPoster ? (
            <p className="flex items-center gap-2 text-sm text-secondary">
              <Avatar name={job.postedBy.fullName} src={job.postedBy.photoUrl} size="xs" />
              <span className="min-w-0 truncate">{posterLine(job.postedBy)}</span>
            </p>
          ) : null}
          {footer}
        </div>
      ) : null}
    </article>
  );
}

/** The phone's row: monogram, title, company, and the facts on one line. */
function JobRow({
  job,
  href,
  locale,
  footer,
}: {
  job: JobTileData;
  href: string;
  locale: LocaleSpec;
  footer?: React.ReactNode;
}) {
  const closes = closesLabel(job.closesOn, locale.timeZone);
  const terms = memberLine([job.salaryRange, job.isInternship ? 'Internship' : job.experienceYears]);

  return (
    <article className="relative flex items-start gap-3 py-4">
      <Avatar name={job.company} size="md" shape="square" className="size-11 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <h3 className="line-clamp-2 font-display text-md font-semibold leading-snug">
          <Link href={href} className="link-quiet after:absolute after:inset-0">
            {job.title}
          </Link>
        </h3>
        <p className="truncate text-sm text-secondary">{memberLine([job.company, job.location])}</p>
        {terms ? <p className="text-sm font-semibold tabular text-primary">{terms}</p> : null}
        <div className="flex flex-wrap items-center gap-1.5">
          <Flags job={job} />
          {closes ? (
            <Badge tone={closes.soon ? 'warning' : 'neutral'}>{closes.text}</Badge>
          ) : null}
        </div>
        {footer ? <div className="relative z-10 pt-0.5">{footer}</div> : null}
      </div>
    </article>
  );
}

/** A link under a posting: "See 4 applicants", "Submitted 3 days ago — review now". */
export function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="link inline-flex min-h-11 items-center gap-1.5 text-sm font-medium sm:min-h-9"
    >
      {children}
      <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
    </Link>
  );
}

type Tone = 'neutral' | 'brand' | 'warning' | 'danger' | 'success';

const STATE: Record<JobPosting['state'], { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending_moderation: { label: 'With the placement cell', tone: 'warning' },
  live: { label: 'Live', tone: 'success' },
  rejected: { label: 'Sent back', tone: 'danger' },
  closed: { label: 'Closed', tone: 'neutral' },
};

export function JobStateBadge({ state, className }: { state: JobPosting['state']; className?: string }) {
  const s = STATE[state];
  return (
    <Badge tone={s.tone} dot className={cn('w-fit', className)}>
      {s.label}
    </Badge>
  );
}

/** "See 4 applicants", "See 1 applicant", or the way in when nobody has applied yet. */
export function applicantsLabel(count: number): string {
  if (count === 0) return 'No applicants yet — share it';
  return `See ${count.toLocaleString('en-IN')} applicant${count === 1 ? '' : 's'}`;
}
