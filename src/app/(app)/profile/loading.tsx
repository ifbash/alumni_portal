import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * Your own profile, mid-load, in the shape of the real page: the header
 * card with its cover strip and overlapping avatar, the slim completeness
 * bar, then About beside the rail, with experience, education and the
 * college record under About.
 */
export default function ProfileLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your profile</span>

      <Card className="overflow-hidden">
        <div className="band-surface h-20 sm:h-24" aria-hidden="true" />
        <CardBody className="space-y-4 pt-0">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Skeleton className="-mt-12 size-24 rounded-full ring-4 ring-[var(--surface-raised)]" />
            <div className="hidden gap-2 sm:flex">
              <Skeleton className="h-11 w-36 rounded" />
              <Skeleton className="h-11 w-32 rounded" />
            </div>
          </div>
          <div className="space-y-2.5">
            <Skeleton className="h-8 w-64 max-w-full" />
            <Skeleton className="h-4 w-80 max-w-full" />
            <div className="flex gap-1.5 pt-1">
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex items-center gap-4 rounded-lg border border-line bg-surface-raised px-4 py-3">
        <Skeleton className="h-5 w-10" />
        <Skeleton className="h-2 w-32 rounded-full" />
        <Skeleton className="hidden h-4 w-64 sm:block" />
      </div>

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr]">
        <Card className="lg:col-start-1 lg:row-start-1">
          <CardBody className="space-y-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-3.5 w-full max-w-prose" />
            <Skeleton className="h-3.5 w-4/5 max-w-prose" />
            <div className="flex gap-1.5 border-t border-line pt-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-5 w-16 rounded-full" />
              ))}
            </div>
          </CardBody>
        </Card>

        <div className="space-y-gutter lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <Card>
            <CardBody className="space-y-3">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardBody>
          </Card>
          <Card>
            <CardBody className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-4/5" />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-gutter lg:col-start-1 lg:row-start-2">
          <Card>
            <CardBody className="space-y-4">
              <Skeleton className="h-6 w-32" />
              {[0, 1].map((row) => (
                <div key={row} className="flex gap-4">
                  <Skeleton className="mt-1 size-3.5 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3.5 w-1/3" />
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardBody className="space-y-3">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3.5 w-1/2" />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
