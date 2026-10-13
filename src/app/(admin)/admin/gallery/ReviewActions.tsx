'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Eye, MessageSquare, MoreHorizontal, Send, X } from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  Fieldset,
  MenuItem,
  Radio,
  Textarea,
  describedBy,
  useToast,
} from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';
import { cn } from '@/lib/cn';

/**
 * The decision on a contributed album.
 *
 * Three outcomes, and every one of them is written back to the person who
 * sent the photographs in. A contribution that leaves this queue silently
 * is a contributor who assumes the college lost it, and they do not send a
 * second batch.
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
  const changesShort = changeNote.trim().length > 0 && changesBlocked;
  const otherShort = otherNote.trim().length > 0 && otherNote.trim().length < 12;

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
    const label = !settled.persisted
      ? 'Not saved'
      : settled.outcome === 'published'
        ? 'Published'
        : settled.outcome === 'changes'
          ? 'Sent back for changes'
          : 'Not published';
    const tone = !settled.persisted
      ? 'neutral'
      : settled.outcome === 'published'
        ? 'success'
        : settled.outcome === 'changes'
          ? 'brand'
          : 'danger';

    return (
      <div className="min-w-0 space-y-2 border-t border-line pt-4" role="status">
        <Badge tone={tone} dot={settled.persisted}>
          {label}
        </Badge>
        {settled.persisted ? <p className="text-sm text-secondary">{settled.note}</p> : null}
        {settled.message ? (
          <p className="max-w-prose text-sm text-secondary">
            <span className="font-medium text-primary">To {contributorName}: </span>
            {settled.message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={() => setDeclineOpen(true)} disabled={pending !== null} className="min-h-11 sm:min-h-0">
          <X className="size-4" aria-hidden="true" />
          Do not publish
        </Button>

        <Button variant="secondary" onClick={() => setChangesOpen(true)} disabled={pending !== null} className="min-h-11 sm:min-h-0">
          <MessageSquare className="size-4" aria-hidden="true" />
          Ask for changes
        </Button>

        <Button onClick={() => setPublishing(true)} loading={pending === 'published'} className="min-h-11 sm:min-h-0">
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
              visible to every member, final-year students included.
            </p>
            <p>{contributorName} is credited on the album and told it went live.</p>
          </div>
        }
      />

      <Dialog
        open={changesOpen}
        onClose={() => setChangesOpen(false)}
        title="Ask for changes"
        description={`${albumTitle}, sent in by ${contributorName}. The album waits here for the reply.`}
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
        <Field
          htmlFor={`changes-${albumId}`}
          label="What needs to change"
          required
          hint="Sent to the contributor as written."
          error={changesShort ? 'Give them something specific enough to act on.' : undefined}
        >
          <Textarea
            id={`changes-${albumId}`}
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            rows={4}
            placeholder="e.g. Which year are the first eight photographs from?"
            invalid={changesShort}
            aria-describedby={describedBy(`changes-${albumId}`, { hint: true, error: changesShort })}
          />
        </Field>
      </Dialog>

      <Dialog
        open={declineOpen}
        onClose={() => setDeclineOpen(false)}
        title="Do not publish this album"
        description={`${albumTitle}. ${contributorName} reads the reason you choose.`}
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
              Decline with this reason
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Fieldset legend="Reason" hint="The most specific one is the most useful. The photographs stay on file.">
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
              hint="Sent to the contributor as written. At least a sentence."
              error={otherShort ? 'Give them something they can act on.' : undefined}
            >
              <Textarea
                id={`decline-note-${albumId}`}
                value={otherNote}
                onChange={(e) => setOtherNote(e.target.value)}
                rows={4}
                placeholder="e.g. These are from a private function rather than a college event."
                invalid={otherShort}
                aria-describedby={describedBy(`decline-note-${albumId}`, { hint: true, error: otherShort })}
              />
            </Field>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------
// The album tile's menu
// ---------------------------------------------------------------

/**
 * A tile's overflow menu: open as member, publish, copy for WhatsApp, and
 * "Add photos" shown disabled with its reason. Built here rather than on
 * the kit's Menu, whose trigger is a `display: contents` button that
 * browsers leave out of the tab order.
 */
export function AlbumActionsMenu({
  albumId,
  albumTitle,
  photoCount,
  memberHref,
  shareText,
  canPublish,
}: {
  albumId: string;
  albumTitle: string;
  photoCount: number;
  /** The member page, for a published album. */
  memberHref: string | null;
  /** Share text with the link, for a published album. */
  shareText: string | null;
  /** An unpublished album the endpoint will publish. */
  canPublish: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [manual, setManual] = React.useState<string | null>(null);
  const wrap = React.useRef<HTMLDivElement>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const menuId = React.useId();
  const label = `More actions for ${albumTitle}`;

  React.useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const items = () =>
    Array.from(document.getElementById(menuId)?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  const focusItem = (at: 'first' | 'last') =>
    requestAnimationFrame(() => {
      const found = items();
      (at === 'first' ? found[0] : found[found.length - 1])?.focus();
    });

  const onMenuKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const found = items();
    const at = found.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (e.key === 'ArrowDown') next = (at + 1) % found.length;
    else if (e.key === 'ArrowUp') next = (at - 1 + found.length) % found.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = found.length - 1;
    else if (e.key === 'Escape' || e.key === 'Tab') {
      if (e.key === 'Escape') e.preventDefault();
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (next === null) return;
    e.preventDefault();
    found[next]?.focus();
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied for WhatsApp');
    } catch {
      setManual(text);
    }
  };

  const publish = async () => {
    setBusy(true);
    const result = await api.patch<{ note: string }>(`/api/admin/gallery/${albumId}`, { action: 'publish' });
    setBusy(false);
    setConfirming(false);
    const t = outcomeToast(result, `“${albumTitle}” is live`);
    if (t) toast.show(t);
    if (result.status === 'ok' && result.persisted) router.refresh();
  };

  return (
    <div ref={wrap} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(e) => {
          const opening = !open;
          setOpen(opening);
          if (opening && e.detail === 0) focusItem('first');
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
            focusItem(e.key === 'ArrowDown' ? 'first' : 'last');
          }
        }}
        className={cn(
          'grid size-11 place-items-center rounded text-secondary lg:size-9',
          'transition-colors duration-fast ease-brand hover:bg-surface-sunken hover:text-primary',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
          open && 'bg-surface-sunken text-primary',
        )}
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className="absolute right-0 z-30 mt-1 w-64 animate-slide-down rounded-lg border border-line bg-surface-raised p-1 shadow-lg"
        >
          {memberHref ? (
            <MenuItem href={memberHref} icon={<Eye className="size-4" />}>
              Open as member
            </MenuItem>
          ) : null}
          {canPublish ? (
            <MenuItem
              icon={<Send className="size-4" />}
              onSelect={() => {
                setOpen(false);
                setConfirming(true);
              }}
            >
              Publish
            </MenuItem>
          ) : null}
          {shareText ? (
            <MenuItem
              icon={<Copy className="size-4" />}
              onSelect={() => {
                setOpen(false);
                void copy(shareText);
              }}
            >
              Copy for WhatsApp
            </MenuItem>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void publish()}
        pending={busy}
        tone="primary"
        confirmLabel="Publish the album"
        title="Publish to every member?"
        body={
          <div className="space-y-2">
            <p>
              <strong className="text-primary">{albumTitle}</strong> becomes visible to every member, final-year
              students included.
            </p>
            {photoCount === 0 ? <p>It has no photographs yet, so members will find it empty.</p> : null}
          </div>
        }
      />

      <Dialog
        open={manual !== null}
        onClose={() => setManual(null)}
        title="Copy the text"
        description="The clipboard was not available. Select the text and copy it."
      >
        <Textarea
          readOnly
          value={manual ?? ''}
          rows={4}
          aria-label="Text for WhatsApp"
          onFocus={(e) => e.currentTarget.select()}
        />
      </Dialog>
    </div>
  );
}
