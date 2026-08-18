import type { APIRequestContext, APIResponse } from '@playwright/test';

/**
 * One request, with a bounded retry on 5xx.
 *
 * This exists for `next dev` and for nothing else. A dev server compiles a
 * route on its first request, and under load that first request can time
 * out or answer 500 while webpack is still writing the chunk — measured on
 * this machine, repeatedly, with several agents building at once. A
 * permission suite that reports "the vendor was admitted" because the
 * compiler was busy is a suite people stop reading.
 *
 * It is deliberately narrow:
 *
 *  - **5xx only.** A 403 is never retried, a 200 is never retried. Nothing
 *    about an authorisation decision is smoothed over here.
 *  - **Bounded, and it gives up honestly.** After the last attempt the
 *    response is returned as-is, so a genuine 500 fails the assertion that
 *    asked for it rather than hanging.
 *  - Against a production build (`next start`) it never fires, because
 *    there is nothing left to compile.
 */
export async function stableGet(
  request: APIRequestContext,
  url: string,
  headers: Record<string, string>,
  attempts = 3,
): Promise<APIResponse> {
  let last: APIResponse | null = null;
  for (let i = 0; i < attempts; i++) {
    last = await request.get(url, { headers, maxRedirects: 0, timeout: 90_000, failOnStatusCode: false });
    if (last.status() < 500) return last;
    await new Promise((r) => setTimeout(r, 1_000 * (i + 1)));
  }
  return last!;
}

/**
 * Compile the route before anything is measured.
 *
 * `console-refusals.spec.ts` compares the size of an entitled reader's page
 * against a refused reader's. On a cold dev server the *first* of those two
 * can be an error page — smaller than the refusal — and the comparison then
 * reports a leak that is really a compiler. One throwaway request removes
 * the whole class.
 */
export async function warm(
  request: APIRequestContext,
  url: string,
  headers: Record<string, string>,
): Promise<void> {
  await stableGet(request, url, headers);
}
