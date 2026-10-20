import { Skeleton } from '@/components/ui';

/**
 * One story, mid-load, in the shape of the real page: breadcrumb, the wide
 * masthead (eyebrow, headline, lede, byline row), then a column of text at
 * reading width.
 */
export default function StoryLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the story</span>

      <Skeleton className="h-4 w-56" />

      <div className="max-w-4xl space-y-4">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/5" />
        <Skeleton className="h-5 w-full max-w-3xl" />
        <Skeleton className="h-5 w-4/5 max-w-3xl" />
        <div className="flex items-center justify-between gap-3 border-y border-line py-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="hidden h-control-sm w-40 rounded sm:block" />
        </div>
      </div>

      <div className="max-w-[68ch] space-y-5">
        {[0, 1, 2].map((p) => (
          <div key={p} className="space-y-2.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ))}
      </div>
    </div>
  );
}
