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

/** Throwing variants for use at the top of route handlers. */

export function requireSession(s: Session | null): asserts s is Session {
  if (!s) throw new AuthzError(401, 'not_authenticated', 'Sign in required');
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
