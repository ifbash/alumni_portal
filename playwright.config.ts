import { defineConfig } from '@playwright/test';

/**
 * The permission regression suite.
 *
 * BACKLOG.md calls this "the regression net that stops a refactor quietly
 * widening access". It is not a UI suite and does not try to be: nearly
 * everything here is an HTTP probe with a cookie on it, because a
 * permission boundary is a property of the response, not of the pixels.
 * Exactly one spec drives a real browser — the OTP sign-in flow, which is
 * the path every demo starts with and where a break is total.
 *
 * ── Running it ────────────────────────────────────────────────────────
 *
 *   npm run test:e2e
 *
 * against a dev server on port 3300. If one is already up it is reused;
 * otherwise Playwright starts one. Point somewhere else with
 * `E2E_BASE_URL=http://localhost:3456 npm run test:e2e`, in which case no
 * server is started at all.
 *
 * ── Run the full sweep against a production build ─────────────────────
 *
 *   npm run build && npm start -- --port 3401
 *   E2E_BASE_URL=http://localhost:3401 npm run test:e2e
 *
 * This is not a preference. The matrix is ~1,400 requests, and `next dev`
 * compiles a route on first hit and holds every compiled module: measured
 * here, the dev server climbed past its heap ceiling around the 600th
 * request and printed *"Server is approaching the used memory threshold,
 * restarting…"*, which drops in-flight requests and fails a dozen
 * assertions for a reason that has nothing to do with authorisation. The
 * same run against `next start` finishes in about ninety seconds with no
 * retries used.
 *
 * The exception is `otp-signin.spec.ts`, which **needs** a dev server:
 * `OTP_ECHO` is `IS_FIXTURE && NODE_ENV !== 'production'`, so a production
 * build never echoes the code and the spec skips itself with that reason
 * printed. Run it on its own against dev:
 *
 *   E2E_BASE_URL=http://localhost:3300 npm run test:e2e -- otp-signin
 *
 * ── Why so few workers ────────────────────────────────────────────────
 *
 * Parallelism past two does not help — against a dev server the
 * bottleneck is one Next compiler, and fixture mode holds the whole
 * dataset in memory, so piling workers on brings the memory ceiling
 * closer rather than the finish line.
 *
 * ── Why the rate limits matter here ───────────────────────────────────
 *
 * `limit()` in `src/app/api/_lib/http.ts` is real in fixture mode: three
 * member exports an hour, five OTPs per address per fifteen minutes. The
 * suite is written to stay under those, and the two rows that can
 * legitimately answer 429 say so (`alsoAccept` in `e2e/lib/routes.ts`).
 * Running the whole file in a tight loop will still trip them eventually;
 * that is the app working, not the suite failing, and a restarted server
 * clears the counters.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3300';
const PORT = Number(new URL(BASE_URL).port || 3300);

/** Only manage a server when we are pointed at the default local one. */
const MANAGES_SERVER = !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.state/artifacts',
  /**
   * Generous, on purpose.
   *
   * The status matrix is ~1,400 requests, and against `next dev` each route
   * is compiled on its first hit — measured at 10-30 seconds a route on a
   * loaded machine. Tight timeouts here do not catch a slow app; they
   * convert a busy compiler into a false "the vendor was admitted", which
   * is the one thing this suite must never say wrongly. Against a
   * production build the whole file runs in under two minutes and none of
   * these numbers is reached.
   */
  timeout: 300_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: process.env.CI ? 1 : 2,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list', { printSteps: false }]],

  globalSetup: './e2e/global-setup.ts',

  use: {
    baseURL: BASE_URL,
    /**
     * Off, everywhere. A permission suite that follows redirects cannot
     * tell a 401 from a 200 full of sign-in markup — which is the exact
     * failure `route-policy.ts` documents for `fetch(..., {redirect:'follow'})`.
     */
    extraHTTPHeaders: { 'accept-language': 'en-IN,en' },
    /** Also the ceiling on an APIRequestContext call, which is why it is not 20s. */
    actionTimeout: 60_000,
    navigationTimeout: 120_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'permissions',
      testMatch: /.*\.spec\.ts/,
      use: { browserName: 'chromium' },
    },
  ],

  ...(MANAGES_SERVER
    ? {
        webServer: {
          command: `npm run dev -- --port ${PORT}`,
          port: PORT,
          /** Never kill somebody else's dev server, and never race a colleague's. */
          reuseExistingServer: true,
          timeout: 180_000,
          stdout: 'ignore',
          stderr: 'pipe',
        },
      }
    : {}),
});
