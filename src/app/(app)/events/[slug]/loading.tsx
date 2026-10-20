import { Card, CardBody, Skeleton } from '@/components/ui';
import { BandSkeleton } from '../../_components/BandSkeleton';

/**
 * One event, mid-load, in the shape of the real page: breadcrumb, the band
 * with its date leaf, then the about text beside the registration card.
 */
export default function EventLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the event</span>

      <Skeleton className="h-4 w-56" />
      <BandSkeleton tall />

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="lg:col-start-2 lg:row-start-1">
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-control w-full rounded" />
            <Skeleton className="h-control w-full rounded" />
          </CardBody>
        </Card>

        <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-1">
          <div className="space-y-3">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-5 w-full max-w-prose" />
            <Skeleton className="h-4 w-full max-w-prose" />
            <Skeleton className="h-4 w-4/5 max-w-prose" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
