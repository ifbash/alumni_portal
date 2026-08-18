import { Card, CardBody, Skeleton, TableWrap } from '@/components/ui';

/**
 * The gallery console, mid-load.
 *
 * The review queue sits above the album list on the real page, because a
 * contribution that waits three weeks is a contributor who never sends a
 * second batch. The skeleton keeps that order: whatever a graduate has
 * sent in loads in the position it will be read in.
 *
 * The photograph strip is drawn at mixed aspect ratios rather than as a
 * row of squares — the real tiles are portrait and landscape, and a
 * uniform grid that reflows when the sizes arrive is a worse wait than a
 * ragged one that does not.
 */

/** Portrait and landscape, in the proportions the fixture actually holds. */
const TILE_RATIOS = ['3 / 4', '3 / 2', '3 / 2', '3 / 4', '3 / 2', '3 / 2'];

export default function AdminGalleryLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the gallery console</span>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-full max-w-prose" />
        </div>
        <Skeleton className="h-control w-36 shrink-0 rounded" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-card">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="size-4 rounded-sm" />
            </div>
            <Skeleton className="mt-3 h-8 w-16" />
            <Skeleton className="mt-2 h-3 w-36" />
          </Card>
        ))}
      </div>

      {/* The standing note about albums whose image files never arrived */}
      <div className="space-y-2 rounded-lg border border-line bg-surface-sunken p-4">
        <Skeleton className="h-3.5 w-80" />
        <Skeleton className="h-3 w-full max-w-prose" />
        <Skeleton className="h-3 w-3/4" />
      </div>

      {/* Waiting on you */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />

        <Card>
          <CardBody className="space-y-4">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                <Skeleton className="h-5 w-32 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-28 rounded-full" />
              </div>
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-3.5 w-full max-w-prose" />
            </div>

            <div className="space-y-2 rounded border border-line bg-surface-sunken p-3">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
            </div>

            <div className="space-y-2">
              <Skeleton className="h-3 w-40" />
              <ul className="flex flex-wrap gap-2">
                {TILE_RATIOS.map((ratio, i) => (
                  <li key={i} style={{ aspectRatio: ratio }} className="h-20">
                    <Skeleton className="size-full rounded" />
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              <Skeleton className="h-control w-28 rounded" />
              <Skeleton className="h-control w-28 rounded" />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Album list tabs */}
      <div className="flex gap-6 border-b border-line pb-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-4 w-32" />
        ))}
      </div>

      {/* Below sm a seven-column album table is unreadable however it scrolls */}
      <div className="space-y-3 sm:hidden">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardBody className="space-y-3">
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-3 w-36" />
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="flex items-center justify-between gap-4">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
              <Skeleton className="h-control-sm w-36 rounded" />
            </CardBody>
          </Card>
        ))}
      </div>

      <TableWrap caption="Loading albums with their photograph counts and publication state" className="hidden sm:block">
        <div className="divide-y divide-line">
          <div className="flex items-center gap-4 bg-surface-sunken px-3 py-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="ml-auto h-3 w-14" />
          </div>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-start gap-4 px-3 py-3.5">
              <div className="w-56 shrink-0 space-y-2">
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <div className="hidden w-36 shrink-0 space-y-2 md:block">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-3.5 w-12 shrink-0" />
              <Skeleton className="hidden h-3.5 w-12 shrink-0 lg:block" />
              <div className="hidden w-40 shrink-0 space-y-2 lg:block">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="hidden h-3.5 w-20 shrink-0 xl:block" />
              <Skeleton className="ml-auto h-5 w-24 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      </TableWrap>

      {/* The margin note on what publishing an album actually does */}
      <div className="max-w-prose space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}
