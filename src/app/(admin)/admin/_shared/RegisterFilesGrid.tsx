import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatNumber, formatPercent } from '@/lib/format';
import { COVERAGE_CLASS, coverageTone, parseSourceFile } from './verification-labels';

/**
 * The degree register as the files that make it up, and as the batches
 * it covers.
 *
 * The register arrives as one file per batch and branch from the
 * examinations branch. Whether a claim can be verified at all depends on
 * whether that one file has arrived, so the console shows the register
 * the way it is chased: a year-by-branch grid with the gaps marked, and a
 * request that names exactly the files still owed.
 *
 * Server components and pure helpers only. File names never render: a
 * cell is "2019 · CSE", not the name on disk.
 */

// ---------------------------------------------------------------
// Files
// ---------------------------------------------------------------

export interface RegisterGap {
  year: number;
  branch: string;
}

function loadedSet(sourceFiles: ReadonlyArray<string | null>): Set<string> {
  const out = new Set<string>();
  for (const f of sourceFiles) {
    const p = parseSourceFile(f);
    if (p) out.add(`${p.year}|${p.branch}`);
  }
  return out;
}

/** The years the grid spans: the earliest file on record through `throughYear`. */
export function registerYears(sourceFiles: ReadonlyArray<string | null>, throughYear: number): number[] {
  const years = sourceFiles.map((f) => parseSourceFile(f)?.year).filter((y): y is number => typeof y === 'number');
  const first = years.length ? Math.min(...years) : throughYear;
  const out: number[] = [];
  for (let y = first; y <= throughYear; y++) out.push(y);
  return out;
}

/** Every batch-and-branch file the grid expects and the register does not hold. */
export function missingRegisterFiles({
  sourceFiles,
  branches,
  throughYear,
}: {
  sourceFiles: ReadonlyArray<string | null>;
  branches: readonly string[];
  throughYear: number;
}): RegisterGap[] {
  const loaded = loadedSet(sourceFiles);
  const out: RegisterGap[] = [];
  for (const year of registerYears(sourceFiles, throughYear)) {
    for (const branch of branches) if (!loaded.has(`${year}|${branch}`)) out.push({ year, branch });
  }
  return out;
}

/**
 * The note an office sends the examinations branch: the six columns, one
 * file per batch and branch, and the files still owed. Plain text, for
 * pasting into an email or a WhatsApp message.
 */
export function registerRequestText({
  shortName,
  office,
  rollLabel,
  missing,
  exampleYear,
  exampleBranch,
}: {
  shortName: string;
  /** The office's own name, capitalised: "Alumni cell". */
  office: string;
  rollLabel: string;
  missing: RegisterGap[];
  exampleYear: number;
  exampleBranch: string;
}): string {
  const owed =
    missing.length === 0
      ? []
      : [
          '',
          `Files we do not have yet (${missing.length}):`,
          ...groupGaps(missing).map((g) => `- ${g.year}: ${g.branches.join(', ')}`),
        ];

  return [
    `Degree register for the ${shortName} alumni portal`,
    '',
    `Please send one CSV file per batch and branch, named like ${shortName}_${exampleYear}_${exampleBranch}.csv, with a header row and these six columns:`,
    `1. ${rollLabel}`,
    '2. Name, exactly as printed on the memorandum of marks',
    '3. Branch code',
    '4. Programme',
    '5. Year of admission',
    '6. Year of passing',
    ...owed,
    '',
    'No marks, CGPA or contact details are needed.',
    '',
    `— ${office}, ${shortName}`,
  ].join('\n');
}

function groupGaps(missing: RegisterGap[]): Array<{ year: number; branches: string[] }> {
  const byYear = new Map<number, string[]>();
  for (const g of missing) byYear.set(g.year, [...(byYear.get(g.year) ?? []), g.branch]);
  return [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([year, branches]) => ({ year, branches }));
}

/**
 * Years down, branches across. A tick links to that batch's rows in the
 * register; a gap says "Missing" in words as well as colour.
 */
export function RegisterFilesGrid({
  sourceFiles,
  branches,
  throughYear,
  linkable,
  caption = 'Register files by year of passing and branch',
  className,
}: {
  sourceFiles: ReadonlyArray<string | null>;
  branches: readonly string[];
  throughYear: number;
  /** Ticks link to the register rows when the viewer can open the register. */
  linkable: boolean;
  caption?: string;
  className?: string;
}) {
  const loaded = loadedSet(sourceFiles);
  const years = registerYears(sourceFiles, throughYear).reverse();

  return (
    <div
      className={cn('max-w-3xl overflow-x-auto rounded-lg border border-line bg-surface-raised', className)}
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-line bg-surface-sunken">
          <tr>
            <th scope="col" className="px-2 py-2 text-left text-xs font-semibold text-secondary sm:px-3">
              Year
            </th>
            {branches.map((b) => (
              <th key={b} scope="col" className="px-1 py-2 text-center text-xs font-semibold text-secondary">
                {b}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {years.map((year) => (
            <tr key={year}>
              <th scope="row" className="px-2 py-1 text-left font-mono text-xs font-semibold tabular sm:px-3">
                {year}
              </th>
              {branches.map((branch) => {
                const has = loaded.has(`${year}|${branch}`);
                const label = `${year} ${branch}`;
                return (
                  <td key={branch} className="px-1 py-1 text-center">
                    {has ? (
                      linkable ? (
                        <Link
                          href={`/admin/degree-register?year=${year}&department=${encodeURIComponent(branch)}`}
                          aria-label={`${label}: loaded. Open the rows`}
                          className="inline-grid size-11 place-items-center rounded text-success-fg transition-colors duration-fast ease-brand hover:bg-success-soft lg:size-8"
                        >
                          <Check className="size-4" aria-hidden="true" />
                        </Link>
                      ) : (
                        <span className="inline-grid size-8 place-items-center text-success-fg">
                          <Check className="size-4" aria-hidden="true" />
                          <span className="sr-only">{label}: loaded</span>
                        </span>
                      )
                    ) : (
                      <span className="inline-flex min-h-8 items-center justify-center gap-1 rounded bg-warning-soft px-1.5 text-xs font-semibold text-warning-fg">
                        <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="hidden sm:inline">Missing</span>
                        <span className="sr-only sm:hidden">{label}: missing</span>
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------
// Batches
// ---------------------------------------------------------------

export interface BatchCoverage {
  year: number;
  total: number;
  claimed: number;
}

/**
 * One chip per batch, "2013 · 24%", on the coverage scale. The
 * percentage is always printed; the colour only repeats it.
 */
export function CoverageChips({
  batches,
  hrefFor,
  activeYear,
  ariaLabel,
  className,
}: {
  batches: BatchCoverage[];
  /** A link per chip, or null for plain text. */
  hrefFor?: (year: number) => string | null;
  activeYear?: number;
  ariaLabel: string;
  className?: string;
}) {
  return (
    // Three to a row on phones, so fourteen batches do not become seven rows.
    <ul aria-label={ariaLabel} className={cn('grid grid-cols-3 gap-2 sm:flex sm:flex-wrap', className)}>
      {batches.map((b) => {
        const pct = b.total ? b.claimed / b.total : 0;
        const tone = coverageTone(pct);
        const href = hrefFor?.(b.year) ?? null;
        const active = activeYear === b.year;
        const body = (
          <>
            <span className="font-mono font-semibold tabular">{b.year}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular">{formatPercent(pct)}</span>
            <span className="sr-only">
              {' '}
              joined, {formatNumber(b.claimed)} of {formatNumber(b.total)}
            </span>
          </>
        );
        const classes = cn(
          'flex items-center justify-center gap-1 rounded-full px-2 text-xs sm:inline-flex sm:gap-1.5 sm:px-3 sm:text-sm',
          COVERAGE_CLASS[tone],
          active && 'ring-2 ring-[var(--focus-ring)]',
        );
        return (
          <li key={b.year}>
            {href ? (
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(classes, 'min-h-11 transition-[filter] duration-fast ease-brand hover:brightness-95 sm:min-h-8')}
              >
                {body}
              </Link>
            ) : (
              <span className={cn(classes, 'min-h-8')}>{body}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The same coverage, drawn as a heatmap: a tile per batch with the year, the
 * percentage set large and a fill bar that repeats it. Tone comes from the
 * coverage scale (never a hue of its own), and the percentage is always text,
 * so colour is only ever the second carrier.
 */
export function CoverageHeatmap({
  batches,
  hrefFor,
  ariaLabel,
  className,
}: {
  batches: BatchCoverage[];
  hrefFor?: (year: number) => string | null;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <ul aria-label={ariaLabel} className={cn('grid grid-cols-3 gap-2 sm:grid-cols-5 xl:grid-cols-7', className)}>
      {batches.map((b) => {
        const pct = b.total ? b.claimed / b.total : 0;
        const tone = coverageTone(pct);
        const href = hrefFor?.(b.year) ?? null;
        const body = (
          <>
            <span className="font-mono text-xs font-semibold tabular opacity-80">{b.year}</span>
            <span className="font-display text-xl font-bold leading-none tabular">{formatPercent(pct)}</span>
            <span
              aria-hidden="true"
              className="mt-1 block h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,currentColor_18%,transparent)]"
            >
              <span className="block h-full rounded-full bg-current" style={{ width: `${Math.max(4, Math.round(pct * 100))}%` }} />
            </span>
            <span className="sr-only">
              {' '}
              joined, {formatNumber(b.claimed)} of {formatNumber(b.total)}
            </span>
          </>
        );
        const classes = cn('flex min-h-16 flex-col justify-between gap-1 rounded-lg p-2.5 text-left', COVERAGE_CLASS[tone]);
        return (
          <li key={b.year} className="min-w-0">
            {href ? (
              <Link
                href={href}
                className={cn(classes, 'min-h-[4.25rem] transition-[filter,transform] duration-fast ease-brand hover:-translate-y-0.5 hover:brightness-95')}
              >
                {body}
              </Link>
            ) : (
              <span className={cn(classes, 'min-h-[4.25rem]')}>{body}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The coverage scale, said in words once beside the chips. */
export function CoverageLegend({ className }: { className?: string }) {
  const item = (tone: 'danger' | 'warning' | 'success', label: string) => (
    <li className={cn('rounded-full px-2 py-0.5 font-medium', COVERAGE_CLASS[tone])}>{label}</li>
  );
  return (
    <ul className={cn('flex flex-wrap items-center gap-1.5 text-xs', className)} aria-label="Coverage scale">
      {item('danger', 'Under 20%')}
      {item('warning', '20 to 35%')}
      {item('success', '35% and over')}
    </ul>
  );
}

/**
 * The batches furthest behind, each with the one thing to do about it.
 * `commsHref` is null when the viewer cannot open Messages; the rows then
 * stay as plain facts.
 */
export function WeakestBatches({
  batches,
  commsHref,
  className,
}: {
  batches: BatchCoverage[];
  commsHref: (year: number) => string | null;
  className?: string;
}) {
  if (batches.length === 0) return null;
  return (
    <ul className={cn('divide-y divide-line', className)}>
      {batches.map((b) => {
        const pct = b.total ? b.claimed / b.total : 0;
        const href = commsHref(b.year);
        return (
          <li key={b.year} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
            <p className="min-w-0 text-sm">
              <span className="font-mono font-semibold tabular">{b.year}</span>
              <span className="text-secondary">
                {' '}
                · {formatNumber(b.claimed)} of {formatNumber(b.total)} joined ·{' '}
              </span>
              <span className={cn('font-semibold tabular', pct < 0.2 ? 'text-danger-fg' : 'text-warning-fg')}>
                {formatPercent(pct)}
              </span>
            </p>
            {href ? (
              <Link
                href={href}
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-fg hover:underline sm:min-h-8"
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                Write to this batch
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** The `n` batches with the lowest share joined, among batches large enough to mean something. */
export function weakestBatches(batches: BatchCoverage[], n = 3): BatchCoverage[] {
  return [...batches]
    .filter((b) => b.total >= 5)
    .sort((a, b) => a.claimed / a.total - b.claimed / b.total || a.year - b.year)
    .slice(0, n);
}

/** The comms composer, prefilled for one alumni batch. */
export function batchCommsHref(year: number): string {
  return `/admin/comms/new?cohort=alumni&batchFrom=${year}&batchTo=${year}`;
}
