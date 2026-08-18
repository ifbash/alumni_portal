import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';

import {
  CALLER_LABEL,
  DYNAMIC_LOGIN,
  KNOWN_WRONG,
  expectationFor,
  type Caller,
  type Expectation,
  type RouteRow,
} from './expectations';
import { cookieFor, state } from './state';

/**
 * Status assertion, with the message written for the person reading it at
 * 2am rather than for the person who wrote it.
 *
 * "expected 403 got 200" tells that person nothing they can act on. It
 * does not say whether to wake anyone up. So every failure here answers
 * three questions in order:
 *
 *   1. What is behind the URL that just opened? (`row.holds`)
 *   2. Who opened it?                            (`CALLER_LABEL`)
 *   3. What does that mean if it is real?        (the `meaning` line)
 *
 * A widened boundary and a narrowed one are different emergencies and are
 * labelled differently: `LEAK` when a refusal became an admission, `LOCKOUT`
 * when an admission became a refusal. A lockout is an outage; a leak is an
 * incident. Reading the wrong one at 2am costs an hour.
 */

const REFUSALS = new Set([401, 403, 404, 307, 302, 303]);

function isRefusal(status: number): boolean {
  return REFUSALS.has(status);
}

/**
 * `Location` is compared as a path.
 *
 * `/logout` answers with an absolute URL because it is built from the
 * request, so the origin varies with the port the suite is pointed at.
 * Comparing raw strings would make the table depend on 3300 vs 3401.
 */
function asPath(location: string | undefined): string {
  if (!location) return '(none)';
  try {
    const u = new URL(location, 'http://localhost');
    return `${u.pathname}${u.search}`;
  } catch {
    return location;
  }
}

/**
 * The sign-in redirect carries the path it bounced, so a row with a
 * dynamic segment cannot spell its own expectation. The table writes the
 * sentinel (`TO_LOGIN_DYNAMIC`) and it is resolved here, against the URL
 * actually requested.
 */
function resolveExpectation(expected: Expectation, url: string): Expectation {
  if (expected.location !== DYNAMIC_LOGIN) return expected;
  return { ...expected, location: `/login?next=${encodeURIComponent(url)}` };
}

/** GET has no body; everything else carries JSON so the handler reaches its guard. */
export async function probe(
  request: APIRequestContext,
  row: RouteRow,
  caller: Caller,
): Promise<APIResponse> {
  const url = row.path(state().ids);
  const headers: Record<string, string> = { ...cookieFor(caller) };
  const options = {
    headers,
    /**
     * The single most important option in this file. With redirects
     * followed, a 401 on `/api/directory` arrives as a 200 full of
     * sign-in markup and every refusal in the suite reads as an
     * admission — the exact failure `src/lib/auth/route-policy.ts`
     * documents for `fetch(..., { redirect: 'follow' })`.
     */
    maxRedirects: 0,
    timeout: 90_000,
    failOnStatusCode: false,
  };

  switch (row.method) {
    case 'GET': {
      /**
       * Bounded retry on 5xx, for GET only.
       *
       * `next dev` compiles a route on first request and can answer 500
       * while it is still doing so — measured, repeatedly, on a loaded
       * machine. Retrying a GET is free; retrying a POST is not, so the
       * other verbs below get exactly one attempt. A 5xx that survives
       * three tries is returned and fails the assertion, which is right:
       * a route that reliably 500s is a finding.
       */
      let last = await request.get(url, options);
      for (let i = 0; i < 2 && last.status() >= 500; i++) {
        await new Promise((r) => setTimeout(r, 1_000 * (i + 1)));
        last = await request.get(url, options);
      }
      return last;
    }
    case 'POST':
      return request.post(url, { ...options, data: row.body ?? {} });
    case 'PATCH':
      return request.patch(url, { ...options, data: row.body ?? {} });
    case 'PUT':
      return request.put(url, { ...options, data: row.body ?? {} });
    case 'DELETE':
      return request.delete(url, { ...options, data: row.body ?? {} });
  }
}

function meaningOf(expected: Expectation, observed: number, row: RouteRow, caller: Caller): string {
  const who = CALLER_LABEL[caller];

  if (isRefusal(expected.status) && !isRefusal(observed)) {
    return (
      `LEAK. ${who} has just been ADMITTED to ${row.holds}, and the contract says refused.\n` +
      `      Assume the content is reachable until you have opened the body and proved it is not. ` +
      `A 200 that used to be a refusal is the failure this suite exists to catch.`
    );
  }
  if (!isRefusal(expected.status) && isRefusal(observed)) {
    return (
      `LOCKOUT, not a leak. ${who} is being REFUSED ${row.holds}, and the contract says admitted.\n` +
      `      Nothing has leaked. Somebody legitimate cannot do their job — check for a narrowed ` +
      `capability grant or a guard that moved.`
    );
  }
  if (isRefusal(expected.status) && isRefusal(observed)) {
    return (
      `Refused either way, but not in the documented manner. No leak. ` +
      `A refusal that changes shape breaks clients that branch on the status, ` +
      `and a 307 to the wrong place is how a redirect loop starts.`
    );
  }
  return (
    `Admitted either way, but the status changed. No leak, but a caching layer, ` +
    `an uptime monitor or a client branching on \`response.ok\` will now see something different.`
  );
}

export async function assertStatus(
  request: APIRequestContext,
  row: RouteRow,
  caller: Caller,
  soft = false,
): Promise<APIResponse> {
  const url = row.path(state().ids);
  const expected = resolveExpectation(expectationFor(row, caller), url);
  const response = await probe(request, row, caller);
  const observed = response.status();
  const where = `${row.method} ${url}`;
  const check = soft ? expect.soft : expect;

  // -------------------------------------------------------------
  // Known-wrong rows assert inverted: the fix is what fails.
  // -------------------------------------------------------------
  if (expected.knownWrong) {
    const kw = KNOWN_WRONG[expected.knownWrong];

    if (observed === kw.shouldBe && observed !== expected.status) {
      const message =
        [
          '',
          `A KNOWN-WRONG CASE HAS BEEN FIXED. This test is now the stale one — update it.`,
          '',
          `  case:     ${expected.knownWrong}  (${kw.doc})`,
          `  request:  ${where}`,
          `  caller:   ${CALLER_LABEL[caller]}`,
          `  holds:    ${row.holds}`,
          `  observed: ${observed} — which is exactly what the contract has always said it should be.`,
          `  asserted: ${expected.status} — which is what it actually did when this suite was written.`,
          '',
          `  ${kw.why}`,
          '',
          `  What to do: this is good news. In e2e/lib/routes.ts, drop the \`knownWrong\` marker`,
          `  on this row and set the expectation to ${kw.shouldBe}. Then strike the matching ⚠ row`,
          `  from docs/STATUS-CODES.md §1 and delete its section in §5.`,
          '',
        ].join('\n');
      // Routed through expect() rather than thrown, so a soft run collects it
      // with the rest of the row instead of aborting on the first fixed case.
      check(observed, message).toBe(expected.status);
      return response;
    }

    check(
      observed,
      [
        '',
        `Known-wrong case ${expected.knownWrong} changed to something nobody predicted.`,
        `  request:  ${where}`,
        `  caller:   ${CALLER_LABEL[caller]}`,
        `  holds:    ${row.holds}`,
        `  asserted: ${expected.status} (today's wrong-but-harmless behaviour)`,
        `  contract: ${kw.shouldBe} (${kw.doc})`,
        `  observed: ${observed} — neither.`,
        '',
        `  ${kw.why}`,
        '',
      ].join('\n'),
    ).toBe(expected.status);

    return response;
  }

  // -------------------------------------------------------------
  // The ordinary case
  // -------------------------------------------------------------
  const accepted = [expected.status, ...(expected.alsoAccept ?? [])];
  check(
    accepted.includes(observed) ? expected.status : observed,
    [
      '',
      `  request:  ${where}`,
      `  caller:   ${CALLER_LABEL[caller]}`,
      `  holds:    ${row.holds}`,
      `  expected: ${accepted.join(' or ')}${expected.location ? ` → ${expected.location}` : ''}${expected.note ? `  (${expected.note})` : ''}`,
      `  observed: ${observed}${response.headers().location ? ` → ${asPath(response.headers().location)}` : ''}`,
      '',
      `  ${meaningOf(expected, observed, row, caller)}`,
      '',
    ].join('\n'),
  ).toBe(expected.status);

  if (expected.location && observed === expected.status) {
    const location = asPath(response.headers().location);
    check(
      location,
      [
        '',
        `The status is right and the destination is not.`,
        `  request:  ${where}`,
        `  caller:   ${CALLER_LABEL[caller]}`,
        `  expected: ${expected.status} → ${expected.location}`,
        `  observed: ${expected.status} → ${location}`,
        '',
        `  A refusal that redirects to the wrong place is either a redirect loop`,
        `  (bouncing somebody back to the page that bounced them) or an open redirect`,
        `  (\`next\` was not sanitised — see safeNextParam() in src/lib/auth/route-policy.ts).`,
        '',
      ].join('\n'),
    ).toBe(expected.location);
  }

  return response;
}
