import * as React from 'react';

/**
 * The shape every "that is not here" screen inside the portal shares, and
 * the error boundary with its numeral switched off.
 *
 * One calm panel in the real content column: a tinted icon, the words, the
 * way back, and a giant outlined "404" bleeding off the corner. The numeral
 * is decoration (hidden from assistive technology); the eyebrow names what
 * was looked for, and the page's one `h1` is the sentence under it.
 *
 * It never explains *why* a page is missing. Several rules land on the
 * same screen (deleted, unpublished, not open to this account), and
 * telling them apart would leak which addresses exist.
 */
export function NotFoundPanel({
  eyebrow,
  icon,
  title,
  description,
  action,
  numeral = '404',
  children,
}: {
  /** What was not found: "Event not found". */
  eyebrow: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  /** One or two buttons. */
  action?: React.ReactNode;
  /** The outlined figure in the corner. `null` for a panel that is not a 404. */
  numeral?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <section className="ring-hairline relative overflow-hidden rounded-xl border border-line bg-surface-raised px-6 py-10 shadow-sm sm:px-10 sm:py-14">
      {numeral ? (
        <span
          aria-hidden="true"
          className="display-outline pointer-events-none absolute -right-3 -top-4 select-none font-display text-[clamp(7rem,24vw,15rem)] font-bold leading-none tracking-tight text-brand-fg opacity-[0.14]"
        >
          {numeral}
        </span>
      ) : null}

      <div className="stagger relative max-w-xl space-y-4">
        <span
          style={{ '--i': 0 } as React.CSSProperties}
          className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand-soft-fg [&>svg]:size-5"
          aria-hidden="true"
        >
          {icon}
        </span>
        <div className="space-y-2">
          <p style={{ '--i': 1 } as React.CSSProperties} className="eyebrow text-brand-fg">
            {eyebrow}
          </p>
          <h1 style={{ '--i': 2 } as React.CSSProperties} className="font-display text-display-sm font-bold tracking-tight">
            {title}
          </h1>
        </div>
        <p style={{ '--i': 3 } as React.CSSProperties} className="text-md text-secondary">
          {description}
        </p>
        {action ? (
          <div style={{ '--i': 4 } as React.CSSProperties} className="flex flex-wrap gap-2 pt-1">
            {action}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}
