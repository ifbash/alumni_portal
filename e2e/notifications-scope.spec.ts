import { expect, test } from '@playwright/test';

import { stableGet } from './lib/http';
import { cookieFor } from './lib/state';

/**
 * KW-NOTIFICATIONS-UNSCOPED.
 *
 * Found by this suite, not by the docs. `getNotifications(session)` in
 * `src/lib/data/repo.ts` opens with `void session` and returns the same
 * static `NOTIFICATIONS` array to every caller, so the notification bell
 * in `AppShell` renders identically for all nine roles — including the
 * vendor, whose entire product promise is that they cannot read a
 * college's member data.
 *
 * The first item in that array is
 *
 *     "Harika Nallamothu wants to connect"
 *     "Final-year CSE student asking about interview preparation."
 *
 * — a named final-year student and the fact that she has asked somebody
 * for mentorship, rendered into the HTML of every page the vendor opens,
 * `/admin/*` included, and returned by `/api/notifications` for every
 * session.
 *
 * ── Why this asserts the leak rather than failing on it ──────────────
 *
 * It is a fixture-mode shortcut: `void session` is an explicit "not
 * implemented", and in DB mode the query would be keyed on the member.
 * But fixture mode is not a toy — it is how the product is demonstrated
 * before a college has signed anything, which means this is what a
 * prospective customer's IT head sees if they open the vendor console
 * during a sales call. So it is registered exactly like the two
 * known-wrong rows from `docs/STATUS-CODES.md`: encoded as it behaves
 * today, and written so that fixing it fails this test loudly.
 */

const LEAKED_NAME = 'Harika Nallamothu';

test.describe('notification scoping', () => {
  test('each role is served only its own notifications', async ({ request }) => {
    // The regression this pins: `getNotifications(session)` opened with
    // `void session` and returned one static list to everybody, so five
    // roles received a byte-identical body.
    const bodies = new Map<string, string>();

    for (const caller of ['student', 'alumni', 'admin', 'platform', 'finance'] as const) {
      const res = await request.get('/api/notifications', { headers: cookieFor(caller), maxRedirects: 0 });
      expect(res.status()).toBe(200);
      bodies.set(caller, await res.text());
    }

    expect(
      new Set(bodies.values()).size,
      [
        '',
        'EVERY ROLE RECEIVED THE SAME NOTIFICATION LIST.',
        '  `getNotifications()` is ignoring its session argument again. A function that takes a',
        '  session and does nothing with it is worse than one that never took it: every caller',
        '  reads as authorised.',
        '',
      ].join('
'),
    ).toBeGreaterThan(1);
  });

  test('the vendor is not served a named student’s connection request', async ({ request }) => {
    // What the unscoped list actually did: rendered "Harika Nallamothu
    // wants to connect — final-year CSE student asking about interview
    // preparation" into every page platform_admin opened. The vendor runs
    // the infrastructure and cannot read the data on it; a notification is
    // data about a person.
    const res = await stableGet(request, '/admin', cookieFor('platform'));
    const body = await res.text();

    expect(
      body.includes(LEAKED_NAME),
      [
        '',
        'A NAMED STUDENT IS BACK IN THE VENDOR CONSOLE.',
        `  "${LEAKED_NAME}" appears in a page platform_admin can open. Check getNotifications()`,
        '  is still filtering on session.memberId, and that no other panel renders an',
        '  unscoped list.',
        '',
      ].join('
'),
    ).toBe(false);

    // The boundary behind it, unchanged.
    expect(body).not.toContain('@gmail.com');
    expect(body).not.toMatch(/\d{2}[A-Z]{2}\d[A-Z]\d{4}/);
  });

  test('a member sees their own notifications', async ({ request }) => {
    // Scoping must not mean emptying: the demo alumnus has three.
    const res = await request.get('/api/notifications', { headers: cookieFor('alumni'), maxRedirects: 0 });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length, 'The alumnus lost their own notifications.').toBeGreaterThan(0);
  });
});
