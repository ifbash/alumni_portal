import { Card, Skeleton } from '@/components/ui';

/**
 * The board's own shape, drawn empty: the compact band, the tabs, the
 * search and filter row, then posting cards (rows on a phone), so the
 * only thing that changes when it lands is the text.
 */
export default function JobsLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <p role="status" className="sr-only">
        Loading job postings.
      </p>

      <div className="band-surface -mx-4 space-y-3 px-5 py-5 sm:mx-0 sm:rounded-xl sm:px-8 lg:py-6" aria-hidden="true">
        <div className="h-3 w-32 rounded bg-[color-mix(in_srgb,var(--band-fg)_18%,transparent)]" />
        <div className="h-7 w-full max-w-md rounded bg-[color-mix(in_srgb,var(--band-fg)_18%,transparent)]" />
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 w-28 rounded-full border border-band-rule" />
          ))}
        </div>
      </div>

      <div className="flex gap-4 border-b border-line pb-2.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-28" />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Skeleton className="h-control-lg w-full rounded lg:max-w-md" />
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
      </div>

      <Skeleton className="h-6 w-64" />

      <ul className="hidden grid-cols-1 gap-gutter sm:grid sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <li key={i}>
            <Card className="space-y-3 p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="size-14 shrink-0 rounded" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3.5 w-2/3" />
                </div>
              </div>
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-28 rounded-full" />
              </div>
              <Skeleton className="h-4 w-40" />
            </Card>
          </li>
        ))}
      </ul>

      <Card className="divide-y divide-line px-4 sm:hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3 py-3">
            <Skeleton className="size-10 shrink-0 rounded" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-5 w-32 rounded-full" />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
