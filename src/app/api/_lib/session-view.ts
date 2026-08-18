import { can, isActive, type Session } from '@/lib/auth/guard';
import { CAPABILITIES, type Capability } from '@/lib/auth/permissions';
import { findMemberById } from '@/lib/data/repo';

/**
 * The session, as the client is allowed to see it.
 *
 * Built by *selecting into* a shape rather than spreading the member row:
 * `members` carries CGPA, placement status and a full contact record, and
 * none of those has any business in the payload a sign-in returns.
 *
 * Capabilities are resolved here rather than carried in the cookie, so
 * revoking an HOD takes effect on their next request instead of whenever
 * their cookie happens to expire. `can()` already returns false for a
 * member who is not active, so a `pending` account resolves to an empty
 * capability list without a second check.
 */

export interface SessionView {
  memberId: string;
  tenantId: string;
  status: Session['status'];
  active: boolean;
  roles: Array<{ role: string; departmentId: string | null }>;
  departmentId: string | null;
  batchYear: number | null;
  capabilities: Capability[];
  member: {
    slug: string;
    fullName: string;
    preferredName: string | null;
    photoUrl: string | null;
    departmentCode: string | null;
    departmentName: string | null;
    isStudent: boolean;
    verifiedAt: string | null;
  } | null;
}

export function sessionView(session: Session): SessionView {
  const row = findMemberById(session.memberId);

  return {
    memberId: session.memberId,
    tenantId: session.tenantId,
    status: session.status,
    active: isActive(session),
    roles: session.roles.map((r) => ({ role: r.role, departmentId: r.departmentId })),
    departmentId: session.departmentId,
    batchYear: session.batchYear,
    capabilities: CAPABILITIES.filter((c) => can(session, c)),
    member: row
      ? {
          slug: row.slug,
          fullName: row.fullName,
          preferredName: row.preferredName,
          photoUrl: row.photoUrl,
          departmentCode: row.departmentCode,
          departmentName: row.departmentName,
          isStudent: row.isStudent,
          verifiedAt: row.verifiedAt,
        }
      : null,
  };
}
