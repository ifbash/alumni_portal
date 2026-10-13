import * as React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { JobSummary } from '@/components/content';
import { Badge, Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { LocaleSpec } from '@/lib/branding/pack';
import type { JobPosting } from '@/lib/data/types';

/**
 * The board's list of postings: `JobSummary` cards in a grid from `sm`,
 * and `JobSummary` rows in one card on phones, where a stack of bordered
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

export function JobList({
  items,
  locale,
  className,
}: {
  items: JobListItem[];
  locale: LocaleSpec;
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className={className}>
      <ul className="hidden grid-cols-1 gap-gutter sm:grid sm:grid-cols-2 xl:grid-cols-3">
        {items.map(({ job, footer }) => (
          <li key={job.id} className="min-w-0">
            <JobSummary job={job} href={`/jobs/${job.id}`} locale={locale} variant="card" showPoster footer={footer} />
          </li>
        ))}
      </ul>

      <Card as="ul" className="divide-y divide-line px-4 sm:hidden">
        {items.map(({ job, footer }) => (
          <li key={job.id} className="min-w-0">
            <JobSummary job={job} href={`/jobs/${job.id}`} locale={locale} variant="row" showPoster footer={footer} />
          </li>
        ))}
      </Card>
    </div>
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
