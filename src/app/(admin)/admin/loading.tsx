import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * Today, mid-load, in the page's own shape: the compact band, the queue,
 * the reach strip, registrations beside network health, then the three
 * "where the network is" lists. One column on phones, like the page.
 */
const CHIP_WIDTHS = ['w-24', 'w-24', 'w-20', 'w-24', 'w-24', 'w-20', 'w-24', 'w-24', 'w-20', 'w-24', 'w-24', 'w-20', 'w-24'];

export default function AdminOverviewLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading today’s console</span>

      {/* Compact band */}
      <div className="band-surface -mx-4 space-y-3 px-5 py-5 sm:mx-0 sm:rounded-xl sm:px-8 lg:py-6">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* Your queue */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1].map((i) => (
            <Card key={i} className="min-w-0 space-y-2 p-4">
              <Skeleton className="h-8 w-12" />
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="mt-2 h-4 w-20" />
            </Card>
          ))}
        </div>
      </div>

      {/* Up next */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <Card className="flex items-center gap-4 p-4">
          <Skeleton className="h-[4.5rem] w-14 shrink-0 rounded" />
          <Skeleton className="h-6 w-2/3 max-w-md" />
        </Card>
      </div>

      {/* Reach */}
      <Card>
        <CardBody className="space-y-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-6 w-full max-w-md" />
          <div className="flex flex-wrap gap-2">
            {CHIP_WIDTHS.map((w, i) => (
              <Skeleton key={i} className={`h-8 rounded-full ${w}`} />
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Registrations + network health */}
      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardBody className="space-y-3">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-3.5 w-3/4" />
          </CardBody>
        </Card>
        <Card className="min-w-0">
          <CardBody className="space-y-4">
            <Skeleton className="h-5 w-36" />
            <div className="grid grid-cols-2 gap-4">
              {[0, 1].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Where the network is */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-52" />
        <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="min-w-0">
              <CardBody className="space-y-4">
                <Skeleton className="h-5 w-32" />
                {[0, 1, 2, 3, 4].map((row) => (
                  <div key={row} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-8" />
                    </div>
                    <Skeleton className="h-1.5 w-full rounded-full" />
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
