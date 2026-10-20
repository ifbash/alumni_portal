import Link from 'next/link';
import { cn } from '@/lib/cn';

/**
 * "Browse": every branch, then every batch, each as its own scrolling row.
 *
 * The batch and branch pages are what gets forwarded to a WhatsApp group;
 * this is how anyone finds them from the directory. Both lists come from
 * the directory's own facets, so a chip never leads to a page this viewer
 * would find empty. Years are set tabular so the batch row reads as a
 * ribbon of numbers rather than a pile of pills; the group labels stay on
 * the left at every width so a phone does not lose them.
 */
export function BrowseStrip({
  batches,
  branches,
  className,
}: {
  /** Years, newest first. */
  batches: number[];
  branches: Array<{ code: string; name: string }>;
  className?: string;
}) {
  const branchItems = branches.length > 1 ? branches.map((b) => ({ label: b.code, title: b.name, href: `/directory/branch/${encodeURIComponent(b.code)}` })) : [];
  const batchItems = batches.length > 1 ? batches.map((y) => ({ label: String(y), title: `Batch of ${y}`, href: `/directory/batch/${y}` })) : [];
  if (branchItems.length === 0 && batchItems.length === 0) return null;

  return (
    <nav
      aria-label="Browse by branch or batch"
      className={cn('space-y-1.5 rounded-lg border border-line bg-surface-sunken px-3 py-2.5', className)}
    >
      {branchItems.length ? <Row label="Branch" items={branchItems} /> : null}
      {batchItems.length ? <Row label="Batch" items={batchItems} numeric /> : null}
    </nav>
  );
}

function Row({
  label,
  items,
  numeric = false,
}: {
  label: string;
  items: Array<{ label: string; title: string; href: string }>;
  numeric?: boolean;
}) {
  return (
    <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-secondary">{label}</p>
      <ul className="scroll-fade-x flex min-w-0 gap-1.5 overflow-x-auto py-0.5">
        {items.map((item) => (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href}
              title={item.title}
              className={cn(
                'inline-flex min-h-11 items-center rounded-full border border-line bg-surface-raised px-3.5 text-sm font-medium text-secondary sm:min-h-8',
                'transition-colors duration-fast ease-brand hover:border-line-strong hover:bg-brand-soft hover:text-brand-soft-fg',
                numeric && 'tabular',
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
