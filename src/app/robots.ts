import type { MetadataRoute } from 'next';

/**
 * Nothing is indexed. Nothing.
 *
 * The directory sits behind authentication and must never appear in a
 * search result — a competitor shipped theirs publicly, and "site:" plus
 * their domain returns alumni names, employers and cities to anyone who
 * types it. That is the single most damaging thing this product could do
 * to a college, and it is prevented in three places rather than one:
 *
 *  1. Here, for crawlers that read robots.txt.
 *  2. `robots: { index: false, follow: false }` in the root layout's
 *     metadata, for crawlers that ignore it but honour the meta tag.
 *  3. The route guards themselves, for everything that honours neither.
 *
 * Only the third is authorisation. The first two are courtesy, and the
 * distinction matters: a `Disallow` is a request, not a control.
 *
 * A college that later buys a public marketing surface gets it as an
 * explicit allow-list here, never by relaxing this default.
 */

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        disallow: '/',
      },
    ],
    // No sitemap. Publishing one for a portal that disallows everything is
    // an invitation to crawl the URLs listed in it.
  };
}
