'use client';

import * as React from 'react';
import { Building2, Palette, RotateCw, ShieldCheck, TriangleAlert } from 'lucide-react';
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
 * The vendor console's error boundary.
 *
 * The reader is us, not a customer, so this is the one boundary that can
 * assume the audience can act on what it says. The useful facts are which
 * blast radius applies — a failure in the platform console is a failure in
 * one tenant's provisioning view, never in the colleges themselves — and
 * the digest to grep the logs on.
 */
export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[platform] page failed', error.digest ?? '(no digest)', error);
  }, [error]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform console"
        title="This provisioning screen failed"
        description="The server threw while rendering. Tenants keep serving their own members from their own routes — nothing under this console sits in a college's request path."
      />

      <Alert
        tone="warning"
        title="No tenant was created, suspended or re-pointed"
        icon={<TriangleAlert className="size-4" />}
      >
        <p>
          Provisioning validates and writes in one step, so a render that did not finish did not
          leave a half-made tenant behind. Confirm against the tenant list before retrying anything
          you had started.
        </p>
      </Alert>

      <div className="flex flex-wrap gap-2">
        <Button onClick={reset}>
          <RotateCw className="size-4" aria-hidden="true" />
          Retry this screen
        </Button>
        <ButtonLink href="/platform" variant="secondary">
          <Building2 className="size-4" aria-hidden="true" />
          Tenant list
        </ButtonLink>
        <ButtonLink href="/platform/brands" variant="ghost">
          <Palette className="size-4" aria-hidden="true" />
          Brand packs
        </ButtonLink>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="space-y-1">
            <CardTitle as="h2">Where to look</CardTitle>
            <CardDescription>
              A brand pack that fails contrast validation is the most common cause of a render
              failure in here, and it names the token it failed on.
            </CardDescription>
          </div>

          <dl className="divide-y divide-line">
            <DetailRow label="Reference">
              <span className="font-mono text-sm">{error.digest ?? 'not recorded'}</span>
            </DetailRow>
            <DetailRow label="First check">
              <span className="text-sm text-secondary">
                <code className="font-mono">npm run brand:check</code> against the pack this tenant
                points at — contrast errors block publication and surface here as a failed derive.
              </span>
            </DetailRow>
          </dl>

          <p className="flex items-start gap-2 border-t border-line pt-4 text-sm text-secondary">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Running the platform is not a reason to read inside a college. This console holds no
              member rows, so nothing about a member was involved in this failure.
            </span>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
