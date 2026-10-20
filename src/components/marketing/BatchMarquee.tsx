import * as React from 'react';

/**
 * The batch ribbon: the register's years as outlined numerals drifting
 * along the foot of the hero band.
 *
 * Decoration only. The real, keyboard-operable year links are in
 * `BatchCard`, so this is `aria-hidden`, `pointer-events-none` and carries
 * no links. It reads years the page already shows as chips (never counts)
 * and is drawn at 24% of the band's foreground, cropped by the hero's
 * bottom edge so only the tops of the numerals show. Motion is the
 * kit's `.marquee`, which stops under reduced motion.
 */
export function BatchMarquee({ years }: { years: number[] }) {
  const sorted = [...new Set(years)].sort((a, b) => b - a).slice(0, 16);
  if (!sorted.length) return null;

  // The track is two copies of one run; a run shorter than a wide screen would show a seam.
  const run = Array.from({ length: Math.max(1, Math.ceil(8 / sorted.length)) }, () => sorted).flat();

  const numerals = (copy: number) =>
    run.map((year, i) => (
      <span key={`${copy}-${i}`} className="tabular">
        {year}
      </span>
    ));

  return (
    <div
      aria-hidden="true"
      className="marquee pointer-events-none absolute inset-x-0 bottom-0 z-0 translate-y-[26%] select-none"
      style={{ '--marquee-gap': '3.5rem', '--marquee-dur': '80s' } as React.CSSProperties}
    >
      <div className="marquee-track font-display text-[clamp(4rem,11vw,9rem)] font-bold leading-none text-transparent [-webkit-text-stroke:1.5px_color-mix(in_srgb,var(--band-fg)_24%,transparent)]">
        {numerals(0)}
        {numerals(1)}
      </div>
    </div>
  );
}
