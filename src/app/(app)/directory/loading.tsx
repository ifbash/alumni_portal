import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * Directory loading state.
 *
 * The same geometry as the real page — sidebar plus a three-column card
 * grid, avatar circle where the avatar goes — so the layout does not jump
 * when results arrive. A spinner in an empty box tells the user nothing
 * about what is coming and makes the arrival feel like a page change.
 */
export default function DirectoryLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the directory</span>

      <div className="space-y-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-prose" />
        <Skeleton className="h-4 w-2/3 max-w-prose" />
      </div>

      <Skeleton className="h-control-lg w-full rounded" />

      <div className="grid gap-gutter lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <Card>
            <CardBody className="space-y-5">
              <Skeleton className="h-5 w-20" />
              {[0, 1, 2].map((group) => (
                <div key={group} className="space-y-2 border-t border-line pt-5">
                  <Skeleton className="h-3 w-24" />
                  {[0, 1, 2, 3].map((row) => (
                    <div key={row} className="flex items-center justify-between gap-3">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-6" />
                    </div>
                  ))}
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-9 w-64 rounded-lg" />
          </div>

          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }, (_, i) => (
              <li key={i}>
                <Card className="flex h-full flex-col p-card">
                  <div className="flex items-start gap-3">
                    <Skeleton className="size-14 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <Skeleton className="h-3 w-5/6" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>

                  <div className="mt-4 flex gap-1.5">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-12 rounded-full" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
