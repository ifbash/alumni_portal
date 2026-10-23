import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Search, Store } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, isActive } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getBusinessFacets, getBusinesses } from '@/lib/data/businesses';
import { BUSINESS_INDUSTRIES } from '@/lib/community';
import { Button, ButtonLink, ChipNav, EmptyState, Input, PageHeader, Pagination, Select, Tabs } from '@/components/ui';
import { BusinessCard } from '@/components/community/BusinessCard';

/**
 * The alumni business directory.
 *
 * What a graduate runs is one of the best reasons to open the portal in a
 * month when nobody is job-hunting: a batchmate's design studio, an
 * alumna's cold-chain company. Listings are reviewed before they appear, so
 * everything here is something the college has looked at.
 *
 * A card shows what a business does and where; contact details are on the
 * listing's own page, behind the two-gate rule (never for a student, and
 * only if the owner chose to share them).
 */

export const metadata: Metadata = { title: 'Businesses' };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

interface Filters {
  q?: string;
  industry?: string;
  city?: string;
  view?: 'mine';
}

function href(f: Filters, page?: number): string {
  const qs = new URLSearchParams();
  if (f.view) qs.set('view', f.view);
  if (f.q) qs.set('q', f.q);
  if (f.industry) qs.set('industry', f.industry);
  if (f.city) qs.set('city', f.city);
  if (page && page > 1) qs.set('page', String(page));
  const s = qs.toString();
  return s ? `/businesses?${s}` : '/businesses';
}

export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!isActive(session)) redirect('/pending');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.businesses) notFound();

  const params = await searchParams;
  const industry = (BUSINESS_INDUSTRIES as readonly string[]).includes(one(params.industry) ?? '') ? one(params.industry) : undefined;
  const filters: Filters = {
    q: one(params.q)?.trim().slice(0, 120) || undefined,
    industry,
    city: one(params.city)?.trim().slice(0, 60) || undefined,
    view: one(params.view) === 'mine' ? 'mine' : undefined,
  };
  const page = Math.max(1, Number(one(params.page)) || 1);

  const canList = can(session, 'business.list');
  const mineList = getBusinesses(session, { mine: true, perPage: 50 });
  const result = getBusinesses(session, {
    q: filters.q,
    industry: filters.industry,
    city: filters.city,
    mine: filters.view === 'mine',
    page,
    perPage: 12,
  });
  const facets = getBusinessFacets();
  const mine = filters.view === 'mine';
  const filtered = Boolean(filters.q || filters.industry || filters.city);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Businesses"
        title="Businesses"
        description={`Businesses run by ${pack.copy.shortName} alumni.`}
        actions={
          canList ? (
            <ButtonLink href="/businesses/new">
              <Store className="size-4" aria-hidden="true" />
              List your business
            </ButtonLink>
          ) : undefined
        }
      />

      {canList ? (
        <Tabs
          ariaLabel="Directory"
          items={[
            { label: 'Directory', href: href({ ...filters, view: undefined }), active: !mine },
            { label: 'Your listings', href: href({ view: 'mine' }), count: mineList.total, active: mine },
          ]}
        />
      ) : null}

      {!mine ? (
        <div className="space-y-3">
          <form action="/businesses" method="get" role="search" aria-label="Search businesses" className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_14rem_auto]">
            <Input name="q" defaultValue={filters.q ?? ''} placeholder="Search by name, product or service" aria-label="Search businesses" leading={<Search className="size-4" />} />
            <Select name="industry" defaultValue={filters.industry ?? ''} aria-label="Industry">
              <option value="">Every industry</option>
              {facets.industries.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.value} ({i.count})
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary" className="min-h-11 sm:min-h-0">
              Search
            </Button>
          </form>

          {facets.cities.length > 1 ? (
            <ChipNav
              ariaLabel="City"
              items={[
                { label: 'Every city', href: href({ ...filters, city: undefined }), active: !filters.city },
                ...facets.cities.slice(0, 8).map((c) => ({ label: `${c.value} (${c.count})`, href: href({ ...filters, city: c.value }), active: filters.city === c.value })),
              ]}
            />
          ) : null}
        </div>
      ) : null}

      {result.items.length === 0 ? (
        mine ? (
          <EmptyState
            icon={<Store className="size-5" />}
            title="You have not listed a business"
            description="List one and the alumni cell reviews it, usually within a few days. Alumni can then find it by what it does and where it is."
            action={
              <ButtonLink href="/businesses/new" variant="secondary">
                List your business
              </ButtonLink>
            }
          />
        ) : filtered ? (
          <EmptyState
            variant="inline"
            title="No business matches that."
            action={
              <Link href="/businesses" className="link inline-flex min-h-11 items-center">
                Clear the filters
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={<Store className="size-5" />}
            title="No businesses listed yet"
            description="Alumni list the businesses they run here, and each one is reviewed before it appears."
            action={
              canList ? (
                <ButtonLink href="/businesses/new" variant="secondary">
                  List the first one
                </ButtonLink>
              ) : undefined
            }
          />
        )
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {result.items.map((b) => (
            <li key={b.id} className="min-w-0">
              <BusinessCard business={b} showStatus={mine} />
            </li>
          ))}
        </ul>
      )}

      {result.pageCount > 1 ? (
        <Pagination page={result.page} pageCount={result.pageCount} total={result.total} buildHref={(p) => href(filters, p)} />
      ) : null}
    </div>
  );
}
