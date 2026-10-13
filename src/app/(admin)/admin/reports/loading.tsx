import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * Loading state in the shape of the accreditation overview: the header
 * with its three actions, four headline outcomes, and one card per
 * framework with its status line and three figures. Nothing jumps when
 * the figures land.
 */
export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading the accreditation figures">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-control w-40" />
          <Skeleton className="h-control w-40" />
          <Skeleton className="h-control w-28" />
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-3.5 w-36" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="p-card">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="mt-3 h-8 w-24" />
              <Skeleton className="mt-2 h-3 w-40" />
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-3.5 w-24" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i}>
              <CardBody className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-3.5 w-56" />
                </div>
                <Skeleton className="h-4 w-52" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[0, 1, 2].map((j) => (
                    <div key={j} className="space-y-2 rounded border border-line p-3">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-control-sm w-28" />
                  <Skeleton className="h-control-sm w-28" />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
