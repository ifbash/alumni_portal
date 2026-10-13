import { REVIEW_AT, score } from '@/lib/verification/matcher';
import type { VerificationClaim } from '@/lib/data/types';

/**
 * Verification vocabulary for the staff console, in words.
 *
 * The matcher and the seed speak in codes (`roll_exact`,
 * `auto_roll_match`) and file names; staff read sentences. Every console
 * screen that shows a matcher reason, a verification method or a register
 * file goes through here, so a code never reaches the page and the same
 * thing is never called two different names on two screens.
 */

/** Matcher reason codes. Free-text reasons (the seed writes sentences) pass through unchanged. */
export const REASON_LABEL: Record<string, string> = {
  roll_exact: 'Roll number matches the register exactly',
  name_exact: 'Name matches after normalisation',
  name_close: 'Name is close after normalisation',
  name_weak: 'Name overlaps only weakly',
  name_mismatch: 'Name does not match',
  department_match: 'Branch matches',
  department_mismatch: 'Branch does not match',
  batch_match: 'Year of passing matches',
  batch_near: 'Year of passing is one year out',
  batch_mismatch: 'Year of passing does not match',
  ambiguous_match: 'Two register rows score too closely to separate',
  batch_before_admission: 'Batch year is not after the admission year in the roll number',
  low_confidence: 'No candidate scored high enough to act on',
  no_register_match: 'No row in the register matched',
  roll_format_invalid: 'Roll number is not in the college’s format',
};

export function reasonLabel(raw: string): string {
  return REASON_LABEL[raw] ?? raw;
}

export function reasonTone(raw: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (/mismatch|invalid|no_register|low_confidence|does not/i.test(raw)) return 'danger';
  if (/ambiguous|near|weak|differs|close|absent|order|overlap 2|same name, different/i.test(raw)) return 'warning';
  if (/exact|match|100%/i.test(raw)) return 'success';
  return 'neutral';
}

/** How an account came to be verified, as a short phrase. */
export const METHOD_LABEL: Record<string, string> = {
  auto_roll_match: 'Verified automatically',
  admin_manual: 'Approved by a reviewer',
  bulk_import: 'Loaded from a register file',
  placement_cell_import: 'Loaded from the student roll list',
  rollover: 'Verified at the annual rollover',
};

export function methodLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return METHOD_LABEL[raw] ?? 'Verified';
}

/**
 * A register source file as staff say it: "the 2019 CSE file". The name
 * on disk follows `{college}_{year}_{branch}.csv`; anything else is "the
 * examinations branch file", never the raw name.
 */
export function sourceFileLabel(file: string | null | undefined): string {
  const parsed = parseSourceFile(file);
  return parsed ? `the ${parsed.year} ${parsed.branch} file` : 'the examinations branch file';
}

export function parseSourceFile(file: string | null | undefined): { year: number; branch: string } | null {
  if (!file) return null;
  const m = /_(\d{4})_([A-Za-z]+)\.csv$/i.exec(file.trim());
  return m ? { year: Number(m[1]), branch: m[2]!.toUpperCase() } : null;
}

/**
 * Display wording for a match score. Not a threshold the matcher acts
 * on: those are `AUTO_APPROVE_AT` and `REVIEW_AT` in the matcher, and
 * nothing here changes what is approved automatically.
 */
const STRONG_AT = 0.75;

export function evidenceWords(confidence: number): string {
  if (confidence >= STRONG_AT) return 'Strong match';
  if (confidence >= REVIEW_AT) return 'Partial match';
  return 'Weak match';
}

/**
 * A registration's candidates, scored by the matcher itself against what
 * the applicant typed, so the score and the reasons on screen always agree
 * with the field-by-field comparison beside them. Display only: nothing
 * here approves or rejects anything, and the stored decision is untouched.
 */
export function rescoredCandidates(claim: VerificationClaim): VerificationClaim['candidates'] {
  const typed = {
    rollNumber: claim.claimedRoll,
    name: claim.claimedName,
    departmentCode: claim.claimedDepartmentCode,
    batchYear: claim.claimedBatchYear,
  };
  return claim.candidates.map((c) => {
    const { confidence, reasons } = score(typed, c.record);
    return { ...c, confidence, reasons };
  });
}

/** Coverage colour, the console-wide scale: below 20% chase, 20–35% watch, 35% and above healthy. */
export function coverageTone(fraction: number): 'danger' | 'warning' | 'success' {
  if (fraction < 0.2) return 'danger';
  if (fraction < 0.35) return 'warning';
  return 'success';
}

/** Class pairs for the coverage scale, soft fill and its readable text. */
export const COVERAGE_CLASS: Record<'danger' | 'warning' | 'success', string> = {
  danger: 'bg-danger-soft text-danger-fg',
  warning: 'bg-warning-soft text-warning-fg',
  success: 'bg-success-soft text-success-fg',
};
