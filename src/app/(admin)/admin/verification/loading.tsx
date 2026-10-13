import { Skeleton, TableWrap } from '@/components/ui';

/**
 * The verification queue, mid-load, in the page's shape: header, status
 * tabs, the filter chips beside the search, then the queue itself. On
 * phones the list follows the filter directly, as on the page.
 */
export default function VerificationLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the verification queue</span>

      <div className="space-y-3">
        <Skeleton className="h-3 w-48" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-8 w-72 max-w-full" />
            <Skeleton className="h-4 w-80 max-w-full" />
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-control w-40 rounded" />
            <Skeleton className="h-control w-44 rounded" />
          </div>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-6 border-b border-line pb-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-4 w-20" />
        ))}
      </div>

      {/* Chips and search */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2">
          {['w-16', 'w-28', 'w-40'].map((w) => (
            <Skeleton key={w} className={`h-9 rounded-full ${w}`} />
          ))}
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-control w-64 max-w-full rounded" />
          <Skeleton className="h-control w-24 rounded" />
        </div>
      </div>

      {/* Phones: a stack of rows */}
      <div className="space-y-2 sm:hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-3 rounded-lg border border-line bg-surface-raised p-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56 max-w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>

      <TableWrap caption="Loading the verification queue" className="hidden sm:block">
        <div className="divide-y divide-line">
          <div className="flex items-center gap-4 bg-surface-sunken px-3 py-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-3 py-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="w-48 shrink-0 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-3.5 w-20 shrink-0" />
              <Skeleton className="h-3.5 w-24 shrink-0" />
              <div className="w-40 space-y-1.5">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </TableWrap>
    </div>
  );
}
