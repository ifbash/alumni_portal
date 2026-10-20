import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Profile completeness as a ring round the photo.
 *
 * The photo is the person; the ring is how finished the record is. Drawn in
 * the chart tokens, which clear 3:1 on a card in both themes, and a finished
 * ring turns success so 100% reads as done without a word. The figure is
 * also text, on a chip, and the whole thing carries one label: colour never
 * carries the meaning alone.
 *
 * `score` null means the viewer cannot edit the record, so there is nothing
 * to complete and the photo is shown bare.
 */

const SIZE = 112;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CompletenessRing({
  score,
  children,
  className,
}: {
  score: number | null;
  /** The avatar, 96px. */
  children: React.ReactNode;
  className?: string;
}) {
  const done = score !== null && score >= 100;

  return (
    <span className={cn('relative inline-grid size-28 shrink-0 place-items-center rounded-full bg-surface-raised shadow-sm', className)}>
      {score !== null ? (
        <svg
          role="img"
          aria-label={`Profile ${score} per cent complete`}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="absolute left-0 top-0 size-28 -rotate-90"
        >
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} style={{ stroke: 'var(--chart-track)' }} opacity={0.45} />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - Math.min(100, Math.max(0, score)) / 100)}
            style={{ stroke: done ? 'var(--success)' : 'var(--chart-bar)' }}
          />
        </svg>
      ) : null}
      {children}
      {score !== null ? (
        <span
          aria-hidden="true"
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-line bg-surface-raised px-2 py-0.5 text-xs font-semibold tabular shadow-sm"
        >
          {score}%
        </span>
      ) : null}
    </span>
  );
}
