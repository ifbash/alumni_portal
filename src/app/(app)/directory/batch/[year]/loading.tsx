import { Skeleton } from '@/components/ui';
import { BandSkeleton } from '@/app/(app)/_components/BandSkeleton';

/**
 * A batch or branch page, mid-load: the band, the one-line summary, the
 * branch chips, then the people as rows on a phone and cards from `sm`.
 */
export default function CohortLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the people</span>

      <BandSkeleton />
      <Skeleton className="h-14 w-full rounded-lg" />
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>

      <div className="space-y-4">
        <Skeleton className="h-7 w-48" />
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <li key={i} className="flex items-center gap-3 rounded-lg border border-line bg-surface-raised p-4">
              <Skeleton className="size-12 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
