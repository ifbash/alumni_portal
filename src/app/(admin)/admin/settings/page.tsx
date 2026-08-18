import { redirect } from 'next/navigation';
import {
  Ban,
  Building2,
  CalendarDays,
  Database,
  Globe,
  HardDrive,
  IndianRupee,
  KeyRound,
  Palette,
  RefreshCw,
  Server,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDegreeRegisterStats, getDepartments, getTenants } from '@/lib/data/repo';
import { NOTICE_VERSION, OTP_MAX_ATTEMPTS, OTP_TTL_SECONDS } from '@/lib/config';
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  DetailRow,
  Field,
  Input,
  PageHeader,
  Section,
  Switch,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { formatDate, formatNumber } from '@/lib/format';
import type { Feature } from '@/lib/branding/pack';

export const metadata = { title: 'Settings' };

const FEATURE_LABELS: Record<Feature, { label: string; note: string }> = {
  directory: { label: 'Alumni directory', note: 'Never anonymous. Every view requires a signed-in, verified member.' },
  connections: { label: 'Connections and mentorship', note: 'Students are capped at five open requests; alumni at twenty-five.' },
  events: { label: 'Events and registrations', note: 'Alumni-only events are not addressable by students anywhere.' },
  jobs: { label: 'Jobs board', note: 'Alumni post, the placement cell moderates before anything goes live.' },
  mentorship: { label: 'Mentorship matching', note: 'Availability flags on the profile drive the directory filters.' },
  donations: { label: 'Giving and campaigns', note: 'Blocked until FCRA registration status is confirmed. See below.' },
  gallery: { label: 'Photo gallery', note: 'Event photographs, uploaded by the alumni cell.' },
  news: { label: 'News and notices', note: 'Institutional announcements on the member dashboard.' },
  whatsapp: { label: 'WhatsApp Business messaging', note: 'Awaiting the WABA number and template approval from Meta.' },
  publicLanding: { label: 'Public landing page', note: 'Marketing surface only. It exposes no member data and is not indexed.' },
};

/**
 * Tenant settings.
 *
 * Read-only for anything the brand pack owns — a college that wants a
 * different portal name changes it in the branding console, and one
 * source of truth for copy is the reason a new customer is a JSON file
 * rather than a branch.
 *
 * The two things that genuinely live here are the ones with legal weight:
 * whether foreign contributions may be collected at all, and where the
 * data physically sits.
 */
export default async function AdminSettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  requireCap(session, 'tenant.configure');

  const resolved = await getTenantBrand();
  if (!resolved) redirect('/login');
  const { tenant, brand } = resolved;
  const pack = brand.pack;

  const summary = getTenants().find((t) => t.id === tenant.id) ?? null;
  const departments = getDepartments();
  const register = getDegreeRegisterStats();

  const totalIntake = departments.reduce((n, d) => n + (d.intake ?? 0), 0);

  // Indian academic sessions start in June/July. Derived rather than
  // stored, so nobody has to remember to roll a config value over.
  const now = new Date();
  const sessionStart = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  const academicYear = `${sessionStart}–${String(sessionStart + 1).slice(2)}`;

  const canRollover = can(session, 'rollover.execute');
  const donationsOn = pack.features.donations;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Governance"
        title="Institution settings"
        description={`Configuration for ${pack.copy.institutionName}. Branding, copy and assets live in the branding console; what remains here is what carries legal or operational weight.`}
        actions={
          <ButtonLink href="/admin/branding" variant="secondary">
            <Palette className="size-4" />
            Branding console
          </ButtonLink>
        }
      />

      {/* ---------------------------------------------------------------
          Institution
         --------------------------------------------------------------- */}
      <Section
        title="Institution"
        description="Read from the tenant's brand pack. Editing any of this is a branding change, not a settings change."
      >
        <div className="grid gap-gutter lg:grid-cols-2">
          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h3" className="flex items-center gap-2">
                <Building2 className="size-4 text-muted" aria-hidden="true" />
                Identity
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-4">
              <dl className="divide-y divide-line">
                <DetailRow label="Institution">{pack.copy.institutionName}</DetailRow>
                <DetailRow label="Short name">{pack.copy.shortName}</DetailRow>
                <DetailRow label="Portal name">{pack.copy.portalName}</DetailRow>
                <DetailRow label="Tagline">
                  {pack.copy.tagline ?? <span className="font-normal text-muted">Not set</span>}
                </DetailRow>
                <DetailRow label="Established">
                  {summary?.established ?? <span className="font-normal text-muted">Not supplied</span>}
                </DetailRow>
                <DetailRow label="Address">
                  {pack.copy.addressLines.length ? (
                    <span className="block space-y-0.5 text-sm font-normal">
                      {pack.copy.addressLines.map((l) => (
                        <span key={l} className="block">
                          {l}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="font-normal text-muted">Not supplied</span>
                  )}
                </DetailRow>
                <DetailRow label="Support email">
                  {pack.copy.supportEmail ? (
                    <a href={`mailto:${pack.copy.supportEmail}`} className="link font-mono text-xs">
                      {pack.copy.supportEmail}
                    </a>
                  ) : (
                    <span className="font-normal text-muted">Not supplied</span>
                  )}
                </DetailRow>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h3" className="flex items-center gap-2">
                <Server className="size-4 text-muted" aria-hidden="true" />
                Tenancy
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-4">
              <dl className="divide-y divide-line">
                <DetailRow label="Tenant ID">
                  <span className="font-mono text-xs">{tenant.id}</span>
                </DetailRow>
                <DetailRow label="Portal address">
                  <span className="font-mono text-xs">{tenant.subdomain}.portal.ifbash.com</span>
                </DetailRow>
                <DetailRow label="Brand pack">
                  <span className="font-mono text-xs">brands/{tenant.packId ?? 'default'}.json</span>
                </DetailRow>
                <DetailRow label="Plan">
                  <Badge tone="brand">{summary?.plan ?? 'standard'}</Badge>
                </DetailRow>
                <DetailRow label="Status">
                  <Badge tone={summary?.status === 'active' ? 'success' : 'warning'}>
                    {summary?.status ?? 'active'}
                  </Badge>
                </DetailRow>
                <DetailRow label="Live since">
                  {summary ? formatDate(summary.createdAt) : '—'}
                </DetailRow>
                <DetailRow label="Records held">
                  <span className="tabular">
                    {formatNumber(summary?.memberCount ?? 0)} members ·{' '}
                    {formatNumber(register.total)} register rows
                  </span>
                </DetailRow>
              </dl>

              <Alert tone="neutral" className="mt-4" icon={<ShieldCheck className="size-4" />}>
                <p>
                  Every table in this tenant carries a tenant ID and a row-level security policy keyed
                  on <span className="font-mono">app.tenant_id</span>. Isolation is enforced in
                  Postgres, not in application code — one forgotten WHERE clause must not be able to
                  leak across colleges.
                </p>
              </Alert>
            </CardBody>
          </Card>
        </div>
      </Section>

      {/* ---------------------------------------------------------------
          Departments
         --------------------------------------------------------------- */}
      <Section
        title="Departments"
        description="Branches offered, with sanctioned intake. Department codes are what every scoped role grant is checked against."
      >
        <TableWrap caption="Departments and sanctioned intake">
          <Table>
            <THead>
              <TR>
                <TH>Code</TH>
                <TH>Department</TH>
                <TH align="right">Established</TH>
                <TH align="right">Sanctioned intake</TH>
              </TR>
            </THead>
            <TBody>
              {departments.map((d) => (
                <TR key={d.id} interactive>
                  <TD className="font-mono text-xs font-semibold">{d.code}</TD>
                  <TD>{d.name}</TD>
                  <TD numeric>{d.established ?? '—'}</TD>
                  <TD numeric>{d.intake ? formatNumber(d.intake) : '—'}</TD>
                </TR>
              ))}
              <TR className="bg-surface-sunken">
                <TD className="font-semibold" />
                <TD className="font-semibold">Total across {departments.length} branches</TD>
                <TD />
                <TD numeric className="font-semibold">
                  {formatNumber(totalIntake)}
                </TD>
              </TR>
            </TBody>
          </Table>
        </TableWrap>

        <Alert tone="warning" icon={<TriangleAlert className="size-4" />}>
          <p>
            Current enrolment and staff headcount are not on record. Both are outstanding with the
            college and they decide how much self-service verification is worth building: a register
            of eight thousand graduates needs a different answer from one of eight hundred.
          </p>
        </Alert>
      </Section>

      {/* ---------------------------------------------------------------
          Academic year
         --------------------------------------------------------------- */}
      <Section title="Academic year and rollover">
        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle as="h3" className="flex items-center gap-2">
              <CalendarDays className="size-4 text-muted" aria-hidden="true" />
              Session {academicYear}
            </CardTitle>
            <CardDescription>
              Derived from the calendar rather than stored, so nobody has to remember to roll a value
              over in June.
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-4 pt-4">
            <dl className="divide-y divide-line">
              <DetailRow label="Current session">{academicYear}</DetailRow>
              <DetailRow label="Graduating cohort">
                Batch of {sessionStart + 1} — becomes alumni at the next rollover
              </DetailRow>
              <DetailRow label="Rollover trigger">
                Manual, by an admin holding{' '}
                <span className="font-mono text-xs">rollover.execute</span>
              </DetailRow>
              <DetailRow label="Register coverage">
                <span className="tabular">
                  {formatNumber(register.claimed)} of {formatNumber(register.total)} rows claimed
                </span>
              </DetailRow>
            </dl>

            <Alert tone="info" icon={<RefreshCw className="size-4" />}>
              <p>
                <span className="font-mono">rollover_batch()</span> flips the final-year cohort from{' '}
                <span className="font-mono">active_student</span> to{' '}
                <span className="font-mono">active_alumni</span>. It is never automatic and always
                runs a dry run first: promoting a batch early takes away the jobs board from students
                who still need it, and putting it back is a row-by-row correction.
              </p>
            </Alert>

            {canRollover ? (
              <ButtonLink href="/admin/rollover" variant="secondary">
                Open the rollover preview
              </ButtonLink>
            ) : null}
          </CardBody>
        </Card>
      </Section>

      {/* ---------------------------------------------------------------
          FCRA
         --------------------------------------------------------------- */}
      <Section
        title="Foreign contributions"
        description="The one setting on this page with a statute behind it."
      >
        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle as="h3" className="flex items-center gap-2">
              <IndianRupee className="size-4 text-muted" aria-hidden="true" />
              FCRA registration
            </CardTitle>
            <CardDescription>
              Around one alumnus in eight on this portal is outside India. Their money is a foreign
              contribution the moment it is collected, whichever campaign it lands in.
            </CardDescription>
          </CardHeader>

          <CardBody className="space-y-5 pt-4">
            <Alert
              tone="danger"
              title="Turning this on enables the giving module for every member"
              icon={<TriangleAlert className="size-4" />}
            >
              <p>
                Campaigns, the payment flow and 80G receipting all become visible to alumni, and the
                portal starts accepting money. Donations carry{' '}
                <span className="font-mono">source_country</span> and{' '}
                <span className="font-mono">is_foreign_contribution</span> from the first rupee, so
                segregation is structural rather than a report someone runs at audit time — but
                collecting a foreign contribution without a valid FCRA registration is an offence by
                the trust, not a configuration mistake by the portal.
              </p>
            </Alert>

            <div className="rounded-lg border border-line bg-surface-sunken p-4">
              <Switch
                id="fcra-registered"
                defaultChecked={tenant.fcraRegistered}
                disabled
                label="The college trust holds a valid FCRA registration"
                hint="Locked until the registration certificate is on file. Ask the trust office for the certificate number and validity date."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                htmlFor="fcra-number"
                label="FCRA registration number"
                hint="Nine digits, as printed on the certificate."
              >
                <Input id="fcra-number" disabled placeholder="Awaiting the certificate" />
              </Field>
              <Field
                htmlFor="fcra-account"
                label="Designated FCRA bank account"
                hint="SBI New Delhi Main Branch, as required since 2020."
              >
                <Input id="fcra-account" disabled placeholder="Awaiting the account details" />
              </Field>
            </div>

            <dl className="divide-y divide-line">
              <DetailRow label="Current state">
                <Badge tone={tenant.fcraRegistered ? 'success' : 'warning'} dot>
                  {tenant.fcraRegistered ? 'Registered' : 'Not confirmed'}
                </Badge>
              </DetailRow>
              <DetailRow label="Giving module">
                <Badge tone={donationsOn ? 'success' : 'neutral'}>
                  {donationsOn ? 'Visible to alumni' : 'Hidden from every member'}
                </Badge>
              </DetailRow>
              <DetailRow label="Students">
                <span className="font-normal text-secondary">
                  Never see the giving module, registered or not. Asking a final-year for money on the
                  portal meant to help them find work poisons the product.
                </span>
              </DetailRow>
            </dl>
          </CardBody>
        </Card>
      </Section>

      {/* ---------------------------------------------------------------
          Modules
         --------------------------------------------------------------- */}
      <Section
        title="Modules"
        description="Feature flags on the brand pack. A flag that is off is off in the navigation and in the route guard, not merely hidden with CSS."
      >
        <TableWrap caption="Modules enabled for this tenant">
          <Table>
            <THead>
              <TR>
                <TH>Module</TH>
                <TH>State</TH>
                <TH>Note</TH>
              </TR>
            </THead>
            <TBody>
              {(Object.keys(FEATURE_LABELS) as Feature[]).map((key) => (
                <TR key={key} interactive>
                  <TD className="font-medium">{FEATURE_LABELS[key].label}</TD>
                  <TD>
                    <Badge tone={pack.features[key] ? 'success' : 'neutral'} dot>
                      {pack.features[key] ? 'On' : 'Off'}
                    </Badge>
                  </TD>
                  <TD className="text-secondary">{FEATURE_LABELS[key].note}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      </Section>

      {/* ---------------------------------------------------------------
          Residency
         --------------------------------------------------------------- */}
      <Section
        title="Data residency and retention"
        description="Stated plainly because a college will be asked this by its own audit committee, and the answer has to be the same every time."
      >
        <div className="grid gap-gutter lg:grid-cols-2">
          <Card>
            <CardBody className="space-y-4">
              <ul className="space-y-4">
                <ResidencyRow
                  icon={<Database className="size-4" />}
                  title="PostgreSQL — ap-south-1 (Mumbai)"
                  body="Primary and replicas. Row-level security on every table, keyed on the tenant. Automated backups stay in the same region."
                />
                <ResidencyRow
                  icon={<HardDrive className="size-4" />}
                  title="Object storage — ap-south-1 (Mumbai)"
                  body="Profile photographs, event images, degree-register uploads and generated exports. No cross-region replication is configured."
                />
                <ResidencyRow
                  icon={<Globe className="size-4" />}
                  title="No cross-border transfer"
                  body="Nothing about a member leaves India in the ordinary course of running the portal, which keeps DPDP cross-border transfer rules out of scope entirely."
                />
                <ResidencyRow
                  icon={<Ban className="size-4" />}
                  title="No third-party analytics"
                  body="No advertising pixel, no session recorder, no behavioural profile. Nothing that would put a member's browsing on somebody else's server."
                />
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h3" className="flex items-center gap-2">
                <KeyRound className="size-4 text-muted" aria-hidden="true" />
                Credentials and consent
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-4">
              <dl className="divide-y divide-line">
                <DetailRow label="Primary credential">
                  Email one-time code. No password is stored anywhere.
                </DetailRow>
                <DetailRow label="Code validity">
                  <span className="tabular">{Math.round(OTP_TTL_SECONDS / 60)} minutes</span>, single
                  use, {OTP_MAX_ATTEMPTS} attempts
                </DetailRow>
                <DetailRow label="Mobile number">
                  Verified at profile completion. Used for recovery and WhatsApp — never as the login.
                </DetailRow>
                <DetailRow label="Session cookie">
                  <span className="font-mono text-xs">HttpOnly</span> ·{' '}
                  <span className="font-mono text-xs">SameSite=Lax</span> · roles resolved from
                  storage on every request
                </DetailRow>
                <DetailRow label="Privacy notice">
                  <span className="font-mono text-xs">{NOTICE_VERSION}</span>
                </DetailRow>
                <DetailRow label="Consent record">
                  Append-only, with the notice version against every entry. A withdrawn consent is a
                  new row, never an edit.
                </DetailRow>
                <DetailRow label="Data requests">
                  <span className="font-normal text-secondary">
                    Export, correction and deletion requests run on a thirty-day statutory clock,
                    shown as a countdown so nothing quietly ages past it.
                  </span>
                </DetailRow>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonLink href="/admin/data-requests" variant="secondary" size="sm">
                  Data requests
                </ButtonLink>
                {can(session, 'audit.read') ? (
                  <ButtonLink href="/admin/audit" variant="secondary" size="sm">
                    Audit log
                  </ButtonLink>
                ) : null}
              </div>
            </CardBody>
          </Card>
        </div>
      </Section>
    </div>
  );
}

function ResidencyRow({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-3">
      <span
        className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-soft-fg"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-sm text-secondary">{body}</p>
      </div>
    </li>
  );
}
