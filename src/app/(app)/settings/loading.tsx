import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * Settings, mid-load.
 *
 * The heading and the section list belong to the settings layout, which
 * has already rendered by the time this appears. So this draws only what a
 * section contributes: a main card of label-and-value rows, and at xl the
 * narrower card beside it.
 */
export default function SettingsLoading() {
  return (
    <div
      className="grid grid-cols-1 items-start gap-gutter xl:grid-cols-[minmax(0,1fr)_20rem]"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading your settings</span>

      <Card>
        <CardBody className="space-y-5">
          <Skeleton className="h-6 w-40" />
          <div className="divide-y divide-line border-y border-line">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="grid grid-cols-1 gap-1.5 py-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
                <Skeleton className="h-3.5 w-24" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3 w-2/5" />
                </div>
              </div>
            ))}
          </div>
          <Skeleton className="h-11 w-32 rounded" />
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <div className="band-surface h-20" aria-hidden="true" />
        <CardBody className="space-y-3">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-3.5 w-2/3" />
        </CardBody>
      </Card>
    </div>
  );
}
