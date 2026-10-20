import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * Loading state in the shape of the real page: the header, the tab bar,
 * then request cards (avatar, name, message, actions) beside the rail.
 * Nothing jumps when the data lands.
 */
export default function ConnectionsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading requests">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>

      <div className="flex gap-6 border-b border-line pb-2.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
      </div>

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-3 w-52" />
          </div>

          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <Card key={i}>
                <CardBody className="space-y-4">
                  <div className="flex items-start gap-4">
                    <Skeleton className="size-14 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-5 w-44" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <div className="space-y-2 rounded-lg bg-surface-sunken p-4">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-5/6" />
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </CardBody>
                <div className="flex gap-2 rounded-b-lg border-t border-line bg-surface-sunken px-card py-3.5">
                  <Skeleton className="h-control w-28 rounded" />
                  <Skeleton className="h-control w-28 rounded" />
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Card className="hidden space-y-5 p-card lg:block">
          <Skeleton className="h-3 w-36" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-[1.375rem] shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
