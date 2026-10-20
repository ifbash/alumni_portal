import * as React from 'react';
import { CircleCheck, OctagonX, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/cn';

import type { BrandVerdict } from './brand-check';

/**
 * The console's few repeated pieces, so the four screens read as one tool.
 *
 * Everything resolves through the house tokens. A college's own colour only
 * ever appears from pack data (see `CollegeMark`), never from a class here.
 */

const step = (i: number) => ({ '--i': i }) as React.CSSProperties;

export interface BandFigure {
  value: React.ReactNode;
  label: string;
}

/**
 * The house band at the top of a console screen: one lit surface, with the
 * screen's few figures as display numerals on its right. Figures are counts
 * of colleges and packs, never of people.
 */
export function ConsoleBand({
  eyebrow,
  title,
  lead,
  actions,
  figures,
  headingId = 'console-title',
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  /** Band buttons (`variant="band"` / `"band-outline"`). */
  actions?: React.ReactNode;
  figures?: BandFigure[];
  headingId?: string;
}) {
  return (
    <section
      aria-labelledby={headingId}
      className="band-surface grain relative isolate -mx-4 overflow-hidden sm:mx-0 sm:rounded-xl sm:shadow-lg"
    >
      <div className="aurora" aria-hidden="true" />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] hidden rounded-[inherit] ring-1 ring-inset ring-[color-mix(in_srgb,var(--band-fg)_16%,transparent)] sm:block"
      />
      <div
        className={cn(
          'stagger relative z-[2] grid gap-x-10 gap-y-7 px-5 py-7 sm:px-8 lg:py-9',
          figures?.length ? 'lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end' : null,
        )}
      >
        <div className="min-w-0" style={step(0)}>
          <p className="eyebrow font-mono text-band-accent">{eyebrow}</p>
          {/* Plain string, not `cn`: tailwind-merge reads `text-display-*` as a colour. */}
          <h1 id={headingId} className="mt-3 font-display text-display-md font-bold tracking-tight text-band-fg">
            {title}
          </h1>
          {lead ? <p className="mt-3 max-w-prose text-md text-band-muted">{lead}</p> : null}
          {actions ? <div className="mt-6 flex flex-wrap gap-2">{actions}</div> : null}
        </div>

        {figures?.length ? (
          <dl
            style={step(1)}
            className="grid grid-cols-2 gap-x-8 gap-y-5 border-t border-band-rule pt-6 sm:grid-cols-4 lg:min-w-[26rem] lg:border-l lg:border-t-0 lg:pl-9 lg:pt-0"
          >
            {figures.map((f) => (
              <div key={f.label} className="min-w-0">
                <dd className="font-display text-display-xs font-bold leading-none tabular text-band-fg">{f.value}</dd>
                <dt className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-band-muted">{f.label}</dt>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}

/** A mono, uppercase label: column heads, row labels, owner tags. */
export const LABEL = 'font-mono text-xs uppercase tracking-[0.14em] text-secondary';

/** A section heading: the eyebrow with its leading rule, then the heading. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  children,
  actions,
}: {
  id?: string;
  eyebrow: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 space-y-2">
        <p className="eyebrow font-mono text-brand-fg">{eyebrow}</p>
        <h2 id={id} className="font-display text-xl font-bold tracking-tight text-primary">
          {title}
        </h2>
        {children ? <p className="max-w-prose text-sm text-secondary">{children}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

const VERDICT_ICON = { success: CircleCheck, warning: TriangleAlert, danger: OctagonX } as const;
const VERDICT_TEXT = { success: 'text-success-fg', warning: 'text-warning-fg', danger: 'text-danger-fg' } as const;

/** The brand check as an icon and a word, coloured by status but never by colour alone. */
export function VerdictText({ verdict, className }: { verdict: BrandVerdict; className?: string }) {
  const Icon = VERDICT_ICON[verdict.tone];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', VERDICT_TEXT[verdict.tone], className)}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {verdict.label}
    </span>
  );
}

/**
 * Filled and empty slots as a row of ticks, with the count beside it.
 * Chart tokens, so the filled ticks clear 3:1 in both modes.
 */
export function Meter({
  value,
  total,
  label,
  className,
}: {
  value: number;
  total: number;
  /** Read out in place of the ticks, which are decoration. */
  label: string;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="flex gap-0.5" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn('h-2 w-2.5', i < value ? 'bg-chart-bar' : 'bg-chart-track')} />
        ))}
      </span>
      <span className="whitespace-nowrap text-sm tabular text-primary">{label}</span>
    </span>
  );
}
