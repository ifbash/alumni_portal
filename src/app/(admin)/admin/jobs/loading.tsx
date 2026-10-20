import { Card, Skeleton } from '@/components/ui';

/**
 * Jobs, mid-load: the header line, the summary and the policy disclosure,
 * the waiting postings as cards, then the decided list.
 *
 * Two queue cards, not five. The real queue is usually short, and a
 * skeleton that promises more work than exists is its own small lie.
 */
export default function AdminJobsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading jobs</span>

      <div className="min-w-0 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <Skeleton className="h-4 w-64 md:mt-3" />
        <Skeleton className="h-12 w-full rounded-lg md:w-96" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-6 w-56" />
        {/* The desk at lg+: the queue column and the selected posting. */}
        <div className="hidden items-start gap-gutter lg:grid lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
          <div className="space-y-2">
            {[0, 1].map((row) => (
              <div key={row} className="flex items-start gap-3 rounded-lg border border-line bg-surface-raised p-3">
                <Skeleton className="size-8 shrink-0 rounded" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3.5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
          <Card className="overflow-hidden">
            <div className="space-y-5 p-card">
              <div className="flex items-start gap-4">
                <Skeleton className="size-14 shrink-0 rounded" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,17rem)]">
                <div className="space-y-2">
                  {['w-full', 'w-full', 'w-11/12', 'w-full', 'w-3/5'].map((w, i) => (
                    <Skeleton key={i} className={`h-3.5 ${w}`} />
                  ))}
                </div>
                <Skeleton className="h-44 rounded-lg" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-line bg-surface-sunken px-card py-3">
              <Skeleton className="h-control w-36 rounded" />
              <Skeleton className="h-control w-44 rounded" />
            </div>
          </Card>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
          {[0, 1].map((card) => (
            <Card key={card} className="space-y-3 p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="size-14 shrink-0 rounded" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3.5 w-1/3" />
                </div>
              </div>
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-28 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-3/4" />
              <div className="space-y-2 rounded border border-line p-3">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
              <div className="flex justify-between gap-2 border-t border-line pt-3">
                <Skeleton className="h-control-sm w-16 rounded" />
                <div className="flex gap-2">
                  <Skeleton className="h-control w-24 rounded" />
                  <Skeleton className="h-control w-40 rounded" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        <Card>
          <div className="divide-y divide-line">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <Skeleton className="size-8 shrink-0 rounded" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3.5 w-2/3" />
                </div>
                <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
