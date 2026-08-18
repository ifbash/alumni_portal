'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, ShieldCheck } from 'lucide-react';

import {
  Button,
  Badge,
  Dialog,
  Field,
  describedBy,
  Textarea,
  Fieldset,
  Radio,
  Alert,
  useToast,
} from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';

/**
 * Approve, or reject with a reason. There is no third option and no silent
 * dismissal: a posting that leaves the queue leaves it with a decision
 * attached to a named person, because the poster is told what happened and
 * the audit log has to be able to answer "who decided this, and why".
 */

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
}: {
  jobId: string;
  jobTitle: string;
  company: string;
  posterName: string;
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
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={decision.action === 'approved' ? 'success' : 'danger'} dot>
            {decision.action === 'approved' ? 'Approved' : 'Rejected'}
          </Badge>
          <p className="text-sm text-secondary">{decision.note}</p>
        </div>

        {decision.reasonText ? (
          <p className="max-w-prose rounded border border-line bg-surface-sunken p-3 text-sm">
            {decision.reasonText}
          </p>
        ) : null}

        <p className="text-xs text-muted">
          In the audit log as <code className="font-mono text-xs">job.{decision.action === 'approved' ? 'approve' : 'reject'}</code>{' '}
          against your name, with the before and after state of the posting.
          {decision.persisted
            ? ''
            : ' Recorded on this screen only — this build has no database behind it, so the posting itself is unchanged and nothing has reached ' +
              posterName +
              '.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="mr-auto max-w-prose text-xs text-muted">
        Both decisions are recorded against your name with the posting&rsquo;s before and after state. {posterName} is
        told either way; a rejection sends them your reason verbatim.
      </p>

      {refusal ? (
        <p role="alert" className="w-full text-xs font-medium text-danger-fg">
          {refusal}
        </p>
      ) : null}

      <Button variant="secondary" onClick={() => setOpen(true)} disabled={pending !== null}>
        <X className="size-4" aria-hidden="true" />
        Reject
      </Button>

      <Button onClick={() => void moderate('approve')} loading={pending === 'approve'}>
        <Check className="size-4" aria-hidden="true" />
        Approve and publish
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Reject this posting"
        description={`${jobTitle} at ${company}, posted by ${posterName}.`}
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
              Reject and notify
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Alert tone="info" title="The poster reads this">
            <p>
              A rejection without a reason reads as the college losing the submission. Pick the rule it breaks; the
              wording below is what {posterName} receives.
            </p>
          </Alert>

          <Fieldset legend="Reason" hint="One reason is enough. The most specific one is the most useful.">
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
              hint="Written to the poster as-is. At least a sentence."
              error={note.trim().length > 0 && note.trim().length < 12 ? 'Give the poster something they can act on.' : undefined}
            >
              <Textarea
                id={`reject-note-${jobId}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder="The salary range and the location contradict the description. Resubmit with the correct details."
                invalid={note.trim().length > 0 && note.trim().length < 12}
                aria-describedby={describedBy(`reject-note-${jobId}`, {
                  hint: true,
                  error: note.trim().length > 0 && note.trim().length < 12,
                })}
              />
            </Field>
          ) : null}

          <p className="flex items-start gap-2 text-xs text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              The decision, your name and this reason are written to the audit log. Rejections are not deletions — the
              posting stays on file and the poster can resubmit a corrected version.
            </span>
          </p>
        </div>
      </Dialog>
    </>
  );
}
