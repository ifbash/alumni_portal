import type { AssetSpec } from '@/lib/branding/pack';

/**
 * "Around the campus" — the landing page's second photo placement.
 *
 * Only what the pack's `assets.campusPhotos` holds; with none, the
 * section is omitted (no frame, no "photos coming soon").
 *
 * Captions sit below each photograph on the page ground, never on it, so
 * they need no scrim and stay readable whatever the picture. Portrait and
 * landscape photos arrive mixed, so the strip crops every tile square and
 * each photo's `focus` decides what survives the crop.
 */

type Photo = AssetSpec['campusPhotos'][number];

function Img({ photo, className }: { photo: Photo; className: string }) {
  return (
    // Not next/image: tenant media may live on any https host, as for Logo.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.src}
      alt={photo.alt}
      loading="lazy"
      decoding="async"
      width={1200}
      height={1200}
      style={{ objectPosition: photo.focus ?? '50% 50%' }}
      className={className}
    />
  );
}

function Caption({ photo }: { photo: Photo }) {
  return photo.caption ? <figcaption className="mt-2 text-sm text-secondary">{photo.caption}</figcaption> : null;
}

export function CampusPhotos({ photos }: { photos: Photo[] }) {
  if (!photos.length) return null;

  // A sunken ground shows while a lazy photo is still on its way, not an empty outline.
  const tile = 'aspect-square w-full rounded-lg border border-line bg-surface-sunken object-cover';

  return (
    <section id="campus" aria-labelledby="campus-title" className="scroll-mt-20 border-t border-line py-10 md:py-section">
      <div className="page-shell">
        <h2 id="campus-title" className="font-display text-display-xs font-bold">
          Around the campus
        </h2>

        {photos.length === 1 ? (
          <figure className="mt-6">
            <Img
              photo={photos[0]!}
              className="aspect-[4/3] w-full rounded-lg border border-line bg-surface-sunken object-cover sm:aspect-[21/9]"
            />
            <Caption photo={photos[0]!} />
          </figure>
        ) : photos.length === 2 ? (
          <ul className="mt-6 grid gap-gutter sm:grid-cols-2">
            {photos.map((p) => (
              <li key={p.src}>
                <figure>
                  <Img photo={p} className={tile} />
                  <Caption photo={p} />
                </figure>
              </li>
            ))}
          </ul>
        ) : (
          // Focusable so a keyboard user can scroll the strip with the arrow keys.
          <div role="region" aria-label="Campus photographs" tabIndex={0} className="mt-6 overflow-x-auto pb-3">
            <ul className="flex snap-x snap-mandatory gap-4">
              {photos.map((p) => (
                <li
                  key={p.src}
                  className="w-[85%] shrink-0 snap-start sm:w-[calc(50%-0.5rem)] lg:w-[calc((100%-2rem)/3)]"
                >
                  <figure>
                    <Img photo={p} className={tile} />
                    <Caption photo={p} />
                  </figure>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
