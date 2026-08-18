import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * One member record, mid-load.
 *
 * The record is a two-column page with a fixed 20rem aside, so the
 * skeleton reserves both columns from the first frame — a full-width stack
 * that snaps into two columns when the data lands moves every control on
 * the page under the reader's cursor.
 *
 * Inside the main column the order is the real one: identity, then the
 * verification evidence directly under it, because "why do we believe this
 * person is who they say they are" is the question this screen exists to
 * answer and it should not appear to load last.
 */

/** The identity list is eight rows; the evidence list five. */
const IDENTITY_ROWS = [0, 1, 2, 3, 4, 5, 6, 7];
const EVIDENCE_ROWS = [0, 1, 2, 3, 4];

function RowPair({ wide = 'w-40' }: { wide?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,10rem)_1fr] gap-4 py-2.5">
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className={`h-3.5 ${wide}`} />
    </div>
  );
}

export default function MemberRecordLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the member record</span>

      {/* Breadcrumbs, eyebrow roll number, name, identity line, one action */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-56" />
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-full max-w-prose" />
          </div>
          <Skeleton className="h-control w-52 shrink-0 rounded" />
        </div>
      </div>

      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="space-y-6">
          {/* Identity */}
          <Card>
            <CardBody className="space-y-5">
              <div className="flex flex-wrap items-start gap-4">
                <Skeleton className="size-24 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-5 w-28 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-32 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3.5 w-full max-w-prose" />
                  <Skeleton className="h-3.5 w-4/5" />
                </div>
              </div>

              {/* Separator label="Identity" */}
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-line" />
                <Skeleton className="h-3 w-16" />
                <span className="h-px flex-1 bg-line" />
              </div>

              <div className="divide-y divide-line">
                {IDENTITY_ROWS.map((i) => (
                  <RowPair key={i} wide={i % 3 === 0 ? 'w-56' : 'w-36'} />
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Verification evidence */}
          <Card>
            <CardBody className="space-y-4">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-52" />
                <Skeleton className="h-3.5 w-full max-w-prose" />
              </div>
              <div className="divide-y divide-line">
                {EVIDENCE_ROWS.map((i) => (
                  <RowPair key={i} wide={i === 2 ? 'w-64' : 'w-44'} />
                ))}
              </div>
              {/* The matcher's reasons, in their own well */}
              <div className="space-y-2 rounded-lg border border-line bg-surface-sunken p-4">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3.5 w-1/2" />
              </div>
            </CardBody>
          </Card>

          {/* Work and education */}
          <Card>
            <CardBody className="space-y-5">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3.5 w-full max-w-prose" />
              </div>
              <div className="divide-y divide-line">
                {[0, 1, 2, 3, 4].map((i) => (
                  <RowPair key={i} wide={i === 4 ? 'w-64' : 'w-40'} />
                ))}
              </div>
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="mt-0.5 size-4 shrink-0 rounded-sm" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-56" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Activity */}
          <Card>
            <CardBody className="space-y-5">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-3.5 w-full max-w-prose" />
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-6 w-12" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <Skeleton key={i} className="h-5 w-24 rounded-full" />
                  ))}
                </div>
              </div>
              <div className="divide-y divide-line">
                {[0, 1].map((i) => (
                  <RowPair key={i} wide="w-52" />
                ))}
              </div>
              <div className="space-y-2 border-t border-line pt-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="mt-0.5 size-4 shrink-0 rounded-sm" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-48" />
                      <Skeleton className="h-3 w-64" />
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Aside: staff actions, roles, contact, duplicates */}
        <aside className="space-y-6">
          <Card>
            <CardBody className="space-y-4">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-4/5" />
              </div>
              {[0, 1].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-control w-full" />
                </div>
              ))}
              <Skeleton className="h-control w-full rounded" />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-3.5 w-full" />
              </div>
              <ul className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 rounded border border-line px-3 py-2"
                  >
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-4">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-3.5 w-full" />
              </div>
              <div className="divide-y divide-line">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,7rem)_1fr] gap-3 py-2.5">
                    <Skeleton className="h-3.5 w-20" />
                    <Skeleton className="h-3.5 w-full" />
                  </div>
                ))}
              </div>
              {/* The capability note that sits under every contact block */}
              <div className="space-y-2 rounded-lg border border-line bg-surface-sunken p-4">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex gap-3">
              <Skeleton className="mt-0.5 size-4 shrink-0 rounded-sm" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
