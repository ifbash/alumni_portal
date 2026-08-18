import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * Your own profile, mid-load.
 *
 * The completeness meter sits at the top of the real page and is the
 * tallest thing on it, so it is drawn first and at roughly its true
 * height. Under it, the same two-thirds / one-third split: identity,
 * about, work history and education on the left, contact record and
 * verification on the right.
 */
export default function ProfileLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your profile</span>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-full max-w-prose" />
        </div>
        <div className="flex shrink-0 gap-2">
          <Skeleton className="h-control w-40 rounded" />
          <Skeleton className="h-control w-28 rounded" />
        </div>
      </div>

      {/* Completeness */}
      <Card>
        <CardBody className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3.5 w-full max-w-prose" />
            </div>
            <Skeleton className="h-10 w-20 shrink-0" />
          </div>

          <Skeleton className="h-2 w-full rounded-full" />

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-3">
              <Skeleton className="h-3.5 w-32" />
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-start gap-2.5">
                  <Skeleton className="size-5 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-28" />
              {[0, 1, 2, 3].map((row) => (
                <Skeleton key={row} className="h-3.5 w-3/5" />
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Identity */}
          <Card>
            <CardBody className="space-y-5">
              <Skeleton className="h-5 w-24" />
              <div className="flex items-start gap-4">
                <Skeleton className="size-24 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2.5">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3.5 w-1/3" />
                  <div className="flex gap-1.5 pt-1">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </div>
              </div>
              <dl className="divide-y divide-line">
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="grid grid-cols-[minmax(0,10rem)_1fr] gap-4 py-2.5">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3.5 w-2/5" />
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>

          {/* About */}
          <Card>
            <CardBody className="space-y-4">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-5/6" />
              <div className="grid gap-4 sm:grid-cols-2">
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="space-y-1.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3.5 w-2/3" />
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Work history */}
          <Card>
            <CardBody className="space-y-4">
              <Skeleton className="h-5 w-32" />
              <ol className="space-y-4">
                {[0, 1, 2].map((row) => (
                  <li key={row} className="flex gap-3">
                    <Skeleton className="mt-1 size-8 shrink-0 rounded" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3.5 w-full" />
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center gap-2 border-t border-line pt-3">
                  <Skeleton className="size-4 shrink-0 rounded-sm" />
                  <Skeleton className="h-3.5 w-3/5" />
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
