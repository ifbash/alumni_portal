import { Card, CardBody, Skeleton, TableWrap } from '@/components/ui';

/**
 * The console overview, mid-load.
 *
 * Register coverage is the headline on the real page and takes the full
 * width, so the donut and the year-by-year table are drawn at their real
 * proportions rather than as a generic pair of boxes. Everything below
 * follows the page: four tiles, the registrations column chart beside the
 * network-health panel, then the three distribution cards.
 */
const BAR_HEIGHTS = [
  'h-16', 'h-24', 'h-20', 'h-32', 'h-28', 'h-40',
  'h-24', 'h-36', 'h-20', 'h-28', 'h-44', 'h-32',
];

export default function AdminOverviewLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the console overview</span>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-4 w-full max-w-prose" />
        </div>
        <Skeleton className="h-control w-48 shrink-0 rounded" />
      </div>

      {/* Register coverage */}
      <div className="space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3.5 w-full max-w-prose" />
        </div>

        <div className="grid gap-gutter lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <Card>
            <CardBody className="space-y-5">
              <div className="flex justify-center py-2">
                <Skeleton className="size-[148px] rounded-full" />
              </div>
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-full rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
              <Skeleton className="h-control-sm w-full rounded" />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-4">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-3.5 w-full max-w-prose" />
              <TableWrap caption="Loading coverage by year of passing">
                <div className="divide-y divide-line">
                  <div className="flex items-center gap-4 bg-surface-sunken px-3 py-3">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="ml-auto h-3 w-20" />
                  </div>
                  {Array.from({ length: 8 }, (_, i) => (
                    <div key={i} className="flex items-center gap-4 px-3 py-3">
                      <Skeleton className="h-3.5 w-12 shrink-0" />
                      <Skeleton className="h-3.5 w-10 shrink-0" />
                      <Skeleton className="h-3.5 w-10 shrink-0" />
                      <div className="ml-auto flex items-center gap-2.5">
                        <Skeleton className="h-2 w-20 rounded-full" />
                        <Skeleton className="h-3 w-8" />
                      </div>
                    </div>
                  ))}
                </div>
              </TableWrap>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Waiting on someone */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="p-card">
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="size-4 rounded-sm" />
              </div>
              <Skeleton className="mt-3 h-8 w-16" />
              <Skeleton className="mt-2 h-3 w-36" />
            </Card>
          ))}
        </div>
      </div>

      {/* Signups + network health */}
      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardBody className="space-y-4">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-3.5 w-full max-w-prose" />
            {/* Twelve columns at uneven heights: a row of equal bars reads
                as a rendered chart rather than as one still loading. */}
            <div className="flex h-[180px] items-end gap-2">
              {BAR_HEIGHTS.map((h, i) => (
                <Skeleton key={i} className={`w-full rounded-sm ${h}`} />
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-5">
            <Skeleton className="h-5 w-40" />
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-6 w-14" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-full" />
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
            <Skeleton className="h-3 w-4/5" />
          </CardBody>
        </Card>
      </div>

      {/* Distribution */}
      <div className="space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-3.5 w-full max-w-prose" />
        </div>
        <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardBody className="space-y-4">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3.5 w-full" />
                {[0, 1, 2, 3, 4].map((row) => (
                  <div key={row} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-8" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                ))}
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
