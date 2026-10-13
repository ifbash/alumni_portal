import { Card, CardBody, Skeleton, TableWrap } from '@/components/ui';

/**
 * The degree register, mid-load, in the page's shape: header, the search
 * directly under it, the batch strip, then a full page of rows — a table
 * from `sm`, cards on phones.
 */
const CHIP_WIDTHS = ['w-24', 'w-24', 'w-20', 'w-24', 'w-24', 'w-20', 'w-24', 'w-24', 'w-20', 'w-24', 'w-24', 'w-20', 'w-24'];

export default function DegreeRegisterLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the degree register</span>

      <div className="space-y-3">
        <Skeleton className="h-3 w-44" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="h-control w-48 shrink-0 rounded" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-control w-full max-w-md rounded" />
        <Skeleton className="h-control w-36 rounded" />
        <Skeleton className="h-control w-32 rounded" />
        <Skeleton className="h-control w-24 rounded" />
      </div>

      <Card>
        <CardBody className="space-y-3">
          <Skeleton className="h-4 w-60" />
          <div className="flex flex-wrap gap-2">
            {CHIP_WIDTHS.map((w, i) => (
              <Skeleton key={i} className={`h-8 rounded-full ${w}`} />
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="space-y-2 sm:hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardBody className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-44" />
              {[0, 1].map((row) => (
                <div key={row} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-28" />
                </div>
              ))}
            </CardBody>
          </Card>
        ))}
      </div>

      <TableWrap caption="Loading degree register rows" className="hidden sm:block">
        <div className="divide-y divide-line">
          <div className="flex items-center gap-4 bg-surface-sunken px-3 py-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-3 py-3">
              <Skeleton className="h-3.5 w-28 shrink-0" />
              <Skeleton className="h-3.5 w-48 shrink-0" />
              <Skeleton className="hidden h-3.5 w-20 shrink-0 md:block" />
              <Skeleton className="hidden h-3.5 w-44 lg:block" />
            </div>
          ))}
        </div>
      </TableWrap>
    </div>
  );
}
