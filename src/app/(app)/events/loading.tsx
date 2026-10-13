import { Skeleton } from '@/components/ui';

/**
 * The events hub in outline: header, the "Next up" band card, the period
 * tabs and branch chips, then the grid of event cards (a list of rows on
 * phones). Same geometry as the loaded page, so it settles into the frame
 * instead of pushing it around.
 */
export default function EventsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading events">
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>

      <div className="flex gap-4 rounded-xl border border-line px-5 py-6 sm:px-8">
        <Skeleton className="h-20 w-16 shrink-0 rounded" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-8 w-28 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex gap-6 border-b border-line pb-2.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-14 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-16 rounded-full" />
        </div>
      </div>

      <ul className="hidden grid-cols-1 gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="rounded-lg border border-line bg-surface-raised p-4">
            <div className="flex gap-3">
              <Skeleton className="h-16 w-14 shrink-0 rounded" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-3.5 w-full" />
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-12 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
            </div>
            <Skeleton className="mt-4 h-control w-28 rounded" />
          </li>
        ))}
      </ul>

      <ul className="divide-y divide-line sm:hidden">
        {[0, 1, 2].map((i) => (
          <li key={i} className="space-y-3 py-3">
            <div className="flex gap-3">
              <Skeleton className="h-16 w-14 shrink-0 rounded" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            </div>
            <Skeleton className="h-11 w-full rounded" />
          </li>
        ))}
      </ul>
    </div>
  );
}
