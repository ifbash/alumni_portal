'use client';

import * as React from 'react';
import { ArrowLeft, KeyRound, RotateCw } from 'lucide-react';
import { Badge, Button, ButtonLink } from '@/components/ui';
import { DetailLine, TechnicalDetails } from '@/components/status/StatusPanel';

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
 *
 * That frame already carries the band (the brand panel on desktop, the
 * identity strip on a phone), so this screen does not light a second one:
 * it is a raised card on the form column, with the college's colour in the
 * wash behind it and the key icon. One lit surface per screen.
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
    <div className="space-y-6">
      <section
        aria-labelledby="auth-error-title"
        className="ring-hairline stagger rounded-xl border border-line bg-surface-raised p-6 shadow-lg sm:p-8"
      >
        <div style={{ '--i': 0 } as React.CSSProperties}>
          <Badge tone="warning" dot>
            Sign-in interrupted
          </Badge>
        </div>
        <h1
          id="auth-error-title"
          className="mt-4 font-display text-display-sm font-bold tracking-tight"
          style={{ '--i': 1 } as React.CSSProperties}
        >
          This step did not load, and your place is not lost
        </h1>
        <p className="mt-3 text-secondary" style={{ '--i': 2 } as React.CSSProperties}>
          The server failed while drawing the sign-in screen. Your account is fine, nothing about it
          has changed, and nothing was submitted, so this has not used one of your attempts.
        </p>

        <p
          className="mt-5 flex items-start gap-3 rounded-lg bg-brand-soft p-4 text-sm text-brand-soft-fg"
          style={{ '--i': 3 } as React.CSSProperties}
        >
          <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">A code you have already been sent still works.</span> It
            lasts ten minutes and this does not cancel it. Try again and type it in. Asking for a
            second code cancels the first and counts against the limit on how often you can ask.
          </span>
        </p>

        <div
          className="mt-6 flex flex-wrap gap-3 [&>*]:min-h-12"
          style={{ '--i': 4 } as React.CSSProperties}
        >
          <Button onClick={reset} size="lg">
            <RotateCw className="size-4" aria-hidden="true" />
            Try again
          </Button>
          <ButtonLink href="/login" variant="secondary" size="lg">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to sign in
          </ButtonLink>
        </div>
      </section>

      <TechnicalDetails>
        <DetailLine label="Reference">{error.digest ?? 'not recorded'}</DetailLine>
        <p>
          If trying again does not clear it, the support address in the footer reaches the alumni
          cell. Quote this reference and the email address you were signing in with. Never send the
          code itself: it is a credential.
        </p>
      </TechnicalDetails>
    </div>
  );
}
