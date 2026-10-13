'use client';

import * as React from 'react';
import { Home, RotateCw } from 'lucide-react';
import { Button, ButtonLink, Card, CardBody, DetailRow, PageHeader } from '@/components/ui';

/**
 * The member portal's error boundary.
 *
 * It renders inside the shell, so the sidebar, the top bar and the account
 * menu are all still there: one page failed, the portal did not.
 *
 * It does not assert a cause. A capability refusal and a server fault both
 * land here, and the reader cannot tell them apart from this screen, so the
 * copy names both and offers the two things that help either way: try
 * again, or go home. The only technical thing on the page is the digest,
 * labelled as something to quote rather than something to understand.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[portal] page failed', error.digest ?? '(no digest)', error);
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
        <ButtonLink href="/dashboard" variant="secondary">
          <Home className="size-4" aria-hidden="true" />
          Back to home
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
