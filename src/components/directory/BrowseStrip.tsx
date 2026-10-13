import { ChipNav } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * "Browse": every branch, then every batch, in one chip row.
 *
 * The batch and branch pages are what gets forwarded to a WhatsApp group;
 * this row is how anyone finds them from the directory. One row rather
 * than two, so the results are not pushed below the fold. Both lists come
 * from the directory's own facets, so a chip never leads to a page this
 * viewer would find empty.
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
  const items = [
    ...(branches.length > 1
      ? branches.map((b) => ({ label: b.code, href: `/directory/branch/${encodeURIComponent(b.code)}` }))
      : []),
    ...(batches.length > 1 ? batches.map((y) => ({ label: String(y), href: `/directory/batch/${y}` })) : []),
  ];
  if (items.length === 0) return null;

  return (
    <div className={cn(className)}>
      <Row short="Browse" label="Browse">
        <ChipNav ariaLabel="Browse by branch or batch" items={items} />
      </Row>
    </div>
  );
}

/** The label sits beside its chips at every width: a stacked label cost a phone 40px a row. */
function Row({ short, label, children }: { short: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-2 sm:gap-3">
      <p className="pb-1 text-xs font-semibold uppercase tracking-wider text-secondary" aria-hidden="true">
        <span className="sm:hidden">{short}</span>
        <span className="hidden sm:inline">{label}</span>
      </p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
