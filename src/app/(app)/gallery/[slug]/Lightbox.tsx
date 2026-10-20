'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Users, X } from 'lucide-react';

import { Avatar, Kbd } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * The photograph wall and its viewer.
 *
 * The wall is a justified mosaic: every tile in a row shares one height and
 * its width follows its aspect ratio, so mixed portrait and landscape
 * photographs fill the row edge to edge with no crop to a grid and no ragged
 * gap under a portrait. It is plain CSS (`flex-grow` proportional to the
 * ratio, a filler that keeps the last row from stretching), so there is no
 * layout script and no jump when images load: each tile reserves its box
 * from the stored width and height.
 *
 * The viewer is the native `<dialog>`, the same way `components/ui/
 * overlay.tsx` builds `Dialog` and `Sheet`, and for the same reason: focus
 * trapping, Escape-to-close, `inert` on the background and correct
 * screen-reader semantics all come free and all get subtly wrong when
 * hand-rolled. Arrow keys, swiping and focus return are the things the
 * platform does not give us, so they are the only things implemented here.
 *
 * Focus returns to the thumbnail that *opened* the viewer, not to whichever
 * photograph you arrowed onto. Someone who opens photo 3, browses to photo
 * 30 and presses Escape expects to be back where they were reading, not
 * scrolled two screens down the wall.
 *
 * The page hands this only photographs that have a file. A record whose
 * file has not arrived is counted ("+12 more coming"), never drawn.
 */

export interface PhotoTag {
  id: string;
  name: string;
  /** Null when this viewer's directory rules do not let them open the profile. */
  slug: string | null;
  photoUrl: string | null;
  line: string | null;
}

export interface WallPhoto {
  id: string;
  url: string | null;
  caption: string | null;
  width: number;
  height: number;
  tags: PhotoTag[];
}

/** A round control on the viewer's dark ground: 44px, a tint of the band's own foreground. */
const ROUND =
  'grid size-11 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--band-fg)_14%,transparent)] text-band-fg ' +
  'transition-colors duration-fast ease-brand hover:bg-[color-mix(in_srgb,var(--band-fg)_24%,transparent)] disabled:opacity-40 disabled:hover:bg-[color-mix(in_srgb,var(--band-fg)_14%,transparent)]';

export function PhotoWall({
  photos,
  albumTitle,
  credit,
}: {
  photos: WallPhoto[];
  albumTitle: string;
  /** For an album a graduate sent in: "Sent in by Sandeep Kolli · CSE ’15". */
  credit?: string | null;
}) {
  const [index, setIndex] = React.useState<number | null>(null);

  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const triggers = React.useRef<Array<HTMLButtonElement | null>>([]);
  const openedFrom = React.useRef<number | null>(null);
  const touchX = React.useRef<number | null>(null);

  const headingId = React.useId();

  // Opening, closing and returning focus all happen here rather than in the
  // handlers: the element has to be closed *before* anything can be focused
  // outside it, and only the effect runs after React has settled.
  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    if (index !== null && !el.open) {
      el.showModal();
      return;
    }

    if (index === null && el.open) {
      el.close();
      const back = openedFrom.current;
      if (back !== null) triggers.current[back]?.focus();
    }
  }, [index]);

  // The photograph either side is fetched ahead of the arrow key, so a
  // browse through the album does not flash an empty stage.
  React.useEffect(() => {
    if (index === null) return;
    for (const near of [photos[index + 1], photos[index - 1]]) {
      if (near?.url) new Image().src = near.url;
    }
  }, [index, photos]);

  const open = (i: number) => {
    openedFrom.current = i;
    setIndex(i);
  };

  const close = React.useCallback(() => setIndex(null), []);

  const step = (delta: number) => {
    setIndex((i) => {
      if (i === null) return i;
      return Math.min(photos.length - 1, Math.max(0, i + delta));
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDialogElement>) => {
    if (index === null) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      step(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      step(-1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setIndex(photos.length - 1);
    }
  };

  // A horizontal swipe of 48px or more moves one photograph.
  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchX.current;
    touchX.current = null;
    const end = e.changedTouches[0]?.clientX;
    if (start === null || end === undefined) return;
    const dx = end - start;
    if (Math.abs(dx) >= 48) step(dx < 0 ? 1 : -1);
  };

  const current = index === null ? null : photos[index] ?? null;
  const first = index === 0;
  const last = index === photos.length - 1;

  return (
    <>
      {/* The mosaic. --row is the target row height; the filler's huge
          grow factor keeps a short last row at its natural size. */}
      <ul className="flex flex-wrap gap-2 [--row:8.5rem] after:grow-[100000] after:content-[''] sm:gap-3 sm:[--row:12rem] xl:[--row:14rem]">
        {photos.map((photo, i) => {
          const ratio = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1.5;
          return (
            <li
              key={photo.id}
              style={{ flexGrow: Math.round(ratio * 100), flexBasis: `calc(${ratio.toFixed(4)} * var(--row))` }}
              className="min-w-0"
            >
              <button
                type="button"
                ref={(el) => {
                  triggers.current[i] = el;
                }}
                onClick={() => open(i)}
                aria-label={`Open photograph ${i + 1} of ${photos.length}${
                  photo.caption ? `: ${photo.caption}` : ''
                }${photo.tags.length > 0 ? `, ${photo.tags.length} tagged` : ''} in the viewer`}
                style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
                className={cn(
                  'group relative block w-full overflow-hidden rounded-lg border border-line bg-surface-sunken',
                  'transition-shadow duration-fast ease-brand hover:shadow-lg',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
                )}
              >
                <PhotoBody photo={photo} />
                {photo.tags.length > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-scrim px-2 py-0.5 text-xs font-medium tabular text-band-fg"
                  >
                    <Users className="size-3" />
                    {photo.tags.length}
                  </span>
                ) : null}
                {/* The caption rises over a scrim on hover and keyboard focus.
                    Touch has no hover; the viewer carries the caption there. */}
                {photo.caption ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute inset-x-0 bottom-0 line-clamp-2 bg-scrim px-3 py-2 text-left text-xs text-band-fg',
                      'translate-y-1 opacity-0 transition duration-fast ease-brand',
                      'group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100',
                    )}
                  >
                    {photo.caption}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <dialog
        ref={dialogRef}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClose={() => {
          if (index !== null) close();
        }}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        onKeyDown={onKeyDown}
        aria-labelledby={headingId}
        className={cn(
          'band-surface m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-band p-0 text-band-fg',
          'backdrop:bg-[var(--overlay)] open:animate-fade-in',
        )}
      >
        {current && index !== null ? (
          <div className="flex h-full flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <div className="flex shrink-0 items-center justify-between gap-3 px-3 py-2 sm:px-5">
              <div className="min-w-0">
                <h2 id={headingId} className="truncate text-sm font-semibold text-band-fg">
                  {albumTitle}
                </h2>
                <p aria-live="polite" className="text-xs tabular text-band-muted">
                  {index + 1} of {photos.length}
                </p>
              </div>
              <button type="button" onClick={close} aria-label="Close the viewer" autoFocus className={ROUND}>
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            {/* The stage. A tap on the space around the photograph closes the
                viewer, as a tap on the backdrop would. */}
            <div
              className="relative flex min-h-0 flex-1 items-center justify-center px-3 sm:px-20"
              onClick={(e) => {
                if (e.target === e.currentTarget) close();
              }}
            >
              {current.url ? (
                // College- and member-supplied storage URLs; see next.config.ts on why
                // archive imagery bypasses the image optimiser. Keyed so each
                // photograph fades in rather than swapping under the eye.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={current.id}
                  src={current.url}
                  alt={current.caption ?? ''}
                  className="max-h-full max-w-full animate-fade-in rounded-lg object-contain shadow-lg"
                />
              ) : null}

              <button
                type="button"
                onClick={() => step(-1)}
                disabled={first}
                aria-label="Previous photograph"
                className={cn(ROUND, 'absolute left-4 top-1/2 hidden -translate-y-1/2 sm:grid')}
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                disabled={last}
                aria-label="Next photograph"
                className={cn(ROUND, 'absolute right-4 top-1/2 hidden -translate-y-1/2 sm:grid')}
              >
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            </div>

            {/* Below the photograph, never on it: caption, who is in it, credit. */}
            <div className="mx-auto flex w-full max-w-3xl shrink-0 flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
              <div className="max-h-[22dvh] space-y-2.5 overflow-y-auto">
                {current.caption ? <p className="text-md text-band-fg">{current.caption}</p> : null}
                {current.tags.length > 0 ? <TagRow tags={current.tags} /> : null}
                {credit ? <p className="text-xs text-band-muted">{credit} — thank you</p> : null}
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="hidden items-center gap-1.5 text-xs text-band-muted sm:flex">
                  <Kbd>←</Kbd>
                  <Kbd>→</Kbd>
                  to move · <Kbd>Esc</Kbd> to close
                </p>
                <div className="flex flex-1 items-center justify-between gap-2 sm:hidden">
                  <button type="button" onClick={() => step(-1)} disabled={first} aria-label="Previous photograph" className={ROUND}>
                    <ChevronLeft className="size-5" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => step(1)} disabled={last} aria-label="Next photograph" className={ROUND}>
                    <ChevronRight className="size-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}

// ---------------------------------------------------------------

/** The photograph itself. Only photographs with a file reach the wall. */
function PhotoBody({ photo }: { photo: WallPhoto }) {
  if (!photo.url) return null;
  // College- and member-supplied storage URLs; see next.config.ts on why
  // archive imagery bypasses the image optimiser.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.url}
      alt={photo.caption ?? ''}
      className="size-full object-cover transition-transform duration-slow ease-brand group-hover:scale-[1.03]"
      loading="lazy"
    />
  );
}

/** Who is in the photograph, as chips on the viewer's dark ground. */
function TagRow({ tags }: { tags: PhotoTag[] }) {
  const chip =
    'inline-flex min-h-8 max-w-52 items-center gap-1.5 rounded-full border border-band-rule bg-[color-mix(in_srgb,var(--band-fg)_10%,transparent)] py-0.5 pl-0.5 pr-3 text-xs font-medium text-band-fg';
  return (
    <ul className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <li key={tag.id}>
          {tag.slug ? (
            <Link
              href={`/directory/${tag.slug}`}
              title={tag.line ? `${tag.name} · ${tag.line}` : tag.name}
              className={cn(
                chip,
                'transition-colors duration-fast ease-brand hover:bg-[color-mix(in_srgb,var(--band-fg)_20%,transparent)]',
              )}
            >
              <Avatar name={tag.name} src={tag.photoUrl} size="xs" />
              <span className="truncate">{tag.name}</span>
            </Link>
          ) : (
            // No link, because the profile behind it is one this viewer's
            // directory rules would refuse. The tag is still shown: the
            // photograph plainly has somebody in it.
            <span
              title="Not in the part of the directory your account can search."
              className={cn(chip, 'pl-3 text-band-muted')}
            >
              {tag.name}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
