import { headers } from 'next/headers';

/**
 * Sharing links. Server-side: `siteOrigin()` reads request headers, and
 * `next/headers` already refuses to build into a client component. (No
 * `import 'server-only'` on top of that, which would throw under Vitest
 * and make the pure `whatsappShareUrl` untestable.)
 *
 * WhatsApp is how an Indian alumni network actually spreads — a batch
 * group forwards a link far more reliably than anyone opens an email — so
 * the share is a plain `wa.me` link with the text prefilled. No SDK, no
 * tracking parameters, nothing that needs a script on the page.
 */

/** A `wa.me` link that opens WhatsApp with `text` and `url` prefilled. */
export function whatsappShareUrl(text: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
}

/**
 * This tenant's origin, for links that leave the site (a share, an email).
 *
 * Built from the same Host header `getTenant()` resolved the tenant from,
 * so on a page that rendered for a tenant it is always a known tenant
 * host. It is never `x-forwarded-host`: that header is client-supplied
 * unless a proxy rewrites it, and a share link pointing at an attacker's
 * domain is exactly the thing not to build.
 */
export async function siteOrigin(): Promise<string> {
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  return `${proto}://${(await headers()).get('host') ?? 'localhost:3000'}`;
}
