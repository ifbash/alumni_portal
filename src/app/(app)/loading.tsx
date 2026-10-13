import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * The member portal's fallback loading state.
 *
 * It sits inside the shell, so the sidebar and top bar are already drawn
 * by the time this appears; only the content column is missing. It draws
 * the shape every member page shares: a page header, then two rows of
 * cards. Pages with a closer shape have their own boundary.
 *
 * Never a spinner in an empty box. A skeleton says what is about to be
 * there, and holds the space so nothing jumps when it arrives.
 */
export default function AppLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      <div className="space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-full max-w-sm" />
        <Skeleton className="h-4 w-full max-w-prose" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className={i === 2 ? 'hidden xl:block' : undefined}>
            <CardBody className="space-y-3">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardBody className="space-y-4">
            <Skeleton className="h-5 w-44" />
            <ul className="divide-y divide-line">
              {[0, 1, 2, 3].map((row) => (
                <li key={row} className="flex items-center gap-3 py-3 first:pt-0">
                  <Skeleton className="size-10 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-3 w-3/5" />
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card className="min-w-0">
          <CardBody className="space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-control w-full rounded" />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
