'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ImageOff, Maximize2 } from 'lucide-react';

import { Avatar, Badge, Button, Kbd } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * The photograph wall and its viewer.
 *
 * Built on the native `<dialog>` element, the same way `components/ui/
 * overlay.tsx` builds `Dialog` and `Sheet`, and for the same reason: focus
 * trapping, Escape-to-close, `inert` on the background and correct
 * screen-reader semantics all come free and all get subtly wrong when
 * hand-rolled. Arrow keys and focus return are the two things the platform
 * does not give us, so they are the only two things implemented here.
 *
 * Focus returns to the thumbnail that *opened* the viewer, not to whichever
 * photograph you arrowed onto. Someone who opens photo 3, browses to photo
 * 30 and presses Escape expects to be back where they were reading, not
 * scrolled two screens down the wall.
 *
 * Every photograph in this build has `url: null`, which is also what a
 * college's first week looks like. A tile with no file is drawn at the real
 * aspect ratio of the photograph it is waiting for, so the wall is the
 * shape it will always be and nothing reflows when the uploads land.
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

export function PhotoWall({ photos, albumTitle }: { photos: WallPhoto[]; albumTitle: string }) {
  const [index, setIndex] = React.useState<number | null>(null);

  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const triggers = React.useRef<Array<HTMLButtonElement | null>>([]);
  const openedFrom = React.useRef<number | null>(null);

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

  const current = index === null ? null : photos[index] ?? null;

  return (
    <>
      {/* Multi-column rather than a fixed grid: the fixture widths and
          heights vary on purpose, and a row-based grid either crops mixed
          orientations or leaves a ragged gap under every portrait. */}
      <div className="columns-2 gap-4 sm:columns-3 xl:columns-4">
        {photos.map((photo, i) => (
          <figure
            key={photo.id}
            className="mb-4 break-inside-avoid overflow-hidden rounded-lg border border-line bg-surface-raised"
          >
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
                'group relative block w-full bg-surface-sunken',
                'transition-colors duration-fast ease-brand hover:bg-surface',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
              )}
            >
              <PhotoBody photo={photo} />

              <span
                aria-hidden="true"
                className={cn(
                  'absolute bottom-2 right-2 grid size-7 place-items-center rounded border border-line',
                  'bg-surface-raised text-muted opacity-0 shadow-sm transition-opacity duration-fast ease-brand',
                  'group-hover:opacity-100 group-focus-visible:opacity-100',
                )}
              >
                <Maximize2 className="size-3.5" />
              </span>
            </button>

            {photo.caption || photo.tags.length > 0 ? (
              <figcaption className="space-y-2 border-t border-line p-3">
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
          'w-[calc(100vw-2rem)] max-w-4xl rounded-lg border border-line bg-surface-raised p-0 text-primary shadow-lg',
          'backdrop:bg-[var(--overlay)] open:animate-scale-in',
        )}
      >
        {current && index !== null ? (
          <div className="flex max-h-[90dvh] flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-line p-4">
              <div className="min-w-0 space-y-0.5">
                <h2 id={headingId} className="truncate font-display text-md font-semibold">
                  {albumTitle}
                </h2>
                <p aria-live="polite" className="text-xs tabular text-secondary">
                  {index + 1} of {photos.length}
                </p>
              </div>

              <button
                type="button"
                onClick={close}
                aria-label="Close the viewer"
                className="-m-1 grid size-8 shrink-0 place-items-center rounded text-muted hover:bg-surface-sunken hover:text-primary"
              >
                <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden="true">
                  <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="flex justify-center bg-surface-sunken p-4">
                <div
                  style={{ aspectRatio: `${current.width} / ${current.height}` }}
                  className="h-[min(56dvh,32rem)] max-h-full w-auto max-w-full overflow-hidden rounded border border-line bg-surface-raised"
                >
                  <PhotoBody photo={current} large />
                </div>
              </div>

              <div className="space-y-3 p-4">
                <p className="text-sm">
                  {current.caption ?? (
                    <span className="text-muted">
                      No caption was written for this photograph.
                    </span>
                  )}
                </p>

                {current.tags.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Tagged</p>
                    <TagRow tags={current.tags} />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3">
              <p className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
                <Kbd>←</Kbd>
                <Kbd>→</Kbd>
                to move · <Kbd>Esc</Kbd> to close
              </p>

              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => step(-1)} disabled={index === 0}>
                  <ChevronLeft className="size-4" aria-hidden="true" />
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => step(1)}
                  disabled={index === photos.length - 1}
                >
                  Next
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}

// ---------------------------------------------------------------

/**
 * The photograph, or an honest stand-in for it.
 *
 * Never an `<img>` with an empty `src` — that renders the browser's broken
 * icon at whatever size it feels like and collapses the tile it was meant
 * to fill. The stand-in states plainly that the file has not been uploaded
 * and carries the pixel dimensions the record holds, so an operator
 * chasing missing files can see which ones they are.
 */
function PhotoBody({ photo, large = false }: { photo: WallPhoto; large?: boolean }) {
  if (photo.url) {
    // College- and member-supplied storage URLs; see next.config.ts on why
    // archive imagery bypasses the image optimiser.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo.url} alt={photo.caption ?? ''} className="size-full object-cover" loading="lazy" />;
  }

  return (
    <span className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center">
      <ImageOff className={cn('text-muted', large ? 'size-7' : 'size-5')} aria-hidden="true" />
      <span className={cn('font-medium text-secondary', large ? 'text-sm' : 'text-xs')}>
        Photograph not uploaded
      </span>
      <span className="font-mono text-xs tabular text-muted">
        {photo.width} × {photo.height}
      </span>
    </span>
  );
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
                'text-xs font-medium transition-colors duration-fast ease-brand',
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
