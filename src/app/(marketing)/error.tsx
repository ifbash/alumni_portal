'use client';

import * as React from 'react';
import Link from 'next/link';
import { Home, RotateCw, TriangleAlert } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui';
import { DetailLine, StatusPanel, TechnicalDetails } from '@/components/status/StatusPanel';

/**
 * The public site's error boundary.
 *
 * The reader here may have no account and no relationship with the
 * college beyond a link somebody sent them, so there is no "your data is
 * safe" to offer — nothing of theirs is involved. What there is instead is
 * a route onward, and one guarantee worth making explicitly: the privacy
 * notice is a public document and does not depend on this page working.
 *
 * It sits in the marketing layout's `<main>`, under the site header, so it
 * runs edge to edge like the other public heroes and does not add a second
 * landmark.
 */
export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[site] page failed', error.digest ?? '(no digest)', error);
  }, [error]);

  return (
    <>
      <StatusPanel
        variant="bleed"
        icon={<TriangleAlert aria-hidden="true" />}
        eyebrow="Something went wrong"
        title="This page did not load"
        actions={
          <>
            <Button variant="band" size="lg" onClick={reset}>
              <RotateCw className="size-4" aria-hidden="true" />
              Try again
            </Button>
            <ButtonLink href="/" variant="band-outline" size="lg">
              <Home className="size-4" aria-hidden="true" />
              Go to the home page
            </ButtonLink>
          </>
        }
      >
        <p>
          The server failed while building this page. Nothing was submitted and nothing was
          recorded, because this is a public page and you had not given it anything.
        </p>
      </StatusPanel>

      <div className="page-shell py-10 lg:py-14">
        <div className="max-w-prose space-y-6">
          <ul className="space-y-2 text-sm text-secondary">
            <li>
              Signing in? The sign-in page is separate and is usually unaffected by a failure here.{' '}
              <Link href="/login" className="link">
                Go to sign in
              </Link>
            </li>
            <li>
              The privacy notice and the terms are their own pages and stay readable:{' '}
              <Link href="/privacy" className="link">
                privacy notice
              </Link>
              ,{' '}
              <Link href="/terms" className="link">
                terms of use
              </Link>
              .
            </li>
          </ul>

          <TechnicalDetails>
            <DetailLine label="Reference">{error.digest ?? 'not recorded'}</DetailLine>
            <p>Quote this reference if you write to the college about the problem.</p>
          </TechnicalDetails>
        </div>
      </div>
    </>
  );
}
