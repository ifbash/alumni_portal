'use client';

import * as React from 'react';
import { ArrowLeft, KeyRound, LifeBuoy, RotateCw, TriangleAlert } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  DetailRow,
} from '@/components/ui';

/**
 * The sign-in group's error boundary.
 *
 * The one thing this screen must not do is throw the reader back to the
 * beginning. Somebody who has already asked for a code has a six-digit
 * number sitting in their inbox with a ten-minute clock on it; a page that
 * says "start again" burns it and makes them request a second one, which
 * is also how people trip the rate limit and end up locked out for an
 * hour.
 *
 * So: retry first, and say plainly that the code they already have still
 * works. It renders inside the sign-in frame, so the college's identity,
 * the privacy notice and the support address are all still on screen.
 */
export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[auth] sign-in screen failed', error.digest ?? '(no digest)', error);
  }, [error]);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Badge tone="warning" dot>
          Sign-in interrupted
        </Badge>
        <h1 className="font-display text-display-sm font-bold">
          This step did not load — your place is not lost
        </h1>
        <p className="text-secondary">
          Something failed on the server while drawing the sign-in screen. Your account is fine and
          nothing about it has changed.
        </p>
      </header>

      <Alert
        tone="info"
        title="A code you have already been sent is still valid"
        icon={<KeyRound className="size-4" />}
      >
        <p>
          One-time codes last ten minutes and are not cancelled by this. If one is already in your
          inbox, retry below and type it in — asking for a second code invalidates the first and
          counts against the limit on how often you may request one.
        </p>
      </Alert>

      <div className="flex flex-wrap gap-2">
        <Button onClick={reset} size="lg">
          <RotateCw className="size-4" aria-hidden="true" />
          Try again
        </Button>
        <ButtonLink href="/login" variant="secondary" size="lg">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to sign in
        </ButtonLink>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex gap-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            <p className="text-sm text-secondary">
              Nothing was submitted, so this has not used one of your attempts. Attempts are counted
              when a code is checked, and no code was checked on this request.
            </p>
          </div>

          <dl className="divide-y divide-line border-t border-line pt-1">
            <DetailRow label="Reference">
              <span className="font-mono text-sm">{error.digest ?? 'not recorded'}</span>
            </DetailRow>
          </dl>

          <p className="flex items-start gap-2 border-t border-line pt-4 text-sm text-secondary">
            <LifeBuoy className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              If retrying does not clear it, the support address in the footer below reaches the
              alumni cell. Quote the reference and the email address you were signing in with — not
              the code itself, which is a credential and should never be sent to anyone.
            </span>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
