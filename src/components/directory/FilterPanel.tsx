import Link from 'next/link';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button, Card, CardBody, Field, Select } from '@/components/ui';
import type { DirectoryFacets, FacetCount } from '@/lib/data/types';
import {
  COHORTS,
  DIRECTORY_PATH,
  DIRECTORY_PARAM_KEYS,
  buildDirectoryHref,
  countFilters,
  toggleDirectoryHref,
  type DirectoryParamKey,
  type DirectoryParams,
} from './query';

/**
 * Faceted filters.
 *
 * Every control is a link or a GET form, so the panel is a server
 * component with no JavaScript behind it. That is not asceticism: the
 * directory is the screen a 2015 graduate opens once on a phone on a
 * train, and a filter set that only works after a 200KB hydration is a
 * filter set that does not work.
 *
 * Counts are computed leave-one-out by the page — the branch list is
 * counted with every filter applied *except* branch — so selecting CSE
 * never hides ECE. A facet UI that collapses to the one value you already
 * picked is the most common way faceted search becomes a dead end.
 *
 * Batch and branch are what people search by, so they stay open. Company,
 * city, industry and skill sit under one "More filters" disclosure, and a
 * facet with a single value is not a choice, so it is not shown. Who is
 * open to being asked is the chip row above the results, not a group here.
 */
export function FilterPanel({
  params,
  facets,
  canSearchStudents,
  studentTier = false,
  idPrefix = '',
  framed = true,
  className,
}: {
  params: DirectoryParams;
  facets: DirectoryFacets;
  /** The cohort switch exists only for viewers who may enumerate students. */
  canSearchStudents: boolean;
  /**
   * The student tier's cards carry no city or industry, so the panel does
   * not offer them either. Display narrowing only; the page decides.
   */
  studentTier?: boolean;
  /** Keeps control ids unique when the panel is rendered twice (sheet + desktop). */
  idPrefix?: string;
  /** False inside a sheet, which is already a surface of its own. */
  framed?: boolean;
  className?: string;
}) {
  const activeCount = countFilters(params);
  const headingId = `${idPrefix}filters-heading`;

  // With nothing in the result set there is nothing to count, so every
  // facet list is empty. Say that, rather than showing a panel that looks
  // like it failed to load.
  const noFacets =
    facets.departments.length === 0 &&
    facets.batches.length === 0 &&
    facets.companies.length === 0 &&
    facets.cities.length === 0 &&
    facets.industries.length === 0 &&
    facets.skills.length === 0;

  type MoreGroup = { title: string; paramKey: DirectoryParamKey; options: FacetCount[] };
  const candidates: MoreGroup[] = [
    { title: 'Company', paramKey: 'company', options: facets.companies },
    { title: 'City', paramKey: 'city', options: studentTier ? [] : facets.cities },
    { title: 'Industry', paramKey: 'industry', options: studentTier ? [] : facets.industries },
    { title: 'Skill', paramKey: 'skill', options: facets.skills },
  ];
  const more = candidates.filter((g) => shows(g.options, params[g.paramKey]));

  const moreActive = more.filter((g) => params[g.paramKey]).length;

  const body = (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={headingId} className="font-display text-md font-semibold">
          Filters
        </h2>
        {activeCount > 0 ? (
          <Link
            href={buildDirectoryHref({}, { q: params.q ?? null, sort: params.sort ?? null })}
            className="link inline-flex min-h-11 items-center text-xs font-medium lg:min-h-0"
          >
            Clear all
          </Link>
        ) : null}
      </div>

      {canSearchStudents ? (
        <Group title="Show">
          <ul className="space-y-0.5">
            {COHORTS.map((c) => {
              const active = (params.cohort ?? 'all') === c.value;
              return (
                <li key={c.value}>
                  <OptionLink
                    href={buildDirectoryHref(params, { cohort: c.value === 'all' ? null : c.value })}
                    active={active}
                    label={c.label}
                  />
                </li>
              );
            })}
          </ul>
        </Group>
      ) : null}

      {noFacets ? (
        <Group title="Nothing left to narrow">
          <p className="text-xs text-secondary">
            No one matches the filters that are on. Clear all, or remove one of the chips above the
            results.
          </p>
        </Group>
      ) : null}

      <BatchRange params={params} batches={facets.batches} idPrefix={idPrefix} />

      <FacetGroup
        title="Branch"
        paramKey="department"
        options={facets.departments}
        params={params}
        limit={8}
      />

      {more.length > 0 ? (
        <details className="group/more border-t border-line pt-3" open={moreActive > 0}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-secondary marker:hidden hover:text-primary lg:min-h-9">
            <span>
              More filters
              {moreActive > 0 ? (
                <span className="ml-2 rounded-full bg-brand-soft px-1.5 py-0.5 normal-case tracking-normal text-brand-soft-fg">
                  {moreActive} on
                </span>
              ) : null}
            </span>
            <svg
              viewBox="0 0 20 20"
              className="size-4 shrink-0 text-muted transition-transform duration-fast group-open/more:rotate-180"
              fill="none"
              aria-hidden="true"
            >
              <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <div className="mt-2 space-y-5">
            {more.map((g) => (
              <FacetGroup
                key={g.paramKey}
                title={g.title}
                paramKey={g.paramKey}
                options={g.options}
                params={params}
              />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );

  if (!framed) {
    return (
      <section aria-labelledby={headingId} className={className}>
        {body}
      </section>
    );
  }

  return (
    <Card as="section" aria-labelledby={headingId} className={className}>
      <CardBody>{body}</CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------

/**
 * A facet is worth showing when it offers a choice: two or more values,
 * or the one value that is already selected (so it can be removed).
 */
function shows(options: FacetCount[], active: string | undefined): boolean {
  if (options.length >= 2) return true;
  return options.length === 1 && active === options[0]!.value;
}

function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2 border-t border-line pt-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-secondary">{title}</h3>
      {hint ? <p className="text-xs text-secondary">{hint}</p> : null}
      {children}
    </section>
  );
}

/**
 * Batch range.
 *
 * A range is two coupled values, so it is a small GET form with an Apply
 * button rather than two independent links — picking "from 2016" and
 * losing "to 2019" on the round trip is exactly the behaviour that makes
 * people stop using filters.
 */
function BatchRange({
  params,
  batches,
  idPrefix,
}: {
  params: DirectoryParams;
  batches: FacetCount[];
  idPrefix: string;
}) {
  if (batches.length === 0) return null;

  const years = [...batches].sort((a, b) => b.value.localeCompare(a.value));
  const carried = DIRECTORY_PARAM_KEYS.filter(
    (key) => key !== 'batchFrom' && key !== 'batchTo' && key !== 'page' && params[key],
  );

  return (
    <Group title="Batch" hint="Year of passing, inclusive.">
      <form method="get" action={DIRECTORY_PATH} className="space-y-3">
        {/* The rest of the search rides along, so applying a range never
            silently drops the branch or the search term. */}
        {carried.map((key) => (
          <input key={key} type="hidden" name={key} value={params[key]!} />
        ))}

        <div className="flex items-end gap-2">
          <Field htmlFor={`${idPrefix}batch-from`} label="From" className="min-w-0 flex-1">
            <Select id={`${idPrefix}batch-from`} name="batchFrom" defaultValue={params.batchFrom ?? ''}>
              <option value="">Any</option>
              {years.map((y) => (
                <option key={y.value} value={y.value}>
                  {y.value}
                </option>
              ))}
            </Select>
          </Field>

          <Field htmlFor={`${idPrefix}batch-to`} label="To" className="min-w-0 flex-1">
            <Select id={`${idPrefix}batch-to`} name="batchTo" defaultValue={params.batchTo ?? ''}>
              <option value="">Any</option>
              {years.map((y) => (
                <option key={y.value} value={y.value}>
                  {y.value}
                </option>
              ))}
            </Select>
          </Field>

          <Button type="submit" variant="secondary" className="min-h-11 lg:min-h-0">
            Apply
          </Button>
        </div>
      </form>

      {params.batchFrom || params.batchTo ? (
        <Link
          href={buildDirectoryHref(params, { batchFrom: null, batchTo: null })}
          className="link inline-flex min-h-11 items-center text-xs lg:min-h-0"
        >
          All batches
        </Link>
      ) : null}
    </Group>
  );
}

function FacetGroup({
  title,
  paramKey,
  options,
  params,
  limit = 5,
}: {
  title: string;
  paramKey: DirectoryParamKey;
  options: FacetCount[];
  params: DirectoryParams;
  limit?: number;
}) {
  const active = params[paramKey];
  if (!shows(options, active)) return null;

  // The selected value always shows, even when it is not popular enough
  // to make the visible slice.
  const ordered = active
    ? [...options.filter((o) => o.value === active), ...options.filter((o) => o.value !== active)]
    : options;

  const shown = ordered.slice(0, limit);
  const rest = ordered.slice(limit);

  return (
    <Group title={title}>
      <ul className="space-y-0.5">
        {shown.map((option) => (
          <FacetLink key={option.value} option={option} paramKey={paramKey} params={params} />
        ))}
      </ul>

      {rest.length ? (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center px-2 text-xs font-medium text-brand-fg marker:hidden hover:underline lg:min-h-8">
            <span className="group-open:hidden">Show {rest.length} more</span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>
          <ul className="mt-0.5 space-y-0.5">
            {rest.map((option) => (
              <FacetLink key={option.value} option={option} paramKey={paramKey} params={params} />
            ))}
          </ul>
        </details>
      ) : null}
    </Group>
  );
}

/** A choice in a one-of list (the cohort switch): a link that reads as a radio. */
function OptionLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex min-h-11 items-center gap-2.5 rounded px-2 text-sm lg:min-h-9',
        'transition-colors duration-fast ease-brand hover:bg-surface-sunken',
        active && 'bg-brand-soft font-semibold text-brand-soft-fg hover:bg-brand-soft',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-4 shrink-0 place-items-center rounded-full border',
          active ? 'border-[var(--button-primary-bg)]' : 'border-line-strong',
        )}
      >
        {active ? <span className="size-2 rounded-full bg-[var(--button-primary-bg)]" /> : null}
      </span>
      <span className="min-w-0 flex-1 whitespace-nowrap">{label}</span>
    </Link>
  );
}

function FacetLink({
  option,
  paramKey,
  params,
}: {
  option: FacetCount;
  paramKey: DirectoryParamKey;
  params: DirectoryParams;
}) {
  const active = params[paramKey] === option.value;

  return (
    <li>
      <Link
        href={toggleDirectoryHref(params, paramKey, option.value)}
        title={option.label}
        className={cn(
          'flex min-h-11 items-center justify-between gap-2 rounded px-2 text-sm lg:min-h-8',
          'transition-colors duration-fast ease-brand hover:bg-surface-sunken',
          active && 'bg-brand-soft font-semibold text-brand-soft-fg hover:bg-brand-soft',
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {active ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : null}
          <span className="truncate">{option.label}</span>
          {active ? <span className="sr-only">selected — activate to remove</span> : null}
        </span>
        <span className={cn('shrink-0 tabular text-xs', active ? 'text-brand-soft-fg' : 'text-secondary')}>
          {option.count.toLocaleString('en-IN')}
        </span>
      </Link>
    </li>
  );
}
