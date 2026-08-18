import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_TENANT, SESSION_COOKIE } from '@/lib/config';
import { THEME_BOOT_CSP_HASH } from '@/lib/theme-boot';
import {
  FORBIDDEN_BODY,
  UNAUTHENTICATED_BODY,
  UNAUTHORISED_REDIRECT,
  holdsAnyCapability,
  loginRedirectPath,
  policyFor,
  readSessionMemberId,
  type CoarseViewer,
  type RouteRule,
} from '@/lib/auth/route-policy';
import type { Role } from '@/lib/auth/permissions';

/**
 * The work that has to happen before anything renders: which college is
 * this request for, what is the resulting document allowed to load, and
 * — for a signed-in surface — is this caller admitted to it at all.
 *
 * Deliberately does not look up the tenant. Middleware runs on every
 * request, including ones that turn out to be 404s and ones served from
 * cache, and a tenant lookup here would put a query in front of all of
 * them for a value `getTenant()` resolves and caches anyway. All this
 * does is parse the Host header once, so route handlers do not each
 * re-derive it, set the headers that have to vary per request, and turn
 * away callers before a render begins.
 *
 * It *does* look up the member, on exactly the two prefixes that declare
 * a capability requirement — `/admin` and `/platform`. That is a
 * deliberate, bounded exception to "no storage from middleware", argued
 * at the top of `src/lib/auth/route-policy.ts` and costed in
 * `docs/STATUS-CODES.md`. Nothing else pays for it: a request to
 * `/dashboard`, `/directory` or any `/api` route asks a question the
 * cookie alone answers, and the module holding the member data is not
 * even imported until a console request arrives.
 *
 * On the gate generally: see the long note at the top of
 * `src/lib/auth/route-policy.ts`. The short version is that it is a
 * coarse pre-filter whose entire job is returning an honest status code,
 * and it is **not** the authorisation model. Every page and every route
 * handler still calls `getSession()` and `require(session, …)` for
 * itself, and those are the authority. Do not delete a page guard because
 * a prefix appears in the policy table.
 */

const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * Mirrors `subdomainFrom()` in src/lib/tenant.ts.
 *
 * Duplicated rather than imported because tenant.ts pulls in
 * `next/headers`, React `cache()` and the entire fixture dataset — none of
 * which belong in a bundle that runs on every request at the edge. The two
 * must stay in step: if you change how a host maps to a tenant in one,
 * change it in the other, or the header and the resolved tenant disagree
 * and the bug looks like a caching problem.
 */
function subdomainFrom(host: string): string | null {
  const clean = host.split(':')[0]?.toLowerCase() ?? '';
  if (!clean) return null;

  const isLocal =
    clean === 'localhost' ||
    clean.endsWith('.localhost') ||
    clean === '127.0.0.1' ||
    clean.endsWith('.vercel.app');

  if (isLocal) {
    const sub = clean.endsWith('.localhost') ? clean.replace('.localhost', '') : null;
    return sub ?? DEFAULT_TENANT;
  }

  const parts = clean.split('.');
  if (parts.length < 3) return null;
  return parts[0] ?? null;
}

/** 128 bits, base64. Regenerated per request — a reused nonce is no nonce. */
function makeNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * Content-Security-Policy.
 *
 * `script-src` carries a per-request nonce. The root layout injects an
 * inline theme <script> that reads the theme cookie and sets the class on
 * <html> before first paint; that script is load-bearing — without it every
 * navigation flashes the wrong theme — and it must therefore carry the
 * nonce:
 *
 *     const nonce = (await headers()).get('x-nonce') ?? undefined;
 *     <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
 *
 * Next.js finds the nonce itself for its own bootstrap scripts, by parsing
 * it back out of the CSP header we set on the *request* below. Hand-written
 * inline scripts are on their own. A blocked theme script fails silently
 * apart from the flash, so it is worth checking the console once after any
 * change to the layout.
 *
 * `style-src` keeps 'unsafe-inline', and that is not laziness:
 *
 *  1. A nonce cannot be applied to a style *attribute* — there is no
 *     syntax for it. Inline `style={{ ... }}` props are how token values
 *     reach the DOM in the chart components and anywhere a width or a
 *     custom property is computed, and those attributes fall through
 *     `style-src-attr` to `style-src`. Dropping 'unsafe-inline' means
 *     deleting every one of them or enumerating a hash per attribute,
 *     which no bar chart survives.
 *  2. Adding a nonce to `style-src` would make things *worse*: under CSP3
 *     a nonce causes 'unsafe-inline' to be ignored, so the brand <style>
 *     block would keep working while every style attribute in the app
 *     stopped. Half-noncing styles is the failure mode to avoid.
 *
 * So the inline <style id="tenant-brand"> in the layout needs no nonce, and
 * script-src — where XSS actually lands — is the directive that is locked
 * down.
 *
 * fonts.googleapis.com and fonts.gstatic.com are allowed because font
 * choice is tenant configuration resolved at runtime (`googleFontsHref()`
 * in branding/tokens.ts). `next/font` resolves at build time and so cannot
 * serve a typeface a college picks after we have deployed.
 */
function contentSecurityPolicy(nonce: string): string {
  return [
    `default-src 'self'`,
    // 'unsafe-eval' is required by the dev server's HMR client, and by
    // nothing in a production build.
    // Nonce for Next.js's own bootstrap scripts, which are generated per
    // request. Hash for our theme-boot script, which is a fixed string —
    // a nonce there produces a hydration mismatch, because React does not
    // serialise the attribute to the client. See lib/theme-boot.ts.
    `script-src 'self' 'nonce-${nonce}' ${THEME_BOOT_CSP_HASH}${IS_PROD ? '' : " 'unsafe-eval'"}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com data:`,
    // Tenant logos and crests are supplied by colleges and often still
    // live on the college's own web host — see the note in next.config.ts
    // about why brand imagery bypasses next/image. An allowlist here would
    // have to be edited for every customer.
    `img-src 'self' data: blob: https:`,
    `connect-src 'self'`,
    `object-src 'none'`,
    // Razorpay Checkout renders in an iframe. Add its origins here, not
    // globally, when the donations module ships and FCRA status is settled.
    `frame-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `manifest-src 'self'`,
    `worker-src 'self' blob:`,
    ...(IS_PROD ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

/**
 * Resolving the member behind a validly signed cookie.
 *
 * Three outcomes, and the difference between the last two matters:
 *
 *   a viewer      the row exists; decide against its grants
 *   'no-member'   the cookie verifies but the row is gone. `getSession()`
 *                 returns null for exactly this case, so the honest
 *                 answer is the anonymous one — sign in again.
 *   'unavailable' the lookup itself failed. Decline to decide.
 *
 * That last one is not defensive padding. This gate exists to correct a
 * status code; it must never be the reason a signed-in operator cannot
 * reach their own console. If storage is unreachable the request goes
 * through and the page guard — which has to resolve the session anyway,
 * and will fail loudly if it cannot — makes the real decision.
 *
 * The import is dynamic so the member data module is not evaluated on a
 * request to `/dashboard` or `/api/notifications`. On the Node runtime
 * that is a genuine deferral: the first `/admin` request of a cold
 * process pays for it and every other path never does.
 */
type ViewerLookup = CoarseViewer | 'no-member' | 'unavailable';

async function resolveViewer(memberId: string): Promise<ViewerLookup> {
  try {
    const { findMemberById } = await import('@/lib/data/repo');
    const member = findMemberById(memberId);
    if (!member) return 'no-member';
    return {
      status: member.status,
      roles: member.roles.map((grant) => grant.role as Role),
    };
  } catch (err) {
    /**
     * Loud, always.
     *
     * This branch fails *open* — the request proceeds and the page guard
     * makes the real decision — which is the right call for a gate whose
     * job is a status code rather than authorisation. But a silent catch
     * that fails open is how it went unnoticed that the gate never fired
     * at all in a production build: it passed every check in dev, and the
     * only symptom was a 200 where a 307 belonged.
     *
     * If this line appears in the logs, the coarse gate is off and every
     * console refusal is answering 200. Nothing leaks — the page guards
     * still refuse — but the status line is lying.
     */
    console.error(
      '[middleware] member lookup failed; the console status gate is failing open',
      err,
    );
    return 'unavailable';
  }
}

/** 307 to a path on the same origin, never storable, varying on the cookie. */
function redirectTo(req: NextRequest, path: string): NextResponse {
  // Built from `nextUrl` rather than `req.url` so the origin is the one
  // the browser actually used — behind a proxy those differ, and a
  // redirect to the internal hostname lands nowhere.
  const res = NextResponse.redirect(new URL(path, req.nextUrl), 307);
  // A cached "you must sign in" served to somebody who has signed in is
  // the classic shared-proxy failure, and a cached "not for you" served
  // to the operator it *is* for is the same failure wearing a different
  // hat. Never store either.
  res.headers.set('cache-control', 'no-store');
  res.headers.set('vary', 'cookie');
  return res;
}

/** 401/403 in the shape `AuthzError` → `toResponse` produces. */
function refuseJson(body: typeof UNAUTHENTICATED_BODY | typeof FORBIDDEN_BODY, status: 401 | 403) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store', vary: 'cookie' },
  });
}

function refuseAnonymous(req: NextRequest, rule: RouteRule): NextResponse {
  if (rule.refuse === 'json') return refuseJson(UNAUTHENTICATED_BODY, 401);
  const { pathname, search } = req.nextUrl;
  return redirectTo(req, loginRedirectPath(pathname, search));
}

function refuseUnauthorised(req: NextRequest, rule: RouteRule): NextResponse {
  if (rule.refuse === 'json') return refuseJson(FORBIDDEN_BODY, 403);
  return redirectTo(req, UNAUTHORISED_REDIRECT);
}

/**
 * The coarse gate.
 *
 * Returns a response to send *instead of* rendering, or null to carry on.
 *
 *   no valid cookie + protected page      307 → /login?next=<path>
 *   no valid cookie + protected API       401 { error, code }
 *   valid cookie, no console capability
 *     + /admin or /platform               307 → /dashboard
 *   valid cookie, capability declared
 *     but /api                            403 { error, code }
 *   otherwise                             through, and the page decides
 *
 * "Valid cookie" means the HMAC verifies and the payload has not aged out
 * — nothing more. Everything past that is resolved from storage on this
 * request, exactly as `getSession()` does it, so a role revoked a minute
 * ago is already gone here. Nothing about the member is trusted from the
 * cookie except the id, and the id is trusted only because it is signed.
 *
 * The gate stays coarse on purpose. It knows whether somebody belongs in
 * a console; it does not know, and must not learn, which screen inside it
 * they may open. `require(session, …)` at the top of every page and route
 * handler is still the authority, and this changes nothing about what is
 * rendered — only about what the status line says while it is withheld.
 */
async function gate(req: NextRequest): Promise<NextResponse | null> {
  const { pathname } = req.nextUrl;

  const rule = policyFor(pathname);
  if (!rule.requiresSession) return null;

  // The id is read but deliberately not forwarded downstream. Putting it
  // in a request header would create a second channel for "who is this",
  // and the first page to trust that header instead of `getSession()`
  // turns a spoofable header into an identity. Same for the decision
  // below: middleware does not tell the page what it concluded.
  const memberId = readSessionMemberId(req.cookies.get(SESSION_COOKIE)?.value);
  if (!memberId) return refuseAnonymous(req, rule);

  // Most requests stop here, having read nothing but a cookie.
  const needs = rule.requiresAnyCapability;
  if (!needs || needs.length === 0) return null;

  const viewer = await resolveViewer(memberId);
  if (viewer === 'unavailable') return null;
  if (viewer === 'no-member') return refuseAnonymous(req, rule);

  if (holdsAnyCapability(viewer, needs)) return null;
  return refuseUnauthorised(req, rule);
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const host = req.headers.get('host') ?? '';
  const subdomain = subdomainFrom(host);

  const nonce = makeNonce();
  const csp = contentSecurityPolicy(nonce);

  const requestHeaders = new Headers(req.headers);

  /**
   * Always write or delete, never leave alone.
   *
   * `x-tenant-subdomain` is an ordinary request header, so anyone can send
   * one. If middleware only set it when it could resolve a host, a request
   * to an unknown host carrying a forged header would arrive downstream
   * looking authoritative — a tenant escape from a curl command. Whatever
   * the client sent is overwritten here or removed.
   */
  if (subdomain) requestHeaders.set('x-tenant-subdomain', subdomain);
  else requestHeaders.delete('x-tenant-subdomain');

  requestHeaders.set('x-nonce', nonce);
  // Next reads the nonce back out of this header to stamp its own scripts.
  requestHeaders.set('content-security-policy', csp);

  /**
   * The gate runs here, after the request headers are prepared and before
   * anything downstream is reached. Whatever it returns still collects
   * every response header below — a 307, a 401 or a 403 is a response
   * like any other, and it must not be the one document on the site that
   * ships without a CSP.
   */
  const res = (await gate(req)) ?? NextResponse.next({ request: { headers: requestHeaders } });

  res.headers.set('content-security-policy', csp);

  // Isolate the browsing context group. Cheap, and it closes the
  // window.opener path out of the admin console.
  res.headers.set('cross-origin-opener-policy', 'same-origin');

  /**
   * HSTS only on requests that actually arrived over TLS. Sent from a
   * local dev server it pins the developer's browser to https://localhost
   * for two years, which is a bad afternoon for everyone on the team.
   * `includeSubDomains` is correct here precisely because tenancy is
   * subdomain-based — every college's hostname must be https-only too.
   */
  const proto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '');
  if (proto === 'https') {
    res.headers.set('strict-transport-security', 'max-age=63072000; includeSubDomains; preload');
  }

  // The headers that are the same for every request — nosniff, frame
  // options, referrer and permissions policy — live in next.config.ts and
  // are deliberately not repeated here.
  return res;
}

/**
 * `runtime: 'nodejs'` is load-bearing, not a preference.
 *
 * The session gate verifies the cookie's HMAC with `node:crypto`, and
 * `timingSafeEqual` in particular has no Web Crypto equivalent — comparing
 * a MAC with `===` is a timing oracle, and forging a session is the whole
 * game. Node middleware has been stable since Next 15.5; on the Edge
 * runtime this file will not even resolve `node:crypto`.
 *
 * The capability gate leans on it a second time: `/admin` and `/platform`
 * resolve the member's grants from `@/lib/data/repo`, and a repository
 * that will one day open a Postgres connection is not something the Edge
 * runtime can hold at all.
 *
 * Flipping it back to edge therefore breaks the build rather than failing
 * quietly, which is the right way round. If somebody genuinely needs edge
 * middleware later, the gate has to be rewritten against
 * `crypto.subtle.verify`, and the capability half of it has to move
 * somewhere with a database.
 *
 * Cost: on a platform that runs edge middleware at the PoP, this moves it
 * into the region instead. Nothing is lost here — the nonce already forces
 * every matched route to render dynamically, so there was never a cached
 * response for edge middleware to sit in front of.
 *
 * ── matcher ──────────────────────────────────────────────────────────
 * Everything except static output and files served straight from /public.
 *
 * API routes are intentionally *in*: route handlers get the resolved
 * subdomain from the same place pages do, and the gate answers an
 * anonymous API caller with a 401 rather than a sign-in page. The nonce
 * forces dynamic rendering on every matched route, which costs nothing
 * here — every page is already tenant-resolved from the Host header, so
 * none of them were statically optimisable to begin with.
 *
 * The exclusion list is duplicated as `isAssetPath()` in route-policy.ts.
 * It has to be: Next parses this object statically out of the source, so
 * it cannot reference an imported constant. Keep the two in step.
 */
export const config = {
  runtime: 'nodejs',
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|favicon\\.png|robots\\.txt|sitemap\\.xml|fonts/|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|otf)$).*)',
  ],
};
