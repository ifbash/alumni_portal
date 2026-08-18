import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenant } from '@/lib/tenant';
import { getDepartments, getMembersForAdmin, searchDegreeRegister } from '@/lib/data/repo';
import { logAudit } from '@/lib/audit/log';
import type { MemberDetail } from '@/lib/data/types';
import { matchClaim, normaliseRoll } from '@/lib/verification/matcher';
import { clientIp, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../../_lib/http';

/**
 * Staff corrections to one member record.
 *
 * Four mutations, one capability at the door (`profile.write.any`) and two
 * of them gated again inside — merging needs `profile.merge`, re-running
 * the matcher needs a verification grant. Holding the write capability is
 * not the same as being entitled to fold two people into one.
 *
 * Three properties worth stating, because each of them is the answer to a
 * question asked months later by somebody who was not in the room:
 *
 *  1. **Snapshots are whole, never diffs.** `before` and `after` each carry
 *     the entire record as it stood. Reconstructing state from a diff chain
 *     during an incident is exactly when you cannot afford the extra step,
 *     and the extra bytes cost nothing next to that.
 *  2. **Contact values stay out of the audit entry.** Contact data lives in
 *     `member_contacts` behind its own access control; copying an address
 *     into `audit_log` would put it somewhere `audit.read` can reach it —
 *     which finance and the platform admin hold. The snapshot records
 *     *whether* an address is on file and what the owner's visibility
 *     setting is, never the address itself.
 *  3. **A reason is required on every one of them.** A status change with
 *     no reason is indistinguishable from a mistake six months later, and
 *     the two statuses a person cannot argue their way back from inside
 *     the product — `deceased` and `rejected` — ask for more of one.
 */

const MEMBER_STATUSES = [
  'unclaimed',
  'invited',
  'pending',
  'active_student',
  'active_alumni',
  'rejected',
  'lapsed',
  'deceased',
] as const;

/** Statuses that remove a person from the network. See the header note. */
const GRAVE_STATUSES: ReadonlySet<string> = new Set(['deceased', 'rejected']);

const REASON_MIN = 15;
const GRAVE_REASON_MIN = 25;

const Reason = z.string().trim().max(1000);
const MemberRef = z.string().trim().min(1).max(64);

const Body = z
  .discriminatedUnion('action', [
    z.object({
      action: z.literal('update'),
      reason: Reason,
      profile: z.object({
        preferredName: z.string().trim().max(120).nullable(),
        departmentCode: z.string().trim().max(12).nullable(),
        batchYear: z.number().int().min(1950).max(2100).nullable(),
        currentCompany: z.string().trim().max(160).nullable(),
        city: z.string().trim().max(80).nullable(),
      }),
    }),
    z.object({
      action: z.literal('status'),
      reason: Reason,
      status: z.enum(MEMBER_STATUSES),
    }),
    z.object({
      action: z.literal('verify'),
      reason: Reason,
    }),
    z.object({
      action: z.literal('merge'),
      reason: Reason,
      /** The record that disappears. The one in the URL is the survivor. */
      mergeMemberId: MemberRef,
      confirm: z.string().trim().max(32),
    }),
  ])
  .superRefine((value, ctx) => {
    const written = value.reason.trim().length;

    const grave = value.action === 'status' && GRAVE_STATUSES.has(value.status);
    const floor = grave ? GRAVE_REASON_MIN : REASON_MIN;

    if (written < floor) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: grave
          ? `Write at least ${GRAVE_REASON_MIN} characters saying who confirmed this and how. Neither of these two statuses can be argued back from inside the product, and the family or the applicant will ask.`
          : `Write at least ${REASON_MIN} characters. A change with no reason against it is indistinguishable from a mistake six months later.`,
      });
    }

    if (value.action === 'merge' && value.confirm !== 'MERGE') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirm'],
        message: 'Type MERGE to confirm. Reversing a merge means restoring the database.',
      });
    }
  });

/**
 * The record as it stands, whole.
 *
 * Contact values are deliberately absent — see the header note. Their
 * presence and the owner's visibility choice are recorded, because "did
 * this account have a reachable address at the time" is a real question
 * and the address itself is not needed to answer it.
 */
function snapshot(m: MemberDetail) {
  return {
    memberId: m.id,
    slug: m.slug,
    fullName: m.fullName,
    preferredName: m.preferredName,
    rollNumber: m.rollNumber ?? null,
    status: m.status,
    departmentCode: m.departmentCode,
    batchYear: m.batchYear,
    admissionYear: m.admissionYear,
    programme: m.programme,
    currentCompany: m.currentCompany,
    designation: m.designation,
    city: m.city,
    state: m.state,
    roles: m.roles.map((r) => ({ role: r.role, departmentCode: r.departmentCode })),
    verifiedAt: m.verifiedAt,
    verificationMethod: m.verificationMethod,
    contactVisibility: m.contactVisibility,
    contactOnRecord: {
      email: Boolean(m.contact?.email),
      mobile: Boolean(m.contact?.mobile),
    },
  };
}

type Snapshot = ReturnType<typeof snapshot>;

/**
 * The cohort role follows the cohort status, exactly as `rollover_batch()`
 * does it for a whole year at once. Every other role a person holds —
 * faculty, HOD — is untouched: they are a set, separate from status.
 */
function cohortRoles(roles: Snapshot['roles'], status: string): Snapshot['roles'] {
  const others = roles.filter((r) => r.role !== 'student' && r.role !== 'alumni');
  if (status === 'active_student') return [...others, { role: 'student' as const, departmentCode: null }];
  if (status === 'active_alumni') return [...others, { role: 'alumni' as const, departmentCode: null }];
  // Every other status is inactive: `isActive()` refuses them anyway, so
  // carrying a cohort role on the record would only be misleading.
  return others;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    requireCap(session, 'profile.write.any');

    const tenant = await getTenant();
    if (!tenant) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');

    const { id } = await params;
    const body = await readJson(request, Body);

    limit(
      `member-write:${session.memberId}`,
      60,
      60 * 60,
      'Sixty record changes in an hour is the limit. If a whole batch needs correcting, that is an import or a rollover, not sixty edits.',
    );

    const everyone = getMembersForAdmin({ perPage: 100000 }).items;
    const member = everyone.find((m) => m.id === id || m.slug === id);
    if (!member) {
      throw new HttpError(404, 'not_found', 'There is no member with that id on this college.');
    }

    const before = snapshot(member);
    let after: Snapshot = before;
    let auditAction: string;
    let note: string;
    let extra: Record<string, unknown> = {};
    /** Set only by the merge branch: the record being folded away. */
    let folded: { before: Snapshot; after: Snapshot & { mergedInto: string } } | null = null;

    // -----------------------------------------------------------
    // Correct the record
    // -----------------------------------------------------------
    if (body.action === 'update') {
      const departments = getDepartments();
      const next = body.profile;

      if (next.departmentCode && !departments.some((d) => d.code === next.departmentCode)) {
        throw new HttpError(422, 'invalid_input', 'That branch does not exist on this college.', {
          fieldErrors: { departmentCode: 'Pick a branch from the list.' },
        });
      }

      if (next.batchYear && member.admissionYear && next.batchYear <= member.admissionYear) {
        throw new HttpError(
          422,
          'invalid_input',
          `This record shows admission in ${member.admissionYear}. A year of passing of ${next.batchYear} would be at or before it.`,
          { fieldErrors: { batchYear: `Must be later than the admission year, ${member.admissionYear}.` } },
        );
      }

      after = {
        ...before,
        preferredName: next.preferredName?.trim() || null,
        departmentCode: next.departmentCode || null,
        batchYear: next.batchYear,
        currentCompany: next.currentCompany?.trim() || null,
        city: next.city?.trim() || null,
      };

      auditAction = 'profile.update';
      note =
        'Name and roll number are unchanged — both come from the degree register, and editing them here would break the match that verified this person.';
    }

    // -----------------------------------------------------------
    // Change the status
    // -----------------------------------------------------------
    else if (body.action === 'status') {
      if (body.status === member.status) {
        throw new HttpError(
          422,
          'no_change',
          `This record is already ${body.status}. Nothing has been written.`,
          { fieldErrors: { status: 'Pick a status different from the current one.' } },
        );
      }

      after = {
        ...before,
        status: body.status,
        roles: cohortRoles(before.roles, body.status),
      };

      auditAction = 'member.status';
      note =
        body.status === 'active_alumni'
          ? 'Contact visibility, the giving module and the alumni cohort of the directory all open for this person on their next page load. For a whole graduating batch, use the annual rollover instead — it previews every row before it commits.'
          : body.status === 'active_student'
            ? 'Alumni contact details and the giving module close for this person. Students never see either.'
            : body.status === 'deceased'
              ? 'The record is retained for the institutional record and excluded from every communication segment. Nothing is deleted.'
              : 'The account can no longer sign in. Nothing about the record is deleted, and the person can register again — this is not a ban.';
      extra = { previousStatus: before.status };
    }

    // -----------------------------------------------------------
    // Re-run the matcher
    // -----------------------------------------------------------
    else if (body.action === 'verify') {
      // Reading the register and putting a claim in front of a reviewer is
      // a verification act, not a profile edit. The same two grants the
      // record screen offers the button behind.
      if (!can(session, 'verification.review.any') && !can(session, 'verification.override')) {
        throw new HttpError(
          403,
          'forbidden',
          'Re-running the matcher needs verification.review.any or verification.override. Correcting the record does not carry it — ask the alumni cell.',
        );
      }

      if (!member.rollNumber) {
        throw new HttpError(
          422,
          'no_roll_number',
          'This record carries no roll number, so there is nothing to match against the register. Add the roll number from the memorandum of marks first.',
        );
      }

      const claim = {
        rollNumber: member.rollNumber,
        name: member.fullName,
        departmentCode: member.departmentCode,
        batchYear: member.batchYear,
      };

      const wanted = normaliseRoll(member.rollNumber);
      const pool = searchDegreeRegister('', { perPage: 100000 }).items;

      // The same narrowing `candidateQuery()` describes for the SQL side:
      // the exact roll, or the same branch within two years of the claimed
      // batch. Scoring the whole register would be slower and no better.
      const candidates = pool
        .filter((r) => {
          if (normaliseRoll(r.rollNumber) === wanted) return true;
          if (!claim.batchYear || !r.yearOfPassing) return false;
          if (claim.departmentCode && r.departmentCode !== claim.departmentCode) return false;
          return Math.abs(r.yearOfPassing - claim.batchYear) <= 2;
        })
        .slice(0, 500);

      const outcome = matchClaim(claim, candidates);

      const scored =
        outcome.decision === 'auto_approve'
          ? [{ record: outcome.record, confidence: outcome.confidence, reasons: outcome.reasons }]
          : outcome.decision === 'review'
            ? outcome.candidates
            : [];

      after = {
        ...before,
        // The matcher decides nothing on its own. Status, roles and the
        // verification stamp all stay exactly as they were until a person
        // approves the claim in the queue.
      };

      auditAction = 'member.verify';
      note =
        outcome.decision === 'reject'
          ? `The matcher found nothing it would act on. Nothing about this account has changed. ${
              candidates.length === 0
                ? 'No row in the register is close enough to compare — most often the batch file has not arrived from the examinations branch yet.'
                : 'The candidates it looked at all scored below the review line.'
            }`
          : outcome.decision === 'auto_approve'
            ? 'One register row matched above the auto-approve line. The claim is in the verification queue for a person to bind the account to it — a re-run never approves anything on its own.'
            : `${scored.length} register row${scored.length === 1 ? '' : 's'} scored inside the review band. They are in the verification queue, side by side, for a reviewer to choose between.`;

      extra = {
        match: {
          decision: outcome.decision,
          reasons: outcome.reasons,
          searched: candidates.length,
          registerRows: pool.length,
          candidates: scored.map((c) => ({
            id: c.record.id,
            rollNumber: c.record.rollNumber,
            name: c.record.name,
            departmentCode: c.record.departmentCode,
            yearOfPassing: c.record.yearOfPassing,
            confidence: Number(c.confidence.toFixed(4)),
            reasons: c.reasons,
          })),
        },
      };
    }

    // -----------------------------------------------------------
    // Merge a duplicate
    // -----------------------------------------------------------
    else {
      // Held by the college admin alone. Folding two records together is
      // the one action on this screen that destroys something.
      requireCap(session, 'profile.merge');

      const duplicate = everyone.find((m) => m.id === body.mergeMemberId || m.slug === body.mergeMemberId);
      if (!duplicate) {
        throw new HttpError(404, 'not_found', 'There is no member with that id on this college.', {
          fieldErrors: { mergeMemberId: 'Choose a record from the list.' },
        });
      }

      if (duplicate.id === member.id) {
        throw new HttpError(422, 'invalid_input', 'A record cannot be merged into itself.', {
          fieldErrors: { mergeMemberId: 'Pick the other record.' },
        });
      }

      // Two roll numbers that disagree are two people, according to the
      // only field in the register that cannot collide. If one of them is
      // wrong it is wrong on a certificate, and that is fixed at the
      // examinations branch before it is fixed here.
      if (
        member.rollNumber &&
        duplicate.rollNumber &&
        normaliseRoll(member.rollNumber) !== normaliseRoll(duplicate.rollNumber)
      ) {
        throw new HttpError(
          409,
          'roll_conflict',
          `These records carry different roll numbers — ${member.rollNumber} and ${duplicate.rollNumber}. In the register that makes them two people, however alike the names are. If one of the roll numbers is wrong, correct it through the examinations branch first.`,
          { fieldErrors: { mergeMemberId: 'Different roll numbers. Check both against the memorandum of marks.' } },
        );
      }

      const dupBefore = snapshot(duplicate);

      // The survivor keeps its own identity and gains anything the
      // duplicate had and it did not. Nothing on the survivor is
      // overwritten by the record being folded in.
      after = {
        ...before,
        preferredName: before.preferredName ?? dupBefore.preferredName,
        rollNumber: before.rollNumber ?? dupBefore.rollNumber,
        departmentCode: before.departmentCode ?? dupBefore.departmentCode,
        batchYear: before.batchYear ?? dupBefore.batchYear,
        admissionYear: before.admissionYear ?? dupBefore.admissionYear,
        programme: before.programme ?? dupBefore.programme,
        currentCompany: before.currentCompany ?? dupBefore.currentCompany,
        designation: before.designation ?? dupBefore.designation,
        city: before.city ?? dupBefore.city,
        state: before.state ?? dupBefore.state,
        verifiedAt: before.verifiedAt ?? dupBefore.verifiedAt,
        verificationMethod: before.verificationMethod ?? dupBefore.verificationMethod,
        contactOnRecord: {
          email: before.contactOnRecord.email || dupBefore.contactOnRecord.email,
          mobile: before.contactOnRecord.mobile || dupBefore.contactOnRecord.mobile,
        },
      };

      folded = {
        before: dupBefore,
        after: { ...dupBefore, status: 'lapsed', mergedInto: member.id },
      };

      auditAction = 'member.merge';
      note = `${duplicate.fullName} is folded into ${member.fullName}. The duplicate's connections, event registrations and job applications move across; its login stops working immediately. Reversing this needs a database restore, which is why the audit entry carries both records whole.`;
      extra = { mergedRecord: folded };
    }

    await logAudit({
      tenantId: tenant.id,
      session,
      action: auditAction,
      resource: 'members',
      resourceId: member.id,
      reason: body.reason.trim(),
      // Whole, both sides. See the header note.
      before: folded ? { survivor: before, duplicate: folded.before } : before,
      after: folded ? { survivor: after, duplicate: folded.after } : after,
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();

    return json({
      ok: true,
      ...write,
      action: body.action,
      auditedAs: auditAction,
      member: {
        id: member.id,
        slug: member.slug,
        fullName: member.fullName,
        rollNumber: member.rollNumber ?? null,
      },
      before,
      after,
      ...extra,
      reason: body.reason.trim(),
      note,
    });
  } catch (err) {
    return fail(err);
  }
}
