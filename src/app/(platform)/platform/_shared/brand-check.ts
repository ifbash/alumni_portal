import type { BrandPack } from '@/lib/branding/pack';
import { contrastReport } from '@/lib/branding/tokens';

/**
 * A pack's `brand:check` result, as the console shows it.
 *
 * The same audit the CLI runs, through the same function: contrast errors
 * block publication, warnings do not. The label is a word, never a colour
 * alone, so a chip built from it reads in greyscale.
 */

export interface BrandVerdict {
  label: string;
  tone: 'success' | 'warning' | 'danger';
  summary: string;
  /** Contrast errors: the pack cannot be published. */
  blocked: boolean;
  warnings: number;
}

export function brandVerdict(pack: BrandPack): BrandVerdict {
  const report = contrastReport(pack);

  if (!report.passes) {
    return { label: 'Blocked', tone: 'danger', summary: report.summary, blocked: true, warnings: report.warnings.length };
  }

  const n = report.warnings.length;
  if (n) {
    return {
      label: `${n} ${n === 1 ? 'warning' : 'warnings'}`,
      tone: 'warning',
      summary: report.summary,
      blocked: false,
      warnings: n,
    };
  }

  return { label: 'Publishable', tone: 'success', summary: report.summary, blocked: false, warnings: 0 };
}
