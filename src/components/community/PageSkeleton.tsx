import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * A page mid-load, in the shape of the real one: a header, a line of
 * figures, then a column of cards. One skeleton for the community screens,
 * which share that shape, rather than a bespoke one per route.
 */
export function PageSkeleton({ label, cards = 4 }: { label: string; cards?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading {label}</span>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-control w-32 shrink-0 rounded" />
      </div>

      <Skeleton className="h-4 w-80 max-w-full" />

      <div className="space-y-3">
        {Array.from({ length: cards }, (_, i) => (
          <Card key={i}>
            <CardBody className="space-y-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
