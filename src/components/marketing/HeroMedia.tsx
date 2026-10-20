import type { BrandPack } from '@/lib/branding/pack';
import { HeroVideo } from './HeroVideo';

/**
 * The landing hero's photograph (and, on desktop, its video loop).
 *
 * Renders only when the pack has a `heroImage`. A college without one
 * gets the generative band (aurora, grain and the batch ribbon), which is
 * a designed state rather than a gap: no frame, no "photo coming soon".
 *
 * Two layouts from one element:
 *
 *  - **Below `lg`** the photo is a full-bleed strip (5:2 on phones, 2:1
 *    from `sm`) *above* the band
 *    text, with no scrim and nothing written on it. A phone is too narrow
 *    for a scrim to leave any photograph visible, and a 72% wash over a
 *    full-height phone hero is a navy rectangle with a rumour of a photo. *  - **At `lg`** it fills the hero behind the text, under `.scrim-hero`
 *    (solid `--scrim` to 60%, fading out to the right), so the text column
 *    measures at least 4.5:1 over a pure-white pixel whatever the photo.
 *    The fade to the band along the bottom only ever adds band colour, so
 *    it cannot lower that contrast; it is what makes the batch panel
 *    overlapping the foot of the hero look seated rather than dropped on.
 */
export function HeroMedia({ pack }: { pack: BrandPack }) {
  const { heroImage, heroImageAlt, heroFocus, heroVideo } = pack.assets;
  if (!heroImage) return null;

  return (
    <>
      {/*
        Not next/image: tenant media may live on any https host (S3 in
        ap-south-1 today), the same reason Logo uses a plain <img>.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={heroImage}
        alt={heroImageAlt ?? ''}
        width={2400}
        height={1200}
        fetchPriority="high"
        decoding="async"
        style={{ objectPosition: heroFocus }}
        // 5:2 on phones (156px at 390) keeps Register above the fold under
        // a three-line headline; 2:1 from sm, where there is room.
        className="block aspect-[5/2] w-full object-cover sm:aspect-[2/1] lg:absolute lg:inset-0 lg:-z-10 lg:aspect-auto lg:h-full"
      />
      {heroVideo ? <HeroVideo src={heroVideo} poster={heroImage} focus={heroFocus} /> : null}
      <div aria-hidden="true" className="scrim-hero absolute inset-0 -z-10 hidden lg:block" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-2/5 bg-[linear-gradient(to_top,color-mix(in_srgb,var(--band)_88%,transparent),transparent)] max-lg:hidden"
      />
    </>
  );
}
