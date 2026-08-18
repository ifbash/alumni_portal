import { Card, CardBody, Skeleton, TableWrap } from '@/components/ui';

/**
 * The degree register, mid-load.
 *
 * The register is the largest table in the product — one row per graduate
 * since roughly 2013 — so the skeleton draws a full page of rows rather
 * than a polite three. Above it, the two panels the real page opens with:
 * coverage by year of passing on the left, the files the examinations
 * branch has actually sent on the right.
 */
export default function DegreeRegisterLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the degree register</span>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-60" />
          <Skeleton className="h-4 w-full max-w-prose" />
        </div>
        <Skeleton className="h-control w-36 shrink-0 rounded" />
      </div>

      <div className="grid gap-gutter sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-card">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="size-4 rounded-sm" />
            </div>
            <Skeleton className="mt-3 h-8 w-16" />
            <Skeleton className="mt-2 h-3 w-32" />
          </Card>
        ))}
      </div>

      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardBody className="space-y-4">
            <div className="space-y-1">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-3.5 w-full max-w-prose" />
            </div>
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3.5 w-12 shrink-0" />
                <Skeleton className="h-2 flex-1 rounded-full" />
                <Skeleton className="h-3 w-12 shrink-0" />
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-4">
            <div className="space-y-1">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3.5 w-full" />
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2 border-t border-line pt-3 first:border-0 first:pt-0">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-3.5 w-full max-w-prose" />
        </div>

        <Card className="p-card">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_12rem_9rem_auto] lg:items-end">
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-control w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-14" />
              <Skeleton className="h-control w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-control w-full" />
            </div>
            <Skeleton className="h-control w-24" />
          </div>
        </Card>

        {/* Below sm a seven-column register is unreadable however it scrolls */}
        <div className="space-y-3 sm:hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardBody className="space-y-3">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-28" />
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex items-center justify-between gap-3">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))}
              </CardBody>
            </Card>
          ))}
        </div>

        <TableWrap caption="Loading degree register rows" className="hidden sm:block">
          <div className="divide-y divide-line">
            <div className="flex items-center gap-4 bg-surface-sunken px-3 py-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="ml-auto h-3 w-24" />
            </div>
            {Array.from({ length: 15 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 px-3 py-3">
                <Skeleton className="h-3.5 w-28 shrink-0" />
                <Skeleton className="h-3.5 w-44 shrink-0" />
                <Skeleton className="hidden h-3.5 w-12 shrink-0 md:block" />
                <Skeleton className="hidden h-3.5 w-12 shrink-0 md:block" />
                <Skeleton className="hidden h-3.5 w-12 shrink-0 lg:block" />
                <Skeleton className="hidden h-3.5 w-32 shrink-0 xl:block" />
                <Skeleton className="ml-auto h-5 w-24 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        </TableWrap>
      </div>
    </div>
  );
}
