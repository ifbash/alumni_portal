import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * The head of every sign-in step: an eyebrow, the page's one h1, and a lead.
 * Carries the entrance stagger's first slots; the page continues from
 * `--i: 1`.
 */
export function AuthHeader({
  eyebrow,
  title,
  icon,
  children,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** A glyph in a soft disc above the eyebrow. Decorative. */
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('space-y-3', className)} style={{ '--i': 0 } as React.CSSProperties}>
      {icon ? (
        <span
          aria-hidden="true"
          className="relative mb-2 grid size-12 place-items-center rounded-full bg-brand-soft text-brand-soft-fg ring-1 ring-[color-mix(in_srgb,var(--brand-500)_24%,transparent)]"
        >
          {icon}
        </span>
      ) : null}
      {eyebrow ? <p className="eyebrow text-brand-fg">{eyebrow}</p> : null}
      <h1 className="font-display text-display-md font-bold">{title}</h1>
      {children ? <div className="space-y-2 text-md text-secondary">{children}</div> : null}
    </header>
  );
}
