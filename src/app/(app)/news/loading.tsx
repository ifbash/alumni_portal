import { Skeleton } from '@/components/ui';

/**
 * The news page in outline — header, kind chips, then the front page as
 * it will actually land: a lead story with two beside it, and the earlier
 * stories as a list. The content settles into the frame instead of
 * pushing it down the page.
 */
export default function NewsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the news page</span>

      <div className="space-y-2">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>

      <div className="flex gap-2 overflow-hidden">
        {['w-28', 'w-36', 'w-32', 'w-28', 'w-28'].map((w) => (
          <Skeleton key={w} className={`h-9 shrink-0 rounded-full ${w}`} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-3">
        <div className="overflow-hidden rounded-lg border border-line bg-surface-raised lg:col-span-2">
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="space-y-2.5 p-4">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-7 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-1">
          {[0, 1].map((i) => (
            <div key={i} className="overflow-hidden rounded-lg border border-line bg-surface-raised">
              <Skeleton className="aspect-[21/9] w-full rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-3.5 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <ul className="divide-y divide-line">
        {[0, 1, 2].map((i) => (
          <li key={i} className="space-y-2 py-3">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-5 w-3/5" />
          </li>
        ))}
      </ul>
    </div>
  );
}
