import type { DirectoryQuery } from '@/lib/data/types';

/**
 * Directory state lives entirely in the query string.
 *
 * Not a preference. A filtered search is the thing people actually send
 * each other — "here are the 2016 CSE people at Infosys who said they
 * would refer" is a WhatsApp message with a link in it, and a link that
 * reproduces a different result set on the recipient's screen is worse
 * than no link at all. So every control on the page is a link or a GET
 * form, nothing is held in component state, and pagination carries the
 * whole set forward.
 *
 * Everything here is pure and shared by the server page, the server-side
 * filter panel and the one client component, which is why it is a plain
 * module rather than a hook.
 */

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Order is fixed so the same search always produces the same URL. */
export const DIRECTORY_PARAM_KEYS = [
  'q',
  'cohort',
  'department',
  'batchFrom',
  'batchTo',
  'company',
  'city',
  'country',
  'industry',
  'skill',
  'mentoring',
  'referrals',
  'speaking',
  'sort',
  'page',
] as const;

export type DirectoryParamKey = (typeof DIRECTORY_PARAM_KEYS)[number];
export type DirectoryParams = Partial<Record<DirectoryParamKey, string>>;

export const DIRECTORY_PATH = '/directory';

export const SORTS = [
  { value: 'relevance', label: 'Best match' },
  { value: 'recent', label: 'Recently active' },
  { value: 'batch', label: 'Newest batch' },
  { value: 'name', label: 'Name' },
] as const;

export const COHORTS = [
  { value: 'all', label: 'Everyone' },
  { value: 'alumni', label: 'Alumni' },
  { value: 'students', label: 'Final years' },
] as const;

/** The filters a chip can remove and the empty state can offer to drop. */
export const AVAILABILITY = [
  { key: 'mentoring', label: 'Open to mentoring', chip: 'Mentoring' },
  { key: 'referrals', label: 'Open to referrals', chip: 'Referrals' },
  { key: 'speaking', label: 'Open to speaking', chip: 'Speaking' },
] as const satisfies ReadonlyArray<{ key: DirectoryParamKey; label: string; chip: string }>;

const SORT_VALUES = new Set(SORTS.map((s) => s.value as string));
const COHORT_VALUES = new Set(COHORTS.map((c) => c.value as string));

/**
 * Read the URL into a normalised bag of strings.
 *
 * Anything unrecognised is dropped rather than passed through: a query
 * string is user input like any other, and it reaches a repository call.
 */
export function readDirectoryParams(raw: RawSearchParams): DirectoryParams {
  const one = (key: string): string | undefined => {
    const value = raw[key];
    const first = Array.isArray(value) ? value[0] : value;
    const trimmed = typeof first === 'string' ? first.trim() : '';
    return trimmed === '' ? undefined : trimmed;
  };

  const out: DirectoryParams = {};

  const q = one('q');
  if (q) out.q = q.slice(0, 120);

  for (const key of ['department', 'company', 'city', 'country', 'industry', 'skill'] as const) {
    const value = one(key);
    if (value) out[key] = value.slice(0, 80);
  }

  for (const { key } of AVAILABILITY) {
    if (one(key) === '1') out[key] = '1';
  }

  const cohort = one('cohort');
  if (cohort && COHORT_VALUES.has(cohort)) out.cohort = cohort;

  const sort = one('sort');
  if (sort && SORT_VALUES.has(sort)) out.sort = sort;

  const from = year(one('batchFrom'));
  const to = year(one('batchTo'));
  // A range typed backwards — or pasted from a link someone edited by
  // hand — is a range, not an error. Swapping beats returning nothing.
  if (from && to && from > to) {
    out.batchFrom = String(to);
    out.batchTo = String(from);
  } else {
    if (from) out.batchFrom = String(from);
    if (to) out.batchTo = String(to);
  }

  const page = Number(one('page'));
  if (Number.isInteger(page) && page > 1) out.page = String(Math.min(page, 9999));

  return out;
}

function year(value: string | undefined): number | null {
  if (!value || !/^\d{4}$/.test(value)) return null;
  const n = Number(value);
  return n >= 1950 && n <= 2100 ? n : null;
}

/** The shape `searchDirectory` takes. */
export function toDirectoryQuery(params: DirectoryParams): DirectoryQuery {
  return {
    q: params.q,
    department: params.department,
    batchFrom: params.batchFrom ? Number(params.batchFrom) : undefined,
    batchTo: params.batchTo ? Number(params.batchTo) : undefined,
    company: params.company,
    city: params.city,
    country: params.country,
    industry: params.industry,
    skill: params.skill,
    mentoring: params.mentoring === '1' || undefined,
    referrals: params.referrals === '1' || undefined,
    speaking: params.speaking === '1' || undefined,
    cohort: params.cohort as DirectoryQuery['cohort'],
    sort: params.sort as DirectoryQuery['sort'],
    page: params.page ? Number(params.page) : 1,
  };
}

/**
 * Build a directory URL from the current params plus a patch.
 *
 * `null` removes a key. Changing anything other than the page resets to
 * page one — landing on page 6 of a result set that now has two pages is
 * the classic way a faceted search appears to return nothing.
 */
export function buildDirectoryHref(
  params: DirectoryParams,
  patch: Partial<Record<DirectoryParamKey, string | null>> = {},
  basePath: string = DIRECTORY_PATH,
): string {
  const next: DirectoryParams = { ...params };

  for (const [key, value] of Object.entries(patch) as Array<[DirectoryParamKey, string | null]>) {
    if (value === null || value === '') delete next[key];
    else next[key] = value;
  }

  if (!('page' in patch)) delete next.page;

  const search = new URLSearchParams();
  for (const key of DIRECTORY_PARAM_KEYS) {
    const value = next[key];
    if (value) search.set(key, value);
  }

  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Set a value, or clear it when it is already the active one. */
export function toggleDirectoryHref(
  params: DirectoryParams,
  key: DirectoryParamKey,
  value: string,
): string {
  return buildDirectoryHref(params, { [key]: params[key] === value ? null : value });
}

/** Everything that narrows the result set, excluding the free-text box. */
export function activeFilterKeys(params: DirectoryParams): DirectoryParamKey[] {
  return DIRECTORY_PARAM_KEYS.filter((key) => {
    if (key === 'q' || key === 'sort' || key === 'page') return false;
    // `cohort=all` is the default view, not a narrowing.
    if (key === 'cohort') return params.cohort === 'alumni' || params.cohort === 'students';
    return Boolean(params[key]);
  });
}

/**
 * How many filters a person would say are on.
 *
 * A batch range is two parameters and one idea, and a badge reading "4"
 * next to three chips is the kind of small lie that makes people stop
 * believing the rest of the screen.
 */
export function countFilters(params: DirectoryParams): number {
  const keys = activeFilterKeys(params);
  const rangeCountedTwice = keys.includes('batchFrom') && keys.includes('batchTo');
  return rangeCountedTwice ? keys.length - 1 : keys.length;
}
