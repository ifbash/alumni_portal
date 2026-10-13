import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * The hub's own shape, drawn empty: the compact band, the grid of
 * questions, then a row of graduates beside the requests card, so the
 * only thing that changes on arrival is the text.
 */
export default function MentorshipLoading() {
  return (
    <div className="space-y-8" aria-busy="true">
      <p role="status" className="sr-only">
        Loading mentorship.
      </p>

      <div className="band-surface -mx-4 space-y-3 px-5 py-5 sm:mx-0 sm:rounded-xl sm:px-8 lg:py-6" aria-hidden="true">
        <div className="h-3 w-24 rounded bg-[color-mix(in_srgb,var(--band-fg)_18%,transparent)]" />
        <div className="h-7 w-full max-w-sm rounded bg-[color-mix(in_srgb,var(--band-fg)_18%,transparent)]" />
        <div className="h-4 w-full max-w-md rounded bg-[color-mix(in_srgb,var(--band-fg)_12%,transparent)]" />
        <div className="h-8 w-56 rounded-full border border-band-rule" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Card key={i}>
              <CardBody className="space-y-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="size-10 shrink-0 rounded" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {[0, 1, 2].map((j) => (
                      <Skeleton key={j} className="size-8 rounded-full" />
                    ))}
                  </div>
                  <Skeleton className="h-4 w-24" />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <Skeleton className="h-6 w-44" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <Card key={i}>
                <CardBody className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Skeleton className="size-14 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-4 w-36" />
                    </div>
                  </div>
                  <Skeleton className="h-3 w-44" />
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
        <Card>
          <CardBody className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
