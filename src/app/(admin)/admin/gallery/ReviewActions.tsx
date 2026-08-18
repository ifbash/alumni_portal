'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, MessageSquare, ShieldCheck, X } from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  Fieldset,
  Radio,
  Textarea,
  describedBy,
  useToast,
} from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';

/**
 * The decision on a contributed album.
 *
 * Three outcomes, and every one of them is written back to the person who
 * sent the photographs in. A contribution that leaves this queue silently
 * is a contributor who assumes the college lost it, and they do not send a
 * second batch — which is the only reason there is anything in the archive
 * from before the portal existed.
 *
 * "Ask for changes" is the outcome most contributions actually need: a
 * missing year, a caption naming someone who has not agreed to be named.
 * Without it a reviewer has only publish-or-refuse, and picks refuse.
 */

const DECLINE_REASONS = [
  {
    id: 'permission',
    label: 'The photographs are not the contributor’s to publish',
    text: 'These photographs appear to have been taken by a professional photographer or another organisation. We can only publish photographs the contributor owns or has permission to share.',
  },
  {
    id: 'identifiable',
    label: 'People in them have not agreed to be published',
    text: 'Several photographs show people clearly and at close range. Before publishing we need to know that everyone identifiable is content to appear in the college archive.',
  },
  {
    id: 'quality',
    label: 'Too low a resolution to be worth archiving',
    text: 'The files are too small to be printed or enlarged. If you have the originals rather than a forwarded copy, send those instead and we will file them.',
  },
  {
    id: 'duplicate',
    label: 'Already in the archive',
    text: 'These photographs are already published in an existing album. Nothing is lost — your name has been added to the credit on that album.',
  },
  {
    id: 'other',
    label: 'Something else — write it below',
    text: '',
  },
] as const;

type ReasonId = (typeof DECLINE_REASONS)[number]['id'];

type Outcome = 'published' | 'changes' | 'declined';

/** What the endpoint calls each decision. */
const ACTION: Record<Outcome, 'publish' | 'request_changes' | 'decline'> = {
  published: 'publish',
  changes: 'request_changes',
  declined: 'decline',
};

interface Settlement {
  outcome: Outcome;
  /** The server's own sentence about what this decision entails. */
  note: string;
  /** What the contributor was sent, as sent. */
  message: string | null;
  persisted: boolean;
}

export function ReviewActions({
  albumId,
  albumTitle,
  contributorName,
  photoCount,
}: {
  albumId: string;
  albumTitle: string;
  contributorName: string;
  photoCount: number;
}) {
  const toast = useToast();
  const router = useRouter();

  const [settled, setSettled] = React.useState<Settlement | null>(null);
  const [pending, setPending] = React.useState<Outcome | null>(null);
  const [refusal, setRefusal] = React.useState<string | null>(null);
  const [publishing, setPublishing] = React.useState(false);
  const [changesOpen, setChangesOpen] = React.useState(false);
  const [declineOpen, setDeclineOpen] = React.useState(false);

  const [changeNote, setChangeNote] = React.useState('');
  const [reason, setReason] = React.useState<ReasonId | null>(null);
  const [otherNote, setOtherNote] = React.useState('');

  const chosen = DECLINE_REASONS.find((r) => r.id === reason) ?? null;
  const declineText = reason === 'other' ? otherNote.trim() : (chosen?.text ?? '');
  const declineBlocked = !reason || (reason === 'other' && otherNote.trim().length < 12);
  const changesBlocked = changeNote.trim().length < 12;

  /**
   * One call for all three outcomes. The endpoint decides what each one
   * means — whether the album goes live, whether it stays in the queue,
   * and what the contributor is sent — so nothing about that is duplicated
   * here.
   */
  const decide = async (outcome: Outcome, message: string | null) => {
    setPending(outcome);
    setRefusal(null);

    const action = ACTION[outcome];
    const result = await api.patch<{ note: string }>(`/api/admin/gallery/${albumId}`, {
      action,
      ...(action === 'request_changes' ? { message } : {}),
      ...(action === 'decline' ? { reasonCode: reason, message } : {}),
    });

    setPending(null);

    const t = outcomeToast(
      result,
      outcome === 'published'
        ? `“${albumTitle}” is live`
        : outcome === 'changes'
          ? 'Sent back to the contributor'
          : 'Album not published',
    );
    if (t) toast.show(t);

    if (result.status !== 'ok') {
      setRefusal(result.message);
      return;
    }

    setPublishing(false);
    setChangesOpen(false);
    setDeclineOpen(false);
    setSettled({ outcome, note: result.data.note, message, persisted: result.persisted });

    // Only when the decision actually landed. Refreshing over a write that
    // did not persist would redraw the queue exactly as it was and read as
    // the decision having been ignored.
    if (result.persisted) router.refresh();
  };

  if (settled) {
    const tone = settled.outcome === 'published' ? 'success' : settled.outcome === 'changes' ? 'info' : 'danger';
    const label =
      settled.outcome === 'published'
        ? 'Published'
        : settled.outcome === 'changes'
          ? 'Sent back for changes'
          : 'Not published';

    return (
      <Settled tone={tone} label={label}>
        <p>{settled.note}</p>

        {settled.message ? (
          <>
            <p className="mt-2">{contributorName} receives this, as written:</p>
            <p className="mt-2 max-w-prose rounded border border-line bg-surface-sunken p-3 text-sm text-primary">
              {settled.message}
            </p>
          </>
        ) : null}

        <p className="mt-2 text-xs text-muted">
          The decision, your name and the reason are in the audit log as{' '}
          <code className="font-mono text-xs">gallery.{ACTION[settled.outcome]}</code>.
          {settled.outcome === 'declined'
            ? ' Declining is not deleting — the photographs stay on file until the contributor asks for them back.'
            : ''}
        </p>

        {!settled.persisted ? (
          <p className="mt-2 text-xs text-muted">
            Recorded on this screen only. This build runs on seeded data with no database and no message provider
            behind it: your capability was checked and the audit entry was written, but the album was not changed
            and {contributorName} has not actually been written to.
          </p>
        ) : null}
      </Settled>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <p className="mr-auto max-w-prose text-xs text-muted">
          Every outcome is a decision recorded against your name, and {contributorName} is told which of the three it
          was. Asking for changes leaves the album in this queue until they reply.
        </p>

        <Button variant="ghost" onClick={() => setDeclineOpen(true)} disabled={pending !== null}>
          <X className="size-4" aria-hidden="true" />
          Do not publish
        </Button>

        <Button variant="secondary" onClick={() => setChangesOpen(true)} disabled={pending !== null}>
          <MessageSquare className="size-4" aria-hidden="true" />
          Ask for changes
        </Button>

        <Button onClick={() => setPublishing(true)} loading={pending === 'published'}>
          <Check className="size-4" aria-hidden="true" />
          Publish
        </Button>
      </div>

      {refusal ? (
        <Alert tone="danger" title="The decision was not recorded">
          <p>{refusal}</p>
        </Alert>
      ) : null}

      <ConfirmDialog
        open={publishing}
        onClose={() => setPublishing(false)}
        onConfirm={() => void decide('published', null)}
        pending={pending === 'published'}
        tone="primary"
        confirmLabel="Publish the album"
        title="Publish to every member?"
        body={
          <div className="space-y-2">
            <p>
              All <strong className="text-primary">{photoCount.toLocaleString('en-IN')}</strong> photographs become
              visible to every verified member, students included, the moment you confirm.
            </p>
            <p>
              {contributorName} is credited by name on the album and is told it went live. Anyone tagged in a
              photograph can ask to be untagged afterwards, and anyone in one can ask for it to come down.
            </p>
          </div>
        }
      />

      <Dialog
        open={changesOpen}
        onClose={() => setChangesOpen(false)}
        title="Ask for changes"
        description={`${albumTitle}, sent in by ${contributorName}.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setChangesOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={changesBlocked}
              loading={pending === 'changes'}
              onClick={() => void decide('changes', changeNote.trim())}
            >
              Send and keep in the queue
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Alert tone="info" title="Most contributions need this, not a refusal">
            <p>
              A missing year, a caption naming somebody who has not agreed to be named, or eight photographs that
              belong in a different album. Say what would make it publishable and the album waits here for the reply.
            </p>
          </Alert>

          <Field
            htmlFor={`changes-${albumId}`}
            label="What needs to change"
            required
            hint="Sent to the contributor as written. A sentence they can act on beats a form letter."
            error={
              changeNote.trim().length > 0 && changesBlocked
                ? 'Give them something specific enough to act on.'
                : undefined
            }
          >
            <Textarea
              id={`changes-${albumId}`}
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              rows={4}
              placeholder="Could you tell us roughly which year the first eight photographs are from? The block was rebuilt in 2019 and we want the caption to say so."
              invalid={changeNote.trim().length > 0 && changesBlocked}
              aria-describedby={describedBy(`changes-${albumId}`, {
                hint: true,
                error: changeNote.trim().length > 0 && changesBlocked,
              })}
            />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={declineOpen}
        onClose={() => setDeclineOpen(false)}
        title="Do not publish this album"
        description={`${albumTitle}, sent in by ${contributorName}.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeclineOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={declineBlocked}
              loading={pending === 'declined'}
              onClick={() => void decide('declined', declineText)}
            >
              Decline and notify
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Alert tone="info" title="The contributor reads this">
            <p>
              A refusal with no reason reads as the college losing the submission, and it is the last one that person
              sends. Pick the rule it falls foul of; the wording below is what {contributorName} receives.
            </p>
          </Alert>

          <Fieldset legend="Reason" hint="One reason is enough. The most specific one is the most useful.">
            {DECLINE_REASONS.map((r) => (
              <Radio
                key={r.id}
                id={`decline-${albumId}-${r.id}`}
                name={`decline-${albumId}`}
                label={r.label}
                hint={r.text || undefined}
                checked={reason === r.id}
                onChange={() => setReason(r.id)}
              />
            ))}
          </Fieldset>

          {reason === 'other' ? (
            <Field
              htmlFor={`decline-note-${albumId}`}
              label="What is wrong with it"
              required
              hint="Written to the contributor as-is. At least a sentence."
              error={
                otherNote.trim().length > 0 && otherNote.trim().length < 12
                  ? 'Give them something they can act on.'
                  : undefined
              }
            >
              <Textarea
                id={`decline-note-${albumId}`}
                value={otherNote}
                onChange={(e) => setOtherNote(e.target.value)}
                rows={4}
                placeholder="The photographs are from a private function rather than a college event, so they do not belong in the college archive."
                invalid={otherNote.trim().length > 0 && otherNote.trim().length < 12}
                aria-describedby={describedBy(`decline-note-${albumId}`, {
                  hint: true,
                  error: otherNote.trim().length > 0 && otherNote.trim().length < 12,
                })}
              />
            </Field>
          ) : null}

          <p className="flex items-start gap-2 text-xs text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              The decision, your name and this reason go to the audit log. Declining is not deleting — the
              photographs stay on file, and the contributor can send a corrected album.
            </span>
          </p>
        </div>
      </Dialog>
    </>
  );
}

function Settled({
  tone,
  label,
  children,
}: {
  tone: 'success' | 'info' | 'danger';
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-2 border-t border-line pt-4">
      <Badge tone={tone} dot>
        {label}
      </Badge>
      <div className="text-sm text-secondary">{children}</div>
    </div>
  );
}
