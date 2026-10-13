import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * Loading state in the shape of the real page: the header, the tab bar,
 * then request cards (avatar, name, message, actions). Nothing jumps when
 * the data lands.
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

      <div className="space-y-2">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-3 w-52" />
      </div>

      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardBody className="space-y-3">
              <div className="flex items-start gap-3">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <div className="space-y-2 border-l-2 border-line pl-3">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
              <Skeleton className="h-3 w-48" />
            </CardBody>
            <div className="flex gap-2 border-t border-line px-card py-3">
              <Skeleton className="h-control-sm w-20 rounded" />
              <Skeleton className="h-control-sm w-20 rounded" />
              <Skeleton className="h-control-sm w-16 rounded" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
