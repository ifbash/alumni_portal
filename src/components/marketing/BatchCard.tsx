import Link from 'next/link';
import { Card, CardBody } from '@/components/ui';
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
 * Inside the hero band the card carries `band-exit`, which restores page
 * text and the page focus ring on this light island.
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
  const register = mode === 'register';

  const batches = `${years.length} ${years.length === 1 ? 'batch' : 'batches'}`;
  const branchText = branches !== null && branches >= 2 ? ` and ${branches} branches` : '';
  const span = first !== null && last !== null && first !== last ? `, ${first}–${last}` : '';

  const description = register
    ? total !== null
      ? `${formatNumber(total, { locale })} graduates across ${batches}${branchText}${span}. Pick your year to start registering.`
      : 'Pick your year to start registering.'
    : 'Open the alumni directory at any batch.';

  const chipClass =
    'group grid h-full min-h-12 place-content-center rounded border border-line bg-surface px-0.5 py-1.5 text-center transition-colors duration-fast ease-brand hover:border-line-strong hover:bg-brand-soft';

  return (
    <Card className={cn('band-exit shadow-lg', className)}>
      <CardBody
        className={cn(
          // Wide: heading and footer lines left, chips right. `auto 1fr`
          // rows keep the footer under the heading however tall the chips run.
          wide
            ? 'lg:grid lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:grid-rows-[auto_1fr] lg:gap-x-8'
            : 'space-y-4',
        )}
      >
        <div className={cn(wide && 'lg:col-start-1 lg:row-start-1')}>
          <h2 id="batch-title" className="font-display text-lg font-semibold">
            {register ? 'Which year did you pass out?' : 'Find your batch'}
          </h2>
          <p className="mt-1 text-sm text-secondary">{description}</p>
        </div>

        <ul
          aria-labelledby="batch-title"
          className={cn(
            // Phones: as many 4rem columns as fit — four at 360 and 390, three
            // on a 320px handset — rather than a fixed four that cramps there.
            'mt-4 grid grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] gap-2',
            wide
              ? 'sm:grid-cols-7 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:grid-cols-8 lg:self-center'
              : 'sm:grid-cols-6 lg:grid-cols-4 xl:grid-cols-5',
          )}
        >
          {chips.map(({ year, milestone }) => (
            <li key={year}>
              <Link href={register ? `/claim?year=${year}` : `/directory/batch/${year}`} className={chipClass}>
                <span className="sr-only">{register ? 'Register as batch of ' : 'Open batch of '}</span>
                <span className="text-sm font-semibold tabular text-primary group-hover:text-brand-soft-fg">
                  {year}
                </span>
                {!register ? <span className="sr-only"> in the directory</span> : null}
                {milestone ? (
                  <>
                    <span className="sr-only">, </span>
                    <span className="block text-xs leading-tight tracking-tight text-secondary group-hover:text-brand-soft-fg">
                      {milestone}
                    </span>
                  </>
                ) : null}
              </Link>
            </li>
          ))}
          {earlier ? (
            <li>
              <Link href={register ? '/claim' : '/directory'} className={chipClass}>
                <span aria-hidden="true" className="text-sm font-semibold text-primary group-hover:text-brand-soft-fg">
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
              'mt-4 space-y-1 border-t border-line pt-3 text-sm text-secondary',
              wide && 'lg:col-start-1 lg:row-start-2 lg:self-start',
            )}
          >
            <p>
              You will need your {roll.mid}. It is on your {roll.sourcesMid[0]} and {roll.sourcesMid[1]}.{' '}
              <Link className="link" href="/claim#roll-number-help">
                Where else to look
              </Link>
            </p>
            <p>
              Year not listed?
              {statesRange && first !== null && last !== null
                ? ` The register covers ${first === last ? first : `${first}–${last}`} so far.`
                : ''}{' '}
              <Link className="link" href="/contact#corrections">
                Tell the {copy.officeName}
              </Link>
            </p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
