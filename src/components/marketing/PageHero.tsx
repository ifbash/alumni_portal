import * as React from 'react';

/**
 * The hero of a public interior page (About, Contact, Events), on the
 * band: the landing page's atmosphere with less of it.
 *
 * Aurora and grain are the band's approved texture. The oversized outlined
 * word at the right is a typographic device, `aria-hidden`, drawn at 20%
 * of the band's foreground so the heading in front of it keeps its
 * contrast. It is sized by its own length so a long short-name ("Tamarind")
 * stays inside the page rather than running behind the heading.
 */
const step = (n: number) => ({ '--i': n }) as React.CSSProperties;

export function PageHero({
  id,
  eyebrow,
  title,
  glyph,
  children,
}: {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  /** Decorative outlined word or number. Never carries meaning. */
  glyph?: string;
  children?: React.ReactNode;
}) {
  const size = glyph ? Math.max(7, Math.min(20, Math.round(72 / glyph.length))) : 0;

  return (
    <section aria-labelledby={id} className="band-surface grain relative isolate overflow-hidden">
      <div className="aurora" aria-hidden="true" />
      {glyph ? (
        <span
          aria-hidden="true"
          style={{ fontSize: `clamp(5rem, ${size}vw, 17rem)` }}
          className="pointer-events-none absolute -bottom-[0.16em] right-[-0.03em] z-0 select-none whitespace-nowrap font-display font-bold leading-none text-transparent [-webkit-text-stroke:1.5px_color-mix(in_srgb,var(--band-fg)_18%,transparent)]"
        >
          {glyph}
        </span>
      ) : null}

      <div className="page-shell relative z-10 py-14 lg:py-20">
        <div className="stagger max-w-prose space-y-3">
          <p className="text-sm font-semibold text-band-accent" style={step(0)}>
            {eyebrow}
          </p>
          <h1 id={id} className="font-display text-display-lg font-bold text-band-fg" style={step(1)}>
            {title}
          </h1>
          {children ? (
            <p className="text-md text-band-muted" style={step(2)}>
              {children}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
