import {
  capabilitiesFor,
  DEPARTMENT_SCOPED,
  type Capability,
  type Role,
} from './permissions';

export type MemberStatus =
  | 'unclaimed' | 'invited' | 'pending'
  | 'active_student' | 'active_alumni'
  | 'rejected' | 'lapsed' | 'deceased';

export interface RoleGrant {
  role: Role;
  departmentId: string | null;
}

export interface Session {
  memberId: string;
  tenantId: string;
  status: MemberStatus;
  roles: RoleGrant[];
  departmentId: string | null;
  batchYear: number | null;
}

export class AuthzError extends Error {
  constructor(
    readonly status: 401 | 403,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Only these statuses may act. `pending` members can read their own
 * profile and nothing else — enforced by giving them no roles at all
 * until verification completes.
 */
const ACTIVE: ReadonlySet<MemberStatus> = new Set<MemberStatus>([
  'active_student',
  'active_alumni',
]);

export function isActive(s: Session): boolean {
  return ACTIVE.has(s.status);
}

/**
 * True when every role the session holds is the vendor's.
 *
 * Asked of roles rather than capabilities because the question is *who*
 * somebody is: an ifBash engineer who is also a college's alumnus holds
 * `alumni` as well and is, for that college's data, an alumnus. See
 * `isVendorOnly` in route-policy.ts, which asks the same of a
 * `CoarseViewer`.
 */
export function isVendorOnlySession(s: Session): boolean {
  return s.roles.length > 0 && s.roles.every((g) => g.role === 'platform_admin');
}

export function rolesOf(s: Session): Role[] {
  return s.roles.map((g) => g.role);
}

export function can(s: Session, cap: Capability): boolean {
  if (!isActive(s)) return false;
  return capabilitiesFor(rolesOf(s)).has(cap);
}

/**
 * Department-scoped check. An HOD of CSE reviewing an ECE claim holds
 * `verification.review.department` but must still be refused.
 *
 * Non-scoped capabilities ignore `targetDepartmentId` entirely.
 */
export function canInDepartment(
  s: Session,
  cap: Capability,
  targetDepartmentId: string | null,
): boolean {
  if (!isActive(s)) return false;

  const grants = s.roles.filter((g) =>
    capabilitiesFor([g.role]).has(cap),
  );
  if (grants.length === 0) return false;

  if (!DEPARTMENT_SCOPED.has(cap)) return true;

  return grants.some(
    (g) => g.departmentId === null || g.departmentId === targetDepartmentId,
  );
}

export type DepartmentScope =
  | { all: true }
  | { all: false; departments: ReadonlySet<string> };

/**
 * Which departments a capability covers for this session.
 *
 * The question pages used to answer for themselves by looking for the
 * `hod` role - which is how an HOD with no department set slipped through
 * as "unscoped". Ask the capability instead: `all` when any grant that
 * carries it is not tied to a department (or the capability is not
 * department-scoped at all), otherwise the union of the grants'
 * departments. Nothing held, or an inactive member, is an empty set - never
 * "everything".
 */
export function departmentScopeFor(s: Session, cap: Capability): DepartmentScope {
  const none: DepartmentScope = { all: false, departments: new Set() };
  if (!isActive(s)) return none;

  const grants = s.roles.filter((g) => capabilitiesFor([g.role]).has(cap));
  if (grants.length === 0) return none;
  if (!DEPARTMENT_SCOPED.has(cap)) return { all: true };
  if (grants.some((g) => g.departmentId === null)) return { all: true };

  return {
    all: false,
    departments: new Set(grants.map((g) => g.departmentId).filter((d): d is string => d !== null)),
  };
}

/** Throwing variants for use at the top of route handlers. */

export function requireSession(s: Session | null): asserts s is Session {
  if (!s) throw new AuthzError(401, 'not_authenticated', 'Sign in required');
}

/**
 * A signed-in member who is allowed to act at all.
 *
 * For surfaces that ask no capability because "any member" is the right bar
 * - the jobs board, the news. A `pending`, `rejected` or `lapsed` member
 * has a perfectly valid session (sign-in does not look at status) and no
 * roles, so a bare `requireSession` there serves them everything an active
 * member sees, including the names of the alumni who posted.
 */
export function requireActive(s: Session | null): asserts s is Session {
  requireSession(s);
  if (!isActive(s)) {
    throw new AuthzError(403, 'account_inactive', 'Your account is not active yet');
  }
}

export function require(s: Session | null, cap: Capability): asserts s is Session {
  requireSession(s);
  if (!can(s, cap)) {
    throw new AuthzError(403, 'forbidden', 'You do not have permission to do that');
  }
}

export function requireInDepartment(
  s: Session | null,
  cap: Capability,
  targetDepartmentId: string | null,
): asserts s is Session {
  requireSession(s);
  if (!canInDepartment(s, cap, targetDepartmentId)) {
    throw new AuthzError(403, 'forbidden', 'Outside your department scope');
  }
}

/** Ownership check — "own profile" routes. */
export function requireSelfOr(
  s: Session | null,
  targetMemberId: string,
  cap: Capability,
): asserts s is Session {
  requireSession(s);
  if (s.memberId === targetMemberId) return;
  if (!can(s, cap)) {
    throw new AuthzError(403, 'forbidden', 'You do not have permission to do that');
  }
}

export function toResponse(err: unknown): { status: number; body: unknown } {
  if (err instanceof AuthzError) {
    return { status: err.status, body: { error: err.message, code: err.code } };
  }
  return { status: 500, body: { error: 'Internal error' } };
}
