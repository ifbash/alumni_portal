/**
 * Capability matrix.
 *
 * Every authorisation decision in the app resolves through this file.
 * Route handlers ask `can(session, 'member.export')` — they never
 * inspect roles directly. Adding a role means editing one table here,
 * not grepping for `role === 'admin'` across the codebase.
 */

export const ROLES = [
  'student',
  'alumni',
  'faculty',
  'alumni_cell_operator',
  'placement_officer',
  'hod',
  'finance',
  'college_admin',
  'platform_admin',
] as const;

export type Role = (typeof ROLES)[number];

export const CAPABILITIES = [
  // profile
  'profile.read.own',
  'profile.write.own',
  'profile.read.any',
  'profile.write.any',
  'profile.merge',

  // directory
  'directory.search.alumni',
  'directory.search.students',
  'directory.view.contact',        // see raw contact data
  'directory.view.cgpa',           // student academic data

  // connections
  'connection.send',
  'connection.receive',
  'connection.stats.department',
  'connection.stats.tenant',

  // verification
  'verification.review.department',
  'verification.review.any',
  'verification.override',

  // events
  'event.create.department',
  'event.create.any',
  'event.register',
  'event.checkin',

  // jobs
  'job.post',
  'job.apply',
  'job.moderate',
  'job.applicants.export',

  // donations
  'donation.give',
  'donation.campaign.manage',
  'donation.reconcile',
  'donation.report',

  // comms
  'comms.send.department',
  'comms.send.segment',
  'comms.send.all',

  // admin
  'member.export',                 // bulk contact export
  'role.manage',
  'tenant.configure',
  'audit.read',
  'rollover.execute',
  'tenant.provision',

  /**
   * The DPDP fulfilment queue.
   *
   * Split out from `tenant.configure` because that capability is also
   * held by `platform_admin` — who provisions colleges and configures
   * branding, and who must not be able to read member data. The queue
   * lists members by name alongside what they have asked the college to
   * erase, so gating it on tenant configuration put the vendor inside
   * the customer's subject-rights process.
   */
  'data_request.manage',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/**
 * Grants are additive. A member holding several roles gets the union.
 *
 * Deliberate omissions, do not "fix" without a decision:
 *  - No role below college_admin gets `member.export`. Staff leave, and
 *    an exportable directory leaves with them.
 *  - `directory.view.cgpa` is placement-side only. Alumni post jobs here;
 *    a searchable CGPA list is a recruiting shortcut nobody agreed to.
 *  - Students never receive `donation.give` or `directory.search.students`.
 *  - No role, at any level, can read private message bodies. There is no
 *    capability for it because the capability must not exist.
 */
const GRANTS: Record<Role, Capability[]> = {
  student: [
    'profile.read.own',
    'profile.write.own',
    'directory.search.alumni',
    'connection.send',
    'event.register',
    'job.apply',
  ],

  alumni: [
    'profile.read.own',
    'profile.write.own',
    'directory.search.alumni',
    'connection.send',
    'connection.receive',
    'event.register',
    'job.post',
    'job.apply',
    'donation.give',
  ],

  faculty: [
    'profile.read.own',
    'profile.write.own',
    'directory.search.alumni',
    'directory.search.students',
    'connection.send',
    'connection.receive',
    'event.register',
    'job.post',
    'donation.give',
  ],

  hod: [
    'profile.read.any',
    'directory.search.students',
    'verification.review.department',
    'connection.stats.department',
    'event.create.department',
    'comms.send.department',
  ],

  placement_officer: [
    'directory.search.students',
    'directory.view.cgpa',
    'job.moderate',
    'job.post',
    'job.applicants.export',
    'comms.send.segment',
  ],

  alumni_cell_operator: [
    'profile.read.any',
    'profile.write.any',
    'directory.search.alumni',
    'verification.review.any',
    'event.create.any',
    'event.checkin',
    'comms.send.segment',
  ],

  finance: [
    'donation.reconcile',
    'donation.report',
    'audit.read',
  ],

  college_admin: [
    'profile.read.any',
    'profile.write.any',
    'profile.merge',
    'directory.search.alumni',
    'directory.search.students',
    'directory.view.contact',
    'directory.view.cgpa',
    'verification.review.any',
    'verification.override',
    'connection.stats.tenant',
    'event.create.any',
    'event.checkin',
    'job.moderate',
    // Held alongside `job.moderate` on purpose. An administrator who can
    // approve a posting and cannot see who applied to it has to ask the
    // placement officer for the list, which means the list gets emailed
    // around — the exact outcome the export audit exists to prevent.
    'job.applicants.export',
    'donation.campaign.manage',
    'donation.report',
    'comms.send.all',
    'comms.send.segment',
    'member.export',
    'role.manage',
    'tenant.configure',
    'audit.read',
    'rollover.execute',
    'data_request.manage',
  ],

  /**
   * Runs the infrastructure; cannot read the data on it.
   *
   * Provisioning a college and configuring its branding are operational
   * acts that need no member record, and the grant list is deliberately
   * short enough to check at a glance. Notably absent: every `profile.*`
   * and `directory.*` capability, `member.export`, and
   * `data_request.manage`. `audit.read` stays, because a vendor
   * responding to an incident has to be able to see who did what — the
   * audit log records actions, not member data.
   */
  platform_admin: [
    'tenant.provision',
    'tenant.configure',
    'audit.read',
  ],
};

const GRANT_SETS = ROLES.reduce(
  (acc, r) => {
    acc[r] = new Set<Capability>(GRANTS[r]);
    return acc;
  },
  {} as Record<Role, ReadonlySet<Capability>>,
);

export function capabilitiesFor(roles: readonly Role[]): Set<Capability> {
  const out = new Set<Capability>();
  for (const r of roles) for (const c of GRANT_SETS[r] ?? []) out.add(c);
  return out;
}

export function roleHas(role: Role, cap: Capability): boolean {
  return GRANT_SETS[role]?.has(cap) ?? false;
}

/**
 * Capabilities that must additionally be scoped to a department.
 * Holding these is not enough — the handler must check the target's
 * department against the grant's department_id.
 */
export const DEPARTMENT_SCOPED: ReadonlySet<Capability> = new Set<Capability>([
  'verification.review.department',
  'connection.stats.department',
  'event.create.department',
  'comms.send.department',
  'directory.search.students',
]);
