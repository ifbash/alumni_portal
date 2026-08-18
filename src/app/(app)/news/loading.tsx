import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * The feed in outline — header, kind tabs, then story cards in the shape
 * they will actually take: badge row, headline, summary, byline. The
 * content settles into the frame instead of pushing it down the page.
 */
export default function NewsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the news page</span>

      <div className="space-y-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-full max-w-prose" />
        <Skeleton className="h-4 w-2/3 max-w-prose" />
      </div>

      <div className="flex gap-6 overflow-hidden border-b border-line pb-2.5">
        {['w-24', 'w-32', 'w-28', 'w-24', 'w-16', 'w-28'].map((w) => (
          <Skeleton key={w} className={`h-4 shrink-0 ${w}`} />
        ))}
      </div>

      <div className="space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardBody className="space-y-2.5">
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-3.5 w-full max-w-prose" />
              <Skeleton className="h-3.5 w-3/5 max-w-prose" />
              <div className="flex items-center justify-between gap-4 pt-0.5">
                <Skeleton className="h-3 w-52" />
                <Skeleton className="h-3 w-24" />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
