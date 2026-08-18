import { redirect } from 'next/navigation';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Database,
  EyeOff,
  Globe,
  Landmark,
  Plus,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenants } from '@/lib/data/repo';
import { formatDate, formatNumber, formatPercent, formatRelative } from '@/lib/format';
import type { TenantSummary } from '@/lib/data/types';
import { MarginNote } from '@/components/brand/Marks';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  DefinitionCard,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Progress,
  Section,
  Stat,
  Table,
  TableWrap,
  Tabs,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';

/**
 * The vendor's tenant list.
 *
 * A platform admin runs the infrastructure for every college on the
 * platform and can read member data in none of them. That is not a UI
 * decision this page is free to soften: `platform_admin` holds exactly
 * three capabilities in `lib/auth/permissions.ts` — tenant.provision,
 * tenant.configure, audit.read — and Postgres row-level security on
 * `app.tenant_id` refuses the query a second time regardless.
 *
 * So every figure here is an aggregate. There is no drill-down to a
 * member, because there is no read function that would return one.
 */

export const metadata = { title: 'Colleges' };

/** Subdomain routing lives under one apex; see `lib/tenant.ts`. */
const PLATFORM_DOMAIN = 'alumni.ifbash.com';

type StatusFilter = 'all' | TenantSummary['status'];

const STATUS_TONE = {
  active: 'success',
  provisioning: 'info',
  suspended: 'danger',
} as const;

const STATUS_LABEL = {
  active: 'Active',
  provisioning: 'Provisioning',
  suspended: 'Suspended',
} as const;

const PLAN_TONE = {
  trial: 'warning',
  standard: 'info',
  institution: 'brand',
} as const;

const PLAN_LABEL = {
  trial: 'Trial',
  standard: 'Standard',
  institution: 'Institution',
} as const;

const one = (v: string | string[] | undefined): string =>
  (Array.isArray(v) ? v[0] : v)?.trim() ?? '';

function buildHref(next: { status?: StatusFilter; q?: string }): string {
  const params = new URLSearchParams();
  if (next.status && next.status !== 'all') params.set('status', next.status);
  if (next.q) params.set('q', next.q);
  const qs = params.toString();
  return qs ? `/platform?${qs}` : '/platform';
}

function coverage(t: TenantSummary): number | null {
  if (t.memberCount === 0) return null;
  return t.verifiedCount / t.memberCount;
}

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  // The sidebar already hides this section. Hiding a link is presentation;
  // this is the authorisation.
  requireCap(session, 'tenant.provision');

  const params = await searchParams;
  const q = one(params.q);
  const statusParam = one(params.status);
  const status: StatusFilter =
    statusParam === 'active' || statusParam === 'provisioning' || statusParam === 'suspended'
      ? statusParam
      : 'all';

  const all = getTenants();

  const searched = q
    ? all.filter((t) =>
        `${t.name} ${t.shortName} ${t.subdomain}`.toLowerCase().includes(q.toLowerCase()),
      )
    : all;
  const tenants = status === 'all' ? searched : searched.filter((t) => t.status === status);

  const live = all.filter((t) => t.status === 'active').length;
  const provisioning = all.filter((t) => t.status === 'provisioning').length;
  const membersUnderManagement = all.reduce((n, t) => n + t.memberCount, 0);
  const verifiedTotal = all.reduce((n, t) => n + t.verifiedCount, 0);
  const fcraCount = all.filter((t) => t.fcraRegistered).length;

  const tabs = [
    { label: 'All', href: buildHref({ q }), count: searched.length, active: status === 'all' },
    {
      label: 'Active',
      href: buildHref({ status: 'active', q }),
      count: searched.filter((t) => t.status === 'active').length,
      active: status === 'active',
    },
    {
      label: 'Provisioning',
      href: buildHref({ status: 'provisioning', q }),
      count: searched.filter((t) => t.status === 'provisioning').length,
      active: status === 'provisioning',
    },
    {
      label: 'Suspended',
      href: buildHref({ status: 'suspended', q }),
      count: searched.filter((t) => t.status === 'suspended').length,
      active: status === 'suspended',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ifBash platform"
        title="Colleges"
        description="Every tenant on the platform, with the operational metadata needed to run it. This console reports counts and configuration. It cannot read a member row inside any college — not a name, not an email address, not a roll number."
        actions={
          <ButtonLink href="/platform/new">
            <Plus className="size-4" aria-hidden="true" />
            Provision a college
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Colleges live"
          value={live}
          icon={<Building2 className="size-4" />}
          hint={
            provisioning
              ? `${provisioning} still provisioning`
              : 'every tenant has finished provisioning'
          }
        />
        <Stat
          label="Members under management"
          value={formatNumber(membersUnderManagement)}
          icon={<Users className="size-4" />}
          hint="aggregate count — no row behind it is readable here"
        />
        <Stat
          label="Verified against a register"
          value={
            membersUnderManagement ? formatPercent(verifiedTotal / membersUnderManagement) : '—'
          }
          icon={<BadgeCheck className="size-4" />}
          hint={`${formatNumber(verifiedTotal)} of ${formatNumber(membersUnderManagement)} across all tenants`}
        />
        <Stat
          label="FCRA registered"
          value={`${fcraCount} of ${all.length}`}
          icon={<Landmark className="size-4" />}
          hint="giving stays dark for the rest, by design"
        />
      </div>

      <Card>
        <CardBody className="space-y-4">
          <form
            method="get"
            className="grid gap-4 sm:grid-cols-[minmax(0,24rem)_auto] sm:items-end"
          >
            {status !== 'all' ? <input type="hidden" name="status" value={status} /> : null}
            <Field
              htmlFor="tenant-q"
              label="Find a college"
              hint="Matches the institution name, the short name and the subdomain"
            >
              <Input
                id="tenant-q"
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Dhanekula, DIET, srivarsity…"
                leading={<Search className="size-4" />}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-2 pb-0.5">
              <Button type="submit">Search</Button>
              {q ? (
                <ButtonLink variant="ghost" href={buildHref({ status })}>
                  Clear
                </ButtonLink>
              ) : null}
            </div>
          </form>

          <Tabs items={tabs} ariaLabel="Filter colleges by lifecycle state" />
        </CardBody>
      </Card>

      {tenants.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-5" />}
          title={
            q
              ? `No college matches “${q}”`
              : status === 'all'
                ? 'No colleges on the platform yet'
                : `Nothing is ${STATUS_LABEL[status].toLowerCase()}`
          }
          description={
            q
              ? `The platform has ${all.length} ${all.length === 1 ? 'tenant' : 'tenants'}. Search matches the institution name, the short name and the subdomain — try “diet” rather than the full registered name.`
              : status === 'all'
                ? 'Provisioning a college writes the tenant row, its RLS scope, a branding record and the first college_admin invite.'
                : `None of the ${all.length} tenants is in that state. Suspended tenants keep their data and stop serving requests; provisioning ones have a row but no members yet.`
          }
          action={
            <ButtonLink variant="secondary" href={status === 'all' ? '/platform/new' : '/platform'}>
              {status === 'all' ? 'Provision a college' : 'Show all colleges'}
            </ButtonLink>
          }
        />
      ) : (
        <>
          {/* Nine columns of operational metadata: scroll the region, never the page. */}
          <TableWrap className="hidden sm:block" caption="Colleges on the platform">
            <Table className="min-w-[68rem]">
              <THead>
                <TR>
                  <TH>College</TH>
                  <TH>Address</TH>
                  <TH>Plan</TH>
                  <TH>State</TH>
                  <TH align="right">Members</TH>
                  <TH>Register coverage</TH>
                  <TH>FCRA</TH>
                  <TH>Created</TH>
                  <TH>
                    <span className="sr-only">Open tenant</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {tenants.map((t) => {
                  const cov = coverage(t);
                  return (
                    <TR key={t.id} interactive>
                      <TD className="align-top">
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-muted">
                          {t.shortName}
                          {t.established ? ` · established ${t.established}` : ''}
                        </p>
                      </TD>

                      <TD className="align-top">
                        <p className="font-mono text-xs">
                          {t.subdomain}.{PLATFORM_DOMAIN}
                        </p>
                        <p className="text-xs text-muted">
                          pack{' '}
                          <span className="font-mono">{t.packId ?? 'default'}</span>
                        </p>
                      </TD>

                      <TD className="align-top">
                        <Badge tone={PLAN_TONE[t.plan]}>{PLAN_LABEL[t.plan]}</Badge>
                      </TD>

                      <TD className="align-top">
                        <Badge tone={STATUS_TONE[t.status]} dot>
                          {STATUS_LABEL[t.status]}
                        </Badge>
                      </TD>

                      <TD className="align-top" numeric>
                        {t.memberCount === 0 ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <>
                            <p className="font-semibold">{formatNumber(t.memberCount)}</p>
                            <p className="text-xs text-muted">
                              {formatNumber(t.alumniCount)} alumni ·{' '}
                              {formatNumber(t.studentCount)} students
                            </p>
                          </>
                        )}
                      </TD>

                      <TD className="min-w-44 align-top">
                        {cov === null ? (
                          <span className="text-xs text-muted">
                            No register loaded yet
                          </span>
                        ) : (
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold tabular">
                              {formatPercent(cov)}{' '}
                              <span className="font-normal text-muted">
                                ({formatNumber(t.verifiedCount)} verified)
                              </span>
                            </p>
                            <Progress
                              value={t.verifiedCount}
                              max={t.memberCount}
                              tone={cov >= 0.9 ? 'success' : cov >= 0.6 ? 'brand' : 'warning'}
                              label={`Register coverage for ${t.name}`}
                            />
                          </div>
                        )}
                      </TD>

                      <TD className="align-top">
                        {t.fcraRegistered ? (
                          <Badge tone="success">Registered</Badge>
                        ) : (
                          <Badge tone="neutral">Not confirmed</Badge>
                        )}
                      </TD>

                      <TD className="whitespace-nowrap align-top">
                        <p className="tabular">{formatDate(t.createdAt)}</p>
                        <p className="text-xs text-muted">{formatRelative(t.createdAt)}</p>
                      </TD>

                      <TD className="align-top">
                        <ButtonLink
                          variant="ghost"
                          size="sm"
                          href={`/platform/${t.id}`}
                          aria-label={`Open the ${t.name} tenant`}
                        >
                          Open
                          <ArrowRight className="size-3.5" aria-hidden="true" />
                        </ButtonLink>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>

          {/* Below sm the table is unreadable however it scrolls. */}
          <ul className="space-y-3 sm:hidden">
            {tenants.map((t) => {
              const cov = coverage(t);
              return (
                <li key={t.id}>
                  <DefinitionCard
                    title={t.name}
                    subtitle={
                      <span className="font-mono">
                        {t.subdomain}.{PLATFORM_DOMAIN}
                      </span>
                    }
                    rows={[
                      {
                        label: 'State',
                        value: (
                          <Badge tone={STATUS_TONE[t.status]} dot>
                            {STATUS_LABEL[t.status]}
                          </Badge>
                        ),
                      },
                      {
                        label: 'Plan',
                        value: <Badge tone={PLAN_TONE[t.plan]}>{PLAN_LABEL[t.plan]}</Badge>,
                      },
                      {
                        label: 'Members',
                        value:
                          t.memberCount === 0
                            ? 'None yet'
                            : `${formatNumber(t.memberCount)} (${formatNumber(t.alumniCount)} alumni)`,
                      },
                      {
                        label: 'Register coverage',
                        value: cov === null ? 'No register loaded' : formatPercent(cov),
                      },
                      { label: 'FCRA', value: t.fcraRegistered ? 'Registered' : 'Not confirmed' },
                      { label: 'Created', value: formatDate(t.createdAt) },
                    ]}
                    actions={
                      <ButtonLink variant="secondary" size="sm" href={`/platform/${t.id}`}>
                        Open tenant
                        <ArrowRight className="size-3.5" aria-hidden="true" />
                      </ButtonLink>
                    }
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Section
        title="What this console can see"
        description="The interesting part of a multi-tenant product is not what the vendor can do. It is what the vendor cannot."
      >
        <Card>
          <CardHeader>
            <div className="min-w-0 space-y-1">
              <CardTitle as="h3">Operational metadata, and nothing below it</CardTitle>
              <CardDescription>
                Enforced in two independent places, because one layer of tenant isolation is not a
                layer of tenant isolation.
              </CardDescription>
            </div>
            <Badge tone="outline">
              <EyeOff className="size-3.5" aria-hidden="true" />
              No member rows
            </Badge>
          </CardHeader>
          <CardBody className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="size-4 text-brand-fg" aria-hidden="true" />
                  Held by platform_admin
                </p>
                <ul className="space-y-1.5 text-sm text-secondary">
                  <li>
                    <code className="font-mono text-xs text-primary">tenant.provision</code> — create
                    a college
                  </li>
                  <li>
                    <code className="font-mono text-xs text-primary">tenant.configure</code> —
                    branding, feature flags, plan
                  </li>
                  <li>
                    <code className="font-mono text-xs text-primary">audit.read</code> — the
                    append-only activity log
                  </li>
                </ul>
                <p className="text-xs text-muted">Three capabilities. That is the whole grant.</p>
              </div>

              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <EyeOff className="size-4 text-brand-fg" aria-hidden="true" />
                  Not held, deliberately
                </p>
                <ul className="space-y-1.5 font-mono text-xs text-secondary">
                  <li>profile.read.any</li>
                  <li>directory.search.alumni</li>
                  <li>directory.view.contact</li>
                  <li>directory.view.cgpa</li>
                  <li>member.export</li>
                  <li>comms.send.all</li>
                </ul>
                <p className="text-xs text-muted">
                  Running the infrastructure is not a reason to read an alumnus&rsquo;s phone number.
                </p>
              </div>

              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Database className="size-4 text-brand-fg" aria-hidden="true" />
                  Enforced twice
                </p>
                <p className="text-sm text-secondary">
                  The capability matrix refuses the call. Row-level security refuses the query:
                  every policy in <code className="font-mono text-xs">migrations/0001_init.sql</code>{' '}
                  keys off <code className="font-mono text-xs">app.tenant_id</code>, so a forgotten{' '}
                  <code className="font-mono text-xs">WHERE</code> clause returns nothing rather than
                  another college&rsquo;s rows.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-sm text-secondary">
                <Globe className="size-4 shrink-0 text-muted" aria-hidden="true" />
                Postgres and object storage stay in <span className="font-mono">ap-south-1</span>.
                No tenant data crosses a border, so DPDP transfer rules never come into scope.
              </p>
              <MarginNote className="sm:max-w-xs sm:text-right">
                We can tell you a college has 8,412 members. We cannot tell you one of their names.
              </MarginNote>
            </div>
          </CardBody>
        </Card>
      </Section>
    </div>
  );
}
