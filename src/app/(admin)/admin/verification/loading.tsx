import { Card, CardBody, Skeleton, TableWrap } from '@/components/ui';

/**
 * The verification queue, mid-load.
 *
 * This is the screen the alumni cell works fastest on, so the geometry
 * matters more here than anywhere: four counts, the search-and-branch
 * filter, the status tabs, then the queue itself. The evidence column is
 * drawn wide because that is what it is — the candidate register rows the
 * matcher attached, not a single value.
 */
export default function VerificationLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the verification queue</span>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-full max-w-prose" />
        </div>
        <Skeleton className="h-control w-40 shrink-0 rounded" />
      </div>

      <div className="grid gap-gutter sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-card">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="size-4 rounded-sm" />
            </div>
            <Skeleton className="mt-3 h-8 w-12" />
            <Skeleton className="mt-2 h-3 w-32" />
          </Card>
        ))}
      </div>

      <Card className="p-card">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-control w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-14" />
            <Skeleton className="h-control w-full" />
          </div>
          <Skeleton className="h-control w-24" />
        </div>
      </Card>

      {/* Status tabs */}
      <div className="flex gap-6 border-b border-line pb-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-4 w-32" />
        ))}
      </div>

      {/* Below sm the queue is a stack of cards, not a five-column table */}
      <div className="space-y-3 sm:hidden">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardBody className="space-y-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
              <Skeleton className="h-control-sm w-32 rounded" />
            </CardBody>
          </Card>
        ))}
      </div>

      <TableWrap caption="Loading the verification queue" className="hidden sm:block">
        <div className="divide-y divide-line">
          <div className="flex items-center gap-4 bg-surface-sunken px-3 py-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="ml-auto h-3 w-16" />
          </div>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-start gap-4 px-3 py-3.5">
              <div className="w-48 shrink-0 space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-28" />
              </div>
              <div className="hidden w-36 shrink-0 space-y-2 md:block">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="hidden h-3.5 w-24 shrink-0 lg:block" />
              <div className="hidden min-w-0 flex-1 space-y-2 lg:block">
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-2 w-24 rounded-full" />
              </div>
              <Skeleton className="ml-auto h-5 w-24 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      </TableWrap>

      {/* How a claim reaches this queue */}
      <Card>
        <CardBody className="space-y-4">
          <div className="space-y-1">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-3.5 w-full max-w-prose" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
