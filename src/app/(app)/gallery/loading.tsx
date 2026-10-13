import { Skeleton } from '@/components/ui';

/**
 * The photos page in outline: header, the newest album as a wide hero
 * (with the send-in card beside it on a desktop), the filter chips, then
 * the mosaic — one large album and tiles, two columns on a phone.
 *
 * The same geometry as the loaded page, so the albums settle into the
 * frame instead of pushing it around.
 */
export default function GalleryLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the photos</span>

      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-3 lg:items-start">
        <div className="space-y-3 lg:col-span-2">
          <Skeleton className="aspect-[21/9] w-full rounded-lg" />
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="hidden space-y-3 rounded-lg border border-line p-5 lg:block">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-control w-36 rounded" />
        </div>
      </div>

      <div className="flex gap-2 overflow-hidden">
        {['w-12', 'w-24', 'w-28', 'w-16', 'w-16'].map((w, i) => (
          <Skeleton key={i} className={`h-9 shrink-0 rounded-full ${w}`} />
        ))}
      </div>

      <ul className="grid grid-flow-row-dense grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i} className={i === 0 ? 'col-span-2 space-y-2 lg:row-span-2' : 'space-y-2'}>
            <Skeleton className="aspect-[3/2] w-full rounded-lg" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3.5 w-3/5" />
          </li>
        ))}
      </ul>
    </div>
  );
}
