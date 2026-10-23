'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button, ConfirmDialog, useToast } from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';

/** The owner closing their own listing. Reversible only by resubmitting, so it asks first. */
export function CloseListingButton({ slug, name }: { slug: string; name: string }) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const close = async () => {
    setPending(true);
    setError(null);
    const outcome = await api.patch(`/api/businesses/${slug}`, { action: 'close' });
    setPending(false);
    const t = outcomeToast(outcome, `${name} closed`);
    if (t) toast.show(t);
    if (outcome.status === 'ok') {
      setOpen(false);
      if (outcome.persisted) router.refresh();
      return;
    }
    setError(outcome.message);
  };

  return (
    <>
      <Button type="button" variant="ghost" onClick={() => setOpen(true)} className="min-h-11">
        Close this listing
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => void close()}
        pending={pending}
        tone="danger"
        confirmLabel="Close listing"
        title={`Close ${name}?`}
        body={
          <div className="space-y-2">
            <p>It leaves the directory straight away. To list it again you send it for review as a new submission.</p>
            {error ? <p role="alert" className="font-medium text-danger-fg">{error}</p> : null}
          </div>
        }
      />
    </>
  );
}
