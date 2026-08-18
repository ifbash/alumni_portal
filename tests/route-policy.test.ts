import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CAN_VERIFY_SESSIONS,
  FORBIDDEN_BODY,
  ROUTE_POLICY,
  STAFF_CONSOLE_CAPABILITIES,
  UNAUTHORISED_REDIRECT,
  holdsAnyCapability,
  isAssetPath,
  loginRedirectPath,
  policyFor,
  readSessionMemberId,
  requiresCapability,
  requiresSession,
  safeNextParam,
  UNAUTHENTICATED_BODY,
  type CoarseViewer,
} from '@/lib/auth/route-policy';
import { CAPABILITIES, ROLES, type Capability, type Role } from '@/lib/auth/permissions';
import { can, type MemberStatus, type Session } from '@/lib/auth/guard';
import { IS_FIXTURE } from '@/lib/config';

/**
 * The coarse gate middleware runs before anything renders.
 *
 * Three failure modes are being fenced off. The first is a protected route
 * that quietly falls out of the table and starts answering anonymous
 * requests with a 200 — nothing leaks, because the page guard is still
 * there, but the status code is a lie and caches, crawlers and uptime
 * checks all believe it. The second is the opposite: a prefix written
 * carelessly enough that `/admin` swallows `/about`, or that `next=`
 * becomes an open redirect, which is how a sign-in page turns into a
 * phishing relay.
 *
 * The third arrived with the capability half of the gate. Middleware now
 * decides, for `/admin` and `/platform`, whether a signed-in member has
 * any business on the surface at all — and a coarse gate that disagrees
 * with `can()` is worse than no gate. Too permissive and it is theatre;
 * too strict and it locks a legitimate operator out of their own console,
 * which is an outage caused by a status-code fix. The suite below asserts
 * agreement across the whole role × capability matrix rather than
 * spot-checking a few roles.
 */

// ---------------------------------------------------------------
// The table itself
// ---------------------------------------------------------------

describe('the policy table', () => {
  it('has an absolute, unique prefix on every rule', () => {
    const seen = new Set<string>();
    for (const rule of ROUTE_POLICY) {
      expect(rule.prefix.startsWith('/'), `${rule.prefix} must be absolute`).toBe(true);
      expect(rule.prefix.endsWith('/') && rule.prefix !== '/', `${rule.prefix} must not trail`).toBe(false);
      expect(seen.has(rule.prefix), `${rule.prefix} is listed twice`).toBe(false);
      seen.add(rule.prefix);
      // A rule with no stated reason is a rule nobody can review.
      expect(rule.why.length, `${rule.prefix} needs a reason`).toBeGreaterThan(0);
    }
  });

  it('refuses anonymous API callers with JSON and everything else with a redirect', () => {
    for (const rule of ROUTE_POLICY) {
      const expected = rule.prefix === '/api' || rule.prefix.startsWith('/api/') ? 'json' : 'redirect';
      expect(rule.refuse, `${rule.prefix}`).toBe(expected);
    }
  });

  it('never asks for a capability on a prefix that does not first ask for a session', () => {
    // A capability check needs a member id, and the member id comes out of
    // the session cookie. A rule with one and not the other would resolve
    // nobody and refuse everybody.
    for (const rule of ROUTE_POLICY) {
      if (!rule.requiresAnyCapability) continue;
      expect(rule.requiresSession, `${rule.prefix}`).toBe(true);
      expect(rule.requiresAnyCapability.length, `${rule.prefix} needs a non-empty set`).toBeGreaterThan(0);
    }
  });

  it('only spends a storage read on the two console prefixes', () => {
    // Every rule carrying `requiresAnyCapability` costs a member lookup on
    // every request to it. That is affordable for staff-console traffic
    // and is not affordable for the member portal or for /api. If this
    // list grows, the growth has to be a decision somebody took, not a
    // line somebody added.
    const gated = ROUTE_POLICY.filter((r) => r.requiresAnyCapability).map((r) => r.prefix);
    expect(gated.sort()).toEqual(['/admin', '/platform']);
  });

  it('never gates the path it redirects the refused to', () => {
    // /admin -> /dashboard -> /admin is the loop this prevents, and a
    // browser follows twenty of them before giving up.
    expect(requiresCapability(UNAUTHORISED_REDIRECT)).toBeNull();
    expect(policyFor(UNAUTHORISED_REDIRECT).requiresSession).toBe(true);
  });
});

// ---------------------------------------------------------------
// Public paths
// ---------------------------------------------------------------

describe('public paths', () => {
  const PUBLIC = [
    '/',
    '/about',
    '/privacy',
    '/terms',
    '/login',
    '/verify',
    '/claim',
    '/pending',
    '/logout',
  ];

  it('lets anyone through the marketing surface and the front door', () => {
    for (const path of PUBLIC) {
      expect(requiresSession(path), `${path} must stay public`).toBe(false);
    }
  });

  it('keeps the sign-in flow public with its query string attached', () => {
    // /login?next=… and /verify?email=… are the same routes, and gating
    // either of them is an infinite redirect.
    expect(requiresSession('/login')).toBe(false);
    expect(requiresSession('/verify')).toBe(false);
  });

  it('does not treat an unlisted path as protected', () => {
    // The gate is a pre-filter, not the authority: an unknown path passes
    // through and the page (or the 404) decides. Documented on
    // ROUTE_POLICY; asserted here so the default is never flipped by
    // accident.
    expect(requiresSession('/somewhere-nobody-added')).toBe(false);
    expect(policyFor('/somewhere-nobody-added').prefix).toBe('');
  });
});

// ---------------------------------------------------------------
// Protected prefixes
// ---------------------------------------------------------------

describe('protected prefixes', () => {
  const PROTECTED = [
    '/dashboard',
    '/directory',
    '/directory/kandula-sai-teja-2017',
    '/connections',
    '/mentorship',
    '/events',
    '/events/silver-jubilee-2026',
    '/jobs',
    '/jobs/new',
    '/news',
    '/gallery',
    '/giving',
    '/profile',
    '/profile/edit',
    '/notifications',
    '/settings',
    '/settings/privacy',
    '/admin',
    '/admin/members',
    '/admin/members/mem-a-9',
    '/admin/verification',
    '/platform',
    '/platform/brands',
  ];

  it('requires a session on every signed-in surface', () => {
    for (const path of PROTECTED) {
      expect(requiresSession(path), `${path} must require a session`).toBe(true);
    }
  });

  it('sends an anonymous browser to the sign-in screen, not to JSON', () => {
    for (const path of PROTECTED) {
      expect(policyFor(path).refuse, `${path}`).toBe('redirect');
    }
  });

  it('matches whole segments, never substrings', () => {
    // `/admin` must not swallow a future `/administration`, and `/events`
    // must not swallow `/eventsomething`. A prefix test written with a
    // bare startsWith() gets this wrong and nobody notices until the day
    // somebody adds the route.
    expect(requiresSession('/administration')).toBe(false);
    expect(requiresSession('/eventsomething')).toBe(false);
    expect(requiresSession('/directory-export')).toBe(false);
    expect(requiresSession('/profiles')).toBe(false);
    // The landing page is a rule about `/` alone, not a catch-all.
    expect(policyFor('/').prefix).toBe('/');
    expect(policyFor('/anything').prefix).toBe('');
  });

  it('treats a trailing slash as the same route', () => {
    expect(requiresSession('/admin/')).toBe(true);
    expect(requiresSession('/admin/members/')).toBe(true);
    expect(requiresSession('/about/')).toBe(false);
  });

  it('takes the longest matching prefix, not the first', () => {
    expect(policyFor('/admin/members').prefix).toBe('/admin');
    expect(policyFor('/api/auth/verify').prefix).toBe('/api/auth/verify');
    expect(policyFor('/api/auth/me').prefix).toBe('/api');
  });
});

// ---------------------------------------------------------------
// API
// ---------------------------------------------------------------

describe('API paths', () => {
  it('protects everything under /api by default', () => {
    for (const path of [
      '/api/directory',
      '/api/members/kandula-sai-teja-2017',
      '/api/connections',
      '/api/profile',
      '/api/admin/members/export',
      '/api/data-requests',
      '/api/auth/me',
      '/api/something-added-next-week',
    ]) {
      const rule = policyFor(path);
      expect(rule.requiresSession, `${path} must require a session`).toBe(true);
      expect(rule.refuse, `${path} must answer in JSON`).toBe('json');
    }
  });

  it('carves out the four endpoints that cannot hold a session', () => {
    // Asking for a code, redeeming it and self-registering all happen
    // before an account exists; an uptime probe never has one.
    for (const path of ['/api/health', '/api/auth/otp', '/api/auth/verify', '/api/auth/claim']) {
      expect(requiresSession(path), `${path} must stay open`).toBe(false);
    }
  });

  it('does not let a carve-out leak onto a sibling', () => {
    expect(requiresSession('/api/health-internal')).toBe(true);
    expect(requiresSession('/api/auth/verifying')).toBe(true);
    expect(requiresSession('/api/auth')).toBe(true);
  });

  it('answers in the same shape the route handlers use', () => {
    // `{ error, code }`, identical to AuthzError -> toResponse, so a
    // client never has to tell a middleware refusal from a handler one.
    expect(UNAUTHENTICATED_BODY).toEqual({ error: 'Sign in required', code: 'not_authenticated' });
  });
});

// ---------------------------------------------------------------
// Static assets
// ---------------------------------------------------------------

describe('static asset paths', () => {
  const ASSETS = [
    '/_next/static/chunks/main-app.js',
    '/_next/image',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
    '/fonts/inter-latin.woff2',
    '/brand/diet-crest.svg',
    '/og/diet.png',
    '/site.webmanifest',
  ];

  it('recognises them', () => {
    for (const path of ASSETS) {
      expect(isAssetPath(path), `${path} is an asset`).toBe(true);
    }
  });

  it('never gates one', () => {
    // The middleware `matcher` already excludes these; this is the second
    // fence, because the two lists are maintained separately and a font
    // request redirected to /login is a baffling bug to chase.
    for (const path of ASSETS) {
      expect(requiresSession(path), `${path} must pass through`).toBe(false);
    }
  });

  it('does not mistake a page for an asset', () => {
    expect(isAssetPath('/admin/members')).toBe(false);
    expect(isAssetPath('/directory')).toBe(false);
    // A route segment that merely contains a dot is still a page.
    expect(isAssetPath('/directory/k.s.teja-2017')).toBe(false);
    expect(requiresSession('/directory/k.s.teja-2017')).toBe(true);
  });
});

// ---------------------------------------------------------------
// The /login redirect
// ---------------------------------------------------------------

describe('the sign-in redirect', () => {
  it('preserves the original path in next', () => {
    expect(loginRedirectPath('/admin/members')).toBe('/login?next=%2Fadmin%2Fmembers');
    expect(decodeURIComponent(new URL(loginRedirectPath('/admin/members'), 'https://diet.example')
      .searchParams.get('next')!)).toBe('/admin/members');
  });

  it('preserves the query string as well as the path', () => {
    // A WhatsApp link to a filtered directory has to survive sign-in, or
    // everyone lands on the dashboard and re-types the filter.
    const url = new URL(loginRedirectPath('/directory', '?branch=CSE&batch=2017'), 'https://diet.example');
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('next')).toBe('/directory?branch=CSE&batch=2017');
  });

  it('produces a value the login page will accept', () => {
    // src/app/(auth)/login/page.tsx re-sanitises with /^\/(?!\/)/ before
    // using it. If this ever emits something that fails there, the
    // redirect silently degrades to the dashboard.
    const accepted = /^\/(?!\/)/;
    for (const path of ['/admin/members', '/directory/kandula-2017', '/settings/privacy']) {
      const next = new URL(loginRedirectPath(path), 'https://diet.example').searchParams.get('next');
      expect(accepted.test(next!), `${path}`).toBe(true);
    }
  });

  it('drops anything that is not a same-site absolute path', () => {
    // Both of these are protocol-relative once a browser has normalised
    // the backslash, and an unchecked next= is how a sign-in page becomes
    // a phishing relay.
    expect(safeNextParam('//evil.example/steal')).toBeNull();
    expect(safeNextParam('/\\evil.example/steal')).toBeNull();
    expect(safeNextParam('https://evil.example')).toBeNull();
    expect(safeNextParam('/directory#fragment')).toBeNull();
    expect(safeNextParam('/directory with a space')).toBeNull();
    expect(safeNextParam(`/${'a'.repeat(600)}`)).toBeNull();

    expect(loginRedirectPath('//evil.example/steal')).toBe('/login');
    expect(loginRedirectPath('https://evil.example')).toBe('/login');
  });

  it('never points next at the sign-in flow itself', () => {
    expect(safeNextParam('/login')).toBeNull();
    expect(safeNextParam('/login', '?next=%2Fadmin')).toBeNull();
    expect(safeNextParam('/logout')).toBeNull();
    expect(loginRedirectPath('/login')).toBe('/login');
  });
});

// ---------------------------------------------------------------
// The coarse capability gate
// ---------------------------------------------------------------

/** A viewer holding exactly these roles, active enough to act. */
const viewer = (roles: Role[], status: MemberStatus = 'active_alumni'): CoarseViewer => ({
  status,
  roles,
});

/** The same person as a `Session`, for comparing the gate against `can()`. */
const sessionOf = (v: CoarseViewer): Session => ({
  memberId: 'mem-test',
  tenantId: 'ten-diet',
  status: v.status,
  roles: v.roles.map((role) => ({ role, departmentId: null })),
  departmentId: null,
  batchYear: null,
});

const STAFF_ROLES: Role[] = [
  'alumni_cell_operator',
  'placement_officer',
  'hod',
  'finance',
  'college_admin',
  'platform_admin',
];

/** The three roles that describe being *at* the college rather than running it. */
const COHORT_ROLES: Role[] = ['student', 'alumni', 'faculty'];

describe('the staff-console capability set', () => {
  it('is derived, not typed out', () => {
    // Every capability in the set is a real capability, and the set is not
    // the whole matrix (which would admit everyone) nor empty (which would
    // admit nobody).
    for (const cap of STAFF_CONSOLE_CAPABILITIES) {
      expect(CAPABILITIES, `${cap} is not a capability`).toContain(cap);
    }
    expect(STAFF_CONSOLE_CAPABILITIES.length).toBeGreaterThan(0);
    expect(STAFF_CONSOLE_CAPABILITIES.length).toBeLessThan(CAPABILITIES.length);
  });

  it('partitions the roles exactly: cohort out, staff in', () => {
    // This is the assertion that matters. If a grant in permissions.ts
    // ever hands a student, an alumnus or a faculty member a capability
    // the console gate treats as staff-only, this fails here rather than
    // opening the console to a cohort that must never see it. And if a
    // staff role is ever reduced to nothing but member capabilities, this
    // fails rather than silently locking them out of their own console.
    for (const role of COHORT_ROLES) {
      expect(
        holdsAnyCapability(viewer([role]), STAFF_CONSOLE_CAPABILITIES),
        `${role} must not reach the staff console`,
      ).toBe(false);
    }
    for (const role of STAFF_ROLES) {
      expect(
        holdsAnyCapability(viewer([role]), STAFF_CONSOLE_CAPABILITIES),
        `${role} must reach the staff console`,
      ).toBe(true);
    }
    // No role is unaccounted for — a tenth role added to permissions.ts
    // has to be classified here deliberately.
    expect([...COHORT_ROLES, ...STAFF_ROLES].sort()).toEqual([...ROLES].sort());
  });

  it('does not contain a capability any cohort role holds', () => {
    for (const cap of STAFF_CONSOLE_CAPABILITIES) {
      for (const role of COHORT_ROLES) {
        expect(
          can(sessionOf(viewer([role])), cap),
          `${role} holds ${cap}, which the console set claims is staff-only`,
        ).toBe(false);
      }
    }
  });
});

describe('holdsAnyCapability', () => {
  it('agrees with can() on every role and every capability', () => {
    // The anti-drift device. The gate must never be more permissive than
    // the page guard — that would be theatre — and never stricter, which
    // would refuse somebody the page would have served. `can()` is the
    // authority; this asserts the gate is the same function.
    for (const role of ROLES) {
      for (const cap of CAPABILITIES) {
        const v = viewer([role]);
        expect(holdsAnyCapability(v, [cap]), `${role} × ${cap}`).toBe(can(sessionOf(v), cap));
      }
    }
  });

  it('treats the set as any-of, not all-of', () => {
    // A finance officer holds `donation.report` and not `role.manage`, and
    // one is enough. An all-of reading would admit nobody but the college
    // admin and would be a silent lockout.
    const finance = viewer(['finance']);
    expect(holdsAnyCapability(finance, ['role.manage'])).toBe(false);
    expect(holdsAnyCapability(finance, ['role.manage', 'donation.report'])).toBe(true);
  });

  it('gives the union to somebody holding several roles', () => {
    // One person, one row: alumni + faculty + HOD of CSE is a real member,
    // not an edge case. See CLAUDE.md.
    const hodWhoIsAlsoAnAlumnus = viewer(['alumni', 'faculty', 'hod']);
    expect(holdsAnyCapability(hodWhoIsAlsoAnAlumnus, STAFF_CONSOLE_CAPABILITIES)).toBe(true);
  });

  it('refuses a member who is not active, whatever they hold', () => {
    // A pending or lapsed college_admin holds the grants on paper and may
    // not act on them. `isActive()` in guard.ts is the rule; this asserts
    // the gate inherits it rather than re-deriving it.
    for (const status of ['pending', 'invited', 'unclaimed', 'rejected', 'lapsed', 'deceased'] as MemberStatus[]) {
      expect(
        holdsAnyCapability(viewer(['college_admin'], status), STAFF_CONSOLE_CAPABILITIES),
        `a ${status} college_admin must not pass`,
      ).toBe(false);
    }
    for (const status of ['active_student', 'active_alumni'] as MemberStatus[]) {
      expect(holdsAnyCapability(viewer(['college_admin'], status), STAFF_CONSOLE_CAPABILITIES)).toBe(true);
    }
  });

  it('refuses a member with no roles at all', () => {
    expect(holdsAnyCapability(viewer([]), STAFF_CONSOLE_CAPABILITIES)).toBe(false);
    expect(holdsAnyCapability(viewer([]), ['tenant.provision'])).toBe(false);
  });

  it('refuses an empty capability set rather than waving it through', () => {
    // `[].some()` is false, which is the safe direction — but the gate in
    // middleware.ts also treats an empty set as "no rule", so this is
    // asserting the two agree that nothing has been decided.
    expect(holdsAnyCapability(viewer(['college_admin']), [])).toBe(false);
  });
});

describe('the console prefixes', () => {
  it('gates /admin on any staff capability and nothing narrower', () => {
    expect(requiresCapability('/admin')).toBe(STAFF_CONSOLE_CAPABILITIES);
    expect(requiresCapability('/admin/members')).toBe(STAFF_CONSOLE_CAPABILITIES);
    expect(requiresCapability('/admin/members/mem-a-9')).toBe(STAFF_CONSOLE_CAPABILITIES);
  });

  it('gates /platform on tenant.provision, which is platform_admin alone', () => {
    expect(requiresCapability('/platform')).toEqual(['tenant.provision']);
    expect(requiresCapability('/platform/brands')).toEqual(['tenant.provision']);

    const holders = ROLES.filter((role) => can(sessionOf(viewer([role])), 'tenant.provision'));
    expect(holders).toEqual(['platform_admin']);
  });

  it('leaves the member portal and the API to the page and the handler', () => {
    // These are the paths that must not pay for a member lookup. /api in
    // particular already answers 403 correctly from the route handler —
    // `fail()` runs before anything is streamed — so there is nothing here
    // for middleware to fix and no reason to charge for it.
    for (const path of [
      '/dashboard',
      '/directory',
      '/directory/kandula-sai-teja-2017',
      '/giving',
      '/settings',
      '/api/directory',
      '/api/admin/members/export',
      '/login',
      '/campus-events',
    ]) {
      expect(requiresCapability(path), `${path} must not cost a lookup`).toBeNull();
    }
  });

  it('does not let the console prefixes swallow a sibling', () => {
    expect(requiresCapability('/administration')).toBeNull();
    expect(requiresCapability('/platforms')).toBeNull();
    // /api/admin is under /api, which is a session rule and not a
    // capability rule — the handler's own `require()` answers it.
    expect(requiresCapability('/api/admin/members/export')).toBeNull();
  });

  it('follows the trailing slash and the longest-prefix rules like every other rule', () => {
    expect(requiresCapability('/admin/')).toBe(STAFF_CONSOLE_CAPABILITIES);
    expect(policyFor('/platform/brands').prefix).toBe('/platform');
  });
});

describe('refusing a signed-in caller', () => {
  it('answers an API client in the same shape a route handler would', () => {
    // Identical to AuthzError(403, 'forbidden', …) -> toResponse, so a
    // client never has to tell a middleware refusal from a handler one.
    expect(FORBIDDEN_BODY).toEqual({
      error: 'You do not have permission to do that',
      code: 'forbidden',
    });
  });

  it('sends a browser to the portal home, carrying no next', () => {
    // AppShell already intends `redirect('/dashboard')` for a member with
    // no console surface; this moves that decision in front of the render
    // so it can carry a status. Signing in again is not what is missing,
    // so there is deliberately no `next`.
    expect(UNAUTHORISED_REDIRECT).toBe('/dashboard');
    expect(UNAUTHORISED_REDIRECT.startsWith('/')).toBe(true);
    expect(safeNextParam(UNAUTHORISED_REDIRECT)).toBe('/dashboard');
  });

  it('keeps the two refusals distinguishable', () => {
    // 401 not_authenticated and 403 forbidden are different problems with
    // different fixes, and a client that cannot tell them apart retries
    // the wrong one forever.
    expect(FORBIDDEN_BODY.code).not.toBe(UNAUTHENTICATED_BODY.code);
    expect(loginRedirectPath('/admin/members')).not.toBe(UNAUTHORISED_REDIRECT);
  });
});

// ---------------------------------------------------------------
// The gap the gate deliberately leaves open
// ---------------------------------------------------------------

/**
 * Every screen in the console, and the capability its page guard demands.
 *
 * Transcribed from the `require(session, …)` call at the top of each
 * page under `src/app/(admin)/admin`. It is **not** a second
 * authorisation model — nothing reads it at runtime and no code path
 * consults it. It exists so the tests below can state the size of the
 * problem documented in docs/STATUS-CODES.md §5.1 in numbers rather than
 * in prose, and so that a screen added without a guard shows up as a gap
 * in this list rather than as a silent 200.
 */
const CONSOLE_SCREENS: ReadonlyArray<readonly [string, Capability]> = [
  ['/admin/audit', 'audit.read'],
  ['/admin/branding', 'tenant.configure'],
  ['/admin/comms', 'comms.send.department'],
  ['/admin/data-requests', 'data_request.manage'],
  ['/admin/degree-register', 'verification.review.any'],
  ['/admin/events', 'event.create.department'],
  ['/admin/gallery', 'event.create.any'],
  ['/admin/giving', 'donation.report'],
  ['/admin/imports', 'verification.review.any'],
  ['/admin/jobs', 'job.moderate'],
  ['/admin/members', 'profile.read.any'],
  ['/admin/news', 'comms.send.segment'],
  ['/admin/reports', 'audit.read'],
  ['/admin/roles', 'role.manage'],
  ['/admin/rollover', 'rollover.execute'],
  ['/admin/settings', 'tenant.configure'],
  ['/admin/verification', 'verification.review.department'],
] as const;

describe('per-screen refusals inside the console', () => {
  it('lets a member into the console who is refused screens inside it', () => {
    // This is the population behind the `200` ⚠ row in the contract
    // table. The gate is coarse by design: it answers "does this person
    // belong in the staff console at all", and for all six of these roles
    // the answer is yes. The screen-level answer is the page's, and the
    // page cannot put it on the status line — see docs/STATUS-CODES.md
    // §5.1 for the measurement and the change set.
    //
    // The named case is an HOD on /admin/roles.
    const hod = viewer(['hod']);
    expect(holdsAnyCapability(hod, STAFF_CONSOLE_CAPABILITIES)).toBe(true);
    expect(can(sessionOf(hod), 'role.manage')).toBe(false);

    // And it is not one unlucky pairing. Every role that reaches the
    // console is refused at least one screen inside it, including the
    // platform admin, who reaches /platform and almost nothing here.
    for (const role of STAFF_ROLES) {
      const v = viewer([role]);
      expect(
        holdsAnyCapability(v, STAFF_CONSOLE_CAPABILITIES),
        `${role} must reach the console`,
      ).toBe(true);

      const refused = CONSOLE_SCREENS.filter(([, cap]) => !can(sessionOf(v), cap));
      expect(refused.length, `${role} is refused no console screen`).toBeGreaterThan(0);
    }
  });

  it('refuses more console screens than it serves', () => {
    // 70 of 102 (role, screen) pairs are refusals today, and every one of
    // them answers 200. The exact numbers are allowed to move as screens
    // and grants change; what must not move is that this is the common
    // case rather than an edge, which is why the fix is worth its cost.
    let refused = 0;
    let served = 0;
    for (const role of STAFF_ROLES) {
      const s = sessionOf(viewer([role]));
      for (const [, cap] of CONSOLE_SCREENS) {
        if (can(s, cap)) served++;
        else refused++;
      }
    }
    expect(refused + served).toBe(STAFF_ROLES.length * CONSOLE_SCREENS.length);
    expect(refused).toBeGreaterThan(served);
  });

  it('does not answer any of it from the policy table', () => {
    // The anti-drift assertion. A per-screen capability table in
    // route-policy.ts would be a second authorisation model that
    // disagrees with permissions.ts silently, and the first symptom of
    // the disagreement is somebody being let in. If a future change
    // starts gating /admin/roles on `role.manage` here, this fails —
    // deliberately. The fix for the status code is a page-side one.
    for (const [path] of CONSOLE_SCREENS) {
      expect(requiresCapability(path), `${path} must stay on the coarse set`).toBe(
        STAFF_CONSOLE_CAPABILITIES,
      );
    }
  });

  it('names a real capability for every screen', () => {
    // Catches the transcription above drifting from permissions.ts.
    for (const [path, cap] of CONSOLE_SCREENS) {
      expect(CAPABILITIES, `${path} names a capability that does not exist`).toContain(cap);
    }
  });
});

// ---------------------------------------------------------------
// Cookie signature
// ---------------------------------------------------------------

const SECRET = process.env.SESSION_SECRET || (IS_FIXTURE ? 'fixture-mode-development-secret' : '');

/** Mints a cookie exactly the way `encode()` in session.ts does. */
function mint(payload: Record<string, unknown>, secret = SECRET): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

describe.skipIf(!CAN_VERIFY_SESSIONS)('cookie signature', () => {
  const valid = () => mint({ memberId: 'mem-a-9', tenantId: 'ten-diet', issuedAt: Date.now() });

  it('reads the member id out of a cookie the app itself would have issued', () => {
    expect(readSessionMemberId(valid())).toBe('mem-a-9');
  });

  it('refuses a payload edited to somebody else', () => {
    // The whole point of signing rather than encrypting: the id is not a
    // secret, but changing it must not survive.
    const forged = Buffer.from(JSON.stringify({ memberId: 'mem-a-1', tenantId: 'ten-diet', issuedAt: Date.now() })).toString('base64url');
    const [, mac] = valid().split('.');
    expect(readSessionMemberId(`${forged}.${mac}`)).toBeNull();
  });

  it('refuses a cookie signed with a different secret', () => {
    expect(readSessionMemberId(mint({ memberId: 'mem-a-9', tenantId: 'ten-diet', issuedAt: Date.now() }, 'not-the-secret'))).toBeNull();
  });

  it('refuses one that has aged past fourteen days', () => {
    const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000;
    expect(readSessionMemberId(mint({ memberId: 'mem-a-9', tenantId: 'ten-diet', issuedAt: fifteenDaysAgo }))).toBeNull();
  });

  it('returns null rather than throwing on junk', () => {
    // This is the first code to touch an attacker-controlled value on
    // every request. A throw here is a 500 on the whole site.
    for (const junk of [
      undefined,
      null,
      '',
      '.',
      'nodot',
      'a.b',
      'x'.repeat(4096),
      `${Buffer.from('not json').toString('base64url')}.${createHmac('sha256', SECRET).update(Buffer.from('not json').toString('base64url')).digest('base64url')}`,
    ]) {
      expect(() => readSessionMemberId(junk as string | null | undefined)).not.toThrow();
      expect(readSessionMemberId(junk as string | null | undefined)).toBeNull();
    }
  });

  it('refuses a well-signed payload that is missing the member id', () => {
    expect(readSessionMemberId(mint({ tenantId: 'ten-diet', issuedAt: Date.now() }))).toBeNull();
    expect(readSessionMemberId(mint({ memberId: '', tenantId: 'ten-diet', issuedAt: Date.now() }))).toBeNull();
    expect(readSessionMemberId(mint({ memberId: 'mem-a-9', tenantId: 'ten-diet' }))).toBeNull();
  });
});
