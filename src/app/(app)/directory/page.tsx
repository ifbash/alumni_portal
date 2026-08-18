import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Info, SearchX, SlidersHorizontal, Users } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { require as requireCap, can, type Session } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { searchDirectory } from '@/lib/data/repo';
import type { DirectoryFacets, DirectoryQuery } from '@/lib/data/types';
import {
  Alert,
  ButtonLink,
  EmptyState,
  PageHeader,
  Pagination,
  SegmentedNav,
} from '@/components/ui';
import { MemberCard } from '@/components/members/MemberCard';
import { MarginNote } from '@/components/brand/Marks';
import { FilterPanel } from '@/components/directory/FilterPanel';
import { SearchBar } from '@/components/directory/SearchBar';
import { ActiveFilters } from '@/components/directory/ActiveFilters';
import {
  AVAILABILITY,
  SORTS,
  activeFilterKeys,
  buildDirectoryHref,
  countFilters,
  readDirectoryParams,
  toDirectoryQuery,
  type DirectoryParamKey,
  type DirectoryParams,
} from '@/components/directory/query';

export const metadata: Metadata = {
  title: 'Directory',
  description: 'Search alumni by branch, batch, company, city or skill.',
};

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.directory) notFound();

  // Two different capabilities lead here: alumni search for members, and
  // student search for an HOD or the placement cell. Holding either is
  // enough; holding neither is a 403, not an empty page.
  const canSearchAlumni = can(session, 'directory.search.alumni');
  const canSearchStudents = can(session, 'directory.search.students');
  if (!canSearchAlumni && !canSearchStudents) requireCap(session, 'directory.search.alumni');

  const params = readDirectoryParams(await searchParams);
  const query = toDirectoryQuery(params);

  const result = searchDirectory(session, query);
  const facets = leaveOneOutFacets(session, query);

  const { items, total, page, perPage, pageCount, tier } = result;
  const firstOnPage = total === 0 ? 0 : (page - 1) * perPage + 1;
  const lastOnPage = Math.min(page * perPage, total);
  const noun = cohortNoun(params.cohort, canSearchStudents);
  const filterCount = countFilters(params);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={pack.copy.shortName}
        title="Directory"
        description={`Everyone listed here is a verified member of the ${pack.copy.shortName} network. Filter by branch, batch, company, city or skill — the address bar holds the whole search, so a link you paste into WhatsApp opens the same result set for whoever receives it.`}
      />

      <SearchBar params={params} />

      <ActiveFilters params={params} departments={facets.departments} />

      <div className="grid gap-gutter lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="min-w-0">
          {/* Below lg the panel is collapsed by default: on a 360px screen a
              nine-section filter list pushes every result below the fold. */}
          <details className="lg:hidden">
            <summary className="flex h-control cursor-pointer list-none items-center justify-between gap-2 rounded border border-line bg-surface-raised px-4 text-sm font-semibold marker:hidden">
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-muted" aria-hidden="true" />
                Filters
                {filterCount > 0 ? (
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs tabular text-brand-soft-fg">
                    {filterCount}
                  </span>
                ) : null}
              </span>
              <span className="text-xs font-medium text-muted">Open</span>
            </summary>
            <FilterPanel
              className="mt-3"
              params={params}
              facets={facets}
              canSearchStudents={canSearchStudents}
              idPrefix="m-"
            />
          </details>

          <div className="hidden lg:sticky lg:top-6 lg:block">
            <FilterPanel
              params={params}
              facets={facets}
              canSearchStudents={canSearchStudents}
            />
          </div>
        </div>

        <section aria-label="Search results" className="min-w-0 space-y-4">
          {tier === 'student' ? (
            <Alert
              tone="info"
              title="You are seeing alumni who have opted in to being contacted"
              icon={<Info className="size-4" />}
            >
              <p>
                Other students are not listed, and contact details are not shown here. An
                alumnus&apos;s email or number is released only after they accept a request from
                you — that is their choice, not a restriction the college applies to you.
              </p>
            </Alert>
          ) : null}

          {/* A search link is meant to be shared, which means it will be
              opened by someone with narrower access than whoever made it. */}
          {params.cohort === 'students' && !canSearchStudents ? (
            <Alert tone="warning" title="This link filters for final-year students">
              <p>
                Whoever shared it can see the student cohort; your account cannot, so nothing
                matches.{' '}
                <Link href={buildDirectoryHref(params, { cohort: null })} className="link">
                  Run the same search over alumni
                </Link>
                .
              </p>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-secondary">
              {total === 0 ? (
                <>No {noun} match</>
              ) : (
                <>
                  Showing{' '}
                  <span className="tabular font-medium text-primary">
                    {firstOnPage.toLocaleString('en-IN')}–{lastOnPage.toLocaleString('en-IN')}
                  </span>{' '}
                  of <span className="tabular font-medium text-primary">{total.toLocaleString('en-IN')}</span>{' '}
                  {noun}
                </>
              )}
            </p>

            <div className="-mx-1 max-w-full overflow-x-auto px-1">
              <SegmentedNav
                items={SORTS.map((s) => ({
                  label: s.label,
                  href: buildDirectoryHref(params, {
                    sort: s.value === 'relevance' ? null : s.value,
                  }),
                  active: (params.sort ?? 'relevance') === s.value,
                }))}
              />
            </div>
          </div>

          {items.length === 0 && total > 0 ? (
            <Alert tone="warning" title={`Page ${page} is past the end of this result set`}>
              <p>
                There are {total.toLocaleString('en-IN')} {noun} in total.{' '}
                <Link href={buildDirectoryHref(params, { page: null })} className="link">
                  Go back to the first page
                </Link>
                .
              </p>
            </Alert>
          ) : null}

          {items.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((member) => (
                // `relative` so the card's overlay link covers the card and
                // nothing else — the whole tile is the hit target on a phone.
                <li key={member.id} className="relative">
                  <MemberCard member={member} className="h-full" />
                </li>
              ))}
            </ul>
          ) : null}

          {total === 0 ? <NoResults params={params} noun={noun} /> : null}

          {pageCount > 1 ? (
            <Pagination
              className="border-t border-line pt-4"
              page={page}
              pageCount={pageCount}
              total={total}
              // Every other parameter rides along. A filtered search that
              // loses its filters on page two is a search nobody finishes.
              buildHref={(p) => buildDirectoryHref(params, { page: p <= 1 ? null : String(p) })}
            />
          ) : null}

          <MarginNote className="max-w-prose border-t border-line pt-4">
            Contact details are never listed on this page. They are released when the member has
            consented <em>and</em> the viewer is entitled to see them — both, never either. Bulk
            export is a college-admin action and is logged with a reason.
          </MarginNote>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------

/**
 * Facet counts, computed leave-one-out.
 *
 * `searchDirectory` returns facets for the rows that survived *every*
 * filter, which is the right answer for a summary and the wrong one for a
 * facet list: once you pick CSE, the branch facet contains only CSE and
 * there is no way back to ECE except the URL. Each list is therefore
 * counted with its own filter removed. Six extra passes over an in-memory
 * fixture; in Postgres this is one grouped query per facet, which is what
 * every faceted search engine does anyway.
 */
function leaveOneOutFacets(session: Session, query: DirectoryQuery): DirectoryFacets {
  const facetsWithout = (patch: Partial<DirectoryQuery>): DirectoryFacets =>
    searchDirectory(session, { ...query, ...patch, page: 1, perPage: 1 }).facets;

  return {
    departments: facetsWithout({ department: undefined }).departments,
    batches: facetsWithout({ batchFrom: undefined, batchTo: undefined }).batches,
    companies: facetsWithout({ company: undefined }).companies,
    cities: facetsWithout({ city: undefined }).cities,
    industries: facetsWithout({ industry: undefined }).industries,
    skills: facetsWithout({ skill: undefined }).skills,
  };
}

function cohortNoun(cohort: string | undefined, canSearchStudents: boolean): string {
  if (cohort === 'students') return 'final-year students';
  if (cohort === 'alumni') return 'alumni';
  return canSearchStudents ? 'members' : 'alumni';
}

/**
 * The empty state does the work the filters could not.
 *
 * "No results" with nothing to click is where a directory session ends.
 * Every suggestion here is a real link that removes or widens exactly one
 * thing, in the order most likely to have caused the emptiness.
 */
function NoResults({ params, noun }: { params: DirectoryParams; noun: string }) {
  const suggestions: Array<{ label: string; href: string }> = [];

  const from = params.batchFrom ? Number(params.batchFrom) : null;
  const to = params.batchTo ? Number(params.batchTo) : null;

  if (from || to) {
    const wideFrom = from ? Math.max(1950, from - 2) : null;
    const wideTo = to ? Math.min(2100, to + 2) : null;
    suggestions.push({
      label: `Widen the batch range to ${wideFrom ?? 'any'}–${wideTo ?? 'any'}`,
      href: buildDirectoryHref(params, {
        batchFrom: wideFrom ? String(wideFrom) : null,
        batchTo: wideTo ? String(wideTo) : null,
      }),
    });
    suggestions.push({
      label: 'Search every batch',
      href: buildDirectoryHref(params, { batchFrom: null, batchTo: null }),
    });
  }

  for (const key of activeFilterKeys(params)) {
    if (key === 'batchFrom' || key === 'batchTo') continue;
    if (suggestions.length >= 5) break;
    suggestions.push({
      label: `Drop ${describeFilter(key, params[key]!)}`,
      href: buildDirectoryHref(params, { [key]: null }),
    });
  }

  if (params.q && activeFilterKeys(params).length > 0) {
    suggestions.push({
      label: `Search “${params.q}” with no filters`,
      href: buildDirectoryHref({}, { q: params.q }),
    });
  }

  if (params.q) {
    suggestions.push({
      label: 'Clear the search box',
      href: buildDirectoryHref(params, { q: null }),
    });
  }

  const description = params.q
    ? `Nothing matches “${params.q}” with the filters you have on. Spelling in the register varies — try a surname on its own, or a company instead of a person.`
    : `That combination of filters has no ${noun} in it. Removing one usually brings the list back.`;

  return (
    <EmptyState
      icon={suggestions.length ? <SearchX className="size-5" /> : <Users className="size-5" />}
      title="No one matches yet"
      description={description}
      action={
        suggestions.length ? (
          <div className="flex max-w-xl flex-wrap justify-center gap-2">
            {suggestions.slice(0, 5).map((s) => (
              <ButtonLink key={s.href + s.label} href={s.href} variant="secondary" size="sm">
                {s.label}
              </ButtonLink>
            ))}
            <ButtonLink href="/directory" variant="ghost" size="sm">
              Start over
            </ButtonLink>
          </div>
        ) : (
          <p className="max-w-sm text-sm text-secondary">
            The directory fills up as members verify their degree records. If you expected to see
            your batch here, they may not have registered yet.
          </p>
        )
      }
    />
  );
}

function describeFilter(key: DirectoryParamKey, value: string): string {
  const availability = AVAILABILITY.find((a) => a.key === key);
  if (availability) return `“${availability.label}”`;
  if (key === 'cohort') return value === 'students' ? 'the final-years-only filter' : 'the alumni-only filter';
  return `“${value}”`;
}
