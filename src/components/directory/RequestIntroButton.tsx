'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Handshake, Check } from 'lucide-react';
import {
  Alert,
  Button,
  Dialog,
  Field,
  Fieldset,
  Radio,
  Textarea,
  describedBy,
  useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import type { ConnectionKind, ConnectionQuota } from '@/lib/data/types';

/**
 * Request an introduction.
 *
 * The one place a student can spend a connection request, so the dialog
 * is written to make it worth spending: it says what the recipient will
 * see, it asks for a reason in the person's own words, and it shows how
 * many requests are left before the quota bites.
 *
 * The quota check has already happened on the server — this component is
 * only rendered when the viewer may send. The client-side numbers are for
 * the human, not for authorisation; the route enforces it again.
 */

const KIND_COPY: Record<ConnectionKind, { label: string; hint: string }> = {
  mentorship: {
    label: 'Mentoring',
    hint: 'Guidance over a call or two — preparation, higher studies, which way to go.',
  },
  referral: {
    label: 'Referral',
    hint: 'A referral for a specific opening at their company. Have the role in hand before you ask.',
  },
  introduction: {
    label: 'Introduction',
    hint: 'An introduction to someone in their network who does what you want to do.',
  },
  speaking: {
    label: 'Speaking',
    hint: 'Inviting them to speak at a campus session or a department event.',
  },
};

const MIN_MESSAGE = 30;
const MAX_MESSAGE = 600;

export function RequestIntroButton({
  toMemberId,
  toName,
  kinds,
  defaultKind,
  quota,
  label = 'Request an introduction',
  variant = 'primary',
  size = 'md',
  className,
}: {
  toMemberId: string;
  toName: string;
  /** Offered kinds, narrowed by what this member has opted in to. */
  kinds: ConnectionKind[];
  defaultKind: ConnectionKind;
  quota: ConnectionQuota;
  label?: string;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<ConnectionKind>(defaultKind);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const formId = `intro-${toMemberId}`;
  const firstName = toName.split(' ')[0] ?? toName;
  const remaining = Math.max(0, quota.monthlyLimit - quota.usedThisMonth);

  const close = () => {
    if (sending) return;
    setOpen(false);
    setError(null);
    setFailure(null);
  };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = message.trim();
    if (trimmed.length < MIN_MESSAGE) {
      setError(
        `Say a little more — ${trimmed.length} of ${MIN_MESSAGE} characters. Two or three sentences saying who you are and what you want to ask.`,
      );
      return;
    }

    setError(null);
    setFailure(null);
    setSending(true);

    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ toMemberId, kind, message: trimmed }),
      });

      if (!res.ok) {
        // The route may answer with JSON, or with an HTML error page if
        // something upstream failed. Neither should throw here.
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setFailure(
          body?.error ??
            (res.status === 429
              ? 'You have reached your request limit. Wait for a reply to one of the requests already open.'
              : `The request could not be sent (${res.status}). Try again in a moment.`),
        );
        setSending(false);
        return;
      }

      setSent(true);
      setSending(false);
      setOpen(false);
      toast.success(
        `Request sent to ${firstName}`,
        'You will get a notification when they reply. Contact details are released only if they accept.',
      );
      // The server owns the quota and the pending-request state shown on
      // this page; re-fetch rather than guessing at them here.
      router.refresh();
    } catch {
      setFailure('Could not reach the server. Check your connection and try again.');
      setSending(false);
    }
  }

  if (sent) {
    return (
      <p className={cn('flex items-center gap-2 text-sm font-medium text-success-fg', className)}>
        <Check className="size-4 shrink-0" aria-hidden="true" />
        Request sent to {firstName}
      </p>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        <Handshake className="size-4" aria-hidden="true" />
        {label}
      </Button>

      <Dialog
        open={open}
        onClose={close}
        title={`Ask ${firstName} for an introduction`}
        description={`${firstName} sees your name, branch and batch along with this message. Your contact details are shared only if they accept.`}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={close} disabled={sending}>
              Cancel
            </Button>
            <Button type="submit" form={formId} loading={sending}>
              Send request
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={submit} className="space-y-5">
          {failure ? (
            <Alert tone="danger" title="Not sent">
              {failure}
            </Alert>
          ) : null}

          {kinds.length > 1 ? (
            <Fieldset legend="What are you asking for?">
              <div className="space-y-2.5">
                {kinds.map((k) => (
                  <Radio
                    key={k}
                    id={`${formId}-kind-${k}`}
                    name={`${formId}-kind`}
                    value={k}
                    checked={kind === k}
                    onChange={() => setKind(k)}
                    label={KIND_COPY[k].label}
                    hint={KIND_COPY[k].hint}
                  />
                ))}
              </div>
            </Fieldset>
          ) : (
            <p className="text-sm text-secondary">{KIND_COPY[kind].hint}</p>
          )}

          <Field
            htmlFor={`${formId}-message`}
            label="Your message"
            required
            hint="Who you are, what you want to ask, and why them. A request with a specific question is one they can answer in two minutes."
            error={error}
          >
            <Textarea
              id={`${formId}-message`}
              name="message"
              rows={5}
              maxLength={MAX_MESSAGE}
              value={message}
              invalid={Boolean(error)}
              aria-describedby={describedBy(`${formId}-message`, {
                hint: true,
                error: Boolean(error),
              })}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Hello ${firstName}, I am in final year CSE at DIET and preparing for backend roles. You moved from a service company to a product team — could I ask you two questions about how you prepared for those interviews?`}
            />
          </Field>

          <p className="flex items-center justify-between gap-3 text-xs text-muted">
            <span className="tabular">
              {message.trim().length} / {MAX_MESSAGE} characters
            </span>
            <span className="tabular">
              {remaining} of {quota.monthlyLimit} requests left this month
            </span>
          </p>
        </form>
      </Dialog>
    </>
  );
}
