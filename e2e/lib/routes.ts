import {
  ADMITTED_THEN_INVALID,
  CONSOLE_SCREEN_REFUSAL,
  FEATURE_OFF,
  FORBIDDEN,
  NOT_FOUND,
  OK,
  TO_DASHBOARD,
  TO_LOGIN_DYNAMIC,
  UNAUTHENTICATED,
  seeOther,
  toLogin,
  type Caller,
  type Expectation,
  type Method,
  type RouteRow,
} from './expectations';
import type { StateFile } from './state-types';

/**
 * THE TABLE.
 *
 * Every route in the app, once, with what it holds and what each of the
 * nine demo roles gets when they ask for it. Adding a route is one line
 * here; adding a role is one entry in `CALLERS` plus one cookie in
 * `fixtures/collect.ts`. Nothing below generates a test function — the
 * spec files iterate this array.
 *
 * ── The statuses are measured, not designed ──────────────────────────
 *
 * Every number here was observed against a production build of this
 * repository before it was written down. Where the observed status
 * disagrees with `docs/STATUS-CODES.md`, the observed one is recorded and
 * tagged with a `KNOWN_WRONG` id, which makes the assertion invert: the
 * test fails on the day the case is *fixed*, and the message says so.
 * Writing the aspiration here instead would produce a suite that is red
 * against a codebase behaving exactly as documented, which is a suite
 * nobody runs.
 *
 * ── Reading a 422 ────────────────────────────────────────────────────
 *
 * Mutation endpoints are probed with an empty JSON body, because every
 * one of them guards before it validates. A 403 therefore means refused
 * and a 422 means **admitted** — Zod got its turn. That distinction is
 * the whole signal for POST/PATCH routes, and `ADMITTED_THEN_INVALID`
 * carries it into the failure message so nobody reads a green 422 as a
 * broken endpoint.
 */

// ---------------------------------------------------------------
// Builders — one per shape of route, so a row stays one line
// ---------------------------------------------------------------

type Ids = StateFile['ids'];
type Overrides = Partial<Record<Caller, Expectation>>;

/** The three roles that describe a member of the college rather than staff. */
const COHORT: Caller[] = ['student', 'alumni', 'faculty'];
/** The six the console gate admits. Mirrors STATUS-CODES.md §2. */
const STAFF: Caller[] = ['hod', 'tpo', 'operator', 'finance', 'admin', 'platform'];

function fill(callers: Caller[], value: Expectation): Overrides {
  return Object.fromEntries(callers.map((c) => [c, value])) as Overrides;
}

/** Reachable by anyone, signed in or not. */
function publicPage(path: string, holds: string, overrides: Overrides = {}): RouteRow {
  return { path: () => path, method: 'GET', kind: 'page', holds, expect: { default: OK, ...overrides } };
}

/** Signed-in members only. The middleware gate bounces anonymous callers to sign in. */
function memberPage(path: string, holds: string, overrides: Overrides = {}): RouteRow {
  return {
    path: () => path,
    method: 'GET',
    kind: 'page',
    holds,
    expect: { default: OK, anon: toLogin(path), ...overrides },
  };
}

/** Same, with a dynamic segment filled from the fixtures. */
function memberPageAt(build: (ids: Ids) => string, holds: string, overrides: Overrides = {}): RouteRow {
  return {
    path: build,
    method: 'GET',
    kind: 'page',
    holds,
    // `toLogin` needs the resolved path, which only exists once the fixtures
    // are loaded — `assertStatus()` fills it in against the URL it requested.
    expect: { default: OK, anon: TO_LOGIN_DYNAMIC, ...overrides },
  };
}

/**
 * A staff console screen.
 *
 * `holders` is the set of demo roles that hold the capability the screen
 * guards on. They get a real 200. Every other staff role is admitted
 * through the coarse gate and refused by the page — which today answers
 * 200 with the console shell and no content, tagged KW-CONSOLE-SCREEN.
 * The three cohort roles never get past the gate.
 */
function consolePage(
  build: string | ((ids: Ids) => string),
  holds: string,
  holders: Caller[],
  overrides: Overrides = {},
): RouteRow {
  const path = typeof build === 'string' ? () => build : build;
  const refused = STAFF.filter((c) => !holders.includes(c));
  return {
    path,
    method: 'GET',
    kind: 'page',
    holds,
    expect: {
      default: OK,
      anon: typeof build === 'string' ? toLogin(build) : TO_LOGIN_DYNAMIC,
      ...fill(COHORT, TO_DASHBOARD),
      ...fill(holders, OK),
      ...fill(refused, CONSOLE_SCREEN_REFUSAL),
      ...overrides,
    },
  };
}

/** The vendor's own console. `tenant.provision` is platform_admin and nobody else. */
function platformPage(build: string | ((ids: Ids) => string), holds: string): RouteRow {
  const path = typeof build === 'string' ? () => build : build;
  return {
    path,
    method: 'GET',
    kind: 'page',
    holds,
    expect: {
      default: TO_DASHBOARD,
      anon: typeof build === 'string' ? toLogin(build) : TO_LOGIN_DYNAMIC,
      platform: OK,
    },
  };
}

/** Everything under /api. Anonymous gets 401 JSON, never a redirect to HTML. */
function api(
  method: Method,
  build: string | ((ids: Ids) => string),
  holds: string,
  expect: Partial<Record<Caller, Expectation>> & { default: Expectation },
  body?: unknown,
): RouteRow {
  const path = typeof build === 'string' ? () => build : build;
  return {
    path,
    method,
    kind: 'api',
    holds,
    body,
    expect: { anon: UNAUTHENTICATED, ...expect },
  };
}

// ---------------------------------------------------------------
// The rows
// ---------------------------------------------------------------

export const ROUTES: RouteRow[] = [
  // ---- Marketing: public by design -------------------------------
  publicPage('/', 'the landing page — aggregate register counts, no member row'),
  publicPage('/about', 'the about page'),
  publicPage('/contact', 'the contact page'),
  publicPage('/privacy', 'the DPDP notice, which has to be readable before anyone signs up'),
  publicPage('/terms', 'the terms page'),
  publicPage('/campus-events', "the public events listing, gated on the tenant's publicLanding flag"),

  // ---- The front door --------------------------------------------
  publicPage('/login', 'the sign-in screen and, in fixture mode, the nine demo addresses'),
  publicPage('/verify', 'the OTP entry screen'),
  publicPage('/claim', 'self-registration against the degree register'),
  publicPage('/pending', 'the waiting room after a claim'),
  {
    path: () => '/logout',
    method: 'GET',
    kind: 'page',
    holds: 'the sign-out route — clears the cookie and sends the caller home',
    // 303, not 307: the browser must re-request the landing page with GET
    // rather than replaying whatever verb got it here. It must also work with
    // no cookie at all, which is why every caller including `anon` sees it.
    expect: { default: seeOther('/') },
  },

  // ---- The member portal -----------------------------------------
  memberPage('/dashboard', "the signed-in home: the viewer's own counts and notifications"),
  memberPage(
    '/welcome',
    'the post-verification welcome screen. NOTE: no /welcome prefix exists in ROUTE_POLICY, so the ' +
      'gate treats it as public and an anonymous caller gets 200 with a client-side redirect rather than a 307',
    { anon: OK },
  ),
  memberPage('/directory', 'the alumni directory — 214 alumni, projected to the viewer’s tier'),
  memberPageAt((i) => `/directory/${i.memberSlug}`, "one alumnus's profile, with or without the contact block"),
  memberPageAt((i) => `/directory/batch/${i.batchYear}`, 'a whole graduating batch, listed'),
  memberPageAt((i) => `/directory/branch/${i.departmentCode}`, 'a whole branch, listed'),
  memberPage('/connections', 'introductions between named members'),
  memberPage('/events', 'reunions, with venue and attendee counts'),
  memberPageAt((i) => `/events/${i.eventSlug}`, 'one event, with venue and registration state'),
  memberPageAt(
    (i) => `/events/${i.eventSlug}/ticket`,
    "a member's own event ticket. No demo account holds a registration, so every signed-in caller gets the " +
      '"nothing on file" state — 200, deliberately, because a missing registration is an ordinary mistake ' +
      'and the answer to it is the registration form, not a refusal. The API route for the same thing answers 404',
  ),
  memberPage('/gallery', 'photographs of identifiable students and alumni'),
  memberPageAt((i) => `/gallery/${i.albumSlug}`, 'one album of identifiable people'),
  memberPage(
    '/giving',
    'the donations module — off for DIET (features.donations = false) until the college confirms FCRA registration',
    { ...fill(COHORT.concat(STAFF), FEATURE_OFF) },
  ),
  memberPageAt(
    (i) => `/giving/${i.campaignSlug}`,
    'one campaign — same feature gate',
    { ...fill(COHORT.concat(STAFF), FEATURE_OFF) },
  ),
  memberPage('/jobs', 'the jobs board — postings name the alumnus referring'),
  memberPage('/jobs/new', 'the posting form'),
  memberPageAt((i) => `/jobs/${i.jobId}`, 'one posting'),
  memberPageAt(
    (i) => `/jobs/${i.jobId}/applicants`,
    'who applied to a posting — the page renders for anyone but the list is guarded server-side; ' +
      'see job-applicants.spec.ts, which is the assertion that matters here',
  ),
  memberPage('/mentorship', 'alumni who agreed to be asked'),
  memberPageAt((i) => `/mentorship/${i.mentorTopic}`, 'mentors for one topic'),
  memberPage('/news', 'college notices for members'),
  memberPageAt((i) => `/news/${i.newsSlug}`, 'one notice'),
  memberPage('/notifications', "the viewer's own notifications"),
  memberPage('/profile', "the viewer's own record"),
  memberPage('/profile/edit', "the viewer's own record, editable"),
  memberPage('/profile/preview', 'how the viewer looks to other tiers'),
  memberPage('/settings', 'privacy, consent and the DPDP controls'),
  memberPage('/settings/data', 'the DPDP export and erasure controls'),
  memberPage('/settings/notifications', 'notification preferences'),
  memberPage('/settings/privacy', 'the contact visibility setting — the owner half of the two-gate release'),
  memberPage('/settings/security', 'sessions and sign-in history'),

  // ---- The staff console -----------------------------------------
  //
  // `holders` is read off `src/lib/auth/permissions.ts` for the demo role
  // sets, then confirmed against the running app. Everyone else in STAFF
  // is admitted by the gate and refused by the page — 200 today.
  consolePage('/admin', 'the console overview', STAFF),
  consolePage('/admin/audit', 'the audit log — who did what, append-only', ['finance', 'admin', 'platform']),
  consolePage((i) => `/admin/audit/${i.auditId}`, 'one audit entry with its before/after snapshot', [
    'finance',
    'admin',
    'platform',
  ]),
  consolePage('/admin/branding', "the tenant's colour seeds and copy", ['admin', 'platform']),
  consolePage('/admin/comms', 'the campaign list — who can be mailed, and who was', ['hod', 'tpo', 'operator', 'admin']),
  consolePage('/admin/comms/new', 'the compose screen, with segment sizes', ['hod', 'tpo', 'operator', 'admin']),
  consolePage(
    () => '/admin/comms/c-1',
    'one campaign. NOTE: the seed has no comms fixture, so holders reach a not-found and non-holders are refused first',
    [],
    {
      ...fill(['hod', 'tpo', 'operator', 'admin'], FEATURE_OFF),
      ...fill(['finance', 'platform'], CONSOLE_SCREEN_REFUSAL),
    },
  ),
  consolePage('/admin/data-requests', 'the DPDP fulfilment queue — members by name beside what they asked to erase', [
    'admin',
  ]),
  consolePage((i) => `/admin/data-requests/${i.dataRequestId}`, 'one DPDP request', ['admin']),
  consolePage('/admin/degree-register', 'the degree register — every graduate, with roll numbers', [
    'operator',
    'admin',
  ]),
  consolePage('/admin/degree-register/upload', 'the register import screen', ['operator', 'admin']),
  consolePage((i) => `/admin/degree-register/${i.degreeRecordId}`, 'one register row', ['operator', 'admin']),
  consolePage('/admin/events', 'event administration', ['hod', 'operator', 'admin']),
  consolePage('/admin/events/new', 'the event creation form', ['hod', 'operator', 'admin']),
  consolePage(() => '/admin/events/evt-1', 'one event, with its registration list', ['hod', 'operator', 'admin']),
  consolePage('/admin/gallery', 'album administration', ['operator', 'admin']),
  consolePage('/admin/gallery/new', 'the album creation form', ['operator', 'admin']),
  consolePage('/admin/giving', 'donation reconciliation and FCRA segregation', ['finance', 'admin']),
  consolePage('/admin/imports', 'bulk import history', ['operator', 'admin']),
  consolePage('/admin/jobs', 'the moderation queue', ['tpo', 'admin']),
  consolePage((i) => `/admin/jobs/${i.jobId}`, 'one posting, with its applicants', ['tpo', 'admin']),
  consolePage('/admin/members', 'every member record the college holds — 310 rows, with roll numbers', [
    'hod',
    'operator',
    'admin',
  ]),
  consolePage((i) => `/admin/members/${i.memberId}`, "one member's full record", ['hod', 'operator', 'admin']),
  consolePage('/admin/news', 'notice administration', ['tpo', 'operator', 'admin']),
  consolePage('/admin/news/new', 'the notice composer', ['tpo', 'operator', 'admin']),
  consolePage('/admin/reports', 'NAAC / NIRF / AICTE reporting — aggregates, no member rows', [
    'finance',
    'admin',
    'platform',
  ]),
  consolePage('/admin/reports/coverage', 'data-coverage reporting', ['finance', 'admin', 'platform']),
  consolePage((i) => `/admin/reports/${i.reportFramework}`, 'one reporting framework', [
    'finance',
    'admin',
    'platform',
  ]),
  consolePage('/admin/roles', 'role management — the capability matrix and every member holding a grant', ['admin']),
  consolePage('/admin/rollover', 'the annual batch rollover, with its dry-run preview', ['admin']),
  consolePage('/admin/settings', 'tenant configuration', ['admin', 'platform']),
  consolePage('/admin/verification', 'the verification queue — claims with the claimant’s email and roll number', [
    'hod',
    'operator',
    'admin',
  ]),
  consolePage((i) => `/admin/verification/${i.verificationId}`, 'one verification claim', [
    'hod',
    'operator',
    'admin',
  ]),

  // ---- The vendor console ----------------------------------------
  platformPage('/platform', 'every tenant ifBash hosts'),
  platformPage('/platform/brands', 'the brand pack registry'),
  platformPage('/platform/new', 'tenant provisioning'),
  platformPage((i) => `/platform/${i.tenantId}`, "one tenant's provisioning record"),
  platformPage(
    (i) => `/platform/${i.otherTenantId}`,
    'a DIFFERENT college than the one this host resolves to — the cross-tenant reach the vendor console has by design',
  ),

  // ---- Nothing at all --------------------------------------------
  {
    path: () => '/nope-not-a-route',
    method: 'GET',
    kind: 'page',
    holds: 'nothing — this row exists so a blanket 200 shows up as a failure',
    expect: { default: NOT_FOUND },
  },

  // ================================================================
  // API
  // ================================================================

  api('GET', '/api/health', 'the uptime probe — no member data, no session', { default: OK, anon: OK }),
  api('GET', '/api/auth/me', "the caller's own session, roles and capabilities", { default: OK }),
  api('POST', '/api/auth/otp', 'issuing a sign-in code — deliberately not a member-enumeration oracle', {
    default: ADMITTED_THEN_INVALID,
    anon: ADMITTED_THEN_INVALID,
  }),
  api('POST', '/api/auth/verify', 'redeeming a sign-in code', {
    default: ADMITTED_THEN_INVALID,
    anon: ADMITTED_THEN_INVALID,
  }),
  api('POST', '/api/auth/claim', 'self-registration against the degree register', {
    default: ADMITTED_THEN_INVALID,
    anon: ADMITTED_THEN_INVALID,
  }),

  api('GET', '/api/directory', 'the alumni directory as JSON — the single most leak-prone response in the product', {
    default: OK,
    finance: FORBIDDEN,
    platform: FORBIDDEN,
  }),
  api('GET', '/api/directory?cohort=students', 'the student cohort — a list of final-years, by name', {
    default: FORBIDDEN,
    faculty: OK,
    hod: OK,
    tpo: OK,
    admin: OK,
  }),
  api('GET', (i) => `/api/members/${i.memberSlug}`, "one member's profile, contact block included or withheld", {
    default: OK,
    finance: FORBIDDEN,
    platform: FORBIDDEN,
  }),
  // An empty patch is a valid patch — nothing changes — so this one answers
  // 200 rather than 422 where the guard admits. `profile.write.own` is the
  // gate, which finance and the vendor do not hold.
  api('PATCH', '/api/profile', "editing the caller's own record", {
    default: OK,
    finance: FORBIDDEN,
    platform: FORBIDDEN,
  }),
  // POST is the same handler under a second verb, for form posts. Same gate,
  // and it must stay the same gate — a mutation reachable by a verb nobody
  // tested is how a guard gets added to one export and not the other.
  api('POST', '/api/profile', "editing the caller's own record, via POST", {
    default: OK,
    finance: FORBIDDEN,
    platform: FORBIDDEN,
  }),

  api('GET', '/api/connections', "the caller's own connection requests", { default: OK }),
  api('POST', '/api/connections', 'sending a connection request', {
    default: ADMITTED_THEN_INVALID,
    finance: FORBIDDEN,
    platform: FORBIDDEN,
  }),
  api('PATCH', (i) => `/api/connections/${i.connectionId}`, 'accepting or declining a request', {
    default: ADMITTED_THEN_INVALID,
  }),

  api(
    'GET',
    (i) => `/api/events/${i.eventSlug}/ticket`,
    "a member's own ticket — 404 for every demo account, none of which holds a registration",
    { default: NOT_FOUND },
  ),
  api('POST', (i) => `/api/events/${i.eventSlug}/register`, 'registering for an event', {
    default: { status: 201 },
    finance: FORBIDDEN,
    platform: FORBIDDEN,
  }),
  api(
    'DELETE',
    (i) => `/api/events/${i.eventSlug}/register`,
    "cancelling a registration. 404 means \"you have none\" — the capability gate ran first, which is why " +
      'finance and the vendor get 403 instead',
    { default: NOT_FOUND, finance: FORBIDDEN, platform: FORBIDDEN },
  ),
  api('POST', (i) => `/api/events/${i.eventSlug}/checkin`, 'checking somebody in at the door', {
    default: FORBIDDEN,
    operator: ADMITTED_THEN_INVALID,
    admin: ADMITTED_THEN_INVALID,
  }),

  api('GET', '/api/jobs', 'the jobs board as JSON', { default: OK }),
  api('POST', '/api/jobs', 'posting a job', {
    default: ADMITTED_THEN_INVALID,
    student: FORBIDDEN,
    finance: FORBIDDEN,
    platform: FORBIDDEN,
  }),
  api('POST', (i) => `/api/jobs/${i.jobId}/apply`, 'applying to a posting', {
    default: FORBIDDEN,
    student: { status: 201 },
    alumni: { status: 201 },
    operator: { status: 201 },
    admin: { status: 201 },
  }),
  api(
    'GET',
    (i) => `/api/jobs/${i.jobId}/applicants`,
    'the applicant list for one posting — names of students who answered it',
    { default: FORBIDDEN, tpo: OK, admin: OK },
  ),
  api(
    'GET',
    (i) => `/api/jobs/${i.jobId}/applicants/export`,
    'the applicant list as a downloadable file',
    { default: FORBIDDEN, tpo: OK, admin: OK },
  ),
  api(
    'POST',
    (i) => `/api/jobs/${i.jobId}/applicants/export`,
    'the audited applicant download — needs job.applicants.export and a written reason',
    { default: FORBIDDEN, tpo: ADMITTED_THEN_INVALID, admin: ADMITTED_THEN_INVALID },
  ),
  api('POST', (i) => `/api/jobs/${i.jobId}/moderate`, 'approving or rejecting a posting', {
    default: FORBIDDEN,
    tpo: ADMITTED_THEN_INVALID,
    admin: ADMITTED_THEN_INVALID,
  }),

  api(
    'POST',
    '/api/donations',
    'recording a contribution. A student is refused on the capability BEFORE the feature flag is consulted, ' +
      'which is why they get 403 where a capability holder gets the 404 that means "module off"',
    { default: NOT_FOUND, student: FORBIDDEN, finance: FORBIDDEN, platform: FORBIDDEN },
  ),

  api('GET', '/api/notifications', "the caller's notifications — see KW-NOTIFICATIONS-UNSCOPED", { default: OK }),
  api('POST', '/api/notifications', 'marking a notification read', { default: ADMITTED_THEN_INVALID }),
  api('PATCH', '/api/settings/notifications', 'notification preferences', {
    default: ADMITTED_THEN_INVALID,
    finance: FORBIDDEN,
    platform: FORBIDDEN,
  }),
  api('POST', '/api/settings/notifications', 'notification preferences, via POST', {
    default: ADMITTED_THEN_INVALID,
    finance: FORBIDDEN,
    platform: FORBIDDEN,
  }),
  api('PATCH', '/api/settings/privacy', 'the contact visibility setting — the owner half of the two-gate release', {
    default: ADMITTED_THEN_INVALID,
    finance: FORBIDDEN,
    platform: FORBIDDEN,
  }),
  api('POST', '/api/settings/privacy', 'the contact visibility setting, via POST', {
    default: ADMITTED_THEN_INVALID,
    finance: FORBIDDEN,
    platform: FORBIDDEN,
  }),

  api('GET', '/api/data-requests', "the caller's own DPDP requests", { default: OK }),
  api('POST', '/api/data-requests', 'raising a DPDP request', { default: ADMITTED_THEN_INVALID }),
  api('PATCH', (i) => `/api/data-requests/${i.dataRequestId}`, 'fulfilling somebody else’s DPDP request', {
    default: FORBIDDEN,
    admin: ADMITTED_THEN_INVALID,
  }),

  api('GET', '/api/admin/branding', 'the saved brand pack', { default: FORBIDDEN, admin: OK, platform: OK }),
  api('POST', '/api/admin/branding', 'previewing a brand change', {
    default: FORBIDDEN,
    admin: ADMITTED_THEN_INVALID,
    platform: ADMITTED_THEN_INVALID,
  }),
  api('PUT', '/api/admin/branding', 'saving a brand change', {
    default: FORBIDDEN,
    admin: ADMITTED_THEN_INVALID,
    platform: ADMITTED_THEN_INVALID,
  }),
  api('POST', '/api/admin/comms', 'sending to a segment of the member list', {
    default: FORBIDDEN,
    hod: ADMITTED_THEN_INVALID,
    tpo: ADMITTED_THEN_INVALID,
    operator: ADMITTED_THEN_INVALID,
    admin: ADMITTED_THEN_INVALID,
  }),
  api('POST', '/api/admin/degree-register/import', 'loading the degree register', {
    default: FORBIDDEN,
    operator: ADMITTED_THEN_INVALID,
    admin: ADMITTED_THEN_INVALID,
  }),
  api('GET', '/api/admin/degree-register/search?q=test', 'searching the degree register by name or roll number', {
    default: FORBIDDEN,
    operator: OK,
    admin: OK,
  }),
  api('POST', '/api/admin/events', 'creating an event', {
    default: FORBIDDEN,
    hod: ADMITTED_THEN_INVALID,
    operator: ADMITTED_THEN_INVALID,
    admin: ADMITTED_THEN_INVALID,
  }),
  api('POST', '/api/admin/gallery', 'creating an album', {
    default: FORBIDDEN,
    operator: ADMITTED_THEN_INVALID,
    admin: ADMITTED_THEN_INVALID,
  }),
  api('PATCH', () => '/api/admin/gallery/alb-1', 'editing an album', {
    default: FORBIDDEN,
    operator: ADMITTED_THEN_INVALID,
    admin: ADMITTED_THEN_INVALID,
  }),
  api('PATCH', (i) => `/api/admin/members/${i.memberId}`, "editing somebody else's record", {
    default: FORBIDDEN,
    operator: ADMITTED_THEN_INVALID,
    admin: ADMITTED_THEN_INVALID,
  }),
  api(
    'GET',
    '/api/admin/members/export',
    'the row count and column list of a bulk contact export — telling an unauthorised caller how many rows they would get is still telling them something',
    { default: FORBIDDEN, admin: OK },
  ),
  api(
    'POST',
    '/api/admin/members/export',
    'BULK CONTACT EXPORT — every member’s email, mobile and visibility setting in one file. college_admin only, audited, with a written reason',
    {
      default: FORBIDDEN,
      // Three exports an hour, and `bulk-export.spec.ts` spends some of them.
      // 429 is "admitted, then throttled" — see Expectation.alsoAccept.
      admin: { ...ADMITTED_THEN_INVALID, alsoAccept: [429] },
    },
  ),
  api('POST', '/api/admin/news', 'publishing a notice', {
    default: FORBIDDEN,
    tpo: ADMITTED_THEN_INVALID,
    operator: ADMITTED_THEN_INVALID,
    admin: ADMITTED_THEN_INVALID,
  }),
  api('GET', '/api/admin/reports/export', 'the reporting aggregates — metrics, no member rows', {
    default: FORBIDDEN,
    finance: OK,
    admin: OK,
    platform: OK,
  }),
  api('POST', '/api/admin/reports/export', 'downloading a report', {
    default: FORBIDDEN,
    // Rate limited like the member export. 429 is admitted-then-throttled.
    admin: { ...ADMITTED_THEN_INVALID, alsoAccept: [429] },
  }),
  api('POST', '/api/admin/roles', 'granting or revoking a role', {
    default: FORBIDDEN,
    admin: ADMITTED_THEN_INVALID,
  }),
  api('POST', '/api/admin/rollover', 'flipping a whole graduating batch from student to alumnus', {
    default: FORBIDDEN,
    admin: ADMITTED_THEN_INVALID,
  }),
  api('POST', (i) => `/api/admin/verification/${i.verificationId}`, 'approving or rejecting a claim', {
    default: FORBIDDEN,
    hod: ADMITTED_THEN_INVALID,
    operator: ADMITTED_THEN_INVALID,
    admin: ADMITTED_THEN_INVALID,
  }),
  api('POST', '/api/platform/tenants', 'provisioning a college — the vendor’s job and nobody else’s', {
    default: FORBIDDEN,
    platform: ADMITTED_THEN_INVALID,
  }),
];
