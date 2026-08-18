import { expect, test } from '@playwright/test';

import { KNOWN_WRONG } from './lib/expectations';
import { cookieFor } from './lib/state';

/**
 * The other college.
 *
 * One deployment serves many colleges, separated by subdomain. Everything
 * else in this suite runs against `diet`; this file is the only place the
 * multi-tenant seam is touched at all, and it covers two things that are
 * invisible from a single-tenant run:
 *
 *  1. **The tenant feature gate**, which is the second of the two ⚠ rows
 *     in `docs/STATUS-CODES.md` §1, and whose named example is exactly
 *     `northgate` + `/campus-events`. The DIET pack cannot exercise it —
 *     `publicLanding` is on there — so without this file the doc's own
 *     example is never tested.
 *
 *  2. **Whether a session for one college works on another's host.** It
 *     does. See KW-CROSS-TENANT-COOKIE.
 *
 * ── How the tenant is switched ───────────────────────────────────────
 *
 * By `Host` header, not by URL: `northgate.localhost` has no DNS entry on
 * a developer's machine and Node will not resolve it, while
 * `subdomainFrom()` in `src/lib/tenant.ts` reads whatever the header says.
 * Playwright's request context passes the header through unchanged; Node's
 * own `fetch` silently drops it, which is worth knowing before debugging
 * a probe that keeps answering as DIET.
 */

/** `northgate` ships with publicLanding, gallery and news all off. */
const OTHER_TENANT = 'northgate.localhost';

function asOther(extra: Record<string, string> = {}): Record<string, string> {
  return { host: OTHER_TENANT, ...extra };
}

test.describe('a second college on the same deployment', () => {
  test('the host header really does select the tenant', async ({ request }) => {
    // The control. Every assertion below is meaningless if the requests are
    // quietly still being served as DIET.
    const res = await request.get('/api/health', { headers: asOther(), maxRedirects: 0 });
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(
      body.tenant.subdomain,
      [
        '',
        'The Host header no longer selects the tenant.',
        `  sent:     Host: ${OTHER_TENANT}`,
        `  resolved: ${body.tenant.subdomain}`,
        '',
        '  Either `subdomainFrom()` changed, or the request stack stopped forwarding the header.',
        '  Until this passes, every other test in this file is asserting against DIET and proving',
        '  nothing about tenant separation.',
        '',
      ].join('\n'),
    ).toBe('northgate');
  });

  test('KW-FEATURE-FLAG: a page a college has not bought answers 200 with the 404 inside it', async ({ request }) => {
    const res = await request.get('/campus-events', { headers: asOther(), maxRedirects: 0 });
    const body = await res.text();

    expect(
      res.status(),
      [
        '',
        `/campus-events on a pack with publicLanding:false answered ${res.status()}.`,
        `  asserted: 200 (the known-wrong status)`,
        `  contract: ${KNOWN_WRONG['KW-FEATURE-FLAG'].shouldBe} (${KNOWN_WRONG['KW-FEATURE-FLAG'].doc})`,
        '',
        `  ${KNOWN_WRONG['KW-FEATURE-FLAG'].why}`,
        '',
        '  A 404 here is the fix landing. Update this test, update the /giving rows in',
        '  e2e/lib/routes.ts, and strike the ⚠ row from docs/STATUS-CODES.md §1.',
        '',
      ].join('\n'),
    ).toBe(200);

    expect(
      body.includes('NEXT_HTTP_ERROR_FALLBACK;404'),
      [
        '',
        'THE PUBLIC EVENTS PAGE RENDERED FOR A COLLEGE THAT HAS NOT BOUGHT IT.',
        '',
        '  The 200 is tolerable only because the body carries the not-found signal instead of the',
        '  page. Without that marker, a tenant with `publicLanding: false` is serving a public',
        '  events listing — content the college switched off, on a subdomain that is theirs.',
        '',
      ].join('\n'),
    ).toBe(true);
  });

  test('a session for one college is refused on another college’s host', async ({ request }) => {
    // The regression this pins: a DIET college_admin cookie sent to
    // northgate.localhost used to answer 200 with `tenantId: "ten-diet"`
    // and 21 KB of DIET member rows. A signature proves the payload was
    // not edited; it does not prove the payload belongs on this host.
    const res = await request.get('/api/auth/me', {
      headers: asOther(cookieFor('admin')),
      maxRedirects: 0,
    });

    expect(
      res.status(),
      [
        '',
        'A SESSION CROSSED A TENANT BOUNDARY.',
        '  A cookie minted for one college was accepted on another college’s host.',
        '  `getSession()` must compare the cookie’s tenantId against the tenant the Host',
        '  header resolved to, and return null when they disagree.',
        '',
        '  This is the isolation claim the whole product rests on. Do not weaken this test.',
        '',
      ].join('
'),
    ).toBe(401);
  });

  test('the same cookie still works on its own college’s host', async ({ request }) => {
    // The other half, and the reason the fix cannot simply refuse
    // everything: binding the cookie to a tenant must not lock a member
    // out of their own college.
    const res = await request.get('/api/auth/me', {
      headers: { cookie: cookieFor('admin') },
      maxRedirects: 0,
    });

    expect(res.status(), 'The tenant binding locked a member out of their own college.').toBe(200);
    const me = await res.json();
    expect(me.tenantId).toBe('ten-diet');
  });

  test('a college with the public landing switched off still exposes no member data', async ({ request }) => {
    // `publicLanding: false` makes `/` redirect to sign-in. The redirect lands
    // after the shell has flushed, so this is a 200 — what matters is that the
    // page behind it never listed anybody.
    const res = await request.get('/', { headers: asOther(), maxRedirects: 0 });
    const body = await res.text();

    expect(res.status()).toBe(200);

    expect(
      body,
      'The landing page of a college with publicLanding:false is rendering another college’s branding. ' +
        'The pack is resolved per request; if this is DIET copy, the brand cache is keyed on something ' +
        'that is not the tenant.',
    ).toContain('Northgate');

    for (const marker of ['@gmail.com', '@outlook.com', '@proton.me']) {
      expect(
        body.includes(marker),
        `An email address (${marker}) is on the unauthenticated landing page of ${OTHER_TENANT}. ` +
          'The directory is never anonymous, and the landing page reads aggregates only.',
      ).toBe(false);
    }
  });

  test('the directory is refused to an anonymous visitor on every host', async ({ request }) => {
    const res = await request.get('/api/directory', { headers: asOther(), maxRedirects: 0 });
    expect(
      res.status(),
      'A second tenant’s directory is readable without a session. The rule is not per-college: the ' +
        'directory is never anonymous, anywhere. A competitor shipped this list publicly; that is the ' +
        'failure this route exists not to repeat.',
    ).toBe(401);
  });
});
