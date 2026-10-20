import { CheckCircle2, CircleAlert, Info, TriangleAlert } from 'lucide-react';

import type { JobPosting } from '@/lib/data/types';
import { cn } from '@/lib/cn';

/**
 * The moderator's checklist, shared by the queue's review desk and the
 * posting page so both say the same thing about the same posting.
 */

export type CheckTone = 'ok' | 'note' | 'warn' | 'bad';
export interface JobCheck {
  tone: CheckTone;
  text: string;
}

/**
 * What an apply link points at, for the moderator to check: the host of a
 * web address, or the address of a `mailto:` link. Null when it is neither.
 *
 * Never lets a malformed URL from a poster take the page down. A `mailto:`
 * link has no hostname - `new URL('mailto:a@b.co').hostname` is `''` - and
 * the API accepts them, so treating the empty string as "no host" reported
 * every valid email apply link as broken.
 */
export function hostOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'mailto:') return parsed.pathname || null;
    return parsed.hostname || null;
  } catch {
    return null;
  }
}

/** Words that stand in for an employer's name. */
const UNNAMED = /\b(leading|reputed|reputable|top|mnc|confidential|our client|a client|well[- ]known)\b/i;
/** Words that suggest a candidate is asked for money. */
const FEE = /\b(fee|fees|deposit|registration charge|pay(?:ment)? of|refundable)\b/i;

export function buildJobChecks(job: JobPosting): JobCheck[] {
  const poster = job.postedBy;
  const employerMatch =
    Boolean(poster.currentCompany) && poster.currentCompany?.toLowerCase() === job.company.toLowerCase();
  const host = job.applyUrl ? hostOf(job.applyUrl) : null;

  return [
    poster.currentCompany
      ? employerMatch
        ? { tone: 'ok', text: `Works at ${job.company}, the employer on the posting.` }
        : { tone: 'note', text: `Works at ${poster.currentCompany} · posting is for ${job.company}.` }
      : { tone: 'warn', text: 'No employer on their profile, so there is nothing to check against.' },
    job.applyUrl
      ? host
        ? { tone: 'ok', text: `The apply link opens ${host}.` }
        : { tone: 'bad', text: 'The apply link is not a working address.' }
      : { tone: 'ok', text: 'Students apply through the portal.' },
    FEE.test(job.description ?? '')
      ? { tone: 'warn', text: 'The description mentions a fee or payment. Read it closely.' }
      : { tone: 'ok', text: 'No fee is mentioned.' },
    UNNAMED.test(job.company) || job.company.trim().length < 2
      ? { tone: 'warn', text: 'The employer may not be named.' }
      : { tone: 'ok', text: `The employer is named: ${job.company}.` },
  ];
}

/** How many checks need the moderator's eye, for the queue's markers. */
export function checksNeedingEye(checks: JobCheck[]): number {
  return checks.filter((c) => c.tone === 'warn' || c.tone === 'bad').length;
}

export function CheckIcon({ tone }: { tone: CheckTone }) {
  const cls = 'mt-0.5 size-4 shrink-0';
  if (tone === 'ok') return <CheckCircle2 className={cn(cls, 'text-success-fg')} aria-label="Passes" />;
  if (tone === 'note') return <Info className={cn(cls, 'text-muted')} aria-label="Worth a look" />;
  if (tone === 'warn') return <TriangleAlert className={cn(cls, 'text-warning-fg')} aria-label="Check this" />;
  return <CircleAlert className={cn(cls, 'text-danger-fg')} aria-label="Fails" />;
}

export function CheckList({ checks, className }: { checks: JobCheck[]; className?: string }) {
  return (
    <ul className={cn('space-y-3', className)}>
      {checks.map((c) => (
        <li key={c.text} className="flex gap-2.5 text-sm">
          <CheckIcon tone={c.tone} />
          <span className={cn(c.tone === 'warn' ? 'text-warning-fg' : c.tone === 'bad' ? 'text-danger-fg' : 'text-primary')}>
            {c.text}
          </span>
        </li>
      ))}
    </ul>
  );
}
