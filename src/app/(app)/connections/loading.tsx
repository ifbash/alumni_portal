import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * Loading state in the shape of the real page — quota meter, tab bar, then
 * request cards. A spinner in an empty box tells the user nothing about
 * what is arriving; this tells them the layout before the data lands, so
 * nothing jumps when it does.
 */
export default function ConnectionsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading connections">
      <div className="space-y-2">
        <Skeleton className="h-3 w-56" />
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-full max-w-prose" />
      </div>

      <Card>
        <CardBody className="grid gap-gutter md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="flex gap-6 border-b border-line pb-2.5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
      </div>

      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardBody className="space-y-4">
              <div className="flex items-start gap-3">
                <Skeleton className="size-14 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <Skeleton className="h-16 w-full rounded" />
              <Skeleton className="h-3 w-52" />
            </CardBody>
            <div className="flex gap-2 border-t border-line px-card py-3">
              <Skeleton className="h-control-sm w-24 rounded" />
              <Skeleton className="h-control-sm w-24 rounded" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
