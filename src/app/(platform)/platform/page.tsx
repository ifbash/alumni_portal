import type { CSSProperties } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, BadgeCheck, Building2, Hourglass, Landmark, Lock, Plus, Search, Users } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenants } from '@/lib/data/repo';
import { getPack, housePack } from '@/lib/branding/registry';
import type { BrandPack } from '@/lib/branding/pack';
import { formatNumber, formatPercent } from '@/lib/format';
import { joinList } from '@/lib/branding/copy';
import type { TenantSummary } from '@/lib/data/types';
import { cn } from '@/lib/cn';
import {
  Badge,
  ButtonLink,
  EmptyState,
  Input,
  PageHeader,
  Progress,
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

import { CollegeMark } from './_shared/CollegeMark';
import { setupSteps } from './_shared/MediaReadiness';
import { portalAddress, type PortalAddress } from './_shared/portal-address';
import { VendorTrustChip } from './_shared/VendorTrustChip';

/**
 * Every college on the platform.
 *
 * A platform admin runs the infrastructure for every college and can read
 * member data in none of them: `platform_admin` holds exactly three
 * capabilities, and row-level security refuses the query a second time.
 * So every figure here is an aggregate from `getTenants()`, and no count
 * links to the people behind it.
 */

export const metadata = { title: 'Colleges' };

type StatusFilter = 'all' | TenantSummary['status'];

const STATUS = {
  active: { label: 'Live', tone: 'success' },
  provisioning: { label: 'Onboarding', tone: 'brand' },
  suspended: { label: 'Suspended', tone: 'danger' },
} as const;

const PLAN_LABEL = { trial: 'Trial', standard: 'Standard', institution: 'Institution' } as const;

const one = (v: string | string[] | undefined): string =>
  (Array.isArray(v) ? v[0] : v)?.trim() ?? '';

function buildHref(next: { status?: StatusFilter; q?: string }): string {
  const params = new URLSearchParams();
  if (next.status && next.status !== 'all') params.set('status', next.status);
  if (next.q) params.set('q', next.q);
  const qs = params.toString();
  return qs ? `/platform?${qs}` : '/platform';
}

/** Coverage scale: below 20% chase, 20–35% watch, 35% and above fine. */
function coverageTone(fraction: number): 'danger' | 'warning' | 'success' {
  return fraction < 0.2 ? 'danger' : fraction < 0.35 ? 'warning' : 'success';
}

/** The row's strip: the primary seed, with the accent below it when the pack has one. */
function strip(pack: BrandPack | null): CSSProperties | undefined {
  if (!pack) return undefined;
  const { primary, accent } = pack.color;
  return {
    background: accent ? `linear-gradient(to bottom, ${primary} 0 68%, ${accent} 68% 100%)` : primary,
  };
}

interface Row {
  tenant: TenantSummary;
  pack: BrandPack | null;
  address: PortalAddress;
  setup: { done: number; total: number };
  joined: string;
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

  const { locale } = housePack();
  const month = new Intl.DateTimeFormat(locale.locale, { month: 'short', year: 'numeric', timeZone: locale.timeZone });

  const rows: Row[] = await Promise.all(
    all.map(async (tenant) => {
      const pack = getPack(tenant.packId);
      const steps = setupSteps(tenant, pack);
      return {
        tenant,
        pack,
        address: await portalAddress(tenant.subdomain),
        setup: { done: steps.filter((s) => s.done).length, total: steps.length },
        joined: month.format(new Date(tenant.createdAt)),
      };
    }),
  );

  // Search reads what the row shows: the name, the short name and the address.
  const needle = q.toLowerCase();
  const searched = q
    ? rows.filter((r) =>
        `${r.tenant.name} ${r.tenant.shortName} ${r.address.host}`.toLowerCase().includes(needle),
      )
    : rows;
  const shown = status === 'all' ? searched : searched.filter((r) => r.tenant.status === status);

  const live = all.filter((t) => t.status === 'active');
  const onboarding = all.filter((t) => t.status === 'provisioning');
  const members = all.reduce((n, t) => n + t.memberCount, 0);
  const alumni = all.reduce((n, t) => n + t.alumniCount, 0);
  const students = all.reduce((n, t) => n + t.studentCount, 0);
  const verified = all.reduce((n, t) => n + t.verifiedCount, 0);

  const countFor = (s: TenantSummary['status']) => searched.filter((r) => r.tenant.status === s).length;
  const tabs = [
    { label: 'All', href: buildHref({ q }), count: searched.length, active: status === 'all' },
    ...(['active', 'provisioning', 'suspended'] as const)
      .map((s) => ({ label: STATUS[s].label, href: buildHref({ status: s, q }), count: countFor(s), active: status === s }))
      // An empty filter is not offered, unless it is the one in the address bar.
      .filter((t) => t.count > 0 || t.active),
  ];

  const header = (
    <PageHeader
      title="Colleges"
      description="Every college on the platform. Open one to see its setup, its look and what is still outstanding."
      meta={<VendorTrustChip />}
      actions={
        <ButtonLink href="/platform/new">
          <Plus className="size-4" aria-hidden="true" />
          Set up a college
        </ButtonLink>
      }
    />
  );

  if (all.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon={<Building2 className="size-5" />}
          title="Your first college starts here"
          description="Give it a name, an address and a look. Its first admin adds everyone else."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/platform/new">Set up a college</ButtonLink>
              <ButtonLink href="/platform/brands" variant="secondary">
                See brand packs
              </ButtonLink>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {/* In the order they are acted on. No figure here leads to a person. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {live.length ? (
          <Stat
            label="Live"
            value={live.length}
            icon={<Building2 className="size-4" />}
            href={buildHref({ status: 'active' })}
            hint={live.length === 1 ? 'college serving members' : 'colleges serving members'}
          />
        ) : null}
        {onboarding.length ? (
          <Stat
            label="Onboarding"
            value={onboarding.length}
            icon={<Hourglass className="size-4" />}
            href={buildHref({ status: 'provisioning' })}
            hint={joinList(onboarding.slice(0, 2).map((t) => t.shortName))}
          />
        ) : null}
        {members ? (
          <Stat
            label="Members across colleges"
            value={formatNumber(members)}
            icon={<Users className="size-4" />}
            hint={`${formatNumber(alumni)} alumni · ${formatNumber(students)} final-year`}
          />
        ) : null}
        {members ? (
          <Stat
            label="Verified"
            value={formatPercent(verified / members)}
            icon={<BadgeCheck className="size-4" />}
            hint={`${formatNumber(verified)} matched to a degree register`}
          />
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-3 border-b border-line sm:flex-row sm:items-end sm:justify-between">
        <Tabs items={tabs} ariaLabel="Filter colleges by status" className="min-w-0 border-b-0" />
        <form method="get" role="search" className="sm:w-72 sm:pb-2">
          {status !== 'all' ? <input type="hidden" name="status" value={status} /> : null}
          <label htmlFor="college-q" className="sr-only">
            Find a college by name or address
          </label>
          <Input
            id="college-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="College name or address"
            leading={<Search className="size-4" />}
            enterKeyHint="search"
          />
        </form>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          variant="inline"
          title={q ? `No college matches “${q}”.` : `No college is ${STATUS[status as TenantSummary['status']].label.toLowerCase()} right now.`}
          action={
            <Link href="/platform" className="link inline-flex min-h-11 items-center text-sm font-medium">
              Show all colleges
            </Link>
          }
        />
      ) : (
        <>
          <TableWrap className="hidden lg:block" caption="Colleges on the platform">
            <Table>
              <THead>
                <TR>
                  <TH className="pl-5">College</TH>
                  <TH>Status</TH>
                  <TH align="right">Members</TH>
                  <TH className="w-44">Verified</TH>
                  <TH>Giving</TH>
                  <TH>Joined</TH>
                </TR>
              </THead>
              <TBody>
                {shown.map((r) => (
                  <RosterRow key={r.tenant.id} row={r} />
                ))}
              </TBody>
            </Table>
          </TableWrap>

          {/* Phones: the college first, then what state it is in. */}
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
            {shown.map((r) => (
              <li key={r.tenant.id} className="min-w-0">
                <RosterCard row={r} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Rows
// ---------------------------------------------------------------

/** The whole row opens the college: the name's link is stretched over it. */
const STRETCH = 'after:absolute after:inset-0 after:content-[""]';
/** Links that must stay clickable above the stretched one. */
const ABOVE = 'relative z-10';

function StatusCell({ row }: { row: Row }) {
  const { tenant, setup } = row;
  const s = STATUS[tenant.status];
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge tone={s.tone} dot>
        {s.label}
      </Badge>
      <span className="text-xs text-secondary">{PLAN_LABEL[tenant.plan]} plan</span>
      {tenant.status === 'provisioning' ? (
        <Link
          href={`/platform/${tenant.id}#setup`}
          className={cn(
            ABOVE,
            'inline-flex min-h-8 items-center gap-1 whitespace-nowrap rounded-full border border-line bg-surface px-2.5 text-xs font-medium text-primary hover:border-line-strong',
          )}
        >
          Setup {setup.done} of {setup.total}
          <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

function VerifiedCell({ tenant }: { tenant: TenantSummary }) {
  if (tenant.memberCount === 0) return <span className="text-xs text-secondary">No members yet</span>;
  const f = tenant.verifiedCount / tenant.memberCount;
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold tabular text-primary">{formatPercent(f)}</p>
      <Progress
        value={tenant.verifiedCount}
        max={tenant.memberCount}
        tone={coverageTone(f)}
        label={`${formatPercent(f)} of ${tenant.shortName} members verified`}
      />
    </div>
  );
}

function GivingBadge({ tenant }: { tenant: TenantSummary }) {
  return tenant.fcraRegistered ? (
    <Badge tone="success" className="whitespace-nowrap">
      <Landmark className="size-3" aria-hidden="true" />
      FCRA registered
    </Badge>
  ) : (
    <Badge tone="neutral" className="whitespace-nowrap">
      <Lock className="size-3" aria-hidden="true" />
      FCRA not confirmed
    </Badge>
  );
}

function AddressLink({ address }: { address: PortalAddress }) {
  return (
    <a
      href={address.href}
      target="_blank"
      rel="noreferrer"
      className={cn(ABOVE, 'font-mono text-xs text-secondary underline-offset-4 hover:text-brand-fg hover:underline')}
    >
      {address.host}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function RosterRow({ row }: { row: Row }) {
  const { tenant, pack, address } = row;
  return (
    <TR interactive className="relative">
      {/* Positioned by the row, like the stretched link, so both span its full height. */}
      <TD className="py-3.5 pl-5 align-top">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={strip(pack)} />
        <div className="flex items-start gap-3">
          <CollegeMark pack={pack} name={tenant.shortName} size={40} />
          <div className="min-w-0">
            <Link
              href={`/platform/${tenant.id}`}
              className={cn(STRETCH, 'whitespace-nowrap font-medium text-primary hover:text-brand-fg')}
            >
              {tenant.name}
            </Link>
            <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-secondary">
              <span className="font-semibold">{tenant.shortName}</span>
              <AddressLink address={address} />
            </p>
          </div>
        </div>
      </TD>
      <TD className="py-3.5 align-top">
        <StatusCell row={row} />
      </TD>
      <TD numeric className="py-3.5 align-top">
        {tenant.memberCount ? (
          <>
            <p className="font-semibold text-primary">{formatNumber(tenant.memberCount)}</p>
            <p className="whitespace-nowrap text-xs text-secondary">
              {formatNumber(tenant.alumniCount)} alumni · {formatNumber(tenant.studentCount)} final-year
            </p>
          </>
        ) : (
          <span className="text-xs text-secondary">None yet</span>
        )}
      </TD>
      <TD className="py-3.5 align-top">
        <VerifiedCell tenant={tenant} />
      </TD>
      <TD className="py-3.5 align-top">
        <GivingBadge tenant={tenant} />
      </TD>
      <TD className="whitespace-nowrap py-3.5 align-top tabular text-secondary">{row.joined}</TD>
    </TR>
  );
}

function RosterCard({ row }: { row: Row }) {
  const { tenant, pack, address } = row;
  return (
    <div className="relative overflow-hidden rounded-lg border border-line bg-surface-raised p-4 pl-5 transition-colors duration-fast ease-brand hover:border-line-strong">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={strip(pack)} />
      <div className="flex items-start gap-3">
        <CollegeMark pack={pack} name={tenant.shortName} size={40} />
        <div className="min-w-0 flex-1 space-y-1">
          <Link href={`/platform/${tenant.id}`} className={cn(STRETCH, 'block font-medium leading-snug text-primary')}>
            {tenant.name}
          </Link>
          <p className="text-xs text-secondary">
            <span className="font-semibold">{tenant.shortName}</span>
          </p>
        </div>
      </div>

      <div className="mt-3">
        <StatusCell row={row} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm">
        <div className="min-w-0">
          <dt className="text-xs text-secondary">Members</dt>
          <dd className="font-semibold tabular text-primary">
            {tenant.memberCount ? formatNumber(tenant.memberCount) : <span className="font-normal text-secondary">None yet</span>}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-secondary">Verified</dt>
          <dd>
            <VerifiedCell tenant={tenant} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-secondary">Giving</dt>
          <dd className="pt-0.5">
            <GivingBadge tenant={tenant} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-secondary">Joined</dt>
          <dd className="tabular text-primary">{row.joined}</dd>
        </div>
      </dl>

      <p className="mt-3 flex min-h-8 items-center justify-between gap-3 border-t border-line pt-3">
        <AddressLink address={address} />
        {/* The name is the link; this only says the card opens. */}
        <span aria-hidden="true" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-fg">
          Open
          <ArrowRight className="size-3.5" />
        </span>
      </p>
    </div>
  );
}
