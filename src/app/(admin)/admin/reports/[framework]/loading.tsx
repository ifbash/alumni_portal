import { Card, CardBody, Skeleton, TableWrap } from '@/components/ui';

/**
 * One accreditation framework, mid-load.
 *
 * Every figure on the real page is a triple — value, the denominator it
 * was measured against, and the sentence it was counted by — laid out two
 * to a row. The skeleton draws that triple rather than a row of value
 * tiles, because the two panels underneath the number are the reason this
 * screen is trusted, and a layout that grows them late reads as if they
 * were an afterthought.
 *
 * The whole-file table below is drawn at its real six columns: what is in
 * the spreadsheet is what is on screen, and that promise starts here.
 */
export default function FrameworkReportLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the framework figures</span>

      {/* Breadcrumbs, eyebrow, title, description, two actions */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-64" />
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3 w-72" />
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-full max-w-prose" />
          </div>
          <div className="flex shrink-0 gap-2">
            <Skeleton className="h-control w-36 rounded" />
            <Skeleton className="h-control w-40 rounded" />
          </div>
        </div>
      </div>

      {/* Framework tabs */}
      <div className="flex gap-6 border-b border-line pb-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-4 w-24" />
        ))}
      </div>

      {/* The caveat banner — reserved, because it is never optional reading */}
      <div className="space-y-2 rounded-lg border border-line bg-surface-sunken p-4">
        <Skeleton className="h-3.5 w-72" />
        <Skeleton className="h-3 w-full max-w-prose" />
        <Skeleton className="h-3 w-3/5" />
      </div>

      {/* Section heading */}
      <div className="space-y-1">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-3.5 w-full max-w-prose" />
      </div>

      {/* Two sections, each a card of metric triples two to a row */}
      {[0, 1].map((section) => (
        <Card key={section}>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-5 w-36 rounded-full" />
            </div>
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-3.5 w-full max-w-prose" />

            <div className="grid gap-3 lg:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col gap-3 rounded-lg border border-line p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Skeleton className="h-3.5 w-44" />
                    <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {/* "Out of" and "How it was counted" — the two panels a
                        figure is only defensible with. */}
                    <div className="space-y-2 rounded border border-line bg-surface-sunken p-3">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-4/5" />
                    </div>
                    <div className="space-y-2 rounded border border-line bg-surface-sunken p-3">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      ))}

      {/* Exactly what the export contains */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <Skeleton className="h-6 w-72" />
            <Skeleton className="h-3.5 w-full max-w-prose" />
          </div>
          <Skeleton className="h-control-sm w-36 shrink-0 rounded" />
        </div>

        {/* Below sm the six-column export table becomes cards */}
        <div className="space-y-3 sm:hidden">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i}>
              <CardBody className="space-y-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-36" />
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="flex items-start justify-between gap-4">
                    <Skeleton className="h-3 w-24 shrink-0" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                ))}
              </CardBody>
            </Card>
          ))}
        </div>

        <TableWrap caption="Loading the framework figures with their denominators and definitions" className="hidden sm:block">
          <div className="divide-y divide-line">
            <div className="flex items-center gap-4 bg-surface-sunken px-3 py-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="ml-auto h-3 w-24" />
            </div>
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="flex items-start gap-4 px-3 py-3.5">
                <Skeleton className="h-3.5 w-20 shrink-0" />
                <div className="w-44 shrink-0 space-y-2">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-3.5 w-14 shrink-0" />
                <Skeleton className="hidden h-3 w-40 shrink-0 lg:block" />
                <Skeleton className="hidden h-3 min-w-0 flex-1 xl:block" />
                <Skeleton className="ml-auto hidden h-3 w-36 shrink-0 xl:block" />
              </div>
            ))}
          </div>
        </TableWrap>

        <div className="flex items-start gap-2">
          <Skeleton className="mt-0.5 size-3.5 shrink-0 rounded-sm" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-full max-w-prose" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      </div>
    </div>
  );
}
