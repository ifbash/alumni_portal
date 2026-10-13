import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Stat → action.
 *
 * Work screens do not open on a row of counters, most of them 0. Things
 * that need the viewer are tasks: a count, what it is, how old the oldest
 * one is, and one verb. A count of 0 is not a task and is dropped; when
 * every task is 0, the section says so in one line.
 */

export interface TaskItem {
  key: string;
  count: number;
  /** What the count is, mid-sentence after the number: "registrations to review". */
  label: string;
  /** "oldest 3 weeks ago", "2 overdue". */
  detail?: string;
  href: string;
  /** A verb for something the viewer can do here ("Review"), or "See the list" for work done elsewhere. */
  action: string;
  tone?: 'default' | 'attention';
  icon?: React.ReactNode;
}

export function NeedsYou({
  items,
  heading = 'Needs you',
  caughtUp = 'You are all caught up.',
  className,
}: {
  items: TaskItem[];
  heading?: string;
  caughtUp?: string;
  className?: string;
}) {
  const open = items.filter((i) => i.count > 0);
  const headingId = `needs-you-${heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <section aria-labelledby={headingId} className={cn('space-y-3', className)}>
      <h2 id={headingId} className="text-sm font-semibold text-secondary">
        {heading}
      </h2>

      {open.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-secondary">
          <CheckCircle2 className="size-4 shrink-0 text-success-fg" aria-hidden="true" />
          {caughtUp}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {open.map((t) => {
            const attention = t.tone === 'attention';
            return (
              <li key={t.key} className="min-w-0">
                <Link
                  href={t.href}
                  className={cn(
                    'group flex h-full min-h-11 flex-col gap-1 rounded-lg border border-line bg-surface-raised p-4 shadow-sm',
                    'transition-colors duration-fast ease-brand hover:border-line-strong',
                    attention && 'border-l-4 border-l-warning',
                  )}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-display text-display-xs font-bold tabular">
                      {t.count.toLocaleString('en-IN')}
                    </span>
                    {t.icon ? (
                      <span className="mt-1 text-muted [&>svg]:size-5" aria-hidden="true">
                        {t.icon}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-sm font-medium text-primary">{t.label}</span>
                  {t.detail ? (
                    <span className={cn('text-sm', attention ? 'text-warning-fg' : 'text-secondary')}>{t.detail}</span>
                  ) : null}
                  <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-semibold text-brand-fg">
                    {t.action}
                    <ArrowRight
                      className="size-4 transition-transform duration-fast ease-brand group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * The one line a list page opens with: "6 live · last story 1 week ago ·
 * 1 draft". Each figure links to its filtered view. Zeros are dropped
 * (set `zero` to keep one that means something, like "0 overdue" on a
 * compliance screen); an empty line renders nothing.
 */
export function SummaryLine({
  items,
  className,
}: {
  items: Array<{
    value: number | string;
    label: string;
    href?: string;
    tone?: 'default' | 'attention' | 'positive';
    zero?: boolean;
  }>;
  className?: string;
}) {
  const shown = items.filter((i) => i.zero || !(i.value === 0 || i.value === '0'));
  if (shown.length === 0) return null;

  return (
    <p className={cn('text-sm text-secondary', className)}>
      {shown.map((i, n) => {
        const figure = (
          <>
            <span
              className={cn(
                'font-semibold tabular',
                i.tone === 'attention' ? 'text-warning-fg' : i.tone === 'positive' ? 'text-success-fg' : 'text-primary',
              )}
            >
              {typeof i.value === 'number' ? i.value.toLocaleString('en-IN') : i.value}
            </span>{' '}
            {i.label}
          </>
        );
        return (
          <React.Fragment key={`${i.label}-${n}`}>
            {n > 0 ? (
              <>
                <span aria-hidden="true"> · </span>
                <span className="sr-only">, </span>
              </>
            ) : null}
            {i.href ? (
              <Link href={i.href} className="underline-offset-4 hover:text-brand-fg hover:underline">
                {figure}
              </Link>
            ) : (
              figure
            )}
          </React.Fragment>
        );
      })}
    </p>
  );
}
