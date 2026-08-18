import { test } from '@playwright/test';

import { assertStatus } from './lib/assert-status';
import { CALLERS } from './lib/expectations';
import { ROUTES } from './lib/routes';
import { state } from './lib/state';

/**
 * Every route × every caller, against the table in `lib/routes.ts`.
 *
 * One test per route rather than one per cell. Two reasons, and the
 * second is the one that matters:
 *
 *  1. Ten sequential requests to a route that Next has just compiled is
 *     far cheaper than ten tests each racing a cold compiler.
 *  2. `expect.soft` inside the loop means one route reports **all ten**
 *     of its callers in a single failure. "The student got in" and "the
 *     operator got locked out" on the same screen are one story, and
 *     seeing them together is what tells you whether a guard moved or a
 *     grant changed.
 *
 * Adding a route is one line in `lib/routes.ts`. Adding a role is one
 * entry in `CALLERS` plus one cookie in `fixtures/collect.ts`. Nothing is
 * added here.
 */

test.describe('status matrix', () => {
  test.describe.configure({ mode: 'default' });

  for (const row of ROUTES) {
    // Resolved once, at collection time, so the test name is the real URL
    // and a failure in the report is greppable against the server log.
    const url = row.path(state().ids);

    test(`${row.method} ${url}`, async ({ request }) => {
      test.info().annotations.push({ type: 'holds', description: row.holds });

      for (const caller of CALLERS) {
        await assertStatus(request, row, caller, true);
      }
    });
  }
});
