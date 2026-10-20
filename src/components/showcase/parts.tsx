import * as React from 'react';
import { cn } from '@/lib/cn';
import { EYEBROW, H2 } from './styles';

/**
 * The few pieces every section of the product site is built from.
 *
 * Every sentence on this page is something the repository does today, or is
 * labelled "Coming next". That is not modesty: the people reading it are
 * the ones who will sign the purchase order and then field the complaints,
 * and a claim they find to be untrue on the demo call costs more than the
 * feature was worth.
 */

/**
 * A section's opening: the numbered eyebrow, the headline, and at most one
 * short sentence. On a laptop the sentence sits beside the headline, so the
 * head costs one row of height, not two.
 */
export function SectionHead({
  id,
  n,
  eyebrow,
  title,
  children,
  className,
}: {
  id: string;
  /** Position in the story, "01" to "07". */
  n: string;
  eyebrow: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-x-12 gap-y-4 lg:grid-cols-12 lg:items-end', className)}>
      <div className="lg:col-span-7">
        <p className={EYEBROW}>
          <span className="tabular">{n}</span>
          <span aria-hidden="true"> / </span>
          {eyebrow}
        </p>
        {/* Not `cn`: tailwind-merge reads `text-display-md` as a colour and drops it beside `text-primary`. */}
        <h2 id={id} className={`${H2} mt-3`}>
          {title}
        </h2>
      </div>
      {children ? <div className="text-base text-secondary lg:col-span-5 lg:pb-1 lg:text-md">{children}</div> : null}
    </div>
  );
}

/** A square, hairline tag in mono. Square because the house pack is. */
export function Tag({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'accent' }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center border px-1.5 font-mono text-xs uppercase leading-5 tracking-[0.12em]',
        tone === 'accent' ? 'border-accent-fg text-accent-fg' : 'border-line-strong text-secondary',
      )}
    >
      {children}
    </span>
  );
}

/** A bare, ruled bullet: a hairline dash, not a dot. */
export function Dash({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm text-secondary">
      <span aria-hidden="true" className="mt-[0.8em] h-px w-3 shrink-0 bg-line-strong" />
      <span>{children}</span>
    </li>
  );
}
