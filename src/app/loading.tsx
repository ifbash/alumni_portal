import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * The root loading state.
 *
 * Shown only on a cold navigation into the app — the route groups have
 * their own, shaped like the screens they precede. This one has no idea
 * which screen is coming, so it draws the frame every signed-in surface
 * shares: a sidebar rail, a heading block, and a card grid. Getting the
 * geometry roughly right is what stops the page jumping when the real
 * content lands.
 *
 * Never a spinner in an empty box. A spinner says "wait" and nothing
 * else; a skeleton says what is about to be there.
 */
export default function RootLoading() {
  return (
    <div className="min-h-dvh bg-surface" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the portal</span>

      {/* Top bar */}
      <div className="border-b border-line bg-surface-raised">
        <div className="mx-auto flex h-14 max-w-page items-center justify-between gap-4 px-4 sm:px-8">
          <Skeleton className="h-6 w-40" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="hidden h-4 w-28 sm:block" />
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-page gap-gutter px-4 py-8 sm:px-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        {/* Sidebar rail — hidden below lg, exactly as the shell hides it */}
        <div className="hidden space-y-6 lg:block">
          {[0, 1].map((group) => (
            <div key={group} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="flex items-center gap-3">
                  <Skeleton className="size-4 rounded-sm" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ))}
        </div>

        <main id="main" className="min-w-0 space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-full max-w-prose" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i}>
                <CardBody className="space-y-3">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-20" />
                </CardBody>
              </Card>
            ))}
          </div>

          <div className="grid gap-gutter lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardBody className="space-y-4">
                <Skeleton className="h-5 w-40" />
                {[0, 1, 2, 3, 4].map((row) => (
                  <div key={row} className="flex items-center gap-3">
                    <Skeleton className="size-10 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/5" />
                      <Skeleton className="h-3 w-3/5" />
                    </div>
                    <Skeleton className="hidden h-8 w-24 rounded sm:block" />
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-4">
                <Skeleton className="h-5 w-32" />
                {[0, 1, 2].map((row) => (
                  <div key={row} className="space-y-2">
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
