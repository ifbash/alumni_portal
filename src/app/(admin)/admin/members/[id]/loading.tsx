import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * One member record, mid-load, in the page's shape: the header card
 * (photo, name, the one line about them, badges, actions), then work,
 * verification and identity in the main column, and roles and contact in
 * the 20rem aside. Both columns are reserved from the first frame so
 * nothing moves under the reader's cursor when the data lands.
 */
function RowPair({ wide = 'w-40' }: { wide?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,10rem)_1fr] gap-4 py-2.5">
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className={`h-3.5 ${wide}`} />
    </div>
  );
}

export default function MemberRecordLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the member record</span>

      <Skeleton className="h-3 w-56" />

      <Card>
        <CardBody className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Skeleton className="size-24 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-8 w-64 max-w-full" />
            <Skeleton className="h-4 w-full max-w-lg" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-28 rounded-full" />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Skeleton className="h-control w-32 rounded" />
              <Skeleton className="h-control w-24 rounded" />
              <Skeleton className="h-control w-48 rounded" />
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="min-w-0 space-y-6">
          {/* Work and education */}
          <Card>
            <CardBody className="space-y-4">
              <Skeleton className="h-5 w-44" />
              <div className="divide-y divide-line">
                {[0, 1, 2, 3].map((i) => (
                  <RowPair key={i} wide={i === 0 ? 'w-48' : 'w-36'} />
                ))}
              </div>
              {[0, 1].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="mt-0.5 size-4 shrink-0 rounded-sm" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-56" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          {/* Verification */}
          <Card>
            <CardBody className="space-y-3">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-full max-w-md" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </CardBody>
          </Card>

          {/* Identity details */}
          <Card>
            <CardBody className="space-y-2">
              <Skeleton className="h-5 w-36" />
              <div className="divide-y divide-line">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <RowPair key={i} wide={i % 3 === 0 ? 'w-56' : 'w-32'} />
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        <aside aria-label="Roles and contact" className="min-w-0 space-y-6">
          <Card>
            <CardBody className="space-y-3">
              <Skeleton className="h-5 w-28" />
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded border border-line px-3 py-2">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardBody className="space-y-3">
              <Skeleton className="h-5 w-20" />
              <div className="divide-y divide-line">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,7rem)_1fr] gap-3 py-2.5">
                    <Skeleton className="h-3.5 w-16" />
                    <Skeleton className="h-3.5 w-full" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-3 w-5/6" />
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
