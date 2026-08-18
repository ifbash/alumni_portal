import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import {
  CAPABILITIES,
  DEPARTMENT_SCOPED,
  ROLES,
  roleHas,
  type Capability,
  type Role,
} from '@/lib/auth/permissions';
import { ROLE_LABELS } from '@/lib/navigation';
import { getTenant } from '@/lib/tenant';
import { getDepartments, getMembersForAdmin } from '@/lib/data/repo';
import { logAudit } from '@/lib/audit/log';
import { clientIp, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../_lib/http';

/**
 * Granting and revoking roles.
 *
 * Two refusals carry this endpoint, and neither is negotiable.
 *
 * **A departmental role without a department is refused.** `hod` holds
 * `verification.review.department` and three siblings; every one of them
 * is checked against the department on the *grant*. A grant with no
 * department attached passes that check for every branch, so an HOD of CSE
 * quietly becomes an HOD of everything — including the ECE claims they
 * must be refused. Defaulting to tenant-wide is how it happens, so there
 * is no default: the scope is a required key, and `null` on a role that
 * cannot be tenant-wide is rejected rather than assumed.
 *
 * **The last `college_admin` cannot be revoked.** `role.manage` is held by
 * that role alone. A tenant with nobody who can grant roles cannot be
 * repaired from inside the product at all — it needs somebody with
 * database access, which for a college on a shared platform means a
 * support ticket and a day. One row of arithmetic here prevents that.
 *
 * Cohort roles (`student`, `alumni`) are not grantable. They follow the
 * member's status, which is what `rollover_batch()` moves; granting one by
 * hand would produce an account whose role and status disagree.
 */

const Reason = z.string().trim().max(1000);
const REASON_MIN = 15;

const Body = z
  .discriminatedUnion('action', [
    z.object({
      action: z.literal('grant'),
      memberId: z.string().trim().min(1).max(64),
      role: z.enum(ROLES),
      /**
       * Required key, nullable value. Omitting it is an error rather than
       * a tenant-wide grant — "the client forgot to send the scope" must
       * never be the same request as "this applies to every branch".
       */
      department: z.string().trim().min(1).max(12).nullable(),
      reason: Reason,
    }),
    z.object({
      action: z.literal('revoke'),
      memberId: z.string().trim().min(1).max(64),
      role: z.enum(ROLES),
      department: z.string().trim().min(1).max(12).nullable(),
      reason: Reason,
    }),
  ])
  .superRefine((value, ctx) => {
    if (value.reason.trim().length < REASON_MIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: `Write at least ${REASON_MIN} characters — who asked for this and on what authority. It is stored verbatim against the audit entry.`,
      });
    }
  });

const COHORT_ROLES: ReadonlySet<Role> = new Set<Role>(['student', 'alumni']);

/** Capabilities that are meaningless outside one branch. */
const DEPARTMENT_ONLY = CAPABILITIES.filter((c) => c.endsWith('.department')) as Capability[];

const scopedCapabilitiesOf = (role: Role) =>
  [...DEPARTMENT_SCOPED].filter((c) => roleHas(role, c)) as Capability[];

const mustHaveDepartment = (role: Role) => DEPARTMENT_ONLY.some((c) => roleHas(role, c));

const label = (role: Role) => ROLE_LABELS[role] ?? role;

export async function POST(request: Request) {
  try {
    const session = await getSession();
    requireCap(session, 'role.manage');

    const tenant = await getTenant();
    if (!tenant) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');

    const body = await readJson(request, Body);

    limit(
      `role-manage:${session.memberId}`,
      30,
      60 * 60,
      'Thirty role changes in an hour is the limit. Beyond that it is worth stopping to ask whether the capability matrix, rather than the grants, is what needs changing.',
    );

    const role = body.role;
    const scoped = scopedCapabilitiesOf(role);

    // These three shape what a grant may say. A revoke is not checked
    // against them on purpose: it has to be able to remove a grant that
    // already exists, including one made before a rule tightened or
    // pointing at a branch the college has since retired. Refusing to
    // revoke something because it should never have been granted leaves
    // it in force, which is the opposite of what the rule is for.
    if (body.action === 'grant') {
      if (COHORT_ROLES.has(role)) {
        throw new HttpError(
          422,
          'cohort_role',
          `${label(role)} is not granted — it follows the member's status, and the annual rollover moves it for a whole batch at once. Granting it by hand produces an account whose role and status disagree.`,
          { fieldErrors: { role: 'Pick a staff role. Student and alumni come from the status.' } },
        );
      }

      const departments = getDepartments();
      if (body.department && !departments.some((d) => d.code === body.department)) {
        throw new HttpError(422, 'invalid_input', 'That branch does not exist on this college.', {
          fieldErrors: { department: `Known branches: ${departments.map((d) => d.code).join(', ')}.` },
        });
      }

      if (mustHaveDepartment(role) && body.department === null) {
        throw new HttpError(
          422,
          'department_required',
          `${label(role)} is departmental in every capability it holds — ${DEPARTMENT_ONLY.filter((c) => roleHas(role, c)).join(', ')}. A grant with no branch attached passes the department check for every branch, which makes an HOD of CSE an HOD of everything. Name the branch.`,
          { fieldErrors: { department: 'Choose the branch this applies to.' } },
        );
      }

      if (scoped.length === 0 && body.department !== null) {
        throw new HttpError(
          422,
          'department_meaningless',
          `${label(role)} holds no department-scoped capability, so a branch on the grant would be recorded and then never checked. That reads as a restriction that is not there.`,
          { fieldErrors: { department: 'Leave this grant institution-wide.' } },
        );
      }
    }

    const everyone = getMembersForAdmin({ perPage: 100000 }).items;
    const member = everyone.find((m) => m.id === body.memberId || m.slug === body.memberId);
    if (!member) {
      throw new HttpError(
        404,
        'not_found',
        'There is no member with that id on this college. Roles are granted to member records, never to an email address — the person has to exist first.',
        { fieldErrors: { memberId: 'Pick a member from the list.' } },
      );
    }

    const held = member.roles.map((r) => ({ role: r.role, departmentCode: r.departmentCode }));
    const existing = held.find((r) => r.role === role && r.departmentCode === body.department);

    // -----------------------------------------------------------
    // Grant
    // -----------------------------------------------------------
    if (body.action === 'grant') {
      if (existing) {
        throw new HttpError(
          409,
          'already_granted',
          `${member.fullName} already holds ${label(role)}${body.department ? ` for ${body.department}` : ' across the institution'}. Nothing has been written.`,
        );
      }

      const wider = held.find((r) => r.role === role && r.departmentCode === null);
      if (wider && body.department) {
        throw new HttpError(
          409,
          'wider_grant_held',
          `${member.fullName} already holds ${label(role)} across the whole institution, so a grant for ${body.department} alone would narrow nothing — grants are additive and the wider one still applies. Revoke the institution-wide grant first if the intention is to restrict them to ${body.department}.`,
        );
      }

      const after = [...held, { role, departmentCode: body.department }].sort(
        (a, b) => a.role.localeCompare(b.role) || (a.departmentCode ?? '').localeCompare(b.departmentCode ?? ''),
      );

      const warnings = [
        scoped.length > 0 && body.department === null
          ? `${label(role)} holds ${scoped.join(', ')}, which are checked against the branch on the grant. With none attached, this passes for every branch.`
          : null,
        role === 'college_admin'
          ? 'College admin is the only role that can export the directory in bulk, manage roles and configure the tenant. It is also the only role that can grant itself.'
          : null,
      ].filter((w): w is string => w !== null);

      await logAudit({
        tenantId: tenant.id,
        session,
        action: 'role.grant',
        resource: 'role_grants',
        resourceId: `${member.id}:${role}`,
        reason: body.reason.trim(),
        // Whole sets, both sides. A diff of one row is unreadable next to
        // "what could this person do before, and what can they do now".
        before: { memberId: member.id, fullName: member.fullName, roles: held },
        after: { memberId: member.id, fullName: member.fullName, roles: after },
        ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
      });

      const write = fixtureWrite();

      return json({
        ok: true,
        ...write,
        action: 'grant',
        auditedAs: 'role.grant',
        member: { id: member.id, fullName: member.fullName, rollNumber: member.rollNumber ?? null },
        role,
        roleLabel: label(role),
        department: body.department,
        roles: after,
        warnings,
        note: `${member.fullName} holds ${label(role)}${body.department ? ` for ${body.department}` : ' across the institution'} from their next page load — roles are resolved from storage on every request, not from whenever their session happens to expire.`,
      });
    }

    // -----------------------------------------------------------
    // Revoke
    // -----------------------------------------------------------
    if (!existing) {
      throw new HttpError(
        409,
        'not_granted',
        `${member.fullName} does not hold ${label(role)}${body.department ? ` for ${body.department}` : ' across the institution'}. Somebody may have revoked it already — reload the list.`,
      );
    }

    if (role === 'college_admin') {
      const admins = everyone.filter((m) => m.roles.some((r) => r.role === 'college_admin'));
      if (admins.length <= 1) {
        throw new HttpError(
          409,
          'last_college_admin',
          `${member.fullName} is the only college admin on this tenant, and college admin is the only role holding role.manage. Revoking it would leave nobody able to grant roles, configure the college or export anything — and no way to repair that from inside the product. Grant somebody else college admin first, then come back.`,
        );
      }
    }

    const after = held.filter((r) => !(r.role === role && r.departmentCode === body.department));

    await logAudit({
      tenantId: tenant.id,
      session,
      action: 'role.revoke',
      resource: 'role_grants',
      resourceId: `${member.id}:${role}`,
      reason: body.reason.trim(),
      before: { memberId: member.id, fullName: member.fullName, roles: held },
      after: { memberId: member.id, fullName: member.fullName, roles: after },
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();

    return json({
      ok: true,
      ...write,
      action: 'revoke',
      auditedAs: 'role.revoke',
      member: { id: member.id, fullName: member.fullName, rollNumber: member.rollNumber ?? null },
      role,
      roleLabel: label(role),
      department: body.department,
      roles: after,
      warnings:
        member.id === session.memberId
          ? ['You have revoked one of your own grants. Anything only that role gave you stops working on your next page load.']
          : [],
      note: `Their member account is untouched — profile, connections and directory listing all stay. Anything only ${label(role)} granted stops working on their next page load.`,
    });
  } catch (err) {
    return fail(err);
  }
}
