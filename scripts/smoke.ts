#!/usr/bin/env tsx
/**
 * Route smoke test.
 *
 *   npm run dev          # in one terminal
 *   npx tsx scripts/smoke.ts
 *
 * Walks every route as each of the nine demo roles and reports the status
 * code. Not a substitute for the Playwright permission suite — this only
 * proves a page renders — but it catches the failure that matters most
 * during a build this wide: a screen that throws for one role and nobody
 * noticed because nobody signed in as that role.
 *
 * A 403 or a redirect to /login is frequently the *correct* answer. The
 * expectations below say so per route, so a green run means the
 * authorisation boundaries hold, not merely that nothing crashed.
 */

const BASE = process.env.SMOKE_BASE ?? 'http://diet.localhost:3000';

interface RouteExpectation {
  path: string;
  /** Roles that must get a 200. */
  allow: string[];
  /** Roles that must NOT get a 200 — a redirect or 403 is the pass. */
  deny?: string[];
}

const PUBLIC_ROUTES = ['/', '/about', '/privacy', '/terms', '/login', '/claim'];

const ROUTES: RouteExpectation[] = [
  { path: '/dashboard', allow: ['student', 'alumni', 'faculty', 'hod', 'tpo', 'operator', 'finance', 'admin'] },
  { path: '/directory', allow: ['student', 'alumni', 'faculty', 'operator', 'admin'] },
  { path: '/connections', allow: ['student', 'alumni', 'faculty'] },
  { path: '/events', allow: ['student', 'alumni', 'faculty', 'admin'] },
  { path: '/jobs', allow: ['student', 'alumni', 'faculty', 'tpo', 'admin'] },
  { path: '/jobs/new', allow: ['alumni', 'faculty', 'tpo'], deny: ['student'] },
  { path: '/profile', allow: ['student', 'alumni', 'admin'] },
  { path: '/settings', allow: ['student', 'alumni', 'admin'] },
  { path: '/settings/privacy', allow: ['student', 'alumni', 'admin'] },
  { path: '/settings/data', allow: ['student', 'alumni', 'admin'] },

  // Donations ship off in the DIET pack, so a 404 is correct for everyone
  // here. Students must be refused even when the feature is switched on.
  { path: '/giving', allow: [], deny: ['student', 'alumni', 'admin'] },

  { path: '/admin', allow: ['admin', 'operator', 'hod', 'tpo'], deny: ['student', 'alumni'] },
  { path: '/admin/members', allow: ['admin', 'operator'], deny: ['student', 'alumni'] },
  { path: '/admin/verification', allow: ['admin', 'operator', 'hod'], deny: ['student', 'alumni'] },
  { path: '/admin/degree-register', allow: ['admin', 'operator'], deny: ['student', 'alumni'] },
  { path: '/admin/roles', allow: ['admin'], deny: ['student', 'alumni', 'hod', 'operator'] },
  { path: '/admin/audit', allow: ['admin', 'finance'], deny: ['student', 'alumni'] },
  { path: '/admin/branding', allow: ['admin'], deny: ['student', 'alumni', 'hod', 'operator', 'tpo'] },
  { path: '/admin/jobs', allow: ['admin', 'tpo'], deny: ['student', 'alumni'] },
  { path: '/admin/comms', allow: ['admin', 'hod', 'operator', 'tpo'], deny: ['student', 'alumni'] },
  { path: '/admin/rollover', allow: ['admin'], deny: ['student', 'alumni', 'hod'] },
  { path: '/admin/data-requests', allow: ['admin'], deny: ['student', 'alumni', 'hod'] },

  { path: '/platform', allow: ['platform'], deny: ['student', 'alumni', 'admin'] },
  { path: '/platform/brands', allow: ['platform'], deny: ['admin'] },
];

const ACCOUNTS: Record<string, string> = {
  student: 'student@diet.ac.in',
  alumni: 'alumni@example.com',
  faculty: 'faculty.ece@diet.ac.in',
  hod: 'hod.cse@diet.ac.in',
  tpo: 'tpo@diet.ac.in',
  operator: 'alumnicell@diet.ac.in',
  finance: 'finance@diet.ac.in',
  admin: 'admin@diet.ac.in',
  platform: 'platform@ifbash.com',
};

/** Sign in through the real OTP flow and keep the session cookie. */
async function signIn(email: string): Promise<string | null> {
  const otpRes = await fetch(`${BASE}/api/auth/otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!otpRes.ok) {
    console.error(`  could not request a code for ${email}: ${otpRes.status}`);
    return null;
  }

  const { devCode } = (await otpRes.json()) as { devCode?: string };
  if (!devCode) {
    console.error('  no devCode in the response — is the server in fixture mode?');
    return null;
  }

  const verifyRes = await fetch(`${BASE}/api/auth/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, code: devCode }),
  });

  if (!verifyRes.ok) {
    console.error(`  verify failed for ${email}: ${verifyRes.status}`);
    return null;
  }

  return verifyRes.headers.get('set-cookie')?.split(';')[0] ?? null;
}

async function main() {
  let failures = 0;

  console.log(`\nPublic routes (no session) — ${BASE}`);
  for (const path of PUBLIC_ROUTES) {
    const res = await fetch(`${BASE}${path}`, { redirect: 'manual' });
    const ok = res.status === 200;
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${String(res.status).padEnd(4)} ${path}`);
  }

  const cookies: Record<string, string> = {};
  console.log('\nSigning in as each demo role');
  for (const [role, email] of Object.entries(ACCOUNTS)) {
    const cookie = await signIn(email);
    if (cookie) {
      cookies[role] = cookie;
      console.log(`  ok   ${role}`);
    } else {
      failures++;
      console.log(`  FAIL ${role}`);
    }
  }

  console.log('\nAuthorised routes');
  for (const route of ROUTES) {
    const results: string[] = [];

    for (const role of route.allow) {
      const cookie = cookies[role];
      if (!cookie) continue;
      const res = await fetch(`${BASE}${route.path}`, { headers: { cookie }, redirect: 'manual' });
      if (res.status !== 200) {
        failures++;
        results.push(`${role}:${res.status}✗`);
      }
    }

    for (const role of route.deny ?? []) {
      const cookie = cookies[role];
      if (!cookie) continue;
      const res = await fetch(`${BASE}${route.path}`, { headers: { cookie }, redirect: 'manual' });
      // A 200 for a denied role is the only genuinely bad outcome here.
      if (res.status === 200) {
        failures++;
        results.push(`${role}:LEAK`);
      }
    }

    console.log(`  ${results.length === 0 ? 'ok  ' : 'FAIL'} ${route.path}${results.length ? `  ${results.join(' ')}` : ''}`);
  }

  console.log(`\n${failures === 0 ? 'All routes behaved as expected.' : `${failures} failure(s).`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nSmoke run failed. Is the dev server up?');
  console.error(err);
  process.exit(1);
});
