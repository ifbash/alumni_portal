import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * The hub's own shape, drawn empty.
 *
 * A spinner in a blank box tells the reader nothing about what is coming
 * and guarantees the page jumps when it lands. This is the real layout —
 * header, the viewer panel, the topic grid, the counts — so the only thing
 * that changes on arrival is the text.
 */
export default function MentorshipLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading mentorship">
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-prose" />
      </div>

      {/* Viewer panel: a list on the left, a meter or a set of switches on
          the right, whichever cohort is looking. */}
      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-4 w-full max-w-prose" />
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i}>
                <CardBody className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Skeleton className="size-14 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </div>
                  <Skeleton className="h-3 w-44" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </CardBody>
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-2.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-48" />
            </CardBody>
          </Card>
          <Card>
            <CardBody className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="space-y-4">
        <Skeleton className="h-5 w-52" />
        <Skeleton className="h-4 w-full max-w-prose" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardBody className="space-y-3">
                <div className="flex items-start gap-3">
                  <Skeleton className="size-9 shrink-0 rounded" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
                <Skeleton className="h-3 w-28" />
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardBody className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-36" />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
