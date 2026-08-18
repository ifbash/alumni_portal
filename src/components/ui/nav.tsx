import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

/**
 * Navigation and page-structure primitives.
 *
 * Tabs and pagination are links, not buttons with state. On a portal that
 * gets shared over WhatsApp, every view a user can reach needs a URL they
 * can paste — "open the directory then click the third tab" is not a
 * shareable answer to "where did you find that".
 */

// ---------------------------------------------------------------
// Page header
// ---------------------------------------------------------------

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  eyebrow,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <header className={cn('space-y-3', className)}>
      {breadcrumbs}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 space-y-1.5">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-fg">{eyebrow}</p>
          ) : null}
          <h1 className="font-display text-display-xs font-bold">{title}</h1>
          {description ? <p className="max-w-prose text-sm text-secondary">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------
// Breadcrumbs
// ---------------------------------------------------------------

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-secondary">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              {item.href && !last ? (
                <Link href={item.href} className="hover:text-brand-fg hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className={cn(last && 'font-medium text-primary')}>
                  {item.label}
                </span>
              )}
              {!last ? <span aria-hidden="true" className="text-muted">/</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------

export interface TabItem {
  label: string;
  href: string;
  /** Rendered as a count pill on the right of the label. */
  count?: number;
  active?: boolean;
}

export function Tabs({ items, className, ariaLabel = 'Sections' }: { items: TabItem[]; className?: string; ariaLabel?: string }) {
  return (
    <nav aria-label={ariaLabel} className={cn('border-b border-line', className)}>
      {/* Horizontal scroll rather than a wrapped second row: on a 360px
          phone a wrapping tab bar pushes the content below the fold. */}
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              className={cn(
                'inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium',
                'transition-colors duration-fast ease-brand',
                item.active
                  ? 'border-[var(--button-primary-bg)] text-brand-fg'
                  : 'border-transparent text-secondary hover:border-line-strong hover:text-primary',
              )}
            >
              {item.label}
              {typeof item.count === 'number' ? (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-xs tabular',
                    item.active ? 'bg-brand-soft text-brand-soft-fg' : 'bg-surface-sunken text-muted',
                  )}
                >
                  {item.count}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Segmented control for switching a view mode inside one page. */
export function SegmentedNav({ items, className }: { items: TabItem[]; className?: string }) {
  return (
    <nav className={cn('inline-flex rounded-lg border border-line bg-surface-sunken p-0.5', className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={cn(
            'rounded px-3 py-1.5 text-sm font-medium transition-colors duration-fast ease-brand',
            item.active
              ? 'bg-surface-raised text-primary shadow-sm'
              : 'text-secondary hover:text-primary',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------

/**
 * Page links carry the full query string, so a filtered result set stays
 * filtered on page two. Losing the filters on pagination is the single
 * most common way a directory search becomes unusable.
 */
export function Pagination({
  page,
  pageCount,
  total,
  buildHref,
  className,
}: {
  page: number;
  pageCount: number;
  total?: number;
  buildHref: (page: number) => string;
  className?: string;
}) {
  if (pageCount <= 1) {
    return total ? (
      <p className={cn('text-xs text-muted', className)}>
        {total.toLocaleString('en-IN')} result{total === 1 ? '' : 's'}
      </p>
    ) : null;
  }

  const window = pageRange(page, pageCount);

  return (
    <nav aria-label="Pagination" className={cn('flex flex-wrap items-center justify-between gap-4', className)}>
      {total !== undefined ? (
        <p className="text-xs text-muted">
          Page {page} of {pageCount} · {total.toLocaleString('en-IN')} result{total === 1 ? '' : 's'}
        </p>
      ) : (
        <span />
      )}

      <ul className="flex items-center gap-1">
        <li>
          <PageLink href={buildHref(page - 1)} disabled={page <= 1} label="Previous">
            ‹
          </PageLink>
        </li>
        {window.map((p, i) =>
          p === null ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-muted">
              …
            </li>
          ) : (
            <li key={p}>
              <PageLink href={buildHref(p)} current={p === page} label={`Page ${p}`}>
                {p}
              </PageLink>
            </li>
          ),
        )}
        <li>
          <PageLink href={buildHref(page + 1)} disabled={page >= pageCount} label="Next">
            ›
          </PageLink>
        </li>
      </ul>
    </nav>
  );
}

function PageLink({
  href,
  children,
  current,
  disabled,
  label,
}: {
  href: string;
  children: React.ReactNode;
  current?: boolean;
  disabled?: boolean;
  label: string;
}) {
  const classes = cn(
    'grid h-8 min-w-8 place-items-center rounded px-2 text-sm font-medium tabular',
    'transition-colors duration-fast ease-brand',
    current
      ? 'bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)]'
      : 'text-secondary hover:bg-surface-sunken hover:text-primary',
  );

  if (disabled) {
    return (
      <span aria-disabled="true" className={cn(classes, 'pointer-events-none opacity-40')} aria-label={label}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} aria-label={label} aria-current={current ? 'page' : undefined} className={classes}>
      {children}
    </Link>
  );
}

/** First, last, and a window around the current page; `null` marks a gap. */
function pageRange(page: number, count: number): Array<number | null> {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);

  const out: Array<number | null> = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(count - 1, page + 1);

  if (from > 2) out.push(null);
  for (let p = from; p <= to; p++) out.push(p);
  if (to < count - 1) out.push(null);
  out.push(count);

  return out;
}

// ---------------------------------------------------------------
// Section
// ---------------------------------------------------------------

export function Section({
  title,
  description,
  actions,
  children,
  className,
  id,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn('space-y-4', className)}>
      {title || actions ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            {title ? <h2 className="font-display text-xl font-semibold">{title}</h2> : null}
            {description ? <p className="text-sm text-secondary">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
