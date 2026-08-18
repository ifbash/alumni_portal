'use client';

import * as React from 'react';
import { ChartNoAxesColumn, RotateCw, ScrollText, ShieldCheck, TriangleAlert } from 'lucide-react';
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
 * The staff console's error boundary.
 *
 * Same failure, different reader. An operator is mid-task on somebody
 * else's record and needs to know exactly one thing before they touch
 * anything else: whether the half-finished action landed. So this screen
 * is more specific than the member one — it names the write path, names
 * the audit log as the place to check, and says what the digest is for.
 *
 * It renders inside the console shell, so the queue, the register and the
 * audit log are all still one click away in the sidebar.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[console] page failed', error.digest ?? '(no digest)', error);
  }, [error]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Console error"
        title="This console screen failed to render"
        description="The server threw while building this page. The session, the tenant and your role grants are intact — this is a read that did not complete, not an authorisation refusal. A refusal says 403 and names the capability."
      />

      <Alert
        tone="warning"
        title="No mutation was applied"
        icon={<TriangleAlert className="size-4" />}
      >
        <p>
          Every admin action validates, guards and writes an <code className="font-mono">audit_log</code>{' '}
          row with a before and after snapshot before it returns. If an approval, a role change or an
          export had gone through, there would be a row for it — so the audit log is the answer to
          &ldquo;did that save?&rdquo;, not this page.
        </p>
      </Alert>

      <div className="flex flex-wrap gap-2">
        <Button onClick={reset}>
          <RotateCw className="size-4" aria-hidden="true" />
          Retry this screen
        </Button>
        <ButtonLink href="/admin" variant="secondary">
          <ChartNoAxesColumn className="size-4" aria-hidden="true" />
          Console home
        </ButtonLink>
        <ButtonLink href="/admin/audit" variant="ghost">
          <ScrollText className="size-4" aria-hidden="true" />
          Check the audit log
        </ButtonLink>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="space-y-1">
            <CardTitle as="h2">What to send when you report it</CardTitle>
            <CardDescription>
              The reference is the id the failure was logged under on the server. Without it the
              first question is always &ldquo;roughly when was that?&rdquo;.
            </CardDescription>
          </div>

          <dl className="divide-y divide-line">
            <DetailRow label="Reference">
              <span className="font-mono text-sm">{error.digest ?? 'not recorded'}</span>
            </DetailRow>
            <DetailRow label="Screen">
              <span className="text-sm text-secondary">
                Which console screen, and the filter or search you had applied — most console
                failures are query-shaped and only reproduce with the same parameters.
              </span>
            </DetailRow>
            <DetailRow label="Record">
              <span className="text-sm text-secondary">
                The roll number, claim id or member id you were working on, if it was a single
                record.
              </span>
            </DetailRow>
          </dl>

          <p className="flex items-start gap-2 border-t border-line pt-4 text-sm text-secondary">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Nothing was disclosed. A page that fails part-way through never sends a partial
              response body, so no member record left the server on this request.
            </span>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
