// @ts-ignore -- @vercel/config is not in package.json. The file is written
// against it anyway so the config is typed the day someone installs it;
// until then Vercel falls back to project settings and this file is inert.
// See docs/DEPLOYMENT.md.
import { defineConfig } from '@vercel/config';

/**
 * Vercel project configuration.
 *
 * The one setting here that is not a preference: `regions`. Postgres and
 * object storage live in ap-south-1 and the app must not be the thing that
 * moves personal data out of India — running functions in iad1 against a
 * Mumbai database is both a 200ms round trip per query and a DPDP
 * cross-border transfer we have gone out of our way to avoid. bom1 is the
 * Mumbai region. Multi-region is a paid feature; on a single-region plan
 * bom1 must still be the one region selected.
 *
 * Edge middleware is the exception and is fine: it runs everywhere, reads
 * only the Host header, and never touches member data. See src/middleware.ts.
 */
export default defineConfig({
  framework: 'nextjs',

  // Mumbai. Do not change this without reading the residency note above.
  regions: ['bom1'],

  headers: [
    {
      /**
       * Self-hosted brand fonts. Content-addressed by deploy, so a year is
       * safe — a customer changing typeface ships a new file, not a new
       * version of the same file.
       */
      source: '/fonts/(.*)',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    },
    {
      /**
       * Logos, crests and OG cards. Shorter and revalidated because these
       * *do* get replaced in place — a college sends a corrected crest and
       * expects to see it, and `immutable` here means "expects to see it
       * next year".
       */
      source: '/brand/(.*)',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' }],
    },
  ],
});
