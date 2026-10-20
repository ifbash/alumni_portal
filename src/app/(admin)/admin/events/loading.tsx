import { Card, Skeleton } from '@/components/ui';

/**
 * Events, mid-load: the header, the "Up next" card, the strip of events
 * that need attention, then the rows under their tabs.
 */
export default function AdminEventsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading events</span>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-control w-32 shrink-0 rounded" />
      </div>

      <Skeleton className="h-4 w-96 max-w-full" />

      <Card className="flex items-start gap-4 p-card">
        <Skeleton className="h-20 w-16 shrink-0 rounded" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-72 max-w-full" />
          <Skeleton className="h-4 w-64 max-w-full" />
          <Skeleton className="h-4 w-48" />
          <div className="flex flex-wrap gap-2 pt-1">
            <Skeleton className="h-control w-40 rounded" />
            <Skeleton className="h-control w-32 rounded" />
            <Skeleton className="h-control w-40 rounded" />
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-line bg-surface-raised p-3">
              <Skeleton className="h-16 w-12 shrink-0 rounded" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-5 w-32 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex gap-6 border-b border-line pb-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-4 w-24" />
          ))}
        </div>
        <Card>
          <div className="divide-y divide-line px-4">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-start gap-3 py-3">
                <Skeleton className="h-[4.5rem] w-14 shrink-0 rounded" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3.5 w-1/2" />
                  <div className="flex gap-1.5">
                    <Skeleton className="h-5 w-12 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                </div>
                <Skeleton className="size-9 shrink-0 self-center rounded" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
