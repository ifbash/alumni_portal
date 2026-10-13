'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';

import { Avatar, Badge, Button, Kbd } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * The photograph wall and its viewer.
 *
 * Built on the native `<dialog>` element, the same way `components/ui/
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
      {/* Multi-column rather than a fixed grid: photographs come in mixed
          orientations, and a row-based grid either crops them or leaves a
          ragged gap under every portrait. */}
      <div className="columns-2 gap-3 sm:columns-3 sm:gap-4 xl:columns-4">
        {photos.map((photo, i) => (
          <figure key={photo.id} className="mb-3 break-inside-avoid sm:mb-4">
            <button
              type="button"
              ref={(el) => {
                triggers.current[i] = el;
              }}
              onClick={() => open(i)}
              aria-label={`Open photograph ${i + 1} of ${photos.length}${
                photo.caption ? `: ${photo.caption}` : ''
              } in the viewer`}
              style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
              className={cn(
                'group relative block w-full overflow-hidden rounded-lg border border-line bg-surface-sunken',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
              )}
            >
              <PhotoBody photo={photo} />
              <span
                aria-hidden="true"
                className={cn(
                  'absolute bottom-2 right-2 grid size-7 place-items-center rounded bg-scrim text-band-fg',
                  'opacity-0 transition-opacity duration-fast ease-brand group-hover:opacity-100 group-focus-visible:opacity-100',
                )}
              >
                <Maximize2 className="size-3.5" />
              </span>
            </button>

            {photo.caption || photo.tags.length > 0 ? (
              <figcaption className="space-y-1.5 pt-2">
                {photo.caption ? <p className="text-xs text-secondary">{photo.caption}</p> : null}
                {photo.tags.length > 0 ? <TagRow tags={photo.tags} /> : null}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>

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
          'm-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-[var(--overlay)] p-0 text-band-fg',
          'backdrop:bg-[var(--overlay)] open:animate-fade-in',
        )}
      >
        {current && index !== null ? (
          <div className="flex h-full flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <h2 id={headingId} className="sr-only">
              {albumTitle}
            </h2>

            {/* The photograph, as large as the screen allows. A tap on the
                space around it closes the viewer, as a tap on the backdrop
                would. */}
            <div
              className="relative flex min-h-0 flex-1 items-center justify-center px-3 pb-3 pt-16 sm:px-16"
              onClick={(e) => {
                if (e.target === e.currentTarget) close();
              }}
            >
              <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-3">
                <p aria-live="polite" className="rounded-full bg-scrim px-3 py-1.5 text-sm font-medium tabular text-band-fg">
                  {index + 1} of {photos.length}
                </p>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close the viewer"
                  className="grid size-11 place-items-center rounded-full bg-scrim text-band-fg"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>

              {current.url ? (
                // College- and member-supplied storage URLs; see next.config.ts on why
                // archive imagery bypasses the image optimiser.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={current.url}
                  alt={current.caption ?? ''}
                  className="max-h-full max-w-full rounded object-contain"
                />
              ) : null}

              <button
                type="button"
                onClick={() => step(-1)}
                disabled={first}
                aria-label="Previous photograph"
                className="absolute left-3 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-scrim text-band-fg disabled:opacity-40 sm:grid"
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                disabled={last}
                aria-label="Next photograph"
                className="absolute right-3 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-scrim text-band-fg disabled:opacity-40 sm:grid"
              >
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            </div>

            {/* The bottom sheet: caption, tags, credit. */}
            <div className="max-h-[40dvh] shrink-0 space-y-3 overflow-y-auto rounded-t-xl bg-surface-raised px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 text-primary shadow-lg">
              {current.caption ? <p className="text-sm">{current.caption}</p> : null}
              {current.tags.length > 0 ? <TagRow tags={current.tags} /> : null}
              {credit ? <p className="text-xs text-secondary">{credit} — thank you</p> : null}

              <div className="flex items-center justify-between gap-3">
                <p className="hidden items-center gap-1.5 text-xs text-secondary sm:flex">
                  <Kbd>←</Kbd>
                  <Kbd>→</Kbd>
                  to move · <Kbd>Esc</Kbd> to close
                </p>
                <div className="flex flex-1 items-center gap-2 sm:hidden">
                  <Button variant="secondary" onClick={() => step(-1)} disabled={first} className="min-h-11 flex-1">
                    <ChevronLeft className="size-4" aria-hidden="true" />
                    Previous
                  </Button>
                  <Button variant="secondary" onClick={() => step(1)} disabled={last} className="min-h-11 flex-1">
                    Next
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </Button>
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
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={photo.url} alt={photo.caption ?? ''} className="size-full object-cover" loading="lazy" />;
}

function TagRow({ tags }: { tags: PhotoTag[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <li key={tag.id}>
          {tag.slug ? (
            <Link
              href={`/directory/${tag.slug}`}
              title={tag.line ? `${tag.name} · ${tag.line}` : tag.name}
              className={cn(
                'inline-flex max-w-52 items-center gap-1.5 rounded-full border border-line bg-surface py-0.5 pl-0.5 pr-2.5',
                'text-xs font-medium text-primary transition-colors duration-fast ease-brand',
                'hover:border-line-strong hover:text-brand-fg',
              )}
            >
              <Avatar name={tag.name} src={tag.photoUrl} size="xs" />
              <span className="truncate">{tag.name}</span>
            </Link>
          ) : (
            // No link, because the profile behind it is one this viewer's
            // directory rules would refuse. The tag is still shown: the
            // photograph plainly has somebody in it.
            <Badge tone="neutral" title="Not in the part of the directory your account can search.">
              {tag.name}
            </Badge>
          )}
        </li>
      ))}
    </ul>
  );
}
