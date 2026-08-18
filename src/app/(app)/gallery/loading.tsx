import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * The album grid in outline: filter bar, then cards with a 3:2 cover
 * block, a title, two lines of description and a credit row.
 *
 * The same geometry as the loaded page, so the albums settle into the
 * frame instead of pushing it around. A spinner in an empty box says
 * nothing about what is coming and makes the arrival feel like a page
 * change.
 */
export default function GalleryLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the photographs</span>

      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-full max-w-prose" />
        <Skeleton className="h-4 w-2/3 max-w-prose" />
      </div>

      <Card>
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-control w-full rounded" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-control w-full rounded" />
            </div>
            <Skeleton className="h-control w-20 rounded" />
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-3 w-48" />
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i}>
            <Card className="flex h-full flex-col overflow-hidden">
              <Skeleton className="aspect-[3/2] w-full rounded-none" />
              <CardBody className="flex flex-1 flex-col gap-2.5">
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-2/3" />

                <div className="flex gap-4 pt-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>

                <div className="mt-auto flex items-center gap-2.5 border-t border-line pt-3">
                  <Skeleton className="size-6 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
