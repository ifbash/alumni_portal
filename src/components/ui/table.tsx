import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Table primitives.
 *
 * Tables are wrapped in their own horizontal scroll container rather than
 * being allowed to widen the page. An admin reviewing a verification queue
 * on a phone should scroll the table, not the whole document — a body that
 * scrolls sideways makes every other control on the page hard to hit.
 */

export function TableWrap({
  children,
  className,
  caption,
}: {
  children: React.ReactNode;
  className?: string;
  /** Announced to screen readers; visually hidden unless `visibleCaption`. */
  caption?: string;
}) {
  return (
    <div
      className={cn('overflow-x-auto rounded-lg border border-line bg-surface-raised', className)}
      // Keyboard users need to be able to scroll the region, which requires
      // it to be focusable when it actually overflows.
      tabIndex={0}
      role="region"
      aria-label={caption}
    >
      {children}
    </div>
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full border-collapse text-sm', className)} {...props} />;
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('border-b border-line bg-surface-sunken', className)} {...props} />;
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-line', className)} {...props} />;
}

export function TR({
  className,
  interactive,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(
        interactive && 'transition-colors duration-fast ease-brand hover:bg-surface-sunken',
        className,
      )}
      {...props}
    />
  );
}

export function TH({
  className,
  align = 'left',
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-secondary',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
      {...props}
    />
  );
}

export function TD({
  className,
  align = 'left',
  numeric,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center'; numeric?: boolean }) {
  return (
    <td
      className={cn(
        'px-3 py-3 align-middle',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        // Tabular figures so a column of amounts or counts lines up on the
        // decimal instead of jittering row to row.
        numeric && 'tabular text-right',
        className,
      )}
      {...props}
    />
  );
}

export function TableEmpty({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-12 text-center text-sm text-secondary">
        {children}
      </td>
    </tr>
  );
}

/**
 * Mobile alternative to a table.
 *
 * Below `sm`, a six-column admin table is unreadable no matter how it
 * scrolls. Pages render `<TableWrap>` inside `hidden sm:block` and a
 * `DefinitionCard` list inside `sm:hidden`.
 */
export function DefinitionCard({
  title,
  subtitle,
  rows,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  rows: Array<{ label: string; value: React.ReactNode }>;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-3 rounded-lg border border-line bg-surface-raised p-4', className)}>
      <div className="space-y-0.5">
        <p className="font-semibold">{title}</p>
        {subtitle ? <p className="text-xs text-secondary">{subtitle}</p> : null}
      </div>
      <dl className="space-y-1.5 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-4">
            <dt className="text-secondary">{r.label}</dt>
            <dd className="min-w-0 text-right font-medium">{r.value}</dd>
          </div>
        ))}
      </dl>
      {actions ? <div className="flex flex-wrap gap-2 pt-1">{actions}</div> : null}
    </div>
  );
}
