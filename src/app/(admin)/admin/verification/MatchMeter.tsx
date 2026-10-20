import { cn } from '@/lib/cn';
import { REVIEW_AT } from '@/lib/verification/matcher';
import { evidenceWords } from '../_shared/verification-labels';

/**
 * How sure the matcher was, as a meter a reviewer reads before the table.
 *
 * Colour follows the console's status scale (strong = success, partial =
 * warning, weak = danger) and is never the only signal: the words and the
 * percentage are always printed. The wording comes from `evidenceWords`,
 * so the queue and the review screen can never disagree.
 */

function toneFor(confidence: number): 'success' | 'warning' | 'danger' {
  const words = evidenceWords(confidence);
  if (words === 'Strong match') return 'success';
  return confidence >= REVIEW_AT ? 'warning' : 'danger';
}

const FILL = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' } as const;
const TEXT = { success: 'text-success-fg', warning: 'text-warning-fg', danger: 'text-danger-fg' } as const;

export function MatchMeter({
  confidence,
  size = 'sm',
  className,
}: {
  confidence: number;
  /** `sm` for rows; `lg` for the hero on the review screen. */
  size?: 'sm' | 'lg';
  className?: string;
}) {
  const pct = Math.round(confidence * 100);
  const tone = toneFor(confidence);
  const lg = size === 'lg';

  return (
    <span className={cn('block space-y-1.5', lg ? 'w-44 shrink-0' : 'w-40 max-w-full', className)}>
      <span className="flex items-baseline justify-between gap-2">
        <span className={cn('text-sm font-medium', TEXT[tone])}>{evidenceWords(confidence)}</span>
        {/* Joined, not cn: tailwind-merge would drop the display size. */}
        <span className={['font-display font-bold leading-none tabular', lg ? 'text-display-xs' : 'text-sm text-secondary'].join(' ')}>
          {pct}%
        </span>
      </span>
      <span
        className={cn('block overflow-hidden rounded-full bg-chart-track', lg ? 'h-2' : 'h-1.5')}
        role="img"
        aria-label={`${evidenceWords(confidence)}, ${pct} percent`}
      >
        <span className={cn('block h-full rounded-full', FILL[tone])} style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}
