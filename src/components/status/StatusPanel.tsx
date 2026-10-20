import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * The shape every "something is not as expected" screen shares: a lit
 * band, one sentence on what happened, one primary action and one
 * secondary, and the machine detail folded away.
 *
 * Why a band. A failure is the moment a college's portal is judged, and a
 * grey box with a warning triangle is the vendor's idea of a safe default,
 * not the college's. The band is the college's colour in both themes, so
 * the screen is theirs without knowing which college it is: no pack is
 * read here, which is what lets a client error boundary use it.
 *
 * Calm on purpose. Aurora and grain are the approved band texture; the
 * outlined glyph (404) is decoration only. Nothing animates but the
 * entrance, which the global reduced-motion rule removes.
 *
 * No hooks and no server APIs, so it renders in server and client files
 * alike (not-found pages and error boundaries).
 */

const step = (n: number) => ({ '--i': n }) as React.CSSProperties;

export function StatusPanel({
  icon,
  eyebrow,
  title,
  glyph,
  actions,
  children,
  variant = 'card',
  headingId = 'status-title',
  className,
}: {
  icon: React.ReactNode;
  /** What kind of moment this is: "Something went wrong", "Page not found". */
  eyebrow: string;
  /** The h1. One sentence, what happened. */
  title: string;
  /** Decorative outlined word, `aria-hidden`. Never carries meaning. */
  glyph?: string;
  /** One primary and one secondary, as band buttons. */
  actions: React.ReactNode;
  /** What to do next, in a sentence or two. */
  children: React.ReactNode;
  /** `bleed` runs edge to edge under the site header; `card` is a rounded panel on the page. */
  variant?: 'card' | 'bleed';
  headingId?: string;
  className?: string;
}) {
  const bleed = variant === 'bleed';

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'band-surface grain relative isolate overflow-hidden',
        !bleed &&
          'rounded-xl shadow-lg ring-1 ring-inset ring-[color-mix(in_srgb,var(--band-fg)_16%,transparent)]',
        className,
      )}
    >
      <div className="aurora" aria-hidden="true" />
      {glyph ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-[0.06em] right-4 z-0 select-none whitespace-nowrap font-display text-[clamp(5rem,15vw,10rem)] font-bold leading-none sm:right-8 text-transparent [-webkit-text-stroke:1.5px_color-mix(in_srgb,var(--band-fg)_18%,transparent)]"
        >
          {glyph}
        </span>
      ) : null}

      <div
        className={cn(
          'relative z-[2]',
          bleed ? 'page-shell py-14 lg:py-20' : 'px-6 py-10 sm:px-10 lg:px-14 lg:py-14',
        )}
      >
        <div className="stagger max-w-prose">
          <span
            aria-hidden="true"
            className="grid size-12 place-items-center rounded-full border border-band-rule bg-[color-mix(in_srgb,var(--band-fg)_10%,transparent)] text-band-fg [&>svg]:size-5"
            style={step(0)}
          >
            {icon}
          </span>
          <p className="eyebrow mt-6 text-band-accent" style={step(1)}>
            {eyebrow}
          </p>
          {/* Plain string, not `cn`: tailwind-merge reads `text-display-*` as a colour and drops it beside `text-band-fg`. */}
          <h1
            id={headingId}
            className="mt-3 font-display text-display-md font-bold tracking-tight text-band-fg"
            style={step(2)}
          >
            {title}
          </h1>
          <div className="mt-4 space-y-3 text-md text-band-muted" style={step(3)}>
            {children}
          </div>
          <div className="mt-8 flex flex-wrap gap-3 [&>*]:min-h-12" style={step(4)}>
            {actions}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The reference and anything else a person reading the server log would
 * want, behind a disclosure. A native `<details>`: it works before the
 * page hydrates, which is exactly when an error screen is most likely to
 * be on screen. The summary keeps a 44px target on phones.
 */
export function TechnicalDetails({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <details
      className={cn('group rounded-lg border border-line bg-surface-raised text-sm', className)}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-4 font-medium text-secondary transition-colors duration-fast ease-brand hover:text-primary [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="size-4 transition-transform duration-fast ease-brand group-open:rotate-90"
          aria-hidden="true"
        />
        Technical details
      </summary>
      <div className="space-y-3 border-t border-line px-4 py-3 text-secondary">{children}</div>
    </details>
  );
}

/** One labelled value in a `TechnicalDetails` body. Selectable in a single click, for pasting into a message. */
export function DetailLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </span>
      <span className="min-w-0 break-all font-mono text-sm text-primary [&]:select-all">
        {children}
      </span>
    </p>
  );
}
