import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * Settings, mid-load.
 *
 * The heading and the tab bar belong to the settings layout, which has
 * already rendered by the time this appears — the boundary sits inside it.
 * So this draws only what a settings tab contributes: a stack of
 * `Section` headings, each over a card of rows or switches, inside the
 * layout's own `max-w-3xl` column.
 */
export default function SettingsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your settings</span>

      {[0, 1].map((section) => (
        <div key={section} className="space-y-4">
          <Skeleton className="h-6 w-40" />

          <Card>
            <CardBody className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <Skeleton className="h-4 w-52" />
                  <Skeleton className="h-3.5 w-full max-w-prose" />
                  <Skeleton className="h-3.5 w-3/5" />
                </div>
                <Skeleton className="size-5 shrink-0 rounded-sm" />
              </div>

              <dl className="divide-y divide-line">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="grid grid-cols-[minmax(0,10rem)_1fr] gap-4 py-2.5">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3.5 w-1/2" />
                  </div>
                ))}
              </dl>

              <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                <Skeleton className="h-control-sm w-28 rounded" />
                <Skeleton className="h-3 w-56" />
              </div>
            </CardBody>
          </Card>
        </div>
      ))}

      {/* A switch list — the shape both the notifications and privacy tabs take */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Card>
          <CardBody className="space-y-4">
            {[0, 1, 2, 3].map((row) => (
              <div
                key={row}
                className="flex items-start justify-between gap-4 border-t border-line pt-4 first:border-0 first:pt-0"
              >
                <div className="min-w-0 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3.5 w-full max-w-prose" />
                </div>
                <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
