import type { AssetSpec } from '@/lib/branding/pack';
import { cn } from '@/lib/cn';
import { SectionHead } from './SectionHead';

/**
 * "Around the campus" — the landing page's second photo placement.
 *
 * Only what the pack's `assets.campusPhotos` holds; with none, the
 * section is omitted (no frame, no "photos coming soon").
 *
 * Laid out as a mosaic, not a row of equal boxes: photos come in threes,
 * one large and two small, and the large one swaps sides in each group of
 * three. A leftover pair is a 7/5 split and a leftover single runs wide.
 * Portrait and landscape photos arrive mixed, so every frame crops and
 * each photo's `focus` decides what survives the crop.
 *
 * Captions sit below each photograph on the page ground, never on it, so
 * they need no scrim and stay readable whatever the picture. The photos
 * are plain lazy `<img>`s inside frames that already have their size, so
 * nothing shifts when one arrives; the sunken ground shows meanwhile.
 */

type Photo = AssetSpec['campusPhotos'][number];

/** Fills its frame; the frame owns the size, the `<img>` only crops. */
function Frame({ photo, className }: { photo: Photo; className: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-line bg-surface-sunken', className)}>
      {/* Not next/image: tenant media may live on any https host, as for Logo. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.src}
        alt={photo.alt}
        loading="lazy"
        decoding="async"
        width={1200}
        height={1200}
        style={{ objectPosition: photo.focus ?? '50% 50%' }}
        className="absolute inset-0 size-full object-cover transition-transform duration-slow ease-brand [@media(hover:hover)]:group-hover:scale-[1.03]"
      />
    </div>
  );
}

function Caption({ photo }: { photo: Photo }) {
  return photo.caption ? <figcaption className="mt-2.5 text-sm text-secondary">{photo.caption}</figcaption> : null;
}

/** One figure. `grow` lets the frame take whatever height the grid row leaves it. */
function Figure({ photo, frame, className }: { photo: Photo; frame: string; className?: string }) {
  return (
    <li className={cn('min-w-0', className)}>
      <figure className="group flex h-full flex-col">
        <Frame photo={photo} className={frame} />
        <Caption photo={photo} />
      </figure>
    </li>
  );
}

function Group({ photos, flip }: { photos: Photo[]; flip: boolean }) {
  if (photos.length === 1) {
    return (
      <ul className="grid">
        <Figure photo={photos[0]!} frame="aspect-[4/3] sm:aspect-[21/9]" />
      </ul>
    );
  }

  if (photos.length === 2) {
    return (
      <ul className="grid gap-4 md:grid-cols-12 md:gap-5">
        <Figure photo={photos[0]!} className={cn('md:col-span-7', flip && 'md:order-2')} frame="aspect-[4/3] md:aspect-[7/5]" />
        <Figure photo={photos[1]!} className={cn('md:col-span-5', flip && 'md:order-1')} frame="aspect-[4/3] md:aspect-[5/5]" />
      </ul>
    );
  }

  const [big, a, b] = photos as [Photo, Photo, Photo];
  // Phones: the large photo runs across, the two small sit side by side.
  // md and up: large 7 columns spanning both rows, small 5 columns stacked beside it.
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-12 md:gap-5">
      <Figure
        photo={big}
        className={cn('col-span-2 md:row-span-2', flip ? 'md:col-span-7 md:col-start-6' : 'md:col-span-7')}
        frame="aspect-[4/3] md:aspect-auto md:min-h-72 md:flex-1"
      />
      <Figure photo={a} className={cn('md:col-span-5', flip && 'md:col-start-1')} frame="aspect-square md:aspect-[16/10]" />
      <Figure photo={b} className={cn('md:col-span-5', flip && 'md:col-start-1')} frame="aspect-square md:aspect-[16/10]" />
    </ul>
  );
}

export function CampusPhotos({ photos }: { photos: Photo[] }) {
  if (!photos.length) return null;

  const groups: Photo[][] = [];
  for (let i = 0; i < photos.length; i += 3) groups.push(photos.slice(i, i + 3));

  return (
    <section id="campus" aria-labelledby="campus-title" className="scroll-mt-20 pb-10 md:pb-section">
      <div className="page-shell">
        <SectionHead id="campus-title" eyebrow="Campus" title="Around the campus" />

        <div className="mt-8 space-y-4 md:mt-10 md:space-y-5">
          {groups.map((g, i) => (
            <div key={g[0]!.src} className="reveal-scale">
              <Group photos={g} flip={i % 2 === 1} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
