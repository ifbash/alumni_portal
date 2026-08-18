import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * The member portal's fallback loading state.
 *
 * It sits inside the shell, so the sidebar and top bar are already drawn
 * by the time this appears — only the content column is missing. Directory,
 * events, jobs and connections each have their own; this covers the rest,
 * and draws the shape they share: a heading block, a row of tiles, then
 * content over a narrower rail.
 *
 * Never a spinner in an empty box. A spinner says "wait"; a skeleton says
 * what is about to be there, and holds the space so nothing jumps when it
 * arrives.
 */
export default function AppLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      <div className="space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-prose" />
        <Skeleton className="h-4 w-3/5 max-w-prose" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-card">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-3 h-8 w-16" />
            <Skeleton className="mt-2 h-3 w-28" />
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardBody className="space-y-4">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-3.5 w-full max-w-prose" />
              <ul className="divide-y divide-line">
                {[0, 1, 2, 3].map((row) => (
                  <li key={row} className="flex items-start gap-3 py-4 first:pt-2">
                    <Skeleton className="size-10 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/5" />
                      <Skeleton className="h-3 w-3/5" />
                    </div>
                    <Skeleton className="hidden h-control-sm w-24 rounded sm:block" />
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-4">
              <Skeleton className="h-5 w-32" />
              {[0, 1, 2].map((row) => (
                <div key={row} className="space-y-2">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-control w-full rounded" />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
