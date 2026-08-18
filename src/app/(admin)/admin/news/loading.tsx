import { Card, CardBody, Skeleton, TableWrap } from '@/components/ui';

/**
 * The news desk, mid-load.
 *
 * Four counts, the standing note about what publishing actually sends,
 * the four list tabs, then the stories themselves — six columns above
 * `sm` and a stack of cards below it.
 *
 * The note above the tabs is reserved rather than allowed to push the
 * table down when it arrives. It carries the one rule on this screen that
 * is not configurable — an obituary is never sent as a notification — and
 * a rule that appears after the reader has started scrolling is a rule
 * they read second.
 */
export default function AdminNewsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the news desk</span>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-4 w-full max-w-prose" />
        </div>
        <Skeleton className="h-control w-36 shrink-0 rounded" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-card">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="size-4 rounded-sm" />
            </div>
            <Skeleton className="mt-3 h-8 w-12" />
            <Skeleton className="mt-2 h-3 w-36" />
          </Card>
        ))}
      </div>

      {/* What publishing does */}
      <div className="flex gap-3 rounded-lg border border-line bg-surface-sunken p-4">
        <Skeleton className="mt-0.5 size-4 shrink-0 rounded-sm" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-44" />
          <Skeleton className="h-3 w-full max-w-prose" />
          <Skeleton className="h-3 w-full max-w-prose" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      </div>

      {/* Everything · Published · Drafts · Pinned */}
      <div className="flex gap-6 border-b border-line pb-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-4 w-28" />
        ))}
      </div>

      <TableWrap caption="Loading news items with their kind, author and state" className="hidden sm:block">
        <div className="divide-y divide-line">
          <div className="flex items-center gap-4 bg-surface-sunken px-3 py-3">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="ml-auto h-3 w-14" />
          </div>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex items-start gap-4 px-3 py-3.5">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-3 w-40" />
              </div>
              <div className="w-32 shrink-0 space-y-2">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="hidden w-44 shrink-0 space-y-2 md:block">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-28" />
              </div>
              <div className="hidden w-28 shrink-0 space-y-2 lg:block">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="hidden h-3.5 w-16 shrink-0 xl:block" />
              <Skeleton className="ml-auto h-5 w-28 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      </TableWrap>

      {/* Below sm a six-column table is unreadable however it scrolls */}
      <div className="space-y-3 sm:hidden">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardBody className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-40" />
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="flex items-center justify-between gap-4">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
              <Skeleton className="h-control-sm w-40 rounded" />
            </CardBody>
          </Card>
        ))}
      </div>

      {/* The margin note on what is and is not wired in this build */}
      <div className="max-w-prose space-y-2 border-t border-line pt-4">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
