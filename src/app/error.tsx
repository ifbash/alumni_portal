'use client';

import * as React from 'react';
import { Home, RotateCw, TriangleAlert } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui';
import { DetailLine, StatusPanel, TechnicalDetails } from '@/components/status/StatusPanel';

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
 *  3. **Carry the reference, out of the way.** `error.digest` is the id in
 *     the server logs. It lives under "Technical details": without it,
 *     every support conversation starts with "roughly when was that?", but
 *     it is not what a person came here to read.
 *
 * It is a client component — boundaries must be — so it cannot read the
 * tenant's brand pack. It does not need to: the band, the type and the
 * buttons all resolve through the tokens the root layout has already put
 * in the document head, so it is branded correctly for whichever college
 * this is without knowing which college this is.
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
    <main id="main" className="mx-auto flex min-h-dvh max-w-page items-center px-4 py-10 sm:px-8">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <StatusPanel
          icon={<TriangleAlert aria-hidden="true" />}
          eyebrow="Something went wrong"
          title="This page did not finish loading"
          actions={
            <>
              <Button variant="band" size="lg" onClick={reset}>
                <RotateCw className="size-4" aria-hidden="true" />
                Try again
              </Button>
              <ButtonLink href="/dashboard" variant="band-outline" size="lg">
                <Home className="size-4" aria-hidden="true" />
                Back to the portal
              </ButtonLink>
            </>
          }
        >
          <p>
            The portal failed on its own side while building this page. It is not something you did,
            and your session is untouched.
          </p>
          <p>
            Nothing you were working on was saved. Every change is checked before it is written, so
            a failure here means the write never started. If you were part-way through a form, try
            again and enter it once more.
          </p>
        </StatusPanel>

        <TechnicalDetails>
          <DetailLine label="Reference">{error.digest ?? 'not recorded'}</DetailLine>
          <p>
            If this keeps happening, send the alumni cell this reference, the page you were on and
            roughly when it happened. It is what they search the server logs on.
          </p>
        </TechnicalDetails>
      </div>
    </main>
  );
}
