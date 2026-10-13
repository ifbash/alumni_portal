import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * The platform console's loading state.
 *
 * Drawn inside the platform shell: a page header, a row of college cards,
 * then the list. The shape holds still while the data arrives.
 */
export default function PlatformLoading() {
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
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 shrink-0 rounded" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3 w-2/5" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
            </CardBody>
          </Card>
        ))}
      </div>

      <Card className="min-w-0">
        <CardBody>
          <Skeleton className="mb-3 h-5 w-36" />
          <div className="divide-y divide-line">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 py-3">
                <Skeleton className="h-3.5 w-40 shrink-0" />
                <Skeleton className="hidden h-3.5 w-24 shrink-0 md:block" />
                <Skeleton className="ml-auto h-5 w-16 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
