import { SEED_NOW } from './clock';

/**
 * Formatting.
 *
 * Locale, currency and time zone come from the tenant's brand pack, so a
 * customer outside India gets their own conventions without a code
 * change. Defaults are Indian because that is who the product is for
 * today — `en-IN` grouping (1,20,000 not 120,000) is the difference
 * between a figure a registrar can read at a glance and one they have to
 * count digits on.
 */

const DEFAULTS = { locale: 'en-IN', currency: 'INR', timeZone: 'Asia/Kolkata' };

export interface FormatOpts {
  locale?: string;
  currency?: string;
  timeZone?: string;
}

export function formatNumber(n: number, opts: FormatOpts = {}): string {
  return new Intl.NumberFormat(opts.locale ?? DEFAULTS.locale).format(n);
}

export function formatCurrency(amount: number, opts: FormatOpts = {}): string {
  return new Intl.NumberFormat(opts.locale ?? DEFAULTS.locale, {
    style: 'currency',
    currency: opts.currency ?? DEFAULTS.currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Indian donation figures are quoted in lakhs and crores in every
 * conversation about them. Showing ₹14,18,500 on a progress bar is
 * correct and unreadable; showing ₹14.19 L is what the committee says
 * out loud.
 *
 * Below one lakh the full figure is shorter than any abbreviation and is
 * what people say: "₹2,000", never "₹2.0K", which is a Western unit
 * nobody quotes a gift in.
 */
export function formatCompactINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  return formatCurrency(amount);
}

export function formatDate(iso: string | Date | null | undefined, opts: FormatOpts = {}): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(opts.locale ?? DEFAULTS.locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: opts.timeZone ?? DEFAULTS.timeZone,
  }).format(d);
}

export function formatDateTime(iso: string | Date | null | undefined, opts: FormatOpts = {}): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(opts.locale ?? DEFAULTS.locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: opts.timeZone ?? DEFAULTS.timeZone,
  }).format(d);
}

export function formatTime(iso: string | Date, opts: FormatOpts = {}): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(opts.locale ?? DEFAULTS.locale, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: opts.timeZone ?? DEFAULTS.timeZone,
  }).format(d);
}

/**
 * Relative time, measured from the fixture clock rather than the wall
 * clock, so a seeded demo says "in 11 days" every time it is opened
 * instead of drifting into "3 weeks ago" a month later.
 */
export function formatRelative(iso: string | Date | null | undefined, opts: FormatOpts = {}): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';

  const rtf = new Intl.RelativeTimeFormat(opts.locale ?? DEFAULTS.locale, { numeric: 'auto' });
  const diffMs = d.getTime() - displayNow().getTime();
  const abs = Math.abs(diffMs);

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31536000000],
    ['month', 2592000000],
    ['week', 604800000],
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
  ];

  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diffMs / ms), unit);
  }
  return 'just now';
}

/** "12 Sep 2026, 10:00 AM – 4:00 PM" — one line for an event card. */
export function formatDateRange(startIso: string, endIso: string | null, opts: FormatOpts = {}): string {
  const start = new Date(startIso);
  if (!endIso) return formatDateTime(start, opts);

  const end = new Date(endIso);
  const sameDay = formatDate(start, opts) === formatDate(end, opts);

  return sameDay
    ? `${formatDate(start, opts)}, ${formatTime(start, opts)} – ${formatTime(end, opts)}`
    : `${formatDateTime(start, opts)} – ${formatDateTime(end, opts)}`;
}

/**
 * The calendar year in the tenant's time zone. Just after midnight on
 * 1 January in Vijayawada, a UTC server is still in the old year for
 * another five and a half hours; a batch list keyed on "this year" must
 * not be.
 */
export function yearIn(timeZone: string, at: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-IN', { year: 'numeric', timeZone }).format(at));
}

export function formatPercent(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** "CSE · 2017 · Hyderabad" — the one-line identity under a name. */
export function memberLine(parts: Array<string | number | null | undefined>): string {
  return parts.filter((p) => p !== null && p !== undefined && p !== '').join(' · ');
}

/**
 * Mask a contact detail that the viewer is not entitled to see.
 *
 * Showing `v•••@gmail.com` rather than hiding the row entirely tells the
 * viewer that a contact exists and that access is a permissions question,
 * not a data-quality one. That distinction stops a stream of "their email
 * is missing" support tickets about records that are perfectly complete.
 */
export function maskEmail(email: string | null): string {
  if (!email) return '—';
  const [user, domain] = email.split('@');
  if (!user || !domain) return '•••';
  return `${user.slice(0, 1)}${'•'.repeat(Math.max(3, user.length - 1))}@${domain}`;
}

export function maskMobile(mobile: string | null): string {
  if (!mobile) return '—';
  return `${mobile.slice(0, 3)} •••••${mobile.slice(-3)}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** Ordinal batch label — "Batch of 2017 · 9 years out". */
export function yearsOut(batchYear: number | null): string | null {
  if (!batchYear) return null;
  const years = yearIn(DEFAULTS.timeZone, displayNow()) - batchYear;
  if (years < 0) return 'graduating soon';
  if (years === 0) return 'graduated this year';
  return `${years} year${years === 1 ? '' : 's'} out`;
}

// ---------------------------------------------------------------
// The clock the UI reads
// ---------------------------------------------------------------

/**
 * "Now", as every screen should read it.
 *
 * The fixture clock today, so a seeded demo says "in 11 days" on every
 * visit. This is the one place to change when the portal reads the real
 * clock. Never call `new Date()` or `Date.now()` during render instead:
 * the server and the browser disagree by the time the page hydrates, and
 * the fixture data is dated against this instant, not the wall clock.
 */
export function displayNow(): Date {
  return new Date(SEED_NOW.getTime());
}

/**
 * The short name of a time zone, as a reader expects it: "IST" for
 * Asia/Kolkata. Falls back to the zone id when the runtime has no short
 * name for it, which is still better than a bare offset nobody reads.
 */
export function formatTimeZoneLabel(timeZone: string, locale: string = DEFAULTS.locale): string {
  try {
    const part = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'short' })
      .formatToParts(displayNow())
      .find((p) => p.type === 'timeZoneName');
    return part?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

/** Days since 1970-01-01 of the calendar date `d` falls on in `timeZone`. */
function calendarDay(d: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Math.round(Date.UTC(get('year'), get('month') - 1, get('day')) / 86400000);
}

/**
 * Whole calendar days from today to `iso`, in the tenant's time zone.
 * 0 is today, 1 tomorrow, -1 yesterday. Calendar days rather than 24-hour
 * spans: a deadline at 9 am tomorrow is "1 day" away at 11 pm tonight.
 */
export function daysUntil(iso: string | Date, timeZone: string = DEFAULTS.timeZone): number {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return calendarDay(d, timeZone) - calendarDay(displayNow(), timeZone);
}

/** Which heading a dated item sits under in a feed. Future dates count as today. */
export function dayBucket(iso: string | Date, timeZone: string = DEFAULTS.timeZone): 'today' | 'yesterday' | 'earlier' {
  const diff = daysUntil(iso, timeZone);
  if (diff >= 0) return 'today';
  if (diff === -1) return 'yesterday';
  return 'earlier';
}
