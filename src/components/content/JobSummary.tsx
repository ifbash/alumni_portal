import * as React from 'react';
import Link from 'next/link';
import { Avatar, Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { daysUntil, memberLine } from '@/lib/format';
import { isFresherFriendly } from '@/lib/event-status';
import { firstNameOf } from '@/lib/identity';
import type { LocaleSpec } from '@/lib/branding/pack';
import type { JobPosting } from '@/lib/data/types';

/**
 * One job posting, the same on the board, the home page, the poster's
 * form preview and the moderation queue. Isomorphic.
 *
 * The company gets a square monogram, so it never reads as a person. The
 * badges answer a final-year's questions in order: is it an internship,
 * can a fresher apply, how long is left, have I already applied.
 */

export type JobSummaryData = Pick<
  JobPosting,
  | 'id'
  | 'title'
  | 'company'
  | 'location'
  | 'isInternship'
  | 'experienceYears'
  | 'salaryRange'
  | 'closesOn'
  | 'postedBy'
  | 'viewerHasApplied'
>;

/** "Closes today", "Closes tomorrow", "Closes in 5 days"; null once past. */
export function closesLabel(closesOn: string | null, timeZone?: string): { text: string; soon: boolean } | null {
  if (!closesOn) return null;
  const n = daysUntil(closesOn, timeZone);
  if (n < 0) return null;
  const text = n === 0 ? 'Closes today' : n === 1 ? 'Closes tomorrow' : `Closes in ${n} days`;
  return { text, soon: n <= 7 };
}

/** "Posted by Vamsi · CSE ’17". */
export function posterLine(postedBy: JobPosting['postedBy']): string {
  const yy = postedBy.batchYear ? `’${String(postedBy.batchYear).slice(-2)}` : null;
  const dept = [postedBy.departmentCode, yy].filter(Boolean).join(' ');
  return memberLine([`Posted by ${firstNameOf(postedBy.fullName)}`, dept || null]);
}

export function JobSummary({
  job,
  href,
  locale,
  variant = 'card',
  showPoster = false,
  footer,
  action,
  className,
}: {
  job: JobSummaryData;
  href: string;
  locale: LocaleSpec;
  variant?: 'card' | 'row';
  /** Adds "Posted by {first} · {DEPT} ’{yy}" with the poster's avatar. */
  showPoster?: boolean;
  /** Extra content under the card (a poster chip, a clamped description, moderation buttons). */
  footer?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const closes = closesLabel(job.closesOn, locale.timeZone);
  const where = memberLine([job.company, job.location]);
  const terms = memberLine([job.salaryRange, job.isInternship ? null : job.experienceYears]);

  const title = (
    <Link href={href} className="link-quiet after:absolute after:inset-0 after:rounded-lg">
      {job.title}
    </Link>
  );

  const badges = (
    <div className="flex flex-wrap items-center gap-1.5">
      {job.isInternship ? <Badge tone="outline">Internship</Badge> : null}
      {isFresherFriendly(job) ? <Badge tone="accent">Open to freshers</Badge> : null}
      {closes ? <Badge tone={closes.soon ? 'warning' : 'neutral'}>{closes.text}</Badge> : null}
      {job.viewerHasApplied ? <Badge tone="brand">You applied</Badge> : null}
    </div>
  );

  const poster = showPoster ? (
    <p className="flex items-center gap-2 text-sm text-secondary">
      <Avatar name={job.postedBy.fullName} src={job.postedBy.photoUrl} size="xs" />
      <span className="min-w-0 truncate">{posterLine(job.postedBy)}</span>
    </p>
  ) : null;

  if (variant === 'row') {
    return (
      <article className={cn('relative flex items-start gap-3 py-3', className)}>
        <Avatar name={job.company} size="md" shape="square" />
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="line-clamp-2 font-semibold leading-snug">{title}</h3>
          <p className="truncate text-sm text-secondary">{where}</p>
          {badges}
          {poster}
          {footer ? <div className="relative z-10 pt-1">{footer}</div> : null}
        </div>
        {action ? <div className="relative z-10 shrink-0 self-center">{action}</div> : null}
      </article>
    );
  }

  return (
    <article
      className={cn(
        'relative flex h-full flex-col gap-3 rounded-lg border border-line bg-surface-raised p-4 shadow-sm',
        'transition-colors duration-fast ease-brand hover:border-line-strong',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={job.company} size="lg" shape="square" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <h3 className="line-clamp-2 font-display text-md font-semibold leading-snug">{title}</h3>
          <p className="truncate text-sm text-secondary">{where}</p>
          {terms ? <p className="truncate text-sm text-secondary">{terms}</p> : null}
        </div>
      </div>
      {badges}
      {poster}
      {footer ? <div className="relative z-10">{footer}</div> : null}
      {action ? <div className="relative z-10 mt-auto [&>*]:w-full sm:[&>*]:w-auto">{action}</div> : null}
    </article>
  );
}
