import type { CopySpec } from './pack';

/**
 * Pack copy, set into sentences.
 *
 * Pack values are written the way they appear on their own — "Roll
 * number", "Degree certificate" — and pages also need them mid-sentence
 * ("Enter your roll number as it is printed on your degree certificate").
 * These helpers do that one step, and nothing else, so no page grows its
 * own lowercasing rule that turns "USN" into "uSN".
 */

/** Uppercases the first character: "alumni cell" → "Alumni cell". */
export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * A label as it reads mid-sentence. Lowercases the first character only
 * when the second is a lowercase letter, so words keep their case and
 * acronyms keep theirs: "Roll number" → "roll number", while "USN" and
 * "B.Tech memo" are unchanged.
 */
export function inSentence(label: string): string {
  if (label.length < 2) return label;
  return /\p{Ll}/u.test(label.charAt(1)) ? label.charAt(0).toLowerCase() + label.slice(1) : label;
}

/** '' · 'a' · 'a and b' · 'a, b and c'. */
export function joinList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

// ---------------------------------------------------------------
// Signed-in copy
// ---------------------------------------------------------------

/** The home greeting word, "Namaste" unless the college sets its own. */
export function greetingFor(copy: CopySpec): string {
  return copy.greeting;
}

/** The staff roles that publish news under a desk name. */
export type DeskRole = 'college_admin' | 'alumni_cell_operator' | 'placement_officer';

/**
 * The byline a staff role publishes under: the college's own desk name
 * when the pack sets one, else a generic one. The alumni cell's default is
 * the pack's `officeName`, capitalised, so it matches every other sentence
 * that names the office.
 */
export function deskFor(copy: CopySpec, role: DeskRole): string {
  const defaults: Record<DeskRole, string> = {
    college_admin: 'College administration',
    alumni_cell_operator: capitalise(copy.officeName),
    placement_officer: 'Placement cell',
  };
  return copy.newsDesks[role] ?? defaults[role];
}

/**
 * Who runs the platform, as a member reads it. The pack's `poweredBy`
 * credit when set (a reseller may white-label us), else a plain
 * description. Never a hardcoded vendor name.
 */
export function vendorLabel(copy: CopySpec): string {
  return copy.poweredBy ?? 'the portal provider';
}

/**
 * "usually within two working days", or null when the placement cell has
 * not committed to a turnaround. A null means the screen promises nothing.
 */
export function jobReviewLine(copy: CopySpec): string | null {
  return copy.jobReviewTurnaround ? `usually within ${copy.jobReviewTurnaround}` : null;
}

/** What the trust calls a donation receipt: "Receipt" unless the pack names it ("80G receipt"). */
export function receiptLabel(copy: CopySpec): string {
  return copy.receiptLabel ?? 'Receipt';
}

/** Everything a page needs to talk about the roll number, in both cases. */
export function rollNumber(copy: CopySpec): {
  label: string;
  mid: string;
  example: string | undefined;
  sources: string[];
  sourcesMid: string[];
} {
  return {
    label: copy.rollNumberLabel,
    mid: inSentence(copy.rollNumberLabel),
    example: copy.rollNumberExample,
    sources: copy.rollNumberSources,
    sourcesMid: copy.rollNumberSources.map(inSentence),
  };
}
