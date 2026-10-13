import type { BrandPack } from './pack';

/**
 * Which college photograph a signed-in band may show.
 *
 * The one place in the product that picks a campus photo. A photo must
 * never read as a claim about what it shows: the title set over it has to
 * be true of it. So a batch page shows a photo only when the college
 * tagged one with that batch, a branch page only with that branch, and
 * the college-level bands (home, giving, profile) share whatever is left.
 *
 * Absent means the band renders solid. There is no stand-in.
 */

export interface BandPhoto {
  src: string;
  /** Empty for a decorative image (a hero with no `heroImageAlt`). */
  alt: string;
  /** CSS `object-position`. */
  focus: string;
}

export type BandSurface = 'home' | 'giving' | 'profile';

const DEFAULT_FOCUS = '50% 50%';

/** Untagged photos are dealt in a fixed order, so two bands never show the same one while the pool allows. */
const DEAL: Record<BandSurface, number> = { home: 0, giving: 1, profile: 2 };

type Photo = BrandPack['assets']['campusPhotos'][number];

function toBand(p: Photo): BandPhoto {
  return { src: p.src, alt: p.alt, focus: p.focus ?? DEFAULT_FOCUS };
}

function isUntagged(p: Photo): boolean {
  return !p.use?.length && p.batchYear === undefined && p.departmentCode === undefined;
}

/**
 * The photo behind a college-level band, first present wins:
 *
 *  1. a campus photo the college tagged for this surface (`use`);
 *  2. for home only, the landing hero image;
 *  3. the untagged pool, dealt home 0, giving 1, profile 2 (mod its size);
 *  4. nothing.
 */
export function pickBandPhoto(pack: Pick<BrandPack, 'assets'>, surface: BandSurface): BandPhoto | null {
  const a = pack.assets;
  const photos = a.campusPhotos ?? [];

  const tagged = photos.find((p) => p.use?.includes(surface));
  if (tagged) return toBand(tagged);

  if (surface === 'home' && a.heroImage) {
    return { src: a.heroImage, alt: a.heroImageAlt ?? '', focus: a.heroFocus ?? DEFAULT_FOCUS };
  }

  const pool = photos.filter(isUntagged);
  if (pool.length === 0) return null;
  return toBand(pool[DEAL[surface] % pool.length]!);
}

/** The sign-in and welcome panel photo: `authImage`, else the hero, else nothing. */
export function authPhoto(pack: Pick<BrandPack, 'assets'>): BandPhoto | null {
  const a = pack.assets;
  if (a.authImage) return { src: a.authImage, alt: '', focus: a.authFocus ?? DEFAULT_FOCUS };
  if (a.heroImage) return { src: a.heroImage, alt: a.heroImageAlt ?? '', focus: a.heroFocus ?? DEFAULT_FOCUS };
  return null;
}

/** A photo of this batch, only when the college tagged one with it. */
export function photoForBatch(pack: Pick<BrandPack, 'assets'>, year: number): BandPhoto | null {
  const p = (pack.assets.campusPhotos ?? []).find((x) => x.batchYear === year);
  return p ? toBand(p) : null;
}

/** A photo of this branch, only when the college tagged one with its department code. */
export function photoForBranch(pack: Pick<BrandPack, 'assets'>, code: string): BandPhoto | null {
  const wanted = code.trim().toUpperCase();
  const p = (pack.assets.campusPhotos ?? []).find((x) => x.departmentCode?.trim().toUpperCase() === wanted);
  return p ? toBand(p) : null;
}
