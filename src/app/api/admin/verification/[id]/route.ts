import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { can, requireInDepartment, requireSession } from '@/lib/auth/guard';
import { getTenant } from '@/lib/tenant';
import { getVerificationClaims } from '@/lib/data/repo';
import { logAudit } from '@/lib/audit/log';
import { fail, fixtureWrite, HttpError, json, readJson } from '../../../_lib/http';

/**
 * Decide a verification claim.
 *
 * Department scope is not decoration on top of the capability. An HOD of
 * CSE holds `verification.review.department` and must still be refused an
 * ECE claim — that is what `requireInDepartment` is for, and it is
 * checked against the *claim's* branch, not the reviewer's convenience.
 *
 * `verification.review.any` is a different capability held by the alumni
 * cell and the college admin, so the check is composed rather than
 * nested: a wide reviewer never touches the department branch, and a
 * department reviewer never gets waved through by holding the wide one.
 *
 * Two refusals worth keeping:
 *
 *  - **Approving against no evidence needs `verification.override`.** A
 *    claim the matcher found nothing for can still be approved — a 2013
 *    graduate whose year is missing from the register is a real case —
 *    but it is a deliberate, separately-granted act, not a click.
 *  - **An ambiguous claim needs a record chosen explicitly.** Two people
 *    with the same name in the same branch and year is not rare in a
 *    cohort of 240, and picking "the first one" silently is how the wrong
 *    person gets somebody else's alumni account.
 */

const Body = z
  .object({
    action: z.enum(['approve', 'reject']),
    /** Which register row the claim is being matched to. */
    degreeRecordId: z.string().trim().max(64).optional(),
    note: z.string().trim().max(600).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === 'reject' && (value.note?.trim().length ?? 0) < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['note'],
        message:
          'Say why. The claimant is told, and "rejected" on its own gives them nothing to correct and no reason to trust the answer.',
      });
    }
  });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    requireSession(session);

    const tenant = await getTenant();
    if (!tenant) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');

    const { id } = await params;

    // The repository already narrows the queue to the reviewer's scope, so
    // a claim outside it is simply not here. That is the read guard; the
    // write guard is separate and explicit below.
    const claim = getVerificationClaims(session, { status: 'all' }).find((c) => c.id === id);
    if (!claim) {
      throw new HttpError(404, 'not_found', 'There is no claim with that id in your queue.');
    }

    const wide = can(session, 'verification.review.any');
    if (!wide) {
      requireInDepartment(session, 'verification.review.department', claim.claimedDepartmentCode);
    }

    const body = await readJson(request, Body);

    if (claim.status !== 'queued') {
      throw new HttpError(
        409,
        'already_decided',
        `This claim was already ${claim.status}${claim.reviewedBy ? ` by ${claim.reviewedBy}` : ''}. Reopening a decided claim is an override, not a review.`,
        { status: claim.status, reviewedAt: claim.reviewedAt },
      );
    }

    let matchedRecordId: string | null = null;

    if (body.action === 'approve') {
      const candidateIds = claim.candidates.map((c) => c.record.id);

      if (candidateIds.length === 0) {
        if (!can(session, 'verification.override')) {
          throw new HttpError(
            403,
            'override_required',
            'The matcher found no register row for this claim. Approving it anyway needs the override capability — ask the college admin.',
          );
        }
        matchedRecordId = body.degreeRecordId ?? null;
      } else if (candidateIds.length === 1) {
        matchedRecordId = body.degreeRecordId ?? candidateIds[0];
      } else {
        if (!body.degreeRecordId) {
          throw new HttpError(
            422,
            'record_required',
            'This claim matched more than one register row. Choose the record you are approving against — the names and years are close enough that guessing is how the wrong person gets an account.',
            { candidates: claim.candidates.map((c) => ({ id: c.record.id, name: c.record.name, rollNumber: c.record.rollNumber, yearOfPassing: c.record.yearOfPassing, confidence: c.confidence })) },
          );
        }
        matchedRecordId = body.degreeRecordId;
      }

      if (
        matchedRecordId &&
        candidateIds.length > 0 &&
        !candidateIds.includes(matchedRecordId) &&
        !can(session, 'verification.override')
      ) {
        throw new HttpError(
          403,
          'override_required',
          'That register row is not one the matcher surfaced for this claim. Approving against it needs the override capability.',
        );
      }
    }

    const before = {
      status: claim.status,
      decision: claim.decision,
      reviewedBy: claim.reviewedBy,
      reviewedAt: claim.reviewedAt,
      reviewNote: claim.reviewNote,
    };

    const reviewedAt = new Date().toISOString();
    const after = {
      status: body.action === 'approve' ? ('approved' as const) : ('rejected' as const),
      decision: claim.decision,
      reviewedBy: session.memberId,
      reviewedAt,
      reviewNote: body.note ?? null,
      matchedDegreeRecordId: matchedRecordId,
    };

    await logAudit({
      tenantId: tenant.id,
      session,
      action: `verification.${body.action}`,
      resource: 'verification_claims',
      resourceId: claim.id,
      before,
      after,
      reason: body.note ?? null,
      ip: request.headers.get('x-forwarded-for'),
    });

    const write = fixtureWrite();

    return json({
      ok: true,
      ...write,
      claim: {
        id: claim.id,
        claimedName: claim.claimedName,
        claimedRoll: claim.claimedRoll,
        claimedDepartmentCode: claim.claimedDepartmentCode,
        ...after,
      },
      note:
        body.action === 'approve'
          ? 'The account moves to active and the member can sign in. The register row is now marked claimed, so the same certificate cannot be used twice.'
          : 'The claimant is emailed your note. They can correct the details and submit again — a rejection is not a ban.',
    });
  } catch (err) {
    return fail(err);
  }
}
