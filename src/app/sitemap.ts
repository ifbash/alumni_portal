import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { getTenantBrand } from '@/lib/tenant';
import { NOTICE_VERSION } from '@/lib/config';

/**
 * The sitemap, and what it deliberately does not contain.
 *
 * Read `src/app/robots.ts` first — it disallows everything and publishes
 * no `Sitemap:` line, and that is not an oversight this file corrects. The
 * two are consistent on the only rule that matters: **nothing behind a
 * sign-in is ever named here.** No `/directory`, no member profile, no
 * `/events/<slug>`, no `/admin`, no `/api`. A competitor put their alumni
 * directory on the open internet and `site:` plus their domain returns
 * names, employers and cities to anyone who types it; a sitemap listing
 * those URLs would be handing over the index as well.
 *
 * What is left is the handful of pages that are already reachable from the
 * public footer of every page — so this file discloses precisely nothing
 * that the homepage does not. It exists so that when a college does opt
 * into a public marketing surface, the allow-list is computed from the
 * same feature flags the pages themselves are gated on, rather than being
 * a second hand-maintained list that drifts.
 *
 * Two consequences worth being explicit about:
 *
 *  - A tenant with `publicLanding: false` (see `brands/northgate.json`)
 *    emits only the two legal notices. Its landing page redirects to
 *    `/login` and its public events list 404s, so listing either would be
 *    advertising a route that does not answer.
 *  - The legal notices are listed for *every* tenant, public surface or
 *    not. `/privacy` is linked from the consent checkbox on `/claim` and
 *    has to be readable by someone who has no account; a notice you must
 *    sign in to read is not a notice.
 *
 * Turning any of this into something a crawler actually follows also needs
 * a `Sitemap:` line in `robots.ts` and a relaxed `Disallow`. Both belong
 * to that file, and both should stay as they are until a college asks.
 */

export const dynamic = 'force-dynamic';

/**
 * The origin this request arrived on.
 *
 * Sitemap URLs must be absolute, and one deployment answers on a hostname
 * per college — `diet.portal.example` and `xyz.portal.example` are the
 * same code and must never appear in each other's sitemap. Deriving the
 * origin from the request is the only way to get that right; a build-time
 * `NEXT_PUBLIC_SITE_URL` would put one tenant's hostname in every
 * tenant's file.
 */
async function origin(): Promise<string | null> {
  const h = await headers();
  const host = h.get('host');
  if (!host) return null;

  const forwarded = h.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const local = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  const proto = forwarded || (local ? 'http' : 'https');

  return `${proto}://${host}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await origin();
  if (!base) return [];

  // An unresolved host is a misconfigured DNS record or someone probing.
  // Either way it gets an empty sitemap rather than the default tenant's.
  const resolved = await getTenantBrand();
  if (!resolved) return [];

  const { features } = resolved.brand.pack;

  // The notice version doubles as its effective date, so this is a real
  // last-modified rather than `new Date()` — which would tell a crawler
  // the terms changed on every single fetch.
  const noticeDate = new Date(NOTICE_VERSION);
  const legalModified = Number.isNaN(noticeDate.getTime()) ? undefined : noticeDate;

  const entries: MetadataRoute.Sitemap = [];

  if (features.publicLanding) {
    entries.push(
      { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
      { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.8 },
      { url: `${base}/contact`, changeFrequency: 'monthly', priority: 0.7 },
    );

    // The public events list, gated on exactly the two flags the page
    // itself is gated on. If either is off the page calls `notFound()`,
    // and a sitemap entry pointing at a 404 is worse than no entry.
    //
    // `/campus-events`, not `/events`: the member-side list already owns
    // `/events` and that prefix requires a session. See the note at the
    // top of `src/app/(marketing)/campus-events/page.tsx`.
    if (features.events) {
      entries.push({ url: `${base}/campus-events`, changeFrequency: 'weekly', priority: 0.9 });
    }
  }

  entries.push(
    { url: `${base}/privacy`, lastModified: legalModified, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${base}/terms`, lastModified: legalModified, changeFrequency: 'yearly', priority: 0.5 },
  );

  // Not listed, on purpose: /login, /verify, /claim, /pending and /logout.
  // All five are public — middleware lets them through — but they are
  // steps in a transaction, not documents. A search result that drops
  // somebody onto an OTP entry screen with no code in hand helps nobody,
  // and /claim is a form that collects a roll number and a mobile number.
  return entries;
}
