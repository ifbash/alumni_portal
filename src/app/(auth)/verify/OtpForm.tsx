'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, RotateCw, TriangleAlert } from 'lucide-react';
import { Alert, Button, Fieldset } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * One-time code entry.
 *
 * Six separate boxes because that is what people expect from every OTP
 * they have ever typed, and one hidden field behind them would break
 * paste. The behaviours that decide whether this is usable on a phone:
 *
 *  - pasting the whole code into any box fills all six;
 *  - a code that arrives as one long string from an Android keyboard or
 *    an autofill suggestion is spread across the boxes rather than
 *    truncated to a single digit;
 *  - backspace on an empty box clears the previous one and moves back;
 *  - the form submits itself the moment six digits are present, so
 *    nobody has to find the button after typing the last digit.
 *
 * Every failure the session layer can return is handled by name, with
 * the recovery action attached to the message. "Invalid code" on its own
 * is where support tickets come from.
 */

const LENGTH = 6;
const RESEND_SECONDS = 45;

type Reason = 'expired' | 'invalid' | 'too_many_attempts' | 'unknown_email' | 'rate_limited' | 'unknown';

export function OtpForm({
  email,
  next,
  ttlSeconds,
  maxAttempts,
  isFixture,
  supportEmail,
}: {
  email: string;
  next?: string;
  ttlSeconds: number;
  maxAttempts: number;
  isFixture: boolean;
  supportEmail?: string;
}) {
  const router = useRouter();

  const [digits, setDigits] = React.useState<string[]>(() => Array<string>(LENGTH).fill(''));
  const [pending, setPending] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [reason, setReason] = React.useState<Reason | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [devCode, setDevCode] = React.useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = React.useState(RESEND_SECONDS);
  const [resent, setResent] = React.useState(false);

  const boxes = React.useRef<Array<HTMLInputElement | null>>([]);
  // Stops the auto-submit firing twice for the same six digits when React
  // replays a change during a re-render.
  const lastSubmitted = React.useRef('');

  const ttlMinutes = Math.max(1, Math.round(ttlSeconds / 60));

  // ------------------------------------------------------------- effects

  React.useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  React.useEffect(() => {
    if (!isFixture) return;
    try {
      const stored = window.sessionStorage.getItem(`otp-dev:${email.toLowerCase()}`);
      if (stored) {
        setDevCode(stored);
        return;
      }
    } catch {
      /* storage blocked — the notice simply does not appear */
    }
    // Fixture mode with nothing stashed means the page was opened directly.
    // No email was ever sent, so making a demo wait out the resend timer
    // for a code that does not exist is just a stuck screen.
    setSecondsLeft(0);
  }, [email, isFixture]);

  // ------------------------------------------------------------ helpers

  function focusBox(i: number) {
    boxes.current[Math.max(0, Math.min(LENGTH - 1, i))]?.focus();
  }

  function reset(focus = true) {
    setDigits(Array<string>(LENGTH).fill(''));
    lastSubmitted.current = '';
    if (focus) focusBox(0);
  }

  function describe(r: Reason, attemptsLeft?: number, serverMessage?: string): string {
    switch (r) {
      case 'expired':
        return `That code has expired — they last ${ttlMinutes} minutes. Send yourself a new one and it will work.`;
      case 'invalid':
        return typeof attemptsLeft === 'number'
          ? `That code is not right. ${attemptsLeft} more ${attemptsLeft === 1 ? 'try' : 'tries'} before it is cancelled and you need a fresh one.`
          : 'That code is not right. Check the six digits in the email — the most recent one, if you asked twice.';
      case 'too_many_attempts':
        return `${maxAttempts} wrong codes, so this one has been cancelled. Send a new code to try again.`;
      case 'unknown_email':
        return `There is no account on ${email}. If you graduated from here, claim your profile with your roll number.`;
      case 'rate_limited':
        return 'Too many attempts from here. Wait a minute, then ask for a new code.';
      default:
        return serverMessage ?? 'We could not check that code just now. Try again in a moment.';
    }
  }

  // ------------------------------------------------------------- actions

  async function submit(code: string) {
    if (code.length !== LENGTH) {
      setReason('invalid');
      setMessage('Enter all six digits from the email.');
      return;
    }

    setPending(true);
    setReason(null);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      const data = (await res.json().catch(() => null)) as
        | { error?: string; code?: string; reason?: string; attemptsLeft?: number }
        | null;

      if (res.ok && !data?.error) {
        try {
          window.sessionStorage.removeItem(`otp-dev:${email.toLowerCase()}`);
        } catch {
          /* nothing to clean up */
        }
        // `replace`, not `push`: the back button should not land on a
        // verification screen for a code that has already been consumed.
        router.replace(next ?? '/dashboard');
        router.refresh();
        return;
      }

      const r = ((res.status === 429 ? 'rate_limited' : data?.code ?? data?.reason) ?? 'unknown') as Reason;
      setReason(r);
      setMessage(describe(r, data?.attemptsLeft, data?.error));
      setPending(false);

      if (r === 'expired' || r === 'too_many_attempts') {
        setSecondsLeft(0);
        reset(false);
      } else if (r === 'invalid') {
        reset();
      }
    } catch {
      setReason('unknown');
      setMessage('We could not reach the portal. Check your connection and try again.');
      setPending(false);
    }
  }

  async function resend() {
    setResending(true);
    setReason(null);
    setMessage(null);
    setResent(false);

    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = (await res.json().catch(() => null)) as
        | { error?: string; code?: string; devCode?: string }
        | null;

      if (!res.ok || data?.error) {
        const r = ((res.status === 429 ? 'rate_limited' : data?.code) ?? 'unknown') as Reason;
        setReason(r);
        setMessage(describe(r, undefined, data?.error));
        setResending(false);
        return;
      }

      if (data?.devCode) {
        setDevCode(data.devCode);
        try {
          window.sessionStorage.setItem(`otp-dev:${email.toLowerCase()}`, data.devCode);
        } catch {
          /* storage blocked */
        }
      }

      reset();
      setSecondsLeft(RESEND_SECONDS);
      setResent(true);
      setResending(false);
    } catch {
      setReason('unknown');
      setMessage('We could not send another code. Check your connection and try again.');
      setResending(false);
    }
  }

  // -------------------------------------------------------- input wiring

  function fill(source: string, from = 0) {
    const chars = source.replace(/\D/g, '').slice(0, LENGTH - from).split('');
    if (chars.length === 0) return;

    const updated = [...digits];
    chars.forEach((c, k) => {
      updated[from + k] = c;
    });
    setDigits(updated);
    focusBox(from + chars.length - 1 + (chars.length < LENGTH - from ? 1 : 0));
    maybeSubmit(updated);
  }

  function maybeSubmit(updated: string[]) {
    const code = updated.join('');
    if (code.length === LENGTH && updated.every(Boolean) && lastSubmitted.current !== code) {
      lastSubmitted.current = code;
      void submit(code);
    }
  }

  function onChange(i: number, raw: string) {
    const cleaned = raw.replace(/\D/g, '');

    if (cleaned.length > 1) {
      fill(cleaned, i);
      return;
    }

    const updated = [...digits];
    updated[i] = cleaned;
    setDigits(updated);

    if (cleaned && i < LENGTH - 1) focusBox(i + 1);
    if (cleaned) maybeSubmit(updated);
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      e.preventDefault();
      const updated = [...digits];
      updated[i - 1] = '';
      setDigits(updated);
      focusBox(i - 1);
      return;
    }
    if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      focusBox(i - 1);
    }
    if (e.key === 'ArrowRight' && i < LENGTH - 1) {
      e.preventDefault();
      focusBox(i + 1);
    }
  }

  function onPaste(i: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text');
    const cleaned = text.replace(/\D/g, '');
    if (!cleaned) return;
    e.preventDefault();
    // A full-length paste always starts at the first box, wherever the
    // cursor happened to be — people click the middle and paste.
    fill(cleaned, cleaned.length >= LENGTH ? 0 : i);
  }

  const code = digits.join('');
  const complete = code.length === LENGTH && digits.every(Boolean);
  const invalid = Boolean(reason);

  // ---------------------------------------------------------------- view

  return (
    <div className="space-y-6">
      {devCode ? (
        <Alert
          tone="warning"
          title="Development mode — no email was sent"
          icon={<TriangleAlert className="size-4" />}
        >
          <div className="space-y-2">
            <p>
              This portal is running on seeded fixture data, so the sign-in code is returned in the
              response instead of going to an inbox. It will not be in production.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded border border-[color-mix(in_srgb,currentColor_26%,transparent)] bg-surface-raised px-3 py-1.5 font-mono text-xl font-semibold tracking-[0.3em] tabular">
                {devCode}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fill(devCode, 0)}
              >
                Fill it in
              </Button>
            </div>
          </div>
        </Alert>
      ) : null}

      {resent ? (
        <Alert tone="success" title="A new code is on its way">
          <p>The previous code stopped working the moment this one was issued.</p>
        </Alert>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(code);
        }}
        noValidate
        className="space-y-5"
      >
        <Fieldset
          legend="Six-digit code"
          hint={`Sent to ${email}. It is valid for ${ttlMinutes} minutes and works once.`}
        >
          <div className="grid grid-cols-6 gap-2 sm:gap-3">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  boxes.current[i] = el;
                }}
                value={d}
                onChange={(e) => onChange(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                onPaste={(e) => onPaste(i, e)}
                onFocus={(e) => e.currentTarget.select()}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                autoFocus={i === 0}
                aria-label={`Digit ${i + 1} of ${LENGTH}`}
                aria-invalid={invalid || undefined}
                aria-describedby={invalid ? 'otp-error' : undefined}
                disabled={pending}
                className={cn(
                  'h-control-lg w-full rounded-lg border border-line bg-surface-raised text-center',
                  'font-mono text-xl font-semibold text-primary tabular',
                  'transition-colors duration-fast ease-brand hover:border-line-strong',
                  'focus:border-[var(--focus-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]',
                  'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-muted',
                  'aria-[invalid=true]:border-danger',
                )}
              />
            ))}
          </div>
        </Fieldset>

        {message ? (
          <div id="otp-error">
            <Alert
              tone={reason === 'unknown_email' ? 'warning' : 'danger'}
              title={
                reason === 'expired'
                  ? 'That code has expired'
                  : reason === 'too_many_attempts'
                    ? 'Code cancelled'
                    : reason === 'unknown_email'
                      ? 'No account on that address'
                      : 'Could not sign you in'
              }
              icon={<TriangleAlert className="size-4" />}
            >
              <p>{message}</p>
              {reason === 'unknown_email' ? (
                <p className="pt-1">
                  <Link href="/claim">Claim your profile</Link> — it takes a roll number and a year
                  of passing.
                </p>
              ) : null}
            </Alert>
          </div>
        ) : null}

        <Button type="submit" size="lg" className="w-full" loading={pending} disabled={!complete && !pending}>
          {pending ? 'Checking your code' : 'Sign in'}
          {pending ? null : <ArrowRight className="size-4" aria-hidden="true" />}
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <p className="text-sm text-secondary">
          {secondsLeft > 0 ? (
            <>
              No email yet? You can ask for another in{' '}
              <span className="font-medium text-primary tabular">
                {String(Math.floor(secondsLeft / 60))}:{String(secondsLeft % 60).padStart(2, '0')}
              </span>
            </>
          ) : (
            'Check the spam folder before asking for another — they usually land there first.'
          )}
        </p>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void resend()}
          loading={resending}
          disabled={secondsLeft > 0 || resending}
        >
          {resending ? null : <RotateCw className="size-4" aria-hidden="true" />}
          Send a new code
        </Button>
      </div>

      {supportEmail ? (
        <p className="text-sm text-secondary">
          Still stuck? Write to{' '}
          <a href={`mailto:${supportEmail}`} className="link">
            {supportEmail}
          </a>{' '}
          with your roll number and the address you are trying to use.
        </p>
      ) : null}
    </div>
  );
}
