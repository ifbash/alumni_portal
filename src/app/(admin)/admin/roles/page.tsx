import { redirect } from 'next/navigation';
import { Ban, Check, Lock, ShieldCheck } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import {
  CAPABILITIES,
  DEPARTMENT_SCOPED,
  ROLES,
  capabilitiesFor,
  roleHas,
  type Capability,
  type Role,
} from '@/lib/auth/permissions';
import { ROLE_LABELS } from '@/lib/navigation';
import { getTenantBrand } from '@/lib/tenant';
import { capitalise, vendorLabel } from '@/lib/branding/copy';
import { getDepartments, getMembersForAdmin } from '@/lib/data/repo';
import {
  Breadcrumbs,
  Card,
  CardBody,
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
import { GrantList, GrantRoleButton, type GrantGroup, type GrantRow, type RoleOption } from './RoleEditor';

export const metadata = { title: 'Roles · Staff console' };

/**
 * Who holds staff access, and what each role can do.
 *
 * People first, because that is what the college admin opens this page to
 * change. The role cards say what a role is for in plain verbs; the full
 * table underneath is still computed from `roleHas()` against the real
 * grants, so the page cannot drift from the code the way a wiki does.
 */

/** The roles a college grants. The vendor's role is provisioned, never granted here. */
const GRANTABLE: Role[] = ['college_admin', 'alumni_cell_operator', 'placement_officer', 'hod', 'finance', 'faculty'];

const ROLE_BULLETS: Partial<Record<Role, string[]>> = {
  college_admin: [
    'Does everything the college can do on the portal',
    'Gives and removes roles',
    'Exports member contacts, with a recorded reason',
    'Runs the annual rollover and handles data requests',
  ],
  alumni_cell_operator: [
    'Reviews registrations for every branch',
    'Runs events and checks people in at the door',
    'Corrects any member record',
    'Writes to groups of members',
  ],
  placement_officer: [
    'Moderates job postings',
    'Sees final-year academic and placement data',
    'Exports the applicants for a posting',
    'Writes to groups of members',
  ],
  hod: [
    'Reviews registrations for one branch',
    'Reads member records',
    'Runs events for the branch and writes to it',
  ],
  finance: ['Reconciles and reports on donations', 'Reads the audit log', 'Has no access to the directory'],
  faculty: ['Searches alumni and final-year students', 'Posts jobs', 'Registers for events and receives requests'],
};

const GROUP_DEFS = [
  { id: 'profile', label: 'Member records', prefix: 'profile.' },
  { id: 'directory', label: 'Directory', prefix: 'directory.' },
  { id: 'connection', label: 'Requests', prefix: 'connection.' },
  { id: 'verification', label: 'Registrations', prefix: 'verification.' },
  { id: 'event', label: 'Events', prefix: 'event.' },
  { id: 'job', label: 'Jobs', prefix: 'job.' },
  { id: 'donation', label: 'Giving', prefix: 'donation.' },
  { id: 'comms', label: 'Messages', prefix: 'comms.' },
] as const;

/** Every capability in words. Typed on the full list, so a new capability without a label fails the build. */
const CAPABILITY_LABEL: Record<Capability, string> = {
  'profile.read.own': 'Read their own record',
  'profile.write.own': 'Edit their own record',
  'profile.read.any': 'Read any member record',
  'profile.write.any': 'Correct any member record',
  'profile.merge': 'Merge duplicate records',
  'directory.search.alumni': 'Search alumni',
  'directory.search.students': 'Search final-year students',
  'directory.view.contact': 'See contact details on file',
  'directory.view.cgpa': 'See academic and placement data',
  'connection.send': 'Send requests',
  'connection.receive': 'Receive requests',
  'connection.stats.department': 'See request figures for a branch',
  'connection.stats.tenant': 'See request figures for the college',
  'verification.review.department': 'Review registrations for a branch',
  'verification.review.any': 'Review registrations for every branch',
  'verification.override': 'Reopen decided registrations',
  'event.create.department': 'Run events for a branch',
  'event.create.any': 'Run events for the college',
  'event.register': 'Register for events',
  'event.checkin': 'Check people in at the door',
  'job.post': 'Post jobs',
  'job.apply': 'Apply to jobs',
  'job.moderate': 'Moderate job postings',
  'job.applicants.export': 'Export the applicants for a posting',
  'donation.give': 'Give to campaigns',
  'donation.campaign.manage': 'Run giving campaigns',
  'donation.reconcile': 'Reconcile donations',
  'donation.report': 'Report on donations',
  'comms.send.department': 'Write to a branch',
  'comms.send.segment': 'Write to groups of members',
  'comms.send.all': 'Write to everyone',
  'member.export': 'Export member contacts',
  'role.manage': 'Give and remove roles',
  'tenant.configure': 'Configure the portal',
  'audit.read': 'Read the audit log',
  'rollover.execute': 'Run the annual rollover',
  'tenant.provision': 'Set up colleges',
  'data_request.manage': 'Handle data requests',
};

function orList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

function andList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** What the vendor's role can and cannot do, read off the matrix rather than written by hand. */
function vendorLine(): string {
  const caps = capabilitiesFor(['platform_admin']);
  const has = (c: Capability) => caps.has(c);
  const any = (prefix: string) => [...caps].some((c) => c.startsWith(prefix));

  const can: string[] = [];
  if (has('tenant.provision') && has('tenant.configure')) can.push('set up and configure this portal');
  else if (has('tenant.configure')) can.push('configure this portal');
  else if (has('tenant.provision')) can.push('set up this portal');
  if (has('audit.read')) can.push('read the audit log');

  const cannot: string[] = [];
  if (!any('profile.')) cannot.push('member records');
  if (!any('directory.search.')) cannot.push('the directory');
  if (!has('directory.view.contact') && !has('member.export')) cannot.push('contact details');

  return [
    can.length ? `Can ${andList(can)}.` : null,
    cannot.length ? `Cannot see ${orList(cannot)}.` : null,
  ]
    .filter(Boolean)
    .join(' ');
}

export default async function AdminRolesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  requireCap(session, 'role.manage');

  const resolved = await getTenantBrand();
  if (!resolved) redirect('/login');
  const pack = resolved.brand.pack;
  const vendor = vendorLabel(pack.copy);
  // A brand keeps its own casing ("ifBash"); only the generic fallback is capitalised.
  const Vendor = /^the /.test(vendor) ? capitalise(vendor) : vendor;

  const groups = GROUP_DEFS.map((g) => ({
    ...g,
    caps: CAPABILITIES.filter((c) => c.startsWith(g.prefix)) as Capability[],
  }));
  const grouped = new Set<Capability>(groups.flatMap((g) => g.caps));
  const allGroups = [
    ...groups,
    { id: 'admin', label: 'Administration', prefix: '', caps: CAPABILITIES.filter((c) => !grouped.has(c)) as Capability[] },
  ];

  const scopedCapsOf = (r: Role) => [...DEPARTMENT_SCOPED].filter((c) => roleHas(r, c)) as Capability[];
  const departmentOnlyCaps = CAPABILITIES.filter((c) => c.endsWith('.department')) as Capability[];
  const mustHaveDepartment = (r: Role) => departmentOnlyCaps.some((c) => roleHas(r, c));

  const departments = getDepartments();
  const everyone = getMembersForAdmin({ perPage: 100000 }).items;

  const STAFF_ROLES = new Set<Role>([...GRANTABLE, 'platform_admin']);

  const grants: GrantRow[] = everyone.flatMap((m) =>
    m.roles
      .filter((r) => STAFF_ROLES.has(r.role))
      .map((r) => ({
        id: `${m.id}-${r.role}-${r.departmentCode ?? 'all'}`,
        memberId: m.id,
        memberName: m.fullName,
        role: r.role,
        roleLabel: ROLE_LABELS[r.role] ?? r.role,
        department: r.departmentCode,
        scoped: scopedCapsOf(r.role).length > 0,
      })),
  );

  const grantGroups: GrantGroup[] = GRANTABLE.map((role) => ({
    role,
    label: ROLE_LABELS[role] ?? role,
    grants: grants.filter((g) => g.role === role).sort((a, b) => a.memberName.localeCompare(b.memberName)),
  })).filter((g) => g.grants.length > 0);

  // The vendor's grant is shown, never offered for revoking: the server
  // refuses both granting and revoking it.
  const vendorGrants = grants.filter((g) => g.role === 'platform_admin').length;

  // platform_admin is never offered: it is provisioned by the vendor, not
  // granted by a college. Display narrowing; the server refuses it too.
  const roleOptions: RoleOption[] = GRANTABLE.map((r) => ({
    value: r,
    label: ROLE_LABELS[r] ?? r,
    scoped: scopedCapsOf(r).length > 0,
    mustHaveDepartment: mustHaveDepartment(r),
    bullets: ROLE_BULLETS[r] ?? [],
  }));

  const memberOptions = everyone.map((m) => ({
    id: m.id,
    label: memberLine([m.rollNumber, m.fullName, m.departmentCode]),
  }));

  const columns = ROLES.filter((r) => r !== 'platform_admin');

  return (
    <div className="space-y-8">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: 'Staff console', href: '/admin' }, { label: 'Roles' }]} />}
        eyebrow="People and records"
        title="Roles"
        description="Who has staff access, and what each role can do."
        actions={
          <GrantRoleButton
            roles={roleOptions}
            departments={departments.map((d) => ({ value: d.code, label: `${d.code} — ${d.name}` }))}
            members={memberOptions}
          />
        }
      />

      <Section title="People with staff access">
        <GrantList
          groups={grantGroups}
          vendor={vendorGrants > 0 ? { label: `Platform provider (${vendor})`, line: vendorLine() } : null}
        />
      </Section>

      <Section title="What each role can do">
        <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 xl:grid-cols-3">
          {roleOptions.map((r) => (
            <Card key={r.value} className="min-w-0">
              <CardBody className="space-y-2">
                <h3 className="font-display text-md font-semibold">{r.label}</h3>
                <ul className="space-y-1.5 text-sm text-secondary">
                  {r.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-fg" aria-hidden="true" />
                      {b}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Built-in safeguards">
        <ul className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
          <li className="flex gap-2">
            <Ban className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            No role can read private messages.
          </li>
          <li className="flex gap-2">
            <Lock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            Only the college admin can export member contacts, and each export records who, what and why.
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            Academic and placement data stays with placement staff. Alumni never see it.
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            {Vendor} runs the portal and cannot open member records.
          </li>
        </ul>
      </Section>

      <Disclosure summary="Full permission table (for auditors)">
        <div className="space-y-4">
          <p>
            Every permission, by role, read from the same table the portal checks on each request.{' '}
            {Vendor} is shown for completeness and cannot be granted here.
          </p>
          <TableWrap caption="Permissions by role">
            <Table>
              <THead>
                <TR>
                  <TH className="sticky left-0 bg-surface-sunken">Permission</TH>
                  {columns.map((r) => (
                    <TH key={r} align="center">
                      {ROLE_LABELS[r] ?? r}
                    </TH>
                  ))}
                  <TH align="center">{vendor}</TH>
                </TR>
              </THead>
              <TBody>
                {allGroups.flatMap((g) => [
                  <TR key={`${g.id}-head`}>
                    <TH
                      scope="rowgroup"
                      colSpan={columns.length + 2}
                      className="bg-surface text-left normal-case tracking-normal text-primary"
                    >
                      {g.label}
                    </TH>
                  </TR>,
                  ...g.caps.map((c) => (
                    <TR key={CAPABILITY_LABEL[c]}>
                      <TH scope="row" className="sticky left-0 bg-surface-raised text-left font-normal normal-case tracking-normal text-primary">
                        {CAPABILITY_LABEL[c]}
                      </TH>
                      {[...columns, 'platform_admin' as Role].map((r) => (
                        <TD key={r} align="center">
                          {roleHas(r, c) ? (
                            <>
                              <Check className="inline size-4 text-success-fg" aria-hidden="true" />
                              <span className="sr-only">yes</span>
                            </>
                          ) : (
                            <>
                              <span aria-hidden="true" className="text-muted">
                                ·
                              </span>
                              <span className="sr-only">no</span>
                            </>
                          )}
                        </TD>
                      ))}
                    </TR>
                  )),
                ])}
              </TBody>
            </Table>
          </TableWrap>
        </div>
      </Disclosure>
    </div>
  );
}
