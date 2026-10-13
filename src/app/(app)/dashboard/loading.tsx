import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * The portal home, mid-load.
 *
 * The same shape as the member home: the college band, then the main
 * column (Needs you, the next events, the news and the newest album) and
 * the rail (the availability switches and recent activity). The band is
 * drawn as a solid band block so the page does not flash white where the
 * college's colour is about to be; the phone gets the same blocks in the
 * same order, one column.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6 lg:space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your portal home</span>

      {/* The band */}
      <div className="band-surface -mx-4 px-5 py-5 sm:mx-0 sm:rounded-xl sm:px-8 lg:py-7" aria-hidden="true">
        <div className="max-w-prose space-y-3">
          <div className="h-4 w-48 rounded bg-[color-mix(in_srgb,var(--band-fg)_22%,transparent)]" />
          <div className="h-8 w-64 rounded bg-[color-mix(in_srgb,var(--band-fg)_28%,transparent)]" />
          <div className="h-4 w-full max-w-md rounded bg-[color-mix(in_srgb,var(--band-fg)_18%,transparent)]" />
          <div className="flex gap-2 pt-2">
            <div className="h-11 w-28 rounded bg-[color-mix(in_srgb,var(--band-fg)_32%,transparent)]" />
            <div className="h-11 w-36 rounded border border-band-rule" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
        <div className="min-w-0 space-y-6 lg:space-y-8">
          {/* Needs you */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-20" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1].map((i) => (
                <Card key={i} className={i === 1 ? 'hidden p-4 sm:block' : 'p-4'}>
                  <Skeleton className="h-7 w-10" />
                  <Skeleton className="mt-3 h-4 w-44" />
                  <Skeleton className="mt-2 h-3.5 w-28" />
                  <Skeleton className="mt-4 h-4 w-16" />
                </Card>
              ))}
            </div>
          </div>

          {/* Happening at: events */}
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <Card key={i} className={i === 1 ? 'hidden p-4 sm:block' : 'p-4'}>
                  <div className="flex gap-3">
                    <Skeleton className="h-16 w-14 shrink-0 rounded" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-4/5" />
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Happening at: news and photos */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,1fr)_14rem] xl:grid-cols-[minmax(0,1fr)_17rem]">
            <div className="min-w-0 space-y-3">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="hidden aspect-video h-auto w-full rounded-lg sm:block" />
              {[0, 1].map((row) => (
                <div key={row} className="space-y-2 border-b border-line py-3">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
            <div className="hidden min-w-0 space-y-3 sm:block">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="aspect-[3/2] h-auto w-full rounded-lg" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          {/* Give back: three switches */}
          <Card>
            <CardBody className="space-y-4">
              <Skeleton className="h-5 w-36" />
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                  <Skeleton className="h-5 w-9 shrink-0 rounded-full" />
                </div>
              ))}
              <Skeleton className="h-12 w-full rounded-lg" />
            </CardBody>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardBody className="space-y-4">
              <Skeleton className="h-5 w-32" />
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center gap-3">
                  <Skeleton className="size-2 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
