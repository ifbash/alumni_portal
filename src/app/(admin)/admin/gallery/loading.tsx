import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * The gallery console, mid-load. The review queue sits above the album
 * grid on the real page, because a contribution that waits three weeks is
 * a contributor who never sends a second batch; the skeleton keeps that
 * order.
 */
export default function AdminGalleryLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the gallery</span>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-control w-32 shrink-0 rounded" />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-80 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Card>
          <CardBody className="grid gap-5 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
            <div className="space-y-2">
              <Skeleton className="aspect-[3/2] h-auto w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3.5 w-1/2" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3.5 w-full" />
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="aspect-square h-auto w-full rounded" />
                ))}
              </div>
              <div className="flex justify-end gap-2 border-t border-line pt-4">
                <Skeleton className="h-control w-32 rounded" />
                <Skeleton className="h-control w-36 rounded" />
                <Skeleton className="h-control w-24 rounded" />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex gap-6 border-b border-line pb-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-4 w-28" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[3/2] h-auto w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3.5 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
