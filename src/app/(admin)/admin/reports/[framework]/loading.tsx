import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * One accreditation framework, mid-load: breadcrumbs, the header with its
 * status chip and two actions, the framework tabs, the Cards | Table
 * switch, and a section of compact figures — each a label, a value with
 * what it is out of beneath it, and one line of definition.
 */
export default function FrameworkReportLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the framework figures</span>

      <div className="space-y-3">
        <Skeleton className="h-3 w-56" />
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-4 w-96 max-w-full" />
            <Skeleton className="h-5 w-40 rounded-full" />
          </div>
          <div className="flex shrink-0 gap-2">
            <Skeleton className="h-control w-36 rounded" />
            <Skeleton className="h-control w-32 rounded" />
          </div>
        </div>
      </div>

      <div className="flex gap-6 border-b border-line pb-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-4 w-20" />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-36 rounded-lg" />
        <Skeleton className="h-4 w-40" />
      </div>

      {[0, 1].map((section) => (
        <Card key={section}>
          <CardBody className="space-y-4">
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-3.5 w-full max-w-prose" />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2.5 rounded-lg border border-line p-4">
                  <Skeleton className="h-3.5 w-44" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
