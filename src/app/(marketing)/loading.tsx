import { Card, CardBody, Skeleton } from '@/components/ui';

/**
 * The public surface, in outline.
 *
 * Every marketing page is built the same way — a sunken band carrying the
 * eyebrow, the heading and one paragraph, then sections of cards below it
 * — so one skeleton covers the landing page, About, the events list, the
 * contact page and the two legal notices without any of them jumping when
 * the real content lands.
 *
 * The header and footer are drawn by the group's layout and are already on
 * screen by the time this shows, so this deliberately draws neither.
 *
 * It matters more here than anywhere else in the portal: this is the first
 * thing an alumnus sees after tapping a WhatsApp link on a phone with two
 * bars of signal, and the tenant's fonts are still being fetched. A
 * spinner in an empty box would be the college's first impression.
 */
export default function MarketingLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      {/* The banner band */}
      <div className="border-b border-line bg-surface-sunken py-16">
        <div className="page-shell max-w-prose space-y-4">
          <Skeleton className="h-3 w-56" />
          <Skeleton className="h-10 w-full max-w-sm" />
          <div className="space-y-2 pt-1">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        </div>
      </div>

      <div className="page-shell space-y-12 py-section">
        {/* A section heading and its description */}
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full max-w-prose" />
        </div>

        {/* Row of cards — the shape About, the landing page and the events
            list all share below their first heading. */}
        <div className="grid gap-6 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i}>
              <CardBody className="space-y-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-5 w-2/5" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-4/5" />
              </CardBody>
            </Card>
          ))}
        </div>

        {/* Stacked list rows — events, processors, the rights cards. */}
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardBody className="flex flex-col gap-4 sm:flex-row">
                <Skeleton className="h-16 w-full rounded sm:w-20" />
                <div className="min-w-0 flex-1 space-y-2.5">
                  <div className="flex gap-1.5">
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3.5 w-full" />
                </div>
                <div className="w-full shrink-0 space-y-2 border-t border-line pt-3 sm:w-52 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                  <Skeleton className="h-control-sm w-36 rounded" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
