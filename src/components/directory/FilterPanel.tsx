import Link from 'next/link';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button, Card, CardBody, Field, SegmentedNav, Select } from '@/components/ui';
import type { DirectoryFacets, FacetCount } from '@/lib/data/types';
import {
  AVAILABILITY,
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
 */
export function FilterPanel({
  params,
  facets,
  canSearchStudents,
  idPrefix = '',
  className,
}: {
  params: DirectoryParams;
  facets: DirectoryFacets;
  /** The cohort switch exists only for viewers who may enumerate students. */
  canSearchStudents: boolean;
  /** Keeps control ids unique when the panel is rendered twice (mobile + desktop). */
  idPrefix?: string;
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

  return (
    <Card as="section" aria-labelledby={headingId} className={className}>
      <CardBody className="space-y-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id={headingId} className="font-display text-md font-semibold">
            Filters
          </h2>
          {activeCount > 0 ? (
            <Link
              href={buildDirectoryHref({}, { q: params.q ?? null, sort: params.sort ?? null })}
              className="link text-xs font-medium"
            >
              Clear all
            </Link>
          ) : null}
        </div>

        {canSearchStudents ? (
          <Group title="Show">
            <SegmentedNav
              className="flex w-full [&>a]:flex-1 [&>a]:text-center"
              items={COHORTS.map((c) => ({
                label: c.label,
                href: buildDirectoryHref(params, { cohort: c.value === 'all' ? null : c.value }),
                active: (params.cohort ?? 'all') === c.value,
              }))}
            />
          </Group>
        ) : null}

        <Group
          title="Availability"
          hint="Who has already agreed to be approached."
        >
          <ul className="space-y-0.5">
            {AVAILABILITY.map((option) => {
              const active = params[option.key] === '1';
              return (
                <li key={option.key}>
                  <Link
                    href={buildDirectoryHref(params, { [option.key]: active ? null : '1' })}
                    className={cn(
                      'flex items-center gap-2.5 rounded px-2 py-1.5 text-sm',
                      'transition-colors duration-fast ease-brand hover:bg-surface-sunken',
                      active && 'bg-brand-soft font-semibold text-brand-soft-fg hover:bg-brand-soft',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'grid size-4 shrink-0 place-items-center rounded-sm border',
                        active
                          ? 'border-transparent bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)]'
                          : 'border-line-strong',
                      )}
                    >
                      {active ? <Check className="size-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {active ? <span className="sr-only">selected — activate to remove</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Group>

        {noFacets ? (
          <Group title="Nothing left to narrow">
            <p className="text-xs text-secondary">
              No one matches the filters that are already on, so there are no branches, batches or
              companies left to count. Clear all, or drop one of the chips above the results.
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
        <FacetGroup title="Company" paramKey="company" options={facets.companies} params={params} />
        <FacetGroup title="City" paramKey="city" options={facets.cities} params={params} />
        <FacetGroup title="Industry" paramKey="industry" options={facets.industries} params={params} />
        <FacetGroup title="Skill" paramKey="skill" options={facets.skills} params={params} />
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------

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
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
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
            <Select
              id={`${idPrefix}batch-from`}
              name="batchFrom"
              sizeVariant="sm"
              defaultValue={params.batchFrom ?? ''}
            >
              <option value="">Any</option>
              {years.map((y) => (
                <option key={y.value} value={y.value}>
                  {y.value}
                </option>
              ))}
            </Select>
          </Field>

          <Field htmlFor={`${idPrefix}batch-to`} label="To" className="min-w-0 flex-1">
            <Select
              id={`${idPrefix}batch-to`}
              name="batchTo"
              sizeVariant="sm"
              defaultValue={params.batchTo ?? ''}
            >
              <option value="">Any</option>
              {years.map((y) => (
                <option key={y.value} value={y.value}>
                  {y.value}
                </option>
              ))}
            </Select>
          </Field>

          <Button type="submit" variant="secondary" size="sm">
            Apply
          </Button>
        </div>
      </form>

      {params.batchFrom || params.batchTo ? (
        <Link
          href={buildDirectoryHref(params, { batchFrom: null, batchTo: null })}
          className="link text-xs"
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
  if (options.length === 0) return null;

  const active = params[paramKey];
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
          <summary className="cursor-pointer list-none px-2 py-1.5 text-xs font-medium text-brand-fg marker:hidden hover:underline">
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
          'flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm',
          'transition-colors duration-fast ease-brand hover:bg-surface-sunken',
          active && 'bg-brand-soft font-semibold text-brand-soft-fg hover:bg-brand-soft',
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {active ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : null}
          <span className="truncate">{option.label}</span>
          {active ? <span className="sr-only">selected — activate to remove</span> : null}
        </span>
        <span className={cn('shrink-0 tabular text-xs', active ? 'text-brand-soft-fg' : 'text-muted')}>
          {option.count.toLocaleString('en-IN')}
        </span>
      </Link>
    </li>
  );
}
