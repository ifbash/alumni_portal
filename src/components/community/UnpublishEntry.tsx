'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button, Dialog, Field, Textarea, describedBy, useToast } from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';

/**
 * Take a published entry down.
 *
 * The case this exists for: a featured person asks to be removed. It takes
 * a recorded reason (for the audit trail, not for the person) and happens
 * straight away. Nothing here argues with the request.
 */
export function UnpublishEntry({ slug, headline }: { slug: string; headline: string }) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const run = async () => {
    setPending(true);
    setError(null);
    const outcome = await api.patch(`/api/admin/showcase/${slug}`, { action: 'unpublish', message: reason.trim() });
    setPending(false);
    const t = outcomeToast(outcome, 'Taken down');
    if (t) toast.show(t);
    if (outcome.status === 'ok') {
      setOpen(false);
      if (outcome.persisted) router.refresh();
      return;
    }
    setError(outcome.message);
  };

  const short = reason.trim().length > 0 && reason.trim().length < 8;

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} className="min-h-11">
        Take down
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Take down “${headline}”`}
        description="It leaves the showcase straight away. Record why, for the audit trail."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void run()} loading={pending} disabled={reason.trim().length < 8}>
              Take down
            </Button>
          </>
        }
      >
        <Field htmlFor="unpublish-reason" label="Reason" required hint="For example: the featured person asked to be removed." error={short ? 'A few words, at least.' : (error ?? undefined)}>
          <Textarea id="unpublish-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={600} invalid={short} aria-describedby={describedBy('unpublish-reason', { hint: true, error: short || Boolean(error) })} />
        </Field>
      </Dialog>
    </>
  );
}
