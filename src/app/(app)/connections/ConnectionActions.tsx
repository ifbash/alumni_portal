'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ban, Check, CircleCheck, Undo2, X } from 'lucide-react';
import { Button, ConfirmDialog, useToast } from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';
import { cn } from '@/lib/cn';

/**
 * The decision buttons on a connection request.
 *
 * This is the only interactive leaf on the connections screen — the page
 * around it stays a server component. Four things are deliberate:
 *
 *  1. **Blocking asks for confirmation.** Accepting and declining are
 *     ordinary; blocking closes a door that a student cannot reopen, and
 *     the dialog says so in those words.
 *  2. **The outcome replaces the buttons in place.** A row that keeps its
 *     controls after a decision invites a second click on a decision that
 *     has already been made.
 *  3. **The decision shows before the server answers, and comes back if
 *     the server refuses.** A connection decision is one click on a row
 *     among several; waiting on a spinner for each one makes clearing an
 *     inbox feel broken. But an optimistic row that stays put after a
 *     failure is a lie, so a refusal restores the buttons and says why.
 *  4. **Declining is silent by design.** The sender is told the request
 *     was answered and the slot is back — never that they were refused.
 *     The copy here matches what the other side actually sees.
 */

export type ConnectionOutcome = 'accepted' | 'declined' | 'blocked' | 'withdrawn';

/** The four outcomes, as the API names them. */
const ACTION: Record<ConnectionOutcome, 'accept' | 'decline' | 'block' | 'withdraw'> = {
  accepted: 'accept',
  declined: 'decline',
  blocked: 'block',
  withdrawn: 'withdraw',
};

type Phase = 'saving' | 'saved' | 'not_persisted';

export function ConnectionActions({
  connectionId,
  memberName,
  memberSlug,
  variant,
}: {
  /** The request being answered — the id the PATCH is addressed to. */
  connectionId: string;
  /** The other party — the sender on a received request, the recipient on a sent one. */
  memberName: string;
  memberSlug: string;
  variant: 'received' | 'sent';
}) {
  const toast = useToast();
  const router = useRouter();
  const [resolved, setResolved] = React.useState<{ outcome: ConnectionOutcome; phase: Phase } | null>(
    null,
  );
  const [confirmingBlock, setConfirmingBlock] = React.useState(false);

  const firstName = memberName.split(/\s+/)[0] ?? memberName;

  const decide = React.useCallback(
    async (next: ConnectionOutcome) => {
      setConfirmingBlock(false);
      // Optimistic: the row commits to the decision straight away.
      setResolved({ outcome: next, phase: 'saving' });

      const outcome = await api.patch(`/api/connections/${connectionId}`, {
        action: ACTION[next],
      });

      if (outcome.status !== 'ok') {
        // Roll it back. Nothing happened, so the row must look as though
        // nothing happened, and the toast carries the reason.
        setResolved(null);

        const t = outcomeToast(outcome, '');
        if (t) toast.show(t);

        // A 409 means this row is out of date — somebody answered it in
        // another tab, or it expired while the page sat open. Pull the
        // real state back rather than leaving a stale card on screen.
        if (outcome.status === 'conflict') router.refresh();
        return;
      }

      setResolved({ outcome: next, phase: outcome.persisted ? 'saved' : 'not_persisted' });

      const titles: Record<ConnectionOutcome, string> = {
        accepted: `Accepted ${firstName}'s request`,
        declined: 'Request closed',
        blocked: `Blocked ${firstName}`,
        withdrawn: 'Request withdrawn',
      };

      // Returns null for a real, persisted write: the panel below already
      // says what happened, in place, and does not need congratulating.
      const t = outcomeToast(outcome, titles[next]);
      if (t) toast.show(t);

      if (outcome.persisted) router.refresh();
    },
    [connectionId, firstName, router, toast],
  );

  if (resolved) {
    return (
      <Resolved
        outcome={resolved.outcome}
        phase={resolved.phase}
        firstName={firstName}
        memberSlug={memberSlug}
      />
    );
  }

  if (variant === 'sent') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => void decide('withdrawn')}>
          <Undo2 className="size-4" aria-hidden="true" />
          Withdraw
        </Button>
        <p className="text-xs text-muted">Frees a slot immediately.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void decide('accepted')}>
          <Check className="size-4" aria-hidden="true" />
          Accept
        </Button>
        <Button variant="secondary" size="sm" onClick={() => void decide('declined')}>
          <X className="size-4" aria-hidden="true" />
          Decline
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmingBlock(true)}
          aria-label={`Block ${memberName} from contacting you`}
        >
          <Ban className="size-4" aria-hidden="true" />
          Block
        </Button>
      </div>

      <ConfirmDialog
        open={confirmingBlock}
        onClose={() => setConfirmingBlock(false)}
        onConfirm={() => void decide('blocked')}
        title={`Block ${firstName}?`}
        confirmLabel="Block this member"
        body={
          <div className="space-y-2">
            <p>
              {memberName} will not be able to send you another request, and this one closes
              without a reply. They are not told that you blocked them.
            </p>
            <p>
              Declining is usually enough — it costs them nothing and frees the slot for
              somebody else. Block is for messages you do not want repeated.
            </p>
            <p>Only the alumni cell can undo a block.</p>
          </div>
        }
      />
    </>
  );
}

function Resolved({
  outcome,
  phase,
  firstName,
  memberSlug,
}: {
  outcome: ConnectionOutcome;
  phase: Phase;
  firstName: string;
  memberSlug: string;
}) {
  const line: Record<ConnectionOutcome, string> = {
    accepted: `Accepted. ${firstName} can now see the contact details your visibility setting allows — accepting does not override that setting.`,
    declined: `Closed. ${firstName} is told the request was answered and their slot is back — never that it was refused, and never why.`,
    blocked: `Blocked. ${firstName} cannot send you another request. Ask the alumni cell if you need this reversed.`,
    withdrawn: 'Withdrawn. One of your open request slots is free again.',
  };

  const tone =
    outcome === 'blocked'
      ? 'bg-danger-soft text-danger-fg'
      : outcome === 'declined'
        ? 'bg-surface-sunken text-secondary'
        : 'bg-success-soft text-success-fg';

  return (
    <div
      className={cn('flex items-start gap-2.5 rounded p-3 text-sm', tone)}
      role="status"
      aria-busy={phase === 'saving' || undefined}
    >
      {outcome === 'blocked' ? (
        <Ban className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : outcome === 'declined' ? (
        <X className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : (
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      )}

      <div className="min-w-0 space-y-1">
        <p>{line[outcome]}</p>
        {outcome === 'accepted' && phase !== 'saving' ? (
          <Link href={`/directory/${memberSlug}`} className="link text-xs font-semibold">
            Open their profile
          </Link>
        ) : null}

        {phase === 'saving' ? <p className="text-xs opacity-80">Sending your answer…</p> : null}

        {phase === 'not_persisted' ? (
          <p className="text-xs opacity-80">
            Shown here only — this build runs on seeded data with no database behind it. The
            permission checks and the audit entry ran; the write did not.
          </p>
        ) : null}
      </div>
    </div>
  );
}
