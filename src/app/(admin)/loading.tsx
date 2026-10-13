import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * The staff console's fallback loading state.
 *
 * Drawn inside the console shell, so only the content column is missing:
 * a breadcrumb and page header, a row of summary cards, then the work
 * list. An operator working a queue at speed clicks where the row was a
 * moment ago, so the shape holds still while the data arrives.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-full max-w-sm" />
        <Skeleton className="h-4 w-full max-w-prose" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className={i === 2 ? 'hidden xl:block' : undefined}>
            <CardBody className="space-y-3">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-control-sm w-28 rounded" />
            </CardBody>
          </Card>
        ))}
      </div>

      <Card className="min-w-0">
        <CardBody>
          <Skeleton className="mb-3 h-5 w-40" />
          <div className="divide-y divide-line">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 py-3">
                <Skeleton className="h-3.5 w-40 shrink-0" />
                <Skeleton className="hidden h-3.5 w-28 shrink-0 md:block" />
                <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
                <Skeleton className="ml-auto hidden h-3.5 w-20 shrink-0 sm:block" />
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
