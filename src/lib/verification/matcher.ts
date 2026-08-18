/**
 * Degree-register matching.
 *
 * A self-registration is checked against the college's authoritative
 * record from the examinations branch. Exact matches auto-approve;
 * near matches queue for a human; the rest are rejected outright.
 *
 * Without this, every registration is a manual decision made against
 * no evidence — which is how an alumni cell of one drowns.
 */

export interface DegreeRecord {
  id: string;
  rollNumber: string;
  name: string;
  departmentCode: string | null;
  yearOfPassing: number | null;
  admissionYear: number | null;
}

export interface Claim {
  rollNumber: string;
  name: string;
  departmentCode: string | null;
  batchYear: number | null;
}

export type Outcome =
  | { decision: 'auto_approve'; record: DegreeRecord; confidence: number; reasons: string[] }
  | { decision: 'review'; candidates: Scored[]; reasons: string[] }
  | { decision: 'reject'; reasons: string[] };

export interface Scored {
  record: DegreeRecord;
  confidence: number;
  reasons: string[];
}

// ---------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------

/** Indian names vary wildly in transliteration and initial placement. */
export function normaliseName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(mr|mrs|ms|dr|shri|smt|kum)\.?\b/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Initials and surname order are unreliable; compare as token sets. */
export function nameTokens(raw: string): string[] {
  return normaliseName(raw)
    .split(' ')
    .filter((t) => t.length > 1); // drop single-letter initials
}

export function normaliseRoll(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * JNTU-style rolls encode the admission year in the first two digits.
 * A "22" roll claiming to be batch 2022 is almost certainly a user
 * confusing admission year with year of passing.
 */
export function rollLooksValid(roll: string): boolean {
  const r = normaliseRoll(roll);
  return r.length >= 8 && /^\d{2}/.test(r);
}

export function admissionYearFromRoll(roll: string): number | null {
  const r = normaliseRoll(roll);
  if (!/^\d{2}/.test(r)) return null;
  const yy = parseInt(r.slice(0, 2), 10);
  return yy > 50 ? 1900 + yy : 2000 + yy;
}

// ---------------------------------------------------------------
// Similarity
// ---------------------------------------------------------------

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

function tokenSimilarity(a: string, b: string): number {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return 0;

  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  let matched = 0;

  for (const t of short) {
    const best = long.reduce((acc, u) => {
      const d = levenshtein(t, u);
      const sim = 1 - d / Math.max(t.length, u.length);
      return Math.max(acc, sim);
    }, 0);
    if (best >= 0.8) matched += best;
  }

  return matched / short.length;
}

// ---------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------

export function score(claim: Claim, record: DegreeRecord): Scored {
  const reasons: string[] = [];
  let confidence = 0;

  const rollExact = normaliseRoll(claim.rollNumber) === normaliseRoll(record.rollNumber);
  if (rollExact) {
    confidence += 0.6;
    reasons.push('roll_exact');
  }

  const nameSim = tokenSimilarity(claim.name, record.name);
  if (nameSim >= 0.95) {
    confidence += 0.3;
    reasons.push('name_exact');
  } else if (nameSim >= 0.75) {
    confidence += 0.18;
    reasons.push('name_close');
  } else if (nameSim >= 0.5) {
    confidence += 0.05;
    reasons.push('name_weak');
  } else {
    reasons.push('name_mismatch');
  }

  if (
    claim.departmentCode &&
    record.departmentCode &&
    claim.departmentCode.toUpperCase() === record.departmentCode.toUpperCase()
  ) {
    confidence += 0.05;
    reasons.push('department_match');
  } else if (claim.departmentCode && record.departmentCode) {
    confidence -= 0.15;
    reasons.push('department_mismatch');
  }

  if (claim.batchYear && record.yearOfPassing) {
    const gap = Math.abs(claim.batchYear - record.yearOfPassing);
    if (gap === 0) {
      confidence += 0.05;
      reasons.push('batch_match');
    } else if (gap <= 1) {
      reasons.push('batch_near');
    } else {
      confidence -= 0.2;
      reasons.push('batch_mismatch');
    }
  }

  return { record, confidence: Math.max(0, Math.min(1, confidence)), reasons };
}

// ---------------------------------------------------------------
// Decision
// ---------------------------------------------------------------

export const AUTO_APPROVE_AT = 0.9;
export const REVIEW_AT = 0.45;

export function matchClaim(claim: Claim, candidates: DegreeRecord[]): Outcome {
  const reasons: string[] = [];

  if (!rollLooksValid(claim.rollNumber)) {
    // The competitor's queue contains a record with roll "01".
    // Reject at intake rather than letting junk into the directory.
    return { decision: 'reject', reasons: ['roll_format_invalid'] };
  }

  const admYear = admissionYearFromRoll(claim.rollNumber);
  if (admYear && claim.batchYear && claim.batchYear <= admYear) {
    reasons.push('batch_before_admission');
  }

  if (candidates.length === 0) {
    return { decision: 'reject', reasons: [...reasons, 'no_register_match'] };
  }

  const scored = candidates
    .map((r) => score(claim, r))
    .sort((a, b) => b.confidence - a.confidence);

  const top = scored[0];
  const runnerUp = scored[1];

  // Ambiguity guard: two plausible records means a human decides,
  // however high the top score. Twins and same-name cousins are common.
  const ambiguous = runnerUp && top.confidence - runnerUp.confidence < 0.15;

  if (top.confidence >= AUTO_APPROVE_AT && !ambiguous && reasons.length === 0) {
    return {
      decision: 'auto_approve',
      record: top.record,
      confidence: top.confidence,
      reasons: top.reasons,
    };
  }

  if (top.confidence >= REVIEW_AT) {
    return {
      decision: 'review',
      candidates: scored.slice(0, 5),
      reasons: [...reasons, ...(ambiguous ? ['ambiguous_match'] : [])],
    };
  }

  return { decision: 'reject', reasons: [...reasons, 'low_confidence'] };
}

/**
 * Narrow the register before scoring. Called with the claim's roll and
 * name; the SQL side uses the trigram index on name_normalised.
 */
export function candidateQuery(claim: Claim) {
  return {
    rollNumber: normaliseRoll(claim.rollNumber),
    nameNormalised: normaliseName(claim.name).replace(/\s/g, ''),
    batchWindow: claim.batchYear
      ? [claim.batchYear - 2, claim.batchYear + 2]
      : null,
  };
}
