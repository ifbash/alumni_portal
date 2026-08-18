import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Charts.
 *
 * Hand-drawn SVG rather than a charting library, for three reasons that
 * all matter for a product sold to many customers:
 *
 *  1. **They inherit the tenant's palette.** A library needs colours
 *     passed in as hex, which means reading CSS custom properties from
 *     JavaScript at runtime and getting it wrong in dark mode. These read
 *     `var(--brand-600)` like everything else does.
 *  2. **They render on the server.** No client bundle, no hydration, no
 *     empty box while a chart library loads on a slow connection.
 *  3. **The charts here are simple.** Four shapes cover every dashboard
 *     in the app. Pulling in 90KB to draw a bar list is not a trade worth
 *     making.
 *
 * Every chart is `role="img"` with a real label, and every one has a
 * table or list equivalent nearby. A dashboard readable only by people
 * who can see it is not a dashboard.
 */

export interface Point {
  label: string;
  value: number;
}

// ---------------------------------------------------------------
// Sparkline
// ---------------------------------------------------------------

export function Sparkline({
  data,
  className,
  label,
  height = 40,
}: {
  data: Point[];
  className?: string;
  label: string;
  height?: number;
}) {
  if (data.length < 2) return null;

  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 100;
  const h = height;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    // 2px of headroom top and bottom so the stroke is never clipped.
    const y = h - 2 - (d.value / max) * (h - 4);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${label}. ${data.map((d) => `${d.label}: ${d.value}`).join(', ')}`}
      className={cn('w-full', className)}
      style={{ height }}
    >
      <polyline
        points={`0,${h} ${points.join(' ')} ${w},${h}`}
        fill="var(--brand-soft)"
        stroke="none"
      />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="var(--brand-fg)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ---------------------------------------------------------------
// Bar list
// ---------------------------------------------------------------

/**
 * Horizontal bars with the label inside.
 *
 * Preferred over a pie for "top companies" and "top cities": company
 * names are long, and a legend that has to be matched back to a wedge by
 * colour is the least readable arrangement of the same six numbers.
 */
export function BarList({
  data,
  className,
  label,
  formatValue = (n) => n.toLocaleString('en-IN'),
  max: explicitMax,
  tone = 'brand',
}: {
  data: Point[];
  className?: string;
  label: string;
  formatValue?: (n: number) => string;
  max?: number;
  tone?: 'brand' | 'accent' | 'neutral';
}) {
  const max = explicitMax ?? Math.max(...data.map((d) => d.value), 1);

  const fill = {
    brand: 'bg-brand-soft',
    accent: 'bg-accent-soft',
    neutral: 'bg-surface-sunken',
  }[tone];

  if (data.length === 0) {
    return <p className={cn('text-sm text-muted', className)}>No data yet.</p>;
  }

  return (
    <ul className={cn('space-y-1.5', className)} aria-label={label}>
      {data.map((d) => (
        <li key={d.label} className="relative flex items-center justify-between gap-3 overflow-hidden rounded px-2.5 py-1.5">
          <span
            className={cn('absolute inset-y-0 left-0 rounded', fill)}
            style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }}
            aria-hidden="true"
          />
          <span className="relative min-w-0 truncate text-sm">{d.label}</span>
          <span className="relative shrink-0 text-sm font-semibold tabular">{formatValue(d.value)}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------
// Column chart
// ---------------------------------------------------------------

export function ColumnChart({
  data,
  className,
  label,
  height = 160,
  highlight,
}: {
  data: Point[];
  className?: string;
  label: string;
  height?: number;
  /** Label of a bar to pick out — usually the current period. */
  highlight?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <figure className={cn('space-y-2', className)}>
      <div
        className="flex items-end gap-1"
        style={{ height }}
        role="img"
        aria-label={`${label}. ${data.map((d) => `${d.label}: ${d.value}`).join(', ')}`}
      >
        {data.map((d) => (
          <div key={d.label} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] font-semibold tabular text-muted opacity-0 transition-opacity group-hover:opacity-100">
              {d.value}
            </span>
            <div
              className={cn(
                'w-full rounded-sm transition-colors duration-fast',
                d.label === highlight
                  ? 'bg-[var(--button-primary-bg)]'
                  : // Base and hover both derive from the same semantic
                    // token. Hovering to a raw ramp stop looked right in
                    // light mode and jumped from a dark subtle tint to a
                    // bright band in dark mode, because `--brand-soft`
                    // flips between modes and `brand-300` does not.
                    'bg-brand-soft group-hover:bg-[color-mix(in_srgb,var(--brand-soft)_55%,var(--button-primary-bg))]',
              )}
              // A zero-height bar and a missing bar look identical; 3px
              // keeps "we measured this and it was nought" visible.
              style={{ height: `${Math.max(3, (d.value / max) * (height - 20))}px` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1" aria-hidden="true">
        {data.map((d) => (
          <span key={d.label} className="min-w-0 flex-1 truncate text-center text-[10px] text-muted">
            {d.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

// ---------------------------------------------------------------
// Donut
// ---------------------------------------------------------------

/**
 * Single-value ring — coverage, completion, a quota.
 *
 * Deliberately not a multi-series pie. Comparing wedge areas is the thing
 * humans are worst at, and every place this app wants a proportion, it
 * wants one proportion.
 */
export function DonutChart({
  value,
  max = 100,
  label,
  caption,
  size = 120,
  tone = 'brand',
  className,
}: {
  value: number;
  max?: number;
  label: string;
  caption?: string;
  size?: number;
  tone?: 'brand' | 'success' | 'warning' | 'danger';
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, value / (max || 1)));
  const r = 42;
  const circumference = 2 * Math.PI * r;

  const stroke = {
    brand: 'var(--button-primary-bg)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
  }[tone];

  return (
    <figure className={cn('flex flex-col items-center gap-2', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={`${label}: ${Math.round(pct * 100)}%`}>
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth="10" />
          <circle
            cx="50" cy="50" r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-display text-xl font-bold tabular">{Math.round(pct * 100)}%</span>
        </div>
      </div>
      {caption ? <figcaption className="text-center text-xs text-secondary">{caption}</figcaption> : null}
    </figure>
  );
}

// ---------------------------------------------------------------
// Stacked proportion bar
// ---------------------------------------------------------------

/**
 * One bar split into labelled segments — domestic vs foreign
 * contributions, claimed vs unclaimed register rows. Values are always
 * printed beside the bar, never carried by colour alone.
 */
export function ProportionBar({
  segments,
  className,
  label,
}: {
  segments: Array<{ label: string; value: number; tone: 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'neutral' }>;
  className?: string;
  label: string;
}) {
  const total = segments.reduce((n, s) => n + s.value, 0) || 1;

  const bg = {
    brand: 'bg-[var(--button-primary-bg)]',
    accent: 'bg-accent-600',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    neutral: 'bg-line-strong',
  };

  return (
    <div className={cn('space-y-2.5', className)}>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-surface-sunken"
        role="img"
        aria-label={`${label}. ${segments.map((s) => `${s.label}: ${s.value}`).join(', ')}`}
      >
        {segments.map((s) =>
          s.value > 0 ? (
            <span key={s.label} className={bg[s.tone]} style={{ width: `${(s.value / total) * 100}%` }} />
          ) : null,
        )}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5 text-xs">
            <span className={cn('size-2 shrink-0 rounded-full', bg[s.tone])} aria-hidden="true" />
            <span className="text-secondary">{s.label}</span>
            <span className="font-semibold tabular">{s.value.toLocaleString('en-IN')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
