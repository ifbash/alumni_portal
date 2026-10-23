import { CAPABILITIES, capabilitiesFor, type Capability, type Role } from './permissions';
import { can, type MemberStatus, type Session } from './guard';
import { canVerifySessions, decodeSessionToken } from './session-token';

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
 * buys something. A prefix pays it exactly when `needsViewer()` says so:
 * when it carries `requiresAnyCapability` (`/admin`, `/platform`) or
 * `refuseVendorOnly` (the member-community surfaces and their API twins —
 * see "The vendor" below). `/profile`, `/settings`, `/api/auth/me` and
 * every other `/api` route ask a question the cookie alone answers and
 * read nothing extra.
 *
 * The resulting contract:
 *
 *   anonymous  → protected page       307 to /login?next=…
 *   anonymous  → protected API        401 { error, code }
 *   anyone     → public path          pass through
 *   signed in, no console capability
 *              → /admin, /platform    307 to /dashboard
 *   signed in, vendor only
 *              → member community     307 to /platform   (403 on its /api twin)
 *   signed in  → everything else      pass through; the page guard decides
 *
 * ── The vendor ───────────────────────────────────────────────────────
 *
 * CLAUDE.md: "The vendor cannot read customer data." A session whose
 * *only* role is `platform_admin` is ifBash's operator, not a member of
 * the college, and it has no business on the college's community
 * surfaces at all. It was reaching them anyway: `/jobs`, `/news` and
 * `/gallery` check a session and a feature flag and nothing else, so the
 * vendor was served job postings naming the alumni who posted them, an
 * obituary, and contributor names under photographs — and `GET /api/jobs`
 * served the same postings as JSON. Those pages ask no capability because
 * "any signed-in member" is the right bar for a member; the vendor is not
 * one, and no capability expresses that.
 *
 * So this is the one place the gate makes a decision that is not a status
 * code, and it is worth being plain about it. For `/jobs`, `/news` and
 * `/gallery` there is, today, no page-side refusal behind it: this rule is
 * the enforcement, not a pre-filter in front of one. It belongs here and
 * not in the pages because it is an *identity* question ("is this caller
 * a member of this college at all?") that is the same for every surface,
 * decided once, before anything reads the repository. It should still be
 * mirrored page-side (an `AppShell` redirect for the `member` variant, the
 * way `/admin` is mirrored) when the redesign lands, so that the pair is
 * defence in depth like every other refusal here.
 *
 * The storage-read trade-off, stated rather than hidden: before this rule
 * only staff-console traffic paid a member lookup. Now every request to a
 * member-community prefix does too — most of the portal's page traffic.
 * The alternatives were worse. Roles in the cookie is ruled out above.
 * A "this is the vendor" flag in the cookie is the same mistake smaller:
 * it is minted at sign-in, so granting an ifBash employee a college role
 * (or taking the vendor role away) would not take effect until their
 * cookie aged out. Keeping the refusal page-side only was not available
 * without editing every page, and would still answer 200 on the wire.
 * The read is the same primary-key lookup `getSession()` makes on the
 * very same request, the page behind it goes on to make a dozen more, and
 * the mitigation when Postgres lands is the one already written down for
 * the console prefixes (a short-TTL role cache keyed on member id, or a
 * `roles_version` column) — not narrowing the rule. `/profile` and
 * `/settings` are deliberately left off it, so the vendor's own record,
 * sign-out and session security cost nothing and stay reachable.
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
   * Refuse a caller whose only role is the vendor's (`isVendorOnly()`).
   *
   * Set on the college's member-community surfaces and their `/api`
   * twins — the places that show members to members. Refused browsers go
   * to the vendor's own console (`vendorRefusalPath()`); refused API
   * callers get the same 403 body as any other refusal.
   *
   * It is a flag on the row rather than a list in middleware for the
   * same reason `requiresAnyCapability` is: the table is the one place
   * anybody reviews to learn what a prefix costs and whom it turns away.
   * Setting it also makes the prefix pay a member lookup; see the note at
   * the top of this file for why that is paid rather than avoided.
   */
  refuseVendorOnly?: boolean;
  /**
   * How a caller is refused.
   *
   * `redirect` for anything a browser navigates to, so the person lands
   * somewhere useful. `json` for `/api`, because an API client handed a
   * 307 to an HTML sign-in page reports "the endpoint returned garbage",
   * and a fetch() with `redirect: 'follow'` silently turns a 401 into a
   * 200 full of markup.
   *
   * The same choice covers every refusal: anonymous (401 / 307 to
   * /login), signed-in-but-unauthorised (403 / 307 to /dashboard) and
   * vendor-only (403 / 307 to /platform).
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
  {
    prefix: '/p',
    requiresSession: false,
    refuse: 'redirect',
    why: "Pages the college edits itself. A page marked members-only checks the session itself and sends an anonymous visitor to sign in; a public page (About, a director's message) is readable by anyone.",
  },

  // ---- Public: the front door ------------------------------------
  { prefix: '/login', requiresSession: false, refuse: 'redirect', why: 'The sign-in screen. Gating it is a redirect loop.' },
  { prefix: '/verify', requiresSession: false, refuse: 'redirect', why: 'OTP entry. The code is the credential; there is no session yet.' },
  { prefix: '/claim', requiresSession: false, refuse: 'redirect', why: 'Self-registration against the degree register, by definition pre-account.' },
  { prefix: '/pending', requiresSession: false, refuse: 'redirect', why: 'The waiting room. Reachable from the claim confirmation email.' },
  { prefix: '/logout', requiresSession: false, refuse: 'redirect', why: 'Clears the cookie and 303s home. Must work with no cookie at all.' },

  // ---- Protected: the member portal, the (app) route group -------
  //
  // Every row here but two carries `refuseVendorOnly`: these are the
  // college's community surfaces, and a caller whose only role is
  // `platform_admin` is not a member of the college. The two exceptions
  // are the account itself. `/profile` is the vendor's own record, and
  // `/settings` is where sign-out, session security and the DPDP controls
  // over that record live — refusing them would leave a vendor account
  // unable to sign itself out or see its own sessions, and neither shows
  // anybody else. They are also where `vendorRefusalPath()` sends a vendor
  // account that cannot use `/platform` either, so they must stay open to
  // it or that path loops.
  { prefix: '/dashboard', requiresSession: true, refuseVendorOnly: true, refuse: 'redirect', why: "Signed-in home: the viewer's connections, the batch, what the college is running." },
  { prefix: '/directory', requiresSession: true, refuseVendorOnly: true, refuse: 'redirect', why: 'The directory is never anonymous. See requireDirectoryAccess().' },
  { prefix: '/connections', requiresSession: true, refuseVendorOnly: true, refuse: 'redirect', why: 'Introductions between named members.' },
  { prefix: '/mentorship', requiresSession: true, refuseVendorOnly: true, refuse: 'redirect', why: 'Alumni who agreed to be asked — not a public list.' },
  { prefix: '/events', requiresSession: true, refuseVendorOnly: true, refuse: 'redirect', why: 'Reunions carry venue and attendee detail.' },
  { prefix: '/jobs', requiresSession: true, refuseVendorOnly: true, refuse: 'redirect', why: 'Postings name the alumnus referring.' },
  { prefix: '/news', requiresSession: true, refuseVendorOnly: true, refuse: 'redirect', why: 'College notices for members, including obituaries and named achievements.' },
  { prefix: '/gallery', requiresSession: true, refuseVendorOnly: true, refuse: 'redirect', why: 'Photographs of identifiable students and alumni, credited to named contributors.' },
  { prefix: '/giving', requiresSession: true, refuseVendorOnly: true, refuse: 'redirect', why: 'Donations. Students never see it at all; the page enforces that.' },
  { prefix: '/notifications', requiresSession: true, refuseVendorOnly: true, refuse: 'redirect', why: 'Member-to-member notifications — requests and replies that name the sender.' },
  { prefix: '/groups', requiresSession: true, refuseVendorOnly: true, refuse: 'redirect', why: 'Chapters and interest groups list their members and carry their own noticeboard.' },
  { prefix: '/community', requiresSession: true, refuseVendorOnly: true, refuse: 'redirect', why: 'The feed: posts by named alumni, some written inside a group.' },
  { prefix: '/businesses', requiresSession: true, refuseVendorOnly: true, refuse: 'redirect', why: "Alumni businesses, each naming its owner and, with the owner's say-so, a way to reach them." },
  { prefix: '/showcase', requiresSession: true, refuseVendorOnly: true, refuse: 'redirect', why: 'Prominent alumni, achievements and success stories — named people and their work.' },
  { prefix: '/help', requiresSession: true, refuseVendorOnly: true, refuse: 'redirect', why: "The help desk. A member's own tickets describe their own account, and the vendor reads none of them." },
  { prefix: '/invite', requiresSession: true, refuseVendorOnly: true, refuse: 'redirect', why: "Inviting batchmates by name and address — a list of people who have not agreed to anything yet." },
  { prefix: '/profile', requiresSession: true, refuse: 'redirect', why: "The viewer's own record. Open to the vendor: it is theirs, and shows nobody else." },
  { prefix: '/settings', requiresSession: true, refuse: 'redirect', why: 'Privacy, consent, sign-out and the DPDP export/deletion controls. Open to the vendor for the same reason as /profile.' },

  // ---- Protected: the staff consoles -----------------------------
  //
  // The only two prefixes that carry a capability requirement, and — with
  // the `refuseVendorOnly` rows — the only ones that cost a storage read.
  // Both mirror a `redirect()` that
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

  // ---- API: the member community's JSON twins --------------------
  //
  // The same refusal as the pages above, for the handlers that serve the
  // same content. `GET /api/jobs` answered the vendor 200 with every
  // posting and its poster's name; the rest answered 403 or 404 from
  // their own guards, but only by the accident of which capability each
  // happened to check first. Deliberately NOT here: `/api/auth/me`,
  // `/api/profile`, `/api/settings` and `/api/data-requests` (the account
  // itself, as `/profile` and `/settings` above), and `/api/admin` and
  // `/api/platform`, whose handlers `require()` exactly the capability the
  // vendor does or does not hold.
  //
  // `/api/news` and `/api/gallery` have no handler yet. They are ruled
  // now so the first one written inherits the refusal, rather than
  // repeating `/api/jobs` — a read handler that checks a session and a
  // feature flag, because "any signed-in member" is the right bar for a
  // member.
  { prefix: '/api/directory', requiresSession: true, refuseVendorOnly: true, refuse: 'json', why: 'The directory as JSON. The handler refuses the vendor too; this refuses first.' },
  { prefix: '/api/members', requiresSession: true, refuseVendorOnly: true, refuse: 'json', why: "One member's profile as JSON." },
  { prefix: '/api/connections', requiresSession: true, refuseVendorOnly: true, refuse: 'json', why: 'Introductions between named members; also backs /mentorship.' },
  { prefix: '/api/events', requiresSession: true, refuseVendorOnly: true, refuse: 'json', why: 'Registrations, tickets and door check-in.' },
  { prefix: '/api/jobs', requiresSession: true, refuseVendorOnly: true, refuse: 'json', why: 'The jobs board as JSON — postings name the alumnus referring.' },
  { prefix: '/api/news', requiresSession: true, refuseVendorOnly: true, refuse: 'json', why: 'No handler yet. Ruled so the first one is born refusing the vendor.' },
  { prefix: '/api/gallery', requiresSession: true, refuseVendorOnly: true, refuse: 'json', why: 'No handler yet. Ruled so the first one is born refusing the vendor.' },
  { prefix: '/api/donations', requiresSession: true, refuseVendorOnly: true, refuse: 'json', why: "The /giving module's handler." },
  { prefix: '/api/notifications', requiresSession: true, refuseVendorOnly: true, refuse: 'json', why: 'Member-to-member notifications as JSON.' },
  { prefix: '/api/groups', requiresSession: true, refuseVendorOnly: true, refuse: 'json', why: 'Joining and leaving groups, and what is posted inside them.' },
  { prefix: '/api/posts', requiresSession: true, refuseVendorOnly: true, refuse: 'json', why: 'The community feed as JSON.' },
  { prefix: '/api/businesses', requiresSession: true, refuseVendorOnly: true, refuse: 'json', why: 'The business directory as JSON.' },
  { prefix: '/api/showcase', requiresSession: true, refuseVendorOnly: true, refuse: 'json', why: 'Achievement submissions as JSON.' },
  { prefix: '/api/helpdesk', requiresSession: true, refuseVendorOnly: true, refuse: 'json', why: "A member's own tickets as JSON." },
  { prefix: '/api/feedback', requiresSession: true, refuseVendorOnly: true, refuse: 'json', why: 'The feedback button. Filed as a help-desk ticket, which the vendor does not read.' },
  { prefix: '/api/invitations', requiresSession: true, refuseVendorOnly: true, refuse: 'json', why: 'Invitations by address.' },
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
 * The second question, and only for prefixes that declare one. Whether a
 * request is worth a storage read at all is `needsViewer()`, which also
 * counts `refuseVendorOnly`.
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
// The vendor
// ---------------------------------------------------------------

/**
 * The one role that describes the vendor rather than anybody at the
 * college. `tests/route-policy.test.ts` pins that it is also the only
 * role holding `tenant.provision`, so this and the `/platform` gate
 * cannot come apart.
 */
export const VENDOR_ROLE: Role = 'platform_admin';

/**
 * True when every role the viewer holds is the vendor's.
 *
 * Asked of roles, not capabilities, and that is deliberate — this is the
 * one question in the file that is about *who* somebody is rather than
 * what they may do:
 *
 *  - The surfaces it guards require no capability. `/jobs`, `/news` and
 *    `/gallery` are open to "any signed-in member", which is correct for
 *    a member; the vendor is simply not one. There is no capability whose
 *    absence means "not of this college", and minting one would put a
 *    grant on every cohort role to express what the role list already
 *    says.
 *  - A capability reading — "holds nothing a member holds" — would also
 *    turn away a finance officer, who holds only `donation.*` and
 *    `audit.read` but is the college's own employee. Whether finance
 *    belongs on `/jobs` is a real question, and a different one, and it
 *    must not be answered by accident here.
 *
 * Holding any second role means the answer is no. An ifBash engineer who
 * is also a DIET alumnus holds `alumni` because the college granted it,
 * and is on `/jobs` as an alumnus; the vendor grant adds nothing there.
 * A member with no roles at all (pending verification) is not the vendor
 * either — what they may see is the page's question, as before.
 *
 * Status is ignored on purpose. A suspended vendor account is still not
 * a member of the college, and refusing is the safe direction to be
 * wrong in; `vendorRefusalPath()` handles where such an account goes.
 */
export function isVendorOnly(viewer: CoarseViewer): boolean {
  return viewer.roles.length > 0 && viewer.roles.every((role) => role === VENDOR_ROLE);
}

/** Where a vendor-only browser goes from a member surface: their own console. */
export const VENDOR_REDIRECT = '/platform';

/**
 * Where it goes when it cannot use its own console either.
 *
 * `/platform` refuses a caller without an *active* `tenant.provision`
 * grant by sending them to `/dashboard`, and `/dashboard` refuses the
 * vendor by sending them to `/platform`. For a suspended vendor account
 * that is a redirect loop, which a browser follows twenty times and then
 * shows as an error. `/settings` is the account's own page — sign-out
 * and sessions — and is deliberately not a vendor-refusing prefix, so the
 * chain stops there. `tests/route-policy.test.ts` walks every chain to
 * prove it.
 */
export const VENDOR_FALLBACK_REDIRECT = '/settings';

export function vendorRefusalPath(viewer: CoarseViewer): string {
  const platform = requiresCapability(VENDOR_REDIRECT);
  if (platform && holdsAnyCapability(viewer, platform)) return VENDOR_REDIRECT;
  return VENDOR_FALLBACK_REDIRECT;
}

// ---------------------------------------------------------------
// The whole signed-in decision
// ---------------------------------------------------------------

/**
 * Whether middleware has to resolve the member at all for this rule —
 * the storage read. Everything else the gate asks, the cookie answers.
 *
 * An empty `requiresAnyCapability` counts as no rule, as it always has.
 */
export function needsViewer(rule: RouteRule): boolean {
  return rule.refuseVendorOnly === true || (rule.requiresAnyCapability?.length ?? 0) > 0;
}

export type CoarseVerdict =
  | { admit: true }
  /** `redirectTo` is for a browser; a `json` rule answers 403 FORBIDDEN_BODY instead. */
  | { admit: false; redirectTo: string };

/**
 * The signed-in half of the gate, as a pure function, so the tests can
 * walk every redirect chain rather than trusting middleware to be right.
 *
 * The vendor check runs first. On today's table no prefix carries both
 * flags, but if one ever did, the vendor refusal is the one with the more
 * useful destination.
 */
export function coarseVerdict(rule: RouteRule, viewer: CoarseViewer): CoarseVerdict {
  if (rule.refuseVendorOnly && isVendorOnly(viewer)) {
    return { admit: false, redirectTo: vendorRefusalPath(viewer) };
  }
  const caps = rule.requiresAnyCapability;
  if (caps && caps.length > 0 && !holdsAnyCapability(viewer, caps)) {
    return { admit: false, redirectTo: UNAUTHORISED_REDIRECT };
  }
  return { admit: true };
}

// ---------------------------------------------------------------
// Cookie signature
// ---------------------------------------------------------------

/**
 * Verifying the session cookie without importing the session module.
 *
 * `src/lib/auth/session.ts` is `import 'server-only'` and pulls in the
 * repository and the whole fixture dataset — none of which belongs in
 * middleware, which runs on every single request. So the cookie format and
 * the secret live in `session-token.ts`, a pure module both import; there
 * is no second copy to keep in step.
 *
 * This reads the member id and nothing else. It does not and must not try
 * to reconstruct roles: they are not in the cookie, deliberately.
 */

/**
 * With no usable secret nothing can be verified honestly, so the gate
 * declines to run rather than redirecting every signed-in user to /login.
 * The app is already broken at that point — session.ts throws at import —
 * and the page guards still refuse.
 */
export const CAN_VERIFY_SESSIONS = canVerifySessions();

/**
 * Returns the member id from a validly signed, unexpired cookie, or null.
 * Never throws: this is the first thing to touch attacker-controlled
 * input on every request.
 */
export function readSessionMemberId(token: string | null | undefined): string | null {
  if (!CAN_VERIFY_SESSIONS) return null;
  return decodeSessionToken(token)?.memberId ?? null;
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
