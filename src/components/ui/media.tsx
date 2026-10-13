import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Media primitives. Isomorphic: no hooks, no client directive, so they
 * render the same in a server page and in a client-side preview.
 *
 * A photo must never read as a claim about what it shows. Text goes on a
 * photo only through `MediaFrame`'s `overlay`, which is forced onto the
 * scrim in the band's foreground; captions go below it. Content without a
 * photo gets `CoverArt` (one real datum, set large) or nothing — never a
 * stock image, never "photo not uploaded".
 */

const ASPECT = {
  '21/9': 'aspect-[21/9]',
  '2/1': 'aspect-[2/1]',
  '16/9': 'aspect-video',
  '3/2': 'aspect-[3/2]',
  '4/3': 'aspect-[4/3]',
  '1/1': 'aspect-square',
} as const;

export type MediaAspect = keyof typeof ASPECT;

/**
 * A photo at a fixed aspect, so nothing moves when it loads.
 *
 * With no `src`, the `fallback` (usually `CoverArt`) fills the same frame;
 * with neither, it renders nothing at all. `overlay` renders only over a
 * real photo, on `bg-scrim`, in `text-band-fg`.
 */
export function MediaFrame({
  src,
  alt = '',
  focus,
  aspect = '16/9',
  fallback,
  caption,
  overlay,
  loading = 'lazy',
  rounded = true,
  className,
}: {
  src?: string | null;
  /** Empty for a decorative image. Required in spirit for content photos. */
  alt?: string;
  /** CSS `object-position`, e.g. "50% 40%". */
  focus?: string;
  aspect?: MediaAspect;
  fallback?: React.ReactNode;
  caption?: React.ReactNode;
  overlay?: React.ReactNode;
  loading?: 'lazy' | 'eager';
  rounded?: boolean;
  className?: string;
}) {
  if (!src && !fallback) return null;

  return (
    <figure className={cn('min-w-0', className)}>
      <div
        className={cn(
          'relative overflow-hidden border border-line bg-surface-sunken',
          rounded && 'rounded-lg',
          ASPECT[aspect],
        )}
      >
        {src ? (
          // Tenant- and member-supplied URLs on arbitrary hosts; see
          // next.config.ts on why these bypass the image optimiser.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            loading={loading}
            decoding="async"
            className="absolute inset-0 size-full object-cover"
            style={focus ? { objectPosition: focus } : undefined}
          />
        ) : (
          fallback
        )}
        {src && overlay ? (
          <div className="absolute inset-x-0 bottom-0 bg-scrim p-4 text-band-fg">{overlay}</div>
        ) : null}
      </div>
      {caption ? <figcaption className="mt-2 text-sm text-secondary">{caption}</figcaption> : null}
    </figure>
  );
}

/**
 * A typographic tile for content with no photo: a soft tint and one real
 * datum set large — a batch year, a branch code, a percentage raised.
 * No crest, no illustration, nothing that pretends to be a picture. It
 * fills its parent (put it inside `MediaFrame` as the `fallback`, or in any
 * box with a height) and is hidden from assistive tech, because the card
 * around it already says the same thing in words.
 */
export function CoverArt({
  motif,
  label,
  tone = 'brand',
  icon,
  className,
}: {
  motif: string;
  label?: string;
  tone?: 'brand' | 'accent';
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative grid size-full content-end gap-1 p-4',
        tone === 'accent' ? 'bg-accent-soft text-accent-soft-fg' : 'bg-brand-soft text-brand-soft-fg',
        className,
      )}
    >
      {icon ? (
        <span className="absolute left-4 top-4 grid size-5 place-items-center [&>svg]:size-5">{icon}</span>
      ) : null}
      <span className="font-display text-display-sm font-bold leading-none tabular">{motif}</span>
      {label ? <span className="text-sm font-medium">{label}</span> : null}
    </div>
  );
}

const DATE_TILE_WIDTH = { sm: 'w-12', md: 'w-14', lg: 'w-16' } as const;

/**
 * The public "Coming up" date tile: month, day, weekday. The same markup
 * as `components/marketing/EventRows.tsx`, so an event looks the same
 * signed in and signed out. Dates are set in the tenant's time zone. The
 * tile is decorative: the row beside it states the date in words.
 */
export function DateTile({
  iso,
  locale = 'en-IN',
  timeZone = 'Asia/Kolkata',
  size = 'md',
  className,
}: {
  iso: string;
  locale?: string;
  timeZone?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const d = new Date(iso);
  const part = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...opts, timeZone }).format(d);

  return (
    <span
      aria-hidden="true"
      className={cn(
        'block shrink-0 self-start rounded border border-line bg-surface py-2 text-center',
        DATE_TILE_WIDTH[size],
        className,
      )}
    >
      <span className="block text-xs font-semibold uppercase tracking-wider text-brand-fg">{part({ month: 'short' })}</span>
      <span className="block font-display text-xl font-bold leading-none tabular">{part({ day: 'numeric' })}</span>
      <span className="block text-xs text-secondary">{part({ weekday: 'short' })}</span>
    </span>
  );
}
