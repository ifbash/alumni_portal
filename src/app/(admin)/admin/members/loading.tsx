import { Card, CardBody, Skeleton, TableWrap } from '@/components/ui';

/**
 * Loading state in the shape of the real table.
 *
 * A spinner in an empty box tells the admin nothing and makes the page
 * jump when the rows land. Seven columns of grey bars settle into seven
 * columns of text.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading member records">
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-prose" />
      </div>

      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_13rem_13rem_auto] sm:items-end">
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-control w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-control w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-control w-full" />
          </div>
          <Skeleton className="h-control w-24" />
        </CardBody>
      </Card>

      <div className="flex gap-6 border-b border-line pb-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-4 w-28" />
        ))}
      </div>

      <TableWrap caption="Loading member records">
        <div className="divide-y divide-line">
          <div className="flex items-center gap-4 bg-surface-sunken px-3 py-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="ml-auto h-3 w-20" />
          </div>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-3 py-3.5">
              <Skeleton className="h-3.5 w-24 shrink-0" />
              <Skeleton className="h-3.5 w-44 shrink-0" />
              <Skeleton className="hidden h-3.5 w-12 shrink-0 md:block" />
              <Skeleton className="hidden h-3.5 w-12 shrink-0 md:block" />
              <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
              <Skeleton className="hidden h-3.5 w-36 lg:block" />
              <Skeleton className="ml-auto hidden h-3.5 w-20 shrink-0 lg:block" />
            </div>
          ))}
        </div>
      </TableWrap>
    </div>
  );
}
