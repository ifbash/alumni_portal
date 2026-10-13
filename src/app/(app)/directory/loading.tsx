import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * Directory loading state.
 *
 * The same geometry as the real page — the compact band, the search box,
 * the start tiles, then the filter panel beside the results (rows on a
 * phone, cards from `sm`) — so nothing jumps when results arrive. The
 * band is drawn in the band colour, because that is what arrives.
 */
export default function DirectoryLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the directory</span>

      <div className="band-surface -mx-4 space-y-3 px-5 py-5 sm:mx-0 sm:rounded-xl sm:px-8 lg:py-6" aria-hidden="true">
        <div className="h-4 w-32 rounded bg-[color-mix(in_srgb,var(--band-fg)_22%,transparent)]" />
        <div className="h-7 w-56 rounded bg-[color-mix(in_srgb,var(--band-fg)_22%,transparent)]" />
        <div className="h-4 w-full max-w-md rounded bg-[color-mix(in_srgb,var(--band-fg)_16%,transparent)]" />
      </div>

      <Skeleton className="h-control-lg w-full rounded" />

      <div className="grid gap-gutter lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <Card>
            <CardBody className="space-y-5">
              <Skeleton className="h-5 w-20" />
              {[0, 1].map((group) => (
                <div key={group} className="space-y-2 border-t border-line pt-5">
                  <Skeleton className="h-3 w-24" />
                  {[0, 1, 2, 3].map((row) => (
                    <div key={row} className="flex items-center justify-between gap-3">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-6" />
                    </div>
                  ))}
                </div>
              ))}
              <Skeleton className="h-4 w-28" />
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <div className="space-y-3">
            <Skeleton className="h-3 w-20" />
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-line bg-surface-raised px-3 py-2.5">
                  <Skeleton className="size-9 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-8 w-40 rounded" />
          </div>
          <div className="flex gap-2">
            {['w-20', 'w-20', 'w-16', 'w-16'].map((w, i) => (
              <Skeleton key={i} className={`h-9 rounded-full ${w}`} />
            ))}
          </div>

          <ul className="grid grid-cols-1 gap-2 sm:hidden">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i}>
                <Card className="flex min-h-[88px] items-center gap-3 px-4 py-3">
                  <Skeleton className="size-10 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          <ul className="hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }, (_, i) => (
              <li key={i}>
                <Card className="flex h-full flex-col p-card">
                  <div className="flex items-start gap-3">
                    <Skeleton className="size-14 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Skeleton className="h-3 w-5/6" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
