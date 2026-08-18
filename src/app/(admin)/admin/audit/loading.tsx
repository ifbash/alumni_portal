import { Card, CardBody, Skeleton, TableWrap } from '@/components/ui';

/**
 * The audit log, mid-load.
 *
 * Seven columns that do not fit a laptop, so the real table scrolls inside
 * its own container at `min-w-[62rem]` rather than widening the page — the
 * skeleton does the same, because a boundary that fits and then hands over
 * to something that scrolls is a boundary that lies about the layout.
 */
export default function AuditLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the audit log</span>

      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-4 w-full max-w-prose" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-card">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="size-4 rounded-sm" />
            </div>
            <Skeleton className="mt-3 h-8 w-14" />
            <Skeleton className="mt-2 h-3 w-28" />
          </Card>
        ))}
      </div>

      {/* Narrow the log */}
      <Card>
        <CardBody className="space-y-4">
          <div className="space-y-1">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3.5 w-full max-w-prose" />
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)] sm:items-start">
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-control w-full" />
              <Skeleton className="h-3 w-3/5" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-14" />
              <Skeleton className="h-control w-full" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-6 w-28 rounded-full" />
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3.5 w-64" />
          </div>
          <Skeleton className="h-control-sm w-32 rounded" />
        </div>

        <TableWrap caption="Loading the audit log">
          <div className="min-w-[62rem] divide-y divide-line">
            <div className="flex items-center gap-4 bg-surface-sunken px-3 py-3">
              <Skeleton className="h-3 w-28 shrink-0" />
              <Skeleton className="h-3 w-32 shrink-0" />
              <Skeleton className="h-3 w-36 shrink-0" />
              <Skeleton className="h-3 w-28 shrink-0" />
              <Skeleton className="ml-auto h-3 w-20 shrink-0" />
            </div>
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 px-3 py-3.5">
                <Skeleton className="h-3.5 w-32 shrink-0" />
                <div className="w-40 shrink-0 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-36 shrink-0 rounded-full" />
                <Skeleton className="h-3.5 w-40 shrink-0" />
                <Skeleton className="h-3.5 w-44 shrink-0" />
                <Skeleton className="h-3.5 w-24 shrink-0" />
                <Skeleton className="ml-auto h-3.5 w-16 shrink-0" />
              </div>
            ))}
          </div>
        </TableWrap>
      </div>

      {/* How to read this log */}
      <Card>
        <CardBody className="space-y-4">
          <div className="space-y-1">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3.5 w-80 max-w-full" />
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
