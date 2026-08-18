import { Card, CardBody, Skeleton, TableWrap } from '@/components/ui';

/**
 * The staff console's fallback loading state.
 *
 * Console screens are shaped alike almost without exception: a heading, a
 * row of counts, a filter bar that is a plain GET form, and then a table.
 * This draws that, so the page settles rather than jumping — an operator
 * working a queue at speed clicks where the row was a moment ago.
 *
 * The overview, the verification queue, the register, the members list and
 * the audit log each have a closer boundary shaped like themselves; this
 * one covers everything else in the console.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the console</span>

      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-full max-w-prose" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-card">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="mt-3 h-8 w-14" />
            <Skeleton className="mt-2 h-3 w-32" />
          </Card>
        ))}
      </div>

      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-control w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-control w-full" />
          </div>
          <Skeleton className="h-control w-24" />
        </CardBody>
      </Card>

      <TableWrap caption="Loading">
        <div className="divide-y divide-line">
          <div className="flex items-center gap-4 bg-surface-sunken px-3 py-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-36" />
            <Skeleton className="ml-auto h-3 w-16" />
          </div>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-3 py-3.5">
              <Skeleton className="h-3.5 w-40 shrink-0" />
              <Skeleton className="hidden h-3.5 w-24 shrink-0 md:block" />
              <Skeleton className="hidden h-3.5 w-32 shrink-0 lg:block" />
              <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
              <Skeleton className="ml-auto h-3.5 w-24 shrink-0" />
            </div>
          ))}
        </div>
      </TableWrap>
    </div>
  );
}
