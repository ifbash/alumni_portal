'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, CheckCircle2, X } from 'lucide-react';

import { Button, Badge, Dialog, Field, describedBy, Textarea, Fieldset, Radio, useToast } from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';
import { cn } from '@/lib/cn';

/**
 * Approve, or reject with a reason. There is no third option and no silent
 * dismissal: a posting that leaves the queue leaves it with a decision
 * attached to a named person, because the poster is told what happened and
 * the audit log has to be able to answer "who decided this, and why".
 */

/** The board's policy: the Reject dialog and the queue's policy disclosure both show it. */
const MODERATION_POLICY = [
  'The employer is named. “A leading MNC” is not a name.',
  'The posting comes from the employer, not a staffing firm.',
  'No fee is asked of candidates, in any form.',
  'The apply link reaches the hiring team, not a sign-up form.',
] as const;

const REASONS = [
  {
    id: 'staffing',
    label: 'Third-party staffing listing, not a direct opening',
    text: 'Posting is a third-party staffing listing, not a direct opening. Placement cell policy is direct employers only.',
  },
  {
    id: 'unnamed',
    label: 'The employer is not named',
    text: 'The posting does not name the employer. Students cannot evaluate an opening at an unnamed company.',
  },
  {
    id: 'fee',
    label: 'Candidates are asked to pay a fee',
    text: 'The role asks the candidate for a registration, training or certification fee. Never permitted on this board.',
  },
  {
    id: 'duplicate',
    label: 'Duplicate of a posting already live',
    text: 'This opening is already live on the board. Close the older posting first if the details have changed.',
  },
  {
    id: 'other',
    label: 'Something else — write it below',
    text: '',
  },
] as const;

type ReasonId = (typeof REASONS)[number]['id'];

export function ModerationActions({
  jobId,
  jobTitle,
  company,
  posterName,
  precedent = null,
  rejectLabel = 'Reject',
  className,
}: {
  jobId: string;
  jobTitle: string;
  company: string;
  posterName: string;
  /** The wording the last rejection on this board used, shown inside the Reject dialog. */
  precedent?: string | null;
  rejectLabel?: string;
  className?: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [decision, setDecision] = React.useState<{
    action: 'approved' | 'rejected';
    note: string;
    /** The reason as the poster receives it. Null on an approval. */
    reasonText: string | null;
    persisted: boolean;
  } | null>(null);
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState<ReasonId | null>(null);
  const [note, setNote] = React.useState('');
  const [pending, setPending] = React.useState<'approve' | 'reject' | null>(null);
  const [refusal, setRefusal] = React.useState<string | null>(null);

  const chosen = REASONS.find((r) => r.id === reason) ?? null;
  const finalText = reason === 'other' ? note.trim() : chosen?.text ?? '';
  const blocked = !reason || (reason === 'other' && note.trim().length < 12);
  const noteShort = note.trim().length > 0 && note.trim().length < 12;

  /**
   * Approve or reject, both through the same guarded endpoint. A rejection
   * carries the reason as its note: the route refuses one without it, and
   * the poster is sent exactly what is typed here — "rejected, no reason"
   * is why an alumnus stops posting.
   */
  const moderate = async (action: 'approve' | 'reject') => {
    setPending(action);
    setRefusal(null);

    const result = await api.post<{ note: string }>(`/api/jobs/${jobId}/moderate`, {
      action,
      ...(action === 'reject' ? { note: finalText } : {}),
    });

    setPending(null);

    const t = outcomeToast(
      result,
      action === 'approve' ? `${jobTitle} is live` : 'Posting rejected',
    );
    if (t) toast.show(t);

    if (result.status !== 'ok') {
      setRefusal(result.message);
      return;
    }

    setOpen(false);
    setDecision({
      action: action === 'approve' ? 'approved' : 'rejected',
      note: result.data.note,
      reasonText: action === 'reject' ? finalText : null,
      persisted: result.persisted,
    });

    // Only when the state actually changed. Refreshing over a write that
    // did not persist redraws the queue exactly as it was, which reads as
    // the decision having been ignored.
    if (result.persisted) router.refresh();
  };

  if (decision) {
    return (
      <div className={cn('min-w-0 space-y-2', className)} role="status">
        <div className="flex flex-wrap items-center gap-2">
          {decision.persisted ? (
            <Badge tone={decision.action === 'approved' ? 'success' : 'danger'} dot>
              {decision.action === 'approved' ? 'Approved' : 'Rejected'}
            </Badge>
          ) : (
            <Badge tone="neutral">Not saved</Badge>
          )}
          {decision.persisted ? <p className="text-sm text-secondary">{decision.note}</p> : null}
        </div>
        {decision.reasonText ? (
          <p className="max-w-prose text-sm text-secondary">
            <span className="font-medium text-primary">Reason: </span>
            {decision.reasonText}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className={cn('flex flex-wrap items-center justify-end gap-2', className)}>
        {refusal ? (
          <p role="alert" className="w-full text-sm font-medium text-danger-fg">
            {refusal}
          </p>
        ) : null}

        <Button variant="secondary" onClick={() => setOpen(true)} disabled={pending !== null} className="min-h-11 sm:min-h-0">
          <X className="size-4" aria-hidden="true" />
          {rejectLabel}
        </Button>

        <Button onClick={() => void moderate('approve')} loading={pending === 'approve'} className="min-h-11 sm:min-h-0">
          <Check className="size-4" aria-hidden="true" />
          Approve and publish
        </Button>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Reject this posting"
        description={`${jobTitle} at ${company}. ${posterName} reads the reason you choose.`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={blocked}
              loading={pending === 'reject'}
              onClick={() => void moderate('reject')}
            >
              Reject with this reason
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-line bg-surface p-4">
            <p className="text-sm font-medium text-primary">The board’s policy</p>
            <ModerationPolicy className="mt-2" />
          </div>

          <Fieldset legend="Reason" hint="The most specific one is the most useful.">
            {REASONS.map((r) => (
              <Radio
                key={r.id}
                id={`reject-${jobId}-${r.id}`}
                name={`reject-${jobId}`}
                label={r.label}
                hint={r.text || undefined}
                checked={reason === r.id}
                onChange={() => setReason(r.id)}
              />
            ))}
          </Fieldset>

          {reason === 'other' ? (
            <Field
              htmlFor={`reject-note-${jobId}`}
              label="What is wrong with it"
              required
              hint="Sent to the poster as written. At least a sentence."
              error={noteShort ? 'Give the poster something they can act on.' : undefined}
            >
              <Textarea
                id={`reject-note-${jobId}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder="e.g. The salary and the location contradict the description. Resubmit with the correct details."
                invalid={noteShort}
                aria-describedby={describedBy(`reject-note-${jobId}`, { hint: true, error: noteShort })}
              />
            </Field>
          ) : null}

          {precedent ? (
            <figure className="space-y-1.5">
              <figcaption className="text-xs font-medium text-secondary">The last rejection on this board said</figcaption>
              <blockquote className="rounded border-l-2 border-line-strong bg-surface-sunken px-3 py-2 text-sm text-secondary">
                {precedent}
              </blockquote>
            </figure>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}

/** The policy as a checklist. A client leaf, so a server page can render it too. */
export function ModerationPolicy({ className }: { className?: string }) {
  return (
    <ul className={cn('space-y-1.5 text-sm text-secondary', className)}>
      {MODERATION_POLICY.map((rule) => (
        <li key={rule} className="flex gap-2">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
          <span>{rule}</span>
        </li>
      ))}
    </ul>
  );
}
