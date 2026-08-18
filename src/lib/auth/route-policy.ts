import { createHmac, timingSafeEqual } from 'node:crypto';
import { IS_FIXTURE } from '../config';
import { CAPABILITIES, capabilitiesFor, type Capability, type Role } from './permissions';
import { can, type MemberStatus, type Session } from './guard';

/**
 * The coarse route gate middleware runs before anything renders.
 *
 * ─────────────────────────────────────────────────────────────────────
 *  THIS IS NOT THE AUTHORISATION MODEL. DO NOT DELETE A PAGE GUARD
 *  BECAUSE A PREFIX APPEARS IN THE TABLE BELOW.
 * ─────────────────────────────────────────────────────────────────────
 *
 * It answers two coarse questions — "is there a validly signed session
 * cookie on a request to a signed-in surface?" and, on the two console
 * prefixes that declare one, "does this member hold *any* capability that
 * admits them to this console at all?" — and it exists to fix a status
 * code, not to decide who may see what. Nothing here is fine-grained:
 * which screen, which department, which record is still, entirely, the
 * page's job.
 *
 * The bug it fixes: guards live inside layouts and pages. `AppShell`
 * calls `redirect()`; feature-gated pages call `notFound()`. By the time
 * either runs, Next has already committed the response and flushed the
 * streamed shell (there is a root `src/app/loading.tsx`, so the shell and
 * its Suspense fallback go out before any of the app's own code has
 * looked at a session). The redirect still happens and the content is
 * still correctly withheld — but on the wire it is an HTTP 200 with a
 * client-side redirect stapled to the end of the stream. That breaks
 * caching, crawlers, uptime monitoring and every API client. Middleware
 * runs before rendering starts, so it can return a real status.
 *
 * ── On resolving roles here ──────────────────────────────────────────
 *
 * Roles are still **not** in the session cookie, and must never be. The
 * design rule is that they are resolved from storage on every request, so
 * that revoking an HOD takes effect on their next page load rather than
 * whenever their cookie happens to expire. This module honours that rule
 * rather than trading it away: it reads the member id out of the signed
 * cookie and the *caller* (src/middleware.ts) resolves the grants from the
 * same storage `getSession()` uses, on the same request. Same source of
 * truth, same freshness, no new trust in the cookie.
 *
 * What that does cost is a storage read, so it is charged only where it
 * buys something. A prefix pays it exactly when it carries
 * `requiresAnyCapability`, which today is `/admin` and `/platform` and
 * nothing else. `/dashboard`, `/directory` and every `/api` route ask a
 * question the cookie alone answers and read nothing extra.
 *
 * The resulting contract:
 *
 *   anonymous  → protected page       307 to /login?next=…
 *   anonymous  → protected API        401 { error, code }
 *   anyone     → public path          pass through
 *   signed in, no console capability
 *              → /admin, /platform    307 to /dashboard
 *   signed in  → everything else      pass through; the page guard decides
 *
 * Two classes are still wrong on the wire and cannot be fixed from here.
 * Per-screen refusals inside a console the viewer *is* admitted to, and
 * tenant feature gates such as `/campus-events` under a pack with
 * `publicLanding: false`, both still answer 200. See the note at the
 * bottom of this file and `docs/STATUS-CODES.md`.
 */

// ---------------------------------------------------------------
// The table
// ---------------------------------------------------------------

export interface RouteRule {
  /** Matched against the whole path or a full segment of it — never a substring. */
  prefix: string;
  requiresSession: boolean;
  /**
   * The coarse authorisation question, if this prefix has one.
   *
   * Read as *any-of*: holding one of these is enough to get past the
   * gate. It is deliberately the weakest possible test — "has this person
   * any business on this surface at all" — and never the capability a
   * particular screen needs. `/admin/roles` needs `role.manage`; the gate
   * does not know that and must not, because the moment this table starts
   * listing per-screen capabilities it becomes a second authorisation
   * model that drifts from the first one silently.
   *
   * Undefined means middleware makes no authorisation decision for the
   * prefix, which is the default and the right default. A prefix nobody
   * added here keeps the wrong status code, which is cosmetic; a prefix
   * added with too narrow a set locks a legitimate operator out of their
   * own console, which is an outage.
   */
  requiresAnyCapability?: readonly Capability[];
  /**
   * How a caller is refused.
   *
   * `redirect` for anything a browser navigates to, so the person lands
   * somewhere useful. `json` for `/api`, because an API client handed a
   * 307 to an HTML sign-in page reports "the endpoint returned garbage",
   * and a fetch() with `redirect: 'follow'` silently turns a 401 into a
   * 200 full of markup.
   *
   * The same choice covers both refusals: anonymous (401 / 307 to
   * /login) and signed-in-but-unauthorised (403 / 307 to /dashboard).
   */
  refuse: 'redirect' | 'json';
  /** Why this prefix is on this side of the line. Kept short, kept honest. */
  why: string;
}

// ---------------------------------------------------------------
// What counts as "any business in the staff console"
// ---------------------------------------------------------------

/**
 * The three roles that describe a *member* of the college rather than
 * somebody running it. Everyone signing in holds at least one of these,
 * and holding only these is what the console gate turns away.
 */
const COHORT_ROLES: readonly Role[] = ['student', 'alumni', 'faculty'];

/**
 * Every capability no ordinary member holds — derived, not typed out.
 *
 * The alternative was a hand-written list of the capabilities the console
 * screens happen to need, and that list is wrong the first afternoon
 * somebody adds a screen: a finance officer who holds only
 * `donation.reconcile` gets bounced off `/admin` by a gate that has never
 * heard of them, and the bug reads as "the console is broken for finance"
 * rather than "somebody forgot a line in route-policy.ts".
 *
 * Deriving it from `permissions.ts` — the file that is already the single
 * source of truth for who may do what — means a new staff capability
 * admits its holders automatically and a new *member* capability does
 * not. The set currently resolves to 28 capabilities and admits exactly
 * `alumni_cell_operator`, `placement_officer`, `hod`, `finance`,
 * `college_admin` and `platform_admin`; `tests/route-policy.test.ts`
 * asserts that partition so a grant that quietly hands a student a staff
 * capability fails a test rather than opening a console.
 */
export const STAFF_CONSOLE_CAPABILITIES: readonly Capability[] = (() => {
  const cohort = capabilitiesFor([...COHORT_ROLES]);
  return CAPABILITIES.filter((cap) => !cohort.has(cap));
})();

/**
 * Order here is presentational — the matcher takes the **longest**
 * matching prefix, so a specific rule always beats a general one however
 * the list is arranged. `/api` is protected wholesale and the four
 * unauthenticated endpoints are carved back out below it.
 *
 * Unmatched paths are public. That is the correct default for a gate that
 * is not the authority: a new protected route nobody added here keeps the
 * wrong status code until somebody does, which is cosmetic, whereas a
 * default-deny would 307 anonymous visitors away from any new public page
 * nobody added here, which is a broken site. The page guard is what stops
 * the leak either way.
 */
export const ROUTE_POLICY: readonly RouteRule[] = [
  // ---- Public: the marketing surface -----------------------------
  { prefix: '/', requiresSession: false, refuse: 'redirect', why: 'Landing page. Public by design.' },
  { prefix: '/about', requiresSession: false, refuse: 'redirect', why: 'Public.' },
  { prefix: '/privacy', requiresSession: false, refuse: 'redirect', why: 'The DPDP notice has to be readable before anyone signs up.' },
  { prefix: '/terms', requiresSession: false, refuse: 'redirect', why: 'Public.' },

  // ---- Public: the front door ------------------------------------
  { prefix: '/login', requiresSession: false, refuse: 'redirect', why: 'The sign-in screen. Gating it is a redirect loop.' },
  { prefix: '/verify', requiresSession: false, refuse: 'redirect', why: 'OTP entry. The code is the credential; there is no session yet.' },
  { prefix: '/claim', requiresSession: false, refuse: 'redirect', why: 'Self-registration against the degree register, by definition pre-account.' },
  { prefix: '/pending', requiresSession: false, refuse: 'redirect', why: 'The waiting room. Reachable from the claim confirmation email.' },
  { prefix: '/logout', requiresSession: false, refuse: 'redirect', why: 'Clears the cookie and 303s home. Must work with no cookie at all.' },

  // ---- Protected: the member portal, the (app) route group -------
  { prefix: '/dashboard', requiresSession: true, refuse: 'redirect', why: 'Signed-in home.' },
  { prefix: '/directory', requiresSession: true, refuse: 'redirect', why: 'The directory is never anonymous. See requireDirectoryAccess().' },
  { prefix: '/connections', requiresSession: true, refuse: 'redirect', why: 'Introductions between named members.' },
  { prefix: '/mentorship', requiresSession: true, refuse: 'redirect', why: 'Alumni who agreed to be asked — not a public list.' },
  { prefix: '/events', requiresSession: true, refuse: 'redirect', why: 'Reunions carry venue and attendee detail.' },
  { prefix: '/jobs', requiresSession: true, refuse: 'redirect', why: 'Postings name the alumnus referring.' },
  { prefix: '/news', requiresSession: true, refuse: 'redirect', why: 'College notices for members.' },
  { prefix: '/gallery', requiresSession: true, refuse: 'redirect', why: 'Photographs of identifiable students and alumni.' },
  { prefix: '/giving', requiresSession: true, refuse: 'redirect', why: 'Donations. Students never see it at all; the page enforces that.' },
  { prefix: '/profile', requiresSession: true, refuse: 'redirect', why: "The viewer's own record." },
  { prefix: '/notifications', requiresSession: true, refuse: 'redirect', why: "The viewer's own notifications." },
  { prefix: '/settings', requiresSession: true, refuse: 'redirect', why: 'Privacy, consent and the DPDP export/deletion controls.' },

  // ---- Protected: the staff consoles -----------------------------
  //
  // The only two prefixes that carry a capability requirement, and the
  // only two that cost a storage read. Both mirror a `redirect()` that
  // `AppShell` already intends to perform — this moves the decision in
  // front of the render so it can carry a status code, it does not invent
  // a new refusal.
  {
    prefix: '/admin',
    requiresSession: true,
    requiresAnyCapability: STAFF_CONSOLE_CAPABILITIES,
    refuse: 'redirect',
    why: "The college's staff console. A member with no staff capability at all has no screen in here, and today gets the whole console sidebar — every queue, register and audit link — rendered around an error card.",
  },
  {
    prefix: '/platform',
    requiresSession: true,
    requiresAnyCapability: ['tenant.provision'],
    refuse: 'redirect',
    why: "The vendor's own console, across every tenant. `tenant.provision` is platform_admin and nobody else, which is exactly what hasPlatformAccess() tests before AppShell redirects.",
  },

  // ---- API -------------------------------------------------------
  { prefix: '/api', requiresSession: true, refuse: 'json', why: 'Everything under /api needs a session unless carved out below.' },
  { prefix: '/api/health', requiresSession: false, refuse: 'json', why: 'An uptime probe cannot hold a session.' },
  { prefix: '/api/auth/otp', requiresSession: false, refuse: 'json', why: 'Requesting a sign-in code is the step before having a session.' },
  { prefix: '/api/auth/verify', requiresSession: false, refuse: 'json', why: 'Redeeming the code is what creates the session.' },
  { prefix: '/api/auth/claim', requiresSession: false, refuse: 'json', why: 'Self-registration. No account exists yet.' },
];

/** What an unmatched path resolves to. See the note on ROUTE_POLICY. */
const FALLTHROUGH: RouteRule = {
  prefix: '',
  requiresSession: false,
  refuse: 'redirect',
  why: 'No rule matched. Middleware declines to decide; the page guard is the authority.',
};

/** Longest first, so `/api/health` is consulted before `/api`. */
const RULES = [...ROUTE_POLICY].sort((a, b) => b.prefix.length - a.prefix.length);

/**
 * Files that never reach a React tree.
 *
 * The `matcher` in `src/middleware.ts` already excludes these, so this is
 * belt-and-braces — but the two are separate lists (Next requires the
 * matcher to be a statically analysable literal, so it cannot import a
 * constant), and a gate that redirected a font request to /login would be
 * a very confusing afternoon.
 */
const ASSET_PATH =
  /^\/_next\/|^\/(?:fonts|brand)\/|\.(?:svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|txt|xml|json|webmanifest|map)$/i;

export function isAssetPath(pathname: string): boolean {
  return ASSET_PATH.test(pathname);
}

/** `/admin` matches `/admin` and `/admin/members`, never `/administration`. */
function covers(prefix: string, pathname: string): boolean {
  if (prefix === '/') return pathname === '/';
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Trailing slashes are cosmetic; `/admin/` and `/admin` are one route. */
function normalise(pathname: string): string {
  if (!pathname.startsWith('/')) return `/${pathname}`;
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.replace(/\/+$/, '') || '/';
  return pathname;
}

/**
 * The rule that governs a path. Always returns something — callers never
 * have to handle "no policy", which is how a route quietly ends up
 * ungated.
 */
export function policyFor(pathname: string): RouteRule {
  const path = normalise(pathname);
  if (isAssetPath(path)) return FALLTHROUGH;
  return RULES.find((rule) => covers(rule.prefix, path)) ?? FALLTHROUGH;
}

/** Convenience for the first question middleware asks. */
export function requiresSession(pathname: string): boolean {
  return policyFor(pathname).requiresSession;
}

/**
 * The second question, and only for prefixes that declare one. Callers
 * use this to decide whether a request is worth a storage read at all.
 */
export function requiresCapability(pathname: string): readonly Capability[] | null {
  return policyFor(pathname).requiresAnyCapability ?? null;
}

// ---------------------------------------------------------------
// The coarse capability decision
// ---------------------------------------------------------------

/**
 * The absolute minimum about a member needed to answer "any business
 * here at all" — the status that decides whether they may act, and the
 * roles their grants come from.
 *
 * Deliberately not a `Session`. Middleware has no tenant id worth
 * trusting, no department scope and no business holding a value that
 * looks enough like a session for the next person to pass it to something
 * that expects one.
 */
export interface CoarseViewer {
  status: MemberStatus;
  roles: readonly Role[];
}

/**
 * True when the viewer holds at least one of `caps`.
 *
 * Delegates to `can()` rather than re-implementing it. That is the whole
 * point: the gate must agree with the page guard *exactly*, in both
 * directions. Too permissive and it is theatre; too strict and it locks
 * somebody out of a console they are entitled to, which is worse than the
 * status code it was added to fix. Re-deriving "which statuses may act"
 * here would be one refactor of `ACTIVE` in guard.ts away from doing
 * precisely that.
 *
 * The `Session` handed to `can()` is a local scaffold and never leaves
 * this function. `can()` reads `status` and `roles`; the rest is filled
 * with the values a coarse gate legitimately does not know.
 * `tests/route-policy.test.ts` asserts agreement with `can()` across the
 * entire role × capability matrix, so if `can()` grows a dependency on a
 * field this scaffold fakes, a test fails rather than a login.
 */
export function holdsAnyCapability(
  viewer: CoarseViewer,
  caps: readonly Capability[],
): boolean {
  const scaffold: Session = {
    memberId: '',
    tenantId: '',
    status: viewer.status,
    roles: viewer.roles.map((role) => ({ role, departmentId: null })),
    departmentId: null,
    batchYear: null,
  };
  return caps.some((cap) => can(scaffold, cap));
}

// ---------------------------------------------------------------
// Where to send an anonymous caller
// ---------------------------------------------------------------

/**
 * A `next` value is only ever a same-site absolute path.
 *
 * The leading-character check rejects `//evil.example` and `/\evil.example`
 * — browsers normalise the backslash, so the second is the first wearing a
 * hat, and both are protocol-relative URLs that would turn the sign-in
 * screen into a phishing relay.
 *
 * The rest is an allowlist of the characters RFC 3986 permits in a path
 * and a query, which is shorter to read than the list of things that go
 * wrong: a raw space, a control character, a `#` that silently truncates
 * the target, a quote that escapes an attribute.
 */
const SAFE_NEXT = /^\/(?![/\\])[A-Za-z0-9\-._~%!$&'()*+,;=:@\/?\[\]]*$/;
const MAX_NEXT_LENGTH = 512;

export function safeNextParam(pathname: string, search = ''): string | null {
  const raw = `${pathname}${search}`;
  if (raw.length > MAX_NEXT_LENGTH) return null;
  if (!SAFE_NEXT.test(raw)) return null;
  // Bouncing someone back to the page that bounced them is a loop.
  const path = raw.split('?')[0];
  if (path === '/login' || path === '/logout') return null;
  return raw;
}

/**
 * Where an anonymous browser goes. `next` is preserved so a WhatsApp link
 * to a specific reunion still lands on that reunion after sign-in rather
 * than dumping everyone on the dashboard — `src/app/(auth)/login/page.tsx`
 * re-sanitises it before using it, and should.
 */
export function loginRedirectPath(pathname: string, search = ''): string {
  const next = safeNextParam(pathname, search);
  return next ? `/login?next=${encodeURIComponent(next)}` : '/login';
}

/** The body an anonymous API caller gets. Same shape as `AuthzError` → `toResponse`. */
export const UNAUTHENTICATED_BODY = {
  error: 'Sign in required',
  code: 'not_authenticated',
} as const;

/**
 * The body a signed-in API caller without the capability gets. Copied
 * word for word from `AuthzError(403, 'forbidden', …)` in guard.ts, so a
 * client can never tell a middleware refusal from a handler's own.
 */
export const FORBIDDEN_BODY = {
  error: 'You do not have permission to do that',
  code: 'forbidden',
} as const;

/**
 * Where a signed-in browser goes when it has no business on a console.
 *
 * The portal home, and deliberately *not* a 403 page:
 *
 *  - It is what the app already does. `AppShell` redirects a member with
 *    no console surface to `/dashboard`; this change moves that decision
 *    in front of the render so it can carry a status, it does not invent
 *    a new refusal for people to be surprised by.
 *  - There is nowhere better to send them. `forbidden()` exists in this
 *    version of Next but is gated behind `experimental.authInterrupts`
 *    and needs a `forbidden.tsx` to render, and a middleware-synthesised
 *    403 body would be the one unbranded page on a white-label portal.
 *  - A dead end is a support ticket. Somebody who followed a stale link
 *    to `/admin/verification` lands on their own dashboard rather than on
 *    a wall.
 *
 * No `next` parameter, unlike the sign-in redirect: signing in again is
 * not what is missing, and carrying the console path forward would only
 * bounce them straight back.
 */
export const UNAUTHORISED_REDIRECT = '/dashboard';

// ---------------------------------------------------------------
// Cookie signature
// ---------------------------------------------------------------

/**
 * Verifying the session cookie without importing the session module.
 *
 * `src/lib/auth/session.ts` is `import 'server-only'` and pulls in the
 * repository and the whole fixture dataset — none of which belongs in
 * middleware, which runs on every single request. So the signature check
 * is duplicated here, exactly as `subdomainFrom()` is duplicated in
 * `src/middleware.ts` and for the same reason.
 *
 * The two must stay in step. If the cookie format, the secret or the
 * lifetime changes in session.ts, change it here as well, or every
 * signed-in request starts getting bounced to /login by a gate that
 * cannot read the cookie the app just issued.
 *
 * This reads the member id and nothing else. It does not and must not try
 * to reconstruct roles: they are not in the cookie, deliberately.
 */
const SECRET = process.env.SESSION_SECRET || (IS_FIXTURE ? 'fixture-mode-development-secret' : '');

/** Mirrors MAX_AGE in session.ts — 14 days. */
const MAX_AGE_MS = 60 * 60 * 24 * 14 * 1000;

/**
 * With no secret configured nothing can be verified honestly, so the gate
 * declines to run rather than redirecting every signed-in user to /login.
 * The app is already broken at that point — session.ts throws at import
 * outside fixture mode — and the page guards still refuse.
 */
export const CAN_VERIFY_SESSIONS = SECRET.length > 0;

interface CookiePayload {
  memberId: string;
  tenantId: string;
  issuedAt: number;
}

/**
 * Returns the member id from a validly signed, unexpired cookie, or null.
 * Never throws: this is the first thing to touch attacker-controlled
 * input on every request.
 */
export function readSessionMemberId(token: string | null | undefined): string | null {
  if (!token || !CAN_VERIFY_SESSIONS) return null;

  const [body, mac] = token.split('.');
  if (!body || !mac) return null;

  try {
    const expected = createHmac('sha256', SECRET).update(body).digest('base64url');
    // Length is checked first because timingSafeEqual throws on a mismatch,
    // and a thrown error here is a 500 on every request carrying a junk cookie.
    if (mac.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as Partial<CookiePayload>;
    if (typeof payload?.memberId !== 'string' || !payload.memberId) return null;
    if (typeof payload.issuedAt !== 'number') return null;
    if (Date.now() - payload.issuedAt > MAX_AGE_MS) return null;

    return payload.memberId;
  } catch {
    return null;
  }
}

/**
 * ── What is still wrong on the wire ───────────────────────────────────
 *
 * The console prefixes above are handled. Two classes are not, and both
 * fail for the same underlying reason, measured rather than guessed —
 * `docs/STATUS-CODES.md` has the experiment and the numbers.
 *
 * The commit point sits above every guard in the app.
 * `src/app/layout.tsx` renders `<html>` from the tenant brand alone, and
 * `src/app/loading.tsx` gives the root a Suspense boundary immediately
 * below it. React's shell is therefore complete — and the 200 committed —
 * as soon as the brand resolves, while every route-group layout and page
 * below is still awaiting. A `redirect()` or `notFound()` that lands after
 * that can only be delivered inside the stream, as a client-side
 * navigation, which is why a gated page answers 200 with
 * `NEXT_HTTP_ERROR_FALLBACK;404` sitting in its body.
 *
 *  1. **Per-screen refusals inside a console the viewer is admitted to.**
 *     An HOD on `/admin/branding` fails `require(session, 'tenant.configure')`,
 *     the `AuthzError` is caught by `src/app/(admin)/error.tsx`, and an
 *     error boundary that renders is a 200 by definition. Middleware
 *     cannot help: answering it needs a per-screen capability table here,
 *     which is a second authorisation model that drifts from the real one.
 *     The fix is `forbidden()` (needs `experimental.authInterrupts` in
 *     next.config.ts) thrown by the guard instead of a caught error, plus
 *     the flush fix below so the status can still be set.
 *
 *  2. **Tenant feature gates.** `/campus-events` under a pack with
 *     `publicLanding: false`, `/giving` with `donations: false`. These are
 *     `notFound()` calls that are correct in every way except the status.
 *     Middleware cannot answer them either: the feature flags hang off the
 *     tenant row, which in DB mode is a query — the query this file exists
 *     without — and whose `settings.packId` may not equal the subdomain,
 *     so guessing the pack from the Host header is a wrong answer rather
 *     than a fail-open.
 *
 * Both need the shell to stay uncommitted until the guard has run, which
 * means no `loading.tsx` at `src/app/` and none above the guard in the
 * route group. Removing them was measured: `/campus-events` on a pack with
 * `publicLanding: false` goes 200 → 404 immediately. The cost is the
 * streamed skeleton on cold navigation, which is a real UX loss on patchy
 * mobile data and a product decision, not a cleanup.
 */
