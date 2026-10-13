import * as React from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Disclosure, Popover } from './overlay';

/**
 * Explanation, kept out of the way of the work.
 *
 * A screen serves the person first. How the system works is said at most
 * once per screen, in plain words (120 or fewer), inside a disclosure the
 * reader opens if they want it. A one-line promise ("Checked by the
 * placement cell") is a `TrustChip`, not a paragraph.
 *
 * No client directive here: both render client leaves (`Disclosure`,
 * `Popover`) and can themselves be used from server or client code.
 */

/** "How this works", closed by default. At most one per screen. */
export function HowThisWorks({
  summary = 'How this works',
  children,
  id,
  className,
}: {
  summary?: React.ReactNode;
  children: React.ReactNode;
  /** Lets a link elsewhere on the page open-target it. */
  id?: string;
  className?: string;
}) {
  return (
    <Disclosure
      id={id}
      summary={
        <span className="flex items-center gap-2">
          <Info className="size-4 shrink-0 text-brand-fg" aria-hidden="true" />
          {summary}
        </span>
      }
      className={cn('bg-surface', className)}
    >
      <div className="space-y-2 leading-relaxed">{children}</div>
    </Disclosure>
  );
}

/**
 * A one-line promise in a chip: "Checked by the placement cell". With
 * `detail`, the chip opens a short explanation in a popover.
 */
export function TrustChip({
  icon,
  children,
  detail,
  className,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  detail?: React.ReactNode;
  className?: string;
}) {
  const chip = (interactive: boolean) => (
    <span
      className={cn(
        'inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-medium text-secondary',
        // A chip that opens something is a control: 44px on touch.
        interactive && 'min-h-11 cursor-pointer hover:border-line-strong hover:text-primary sm:min-h-8',
        className,
      )}
    >
      {icon ? (
        <span className="grid size-3.5 shrink-0 place-items-center [&>svg]:size-3.5" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
      {interactive ? <Info className="size-3.5 shrink-0" aria-hidden="true" /> : null}
    </span>
  );

  if (!detail) return chip(false);

  return (
    <Popover trigger={chip(true)} className="inline-flex">
      <div className="text-sm text-secondary">{detail}</div>
    </Popover>
  );
}
