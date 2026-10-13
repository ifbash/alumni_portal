/**
 * The batch chips on the landing page's "Which year did you pass out?"
 * card.
 *
 * Pure, and deliberately narrow: it takes the register's *years* and
 * nothing else. The register also knows how many graduates in each year
 * have registered, and a per-batch "joined" count is exactly the kind of
 * number that must never reach a public page (a batch of 60 with 3
 * registered reads as a dead network, and it is membership data). With
 * only years coming in, no count can come out.
 */

export interface BatchChip {
  year: number;
  /** A reunion-sized anniversary ("10 years out", "Silver jubilee"), or null. */
  milestone: string | null;
}

export interface BatchChips {
  /** Newest first. At most `max - 1` when `earlier` is set. */
  chips: BatchChip[];
  /** True when older batches were folded into a final "Earlier" chip. */
  earlier: boolean;
  /** The oldest batch in the register, or null when it is empty. */
  first: number | null;
  /** The newest batch in the register, or null when it is empty. */
  last: number | null;
}

/** Years since passing out → the label Indian colleges hold reunions around. */
const MILESTONES: Readonly<Record<number, string>> = {
  5: '5 years out',
  10: '10 years out',
  15: '15 years out',
  20: '20 years out',
  25: 'Silver jubilee',
  50: 'Golden jubilee',
};

export function buildBatchChips(years: number[], currentYear: number, max = 16): BatchChips {
  const sorted = [...new Set(years)].sort((a, b) => b - a);
  const earlier = sorted.length > max;
  const kept = earlier ? sorted.slice(0, max - 1) : sorted;

  return {
    chips: kept.map((year) => ({ year, milestone: MILESTONES[currentYear - year] ?? null })),
    earlier,
    first: sorted.length ? sorted[sorted.length - 1]! : null,
    last: sorted.length ? sorted[0]! : null,
  };
}
