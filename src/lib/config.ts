/**
 * Runtime mode.
 *
 * The portal runs in one of two data modes:
 *
 *  - `db`      — Postgres with row-level security. Production, and any
 *                environment where DATABASE_URL is set.
 *  - `fixture` — an in-memory seeded dataset. No database, no migrations,
 *                no network.
 *
 * Fixture mode is not a toy. It is how the product gets demonstrated to a
 * college that has not signed anything yet, how the whole UI stays
 * reviewable while the degree register is still stuck in the examinations
 * branch, and how the permission tests run in CI without a container.
 * Every screen must render fully in it — an empty state that only appears
 * because there is no data is a screen nobody has actually designed.
 *
 * The two modes sit behind one repository interface (`src/lib/data`), so
 * no page or route handler knows which one it is talking to.
 */

export type DataMode = 'db' | 'fixture';

function readMode(): DataMode {
  const explicit = process.env.DATA_MODE?.toLowerCase();
  if (explicit === 'db' || explicit === 'fixture') return explicit;
  return process.env.DATABASE_URL ? 'db' : 'fixture';
}

export const DATA_MODE: DataMode = readMode();
export const IS_FIXTURE = DATA_MODE === 'fixture';

/** Single-tenant deployments skip subdomain routing entirely. */
export const DEFAULT_TENANT = process.env.DEFAULT_TENANT_SUBDOMAIN ?? 'diet';

export const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'alumni_session';
export const THEME_COOKIE = 'alumni_theme';

/** Minutes an OTP stays valid. */
export const OTP_TTL_SECONDS = Number(process.env.OTP_TTL_SECONDS ?? 600);
export const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);

/**
 * In fixture mode the OTP is printed to the server log and returned in the
 * response so a demo works without an email provider. Guarded hard against
 * production: leaking a login code in an API response is the kind of thing
 * that is obvious in hindsight.
 */
export const OTP_ECHO = IS_FIXTURE && process.env.NODE_ENV !== 'production';

/** Rate limits for the student → alumni valve. See CLAUDE.md. */
export const CONNECTION_LIMITS = {
  studentOpenRequests: 5,
  studentPerMonth: 10,
  alumniOpenRequests: 25,
  alumniPerMonth: 60,
} as const;

export const NOTICE_VERSION = process.env.PRIVACY_NOTICE_VERSION ?? '2026-08-01';
