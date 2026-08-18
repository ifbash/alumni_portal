import { describe, expect, it } from 'vitest';
import {
  AuthzError,
  can,
  canInDepartment,
  isActive,
  require as requireCap,
  requireInDepartment,
  requireSelfOr,
  requireSession,
  toResponse,
  type MemberStatus,
  type Session,
} from '@/lib/auth/guard';
import { CAPABILITIES, ROLES, type Capability } from '@/lib/auth/permissions';

/**
 * Session gating and department scope.
 *
 * Two failure modes are being fenced off here: a half-registered account
 * acting because someone forgot the status check, and an HOD reaching
 * into another department because the capability check was mistaken for
 * the whole authorisation decision.
 */

function session(over: Partial<Session> = {}): Session {
  return {
    memberId: 'mem-a-9',
    tenantId: 'ten-diet',
    status: 'active_alumni',
    roles: [],
    departmentId: null,
    batchYear: 2017,
    ...over,
  };
}

const EVERY_ROLE = ROLES.map((role) => ({ role, departmentId: null }));

describe('status gate', () => {
  it('gives a pending member zero capabilities however many roles are attached', () => {
    // A pending account has submitted a claim and nothing more. Roles are
    // attached at verification, but a bug that attaches them early must
    // not be the same bug as an authorisation bypass.
    const pending = session({ status: 'pending', roles: EVERY_ROLE });

    expect(isActive(pending)).toBe(false);
    for (const cap of CAPABILITIES) {
      expect(can(pending, cap), `pending must not hold ${cap}`).toBe(false);
      expect(canInDepartment(pending, cap, 'CSE'), `pending must not hold ${cap} in CSE`).toBe(false);
    }
  });

  it('refuses every non-active status, not just pending', () => {
    const inactive: MemberStatus[] = ['unclaimed', 'invited', 'pending', 'rejected', 'lapsed', 'deceased'];
    for (const status of inactive) {
      const s = session({ status, roles: EVERY_ROLE });
      expect(isActive(s), `${status} must not be active`).toBe(false);
      expect(can(s, 'directory.search.alumni'), `${status} must not search`).toBe(false);
    }
  });

  it('lets both active statuses act', () => {
    for (const status of ['active_student', 'active_alumni'] as MemberStatus[]) {
      const s = session({ status, roles: [{ role: 'alumni', departmentId: null }] });
      expect(isActive(s)).toBe(true);
      expect(can(s, 'directory.search.alumni')).toBe(true);
    }
  });
});

describe('canInDepartment', () => {
  const hodOfCse = session({
    memberId: 'mem-a-2',
    departmentId: 'CSE',
    roles: [
      { role: 'faculty', departmentId: 'CSE' },
      { role: 'hod', departmentId: 'CSE' },
    ],
  });

  it('refuses an HOD of CSE an ECE claim and allows a CSE one', () => {
    // The HOD genuinely holds verification.review.department. Holding it
    // is not the decision — the target's department is.
    expect(can(hodOfCse, 'verification.review.department')).toBe(true);
    expect(canInDepartment(hodOfCse, 'verification.review.department', 'CSE')).toBe(true);
    expect(canInDepartment(hodOfCse, 'verification.review.department', 'ECE')).toBe(false);
    expect(canInDepartment(hodOfCse, 'verification.review.department', null)).toBe(false);
  });

  it('treats a grant with no department as valid everywhere', () => {
    // How a college-wide role is expressed: one grant, department null.
    const wide = session({
      roles: [{ role: 'hod', departmentId: null }],
    });
    for (const target of ['CSE', 'ECE', 'MECH', null]) {
      expect(canInDepartment(wide, 'verification.review.department', target)).toBe(true);
    }
  });

  it('ignores the target department for capabilities that are not scoped', () => {
    // profile.read.any is not department-scoped. An HOD reading a profile
    // is not the check that needs a department, and pretending otherwise
    // would break every unscoped route the moment a grant carries a
    // department.
    expect(canInDepartment(hodOfCse, 'profile.read.any', 'ECE')).toBe(true);
    expect(canInDepartment(hodOfCse, 'profile.read.any', null)).toBe(true);
  });

  it('refuses a capability the roles do not grant, department or not', () => {
    expect(canInDepartment(hodOfCse, 'member.export', 'CSE')).toBe(false);
    expect(canInDepartment(hodOfCse, 'member.export', null)).toBe(false);
  });

  it('takes the union across grants when one role is scoped and another is not', () => {
    // Faculty in ECE, operator college-wide. The operator grant carries
    // verification.review.any; the ECE grant must not narrow it.
    const both = session({
      roles: [
        { role: 'faculty', departmentId: 'ECE' },
        { role: 'alumni_cell_operator', departmentId: null },
      ],
    });
    expect(canInDepartment(both, 'verification.review.any', 'CSE')).toBe(true);
    // directory.search.students *is* scoped, and only the ECE grant carries it.
    expect(canInDepartment(both, 'directory.search.students', 'ECE')).toBe(true);
    expect(canInDepartment(both, 'directory.search.students', 'CSE')).toBe(false);
  });
});

describe('requireSelfOr', () => {
  const owner = session({ memberId: 'mem-a-9', roles: [{ role: 'alumni', departmentId: null }] });
  const stranger = session({ memberId: 'mem-a-77', roles: [{ role: 'alumni', departmentId: null }] });
  const operator = session({
    memberId: 'mem-a-1',
    roles: [{ role: 'alumni_cell_operator', departmentId: null }],
  });

  it('lets the owner through without the capability', () => {
    expect(can(owner, 'profile.write.any')).toBe(false);
    expect(() => requireSelfOr(owner, owner.memberId, 'profile.write.any')).not.toThrow();
  });

  it('refuses a stranger who does not hold the capability', () => {
    expect(() => requireSelfOr(stranger, owner.memberId, 'profile.write.any')).toThrow(AuthzError);
  });

  it('lets a stranger through when they do hold it', () => {
    expect(can(operator, 'profile.write.any')).toBe(true);
    expect(() => requireSelfOr(operator, owner.memberId, 'profile.write.any')).not.toThrow();
  });

  it('still requires a session', () => {
    expect(() => requireSelfOr(null, owner.memberId, 'profile.write.any')).toThrow(AuthzError);
  });
});

describe('AuthzError status codes', () => {
  const caught = (fn: () => void): AuthzError => {
    try {
      fn();
    } catch (e) {
      if (e instanceof AuthzError) return e;
      throw e;
    }
    throw new Error('expected an AuthzError');
  };

  it('is 401 when there is no session', () => {
    // 401 and 403 are not interchangeable: one tells the client to sign
    // in, the other tells it that signing in again will not help.
    const e = caught(() => requireSession(null));
    expect(e.status).toBe(401);
    expect(e.code).toBe('not_authenticated');
  });

  it('is 401 for a capability check with no session, not 403', () => {
    expect(caught(() => requireCap(null, 'member.export')).status).toBe(401);
    expect(caught(() => requireInDepartment(null, 'verification.review.department', 'CSE')).status).toBe(401);
  });

  it('is 403 when a session is held but insufficient', () => {
    const alumnus = session({ roles: [{ role: 'alumni', departmentId: null }] });
    const e = caught(() => requireCap(alumnus, 'member.export'));
    expect(e.status).toBe(403);
    expect(e.code).toBe('forbidden');
  });

  it('is 403 when the capability is held but the department is wrong', () => {
    const hodOfCse = session({
      roles: [{ role: 'hod', departmentId: 'CSE' }],
    });
    const e = caught(() => requireInDepartment(hodOfCse, 'verification.review.department', 'ECE'));
    expect(e.status).toBe(403);
    expect(e.message).toBe('Outside your department scope');
  });

  it('maps to a response without leaking internals', () => {
    expect(toResponse(new AuthzError(403, 'forbidden', 'nope'))).toEqual({
      status: 403,
      body: { error: 'nope', code: 'forbidden' },
    });
    // Anything that is not an AuthzError is a bug, and a bug must not
    // describe itself to the client.
    expect(toResponse(new Error('connection to 10.0.0.4 refused'))).toEqual({
      status: 500,
      body: { error: 'Internal error' },
    });
  });
});

describe('require', () => {
  it('passes a session that holds the capability', () => {
    const admin = session({ roles: [{ role: 'college_admin', departmentId: null }] });
    const cap: Capability = 'member.export';
    expect(() => requireCap(admin, cap)).not.toThrow();
  });
});
