import type { MetadataRoute } from 'next';
import { getTenantBrand } from '@/lib/tenant';
import { DEFAULT_PACK } from '@/lib/branding/pack';

/**
 * The installable app manifest, generated from the tenant's brand pack.
 *
 * Same seam as everything else visual: adding a college is a JSON file in
 * `brands/`, and the home-screen icon, the splash colour and the name
 * under it follow without a build. A manifest with hardcoded values would
 * be the one place a second customer still shipped as "Alumni Portal" in
 * navy blue, which is exactly the detail that gets noticed on a phone.
 *
 * Alumni open portal links from WhatsApp on Android, so this is not a
 * nice-to-have: an installed icon on the home screen is the difference
 * between coming back and not.
 *
 * Colours come from the pack's *seeds* rather than the derived tokens —
 * `theme_color` is read by the OS, which has no CSS custom properties to
 * resolve, so it has to be a literal. It is the customer's own value, not
 * one chosen here.
 */

export const dynamic = 'force-dynamic';

function mimeFor(src: string): string | undefined {
  if (src.startsWith('data:')) return src.slice(5).split(';')[0] || undefined;
  const ext = src.split('?')[0]?.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'svg':
      return 'image/svg+xml';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'ico':
      return 'image/x-icon';
    default:
      return undefined;
  }
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const resolved = await getTenantBrand();

  // An unresolved host still gets a valid manifest. A 500 here makes the
  // browser log an install error on every page load of a portal that is
  // otherwise merely misconfigured.
  if (!resolved) {
    // Values come from `DEFAULT_PACK`, not from literals typed here. The
    // last-resort manifest is still a manifest built from a brand pack —
    // there is no colour in this file that a customer could not override.
    return {
      name: DEFAULT_PACK.copy.portalName,
      short_name: DEFAULT_PACK.copy.shortName,
      start_url: '/',
      display: 'standalone',
      background_color: DEFAULT_PACK.color.surface,
      theme_color: DEFAULT_PACK.color.primary,
      icons: [{ src: '/favicon.png', sizes: 'any', type: 'image/png', purpose: 'any' }],
    };
  }

  const { pack } = resolved.brand;
  const { copy, assets, color, locale } = pack;

  // Ordered widest-to-narrowest: a maskable mark reads best as the home
  // screen icon, the crest is the fallback, the favicon after that.
  //
  // DIET has supplied none of the three — the crest in vector is still on
  // the list of things the college owes us — so the first-party favicon
  // backstops it. An install prompt with no icon at all is worse than an
  // install prompt with a plain one, and it is the difference between a
  // portal that lives on the home screen and one that gets opened from
  // WhatsApp every time.
  const sources = [assets.logoMark, assets.crest, assets.favicon, '/favicon.png'].filter(
    (src): src is string => typeof src === 'string' && src.length > 0,
  );

  const icons: MetadataRoute.Manifest['icons'] = [];
  const seen = new Set<string>();
  for (const src of sources) {
    if (seen.has(src)) continue;
    seen.add(src);
    icons.push({
      src,
      // The packs carry vector marks, which are resolution-independent;
      // declaring a fixed pixel size for an SVG makes Android pick it for
      // exactly one density and blur it everywhere else.
      sizes: 'any',
      type: mimeFor(src),
      purpose: src === assets.logoMark ? 'maskable' : 'any',
    });
  }

  return {
    id: `/?tenant=${resolved.tenant.subdomain}`,
    name: `${copy.portalName} · ${copy.institutionName}`,
    short_name: copy.shortName,
    description:
      copy.tagline ?? `Alumni and final-year network for ${copy.institutionName}.`,
    // Signed-in members land on the portal home, not the marketing page.
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: locale.locale,
    dir: 'ltr',
    background_color: color.surface,
    theme_color: color.primary,
    categories: ['education', 'social', 'productivity'],
    icons,
    shortcuts: [
      {
        name: 'Search the directory',
        short_name: 'Directory',
        description: 'Find alumni by branch, batch, company or city',
        url: '/directory',
      },
      {
        name: 'Your connections',
        short_name: 'Connections',
        description: 'Requests waiting for a reply, and the ones you sent',
        url: '/connections',
      },
      {
        name: 'Jobs and internships',
        short_name: 'Jobs',
        description: 'Openings posted by alumni and the placement cell',
        url: '/jobs',
      },
    ],
  };
}
