import { SEED_NOW } from './data/seed';

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
 */
export function formatCompactINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount}`;
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
  const diffMs = d.getTime() - SEED_NOW.getTime();
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
  const years = SEED_NOW.getFullYear() - batchYear;
  if (years < 0) return 'graduating soon';
  if (years === 0) return 'graduated this year';
  return `${years} year${years === 1 ? '' : 's'} out`;
}
