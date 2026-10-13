import { ROLES, roleHas, type Capability, type Role } from './permissions';
import { VENDOR_ROLE } from './route-policy';

/**
 * Which roles a college's own role manager may grant or revoke.
 *
 * `role.manage` is a *tenant* capability: it is held by `college_admin`,
 * and everything it touches lives inside one college. The vendor's role is
 * not inside any college. `platform_admin` holds `tenant.provision`, which
 * creates and configures colleges across the whole platform — so a tenant
 * that can grant it can make any of its own members the vendor, and a
 * tenant that can revoke it can lock the vendor out of its own console.
 * Neither is a decision a customer gets to make about the operator.
 *
 * This was reachable. `POST /api/admin/roles` refused the cohort roles and
 * nothing else, and the roles screen offered `platform_admin` in its
 * picker, so one request from a college admin was tenant-to-vendor
 * privilege escalation. The capability matrix was correct the whole time;
 * the hole was in who could hand the capability out.
 *
 * The rule is refused in both directions and before any department rule
 * is consulted, so a branch on the request cannot turn it into a
 * different refusal. Vendor accounts are assigned by vendor provisioning,
 * which is not this endpoint and does not run under `role.manage`.
 *
 * Kept pure so `tests/vendor-boundary.test.ts` can pin the decision
 * without a request, and `tests/vendor-boundary.routes.test.ts` pins that
 * the handler actually asks it.
 */

/**
 * Capabilities that act on the platform rather than inside one college.
 * Any role holding one is the vendor's, whatever it is called — so a
 * future operator role is refused here the day it is added to the matrix,
 * rather than the day somebody notices it in the picker.
 */
const CROSS_TENANT: readonly Capability[] = ['tenant.provision'];

/** Roles no tenant-scoped role manager may grant or revoke. Derived, not typed out. */
export const VENDOR_ROLES: readonly Role[] = ROLES.filter(
  (role) => role === VENDOR_ROLE || CROSS_TENANT.some((cap) => roleHas(role, cap)),
);

export function isVendorRole(role: Role): boolean {
  return VENDOR_ROLES.includes(role);
}

export type RoleChangeAction = 'grant' | 'revoke';

/**
 * A refusal in the shape the roles endpoint already uses for a role it
 * will not touch (422, a stable code, one sentence per field).
 */
export interface RoleChangeRefusal {
  status: 422;
  code: 'vendor_role';
  message: string;
  fieldErrors: { role: string };
}

/**
 * Null when a tenant's role manager may make this change, as far as the
 * vendor boundary is concerned. Every other rule on the endpoint — cohort
 * roles, departments, the last college admin — still applies after it.
 */
export function tenantRoleChangeRefusal(
  action: RoleChangeAction,
  role: Role,
  label: string = role,
): RoleChangeRefusal | null {
  if (!isVendorRole(role)) return null;
  return {
    status: 422,
    code: 'vendor_role',
    message: `${label} cannot be ${action === 'grant' ? 'granted' : 'revoked'} from a college's role manager. It is the platform operator's role, not a college role — it can create and configure colleges across the whole platform — so it is assigned and removed only through vendor provisioning. Nothing has been written.`,
    fieldErrors: { role: `Pick a staff role. ${label} is managed by the platform operator, not by the college.` },
  };
}
