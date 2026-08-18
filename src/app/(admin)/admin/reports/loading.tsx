import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * Loading state in the shape of the console.
 *
 * A spinner in an empty box tells a registrar nothing and makes the page
 * jump when the figures land. Four stat cards, a tab strip and two
 * sections of metric tiles settle into exactly that.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading the accreditation figures">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-full max-w-prose" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-control w-40" />
          <Skeleton className="h-control w-48" />
        </div>
      </div>

      <Card>
        <CardBody className="grid gap-5 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-5 shrink-0 rounded-full" />
              <div className="w-full space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="grid gap-gutter sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-card">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="mt-3 h-8 w-20" />
            <Skeleton className="mt-2 h-3 w-40" />
          </Card>
        ))}
      </div>

      <div className="flex gap-6 border-b border-line pb-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-4 w-24" />
        ))}
      </div>

      {[0, 1].map((section) => (
        <div key={section} className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-3.5 w-full max-w-prose" />
          </div>

          <Card>
            <CardBody className="space-y-4">
              <Skeleton className="h-5 w-32 rounded-full" />
              <Skeleton className="h-5 w-56" />

              <div className="grid gap-3 lg:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="space-y-3 rounded-lg border border-line p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Skeleton className="h-4 w-44" />
                      <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
                    </div>
                    <Skeleton className="h-8 w-28" />
                    <div className="grid gap-2 sm:grid-cols-2">
                      {/* The denominator and the definition, which are the
                          reason this screen exists — reserved even while
                          they are still loading. */}
                      <div className="space-y-2 rounded border border-line p-3">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-3/4" />
                      </div>
                      <div className="space-y-2 rounded border border-line p-3">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      ))}
    </div>
  );
}
