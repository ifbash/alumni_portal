import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { headers } from 'next/headers';
import { getTenantBrand } from '@/lib/tenant';
import { DEFAULT_PACK, type BrandPack } from '@/lib/branding/pack';
import { contrastRatio, mixHex, parseHex, readableTextOn } from '@/lib/branding/color';
import { getPublicRegister } from '@/lib/data/public-events';

/**
 * The share card, generated from the tenant's brand pack.
 *
 * Alumni links travel on WhatsApp, and WhatsApp renders the Open Graph
 * image at a size where the college's name either reads or the link looks
 * like spam. Every college therefore needs a card, and today only the
 * vendor's own pack has one — DIET has not sent us the crest in vector
 * yet, let alone a 1200×630 asset. So the card is drawn from the same
 * band the site paints (`--band`, `--band-fg`, `--band-muted`,
 * `--band-accent`), the institution's name set large, and the signature
 * of the public pages: the batch ribbon, the register's years as outlined
 * numerals fading away along the foot of the card.
 *
 * What it will not carry: any member, any count, any name. The years come
 * from `getPublicRegister`, the same projection the landing page uses.
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
 * Read from /public/fonts, never fetched: this route makes no network
 * call at request time. See `cardFonts()`.
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
 * disk. A pack that names a card the college has not sent yet would
 * otherwise turn every WhatsApp share of the portal into a preview-less
 * grey box (DIET's pack did exactly that until the reference was dropped).
 * A missing asset falls back to the generated card, which is the whole
 * point of having one.
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

/** Long names step down rather than overflowing the card. Two lines at most. */
function nameSize(name: string): number {
  if (name.length <= 8) return 168;
  if (name.length <= 16) return 124;
  if (name.length <= 26) return 96;
  if (name.length <= 36) return 82;
  return 70;
}

/** `#rrggbb` plus alpha as `rgba()`, the one syntax every renderer in the chain parses. */
function rgba(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}

/**
 * The card's typefaces, read from /public/fonts once per process.
 *
 * The built-in font has a single weight, so a "bold" name would render
 * regular. Bricolage Bold carries the name and the years; Hanken carries
 * the small lines. They are the product's own faces, not the college's:
 * a tenant's Google display face would be a network fetch on every crawl,
 * and at card scale the hierarchy is size and colour. A missing file
 * falls back to the built-in font rather than failing the share.
 */
type CardFont = {
  name: string;
  data: Buffer;
  weight: 500 | 600 | 700;
  style: 'normal';
};
let fontCache: Promise<CardFont[] | undefined> | undefined;

function cardFonts(): Promise<CardFont[] | undefined> {
  fontCache ??= (async () => {
    try {
      const dir = path.join(process.cwd(), 'public', 'fonts');
      const [display, medium, semi] = await Promise.all([
        fs.readFile(path.join(dir, 'BricolageGrotesque-Bold.ttf')),
        fs.readFile(path.join(dir, 'HankenGrotesk-Medium.ttf')),
        fs.readFile(path.join(dir, 'HankenGrotesk-SemiBold.ttf')),
      ]);
      return [
        { name: 'Display', data: display, weight: 700, style: 'normal' },
        { name: 'Text', data: medium, weight: 500, style: 'normal' },
        { name: 'Text', data: semi, weight: 600, style: 'normal' },
      ] satisfies CardFont[];
    } catch {
      return undefined;
    }
  })();
  return fontCache;
}

/**
 * The crest as a data URI, or null.
 *
 * Read from disk when the pack points into /public, so the render makes
 * no network call. A remote crest is skipped for the same reason: a slow
 * college server must not be able to stall every share preview. The
 * renderer reads PNG, JPEG and SVG; anything else (WebP) is skipped.
 */
async function crestDataUri(ref: string | undefined): Promise<string | null> {
  if (!ref?.startsWith('/')) return null;

  const mime: Record<string, string> = {
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
  };
  const relative = (ref.split('?')[0] ?? ref).replace(/^\/+/, '');
  const type = mime[path.extname(relative).toLowerCase()];
  if (!type) return null;

  const publicDir = path.join(process.cwd(), 'public');
  const file = path.resolve(publicDir, relative);
  if (!file.startsWith(publicDir + path.sep)) return null;

  try {
    return `data:${type};base64,${(await fs.readFile(file)).toString('base64')}`;
  } catch {
    return null;
  }
}

/** The register's years and nothing else: no counts, no names, no rows. */
function registerYears(packId: string): number[] {
  try {
    return [...new Set(getPublicRegister(packId).years)].sort((a, b) => b - a).slice(0, 6);
  } catch {
    // A card with no ribbon is still a card; a 500 is a broken preview.
    return [];
  }
}

export default async function OpenGraphImage() {
  const resolved = await getTenantBrand();

  // An unresolved host still gets a card. A 500 on this route makes every
  // share of a merely misconfigured portal render as a broken preview.
  const pack: BrandPack = resolved?.brand.pack ?? DEFAULT_PACK;
  const { copy, color } = pack;

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

  // The band, exactly as the site paints it. These tokens already clear
  // contrast on the band (brand:check blocks publication otherwise), so
  // the card inherits that guarantee; only the glow has to be measured.
  const t = resolved?.brand.tokens.light;
  const band = t?.['--band'] ?? color.primary;
  const fg = t?.['--band-fg'] ?? readableTextOn(band);
  const muted = t?.['--band-muted'] ?? mixHex(fg, band, 0.25);
  const accent = t?.['--band-accent'] ?? mixHex(band, fg, 0.6);
  // The bloom is the accent's own mid stop, not its pale text stop: the
  // pale one mixes to grey on a dark band, the mid one stays the college's colour.
  const bloom = t?.['--accent-500'] ?? accent;

  // The accent glow lifts the ground behind the words, so it is as strong
  // as the three text colours allow: the strongest step at which each
  // still clears 4.5:1 where the glow reaches the text. The bloom sits in
  // the corner and the words stay left of it, so what they meet is at most
  // about 70% of its peak (a short name at its largest, set under the
  // centre); that is what is measured.
  const glow = ([0.56, 0.46, 0.36, 0.28, 0.2, 0.12, 0.06, 0] as const).find((a) => {
    const peak = mixHex(band, bloom, a * 0.7);
    return (
      contrastRatio(fg, peak) >= 4.5 &&
      contrastRatio(muted, peak) >= 4.5 &&
      contrastRatio(accent, peak) >= 4.5
    );
  })!;

  const [fonts, crest] = await Promise.all([cardFonts(), crestDataUri(pack.assets.crest)]);
  const years = registerYears(pack.id);

  const portalName = clamp(copy.portalName, 34).toUpperCase();
  const name = clamp(copy.institutionName, 64);
  const tagline = copy.tagline ? clamp(copy.tagline, 90) : null;
  const display = fonts ? 'Display' : undefined;
  const body = fonts ? 'Text' : undefined;

  // Outlined numerals fade with age: the newest batch is the loudest.
  const fade = [0.9, 0.62, 0.42, 0.28, 0.18, 0.12];

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: band,
        color: fg,
        fontFamily: body,
      }}
    >
      {/* Light: an accent bloom top right, a paler one low left. */}
      <div
        style={{
          position: 'absolute',
          top: -420,
          right: -300,
          width: 1000,
          height: 1000,
          borderRadius: 1000,
          backgroundImage: `radial-gradient(circle, ${rgba(bloom, glow)} 0%, ${rgba(bloom, glow * 0.62)} 18%, ${rgba(bloom, glow * 0.3)} 38%, ${rgba(bloom, glow * 0.1)} 56%, ${rgba(bloom, 0)} 72%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -520,
          left: -260,
          width: 900,
          height: 900,
          borderRadius: 900,
          backgroundImage: `radial-gradient(circle, ${rgba(fg, 0.12)} 0%, ${rgba(fg, 0)} 68%)`,
        }}
      />

      {/* The batch ribbon, cropped by the foot of the card. */}
      {years.length > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: 70,
            bottom: -46,
            display: 'flex',
            fontFamily: display,
            fontSize: 172,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: -4,
          }}
        >
          {years.map((year, i) => (
            <div
              key={year}
              style={{
                display: 'flex',
                marginRight: 44,
                opacity: fade[i] ?? 0.18,
                // A fully transparent fill drops the glyph; a ghost fill keeps the outline.
                color: rgba(fg, 0.05),
                WebkitTextStrokeWidth: 3,
                WebkitTextStrokeColor: fg,
              }}
            >
              {year}
            </div>
          ))}
        </div>
      ) : null}

      {/* The words. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '64px 80px 0',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {crest ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 76,
                height: 76,
                marginRight: 24,
                borderRadius: 76,
                backgroundColor: fg,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- rendered to PNG, not a page */}
              <img src={crest} width={54} height={54} style={{ objectFit: 'contain' }} />
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                width: 56,
                height: 3,
                marginRight: 22,
                backgroundColor: accent,
              }}
            />
          )}
          <div
            style={{
              display: 'flex',
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: 5,
              color: accent,
            }}
          >
            {portalName}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            maxWidth: 1000,
            marginTop: 34,
            fontFamily: display,
            fontSize: nameSize(name),
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: -2.5,
            color: fg,
          }}
        >
          {name}
        </div>

        {tagline ? (
          <div
            style={{
              display: 'flex',
              maxWidth: 900,
              marginTop: 26,
              fontSize: 32,
              fontWeight: 500,
              lineHeight: 1.3,
              color: muted,
            }}
          >
            {tagline}
          </div>
        ) : null}
      </div>
    </div>,
    { ...size, fonts },
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
