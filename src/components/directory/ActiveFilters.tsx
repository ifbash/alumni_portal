import Link from 'next/link';
import { X } from 'lucide-react';
import type { FacetCount } from '@/lib/data/types';
import {
  AVAILABILITY,
  activeFilterKeys,
  buildDirectoryHref,
  type DirectoryParamKey,
  type DirectoryParams,
} from './query';

/**
 * The chips under the search box.
 *
 * Two jobs. The obvious one is removing a filter in one tap. The less
 * obvious one is telling someone who opened a link they were sent what
 * that link actually selected — a URL with seven parameters in it is not
 * readable, and a result set nobody can explain is a result set nobody
 * trusts.
 *
 * Every chip is a link. Nothing here needs JavaScript to work.
 */
export function ActiveFilters({
  params,
  departments,
  className,
}: {
  params: DirectoryParams;
  /** Used to show "Computer Science & Engineering" rather than "CSE". */
  departments?: FacetCount[];
  className?: string;
}) {
  const keys = activeFilterKeys(params);
  if (keys.length === 0) return null;

  const chips: Array<{ id: string; label: string; value: string; href: string }> = [];

  for (const key of keys) {
    // The batch range is one idea, so it is one chip — clearing "2016"
    // and leaving "to 2020" in place makes no sense to anybody.
    if (key === 'batchFrom' || key === 'batchTo') continue;

    const availability = AVAILABILITY.find((a) => a.key === key);
    if (availability) {
      chips.push({
        id: key,
        label: 'Available for',
        value: availability.chip,
        href: buildDirectoryHref(params, { [key]: null }),
      });
      continue;
    }

    chips.push({
      id: key,
      label: LABELS[key] ?? key,
      value: displayValue(key, params[key]!, departments),
      href: buildDirectoryHref(params, { [key]: null }),
    });
  }

  if (params.batchFrom || params.batchTo) {
    chips.unshift({
      id: 'batch',
      label: 'Batch',
      value: batchLabel(params.batchFrom, params.batchTo),
      href: buildDirectoryHref(params, { batchFrom: null, batchTo: null }),
    });
  }

  return (
    <div className={className}>
      <ul className="flex flex-wrap items-center gap-2">
        <li className="text-xs font-semibold uppercase tracking-wide text-muted">Filtered by</li>

        {chips.map((chip) => (
          <li key={chip.id}>
            <Link
              href={chip.href}
              aria-label={`Remove filter: ${chip.label} ${chip.value}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-raised py-1 pl-2.5 pr-1.5 text-xs font-medium transition-colors duration-fast ease-brand hover:border-line-strong hover:bg-surface-sunken"
            >
              <span className="text-muted">{chip.label}</span>
              <span className="max-w-40 truncate text-primary">{chip.value}</span>
              <X className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
            </Link>
          </li>
        ))}

        {chips.length > 1 ? (
          <li>
            <Link
              href={buildDirectoryHref({}, { q: params.q ?? null, sort: params.sort ?? null })}
              className="link text-xs font-medium"
            >
              Clear {chips.length} filters
            </Link>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

const LABELS: Partial<Record<DirectoryParamKey, string>> = {
  department: 'Branch',
  company: 'Company',
  city: 'City',
  country: 'Country',
  industry: 'Industry',
  skill: 'Skill',
  cohort: 'Showing',
};

const COHORT_LABELS: Record<string, string> = {
  alumni: 'Alumni only',
  students: 'Final years only',
  all: 'Everyone',
};

function displayValue(
  key: DirectoryParamKey,
  value: string,
  departments?: FacetCount[],
): string {
  if (key === 'cohort') return COHORT_LABELS[value] ?? value;
  if (key === 'department') {
    return departments?.find((d) => d.value === value)?.label ?? value;
  }
  if (key === 'country') return COUNTRY_LABELS[value] ?? value;
  return value;
}

/** Only the countries the seeded alumni actually live in need a name. */
const COUNTRY_LABELS: Record<string, string> = {
  IN: 'India',
  US: 'United States',
  CA: 'Canada',
  AE: 'United Arab Emirates',
  SG: 'Singapore',
  GB: 'United Kingdom',
  DE: 'Germany',
  AU: 'Australia',
  IE: 'Ireland',
  CH: 'Switzerland',
  QA: 'Qatar',
};

function batchLabel(from: string | undefined, to: string | undefined): string {
  if (from && to) return from === to ? from : `${from} – ${to}`;
  if (from) return `${from} onwards`;
  return `up to ${to}`;
}
