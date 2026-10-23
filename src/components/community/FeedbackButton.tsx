'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquareText } from 'lucide-react';

import { Button, Dialog, Field, Textarea, describedBy, useToast } from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';

/**
 * Send feedback from any member page.
 *
 * A small button in the sidebar foot that opens a short box. It records
 * the page it was pressed on (the path, never the query string, which can
 * carry a token) and files the message as a help-desk ticket, so there is
 * one inbox and one set of people reading it.
 *
 * Deliberately not a floating tab. A button fixed to the corner of every
 * screen sits on top of the content on a phone and fights the tab bar; the
 * sidebar foot and the help page are where somebody looking for it will
 * look.
 */

const FOOT_BUTTON =
  '-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center gap-2 rounded px-2 text-left text-sm font-medium text-secondary transition-colors duration-fast ease-brand hover:bg-surface-sunken hover:text-primary';

export function FeedbackButton({ officeName }: { officeName: string }) {
  const toast = useToast();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const short = message.trim().length > 0 && message.trim().length < 10;

  const send = async () => {
    setPending(true);
    setError(null);
    const outcome = await api.post('/api/feedback', { message: message.trim(), pagePath: pathname || undefined });
    setPending(false);

    const t = outcomeToast(outcome, 'Feedback sent');
    if (t) toast.show(t);

    if (outcome.status === 'ok') {
      setOpen(false);
      setMessage('');
      return;
    }
    setError(outcome.message);
  };

  return (
    <>
      <button type="button" className={FOOT_BUTTON} onClick={() => setOpen(true)}>
        <MessageSquareText className="size-4 shrink-0 text-muted" aria-hidden="true" />
        Send feedback
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Send feedback"
        description={`The ${officeName} reads every message. Tell us what is broken, confusing or missing.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={() => void send()} loading={pending} disabled={message.trim().length < 10}>
              Send
            </Button>
          </>
        }
      >
        <Field
          htmlFor="feedback-message"
          label="Your feedback"
          required
          hint="We note which page you were on. We do not record anything else about it."
          error={short ? 'A little more, so we know what you mean.' : (error ?? undefined)}
        >
          <Textarea
            id="feedback-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            maxLength={1500}
            invalid={short || Boolean(error)}
            aria-describedby={describedBy('feedback-message', { hint: true, error: short || Boolean(error) })}
          />
        </Field>
      </Dialog>
    </>
  );
}
