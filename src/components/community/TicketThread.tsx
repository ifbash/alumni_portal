'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Alert, Badge, Button, ConfirmDialog, Field, Textarea, describedBy, useToast } from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { TicketMessage, TicketState } from '@/lib/data/types';

/**
 * A ticket's conversation, and the box to add to it.
 *
 * Two audiences use it. The member who wrote the ticket replies, or closes
 * it; a member of staff replies and chooses where it goes next (answered or
 * closed), which is why the staff version has two buttons and the member's
 * has one. The messages are drawn the same for both, with staff replies set
 * apart so "who said that" is never a guess.
 *
 * What is sent is added to the list on screen straight away, marked as not
 * stored when the build runs on seeded data, so a reply never seems to
 * vanish.
 */

export function TicketThread({
  reference,
  initial,
  state,
  audience,
  locale,
  timeZone,
  officeName,
}: {
  reference: string;
  initial: TicketMessage[];
  state: TicketState;
  audience: 'member' | 'staff';
  locale: string;
  timeZone: string;
  officeName: string;
}) {
  const toast = useToast();
  const router = useRouter();

  const [messages, setMessages] = React.useState<Array<TicketMessage & { unsaved?: boolean }>>(initial);
  const [current, setCurrent] = React.useState<TicketState>(state);
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmClose, setConfirmClose] = React.useState(false);

  const closed = current === 'closed';
  const short = text.trim().length > 0 && text.trim().length < 2;

  const send = async (nextState?: 'answered' | 'closed') => {
    if (text.trim().length < 2) {
      setError('Write a reply.');
      return;
    }
    setBusy(nextState ?? 'reply');
    setError(null);

    const outcome =
      audience === 'staff'
        ? await api.post<{ message: TicketMessage }>(`/api/admin/helpdesk/${reference}`, { body: text.trim(), state: nextState })
        : await api.post<{ message: TicketMessage }>(`/api/helpdesk/${reference}`, { body: text.trim() });
    setBusy(null);

    const t = outcomeToast(outcome, audience === 'staff' ? 'Reply sent' : 'Message sent');
    if (t) toast.show(t);

    if (outcome.status !== 'ok') {
      setError(outcome.message);
      return;
    }

    setMessages((m) => [...m, { ...outcome.data.message, unsaved: !outcome.persisted }]);
    setText('');
    setCurrent(audience === 'staff' ? (nextState ?? 'answered') : 'open');
    if (outcome.persisted) router.refresh();
  };

  const closeIt = async () => {
    setBusy('close');
    const outcome = await api.patch(`/api/helpdesk/${reference}`, { action: 'close' });
    setBusy(null);
    setConfirmClose(false);
    const t = outcomeToast(outcome, 'Question closed');
    if (t) toast.show(t);
    if (outcome.status === 'ok') {
      setCurrent('closed');
      if (outcome.persisted) router.refresh();
      return;
    }
    setError(outcome.message);
  };

  return (
    <div className="space-y-5">
      <ol className="space-y-3" aria-label="Messages">
        {messages.map((m) => (
          <li
            key={m.id}
            className={cn(
              'max-w-prose rounded-lg border px-4 py-3',
              m.fromStaff ? 'border-line bg-brand-soft text-brand-soft-fg' : 'border-line bg-surface-raised',
            )}
          >
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="font-semibold">{m.fromStaff ? `The ${officeName}` : m.authorName}</span>
              {m.fromStaff ? <Badge tone="brand">Staff</Badge> : null}
              <time dateTime={m.createdAt} className="text-xs opacity-80">
                {formatRelative(m.createdAt, { locale, timeZone })}
              </time>
              {m.unsaved ? <Badge tone="neutral">Not saved</Badge> : null}
            </p>
            <p className="mt-1 whitespace-pre-line break-words text-md leading-relaxed">{m.body}</p>
          </li>
        ))}
      </ol>

      {closed ? (
        <Alert tone="neutral" title="This question is closed">
          <p>{audience === 'staff' ? 'The member can still ask a new question.' : 'Ask a new question and mention the reference if you need more help.'}</p>
        </Alert>
      ) : (
        <form
          className="max-w-prose space-y-3"
          noValidate
          onSubmit={(ev) => {
            ev.preventDefault();
            void send(audience === 'staff' ? 'answered' : undefined);
          }}
        >
          <Field htmlFor="thread-reply" label={audience === 'staff' ? 'Your reply' : 'Add a message'} error={short ? 'Write a reply.' : (error ?? undefined)}>
            <Textarea
              id="thread-reply"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              maxLength={2000}
              invalid={Boolean(error) || short}
              aria-describedby={describedBy('thread-reply', { error: Boolean(error) || short })}
            />
          </Field>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {audience === 'member' ? (
              <Button type="button" variant="ghost" onClick={() => setConfirmClose(true)} disabled={busy !== null} className="min-h-11 sm:min-h-0">
                I have what I need. Close this
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={() => void send('closed')} loading={busy === 'closed'} disabled={busy !== null && busy !== 'closed'} className="min-h-11 sm:min-h-0">
                Reply and close
              </Button>
            )}
            <Button type="submit" loading={busy === 'reply' || busy === 'answered'} disabled={busy === 'closed'} className="min-h-11 sm:min-h-0">
              {audience === 'staff' ? 'Reply' : 'Send'}
            </Button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={() => void closeIt()}
        pending={busy === 'close'}
        tone="primary"
        confirmLabel="Close question"
        title="Close this question?"
        body={<p>You can ask a new one at any time. Closing tells the alumni office there is nothing left to do.</p>}
      />
    </div>
  );
}
