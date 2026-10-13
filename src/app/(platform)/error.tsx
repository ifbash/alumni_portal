'use client';

import * as React from 'react';
import { Building2, RotateCw } from 'lucide-react';
import { Button, ButtonLink, Card, CardBody, DetailRow, PageHeader } from '@/components/ui';

/**
 * The platform console's error boundary.
 *
 * Same pattern as the college boundaries: no claim about the cause, a
 * retry, the way back to Colleges, and the reference to quote.
 */
export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[platform] page failed', error.digest ?? '(no digest)', error);
  }, [error]);

  return (
    <div className="max-w-prose space-y-6">
      <PageHeader
        title="This page could not be shown"
        description="Something went wrong, or this page is not open to your account."
      />

      <div className="flex flex-wrap gap-2">
        <Button onClick={reset}>
          <RotateCw className="size-4" aria-hidden="true" />
          Try again
        </Button>
        <ButtonLink href="/platform" variant="secondary">
          <Building2 className="size-4" aria-hidden="true" />
          Back to Colleges
        </ButtonLink>
      </div>

      <p className="text-sm text-secondary">If you were filling in a form, open it again before saving.</p>

      <Card>
        <CardBody className="space-y-3">
          <p className="text-sm text-secondary">If it keeps happening, quote the reference below.</p>
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
