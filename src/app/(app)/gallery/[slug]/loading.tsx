import { Skeleton } from '@/components/ui';
import { BandSkeleton } from '../../_components/BandSkeleton';

/**
 * One album, mid-load: the band, then a justified mosaic, drawn as rows of
 * tiles of mixed widths so the wall does not reflow when photographs arrive.
 */
const ROWS: number[][] = [
  [3, 2, 4],
  [2, 3, 3],
  [4, 2, 3],
];

export default function AlbumLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the album</span>

      <div className="space-y-4">
        <Skeleton className="h-4 w-48" />
        <BandSkeleton />
      </div>

      <div className="space-y-2 sm:space-y-3" aria-hidden="true">
        {ROWS.map((row, i) => (
          <div key={i} className="flex h-36 gap-2 sm:h-48 sm:gap-3 xl:h-56">
            {row.map((grow, j) => (
              <div key={j} style={{ flexGrow: grow }} className="min-w-0 basis-0">
                <Skeleton className="h-full rounded-lg" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
