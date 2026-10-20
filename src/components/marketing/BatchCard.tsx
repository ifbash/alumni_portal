import Link from 'next/link';
import { cn } from '@/lib/cn';
import { rollNumber } from '@/lib/branding/copy';
import { formatNumber } from '@/lib/format';
import type { CopySpec } from '@/lib/branding/pack';
import { buildBatchChips } from './batches';

/**
 * "Which year did you pass out?"
 *
 * Batch is identity for an Indian graduate — the WhatsApp group is named
 * for it, the reunion is organised by it — so the first question the
 * landing page asks is the year, and one tap on it opens registration
 * with the year already set. Every chip is also a plain URL a batch group
 * can forward (`/claim?year=2016`).
 *
 * Signed in, the same card becomes a way into the directory by batch.
 *
 * Deliberately no counts on or near the chips. "3 of 60 registered" is
 * membership data, and on a public page it reads as a dead network. The
 * one number here is the register's total, and only when it is large
 * enough to mean something and is the college's own: the page passes
 * `total` as null otherwise (see `getPublicRegister`).
 *
 * Two surfaces from one component:
 *
 *  - `column` sits on the hero band as frosted glass, drawn entirely in
 *    band tokens. A reunion year ("5 years out", "10 years out") is
 *    lit in the accent so the milestone batches find themselves.
 *  - `wide` is a raised card on the page ground, overlapping the foot of
 *    a photo hero.
 *
 * On a phone the years are a two-row ribbon that scrolls sideways, with
 * the next column peeking in: thirteen years stacked in a grid made the
 * panel a screen tall, and a thumb scrolls a ribbon without thinking.
 * From `sm` the same links lay out as a plain grid.
 */
export function BatchCard({
  mode,
  layout,
  years,
  total,
  branches,
  statesRange,
  currentYear,
  copy,
  locale,
  className,
}: {
  mode: 'register' | 'directory';
  layout: 'column' | 'wide';
  /** Register years only. Never counts. */
  years: number[];
  /** The register's size, or null when it must not be stated (see `getPublicRegister`). */
  total: number | null;
  /** Branches on the register, or null when that must not be stated. */
  branches: number | null;
  /**
   * Whether the card may name the register's first and last batch. False
   * while the register is fixture data standing in for the college's own:
   * the chips still work, but "the register covers 2013–2026" would be a
   * claim about a file the college has not sent.
   */
  statesRange: boolean;
  currentYear: number;
  copy: CopySpec;
  /** For number grouping ("1,20,000" in en-IN). */
  locale: string;
  className?: string;
}) {
  const { chips, earlier, first, last } = buildBatchChips(years, currentYear);
  if (!chips.length) return null;

  const roll = rollNumber(copy);
  const wide = layout === 'wide';
  const glass = !wide;
  const register = mode === 'register';

  const batches = `${years.length} ${years.length === 1 ? 'batch' : 'batches'}`;
  const branchText = branches !== null && branches >= 2 ? ` and ${branches} branches` : '';
  const span = first !== null && last !== null && first !== last ? `, ${first}–${last}` : '';

  const description = register
    ? total !== null
      ? `${formatNumber(total, { locale })} graduates across ${batches}${branchText}${span}. Pick your year to start registering.`
      : 'Pick your year to start registering.'
    : 'Open the alumni directory at any batch.';

  // Hover and press feedback is transform and colour only. The lift is for pointers; a thumb gets the press.
  const tileBase =
    'group grid h-full min-h-16 place-content-center rounded-lg border px-1 py-2 text-center transition-[transform,background-color,border-color,color] duration-fast ease-brand active:scale-[0.97] [@media(hover:hover)]:hover:-translate-y-0.5';

  const tileTone = (milestone: boolean) =>
    glass
      ? cn(
          'text-band-fg hover:bg-band-fg hover:text-[var(--band)]',
          milestone
            ? 'border-band-accent bg-[color-mix(in_srgb,var(--band-accent)_18%,transparent)]'
            : 'border-[color-mix(in_srgb,var(--band-fg)_28%,transparent)] bg-[color-mix(in_srgb,var(--band-fg)_7%,transparent)]',
        )
      : cn(
          'text-primary hover:border-brand-fg hover:bg-brand-soft hover:text-brand-soft-fg',
          milestone ? 'border-brand-fg bg-brand-soft text-brand-soft-fg' : 'border-line bg-surface',
        );

  const subTone = glass
    ? 'text-band-fg group-hover:text-[var(--band)]'
    : 'text-secondary group-hover:text-brand-soft-fg';

  const footLink = glass
    ? 'font-medium text-band-fg underline decoration-[color-mix(in_srgb,var(--band-fg)_45%,transparent)] underline-offset-4 hover:decoration-current'
    : 'link';

  return (
    <div
      className={cn(
        'rounded-xl',
        glass
          ? 'ring-hairline border border-[color-mix(in_srgb,var(--band-fg)_24%,transparent)] bg-[color-mix(in_srgb,var(--band-fg)_9%,transparent)] shadow-lg backdrop-blur-md'
          : 'band-exit ring-hairline border border-line bg-surface-raised shadow-lg',
        className,
      )}
    >
      <div
        className={cn(
          'p-4 sm:p-6',
          // Wide: heading and footer lines left, years right. `auto 1fr`
          // rows keep the footer under the heading however tall the years run.
          wide
            ? 'lg:grid lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:grid-rows-[auto_1fr] lg:gap-x-10 lg:p-8'
            : 'space-y-4',
        )}
      >
        <div className={cn(wide && 'lg:col-start-1 lg:row-start-1')}>
          <h2
            id="batch-title"
            className={`font-display text-xl font-bold sm:text-display-xs ${glass ? 'text-band-fg' : ''}`}
          >
            {register ? 'Which year did you pass out?' : 'Find your batch'}
          </h2>
          <p className={cn('mt-1 text-sm', glass ? 'text-band-muted' : 'text-secondary')}>{description}</p>
        </div>

        <ul
          aria-labelledby="batch-title"
          className={cn(
            // Phones: a two-row ribbon, 72px columns, bleeding to the panel edge so the next column peeks.
            'relative -mx-4 mt-4 grid auto-cols-[4.5rem] grid-flow-col grid-rows-2 gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            // From sm: a plain grid.
            'sm:mx-0 sm:auto-cols-auto sm:grid-flow-row sm:grid-rows-none sm:overflow-visible sm:px-0 sm:pb-0',
            wide
              ? 'sm:grid-cols-7 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:grid-cols-8 lg:self-center'
              : 'sm:grid-cols-6 lg:grid-cols-4',
          )}
        >
          {chips.map(({ year, milestone }) => (
            <li key={year}>
              <Link
                href={register ? `/claim?year=${year}` : `/directory/batch/${year}`}
                className={cn(tileBase, tileTone(Boolean(milestone)))}
              >
                <span className="sr-only">{register ? 'Register as batch of ' : 'Open batch of '}</span>
                <span className="font-display text-lg font-bold leading-none tabular">{year}</span>
                {!register ? <span className="sr-only"> in the directory</span> : null}
                {milestone ? (
                  <>
                    <span className="sr-only">, </span>
                    <span className={cn('mt-1 block text-xs font-semibold leading-tight', subTone)}>{milestone}</span>
                  </>
                ) : null}
              </Link>
            </li>
          ))}
          {earlier ? (
            <li>
              <Link
                href={register ? '/claim' : '/directory'}
                className={cn(tileBase, tileTone(false), 'border-dashed')}
              >
                <span aria-hidden="true" className="text-sm font-semibold">
                  Earlier
                </span>
                <span className="sr-only">
                  {register ? 'Register as an earlier batch' : 'Open earlier batches in the directory'}
                </span>
              </Link>
            </li>
          ) : null}
        </ul>

        {register ? (
          <div
            className={cn(
              'mt-4 space-y-1 border-t pt-3 text-sm',
              glass ? 'border-band-rule text-band-muted' : 'border-line text-secondary',
              wide && 'lg:col-start-1 lg:row-start-2 lg:self-start',
            )}
          >
            <p>
              You will need your {roll.mid}. It is on your {roll.sourcesMid[0]} and {roll.sourcesMid[1]}.{' '}
              <Link className={footLink} href="/claim#roll-number-help">
                Where else to look
              </Link>
            </p>
            <p>
              Year not listed?
              {statesRange && first !== null && last !== null
                ? ` The register covers ${first === last ? first : `${first}–${last}`} so far.`
                : ''}{' '}
              <Link className={footLink} href="/contact#corrections">
                Tell the {copy.officeName}
              </Link>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
