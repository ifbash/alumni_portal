'use client';

import * as React from 'react';
import Link from 'next/link';
import { BookOpen, Home, LogIn, RotateCw, ShieldCheck } from 'lucide-react';
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardTitle,
  DetailRow,
} from '@/components/ui';

/**
 * The public site's error boundary.
 *
 * The reader here may have no account and no relationship with the
 * college beyond a link somebody sent them, so there is no "your data is
 * safe" to offer — nothing of theirs is involved. What there is instead is
 * a route onward, and one guarantee worth making explicitly: the privacy
 * notice is a public document and does not depend on this page working.
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
    <div className="page-shell max-w-prose space-y-6 py-section">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-fg">
          Something broke
        </p>
        <h1 className="font-display text-display-xs font-bold">This page did not load</h1>
        <p className="text-sm text-secondary">
          The server failed while building it. Nothing was submitted and nothing was recorded — this
          is a public page, and you had not given it anything.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={reset}>
          <RotateCw className="size-4" aria-hidden="true" />
          Try again
        </Button>
        <ButtonLink href="/" variant="secondary">
          <Home className="size-4" aria-hidden="true" />
          Home
        </ButtonLink>
        <ButtonLink href="/login" variant="ghost">
          <LogIn className="size-4" aria-hidden="true" />
          Sign in
        </ButtonLink>
      </div>

      <Alert tone="neutral" title="The privacy notice is still reachable" icon={<ShieldCheck className="size-4" />}>
        <p>
          It is linked from the consent box on the registration form, so it is served as its own
          page and does not depend on this one.{' '}
          <Link href="/privacy">Read the privacy notice</Link> or{' '}
          <Link href="/terms">the terms of use</Link>.
        </p>
      </Alert>

      <Card>
        <CardBody className="space-y-4">
          <div className="space-y-1">
            <CardTitle as="h2">If you were trying to sign in</CardTitle>
            <CardDescription>
              The sign-in screen is a separate page and is usually unaffected by a failure here.
            </CardDescription>
          </div>

          <p className="flex items-start gap-2 text-sm text-secondary">
            <BookOpen className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Alumni sign in with the email address the college holds for them; a six-digit code
              arrives by email and works once. There is no password to have forgotten.
            </span>
          </p>

          <dl className="divide-y divide-line border-t border-line pt-1">
            <DetailRow label="Reference">
              <span className="font-mono text-sm">{error.digest ?? 'not recorded'}</span>
            </DetailRow>
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}
