import { Card, CardBody, Skeleton, TableWrap } from '@/components/ui';

/**
 * The communications console, mid-load.
 *
 * The two panels under the tiles are the load-bearing part of this screen —
 * which of the three send tiers you hold, and which channels a message can
 * actually travel on — so they are drawn side by side at their real
 * proportions rather than as one column that splits when the data lands.
 *
 * The send history below is a five-column table above `sm` and a stack of
 * cards under it, exactly as the real page renders it.
 */
export default function CommsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the communications console</span>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-full max-w-prose" />
        </div>
        <Skeleton className="h-control w-40 shrink-0 rounded" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-card">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="size-4 rounded-sm" />
            </div>
            <Skeleton className="mt-3 h-8 w-24" />
            <Skeleton className="mt-2 h-3 w-40" />
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Who you may address — three tiers, each a title, a capability
            name and a paragraph, separated by rules. */}
        <Card>
          <CardBody className="space-y-4">
            <div className="space-y-1">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5 border-t border-line pt-4 first:border-0 first:pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-5 w-28 rounded-full" />
                </div>
                <Skeleton className="h-3 w-44" />
                <Skeleton className="h-3.5 w-full max-w-prose" />
                <Skeleton className="h-3.5 w-3/4" />
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Channels — two bordered rows, then the standing note on WhatsApp */}
        <Card>
          <CardBody className="space-y-4">
            <div className="space-y-1">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-3.5 w-64" />
            </div>
            {[0, 1].map((i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-line p-4">
                <Skeleton className="mt-0.5 size-5 shrink-0 rounded-sm" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                </div>
              </div>
            ))}
            <div className="space-y-2 rounded-lg border border-line bg-surface-sunken p-4">
              <Skeleton className="h-3.5 w-56" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Sent */}
      <div className="space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-3.5 w-full max-w-prose" />
        </div>

        {/* Below sm the send history is a stack of cards, not a table */}
        <div className="space-y-3 sm:hidden">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i}>
              <CardBody className="space-y-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-40" />
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex items-center justify-between gap-4">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))}
              </CardBody>
            </Card>
          ))}
        </div>

        <TableWrap caption="Loading broadcasts recorded in the audit log" className="hidden sm:block">
          <div className="divide-y divide-line">
            <div className="flex items-center gap-4 bg-surface-sunken px-3 py-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="ml-auto h-3 w-20" />
            </div>
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex items-start gap-4 px-3 py-3.5">
                <div className="w-28 shrink-0 space-y-2">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-56" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <div className="hidden w-40 shrink-0 space-y-2 md:block">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-3.5 w-16 shrink-0" />
                <Skeleton className="ml-auto hidden h-3 w-20 shrink-0 lg:block" />
              </div>
            ))}
          </div>
        </TableWrap>
      </div>

      {/* What this console cannot do */}
      <div className="space-y-2 rounded-lg border border-line bg-surface-sunken p-4">
        <Skeleton className="h-3.5 w-52" />
        <Skeleton className="h-3 w-full max-w-prose" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}
