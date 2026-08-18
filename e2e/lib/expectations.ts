/**
 * The vocabulary the route table is written in.
 *
 * Everything here is data. No Playwright import, so `fixtures/collect.ts`
 * and the probe scripts can read the same table under plain `tsx`.
 */

import type { StateFile } from './state-types';

/** The nine demo roles, plus the caller with no cookie at all. */
export const CALLERS = [
  'anon',
  'student',
  'alumni',
  'faculty',
  'hod',
  'tpo',
  'operator',
  'finance',
  'admin',
  'platform',
] as const;

export type Caller = (typeof CALLERS)[number];

/** Human labels, used in failure messages so "tpo" reads as a person. */
export const CALLER_LABEL: Record<Caller, string> = {
  anon: 'a signed-out visitor',
  student: 'a final-year student',
  alumni: 'an alumnus',
  faculty: 'a faculty member',
  hod: 'the HOD of CSE',
  tpo: 'the placement officer',
  operator: 'the alumni cell operator',
  finance: 'the finance officer',
  admin: 'the college admin',
  platform: 'the ifBash platform admin (the vendor)',
};

// ---------------------------------------------------------------
// Known-wrong register
// ---------------------------------------------------------------

/**
 * Cases where the observed status is documented as wrong.
 *
 * `docs/STATUS-CODES.md` §1 marks two rows with ⚠ and §5 spells out the
 * change each needs. Encoding the aspiration would make the suite fail on
 * a codebase that is behaving exactly as documented; silently skipping
 * them would mean nobody notices when they are fixed. So they are
 * encoded as they are *today*, tagged, and the assertion inverts: the
 * moment the real status appears, the test fails and says so.
 *
 * A third entry is not from the doc. It was found by this suite (see the
 * `why`) and is registered the same way for the same reason.
 */
export const KNOWN_WRONG = {
  'KW-CONSOLE-SCREEN': {
    shouldBe: 403,
    doc: 'docs/STATUS-CODES.md §5.1',
    why:
      'A per-screen refusal inside a console the viewer IS admitted to answers 200 with a refusal card, because ' +
      '`require()` throws an AuthzError that `src/app/(admin)/error.tsx` catches, and an error boundary that renders is a 200 by definition. ' +
      'Content is withheld correctly; only the status line lies. Fix needs `experimental.authInterrupts` + forbidden.tsx + the flush fix.',
  },
  'KW-FEATURE-FLAG': {
    shouldBe: 404,
    doc: 'docs/STATUS-CODES.md §5.2',
    why:
      'A page gated on a tenant feature flag calls notFound() correctly, but `src/app/loading.tsx` has already committed the 200, ' +
      'so the 404 is delivered inside the stream as `NEXT_HTTP_ERROR_FALLBACK;404` in the body. ' +
      'Fix is the flush fix in §5.4 — deleting the root loading.tsx was measured to turn this into a real 404.',
  },
} as const;

/**
 * Fixed, and kept here as a record rather than deleted.
 *
 * All three were found by this suite on its first full run and fixed the
 * same day. The specs that discovered them now assert the corrected
 * behaviour, so each one is a live regression test rather than a note.
 * They are listed because the *class* of each is worth recognising again:
 *
 *  - **KW-CROSS-TENANT-COOKIE** — a session minted for one college was
 *    accepted on another college's host. A signature proves a payload was
 *    not edited; it does not prove the payload belongs here. Fixed in
 *    `getSession()` by comparing the cookie's tenant against the tenant
 *    the Host header resolved to. Asserted by `tenant-isolation.spec.ts`.
 *
 *  - **KW-NOTIFICATIONS-UNSCOPED** — `getNotifications(session)` opened
 *    with `void session` and returned one static list to everybody, so
 *    the vendor's console rendered a named student's mentorship request.
 *    A function that takes a session and ignores it is worse than one
 *    that never took it. Asserted by `notifications-scope.spec.ts`.
 *
 *  - **KW-GIVING-METADATA** — a static `metadata` export runs even when
 *    the page below calls `notFound()`, so a feature-gated module still
 *    named itself in the browser tab and in a crawler's index. Anything
 *    that renders outside the guard has to be gated separately. Asserted
 *    by `giving.spec.ts`.
 */
export const FIXED_BY_THIS_SUITE = [
  'KW-CROSS-TENANT-COOKIE',
  'KW-NOTIFICATIONS-UNSCOPED',
  'KW-GIVING-METADATA',
] as const;

export type KnownWrongId = keyof typeof KNOWN_WRONG;

// ---------------------------------------------------------------
// One cell of the matrix
// ---------------------------------------------------------------

export interface Expectation {
  /** The status observed today, and asserted. */
  status: number;
  /** For a 3xx, the exact Location. A 307 to the wrong place is not a pass. */
  location?: string;
  /** Set when `status` is documented as wrong. Asserted inverted — see assertStatus(). */
  knownWrong?: KnownWrongId;
  /** Free-text note carried into the failure message. */
  note?: string;
  /**
   * Other statuses that mean the same thing for authorisation purposes.
   *
   * Used for exactly one situation: an endpoint whose rate limiter can fire
   * inside a suite run. `member.export` allows three an hour and this suite
   * spends some of them, so a `429` on the admin's export is "admitted, then
   * throttled" and not a permission change. Do not use it to paper over a
   * status that genuinely varies — every other row here is a single number
   * on purpose.
   */
  alsoAccept?: number[];
}

const n = (status: number, extra: Partial<Expectation> = {}): Expectation => ({ status, ...extra });

/** 200. The caller is admitted. */
export const OK = n(200);
/** 401 with `{error, code}` — how /api refuses a caller with no session. */
export const UNAUTHENTICATED = n(401);
/** 403 with `{error, code}` — how a route handler refuses a capability it does not hold. */
export const FORBIDDEN = n(403);
/** 404 — either the route does not exist or the record is not one this viewer may resolve. */
export const NOT_FOUND = n(404);
/**
 * 422. The caller got PAST the guard and was refused by Zod on an empty body.
 * That is a *pass* for a permission suite and a fail for anyone reading it as
 * "the endpoint is broken" — every 422 in the table means "admitted".
 */
export const ADMITTED_THEN_INVALID = n(422, { note: 'past the guard, refused by validation — this means ADMITTED' });

/** 307 to the sign-in screen, carrying the path the caller was reaching for. */
export const toLogin = (path: string): Expectation =>
  n(307, { location: `/login?next=${encodeURIComponent(path)}` });

/**
 * The same redirect, for a row whose path is only known once the fixtures
 * are loaded. `assertStatus()` swaps this for the real `?next=` against
 * the URL it actually requested — a row with a dynamic segment cannot
 * spell its own expectation, and hardcoding a slug in the table is how
 * that assertion goes stale without failing.
 */
export const DYNAMIC_LOGIN = 'DYNAMIC_LOGIN';
export const TO_LOGIN_DYNAMIC: Expectation = n(307, { location: DYNAMIC_LOGIN });
/** 307 to the portal home: signed in, but no business on this console. */
export const TO_DASHBOARD = n(307, { location: '/dashboard' });
/** 303 See Other — what `/logout` answers, so the browser re-requests with GET. */
export const seeOther = (location: string): Expectation => n(303, { location });

/** The console refusal that answers 200 today. See KW-CONSOLE-SCREEN. */
export const CONSOLE_SCREEN_REFUSAL = n(200, { knownWrong: 'KW-CONSOLE-SCREEN' });
/** The feature-flag 404 that answers 200 today. See KW-FEATURE-FLAG. */
export const FEATURE_OFF = n(200, { knownWrong: 'KW-FEATURE-FLAG' });

// ---------------------------------------------------------------
// A row of the table
// ---------------------------------------------------------------

export type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RouteRow {
  /** The URL, built from the collected fixtures so dynamic segments are real. */
  path: (ids: StateFile['ids']) => string;
  method: Method;
  /** `page` responses are HTML and follow the middleware redirect contract; `api` responses are JSON. */
  kind: 'page' | 'api';
  /**
   * What sits behind this URL, in the words a reader needs at 2am. This is
   * the sentence that turns "expected 403 got 200" into "an unverified
   * student can now list every alumnus's contact row".
   */
  holds: string;
  /** Sent as the JSON body for non-GET methods. `{}` is deliberate — see ADMITTED_THEN_INVALID. */
  body?: unknown;
  /** Per-caller expectation. `default` covers everyone not named. */
  expect: Partial<Record<Caller, Expectation>> & { default: Expectation };
}

export function expectationFor(row: RouteRow, caller: Caller): Expectation {
  return row.expect[caller] ?? row.expect.default;
}
