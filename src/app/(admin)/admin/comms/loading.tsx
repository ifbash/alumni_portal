import { Card, Skeleton } from '@/components/ui';

/**
 * Messages, mid-load: the header and its scope line, four ways to start,
 * the two channels, then the sent list.
 */
export default function AdminCommsLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading messages</span>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-80 max-w-full" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-4 w-72 max-w-full" />
            <Skeleton className="h-8 w-56 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-control w-36 shrink-0 rounded" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 rounded-lg border border-line bg-surface-raised p-4">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-2 rounded-lg border border-line bg-surface-raised p-4">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <Skeleton className="h-6 w-20" />
        <Card>
          <div className="divide-y divide-line">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-8 w-14 shrink-0" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
