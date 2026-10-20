import { Skeleton } from '@/components/ui';

/**
 * The inbox's own shape, drawn empty: the header, the filter chips, then
 * a day heading over an icon rail of notice cards.
 */
export default function NotificationsLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <p role="status" className="sr-only">
        Loading notifications.
      </p>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-control w-40 rounded" />
      </div>

      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>

      {[3, 2].map((rows, g) => (
        <div key={g} className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <ul className="space-y-3">
            {Array.from({ length: rows }, (_, i) => (
              <li key={i} className="flex gap-3 sm:gap-4">
                <Skeleton className="mt-4 size-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2 rounded-lg border border-line bg-surface-raised p-4 shadow-sm">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
