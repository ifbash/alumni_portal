import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { headers } from 'next/headers';
import { getTenantBrand } from '@/lib/tenant';
import { DEFAULT_PACK, type BrandPack } from '@/lib/branding/pack';
import { contrastRatio, mixHex, readableTextOn } from '@/lib/branding/color';

/**
 * The share card, generated from the tenant's brand pack.
 *
 * Alumni links travel on WhatsApp, and WhatsApp renders the Open Graph
 * image at a size where the college's name either reads or the link looks
 * like spam. Every college therefore needs a card, and today only the
 * vendor's own pack has one — DIET has not sent us the crest in vector
 * yet, let alone a 1200×630 asset. So the card is derived from the same
 * three or four values the rest of the portal is derived from: the
 * primary colour as the ground, the portal name, the institution, the
 * tagline.
 *
 * ── Precedence ───────────────────────────────────────────────────────
 * If a pack supplies `assets.ogImage`, **that file wins and this is only
 * the fallback** — a college that sends us a designed card must get its
 * designed card on WhatsApp, not ours.
 *
 * That hand-off is done here, in `suppliedCard()` below, and it has to
 * be: the layout setting `openGraph.images` does *not* achieve it.
 * Next's file convention out-ranks config-based metadata for every page
 * whose own `generateMetadata` does not itself declare an `images` key,
 * which is every page in this app — verified by requesting `/` and
 * reading the emitted `og:image`, not by reading the docs. So the only
 * place that can stand this route down is this route.
 *
 * ── Fonts ────────────────────────────────────────────────────────────
 * None are fetched. `ImageResponse` ships with a Latin font and uses it
 * when no `fonts` option is given, so this route makes no network call at
 * request time. Rendering the tenant's actual display face would mean
 * fetching a webfont on every crawl of every share — for a card whose
 * hierarchy is carried by size and colour anyway. Weight and scale do the
 * work instead.
 */

export const alt = 'Alumni portal share card';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// The tenant comes from the Host header, exactly as the layout resolves
// it, so this cannot be generated once at build time.
export const dynamic = 'force-dynamic';

/**
 * Where a pack's own share card lives, as an absolute URL, or null if
 * this route should draw one instead.
 *
 * A site-relative path is only handed off when the file is genuinely on
 * disk. `brands/diet.json` names `/brand/diet/og-card.png` and the
 * college has not sent it yet — `public/brand/diet/` is an empty folder —
 * so redirecting there unconditionally would turn every WhatsApp share of
 * the portal into a preview-less grey box. A missing asset falls back to
 * the generated card, which is the whole point of having one.
 *
 * An `https://` reference is taken at its word: it is on a host we cannot
 * check without a network call, and this route makes none.
 *
 * A `data:` reference returns null. Crawlers do not follow a redirect to
 * a data URI, and a pack that inlines a 1200×630 image is not a case
 * worth carrying code for.
 */
async function suppliedCard(ref: string): Promise<string | null> {
  if (ref.startsWith('https://')) return ref;
  if (!ref.startsWith('/')) return null;

  const publicDir = path.join(process.cwd(), 'public');
  const relative = (ref.split('?')[0] ?? ref).replace(/^\/+/, '');
  const file = path.resolve(publicDir, relative);

  // Brand packs are operator-supplied rather than user-supplied, but a
  // path that escapes /public is never a legitimate asset reference.
  if (file !== publicDir && !file.startsWith(publicDir + path.sep)) return null;

  try {
    await fs.access(file);
  } catch {
    return null;
  }

  const h = await headers();
  const host = h.get('host');
  if (!host) return null;

  const forwarded = h.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const local = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  return `${forwarded || (local ? 'http' : 'https')}://${host}${ref}`;
}

/** Trim to a whole word, so a truncated tagline does not end mid-syllable. */
function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Long portal names step down rather than overflowing the card. */
function headingSize(name: string): number {
  if (name.length <= 14) return 92;
  if (name.length <= 22) return 76;
  if (name.length <= 34) return 58;
  return 46;
}

export default async function OpenGraphImage() {
  const resolved = await getTenantBrand();

  // An unresolved host still gets a card. A 500 on this route makes every
  // share of a merely misconfigured portal render as a broken preview.
  const pack: BrandPack = resolved?.brand.pack ?? DEFAULT_PACK;
  const { copy, color, features } = pack;

  // The pack's own card, if there is one and it is really there.
  const supplied = pack.assets.ogImage ? await suppliedCard(pack.assets.ogImage) : null;
  if (supplied) {
    return new Response(null, {
      status: 307,
      headers: {
        location: supplied,
        // Branding changes rarely, but a college that has just sent us
        // their card should see it on the next share rather than after a
        // cache expires somewhere they cannot reach.
        'cache-control': 'public, max-age=0, must-revalidate',
      },
    });
  }

  const ground = color.primary;
  const fg = readableTextOn(ground);

  // Shade the gradient *away* from the text colour, never toward it: on a
  // dark brand the corner darkens, on a pale one it lightens. Both ends of
  // the ramp then have at least the contrast the flat colour had, so the
  // depth costs nothing in legibility.
  const shade = fg === '#ffffff' ? '#000000' : '#ffffff';
  const deep = mixHex(ground, shade, 0.28);
  const muted = mixHex(fg, ground, 0.32);

  // A supplied accent is used unless it is invisible against the ground,
  // in which case the rule is drawn in the text colour's direction. A pack
  // with no accent at all falls back the same way.
  const accentSeed = color.accent;
  const rule =
    accentSeed && contrastRatio(accentSeed, ground) >= 1.6
      ? accentSeed
      : mixHex(ground, fg, 0.55);

  const initials = copy.shortName.slice(0, 2).toUpperCase();
  const portalName = clamp(copy.portalName, 40);
  const institution = clamp(copy.institutionName, 62).toUpperCase();
  const tagline = copy.tagline ? clamp(copy.tagline, 118) : null;

  // What this tenant has actually bought, in the tenant's own order of
  // importance. A card that advertised a donations module the college has
  // not cleared for FCRA would be the worst possible place to over-claim.
  const capabilities = [
    features.directory ? 'Verified alumni directory' : null,
    features.mentorship ? 'Mentoring and referrals' : null,
    features.events ? 'Campus events' : null,
    features.jobs ? 'Jobs and internships' : null,
  ]
    .filter((label): label is string => Boolean(label))
    .slice(0, 3);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          color: fg,
          backgroundColor: ground,
          backgroundImage: `linear-gradient(135deg, ${ground} 0%, ${deep} 100%)`,
        }}
      >
        {/* ---------------------------------------------------- Institution */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 78,
              height: 78,
              borderRadius: 20,
              backgroundColor: fg,
              color: ground,
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            {initials}
          </div>
          <div
            style={{
              display: 'flex',
              marginLeft: 26,
              fontSize: 24,
              letterSpacing: 3,
              color: muted,
            }}
          >
            {institution}
          </div>
        </div>

        {/* ----------------------------------------------------- The name */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: headingSize(portalName),
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -1.5,
            }}
          >
            {portalName}
          </div>
          {tagline ? (
            <div
              style={{
                display: 'flex',
                marginTop: 22,
                maxWidth: 900,
                fontSize: 32,
                lineHeight: 1.35,
                color: muted,
              }}
            >
              {tagline}
            </div>
          ) : null}
        </div>

        {/* ---------------------------------------------------- What it does */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', width: 104, height: 6, borderRadius: 3, backgroundColor: rule }} />
          {capabilities.length > 0 ? (
            <div style={{ display: 'flex', marginTop: 24, fontSize: 22, color: muted }}>
              {capabilities.join('   ·   ')}
            </div>
          ) : null}
        </div>
      </div>
    ),
    { ...size },
  );
}

/**
 * ── One loose end, in a file this one does not own ────────────────────
 *
 * `src/app/layout.tsx` sets no `metadataBase`, so Next resolves the
 * emitted `og:image` URL against the request origin in development and
 * against `VERCEL_URL` — or `http://localhost:3000` — in production. On a
 * subdomain-per-college deployment that is the wrong hostname for every
 * tenant but one, and a share card at the wrong hostname is a share card
 * nobody sees.
 *
 * It cannot be a build-time constant for the same reason the tenant
 * cannot be: one deployment answers on many hostnames. The fix belongs in
 * the layout's `generateMetadata`, reading the Host header exactly as
 * `src/app/sitemap.ts` does:
 *
 *     metadataBase: new URL(`https://${(await headers()).get('host')}`)
 *
 * The warning Next prints about this predates this route — the DIET pack
 * names a relative `assets.ogImage`, which needs a base to resolve too.
 */
