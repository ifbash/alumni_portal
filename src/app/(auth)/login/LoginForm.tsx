'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, GraduationCap, KeyRound, LifeBuoy, Mail } from 'lucide-react';
import { Badge, Button, ButtonLink, Field, Input, Separator, describedBy } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * Sign-in form.
 *
 * Email only. Mobile is captured later, at profile completion, and is
 * used for recovery and WhatsApp — never as the credential. An alumni
 * list where the phone number is the login is a list that locks out
 * everyone who changed operators, which is most of a 2014 batch.
 *
 * Below the form, in order: the path for a graduate who has never signed
 * in (register with the roll number), help for the two people most likely
 * to be stuck, and — in fixture mode only — the demonstration accounts.
 * The demo block is last and always expanded: it is how every demo starts,
 * and the e2e suite asserts its buttons are visible without interaction.
 *
 * This is the only client component on the page. The demo accounts are
 * resolved on the server and passed in already narrowed to three display
 * fields, so no role data reaches the browser bundle.
 */

export interface DemoAccountView {
  email: string;
  label: string;
  description: string;
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const MSG_EMPTY = 'Enter the email address you registered with.';
const MSG_MALFORMED = 'That does not look like an email address — check for a typo.';
const MSG_RATE_LIMITED = 'Too many codes requested from here. Wait a minute, then try again.';
const MSG_FAILURE = 'We could not send a code just now. Check the address and try again in a moment.';

export function LoginForm({
  demoAccounts,
  next,
  initialEmail = '',
  rollMid,
  officeName,
  otpMinutes,
}: {
  demoAccounts: DemoAccountView[];
  next?: string;
  initialEmail?: string;
  /** The roll-number label as it reads mid-sentence ("roll number"). */
  rollMid: string;
  /** Used mid-sentence: "Contact the {officeName}". */
  officeName: string;
  otpMinutes: number;
}) {
  const router = useRouter();
  const emailRef = React.useRef<HTMLInputElement>(null);
  const [email, setEmail] = React.useState(initialEmail);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Focus the field only where there is a real pointer. On a phone,
  // focusing on load raises the keyboard over the Register path, which is
  // what half the people arriving from a WhatsApp link actually need.
  React.useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) emailRef.current?.focus();
  }, []);

  function fail(message: string) {
    setError(message);
    setPending(false);
    emailRef.current?.focus();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const address = email.trim();
    if (!address) return fail(MSG_EMPTY);
    if (!EMAIL_SHAPE.test(address)) return fail(MSG_MALFORMED);

    setPending(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: address }),
      });

      // A 404 or a proxy error returns HTML, not JSON. Parsing it must not
      // throw an unhandled error at the user.
      const data = (await res.json().catch(() => null)) as
        | { error?: string; code?: string; devCode?: string; retryAfter?: number }
        | null;

      // `/api/auth/otp` answers every well-formed address identically, by
      // design, so there is no "no account on that address" case to handle.
      if (!res.ok || data?.error) {
        return fail(data?.error ?? (res.status === 429 ? MSG_RATE_LIMITED : MSG_FAILURE));
      }

      // Fixture mode echoes the code so a demo works without an email
      // provider. Stashed in sessionStorage rather than the query string:
      // a login code does not belong in browser history.
      if (data?.devCode) {
        try {
          window.sessionStorage.setItem(`otp-dev:${address.toLowerCase()}`, data.devCode);
        } catch {
          /* private browsing — the verify screen simply will not show it */
        }
      }

      const params = new URLSearchParams({ email: address });
      if (next) params.set('next', next);
      router.push(`/verify?${params.toString()}`);
    } catch {
      fail(MSG_FAILURE);
    }
  }

  function pickDemo(a: DemoAccountView) {
    setEmail(a.email);
    setError(null);
    emailRef.current?.scrollIntoView({ block: 'center' });
    // The submit button, not the input: moving focus into a text field
    // would raise the keyboard on a phone for an address already filled.
    document.getElementById('login-submit')?.focus();
  }

  const trimmed = email.trim();
  const registerHref = EMAIL_SHAPE.test(trimmed)
    ? `/claim?email=${encodeURIComponent(trimmed)}`
    : '/claim';
  const picked = demoAccounts.find((a) => a.email.toLowerCase() === trimmed.toLowerCase()) ?? null;

  return (
    <div>
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <Field
          htmlFor="email"
          label="Email address"
          hint="The address you registered with, or the one your placement cell's invitation came to. Codes are only sent to registered addresses."
          error={error}
          required
        >
          <Input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            sizeVariant="lg"
            className="min-h-11"
            placeholder="you@example.com"
            leading={<Mail className="size-4" />}
            value={email}
            invalid={Boolean(error)}
            aria-describedby={describedBy('email', { hint: true, error: Boolean(error) })}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Button id="login-submit" type="submit" size="lg" loading={pending} className="min-h-11 w-full">
          {pending ? 'Sending your code' : 'Email me a sign-in code'}
          {pending ? null : <ArrowRight className="size-4" aria-hidden="true" />}
        </Button>

        <p className="flex items-start gap-2 text-xs text-secondary">
          <KeyRound className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>Each code works once and expires after {otpMinutes} minutes.</span>
        </p>
      </form>

      {/* ------------------------------------------------ New-member path */}
      <div className="mt-8 space-y-3">
        <Separator label="New here?" />
        <p className="text-sm text-secondary">
          Graduates register once with their {rollMid} and year of passing.
        </p>
        <ButtonLink href={registerHref} variant="secondary" size="lg" className="min-h-11 w-full">
          Register with your {rollMid}
        </ButtonLink>
      </div>

      {/* ------------------------------------------------------------ Help */}
      <ul className="mt-6 space-y-3 text-sm text-secondary">
        <li className="flex gap-2">
          <GraduationCap className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-primary">Final-year student?</strong> Use the email
            address your placement cell&apos;s invitation was sent to. You do not need to register.
          </span>
        </li>
        <li className="flex gap-2">
          <LifeBuoy className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-primary">Changed your email since graduating?</strong>{' '}
            <Link className="link" href="/contact#cannot-sign-in">
              Contact the {officeName}
            </Link>{' '}
            with your {rollMid} and year of passing.
          </span>
        </li>
      </ul>

      {/* ------------------------------------------- Demonstration accounts */}
      {demoAccounts.length > 0 ? (
        <section
          aria-labelledby="demo-title"
          className="mt-10 rounded-lg border border-dashed border-line-strong p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="demo-title" className="text-sm font-semibold">
              Demonstration accounts
            </h2>
            <Badge tone="warning" dot>
              Fixture mode
            </Badge>
          </div>
          <p className="mt-1 text-sm text-secondary">
            Seeded data, and no email is sent. Pick a role, then choose Email me a sign-in code — the
            code appears on the next screen.
          </p>

          <ul className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
            {demoAccounts.map((a) => {
              const active = picked?.email === a.email;
              return (
                <li key={a.email}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => pickDemo(a)}
                    className={cn(
                      'min-h-11 w-full rounded border px-3 py-2 text-left transition-colors duration-fast ease-brand',
                      active
                        ? 'border-line-strong bg-brand-soft'
                        : 'border-line bg-surface hover:bg-surface-sunken',
                    )}
                  >
                    <span className={cn('block text-sm font-semibold', active && 'text-brand-soft-fg')}>
                      {a.label}
                    </span>
                    <span
                      className={cn(
                        'block truncate font-mono text-xs',
                        active ? 'text-brand-soft-fg' : 'text-secondary',
                      )}
                    >
                      {a.email}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <p aria-live="polite" className="mt-3 text-sm text-secondary">
            {picked
              ? `${picked.label}: ${picked.description}`
              : 'Each role sees a different portal. Pick one to see what it can do.'}
          </p>
        </section>
      ) : null}
    </div>
  );
}
