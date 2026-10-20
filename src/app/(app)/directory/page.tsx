import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { SearchX, Users } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { require as requireCap, can, type Session } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getOwnProfile, searchDirectory } from '@/lib/data/repo';
import type { DirectoryFacets, DirectoryQuery } from '@/lib/data/types';
import { siteOrigin } from '@/lib/share';
import { viewerBatchYear, viewerBranch } from '@/lib/identity';
import {
  Alert,
  ButtonLink,
  ChipNav,
  CopyButton,
  EmptyState,
  Pagination,
  StickyActionBar,
  Tabs,
} from '@/components/ui';
import { PageBand } from '@/components/brand/PageBand';
import { MemberCard } from '@/components/members/MemberCard';
import { FilterPanel } from '@/components/directory/FilterPanel';
import { FiltersSheet, SearchBar, SortMenu } from '@/components/directory/SearchBar';
import { ActiveFilters } from '@/components/directory/ActiveFilters';
import { StartHere, type StartTile } from '@/components/directory/StartHere';
import { BrowseStrip } from '@/components/directory/BrowseStrip';
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

  const { items, total, page, pageCount, tier } = result;
  const noun = cohortNoun(params.cohort, canSearchStudents);
  const filterCount = countFilters(params);
  const filtering = activeFilterKeys(params).length > 0 || Boolean(params.q);
  const { shortName } = pack.copy;
  const studentTier = tier === 'student';

  // The unfiltered alumni set, for the header's sentence and the browse
  // strip. The same query the results run, with nothing narrowing it.
  const everyone = searchDirectory(session, { cohort: 'alumni', perPage: 1 });
  const years = everyone.facets.batches
    .map((b) => Number(b.value))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a);
  const first = years[years.length - 1];
  const last = years[0];

  const lead = studentTier
    ? `Graduates of ${shortName} who can help. Start with people marked Mentors: they have said yes to being asked.`
    : `${everyone.total.toLocaleString('en-IN')} graduates${
        years.length >= 2 ? ` from ${first}–${last}` : ''
      }. Search by batch, branch, company or city.`;

  const origin = await siteOrigin();
  const searchLink = `${origin}${buildDirectoryHref(params)}`;

  const sortItems = SORTS.map((s) => ({
    label: s.label,
    href: buildDirectoryHref(params, { sort: s.value === 'relevance' ? null : s.value }),
    active: (params.sort ?? 'relevance') === s.value,
  }));

  // One availability at a time: the chip row reads as a choice of whom to
  // look for. Combinations still arrive intact from a shared link.
  const noAvailability = AVAILABILITY.every((a) => params[a.key] !== '1');
  const availabilityNav = [
    {
      label: 'Everyone',
      href: buildDirectoryHref(params, { mentoring: null, referrals: null, speaking: null }),
      active: noAvailability,
    },
    ...AVAILABILITY.map((a) => ({
      label: a.chip,
      href: buildDirectoryHref(params, {
        mentoring: null,
        referrals: null,
        speaking: null,
        [a.key]: '1',
      }),
      active: params[a.key] === '1',
    })),
  ];

  const cohortTabs = canSearchStudents
    ? [
        { label: 'Alumni', value: 'alumni' },
        { label: 'Final-year students', value: 'students' },
        { label: 'Everyone', value: 'all' },
      ].map((c) => ({
        label: c.label,
        href: buildDirectoryHref(params, { cohort: c.value === 'all' ? null : c.value }),
        active: (params.cohort ?? 'all') === c.value,
      }))
    : null;

  const start = !filtering && !canSearchStudents ? startTiles(session, everyone.facets, studentTier) : null;

  const browse = !filtering ? (
    <BrowseStrip
      batches={years}
      branches={everyone.facets.departments.map((d) => ({ code: d.value, name: d.label }))}
    />
  ) : null;

  return (
    <div className="space-y-6">
      <PageBand
        pack={pack}
        size="compact"
        eyebrow={`${shortName} directory`}
        title="Find your people"
        lead={lead}
      />

      <SearchBar params={params} />

      <ActiveFilters params={params} departments={facets.departments} />

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="hidden min-w-0 lg:block">
          {/* Sticky, and scrolls inside itself when the facets outgrow the viewport. */}
          <div className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1 lg:[scrollbar-width:thin]">
            <FilterPanel
              params={params}
              facets={facets}
              canSearchStudents={canSearchStudents}
              studentTier={studentTier}
            />
          </div>
        </div>

        <section aria-label="Search results" className="flex min-w-0 flex-col gap-4 lg:gap-5">
          {cohortTabs ? <Tabs items={cohortTabs} ariaLabel="Who to show" /> : null}

          {/* Ways in, shown only before any search. On a phone they follow
              the results: the first screen there is for people. */}
          {start || browse ? (
            <div className="order-last space-y-4 border-t border-line pt-4 sm:order-none sm:border-0 sm:pt-0">
              {start ? <StartHere tiles={start.tiles} employers={start.employers} /> : null}
              {browse}
            </div>
          ) : null}

          {/* A search link is meant to be shared, which means it will be
              opened by someone with narrower access than whoever made it. */}
          {params.cohort === 'students' && !canSearchStudents ? (
            <Alert tone="warning" title="This link searches final-year students">
              <p>
                Your account searches alumni.{' '}
                <Link href={buildDirectoryHref(params, { cohort: null })} className="link">
                  Run the same search over alumni
                </Link>
                .
              </p>
            </Alert>
          ) : null}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <h2 className="font-display text-xl font-semibold">
                {total === 0 ? (
                  <>No {noun} match</>
                ) : (
                  <>
                    <span className="tabular text-display-xs font-bold text-brand-fg">{total.toLocaleString('en-IN')}</span>{' '}
                    {total === 1 ? 'person' : 'people'}
                  </>
                )}
              </h2>
              <div className="flex items-center gap-2">
                <CopyButton
                  text={searchLink}
                  label="Copy link to this search"
                  copiedLabel="Link copied"
                  variant="ghost"
                  size="sm"
                />
                <SortMenu id="directory-sort" items={sortItems} className="hidden lg:block" />
              </div>
            </div>

            {/* Final-year students do not mentor or refer; the row would only ever empty the list. */}
            {params.cohort !== 'students' ? (
              <ChipNav items={availabilityNav} ariaLabel="Who is open to being asked" />
            ) : null}
          </div>

          {items.length === 0 && total > 0 ? (
            <Alert tone="warning" title={`Page ${page} is past the end of these results`}>
              <p>
                <Link href={buildDirectoryHref(params, { page: null })} className="link">
                  Go back to the first page
                </Link>
                .
              </p>
            </Alert>
          ) : null}

          {items.length > 0 ? (
            <>
              {/* Phones get the compact row: a full card per person made this
                  page seven thousand pixels tall at 390. */}
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface-raised shadow-sm sm:hidden">
                {items.map((member) => (
                  <li key={member.id} className="relative min-w-0">
                    <MemberCard
                      member={member}
                      variant="row"
                      isViewer={member.id === session.memberId}
                      className="min-h-0 rounded-none border-0 py-2 shadow-none hover:bg-surface-sunken hover:shadow-none"
                    />
                  </li>
                ))}
              </ul>
              {/* Two across beside the filter rail: three left each card
                  about 260px, which wrapped names and broke the chips. */}
              <ul className="stagger hidden gap-4 sm:grid sm:grid-cols-2 2xl:grid-cols-3">
                {items.map((member, i) => (
                  // `relative` so the card's overlay link covers the card and
                  // nothing else — the whole tile is the hit target.
                  <li key={member.id} className="relative min-w-0" style={{ '--i': Math.min(i, 8) } as CSSProperties}>
                    <MemberCard member={member} className="h-full" isViewer={member.id === session.memberId} />
                  </li>
                ))}
              </ul>
            </>
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

          {can(session, 'member.export') ? (
            <p className="text-sm text-secondary">
              Contact exports are run from the{' '}
              <Link href="/admin/members" className="link">
                staff console
              </Link>
              .
            </p>
          ) : null}
        </section>
      </div>

      <StickyActionBar label="Filters and sort">
        <FiltersSheet count={filterCount}>
          <FilterPanel
            params={params}
            facets={facets}
            canSearchStudents={canSearchStudents}
            studentTier={studentTier}
            idPrefix="m-"
            framed={false}
          />
        </FiltersSheet>
        <SortMenu id="directory-sort-bar" items={sortItems} placement="above" />
      </StickyActionBar>
    </div>
  );
}

// ---------------------------------------------------------------

/**
 * The viewer's own starting points. Students are offered mentors, their
 * branch and the employers alumni work at; everyone else their batch,
 * their branch, people near them and mentors. Counts come from the same
 * unfiltered search as the header and one `perPage: 1` count each.
 */
function startTiles(
  session: Session,
  facets: DirectoryFacets,
  studentTier: boolean,
): { tiles: StartTile[]; employers?: Array<{ label: string; href: string }> } {
  const mentors = searchDirectory(session, { mentoring: true, perPage: 1 }).total;
  const branch = viewerBranch(session);

  if (studentTier) {
    const tiles: StartTile[] = [
      { key: 'mentor', label: 'Alumni who mentor', count: mentors, href: '/directory?mentoring=1', icon: 'mentor' },
    ];
    if (branch) {
      tiles.push({
        key: 'branch',
        label: 'From your branch',
        detail: branch,
        count: facets.departments.find((d) => d.value === branch)?.count ?? null,
        href: buildDirectoryHref({}, { department: branch }),
        icon: 'branch',
      });
    }
    const employers = facets.companies.slice(0, 3).map((c) => ({
      label: c.label,
      href: buildDirectoryHref({}, { company: c.value }),
    }));
    return { tiles, employers };
  }

  const tiles: StartTile[] = [];
  const year = viewerBatchYear(session);
  if (year) {
    tiles.push({
      key: 'batch',
      label: 'Your batch',
      detail: String(year),
      count: facets.batches.find((b) => b.value === String(year))?.count ?? null,
      href: `/directory/batch/${year}`,
      icon: 'batch',
    });
  }
  if (branch) {
    tiles.push({
      key: 'branch',
      label: 'Your branch',
      detail: branch,
      count: facets.departments.find((d) => d.value === branch)?.count ?? null,
      href: `/directory/branch/${encodeURIComponent(branch)}`,
      icon: 'branch',
    });
  }
  const city = getOwnProfile(session)?.city ?? null;
  if (city) {
    tiles.push({
      key: 'near',
      label: 'Near you',
      detail: city,
      count: searchDirectory(session, { city, perPage: 1 }).total,
      href: buildDirectoryHref({}, { city }),
      icon: 'near',
    });
  }
  tiles.push({
    key: 'mentor',
    label: 'Open to mentoring',
    count: mentors,
    href: '/directory?mentoring=1',
    icon: 'mentor',
  });
  return { tiles };
}

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
    ? `Nothing matches “${params.q}” with these filters. Try a surname on its own, or a company.`
    : `No ${noun} match this combination of filters. Removing one usually brings the list back.`;

  return (
    <EmptyState
      icon={suggestions.length ? <SearchX className="size-5" /> : <Users className="size-5" />}
      title="No one matches yet"
      description={description}
      action={
        suggestions.length ? (
          <div className="flex max-w-xl flex-wrap justify-center gap-2">
            {suggestions.slice(0, 5).map((s) => (
              <ButtonLink key={s.href + s.label} href={s.href} variant="secondary" size="sm" className="min-h-11 sm:min-h-0">
                {s.label}
              </ButtonLink>
            ))}
            <ButtonLink href="/directory" variant="ghost" size="sm" className="min-h-11 sm:min-h-0">
              Start over
            </ButtonLink>
          </div>
        ) : null
      }
    />
  );
}

function describeFilter(key: DirectoryParamKey, value: string): string {
  const availability = AVAILABILITY.find((a) => a.key === key);
  if (availability) return `“${availability.chip}”`;
  if (key === 'cohort') return value === 'students' ? 'the final-year filter' : 'the alumni-only filter';
  return `“${value}”`;
}
