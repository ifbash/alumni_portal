import { Skeleton, TableWrap } from '@/components/ui';

/**
 * The member list, mid-load, in the page's shape: header, the inline
 * search, the cohort tabs, then rows — a table from `sm`, a list of
 * people on phones.
 */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading member records">
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-control w-full max-w-md rounded" />
        <Skeleton className="h-control w-40 rounded" />
        <Skeleton className="h-control w-24 rounded" />
      </div>

      <div className="flex gap-6 border-b border-line pb-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-4 w-24" />
        ))}
      </div>

      <div className="divide-y divide-line rounded-lg border border-line bg-surface-raised px-3 sm:hidden">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-52 max-w-full" />
            </div>
          </div>
        ))}
      </div>

      <TableWrap caption="Loading member records" className="hidden sm:block">
        <div className="divide-y divide-line">
          <div className="flex items-center gap-4 bg-surface-sunken px-3 py-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="ml-auto h-3 w-24" />
          </div>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-3 py-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-44 shrink-0" />
              <Skeleton className="hidden h-3.5 w-20 shrink-0 md:block" />
              <Skeleton className="hidden h-3.5 w-64 lg:block" />
              <Skeleton className="ml-auto h-3 w-24 shrink-0" />
            </div>
          ))}
        </div>
      </TableWrap>
    </div>
  );
}
