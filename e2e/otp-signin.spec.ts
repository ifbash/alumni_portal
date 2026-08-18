import { expect, test } from '@playwright/test';

/**
 * The OTP sign-in flow, driven through the real UI.
 *
 * Everything else in this suite carries a minted cookie, which means
 * everything else in this suite would stay green through a total failure
 * of the front door. This is the one spec that opens a browser, and it is
 * the path every demo starts with: a break here is not a permission bug,
 * it is nobody getting in at all.
 *
 * Fixture mode echoes the code — `OTP_ECHO` is `IS_FIXTURE && NODE_ENV
 * !== 'production'`, computed once in `src/lib/config.ts`, with no
 * request parameter, header or cookie that can turn it on. The login form
 * stashes it in `sessionStorage` rather than the query string, because a
 * sign-in code does not belong in browser history, and the verify screen
 * reads it back and offers to fill it in.
 *
 * ── Rate limits ──────────────────────────────────────────────────────
 *
 * `/api/auth/otp` allows five codes per address per fifteen minutes. This
 * spec asks for exactly one, and always for the same address, so running
 * the suite four times in a row is fine and the fifth will start seeing
 * 429s. That is the app working.
 */

const DEMO_EMAIL = 'student@diet.ac.in';

test.describe('sign-in', () => {
  test.describe.configure({ mode: 'serial' });

  /**
   * `OTP_ECHO` is `IS_FIXTURE && NODE_ENV !== 'production'` — a
   * compile-time constant, with no request parameter, header or cookie
   * that can turn it on. Against `next start` it is therefore **off**,
   * which is correct and is the entire security property, and it means
   * there is no way for this spec to learn a code.
   *
   * So it skips, loudly, rather than pretending to cover the flow. Run
   * the suite against `next dev` to exercise it — which is where a demo
   * runs anyway.
   */
  test.beforeEach(async ({ request }, testInfo) => {
    // Probed with a throwaway address, not the demo one. `/api/auth/otp` is
    // deliberately not a member-enumeration oracle — it mints a code for any
    // well-formed address and simply never delivers it — so this answers the
    // "is the echo on" question without spending one of the five codes per
    // fifteen minutes that the real flow below needs.
    const res = await request.post('/api/auth/otp', {
      data: { email: 'e2e-echo-probe@example.com' },
      maxRedirects: 0,
    });
    if (res.status() === 429) {
      testInfo.skip(
        true,
        'Rate limited: five codes per address per fifteen minutes. That is the app working — re-run later.',
      );
      return;
    }
    const body = await res.json();
    testInfo.skip(
      !body.devCode,
      'The server is not echoing sign-in codes, so this flow cannot be driven. OTP_ECHO is ' +
        "`IS_FIXTURE && NODE_ENV !== 'production'`, so a production build (`next start`) never echoes — " +
        'correctly. Point the suite at a dev server to cover the sign-in path: ' +
        'E2E_BASE_URL=http://localhost:3300 npm run test:e2e',
    );
  });

  test('a member signs in with an emailed code, and that session obeys the same rules', async ({
    page,
    context,
  }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in', level: 1 })).toBeVisible();

    // The demo account picker is fixture-mode only and fills the field.
    const demoButton = page.getByRole('button', { name: /Final-year student/ });
    await expect(
      demoButton,
      'The demonstration-account list is missing from the sign-in screen. In fixture mode it is how ' +
        'every demo starts, and its absence usually means the app resolved a real DATA_MODE.',
    ).toBeVisible();
    await demoButton.click();

    await expect(page.locator('#email')).toHaveValue(DEMO_EMAIL);

    await page.getByRole('button', { name: /Email me a sign-in code/ }).click();

    // ---- the verify screen --------------------------------------
    await page.waitForURL(/\/verify\?/, { timeout: 90_000 });

    const devNotice = page.getByText('Development mode — no email was sent');
    await expect(
      devNotice,
      [
        '',
        'The verify screen did not show the echoed code.',
        '',
        '  In fixture mode `/api/auth/otp` returns `devCode` and the login form stashes it in',
        '  sessionStorage under `otp-dev:<email>`. If it is missing, either OTP_ECHO is off (which',
        '  it must be in production and must NOT be here) or the stash/read pair has drifted apart —',
        '  and every demo of this product now begins with a code nobody can obtain.',
        '',
      ].join('\n'),
    ).toBeVisible({ timeout: 45_000 });

    await page.getByRole('button', { name: 'Fill it in' }).click();

    // The form auto-submits on the sixth digit.
    await page.waitForURL(/\/dashboard/, { timeout: 90_000 });

    await expect(
      page.getByRole('link', { name: /Directory/ }).first(),
      'Signed in, but the member navigation is not there. The session cookie was issued and the shell ' +
        'did not accept it.',
    ).toBeVisible({ timeout: 45_000 });

    // ---- and the session this issued is the one the API honours ---
    //
    // In the same test, not a following one: Playwright gives each test a
    // fresh browser context, so a second test would carry no cookie and
    // would assert nothing but its own emptiness.
    const me = await context.request.get('/api/auth/me', { maxRedirects: 0 });
    expect(
      me.status(),
      'The cookie the sign-in flow issued is not accepted by /api/auth/me. The UI and the API are ' +
        'reading different sessions, which is how a permission suite full of minted cookies can be ' +
        'entirely green while nobody can actually use the product.',
    ).toBe(200);

    const body = await me.json();
    expect(body.roles.map((r: { role: string }) => r.role)).toContain('student');

    // …and that session is subject to the same rules as a minted one.
    const students = await context.request.get('/api/directory?cohort=students', { maxRedirects: 0 });
    expect(
      students.status(),
      'A session created through the real sign-in flow was allowed to enumerate students, where a ' +
        'minted one is refused. If these two ever disagree, every other assertion in this suite is ' +
        'testing a session shape the product does not actually issue.',
    ).toBe(403);

    await page.goto('/logout');
  });

  test('a wrong code is refused and does not create a session', async ({ page, context }) => {
    await page.goto('/login');
    await page.locator('#email').fill(DEMO_EMAIL);
    await page.getByRole('button', { name: /Email me a sign-in code/ }).click();
    await page.waitForURL(/\/verify\?/, { timeout: 90_000 });

    const boxes = page.getByRole('textbox', { name: /Digit \d of 6/ });
    await expect(boxes.first()).toBeVisible({ timeout: 45_000 });

    // Six digits that are not the code. `000000` is as good as any: the
    // point is that a guess is a guess.
    for (let i = 0; i < 6; i++) await boxes.nth(i).fill('0');

    await expect(
      page.getByText(/not right|expired|cancelled/i).first(),
      'A wrong six-digit code produced no refusal. Either the code was accepted, or the screen fails ' +
        'silently — and a sign-in screen that fails silently is indistinguishable from a broken one.',
    ).toBeVisible({ timeout: 45_000 });

    await expect(page).toHaveURL(/\/verify/);

    const me = await context.request.get('/api/auth/me', { maxRedirects: 0 });
    expect(
      me.status(),
      'A session exists after a wrong code was entered.',
    ).toBe(401);
  });
});
