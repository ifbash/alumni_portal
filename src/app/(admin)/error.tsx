'use client';

import * as React from 'react';
import { ChartNoAxesColumn, RotateCw } from 'lucide-react';
import { Breadcrumbs, Button, ButtonLink, Card, CardBody, DetailRow, PageHeader } from '@/components/ui';

/**
 * The staff console's error boundary.
 *
 * It renders inside the console shell, so every queue is still one click
 * away in the sidebar. Like the member boundary it does not assert a
 * cause: a refusal for a screen this account does not hold and a server
 * fault both arrive here. It offers a retry, the way back to Today, and
 * the reference to quote.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[console] page failed', error.digest ?? '(no digest)', error);
  }, [error]);

  return (
    <div className="max-w-prose space-y-6">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: 'Staff console', href: '/admin' }, { label: 'Could not be shown' }]} />}
        title="This page could not be shown"
        description="Something went wrong, or this page is not open to your account."
      />

      <div className="flex flex-wrap gap-2">
        <Button onClick={reset}>
          <RotateCw className="size-4" aria-hidden="true" />
          Try again
        </Button>
        <ButtonLink href="/admin" variant="secondary">
          <ChartNoAxesColumn className="size-4" aria-hidden="true" />
          Back to Today
        </ButtonLink>
      </div>

      <p className="text-sm text-secondary">If you were filling in a form, open it again before saving.</p>

      <Card>
        <CardBody className="space-y-3">
          <p className="text-sm text-secondary">
            If it keeps happening, send the office that runs this portal the reference below.
          </p>
          <dl className="divide-y divide-line">
            <DetailRow label="Reference">
              <span className="font-mono text-sm">{error.digest ?? 'Not recorded'}</span>
            </DetailRow>
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}
