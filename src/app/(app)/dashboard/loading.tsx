import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * The portal home, mid-load.
 *
 * The same shape as the member home: the college band, then the main
 * column (the lead event tile with its list, the news and the newest
 * album) and the side column (people, the invitation and the activity
 * timeline). The band is drawn as a solid band block so the page does not
 * flash white where the college's colour is about to be; the phone gets
 * the same blocks in the same order, one column.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6 lg:space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your portal home</span>

      {/* The band */}
      <div className="band-surface -mx-4 px-5 py-5 sm:mx-0 sm:rounded-xl sm:px-8 lg:py-7" aria-hidden="true">
        <div className="max-w-prose space-y-3">
          <div className="h-3 w-48 rounded-full bg-[color-mix(in_srgb,var(--band-fg)_22%,transparent)]" />
          <div className="h-9 w-72 rounded bg-[color-mix(in_srgb,var(--band-fg)_28%,transparent)]" />
          <div className="h-4 w-full max-w-md rounded bg-[color-mix(in_srgb,var(--band-fg)_18%,transparent)]" />
          <div className="flex gap-2 pt-2">
            <div className="h-11 w-28 rounded bg-[color-mix(in_srgb,var(--band-fg)_32%,transparent)]" />
            <div className="h-11 w-36 rounded border border-band-rule" />
          </div>
        </div>
      </div>

      {/* Needs you: one slim row */}
      <Card className="flex items-center gap-3 px-4 py-3" flat>
        <Skeleton className="size-9 shrink-0 rounded-full" />
        <Skeleton className="h-4 w-2/3 max-w-sm" />
        <Skeleton className="ml-auto h-4 w-14" />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6 lg:space-y-8">
          {/* Happening at: the lead event tile and the list beside it */}
          <div className="space-y-4">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-3 w-20" />
            <div className="grid gap-4 min-[1360px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              <Card className="space-y-4 p-5">
                <div className="flex gap-4">
                  <Skeleton className="h-20 w-16 shrink-0 rounded" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-5 w-4/5" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex justify-end pt-2">
                  <Skeleton className="h-11 w-28 rounded-lg" />
                </div>
              </Card>
              <Card className="space-y-4 p-5">
                <Skeleton className="h-4 w-28" />
                {[0, 1].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-14 w-12 shrink-0 rounded" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-4/5" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          </div>

          {/* News and photos */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,1fr)_14rem] xl:grid-cols-[minmax(0,1fr)_17rem]">
            <div className="min-w-0 space-y-3">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="hidden aspect-video h-auto w-full rounded-lg sm:block" />
              {[0, 1].map((row) => (
                <div key={row} className="space-y-2 border-b border-line py-3">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
            <div className="hidden min-w-0 space-y-3 sm:block">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="aspect-[3/2] h-auto w-full rounded-lg" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          {/* People */}
          <Card>
            <CardBody className="space-y-4">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-16 w-full rounded-lg" />
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center gap-3">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          {/* The invitation */}
          <div className="space-y-3 rounded-xl bg-brand-soft p-card">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-9 w-40 rounded" />
          </div>

          {/* Recent activity */}
          <Card>
            <CardBody className="space-y-4">
              <Skeleton className="h-5 w-32" />
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center gap-3">
                  <Skeleton className="size-3.5 shrink-0 rounded-full" />
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
