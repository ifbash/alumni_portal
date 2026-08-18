'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Mail, TriangleAlert, UserRoundCheck } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, Field, Input, describedBy } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * Sign-in form.
 *
 * Email only. Mobile is captured later, at profile completion, and is
 * used for recovery and WhatsApp — never as the credential. An alumni
 * list where the phone number is the login is a list that locks out
 * everyone who changed operators, which is most of a 2014 batch.
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

const GENERIC_FAILURE =
  'We could not send a code just now. Check the address and try again in a moment.';

export function LoginForm({
  demoAccounts,
  supportEmail,
  next,
  initialEmail = '',
}: {
  demoAccounts: DemoAccountView[];
  supportEmail?: string;
  next?: string;
  initialEmail?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = React.useState(initialEmail);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errorCode, setErrorCode] = React.useState<string | null>(null);

  // The kit's `Input` is a plain server-safe function component with no
  // forwarded ref, so focus is moved by id rather than by threading a ref
  // through the whole form layer for one call.
  function focusEmail() {
    const el = document.getElementById('email');
    if (el instanceof HTMLInputElement) el.focus();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const address = email.trim();
    if (!address) {
      setError('Enter the email address the college has for you.');
      setErrorCode(null);
      focusEmail();
      return;
    }

    setPending(true);
    setError(null);
    setErrorCode(null);

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

      if (!res.ok || data?.error) {
        setErrorCode(data?.code ?? null);
        setError(
          data?.error ??
            (res.status === 429
              ? 'Too many codes requested from here. Wait a minute before trying again.'
              : GENERIC_FAILURE),
        );
        setPending(false);
        return;
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
      setError(GENERIC_FAILURE);
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <Field
          htmlFor="email"
          label="Email address"
          hint="Use the address the college has on file. If you are not sure which one that is, try the personal address you gave at graduation."
          error={error}
          required
        >
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            required
            sizeVariant="lg"
            placeholder="you@example.com"
            leading={<Mail className="size-4" />}
            value={email}
            invalid={Boolean(error)}
            aria-describedby={describedBy('email', { hint: true, error: Boolean(error) })}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        {errorCode === 'unknown_email' ? (
          <Alert tone="warning" title="No account on that address" icon={<TriangleAlert className="size-4" />}>
            <p>
              Nothing on the portal is registered to that address. If you graduated from here,{' '}
              <Link href="/claim">claim your profile</Link> with your roll number and the alumni cell
              will match you against the degree register.
            </p>
          </Alert>
        ) : null}

        <Button type="submit" size="lg" loading={pending} className="w-full">
          {pending ? 'Sending your code' : 'Email me a sign-in code'}
          {pending ? null : <ArrowRight className="size-4" aria-hidden="true" />}
        </Button>

        <p className="text-sm text-secondary">
          Never signed in before?{' '}
          <Link href="/claim" className="link">
            Claim your profile
          </Link>{' '}
          — you will need your roll number and year of passing.
        </p>
      </form>

      {demoAccounts.length > 0 ? (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="font-display text-base font-semibold">Demonstration accounts</h2>
                <p className="text-sm text-secondary">
                  This portal is running on seeded data with no database behind it. Pick a role to
                  fill in its address, then send yourself a code — it is printed on the next screen.
                </p>
              </div>
              <Badge tone="warning" dot>
                Fixture mode
              </Badge>
            </div>

            <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {demoAccounts.map((a) => {
                const active = a.email.toLowerCase() === email.trim().toLowerCase();
                return (
                  <li key={a.email}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setEmail(a.email);
                        setError(null);
                        setErrorCode(null);
                        focusEmail();
                      }}
                      className={cn(
                        'w-full rounded-lg border p-3 text-left transition-colors duration-fast ease-brand',
                        active
                          ? 'border-line-strong bg-brand-soft'
                          : 'border-line bg-surface hover:bg-surface-sunken',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <UserRoundCheck
                          className={cn('size-4 shrink-0', active ? 'text-brand-soft-fg' : 'text-muted')}
                          aria-hidden="true"
                        />
                        <span className={cn('font-semibold', active && 'text-brand-soft-fg')}>
                          {a.label}
                        </span>
                        <span className="ml-auto font-mono text-xs text-muted">{a.email}</span>
                      </span>
                      <span className="mt-1 block text-sm text-secondary">{a.description}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {supportEmail ? (
        <p className="text-sm text-secondary">
          Changed your email since graduation and cannot get in? Write to{' '}
          <a href={`mailto:${supportEmail}`} className="link">
            {supportEmail}
          </a>{' '}
          with your roll number and year of passing.
        </p>
      ) : null}
    </div>
  );
}
