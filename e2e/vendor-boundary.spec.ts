import { expect, test } from '@playwright/test';

import { stableGet } from './lib/http';
import { emailsIn, mobilesIn, rollNumbersIn } from './lib/leaks';
import { ROUTES } from './lib/routes';
import { cookieFor, state } from './lib/state';

/**
 * The vendor cannot read customer data.
 *
 * `platform_admin` provisions colleges and configures branding, and holds
 * exactly three capabilities: `tenant.provision`, `tenant.configure`,
 * `audit.read`. No `profile.*`, no `directory.*`, no `member.export`, no
 * `data_request.manage`. CLAUDE.md calls this "the central promise of
 * selling the portal as a hosted product", and it has broken once already
 * — the DPDP queue was gated on `tenant.configure`, which the vendor
 * holds.
 *
 * `tests/vendor-boundary.test.ts` pins the capability matrix. This pins
 * the **wire**: every `/admin` route walked with the vendor's cookie, and
 * every response read for a member's email address, mobile number or roll
 * number. A capability matrix that is right and a page that reads the
 * repository before it guards are both possible at once.
 *
 * Note what is *not* asserted: a refusal status. The vendor is admitted
 * to `/admin` by the coarse gate (they hold staff capabilities) and every
 * screen answers 200 — see KW-CONSOLE-SCREEN in `lib/expectations.ts`.
 * The only thing that matters here is what is in the body.
 */

/**
 * Every console page the vendor can reach: the customer's `/admin`, where
 * they are admitted by the coarse gate and refused screen by screen, and
 * their own `/platform`, where they are admitted properly. Both matter.
 * `/platform` is the one place the vendor is *meant* to be, which makes it
 * the likeliest place for a member row to be pulled in beside a tenant
 * count without anyone thinking twice about it.
 */
const CONSOLE_ROUTES = ROUTES.filter((r) => {
  if (r.method !== 'GET') return false;
  const url = r.path(state().ids);
  return url.startsWith('/admin') || url.startsWith('/platform');
});

test.describe('platform_admin — the vendor — cannot reach member data', () => {
  test('holds exactly three capabilities and none of them is about members', async ({ request }) => {
    const res = await request.get('/api/auth/me', { headers: cookieFor('platform'), maxRedirects: 0 });
    expect(res.status()).toBe(200);
    const me = await res.json();

    expect([...(me.capabilities as string[])].sort()).toEqual(
      ['audit.read', 'tenant.configure', 'tenant.provision'].sort(),
    );

    const memberish = (me.capabilities as string[]).filter(
      (c) => c.startsWith('profile.') || c.startsWith('directory.') || c === 'member.export' || c === 'data_request.manage',
    );
    expect(
      memberish,
      [
        '',
        'THE VENDOR HAS BEEN GRANTED A MEMBER-DATA CAPABILITY.',
        `  new grants: ${memberish.join(', ')}`,
        '',
        '  This is the promise the product is sold on: ifBash runs the infrastructure and cannot',
        '  read what is on it. It broke once before, when the DPDP fulfilment queue was gated on',
        '  `tenant.configure` — a capability the vendor holds — which put the vendor inside the',
        '  college’s subject-rights process. `data_request.manage` exists as a separate capability',
        '  because of that incident.',
        '',
      ].join('\n'),
    ).toEqual([]);
  });

  for (const row of CONSOLE_ROUTES) {
    const url = row.path(state().ids);

    test(`no member data at ${url}`, async ({ request }) => {
      const res = await stableGet(request, url, cookieFor('platform'));
      const body = await res.text();

      const emails = emailsIn(body);
      const rolls = rollNumbersIn(body);
      const mobiles = mobilesIn(body);

      const found = [
        emails.length ? `${emails.length} email address(es): ${emails.slice(0, 5).join(', ')}` : null,
        rolls.length ? `${rolls.length} roll number(s): ${rolls.slice(0, 5).join(', ')}` : null,
        mobiles.length ? `${mobiles.length} mobile number(s): ${mobiles.slice(0, 3).join(', ')}` : null,
      ].filter(Boolean);

      expect(
        found,
        [
          '',
          'THE VENDOR IS READING THE COLLEGE’S MEMBER DATA.',
          `  request: GET ${url}  (status ${res.status()})`,
          `  holds:   ${row.holds}`,
          `  found:   ${found.join(' | ')}`,
          '',
          '  What this means: ifBash — the company selling this portal — can see the personal data',
          '  of a customer college’s alumni from its own console. That is not a permission bug with',
          '  a blast radius of one screen; it is the end of the sentence "the vendor cannot read',
          '  your data", which is on the pricing page and in every procurement conversation.',
          '',
          '  Check in this order: (1) did a page start reading the repository before calling',
          '  require()? (2) did a capability move into the platform_admin grant list in',
          '  src/lib/auth/permissions.ts? (3) is a shared component (nav badge, notification',
          '  bell, recent-activity strip) reading member rows without a viewer?',
          '',
        ].join('\n'),
      ).toEqual([]);
    });
  }

  test('every member-data API refuses the vendor', async ({ request }) => {
    const s = state();
    const endpoints: Array<[string, string]> = [
      ['/api/directory', 'the alumni directory'],
      [`/api/members/${s.ids.memberSlug}`, "one member's profile"],
      ['/api/directory?cohort=students', 'the student cohort'],
      ['/api/admin/members/export', 'the bulk contact export description'],
      ['/api/admin/degree-register/search?q=a', 'the degree register'],
    ];

    for (const [url, what] of endpoints) {
      const res = await request.get(url, { headers: cookieFor('platform'), maxRedirects: 0 });
      expect(
        res.status(),
        [
          '',
          `The vendor was not refused ${what}.`,
          `  request:  GET ${url}`,
          `  observed: ${res.status()}`,
          '',
          '  Every one of these is member data, and platform_admin holds no directory or profile',
          '  capability at all. A 200 here is the hosted-product promise failing at the API rather',
          '  than at a screen — which is worse, because it is scriptable.',
          '',
        ].join('\n'),
      ).toBe(403);
    }
  });

  test('the college admin cannot provision tenants, and the vendor can', async ({ request }) => {
    // The boundary is a wall, not a ceiling: it has to hold in both directions,
    // or "the vendor cannot read member data" quietly becomes "the vendor is
    // simply a bigger admin".
    const asAdmin = await request.post('/api/platform/tenants', {
      headers: cookieFor('admin'),
      data: {},
      maxRedirects: 0,
    });
    expect(
      asAdmin.status(),
      'A college_admin reached tenant provisioning. `tenant.provision` is platform_admin and nobody else — ' +
        'a college that can provision colleges is a multi-tenant boundary with a hole in it.',
    ).toBe(403);

    const asVendor = await request.post('/api/platform/tenants', {
      headers: cookieFor('platform'),
      data: {},
      maxRedirects: 0,
    });
    expect(
      asVendor.status(),
      'The vendor cannot provision a tenant. LOCKOUT, not a leak — this is the one job platform_admin has.',
    ).toBe(422);
  });
});
