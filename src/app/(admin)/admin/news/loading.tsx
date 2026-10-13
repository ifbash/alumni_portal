import { Card, Skeleton } from '@/components/ui';

/**
 * The news desk, mid-load: the header, the summary line, the filters and
 * the feed as members see it, pinned stories first.
 */
export default function AdminNewsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the news desk</span>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-control w-36 shrink-0 rounded" />
      </div>

      <Skeleton className="h-4 w-80 max-w-full" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        <Skeleton className="hidden h-9 w-36 rounded-lg sm:block" />
      </div>

      {[2, 4].map((rows, g) => (
        <div key={g} className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Card>
            <div className="divide-y divide-line">
              {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-control-sm w-32 rounded" />
                    <Skeleton className="h-control-sm w-36 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ))}
    </div>
  );
}
