import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2, Palette, Plus, Search } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenants } from '@/lib/data/repo';
import { getPack, housePack } from '@/lib/branding/registry';
import type { TenantSummary } from '@/lib/data/types';
import { ButtonLink, EmptyState, Input, Tabs } from '@/components/ui';

import { brandVerdict } from './_shared/brand-check';
import { CollegeCard, STATUS, type CollegeCardData } from './_shared/CollegeCard';
import { hasMark, hasPhotos, mediaSummary, setupSteps } from './_shared/MediaReadiness';
import { ConsoleBand } from './_shared/parts';
import { portalAddress } from './_shared/portal-address';
import { VendorTrustChip } from './_shared/VendorTrustChip';

/**
 * Every college on the platform, as a portfolio.
 *
 * A platform admin runs the infrastructure for every college and can read
 * member data in none of them: `platform_admin` holds exactly three
 * capabilities, and row-level security refuses the query a second time.
 * So this screen counts colleges, packs and checks. It never counts, shows
 * or links to a person, and it does not read `memberCount` and its
 * siblings off the tenant row: on a real deployment those are derived from
 * member rows, which is exactly what the vendor may not see.
 */

export const metadata = { title: 'Colleges' };

type StatusFilter = 'all' | TenantSummary['status'];

const one = (v: string | string[] | undefined): string =>
  (Array.isArray(v) ? v[0] : v)?.trim() ?? '';

function buildHref(next: { status?: StatusFilter; q?: string }): string {
  const params = new URLSearchParams();
  if (next.status && next.status !== 'all') params.set('status', next.status);
  if (next.q) params.set('q', next.q);
  const qs = params.toString();
  return qs ? `/platform?${qs}` : '/platform';
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

  const rows: CollegeCardData[] = await Promise.all(
    all.map(async (tenant) => {
      const pack = getPack(tenant.packId);
      const steps = setupSteps(tenant, pack);
      return {
        tenant,
        pack,
        address: await portalAddress(tenant.subdomain),
        setup: { done: steps.filter((s) => s.done).length, total: steps.length },
        verdict: pack ? brandVerdict(pack) : null,
        media: mediaSummary(pack),
        joined: month.format(new Date(tenant.createdAt)),
      };
    }),
  );

  // Search reads what the card shows: the name, the short name and the address.
  const needle = q.toLowerCase();
  const searched = q
    ? rows.filter((r) =>
        `${r.tenant.name} ${r.tenant.shortName} ${r.address.host}`.toLowerCase().includes(needle),
      )
    : rows;
  const shown = status === 'all' ? searched : searched.filter((r) => r.tenant.status === status);

  // What an operator acts on, counted across colleges and never across people.
  const live = all.filter((t) => t.status === 'active').length;
  const onboarding = all.filter((t) => t.status === 'provisioning').length;
  const blocked = rows.filter((r) => r.verdict?.blocked).length;
  const awaitingMedia = rows.filter((r) => !hasMark(r.pack) || !hasPhotos(r.pack)).length;

  const countFor = (s: TenantSummary['status']) => searched.filter((r) => r.tenant.status === s).length;
  const tabs = [
    { label: 'All', href: buildHref({ q }), count: searched.length, active: status === 'all' },
    ...(['active', 'provisioning', 'suspended'] as const)
      .map((s) => ({ label: STATUS[s].label, href: buildHref({ status: s, q }), count: countFor(s), active: status === s }))
      // An empty filter is not offered, unless it is the one in the address bar.
      .filter((t) => t.count > 0 || t.active),
  ];

  const band = (
    <ConsoleBand
      eyebrow="Platform / Portfolio"
      title="Colleges"
      lead="Every college on the platform, as its own members meet it. Open one to see its set-up, its look and what is still outstanding."
      actions={
        <>
          <ButtonLink href="/platform/new" variant="band" className="min-h-11">
            <Plus className="size-4" aria-hidden="true" />
            Set up a college
          </ButtonLink>
          <ButtonLink href="/platform/brands" variant="band-outline" className="min-h-11">
            <Palette className="size-4" aria-hidden="true" />
            Brand packs
          </ButtonLink>
        </>
      }
      figures={
        all.length
          ? [
              { value: live, label: 'Live' },
              { value: onboarding, label: 'Onboarding' },
              { value: blocked, label: 'Check blocked' },
              { value: awaitingMedia, label: 'Awaiting media' },
            ]
          : undefined
      }
    />
  );

  // The chip stays outside the band: its explanation opens in a popover the band would clip.
  const trust = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <VendorTrustChip />
      <p className="text-xs text-secondary">These figures count colleges, packs and checks. None of them counts people.</p>
    </div>
  );

  if (all.length === 0) {
    return (
      <div className="space-y-6">
        {band}
        {trust}
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
      {band}
      {trust}

      <div className="flex flex-col-reverse gap-3 border-b border-line sm:flex-row sm:items-end sm:justify-between">
        <Tabs items={tabs} ariaLabel="Filter colleges by status" className="min-w-0 border-b-0" />
        <form method="get" role="search" className="sm:w-80 sm:pb-2">
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
        <ul aria-label="Colleges on the platform" className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {shown.map((r) => (
            <li key={r.tenant.id} className="min-w-0">
              <CollegeCard row={r} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
