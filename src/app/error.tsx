'use client';

import * as React from 'react';
import { RotateCw, TriangleAlert, LifeBuoy, Home } from 'lucide-react';
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
 * The application error boundary.
 *
 * Three things this screen has to do, in order:
 *
 *  1. **Say what is true.** Something on the server failed. Not "oops",
 *     not a cartoon. A portal a college is paying for should sound like a
 *     colleague telling you what happened.
 *  2. **Say what was and was not saved.** The most useful sentence on an
 *     error page is the one that stops someone re-submitting a form four
 *     times. Every mutation in this app validates before it writes, so
 *     "nothing was saved" is a claim we can actually make.
 *  3. **Carry the reference.** `error.digest` is the id in the server
 *     logs. Without it on screen, every support conversation starts with
 *     "roughly when was that?".
 *
 * It is a client component — boundaries must be — so it cannot read the
 * tenant's brand pack. It does not need to: every colour, radius and font
 * here resolves through the tokens the root layout has already put in the
 * document head, so it is branded correctly for whichever college this is
 * without knowing which college this is.
 */

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // The server log has the stack; the browser console gets the digest so
    // the two can be lined up from either end.
    console.error('[portal] render failed', error.digest ?? '(no digest)', error);
  }, [error]);

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-page items-center px-4 py-section sm:px-8">
      <div className="mx-auto w-full max-w-prose space-y-6 animate-fade-up">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-fg">
            Something broke
          </p>
          <h1 className="font-display text-display-xs font-bold">
            This page did not finish loading
          </h1>
          <p className="text-sm text-secondary">
            A request to the portal failed on the server. It is not something you did, and it is not
            a permissions problem — those say so explicitly.
          </p>
        </div>

        <Alert
          tone="warning"
          title="Nothing you were working on was saved"
          icon={<TriangleAlert className="size-4" />}
        >
          Every change in the portal is validated before it is written, so a failure at this point
          means the write never started. If you were part-way through a form, reload and enter it
          again rather than assuming half of it went through.
        </Alert>

        <div className="flex flex-wrap gap-2">
          <Button onClick={reset}>
            <RotateCw className="size-4" />
            Try again
          </Button>
          <ButtonLink href="/dashboard" variant="secondary">
            <Home className="size-4" />
            Back to the portal
          </ButtonLink>
        </div>

        <Card>
          <CardBody className="space-y-4">
            <div className="space-y-1">
              <CardTitle as="h2">If it keeps happening</CardTitle>
              <CardDescription>
                Send the alumni cell the reference below and what you were doing. It is the
                fastest thing they can search the server logs on.
              </CardDescription>
            </div>

            <dl className="divide-y divide-line">
              <DetailRow label="Reference">
                <span className="font-mono text-sm">{error.digest ?? 'not recorded'}</span>
              </DetailRow>
              <DetailRow label="What to include">
                <span className="text-sm text-secondary">
                  The page you were on, the roll number or record you were looking at, and roughly
                  when.
                </span>
              </DetailRow>
            </dl>

            <p className="flex items-start gap-2 text-sm text-secondary">
              <LifeBuoy className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                Your session is untouched — you are still signed in, and nothing about your profile
                or your connections has changed.
              </span>
            </p>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
