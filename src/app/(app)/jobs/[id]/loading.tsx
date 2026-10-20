import { Card, CardBody, Skeleton } from '@/components/ui';

/** A posting's own shape: breadcrumb, header card with its fact strip, then the brief beside the rail. */
export default function JobLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <p role="status" className="sr-only">
        Loading the posting.
      </p>

      <Skeleton className="h-4 w-48" />

      <div className="overflow-hidden rounded-xl border border-line bg-surface-raised shadow-md">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:gap-6 sm:p-7">
          <Skeleton className="size-16 shrink-0 rounded-xl sm:size-20" />
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-full max-w-lg" />
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        </div>
        <div className="divide-y divide-line border-t border-line sm:flex sm:divide-x sm:divide-y-0">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-baseline justify-between gap-4 px-5 py-3 sm:block sm:flex-1 sm:px-6 sm:py-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-24 sm:mt-2" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-1">
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full max-w-prose" />
            <Skeleton className="h-4 w-full max-w-prose" />
            <Skeleton className="h-4 w-2/3 max-w-prose" />
          </div>
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-9 w-20 rounded-full" />
            ))}
          </div>
        </div>
        <Card className="hidden lg:col-start-2 lg:row-start-1 lg:block">
          <CardBody className="space-y-4">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-control-lg w-full rounded" />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
