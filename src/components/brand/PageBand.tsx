import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { BrandPack } from '@/lib/branding/pack';
import type { BandPhoto } from '@/lib/branding/media';
import { Crest } from './Crest';

export type { BandPhoto };

/**
 * The college, at the top of a hub.
 *
 * After sign-in the college shows in three places: the sidebar's identity
 * block, one of these on each hub, and the moments that matter. Work
 * screens use `PageHeader` instead.
 *
 * Designed bare first. No pack has a crest today, so the main case is a
 * solid band with a heading on it; a crest or a photo is an addition to a
 * layout that already works, never a hole a placeholder fills.
 *
 *  - `photo` shows only at `lg`, behind `.scrim-hero`, with the text held
 *    to the solid 60% of the scrim. Pick it with `pickBandPhoto` and
 *    friends (`src/lib/branding/media.ts`); nothing else chooses one.
 *  - `photoOnPhones` adds the same photo as a 2:1 strip above the text
 *    below `lg`, with no text on it.
 *  - `compact` is for work hubs (directory, jobs, mentorship, the
 *    console): tighter padding, a smaller heading, never a photo.
 *
 * On the band, text is band-* only, and a light card inside it carries
 * `.band-exit`.
 */
export function PageBand({
  pack,
  title,
  as: Heading = 'h1',
  headingId = 'page-band-title',
  eyebrow,
  lead,
  meta,
  actions,
  aside,
  photo = null,
  photoOnPhones = false,
  size = 'standard',
  showCrest = true,
  className,
}: {
  pack: BrandPack;
  title: React.ReactNode;
  as?: 'h1' | 'h2';
  headingId?: string;
  eyebrow?: React.ReactNode;
  lead?: React.ReactNode;
  /** A row of `BandChip`s. */
  meta?: React.ReactNode;
  /** Band buttons (`variant="band"` / `"band-outline"`). */
  actions?: React.ReactNode;
  /** A right-hand column at `lg` (22rem), e.g. a `.band-exit` card. */
  aside?: React.ReactNode;
  photo?: BandPhoto | null;
  photoOnPhones?: boolean;
  size?: 'compact' | 'standard';
  showCrest?: boolean;
  className?: string;
}) {
  const compact = size === 'compact';
  // A compact band never carries a photo: it heads a work screen.
  const shown = compact ? null : photo;

  return (
    <section
      aria-labelledby={headingId}
      className={cn('band-surface relative isolate -mx-4 overflow-hidden sm:mx-0 sm:rounded-xl', className)}
    >
      {shown ? (
        <>
          {/* Tenant-supplied URLs; see next.config.ts. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shown.src}
            alt={shown.alt}
            decoding="async"
            className="absolute inset-0 -z-10 hidden size-full object-cover lg:block"
            style={{ objectPosition: shown.focus }}
          />
          <div aria-hidden="true" className="scrim-hero absolute inset-0 -z-10 hidden lg:block" />
          {photoOnPhones ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown.src}
              alt={shown.alt}
              decoding="async"
              className="block aspect-[2/1] w-full object-cover lg:hidden"
              style={{ objectPosition: shown.focus }}
            />
          ) : null}
        </>
      ) : null}

      <div
        className={cn(
          compact ? 'px-5 py-5 sm:px-8 lg:py-6' : 'px-5 py-6 sm:px-8 lg:py-10',
          aside ? 'grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8' : null,
        )}
      >
        <div className={cn('flex min-w-0 items-start gap-4', shown && 'lg:max-w-[60%]')}>
          {showCrest ? <Crest pack={pack} size={compact ? 40 : 48} /> : null}
          <div className="min-w-0">
            {eyebrow ? (
              <p className={cn('text-sm font-semibold text-band-accent', shown && 'lg:text-band-fg')}>{eyebrow}</p>
            ) : null}
            {/* Plain string, not `cn`: tailwind-merge reads `text-display-*`
                as a colour and would drop it beside `text-band-fg`. */}
            <Heading
              id={headingId}
              className={`${eyebrow ? 'mt-1 ' : ''}font-display font-bold text-band-fg ${compact ? 'text-display-xs' : 'text-display-sm'}`}
            >
              {title}
            </Heading>
            {lead ? (
              <p className={cn('mt-2 max-w-prose text-md text-band-muted', shown && 'lg:text-band-fg')}>{lead}</p>
            ) : null}
            {meta ? <div className="mt-3 flex flex-wrap gap-2">{meta}</div> : null}
            {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
          </div>
        </div>
        {aside ? <div className="min-w-0">{aside}</div> : null}
      </div>
    </section>
  );
}

/**
 * A fact on the band: "Batch of 2017", "214 graduates". As a link it
 * keeps a 44px target on touch.
 */
export function BandChip({
  children,
  icon,
  href,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  href?: string;
}) {
  const classes =
    'inline-flex min-h-8 items-center gap-1.5 rounded-full border border-band-rule px-3 text-xs font-medium text-band-fg';
  const inner = (
    <>
      {icon ? (
        <span className="grid size-3.5 shrink-0 place-items-center [&>svg]:size-3.5" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </>
  );

  if (!href) return <span className={classes}>{inner}</span>;

  return (
    <Link
      href={href}
      className={cn(
        classes,
        'min-h-11 transition-colors duration-fast ease-brand hover:bg-[color-mix(in_srgb,var(--band-fg)_12%,transparent)] sm:min-h-8',
      )}
    >
      {inner}
    </Link>
  );
}
