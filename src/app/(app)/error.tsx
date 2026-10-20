'use client';

import * as React from 'react';
import { Home, RotateCw, TriangleAlert } from 'lucide-react';
import { Button, ButtonLink, Card, CardBody, DetailRow } from '@/components/ui';
import { NotFoundPanel } from './_components/NotFoundPanel';

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
    <div className="space-y-6">
      <NotFoundPanel
        numeral={null}
        eyebrow="Something went wrong"
        icon={<TriangleAlert />}
        title="This page could not be shown"
        description="Something went wrong, or this page is not open to your account. If you were filling in a form, open it again before saving."
        action={
          <>
            <Button onClick={reset} className="min-h-11">
              <RotateCw className="size-4" aria-hidden="true" />
              Try again
            </Button>
            <ButtonLink href="/dashboard" variant="secondary" className="min-h-11">
              <Home className="size-4" aria-hidden="true" />
              Back to home
            </ButtonLink>
          </>
        }
      />

      <Card className="max-w-prose">
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
