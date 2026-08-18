import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * The events list in outline: date block, title, meta line, seat meter.
 * Same geometry as the loaded page, so the content settles into the frame
 * instead of pushing it around.
 */
export default function EventsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading events">
      <div className="space-y-2">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full max-w-prose" />
      </div>

      <div className="flex gap-6 border-b border-line pb-2.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>

      <div className="space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardBody className="flex flex-col gap-4 sm:flex-row">
              <Skeleton className="h-16 w-full rounded sm:w-20" />

              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3.5 w-full" />
              </div>

              <div className="w-full shrink-0 space-y-2 border-t border-line pt-3 sm:w-52 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-control-sm w-28 rounded" />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
