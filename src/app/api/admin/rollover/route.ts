import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenant } from '@/lib/tenant';
import { getDepartments, getMembersForAdmin, searchDegreeRegister } from '@/lib/data/repo';
import { logAudit } from '@/lib/audit/log';
import { clientIp, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../_lib/http';

/**
 * The annual student → alumnus transition.
 *
 * Three properties, none of them negotiable:
 *
 *  1. **`dryRun` is stated, never defaulted.** There is no shape of body
 *     that executes by omission. A missing field on the most destructive
 *     endpoint in the product must fail closed, and "the client forgot to
 *     send a flag" is exactly how it would otherwise fail open.
 *  2. **Nothing runs on a schedule.** A rollover happens when a college
 *     admin runs it, after the results are out — which in Andhra Pradesh
 *     is rarely the month anyone expects. Run early, final-years become
 *     alumni: their directory cohort, their request quota and their
 *     access to the giving module all change underneath them.
 *  3. **There is no undo inside the product.** Reversing a rollover means
 *     restoring the database to a point before it ran, which loses
 *     everything else that happened in between. That is why executing
 *     asks for the batch year to be typed back.
 *
 * The dry run and the execute path compute the *same* cohort from the
 * *same* query. A preview built by a different code path from the write
 * is a preview of something else.
 */

const Body = z
  .object({
    dryRun: z.boolean({
      required_error:
        'Say whether this is a dry run. There is no default — a missing flag on this endpoint must never mean "go ahead".',
      invalid_type_error: 'dryRun is true or false.',
    }),
    batchYear: z.number().int().min(1990).max(2100),
    /**
     * Typed back on execute, exactly as the runner asks for it on screen.
     * The whole risk of this endpoint is running it against the wrong
     * year, and the confirmation is the only check that catches that.
     */
    confirm: z.string().trim().max(64).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.dryRun && value.confirm !== `ROLLOVER ${value.batchYear}`) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirm'],
        message: `Type ROLLOVER ${value.batchYear} to confirm the batch year is the one you meant. This cannot be undone from inside the product.`,
      });
    }
  });

const COLLEGE_MAIL_DOMAIN = '@diet.ac.in';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    requireCap(session, 'rollover.execute');

    const tenant = await getTenant();
    if (!tenant) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');

    const body = await readJson(request, Body);

    limit(
      body.dryRun ? `rollover-preview:${session.memberId}` : `rollover-execute:${session.memberId}`,
      body.dryRun ? 30 : 3,
      60 * 60,
      body.dryRun
        ? 'Thirty dry runs in an hour is the limit. The counts do not move between one and the next.'
        : 'Three rollover attempts in an hour is the limit. If two of them have already failed, stop and read the error rather than trying a third time.',
    );

    // `getMembersForAdmin` returns the full admin record, including the
    // private contact block. Only the email *domain* and the roll number
    // are read here, and neither the address nor the contact block goes
    // anywhere near the response.
    const students = getMembersForAdmin({ status: 'active_student', perPage: 5000 }).items;

    const years = [...new Set(students.map((s) => s.batchYear).filter((y): y is number => y !== null))].sort(
      (a, b) => a - b,
    );

    const cohort = students.filter((s) => s.batchYear === body.batchYear);

    if (cohort.length === 0) {
      throw new HttpError(
        422,
        'empty_batch',
        `No member has status active_student with year of passing ${body.batchYear}. Nothing would move, so nothing has been run.`,
        { batchYear: body.batchYear, availableYears: years },
      );
    }

    const earliest = years[0]!;

    // Rolling 2028 while 2027 is still on the portal as students means the
    // year behind them graduated first — which cannot be true. The dry run
    // reports it; the execute path refuses it.
    const premature = body.batchYear > earliest;
    if (premature && !body.dryRun) {
      throw new HttpError(
        409,
        'premature_batch',
        `The batch of ${earliest} is still on the portal as a student cohort, so the batch of ${body.batchYear} has not graduated yet. Rolling them now would give final-years alumni access and take away the student view they are actually using. Roll ${earliest} first.`,
        { batchYear: body.batchYear, earliestStudentBatch: earliest },
      );
    }

    const departments = getDepartments();
    const byDept = new Map<string, number>();
    for (const s of cohort) {
      const code = s.departmentCode ?? 'Unrecorded';
      byDept.set(code, (byDept.get(code) ?? 0) + 1);
    }

    const registerRolls = new Set(
      searchDegreeRegister('', { perPage: 100000 }).items.map((r) => r.rollNumber.toUpperCase()),
    );

    // Every student account is on a college mailbox that IT deactivates
    // within weeks of them leaving. After that neither the OTP nor the
    // recovery mail reaches them, and the account — and the person — is
    // lost. The rollover is the last moment anybody can act on this, which
    // is why the number is in the response rather than in a report nobody
    // opens.
    const collegeEmailOnly = cohort.filter((s) =>
      (s.contact?.email ?? '').toLowerCase().endsWith(COLLEGE_MAIL_DOMAIN),
    ).length;

    const withRegisterRow = cohort.filter(
      (s) => s.rollNumber && registerRolls.has(s.rollNumber.toUpperCase()),
    ).length;

    const preview = {
      batchYear: body.batchYear,
      moves: { from: 'active_student', to: 'active_alumni', count: cohort.length },
      byDepartment: [...byDept.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([code, count]) => ({
          code,
          name: departments.find((d) => d.code === code)?.name ?? 'Branch not recorded',
          count,
        })),
      reachability: {
        collegeEmailOnly,
        onPersonalEmail: cohort.length - collegeEmailOnly,
        withRegisterRow,
        withoutRegisterRow: cohort.length - withRegisterRow,
      },
      // What actually changes for a person. Same row in the same table —
      // students are not a separate table, so nothing is copied anywhere.
      changes: {
        status: 'active_student → active_alumni',
        roles: 'student → alumni; any other role a person holds (faculty, HOD) is untouched',
        connectionQuota: { before: '5 open / 10 a month', after: '25 open / 60 a month' },
        directory: 'Moves into the alumni cohort and becomes searchable by the students still on campus',
        gains: ['Posting jobs', 'Receiving mentorship and referral requests', 'The giving module'],
        loses: [
          'Student-only events',
          'The placement cell’s view of their CGPA and placement status, which stays placement-side',
        ],
        untouched: [
          'Contact details and visibility settings',
          'Consent records',
          'Connections',
          'Event registrations and job applications',
        ],
        verificationMethod: 'rollover — the college vouches directly for members with no register row yet',
      },
      sample: cohort.slice(0, 8).map((s) => ({
        name: s.fullName,
        rollNumber: s.rollNumber ?? null,
        departmentCode: s.departmentCode ?? null,
      })),
      warnings: [
        premature
          ? `The batch of ${earliest} is still on the portal as students, so ${body.batchYear} has not graduated. Executing this is refused until ${earliest} has been rolled.`
          : null,
        collegeEmailOnly > 0
          ? `${collegeEmailOnly} of them have only an ${COLLEGE_MAIL_DOMAIN} address on the account. Send the "add a personal email" campaign over WhatsApp before IT deactivates those mailboxes.`
          : null,
        withRegisterRow < cohort.length
          ? `${cohort.length - withRegisterRow} have no row in the degree register yet. They roll over marked verified by rollover and are re-linked automatically when the ${body.batchYear} file arrives from the examinations branch.`
          : null,
      ].filter((w): w is string => w !== null),
    };

    if (body.dryRun) {
      return json({
        ok: true,
        dryRun: true,
        ...preview,
        note: 'Nothing has been read into a write and nothing has changed. To run it, post again with dryRun false and the confirmation phrase.',
      });
    }

    // Per-member snapshots, stored whole rather than as a diff.
    // Reconstructing which 198 people moved from a diff chain, two years
    // later, during a dispute about one of them, is exactly when you cannot
    // afford the extra step.
    const members = cohort.map((s) => ({
      memberId: s.id,
      rollNumber: s.rollNumber ?? null,
      departmentCode: s.departmentCode ?? null,
      batchYear: s.batchYear,
    }));

    const movedAt = new Date().toISOString();

    await logAudit({
      tenantId: tenant.id,
      session,
      action: 'rollover.execute',
      resource: 'members',
      resourceId: `batch/${body.batchYear}`,
      reason: body.reason ?? null,
      before: {
        batchYear: body.batchYear,
        status: 'active_student',
        roles: ['student'],
        count: cohort.length,
        connectionQuota: { open: 5, perMonth: 10 },
        members,
      },
      after: {
        batchYear: body.batchYear,
        status: 'active_alumni',
        roles: ['alumni'],
        count: cohort.length,
        connectionQuota: { open: 25, perMonth: 60 },
        verificationMethod: 'rollover',
        movedAt,
        members,
      },
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();

    return json({
      ok: true,
      dryRun: false,
      ...write,
      ...preview,
      movedAt,
      auditedAs: 'rollover.execute',
      note: `One entry is on the audit log — your name, batch ${body.batchYear}, ${cohort.length} members, with the per-member before and after snapshots attached. Audit rows are append-only and cannot be removed, including by you.`,
    });
  } catch (err) {
    return fail(err);
  }
}
