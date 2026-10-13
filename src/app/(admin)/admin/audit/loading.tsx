import { Skeleton } from '@/components/ui';

/**
 * The audit log, mid-load, in its real shape: the header, the three
 * linked counts, the toolbar and quick filters, then one bordered list of
 * one-line entries under day headings.
 */
export default function AuditLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the audit log</span>

      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <Skeleton className="h-4 w-96 max-w-full" />

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-control min-w-0 flex-1 basis-60 rounded" />
          <Skeleton className="h-control w-56 rounded" />
          <Skeleton className="h-control w-20 rounded" />
        </div>
        <div className="flex gap-2">
          {['w-24', 'w-20', 'w-28', 'w-20', 'w-24'].map((w, i) => (
            <Skeleton key={i} className={`h-9 rounded-full ${w}`} />
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-surface-raised">
        {[5, 4, 6].map((rows, g) => (
          <div key={g}>
            <div className="border-b border-line bg-surface-sunken px-4 py-1.5">
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="divide-y divide-line border-b border-line">
              {Array.from({ length: rows }, (_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 gap-2 px-4 py-2.5 md:grid-cols-[6rem_minmax(0,17rem)_minmax(0,17rem)_minmax(0,8rem)_minmax(0,1fr)] md:items-center md:gap-4"
                >
                  <Skeleton className="h-3.5 w-16" />
                  <Skeleton className="h-3.5 w-44" />
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="hidden h-3.5 w-20 md:block" />
                  <Skeleton className="h-3.5 w-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
