'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Ban, CircleCheck, Landmark, Lock, Play, ScrollText, Trash2 } from 'lucide-react';

import type { DataRequest } from '@/lib/data/types';
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  Textarea,
  useToast,
} from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';

import { KIND_LABEL, STATE_LABEL, STATE_TONE } from './dpdp';

/**
 * The three things a fulfilment officer can do to a request.
 *
 * The only interactive leaf on the page — the detail screen around it
 * stays a server component, so none of the request data or the
 * authorisation that produced it crosses into the bundle. Everything this
 * component knows arrives as props, and every decision is made by
 * `PATCH /api/data-requests/[id]` behind `data_request.manage`.
 *
 * Three decisions worth keeping:
 *
 *  - Refusal demands a written reason before the button enables. A member
 *    is entitled to be told why, and “not possible” is not a why. Making
 *    the field optional guarantees it stays empty.
 *  - Erasure demands the word typed out. It is the one action here that a
 *    database restore is the only way back from.
 *  - Nothing moves on screen until the server has answered. An optimistic
 *    tick over a hard delete that was refused is the worst possible lie to
 *    tell an operator working a statutory queue, so the state changes once
 *    and only from the endpoint's reply.
 */

interface Props {
  id: string;
  memberName: string;
  kind: DataRequest['kind'];
  state: DataRequest['state'];
  /** “Overdue by 3 days”, “Due in 12 days” — repeated in the confirmation. */
  dueLabel: string;
  overdue: boolean;
}

const MIN_REASON = 15;

interface RetentionRecord {
  erased: string[];
  retained: Array<{ table: string; what: string; why: string }>;
  note: string;
}

interface PatchResult {
  ok: boolean;
  request: {
    id: string;
    kind: DataRequest['kind'];
    state: DataRequest['state'];
    fulfilledAt: string | null;
  };
  retention: RetentionRecord | null;
  note: string;
}

type Pending = 'start' | 'fulfil' | 'refuse' | null;

export function RequestActions({ id, memberName, kind, state: initialState, dueLabel, overdue }: Props) {
  const toast = useToast();
  const router = useRouter();

  const [state, setState] = React.useState<DataRequest['state']>(initialState);
  const [confirmFulfil, setConfirmFulfil] = React.useState(false);
  const [refusing, setRefusing] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [pending, setPending] = React.useState<Pending>(null);
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [refusal, setRefusal] = React.useState<{ denied: boolean; message: string } | null>(null);
  const [outcome, setOutcome] = React.useState<{ note: string; retention: RetentionRecord | null } | null>(
    null,
  );

  // A refresh that actually re-read the queue brings the real state back
  // down as a prop; the local copy follows it rather than arguing with it.
  React.useEffect(() => setState(initialState), [initialState]);

  const open = state === 'received' || state === 'in_progress';
  const isErasure = kind === 'deletion';
  const reasonTooShort = reason.trim().length < MIN_REASON;

  async function act(action: 'start' | 'fulfil' | 'refuse', body: Record<string, unknown>, successTitle: string) {
    if (pending) return;
    setPending(action);
    setRefusal(null);
    setReasonError(null);

    const result = await api.patch<PatchResult>(`/api/data-requests/${id}`, { action, ...body });
    setPending(null);

    if (result.status !== 'ok') {
      const failed = outcomeToast(result, successTitle);
      if (failed) toast.show(failed);

      if (result.status === 'invalid') {
        // A 422 lands on the field that caused it, not only in a toast.
        const onReason = result.fieldErrors.reason ?? null;
        setReasonError(onReason);
        if (!onReason) setRefusal({ denied: false, message: result.message });
        return;
      }

      setRefusal({ denied: result.status === 'denied', message: result.message });
      return;
    }

    // The server's word for what happened, not this component's guess.
    setState(result.data.request.state);
    setOutcome({ note: result.data.note, retention: result.data.retention });
    setConfirmFulfil(false);
    setRefusing(false);
    if (action === 'refuse') setReason('');

    const t = outcomeToast(result, successTitle);
    if (t) toast.show(t);

    // Only when something was actually stored. Refreshing a fixture run
    // would pull the seeded state back over the change and read as the
    // action having silently failed.
    if (result.persisted) router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-secondary">Current state</span>
        <Badge tone={STATE_TONE[state]} dot>
          {STATE_LABEL[state]}
        </Badge>
      </div>

      {open ? (
        <div className="flex flex-col gap-2">
          {state === 'received' ? (
            <Button
              onClick={() => void act('start', {}, 'Marked in progress')}
              loading={pending === 'start'}
              disabled={pending !== null}
            >
              <Play className="size-4" aria-hidden="true" />
              Start work on this
            </Button>
          ) : (
            <Button
              variant={isErasure ? 'danger' : 'primary'}
              onClick={() => setConfirmFulfil(true)}
              disabled={pending !== null}
            >
              {isErasure ? (
                <Trash2 className="size-4" aria-hidden="true" />
              ) : (
                <CircleCheck className="size-4" aria-hidden="true" />
              )}
              {isErasure ? 'Erase this member’s record' : 'Mark fulfilled'}
            </Button>
          )}

          <Button variant="secondary" onClick={() => setRefusing(true)} disabled={pending !== null}>
            <Ban className="size-4" aria-hidden="true" />
            Refuse with a reason
          </Button>

          <p className="text-xs text-muted">
            Whichever you choose is written to <span className="font-mono">audit_log</span> with your
            name, this request id and the reason — before the member is notified, not after.
          </p>
        </div>
      ) : (
        <p className="rounded border border-line bg-surface-sunken p-3 text-sm text-secondary">
          {state === 'fulfilled'
            ? 'This request is answered and the statutory clock has stopped. Reopening it is not possible — a member who wants more raises a fresh request, which starts a fresh window.'
            : 'This request was refused. The reason given to the member is part of the permanent record and cannot be edited after the fact.'}
        </p>
      )}

      {refusal ? (
        <Alert
          tone="danger"
          title={refusal.denied ? 'This queue is not yours to act on' : 'That did not go through'}
          icon={<Lock className="size-4" aria-hidden="true" />}
        >
          <p>{refusal.message}</p>
          {refusal.denied ? (
            <p className="mt-2">
              Acting on a subject-rights request needs{' '}
              <span className="font-mono">data_request.manage</span>, which the college admin holds.
              It is deliberately not <span className="font-mono">tenant.configure</span> — the
              vendor’s platform admin holds that one, and this queue names members alongside what
              they have asked to have erased. Nothing on this request has changed.
            </p>
          ) : null}
        </Alert>
      ) : null}

      {outcome ? (
        <div className="space-y-3">
          <Alert
            tone={state === 'refused' ? 'neutral' : 'success'}
            title={STATE_LABEL[state]}
            icon={<ScrollText className="size-4" aria-hidden="true" />}
          >
            <p>{outcome.note}</p>
          </Alert>

          {outcome.retention ? (
            <div className="space-y-3 rounded-lg border border-[color-mix(in_srgb,var(--danger)_40%,var(--border))] bg-danger-soft p-4 text-sm text-danger-fg">
              <p className="flex items-center gap-2 font-semibold">
                <Landmark className="size-4" aria-hidden="true" />
                Kept, and recorded as an exception
              </p>
              <dl className="space-y-2">
                {outcome.retention.retained.map((row) => (
                  <div key={row.table}>
                    <dt className="font-mono text-xs">{row.table}</dt>
                    <dd>
                      {row.what} — {row.why}
                    </dd>
                  </div>
                ))}
              </dl>
              <p>{outcome.retention.note}</p>
              <p className="text-xs">
                Everything else went:{' '}
                <span className="font-mono">{outcome.retention.erased.join(', ')}</span>.{' '}
                {memberName} is told exactly this, in writing, in the same reply.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmFulfil}
        onClose={() => {
          if (!pending) setConfirmFulfil(false);
        }}
        onConfirm={() =>
          void act(
            'fulfil',
            // Sent only for an erasure, and only from the dialog that just
            // showed the exception. It is what the audit entry records as
            // having been acknowledged, by name.
            isErasure ? { acknowledgedRetention: true } : {},
            isErasure ? 'Erasure recorded' : 'Request fulfilled',
          )
        }
        pending={pending === 'fulfil'}
        tone={isErasure ? 'danger' : 'primary'}
        title={isErasure ? `Erase ${memberName}’s record` : `Fulfil this ${KIND_LABEL[kind].toLowerCase()}`}
        confirmLabel={isErasure ? 'Erase permanently' : 'Mark fulfilled'}
        requireTyped={isErasure ? 'ERASE' : undefined}
        body={
          isErasure ? (
            <div className="space-y-3">
              <p className="text-primary">
                This is a hard delete, not a hidden flag. The member row, contact rows, photo,
                message history and every connection they were part of are removed. There is no
                undo — recovery means restoring the database.
              </p>
              <p className="rounded border border-[color-mix(in_srgb,var(--danger)_40%,var(--border))] bg-danger-soft p-3 text-danger-fg">
                <strong className="block">Two things are kept, and you cannot waive them.</strong>
                Donations, 80G receipts and any contribution reportable under FCRA stay for their
                statutory retention period — an erasure that removed them would put the trust’s
                registration at risk. The audit trail also stays, in reduced form: actor, action and
                timestamp, with the personal fields stripped. An erasure that erases its own record
                cannot be proven to have happened. The endpoint enforces both and names them back on
                this screen the moment it is done; there is no parameter that turns them off.
              </p>
              <p>
                {memberName} is told exactly this, in writing, when the erasure completes. {dueLabel}.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-primary">
                Confirm that the response has actually gone to {memberName} — this marks the
                statutory clock as stopped, and a request marked fulfilled without an answer being
                sent is the version of this failure nobody notices for a year.
              </p>
              <p>{overdue ? `${dueLabel}. Record why it slipped in the audit reason.` : dueLabel}</p>
            </div>
          )
        }
      />

      <Dialog
        open={refusing}
        onClose={() => {
          if (!pending) setRefusing(false);
        }}
        title="Refuse this request"
        description="A refusal is lawful in some cases and always has to be explained. The member sees your words verbatim."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRefusing(false)} disabled={pending !== null}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void act('refuse', { reason: reason.trim() }, 'Request refused')}
              disabled={reasonTooShort}
              loading={pending === 'refuse'}
            >
              Refuse and notify
            </Button>
          </>
        }
      >
        <Field
          htmlFor="refusal-reason"
          label="Reason for refusal"
          required
          hint="Written to the audit log and sent to the member as-is."
          error={
            reasonError ??
            (reason.length > 0 && reasonTooShort
              ? 'Give a reason a person can act on — at least a sentence.'
              : null)
          }
          notice="Refusing an access request is only defensible on narrow grounds: the request is not from the data principal, it is repetitive, or answering it would disclose another member's personal data. Volume of work is not a ground."
        >
          <Textarea
            id="refusal-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (reasonError) setReasonError(null);
            }}
            invalid={Boolean(reasonError) || (reason.length > 0 && reasonTooShort)}
            disabled={pending === 'refuse'}
            placeholder="We could not match this request to the account holder — the mobile number on file does not match the one used to raise it. Please raise it again from your registered account."
          />
        </Field>
      </Dialog>
    </div>
  );
}
