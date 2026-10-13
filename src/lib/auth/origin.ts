/**
 * Cross-site request forgery defence for cookie-authenticated mutations.
 *
 * `SameSite=Lax` is a browser default, not a control this application owns,
 * and it does not help between colleges: tenants are sibling subdomains of
 * one registrable domain, so a page on `northgate.portal.example` is
 * *same-site* with `diet.portal.example` and its credentialed POSTs carry
 * the session cookie. This refuses any state-changing request whose browser
 * metadata says it did not originate from this exact origin.
 *
 * Browsers always send `Origin` on a cross-origin POST/PUT/PATCH/DELETE and
 * `Sec-Fetch-Site` on every request. A caller that sends neither is not a
 * browser - curl, a server-to-server job, the test runner - and has no
 * ambient cookie to abuse, so it is let through; the guards still apply.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface OriginHeaders {
  get(name: string): string | null;
}

/** True when this request is a mutation that a browser says came from somewhere else. */
export function isCrossSiteMutation(method: string, headers: OriginHeaders): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false;

  // `same-site` is deliberately refused: it is another college's subdomain.
  const fetchSite = headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return true;

  const origin = headers.get('origin');
  if (origin === null) return false;

  const host = headers.get('host');
  if (!host) return true;

  try {
    return new URL(origin).host.toLowerCase() !== host.toLowerCase();
  } catch {
    // `Origin: null` (sandboxed frames, some redirects) and garbage alike.
    return true;
  }
}

export const CROSS_SITE_BODY = {
  error: 'Cross-site request refused',
  code: 'cross_site_request',
} as const;
