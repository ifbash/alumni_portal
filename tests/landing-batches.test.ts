import { describe, expect, it } from 'vitest';
import { buildBatchChips } from '@/components/marketing/batches';

/**
 * The landing page's batch chips.
 *
 * Batch is identity for an Indian graduate, so the chips are the first
 * thing below the hero. They are also a public page reading from the
 * degree register, which is why the helper takes years only: nothing it
 * returns can carry a per-batch count.
 */

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('buildBatchChips', () => {
  it('orders batches newest first, whatever order the register returns', () => {
    const out = buildBatchChips([2014, 2021, 2013, 2026, 2016], 2026);
    expect(out.chips.map((c) => c.year)).toEqual([2026, 2021, 2016, 2014, 2013]);
    expect(out.first).toBe(2013);
    expect(out.last).toBe(2026);
    expect(out.earlier).toBe(false);
  });

  it('labels the reunion years and nothing else', () => {
    const out = buildBatchChips(range(1975, 2026), 2026, 60);
    const label = (y: number) => out.chips.find((c) => c.year === y)?.milestone;

    expect(label(2021)).toBe('5 years out');
    expect(label(2016)).toBe('10 years out');
    expect(label(2011)).toBe('15 years out');
    expect(label(2006)).toBe('20 years out');
    expect(label(2001)).toBe('Silver jubilee');
    expect(label(1976)).toBe('Golden jubilee');

    expect(label(2026)).toBeNull();
    expect(label(2020)).toBeNull();
    expect(label(2017)).toBeNull();
    expect(out.chips.filter((c) => c.milestone).length).toBe(6);
  });

  it('matches the DIET fixture: fourteen batches, 2016 and 2021 marked', () => {
    const out = buildBatchChips(range(2013, 2026), 2026);
    expect(out.chips).toHaveLength(14);
    expect(out.earlier).toBe(false);
    expect(out.chips.find((c) => c.year === 2016)?.milestone).toBe('10 years out');
    expect(out.chips.find((c) => c.year === 2021)?.milestone).toBe('5 years out');
  });

  it('keeps sixteen batches as they are', () => {
    const out = buildBatchChips(range(2011, 2026), 2026);
    expect(out.chips).toHaveLength(16);
    expect(out.earlier).toBe(false);
  });

  it('folds anything past sixteen into an Earlier chip, keeping the fifteen newest', () => {
    const out = buildBatchChips(range(2000, 2026), 2026);
    expect(out.earlier).toBe(true);
    expect(out.chips).toHaveLength(15);
    expect(out.chips[0]!.year).toBe(2026);
    expect(out.chips[14]!.year).toBe(2012);
    // The register's full span is still reported, not the span of the chips.
    expect(out.first).toBe(2000);
    expect(out.last).toBe(2026);
  });

  it('returns an empty set for an empty register', () => {
    expect(buildBatchChips([], 2026)).toEqual({ chips: [], earlier: false, first: null, last: null });
  });

  it('never carries a count', () => {
    const out = buildBatchChips(range(2013, 2026), 2026);
    const keys = new Set<string>([...Object.keys(out), ...out.chips.flatMap((c) => Object.keys(c))]);

    expect([...keys].sort()).toEqual(['chips', 'earlier', 'first', 'last', 'milestone', 'year']);
    for (const k of keys) expect(k).not.toMatch(/count|claimed|registered|joined|total|coverage/i);
  });
});
