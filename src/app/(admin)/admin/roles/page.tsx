import { redirect } from 'next/navigation';
import { Ban, Lock, ShieldCheck } from 'lucide-react';
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
import { getDepartments, getMembersForAdmin } from '@/lib/data/repo';
import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Disclosure,
  PageHeader,
  Section,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { memberLine } from '@/lib/format';
import { RoleEditor, type GrantRow, type RoleOption } from './RoleEditor';

export const metadata = { title: 'Roles' };

/**
 * The capability matrix, rendered.
 *
 * An admin about to make someone an HOD should be able to see what that
 * means before they click, and the honest way to show it is the same
 * table the authorisation layer reads. Nothing on this page is a
 * hand-maintained description of the permission model — every cell is
 * `roleHas()` against the real grants, so the page cannot drift from the
 * code the way a wiki does.
 */

const GROUP_DEFS = [
  {
    id: 'profile',
    label: 'Profiles',
    prefix: 'profile.',
    description: 'Reading and correcting member records, and merging duplicates.',
  },
  {
    id: 'directory',
    label: 'Directory',
    prefix: 'directory.',
    description: 'Who can search which cohort, and who sees raw contact and academic data.',
  },
  {
    id: 'connection',
    label: 'Connections',
    prefix: 'connection.',
    description: 'Sending and receiving introductions, and reading the aggregate numbers.',
  },
  {
    id: 'verification',
    label: 'Verification',
    prefix: 'verification.',
    description: 'Deciding registrations against the degree register, and overriding the matcher.',
  },
  {
    id: 'event',
    label: 'Events',
    prefix: 'event.',
    description: 'Creating events, registering, and checking people in on the day.',
  },
  {
    id: 'job',
    label: 'Jobs',
    prefix: 'job.',
    description: 'Posting, applying, moderating, and exporting applicant lists.',
  },
  {
    id: 'donation',
    label: 'Giving',
    prefix: 'donation.',
    description: 'Campaigns, reconciliation and reporting. Gated behind FCRA confirmation.',
  },
  {
    id: 'comms',
    label: 'Communications',
    prefix: 'comms.',
    description: 'Who may address a department, a segment, or everybody.',
  },
] as const;

const SHORT_ROLE: Record<Role, string> = {
  student: 'Student',
  alumni: 'Alumni',
  faculty: 'Faculty',
  alumni_cell_operator: 'Alumni cell',
  placement_officer: 'Placement',
  hod: 'HOD',
  finance: 'Finance',
  college_admin: 'Admin',
  platform_admin: 'Platform',
};

const ROLE_SUMMARY: Record<Role, string> = {
  student:
    'Searches alumni, sends a capped number of connection requests, registers for events and applies to jobs. Never sees contact details, student records or the giving module.',
  alumni:
    'Full alumni directory, posts jobs, mentors students, gives to campaigns. Sees contact details only where the owner has consented.',
  faculty:
    'The alumni directory plus the students in their department. Posts jobs, moderates nothing.',
  alumni_cell_operator:
    'Runs verification and events day to day and can correct any profile. Deliberately holds no bulk export — this is the account that turns over most often.',
  placement_officer:
    'Student academic data and job moderation. Can export applicant lists for a posting, never the alumni directory.',
  hod:
    'Reviews verification claims and addresses members for one department only. Read-only on profiles; the department scope is checked on every request, not just on the menu.',
  finance:
    'Reconciles and reports on donations and reads the audit log. No directory access of any kind.',
  college_admin:
    'Everything the college can do, including bulk contact export, role management and tenant configuration. The only role that can export.',
  platform_admin:
    'Provisions and configures tenants for ifBash. Deliberately cannot read a single member record — running the platform is not a reason to read a college’s alumni list.',
};

export default async function AdminRolesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  requireCap(session, 'role.manage');

  const groups = GROUP_DEFS.map((g) => ({
    ...g,
    caps: CAPABILITIES.filter((c) => c.startsWith(g.prefix)) as Capability[],
  }));
  const grouped = new Set<Capability>(groups.flatMap((g) => g.caps));
  const adminCaps = CAPABILITIES.filter((c) => !grouped.has(c)) as Capability[];

  const allGroups = [
    ...groups,
    {
      id: 'admin',
      label: 'Administration',
      description: 'Export, role management, tenant configuration, the audit log and the rollover.',
      caps: adminCaps,
    },
  ];

  const scopedCapsOf = (r: Role) =>
    [...DEPARTMENT_SCOPED].filter((c) => roleHas(r, c)) as Capability[];
  const departmentOnlyCaps = CAPABILITIES.filter((c) => c.endsWith('.department')) as Capability[];
  const mustHaveDepartment = (r: Role) => departmentOnlyCaps.some((c) => roleHas(r, c));

  const capabilityCount = (r: Role) => CAPABILITIES.filter((c) => roleHas(r, c)).length;

  const departments = getDepartments();
  const everyone = getMembersForAdmin({ perPage: 100000 }).items;

  const STAFF_ROLES = new Set<Role>([
    'faculty',
    'alumni_cell_operator',
    'placement_officer',
    'hod',
    'finance',
    'college_admin',
    'platform_admin',
  ]);

  const grants: GrantRow[] = everyone
    .flatMap((m) =>
      m.roles
        .filter((r) => STAFF_ROLES.has(r.role))
        .map((r) => ({
          id: `${m.id}-${r.role}`,
          memberId: m.id,
          memberName: m.fullName,
          memberRoll: m.rollNumber ?? null,
          role: r.role,
          roleLabel: ROLE_LABELS[r.role] ?? r.role,
          department: r.departmentCode,
          scoped: scopedCapsOf(r.role).length > 0,
        })),
    )
    .sort((a, b) => a.roleLabel.localeCompare(b.roleLabel) || a.memberName.localeCompare(b.memberName));

  const roleOptions: RoleOption[] = ROLES.filter((r) => r !== 'student' && r !== 'alumni').map((r) => ({
    value: r,
    label: ROLE_LABELS[r] ?? r,
    scoped: scopedCapsOf(r).length > 0,
    mustHaveDepartment: mustHaveDepartment(r),
    capabilityCount: capabilityCount(r),
    scopedCapabilities: scopedCapsOf(r),
    summary: ROLE_SUMMARY[r],
  }));

  const memberOptions = everyone.map((m) => ({
    id: m.id,
    label: memberLine([m.rollNumber, m.fullName, m.departmentCode]),
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Authorisation"
        title="Roles and capabilities"
        description="Nine roles, one capability matrix, no code path that inspects a role directly. Everything below is read from the same table the guards read."
      />

      <Alert tone="info" icon={<ShieldCheck className="size-4" />}>
        <p>
          Granting a role changes what somebody can reach across the whole portal, so this screen is
          held by <span className="font-mono">role.manage</span> — the college admin alone. Hiding a
          menu item is presentation; every route still checks the capability again server-side.
        </p>
      </Alert>

      {/* ---------------------------------------------------------------
          The matrix
         --------------------------------------------------------------- */}
      <Section
        title="What each role can do"
        description="Capabilities granted, by group. Grants are additive: a person holding several roles gets the union."
      >
        <TableWrap caption="Capability matrix — roles against capability groups">
          <Table>
            <THead>
              <TR>
                <TH className="sticky left-0 bg-surface-sunken">Role</TH>
                {allGroups.map((g) => (
                  <TH key={g.id} align="center">
                    {g.label}
                  </TH>
                ))}
                <TH align="right">Total</TH>
              </TR>
            </THead>
            <TBody>
              {ROLES.map((r) => (
                <TR key={r}>
                  <TH scope="row" className="sticky left-0 bg-surface-raised text-left normal-case">
                    <span className="block text-sm font-semibold text-primary">{ROLE_LABELS[r] ?? r}</span>
                    <span className="block font-mono text-xs font-normal normal-case tracking-normal text-muted">
                      {r}
                    </span>
                  </TH>
                  {allGroups.map((g) => {
                    const n = g.caps.filter((c) => roleHas(r, c)).length;
                    return (
                      <TD key={g.id} align="center">
                        {n === 0 ? (
                          <>
                            <span aria-hidden="true" className="text-muted">
                              —
                            </span>
                            <span className="sr-only">none of {g.caps.length}</span>
                          </>
                        ) : (
                          <Badge tone={n === g.caps.length ? 'success' : 'brand'}>
                            {n} of {g.caps.length}
                          </Badge>
                        )}
                      </TD>
                    );
                  })}
                  <TD numeric className="font-semibold">
                    {capabilityCount(r)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ROLES.map((r) => (
            <Card key={r}>
              <CardBody className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-md font-semibold">{ROLE_LABELS[r] ?? r}</h3>
                  {mustHaveDepartment(r) ? (
                    <Badge tone="warning">Department required</Badge>
                  ) : scopedCapsOf(r).length ? (
                    <Badge tone="info">Department aware</Badge>
                  ) : null}
                </div>
                <p className="text-sm text-secondary">{ROLE_SUMMARY[r]}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------------
          Department scoping
         --------------------------------------------------------------- */}
      <Section
        title="Department scoping"
        description="Holding a scoped capability is not enough on its own. The handler compares the target's department against the department on the grant."
      >
        <Card>
          <CardBody className="space-y-4">
            <ul className="flex flex-wrap gap-2">
              {[...DEPARTMENT_SCOPED].map((c) => (
                <li key={c}>
                  <Badge tone="outline" className="font-mono">
                    {c}
                  </Badge>
                </li>
              ))}
            </ul>

            <p className="max-w-prose text-sm text-secondary">
              An HOD of CSE holds <span className="font-mono">verification.review.department</span>{' '}
              and must still be refused an ECE claim. A grant with no department attached passes the
              check for every branch, which is correct for a college admin and a mistake for anybody
              else — so the grant form below will not submit until the scope has been chosen
              explicitly.
            </p>
          </CardBody>
        </Card>
      </Section>

      {/* ---------------------------------------------------------------
          Deliberate omissions
         --------------------------------------------------------------- */}
      <Section
        title="Deliberate omissions"
        description="Gaps in the matrix that look like oversights and are not. Do not close them without a decision."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h3" className="flex items-center gap-2">
                <Ban className="size-4 text-danger-fg" aria-hidden="true" />
                No role reads private message bodies
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-3">
              <p className="text-sm text-secondary">
                There is no capability for it anywhere in the matrix, at any level, because the
                capability must not exist. Moderation acts on reports and metadata. If staff can read
                a student&rsquo;s message to an alumnus, students stop writing honest ones.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h3" className="flex items-center gap-2">
                <Lock className="size-4 text-danger-fg" aria-hidden="true" />
                Bulk export stops at college admin
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-3">
              <p className="text-sm text-secondary">
                <span className="font-mono">member.export</span> is granted to{' '}
                <strong>college_admin</strong> and nothing else — not the alumni cell operator who
                uses the portal daily, not the placement officer, not an HOD. Staff leave, and an
                exportable directory leaves with them. Every export is audit-logged with actor, scope
                and a written reason.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h3" className="flex items-center gap-2">
                <Ban className="size-4 text-danger-fg" aria-hidden="true" />
                CGPA is placement-side only
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-3">
              <p className="text-sm text-secondary">
                <span className="font-mono">directory.view.cgpa</span> reaches the placement officer
                and the college admin. Alumni post jobs here; a searchable CGPA list would be a
                recruiting shortcut that no student agreed to when they registered.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h3" className="flex items-center gap-2">
                <Ban className="size-4 text-danger-fg" aria-hidden="true" />
                Platform admin cannot read members
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-3">
              <p className="text-sm text-secondary">
                The ifBash operations account provisions tenants and configures them. It holds no
                profile, directory or contact capability at all. Running the platform is not a reason
                to be able to read a college&rsquo;s alumni list.
              </p>
            </CardBody>
          </Card>
        </div>
      </Section>

      {/* ---------------------------------------------------------------
          Grants
         --------------------------------------------------------------- */}
      <Section
        title="Grants"
        description="Who holds what today, and how to change it."
      >
        <RoleEditor
          roles={roleOptions}
          departments={departments.map((d) => ({ value: d.code, label: `${d.code} — ${d.name}` }))}
          members={memberOptions}
          grants={grants}
        />
      </Section>

      {/* ---------------------------------------------------------------
          Full detail
         --------------------------------------------------------------- */}
      <Section
        title="Every capability, spelled out"
        description="The exact grants, capability by capability. Departmental capabilities are marked."
      >
        <div className="space-y-3">
          {allGroups.map((g) => (
            <Disclosure
              key={g.id}
              summary={
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-display font-semibold">{g.label}</span>
                  <Badge tone="neutral">{g.caps.length}</Badge>
                  <span className="hidden text-xs font-normal text-secondary sm:inline">
                    {g.description}
                  </span>
                </span>
              }
            >
              <TableWrap caption={`${g.label} capabilities by role`}>
                <Table>
                  <THead>
                    <TR>
                      <TH>Capability</TH>
                      {ROLES.map((r) => (
                        <TH key={r} align="center">
                          {SHORT_ROLE[r]}
                        </TH>
                      ))}
                    </TR>
                  </THead>
                  <TBody>
                    {g.caps.map((c) => (
                      <TR key={c}>
                        <TH scope="row" className="text-left normal-case tracking-normal">
                          <span className="block font-mono text-xs font-medium text-primary">{c}</span>
                          {DEPARTMENT_SCOPED.has(c) ? (
                            <Badge tone="info" className="mt-1">
                              Department scoped
                            </Badge>
                          ) : null}
                        </TH>
                        {ROLES.map((r) => (
                          <TD key={r} align="center">
                            {roleHas(r, c) ? (
                              <>
                                <span aria-hidden="true" className="font-semibold text-success-fg">
                                  ✓
                                </span>
                                <span className="sr-only">granted</span>
                              </>
                            ) : (
                              <>
                                <span aria-hidden="true" className="text-muted">
                                  ·
                                </span>
                                <span className="sr-only">not granted</span>
                              </>
                            )}
                          </TD>
                        ))}
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            </Disclosure>
          ))}
        </div>
      </Section>
    </div>
  );
}
