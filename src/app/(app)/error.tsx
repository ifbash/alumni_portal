'use client';

import * as React from 'react';
import { Home, LifeBuoy, RotateCw, TriangleAlert, User } from 'lucide-react';
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardTitle,
  DetailRow,
  PageHeader,
} from '@/components/ui';

/**
 * The member portal's error boundary.
 *
 * It renders inside the shell — the sidebar, the top bar and the account
 * menu are all still there, because the boundary sits below the layout
 * that draws them. That is the single most reassuring fact available on
 * this screen, so the copy leans on it: one page failed, the portal did
 * not.
 *
 * Plain language, no jargon. The reader is an alumnus on a phone, not an
 * operator. The only technical thing on the page is the digest, and it is
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
      <PageHeader
        eyebrow="Something broke"
        title="This page did not load"
        description="A request to the portal failed on the server. It is not something you did, and it is not a permissions problem — the portal says so plainly when it is."
      />

      <Alert
        tone="warning"
        title="Nothing you were part-way through was saved"
        icon={<TriangleAlert className="size-4" />}
      >
        Every change is checked before it is written, so a failure here means the write never
        started. If you were filling in a form, open it again and re-enter it rather than assuming
        half of it went through.
      </Alert>

      <div className="flex flex-wrap gap-2">
        <Button onClick={reset}>
          <RotateCw className="size-4" aria-hidden="true" />
          Try this page again
        </Button>
        <ButtonLink href="/dashboard" variant="secondary">
          <Home className="size-4" aria-hidden="true" />
          Back to the portal
        </ButtonLink>
        <ButtonLink href="/profile" variant="ghost">
          <User className="size-4" aria-hidden="true" />
          My profile
        </ButtonLink>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="space-y-1">
            <CardTitle as="h2">If it happens again</CardTitle>
            <CardDescription>
              Send the alumni cell the reference below with a line about what you were doing. It is
              the fastest thing they can search the server logs on.
            </CardDescription>
          </div>

          <dl className="divide-y divide-line">
            <DetailRow label="Reference">
              <span className="font-mono text-sm">{error.digest ?? 'not recorded'}</span>
            </DetailRow>
            <DetailRow label="What to include">
              <span className="text-sm text-secondary">
                The page you were on, the person or event you were looking at, and roughly when.
              </span>
            </DetailRow>
          </dl>

          <p className="flex items-start gap-2 border-t border-line pt-4 text-sm text-secondary">
            <LifeBuoy className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              You are still signed in. Your profile, your connections and anything you have already
              saved are untouched — the rest of the portal is working, and the links in the sidebar
              still go where they say.
            </span>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
