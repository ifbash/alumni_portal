import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * Loading state in the shape of the board itself — header, filter bar,
 * tabs, then a grid of posting cards. A spinner in an empty box tells the
 * reader nothing about what is arriving; this tells them a two-column list
 * of roles is.
 */
export default function JobsLoading() {
  return (
    <div className="space-y-6">
      <p role="status" className="sr-only">
        Loading job postings.
      </p>

      <header className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-prose" />
      </header>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 basis-64 space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-72" />
              <Skeleton className="h-control w-full" />
            </div>
            <Skeleton className="h-control w-24" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-9 w-56 rounded-lg" />
            <Skeleton className="h-3 w-24" />
          </div>
        </CardBody>
      </Card>

      <div className="flex gap-4 border-b border-line pb-2.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-32" />
      </div>

      <ul className="grid gap-gutter lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <li key={i}>
            <Card className="space-y-3 p-card">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-3/4" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3.5 w-48" />
              </div>
              <div className="flex gap-1">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-3 w-56" />
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
