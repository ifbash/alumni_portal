import { Card, CardBody, Skeleton, TableWrap } from '@/components/ui';

/**
 * Job moderation, mid-load.
 *
 * The queue card is the whole screen: a posting on the left and the
 * poster's standing on the right, in a fixed 18rem column. That column is
 * where a moderator decides — does this alumnus actually work at the
 * company they are posting for — so it is reserved from the first frame
 * rather than appearing once the data arrives.
 *
 * Two queue cards are drawn, not five. The real queue is usually short,
 * and a skeleton that promises more work than exists is its own small lie.
 */
export default function AdminJobsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the job moderation queue</span>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-full max-w-prose" />
        </div>
        <Skeleton className="h-6 w-28 shrink-0 rounded-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-card">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="size-4 rounded-sm" />
            </div>
            <Skeleton className="mt-3 h-8 w-12" />
            <Skeleton className="mt-2 h-3 w-40" />
          </Card>
        ))}
      </div>

      {/* The policy being applied */}
      <Card>
        <CardBody className="space-y-4">
          <div className="space-y-1">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-3.5 w-full max-w-prose" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-3 w-full max-w-prose" />
            <Skeleton className="h-3 w-5/6" />
          </div>
          <span className="block h-px w-full bg-line" />
          <ul className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex gap-2">
                <Skeleton className="mt-0.5 size-3 shrink-0 rounded-full" />
                <Skeleton className="h-3.5 w-full max-w-prose" />
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {/* Queue */}
      <div className="space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-3.5 w-full max-w-prose" />
        </div>

        {[0, 1].map((card) => (
          <Card key={card}>
            <CardBody className="space-y-4">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-5 w-36 rounded-full" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-72" />
                <div className="flex flex-wrap gap-3">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3.5 w-36" />
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3.5 w-20" />
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-5 w-20 rounded-full" />
                    ))}
                  </div>
                  <div className="space-y-2 rounded-lg border border-line p-4">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-4/5" />
                    <Skeleton className="h-3.5 w-2/3" />
                  </div>
                </div>

                {/* Who posted this */}
                <aside className="space-y-4 rounded-lg border border-line bg-surface-sunken p-4">
                  <Skeleton className="h-3 w-32" />
                  <div className="flex items-start gap-3">
                    <Skeleton className="size-10 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                  {[0, 1].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-3 w-40" />
                      <Skeleton className="h-3.5 w-32" />
                    </div>
                  ))}
                  <div className="space-y-2 rounded-lg border border-line p-4">
                    <Skeleton className="h-3.5 w-44" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </aside>
              </div>

              <div className="flex justify-end gap-2 border-t border-line pt-3">
                <Skeleton className="h-control w-24 rounded" />
                <Skeleton className="h-control w-24 rounded" />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Recently moderated */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3.5 w-full max-w-prose" />
          </div>
          <Skeleton className="h-3.5 w-28 shrink-0" />
        </div>

        <TableWrap caption="Loading recently moderated job postings" className="hidden sm:block">
          <div className="divide-y divide-line">
            <div className="flex items-center gap-4 bg-surface-sunken px-3 py-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="ml-auto h-3 w-16" />
            </div>
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex items-start gap-4 px-3 py-3.5">
                <div className="w-52 shrink-0 space-y-2">
                  <Skeleton className="h-3.5 w-44" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <div className="hidden w-40 shrink-0 space-y-2 md:block">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="hidden h-3.5 w-20 shrink-0 lg:block" />
                <Skeleton className="h-5 w-24 shrink-0 rounded-full" />
                <Skeleton className="ml-auto hidden h-3 min-w-0 flex-1 lg:block" />
              </div>
            ))}
          </div>
        </TableWrap>

        <div className="space-y-3 sm:hidden">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i}>
              <CardBody className="space-y-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-36" />
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="flex items-center justify-between gap-4">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))}
              </CardBody>
            </Card>
          ))}
        </div>

        <Skeleton className="h-3 w-full max-w-prose" />
      </div>
    </div>
  );
}
