import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { can } from '@/lib/auth/guard';
import { getTenant } from '@/lib/tenant';
import { logAudit } from '@/lib/audit/log';
import { NOTICE_VERSION } from '@/lib/config';
import { findMemberByEmail, searchDegreeRegister, getDepartments } from '@/lib/data/repo';
import {
  matchClaim,
  nameTokens,
  normaliseRoll,
  admissionYearFromRoll,
  AUTO_APPROVE_AT,
  REVIEW_AT,
  type Scored,
} from '@/lib/verification/matcher';
import type { DegreeRecord } from '@/lib/data/types';
import { clientIp, fail, HttpError, json, limit, readJson } from '../../_lib/http';

/**
 * Claim an alumni profile against the degree register.
 *
 * The register — roll number, name, branch, year of passing, loaded from
 * the examinations branch — is the source of truth. Verification is a
 * match between a self-registration and that table. Without it every
 * registration is a manual decision made against no evidence, which is
 * how an alumni cell of one drowns in month two.
 *
 * Two decisions worth stating:
 *
 *  1. **Candidate detail is gated, the decision is not.** The claimant is
 *     told what happened — approved, queued for review, or refused, and
 *     why. They are *not* shown other people's register rows. An open
 *     endpoint that echoes matching names and roll numbers back to an
 *     anonymous caller is a degree-register harvesting tool with a form
 *     on the front. A signed-in reviewer holding
 *     `verification.review.*` gets the full candidate list, because that
 *     is the screen the matcher exists to serve.
 *  2. **Consent is captured with its notice version.** Checking someone's
 *     name against college records is a processing purpose, and
 *     `consent_records` is append-only precisely so the version they
 *     agreed to survives the next redraft of the notice.
 */

const Body = z.object({
  rollNumber: z
    .string()
    .trim()
    .min(6, 'A roll number is at least six characters — for example 13JN1A0501.')
    .max(20, 'That is longer than any roll number the college issues.'),
  fullName: z
    .string()
    .trim()
    .min(3, 'Enter your full name as it is printed on the certificate.')
    .max(120),
  departmentCode: z.string().trim().min(2).max(12),
  yearOfPassing: z
    .number()
    .int()
    .min(1990, 'The college was established well after that.')
    .max(new Date().getFullYear() + 1, 'That year has not happened yet.'),
  email: z.string().trim().min(1).max(254).email('That does not look like an email address.'),
  mobile: z
    .string()
    .trim()
    .regex(/^\d{10}$/, 'An Indian mobile number is ten digits.')
    .nullable()
    .optional(),
  consent: z.object({
    accepted: z
      .boolean()
      .refine((v) => v === true, {
        message: 'We cannot check your records against the register without your agreement.',
      }),
    noticeVersion: z.string().min(1).max(32),
  }),
});

/**
 * Narrow the register before scoring.
 *
 * The register spelling and the portal spelling rarely agree — surname
 * first, initials expanded, transliteration drift — so a substring search
 * on the whole name finds nothing useful. Searching each token separately
 * and unioning the results is what the trigram index does on the SQL side.
 */
function gatherCandidates(claim: {
  rollNumber: string;
  fullName: string;
  departmentCode: string;
  yearOfPassing: number;
}): DegreeRecord[] {
  const found = new Map<string, DegreeRecord>();

  for (const row of searchDegreeRegister(normaliseRoll(claim.rollNumber), { perPage: 25 }).items) {
    found.set(row.id, row);
  }

  for (const token of nameTokens(claim.fullName).slice(0, 4)) {
    if (token.length < 4) continue;
    const hits = searchDegreeRegister(token, {
      department: claim.departmentCode,
      year: claim.yearOfPassing,
      perPage: 25,
    }).items;
    for (const row of hits) found.set(row.id, row);
    if (found.size >= 60) break;
  }

  return [...found.values()].slice(0, 60);
}

/** What an anonymous claimant may see of somebody else's register row. */
function redact(scored: Scored) {
  const roll = scored.record.rollNumber;
  return {
    confidence: Number(scored.confidence.toFixed(3)),
    reasons: scored.reasons,
    record: {
      // Enough to recognise your own record, not enough to collect anyone
      // else's: last four of the roll, initials, branch and year.
      rollNumberMasked: `${'•'.repeat(Math.max(0, roll.length - 4))}${roll.slice(-4)}`,
      nameInitials: nameTokens(scored.record.name)
        .map((t) => t[0]?.toUpperCase() ?? '')
        .join('.'),
      departmentCode: scored.record.departmentCode,
      yearOfPassing: scored.record.yearOfPassing,
    },
  };
}

export async function POST(request: Request) {
  try {
    const input = await readJson(request, Body);
    const email = input.email.toLowerCase();
    const ip = clientIp(request);

    limit(
      `claim:ip:${ip}`,
      10,
      60 * 60,
      'Several claims have already been submitted from this network in the last hour. Wait a while, or email the alumni cell with your roll number.',
    );
    limit(
      `claim:email:${email}`,
      3,
      60 * 60,
      'A claim for that address was submitted very recently. Check your inbox — the alumni cell replies to each one by hand.',
    );

    const departments = getDepartments();
    if (!departments.some((d) => d.code === input.departmentCode)) {
      throw new HttpError(422, 'invalid_input', 'Pick the branch you graduated in.', {
        field: 'departmentCode',
        fieldErrors: { departmentCode: 'That is not a branch this college awards degrees in.' },
      });
    }

    if (input.consent.noticeVersion !== NOTICE_VERSION) {
      // The notice was redrafted while this form sat open. Re-consent
      // against the current version rather than filing agreement to text
      // the claimant never saw.
      throw new HttpError(
        409,
        'notice_changed',
        'The privacy notice has been updated since you opened this form. Reload the page and read the new version before submitting.',
      );
    }

    // An enumeration surface, and a deliberate one: the alternative is a
    // claim form that silently queues a duplicate for an address that can
    // already sign in. Kept behind the per-address limit above.
    if (findMemberByEmail(email)) {
      throw new HttpError(
        409,
        'already_registered',
        'There is already an account on that address. Sign in instead — a code will be emailed to you.',
      );
    }

    const claim = {
      rollNumber: input.rollNumber.toUpperCase(),
      name: input.fullName,
      departmentCode: input.departmentCode,
      batchYear: input.yearOfPassing,
    };

    const candidates = gatherCandidates({
      rollNumber: input.rollNumber,
      fullName: input.fullName,
      departmentCode: input.departmentCode,
      yearOfPassing: input.yearOfPassing,
    });

    const outcome = matchClaim(claim, candidates);

    const session = await getSession();
    const isReviewer = session
      ? can(session, 'verification.review.any') || can(session, 'verification.review.department')
      : false;

    const scored: Scored[] =
      outcome.decision === 'auto_approve'
        ? [{ record: outcome.record, confidence: outcome.confidence, reasons: outcome.reasons }]
        : outcome.decision === 'review'
          ? outcome.candidates
          : [];

    const tenant = await getTenant();

    if (tenant) {
      await logAudit({
        tenantId: tenant.id,
        session,
        action: 'verification.claim.submit',
        resource: 'verification_claim',
        resourceId: null,
        after: {
          claimedRoll: claim.rollNumber,
          claimedName: claim.name,
          claimedDepartmentCode: claim.departmentCode,
          claimedBatchYear: claim.batchYear,
          email,
          decision: outcome.decision,
          candidateCount: scored.length,
          topConfidence: scored[0]?.confidence ?? null,
        },
        reason: 'Self-service claim against the degree register',
        ip: request.headers.get('x-forwarded-for'),
      });

      // Consent is append-only, and the notice version travels with it.
      await logAudit({
        tenantId: tenant.id,
        session,
        action: 'consent.record',
        resource: 'consent_records',
        resourceId: null,
        after: {
          subject: email,
          purpose: 'degree_register_verification',
          noticeVersion: input.consent.noticeVersion,
          accepted: true,
        },
        ip: request.headers.get('x-forwarded-for'),
      });
    }

    const admissionYear = admissionYearFromRoll(claim.rollNumber);

    return json({
      ok: true,
      // Fixture mode has no writable store. Every guard, the matcher and
      // both audit writes ran; the claim row did not land anywhere.
      persisted: false,
      decision: outcome.decision,
      status: outcome.decision === 'auto_approve' ? 'approved' : outcome.decision === 'review' ? 'queued' : 'rejected',
      reasons: outcome.reasons,
      thresholds: { autoApproveAt: AUTO_APPROVE_AT, reviewAt: REVIEW_AT },
      claim: {
        rollNumber: claim.rollNumber,
        fullName: claim.name,
        departmentCode: claim.departmentCode,
        yearOfPassing: claim.batchYear,
        email,
        mobile: input.mobile ?? null,
        admissionYearFromRoll: admissionYear,
      },
      candidateCount: scored.length,
      // The full register rows go only to someone who reviews claims for a
      // living. Everyone else gets enough to recognise their own record.
      candidates: isReviewer
        ? scored.map((s) => ({
            confidence: Number(s.confidence.toFixed(3)),
            reasons: s.reasons,
            record: s.record,
          }))
        : scored.map(redact),
      message:
        outcome.decision === 'auto_approve'
          ? 'Your record matched the degree register exactly. The alumni cell will confirm and open your account.'
          : outcome.decision === 'review'
            ? 'Your claim is with the alumni cell. Someone checks it against the register by hand, usually within two working days.'
            : 'We could not find a matching record. That is often a roll number typed from memory rather than the certificate — check it and try again, or email the alumni cell.',
    });
  } catch (err) {
    return fail(err);
  }
}
