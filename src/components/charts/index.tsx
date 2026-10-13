import * as React from 'react';
import Link from 'next/link';
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

/** A point that may link to the filtered view behind it. */
export type LinkedPoint = Point & { href?: string };

/**
 * Horizontal bars: label and value on one line, a 6px bar beneath.
 *
 * Preferred over a pie for "top companies" and "top cities": company
 * names are long, and a legend that has to be matched back to a wedge by
 * colour is the least readable arrangement of the same six numbers. The
 * bar is `--chart-bar`, 3:1 on a card in both modes; the old full-height
 * tint behind the label measured about 1.1:1 and was invisible.
 *
 * Rows with an `href` link to the filtered view behind the figure.
 */
export function BarList({
  data,
  className,
  label,
  formatValue = (n) => n.toLocaleString('en-IN'),
  max: explicitMax,
  tone = 'brand',
}: {
  data: LinkedPoint[];
  className?: string;
  label: string;
  formatValue?: (n: number) => string;
  max?: number;
  tone?: 'brand' | 'accent' | 'neutral';
}) {
  const max = explicitMax ?? Math.max(...data.map((d) => d.value), 1);
  const fill = tone === 'accent' ? 'bg-chart-highlight' : 'bg-chart-bar';

  if (data.length === 0) {
    return <p className={cn('text-sm text-secondary', className)}>No figures yet.</p>;
  }

  return (
    <ul className={cn('space-y-1', className)} aria-label={label}>
      {data.map((d) => {
        const row = (
          <>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{d.label}</span>
              <span className="shrink-0 font-semibold tabular">{formatValue(d.value)}</span>
            </span>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-chart-track" aria-hidden="true">
              <span
                className={cn('block h-full rounded-full', fill)}
                style={{ width: `${Math.max(2, Math.min(100, (d.value / max) * 100))}%` }}
              />
            </span>
          </>
        );

        return (
          <li key={d.label} className="min-w-0">
            {d.href ? (
              <Link
                href={d.href}
                className="-mx-2 flex min-h-11 flex-col justify-center rounded px-2 py-1.5 transition-colors duration-fast ease-brand hover:bg-surface-sunken"
              >
                {row}
              </Link>
            ) : (
              <div className="py-1.5">{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------
// Column chart
// ---------------------------------------------------------------

/**
 * Vertical columns, one per period or category.
 *
 * Values print above the columns whenever there are 15 or fewer — a
 * value you have to hover for is a value a phone never shows. The
 * `highlight` column(s), usually the current period or the viewer's own
 * batch, use `--chart-bar-highlight`; the page names them in text too,
 * because colour never carries meaning alone.
 *
 * Columns with an `href` link to the view behind them. When any do, the
 * chart is a group of labelled links rather than one image, so the links
 * stay reachable.
 */
export function ColumnChart({
  data,
  className,
  label,
  height = 160,
  highlight,
  showValues,
}: {
  data: LinkedPoint[];
  className?: string;
  label: string;
  height?: number;
  /** Label(s) of the column(s) to pick out. */
  highlight?: string | string[];
  /** Defaults to true for 15 columns or fewer. */
  showValues?: boolean;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const picked = new Set(highlight === undefined ? [] : Array.isArray(highlight) ? highlight : [highlight]);
  const values = showValues ?? data.length <= 15;
  const linked = data.some((d) => d.href);
  const summary = `${label}. ${data.map((d) => `${d.label}: ${d.value}`).join(', ')}`;

  return (
    <figure className={cn('space-y-2', className)}>
      <div
        className="flex items-end gap-1"
        style={{ height }}
        {...(linked ? { role: 'group', 'aria-label': label } : { role: 'img', 'aria-label': summary })}
      >
        {data.map((d) => {
          const column = (
            <>
              {values ? (
                <span className="text-xs font-semibold tabular text-secondary" aria-hidden={linked ? true : undefined}>
                  {d.value.toLocaleString('en-IN')}
                </span>
              ) : null}
              <span
                className={cn(
                  'block w-full rounded-sm transition-opacity duration-fast',
                  picked.has(d.label) ? 'bg-chart-highlight' : 'bg-chart-bar',
                  d.href && 'group-hover:opacity-80',
                )}
                // A zero-height bar and a missing bar look identical; 3px
                // keeps "we measured this and it was nought" visible.
                style={{ height: `${Math.max(3, (d.value / max) * (height - 20))}px` }}
              />
            </>
          );

          return d.href ? (
            <Link
              key={d.label}
              href={d.href}
              aria-label={`${d.label}: ${d.value}`}
              className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-sm"
            >
              {column}
            </Link>
          ) : (
            <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              {column}
            </div>
          );
        })}
      </div>
      <div className="flex gap-1" aria-hidden="true">
        {data.map((d) => (
          <span key={d.label} className="min-w-0 flex-1 truncate text-center text-[10px] text-secondary">
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
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--chart-track)" strokeWidth="10" />
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
    // The accent at chart strength: 3:1 on a card in both modes, where a
    // raw ramp stop is right in one mode only.
    accent: 'bg-chart-highlight',
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
