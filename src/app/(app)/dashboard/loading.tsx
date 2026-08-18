import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * The portal home, mid-load.
 *
 * Mirrors the real page top to bottom: the staff strip that appears above
 * everything for anyone with a console role, the greeting block, the four
 * tiles, and the two-thirds / one-third split underneath. The tile row is
 * drawn at four across because that is the common case; a member with
 * fewer tiles loses a little grey rather than gaining a jump.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your portal home</span>

      {/* Staff strip — the sunken bar above the greeting */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-line bg-surface-sunken px-4 py-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-4 w-36" />
        <Skeleton className="hidden h-4 w-32 sm:block" />
        <Skeleton className="ml-auto h-4 w-28" />
      </div>

      {/* Greeting */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-52" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-prose" />
        <Skeleton className="h-4 w-2/3 max-w-prose" />
      </div>

      {/* The four numbers that matter */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Waiting on you */}
          <Card>
            <CardBody className="space-y-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3.5 w-full max-w-prose" />
              <ul className="divide-y divide-line">
                {[0, 1, 2].map((row) => (
                  <li key={row} className="space-y-3 py-4 first:pt-1">
                    <div className="flex items-start gap-3">
                      <Skeleton className="size-10 shrink-0 rounded-full" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-2/5" />
                        <Skeleton className="h-3 w-3/5" />
                      </div>
                      <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
                    </div>
                    <Skeleton className="h-12 w-full rounded" />
                    <div className="flex gap-2">
                      <Skeleton className="h-control-sm w-24 rounded" />
                      <Skeleton className="h-control-sm w-24 rounded" />
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          {/* Your postings */}
          <Card>
            <CardBody className="space-y-4">
              <Skeleton className="h-5 w-44" />
              <ul className="divide-y divide-line">
                {[0, 1, 2].map((row) => (
                  <li key={row} className="flex items-center gap-3 py-3 first:pt-1">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Availability switches */}
          <Card>
            <CardBody className="space-y-4">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3.5 w-full" />
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-start justify-between gap-3 border-t border-line pt-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                  <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
                </div>
              ))}
            </CardBody>
          </Card>

          {/* Upcoming */}
          <Card>
            <CardBody className="space-y-4">
              <Skeleton className="h-5 w-32" />
              {[0, 1].map((row) => (
                <div key={row} className="space-y-2">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              ))}
              <Skeleton className="h-control w-full rounded" />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
