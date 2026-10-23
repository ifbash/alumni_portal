'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';

import { Badge, Button, ConfirmDialog, Dialog, Field, Textarea, describedBy, useToast } from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';

/**
 * Approve or decline, for the queues that have exactly those two outcomes:
 * a member's event proposal, a business listing, an achievement waiting to
 * be featured.
 *
 * One component so the three queues behave identically, and so a rule that
 * matters in one (a refusal always carries a reason the person reads) cannot
 * be forgotten in another. The endpoint decides what each outcome means; the
 * body is always `{ action: 'approve' }` or `{ action: 'decline', message }`.
 *
 * Declining requires a sentence. A decision that leaves a queue without an
 * explanation is a member who assumes they were ignored, and who does not
 * come back.
 */

const MIN_REASON = 12;

export function DecisionActions({
  endpoint,
  subject,
  recipient,
  approveLabel = 'Approve',
  declineLabel = 'Decline',
  approveConfirm,
  declineHint = 'Say what would make it workable. The person reads this as written.',
  quickReasons = [],
  approvedTitle,
  declinedTitle,
  approveDisabledReason,
}: {
  endpoint: string;
  /** What is being decided, for the toasts: “Batch of 2016 reunion”. */
  subject: string;
  /** Who reads a refusal, for the line under it: “Priya”, or “the proposer”. */
  recipient: string;
  approveLabel?: string;
  declineLabel?: string;
  /** When set, approving asks first, with this as the body. */
  approveConfirm?: React.ReactNode;
  declineHint?: string;
  /** Common reasons, offered as one-tap starting points the reviewer can edit. */
  quickReasons?: Array<{ label: string; text: string }>;
  approvedTitle?: string;
  declinedTitle?: string;
  /** When set, approving is not possible yet, and this says why. */
  approveDisabledReason?: string | null;
}) {
  const toast = useToast();
  const router = useRouter();

  const [declineOpen, setDeclineOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [pending, setPending] = React.useState<'approve' | 'decline' | null>(null);
  const [refusal, setRefusal] = React.useState<string | null>(null);
  const [settled, setSettled] = React.useState<{ kind: 'approve' | 'decline'; note: string; message: string | null; persisted: boolean } | null>(null);

  const tooShort = message.trim().length > 0 && message.trim().length < MIN_REASON;
  const blocked = message.trim().length < MIN_REASON;

  const decide = async (kind: 'approve' | 'decline') => {
    setPending(kind);
    setRefusal(null);

    const result = await api.patch<{ note: string }>(
      endpoint,
      kind === 'approve' ? { action: 'approve' } : { action: 'decline', message: message.trim() },
    );
    setPending(null);

    const t = outcomeToast(result, kind === 'approve' ? (approvedTitle ?? `${subject} approved`) : (declinedTitle ?? `${subject} declined`));
    if (t) toast.show(t);

    if (result.status !== 'ok') {
      setRefusal(result.message);
      return;
    }

    setConfirmOpen(false);
    setDeclineOpen(false);
    setSettled({
      kind,
      note: result.data.note,
      message: kind === 'decline' ? message.trim() : null,
      persisted: result.persisted,
    });
    // Only when the decision landed; refreshing over a write that did not
    // persist would redraw the queue as it was and read as being ignored.
    if (result.persisted) router.refresh();
  };

  if (settled) {
    return (
      <div className="min-w-0 space-y-2 border-t border-line pt-3" role="status">
        <Badge tone={!settled.persisted ? 'neutral' : settled.kind === 'approve' ? 'success' : 'danger'} dot={settled.persisted}>
          {!settled.persisted ? 'Not saved' : settled.kind === 'approve' ? 'Approved' : 'Declined'}
        </Badge>
        {settled.persisted ? <p className="text-sm text-secondary">{settled.note}</p> : null}
        {settled.message ? (
          <p className="max-w-prose text-sm text-secondary">
            <span className="font-medium text-primary">To {recipient}: </span>
            {settled.message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
        {refusal ? (
          <p role="alert" className="mr-auto text-sm font-medium text-danger-fg">
            {refusal}
          </p>
        ) : null}
        {approveDisabledReason ? <p className="mr-auto text-sm text-secondary">{approveDisabledReason}</p> : null}
        <Button variant="ghost" onClick={() => setDeclineOpen(true)} disabled={pending !== null} className="min-h-11 sm:min-h-0">
          <X className="size-4" aria-hidden="true" />
          {declineLabel}
        </Button>
        <Button
          onClick={() => (approveConfirm ? setConfirmOpen(true) : void decide('approve'))}
          loading={pending === 'approve'}
          disabled={pending !== null || Boolean(approveDisabledReason)}
          className="min-h-11 sm:min-h-0"
        >
          <Check className="size-4" aria-hidden="true" />
          {approveLabel}
        </Button>
      </div>

      {approveConfirm ? (
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => void decide('approve')}
          pending={pending === 'approve'}
          tone="primary"
          confirmLabel={approveLabel}
          title={`${approveLabel}: ${subject}?`}
          body={approveConfirm}
        />
      ) : null}

      <Dialog
        open={declineOpen}
        onClose={() => setDeclineOpen(false)}
        title={`${declineLabel}: ${subject}`}
        description={`${recipient[0]!.toUpperCase()}${recipient.slice(1)} reads this exactly as you write it.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeclineOpen(false)} disabled={pending === 'decline'}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void decide('decline')} loading={pending === 'decline'} disabled={blocked}>
              {declineLabel}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {quickReasons.length > 0 ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Common reasons">
              {quickReasons.map((r) => (
                <Button key={r.label} type="button" size="sm" variant="secondary" onClick={() => setMessage(r.text)}>
                  {r.label}
                </Button>
              ))}
            </div>
          ) : null}
          <Field
            htmlFor="decline-message"
            label="Reason"
            required
            hint={declineHint}
            error={tooShort ? `A sentence of at least ${MIN_REASON} characters, so it is something they can act on.` : undefined}
          >
            <Textarea
              id="decline-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={1200}
              invalid={tooShort}
              aria-describedby={describedBy('decline-message', { hint: true, error: tooShort })}
            />
          </Field>
          {refusal ? (
            <p role="alert" className="text-sm font-medium text-danger-fg">
              {refusal}
            </p>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
