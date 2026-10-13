import type { Session } from './auth/guard';
import type { Role } from './auth/permissions';
import { yearsOut } from './format';

/**
 * Who somebody is, in the words the UI uses for them.
 *
 * Pure and client-safe: no repo, no session lookup, no server imports.
 * Callers hand in what they already hold.
 *
 * The rule running through all of it: a person's alumni identity (batch,
 * years out) belongs only to people who hold the `alumni` role. Staff demo
 * accounts are seeded from alumni rows and keep a batch year, and a Head
 * of Department introduced as "Batch of 2023 · 3 years out" is a
 * statement about somebody else.
 */

/** The label a role wears in the UI. Order matters — the first wins. */
export const ROLE_LABELS: Record<string, string> = {
  platform_admin: 'Platform admin',
  college_admin: 'College admin',
  alumni_cell_operator: 'Alumni cell',
  placement_officer: 'Placement officer',
  hod: 'Head of department',
  finance: 'Finance',
  faculty: 'Faculty',
  alumni: 'Alumnus',
  student: 'Student',
};

const ROLE_PRIORITY: readonly Role[] = [
  'platform_admin', 'college_admin', 'alumni_cell_operator', 'placement_officer',
  'hod', 'finance', 'faculty', 'alumni', 'student',
];

/**
 * Titles that are not names. Dotted or not, any case: "Dr.", "DR", "Smt".
 * Skipped by `initialsOf` and `firstNameOf`, so "Dr. Ramesh Chalasani" is
 * "RC" and "Ramesh", not "DR" and "Dr.".
 */
const HONORIFICS = new Set(['dr', 'prof', 'mr', 'mrs', 'ms', 'sri', 'smt', 'shri', 'er']);

function isHonorific(token: string): boolean {
  return HONORIFICS.has(token.replace(/\.+$/, '').toLowerCase());
}

function nameTokens(name: string): string[] {
  return name
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !isHonorific(t));
}

/** Up to two initials, honorifics skipped: "Dr. Ramesh Chalasani" → "RC". */
export function initialsOf(name: string): string {
  return nameTokens(name)
    .slice(0, 2)
    .map((t) => t.replace(/^[^\p{L}\p{N}]+/u, '').charAt(0).toUpperCase())
    .join('');
}

/** A register-style initial: "K.", "Ch.", "V". */
function isInitial(token: string): boolean {
  return /^\p{L}{1,2}\.$/u.test(token) || /^\p{L}$/u.test(token);
}

/**
 * The name to greet somebody by. Their preferred name when they set one;
 * otherwise the first real name in their full name, skipping honorifics
 * and register initials: "Dr. Ramesh Chalasani" → "Ramesh",
 * "K. Narasimha Rao" → "Narasimha".
 */
export function firstNameOf(fullName: string, preferredName?: string | null): string {
  const preferred = preferredName?.trim();
  if (preferred) return preferred;

  const tokens = nameTokens(fullName);
  const name = tokens.find((t) => !isInitial(t)) ?? tokens[0];
  return name ?? fullName.trim();
}

type RoleLike = Role | { role: Role };

function roleSet(roles: ReadonlyArray<RoleLike>): Set<Role> {
  return new Set(roles.map((r) => (typeof r === 'string' ? r : r.role)));
}

/** The single role label to show when there is room for only one. */
export function primaryRoleLabel(roles: ReadonlyArray<RoleLike>): string {
  const held = roleSet(roles);
  const top = ROLE_PRIORITY.find((r) => held.has(r));
  return top ? (ROLE_LABELS[top] ?? top) : 'Member';
}

export interface IdentityInput {
  roles: ReadonlyArray<RoleLike>;
  /**
   * The person's branch as `viewerBranch()` gives it. For staff that is the
   * department of their faculty or HOD grant, never the branch of the
   * alumni row a demo account was seeded from.
   */
  departmentCode: string | null;
  departmentName?: string | null;
  batchYear: number | null;
  designation?: string | null;
  isStudent: boolean;
}

/**
 * The one line under a name in the shell and the account menu.
 *
 *  - Student: "CSE · Final year".
 *  - Holder of the alumni role: "CSE · Batch of 2017 · 9 years out".
 *  - Anyone else: their designation, with the department name added when
 *    the designation does not already name it; else the role label.
 *
 * Never the bare role for a member, and never a batch for staff.
 */
export function identityLine(input: IdentityInput): string {
  const held = roleSet(input.roles);
  const dept = input.departmentCode ?? null;

  if (input.isStudent || (held.has('student') && !held.has('alumni'))) {
    return [dept, 'Final year'].filter(Boolean).join(' · ');
  }

  if (held.has('alumni')) {
    const parts = [
      dept,
      input.batchYear ? `Batch of ${input.batchYear}` : null,
      yearsOut(input.batchYear),
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : primaryRoleLabel(input.roles);
  }

  const designation = input.designation?.trim();
  if (designation) {
    const name = input.departmentName?.trim();
    const named =
      !name ||
      designation.toLowerCase().includes(name.toLowerCase()) ||
      Boolean(dept && new RegExp(`\\b${dept}\\b`, 'i').test(designation));
    return named ? designation : `${designation} · ${name}`;
  }

  return primaryRoleLabel(input.roles);
}

/**
 * The viewer's graduating batch, for "Your batch" shortcuts. Only for
 * holders of the alumni role: staff accounts seeded from alumni rows keep
 * a batch year, and a faculty member's palette must not offer them a
 * batch they did not graduate with.
 */
export function viewerBatchYear(session: Pick<Session, 'roles' | 'batchYear'>): number | null {
  return session.roles.some((r) => r.role === 'alumni') ? session.batchYear : null;
}

/**
 * The viewer's branch, for "Your branch" shortcuts.
 *
 *  - Alumni and students: the branch on their own record.
 *  - Staff: the department of their first faculty or HOD grant.
 *  - Anyone else (a college-wide officer, the vendor): null.
 */
export function viewerBranch(session: Pick<Session, 'roles' | 'departmentId'>): string | null {
  if (session.roles.some((r) => r.role === 'alumni' || r.role === 'student')) {
    return session.departmentId;
  }
  const grant = session.roles.find((r) => r.role === 'faculty' || r.role === 'hod');
  return grant?.departmentId ?? null;
}
