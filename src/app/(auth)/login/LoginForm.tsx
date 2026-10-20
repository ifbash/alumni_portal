'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, ChevronDown, GraduationCap, KeyRound, LifeBuoy, Mail } from 'lucide-react';
import { Badge, Button, ButtonLink, Field, Input, describedBy } from '@/components/ui';
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
 * The demo picker is last. On a phone it is a collapsed disclosure so the
 * real sign-in keeps the screen; from lg up it is always open, which is how
 * every demo starts, and the e2e suite asserts its buttons are visible
 * without interaction.
 *
 * This is the only client component on the page. The demo accounts are
 * resolved on the server and passed in already narrowed to three display
 * fields, so no role data reaches the browser bundle.
 *
 * It returns a fragment: its blocks are direct children of the page's
 * `.stagger` wrapper, so the whole screen enters as one sequence.
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

/** Stagger index for the entrance; see `.stagger` in globals.css. */
const at = (n: number) => ({ '--i': n }) as React.CSSProperties;

/** Two letters for a role's avatar: "Final-year student" is FS, "HOD (CSE)" is HO. Decoration. */
function initials(label: string): string {
  const words = label
    .replace(/\(.*?\)/g, '')
    .split(/[\s-]+/)
    .filter(Boolean);
  const letters = words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? label).slice(0, 2);
  return letters.toUpperCase();
}

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
  // Phones only: from lg up the picker is always open (see the section below).
  const [demoOpen, setDemoOpen] = React.useState(false);

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
    <>
      {/* -------------------------------------------------------------- Form */}
      <form onSubmit={onSubmit} noValidate className="space-y-5" style={at(1)}>
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
            className={cn(
              'min-h-14 rounded-lg text-lg shadow-sm',
              // A soft halo on top of the ring: focus is unmistakable even on a bright phone.
              'focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--focus-ring)_16%,transparent)]',
            )}
            placeholder="you@example.com"
            leading={<Mail className="size-5" />}
            value={email}
            invalid={Boolean(error)}
            aria-describedby={describedBy('email', { hint: true, error: Boolean(error) })}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Button
          id="login-submit"
          type="submit"
          size="lg"
          loading={pending}
          className="group min-h-14 w-full shadow-md"
        >
          {pending ? 'Sending your code' : 'Email me a sign-in code'}
          {pending ? null : (
            <ArrowRight
              className="size-4 transition-transform duration-fast ease-brand group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          )}
        </Button>

        <p className="flex items-center justify-center gap-2 text-xs text-secondary">
          <KeyRound className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Each code works once and expires after {otpMinutes} minutes.</span>
        </p>
      </form>

      {/* ------------------------------------------------ New-member path */}
      <div
        style={at(2)}
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-lg border border-line bg-surface-sunken p-4"
      >
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-sm font-semibold text-primary">New here?</p>
          <p className="text-sm text-secondary">
            Graduates register once with their {rollMid} and year of passing.
          </p>
        </div>
        <ButtonLink href={registerHref} variant="secondary" size="md" className="min-h-11 shrink-0">
          Register with your {rollMid}
        </ButtonLink>
      </div>

      {/* ------------------------------------------------------------ Help */}
      <ul style={at(3)} className="space-y-3 text-sm text-secondary">
        <li className="flex gap-3">
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-soft-fg"
          >
            <GraduationCap className="size-4" />
          </span>
          <span className="pt-1">
            <strong className="font-semibold text-primary">Final-year student?</strong> Use the email
            address your placement cell&apos;s invitation was sent to. You do not need to register.
          </span>
        </li>
        <li className="flex gap-3">
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-soft-fg"
          >
            <LifeBuoy className="size-4" />
          </span>
          <span className="pt-1">
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
          style={at(4)}
          aria-labelledby="demo-title"
          className="rounded-lg border border-line bg-surface-raised"
        >
          {/* A toggle on phones, a plain heading from lg up (the list never closes there). */}
          <div className="flex items-center justify-between gap-3 p-3 pl-4">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h2 id="demo-title" className="text-sm font-semibold">
                Demonstration accounts
              </h2>
              <Badge tone="warning" dot>
                Fixture mode
              </Badge>
            </div>
            <button
              type="button"
              aria-expanded={demoOpen}
              aria-controls="demo-picker"
              onClick={() => setDemoOpen((o) => !o)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded px-2 text-sm font-medium text-secondary hover:text-primary lg:hidden"
            >
              {demoOpen ? 'Hide' : `Show ${demoAccounts.length}`}
              <ChevronDown
                className={cn('size-4 transition-transform duration-fast ease-brand', demoOpen && 'rotate-180')}
                aria-hidden="true"
              />
            </button>
          </div>

          <div
            id="demo-picker"
            className={cn('border-t border-line p-3 pt-3', demoOpen ? 'block' : 'hidden lg:block')}
          >
            <p className="mb-3 px-1 text-xs text-secondary">
              Seeded data, and no email is sent. Pick a role, then choose Email me a sign-in code — the
              code appears on the next screen.
            </p>

            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {demoAccounts.map((a) => {
                const active = picked?.email === a.email;
                return (
                  <li key={a.email}>
                    <button
                      type="button"
                      aria-pressed={active}
                      title={a.email}
                      onClick={() => pickDemo(a)}
                      className={cn(
                        'flex min-h-11 w-full items-center gap-2 rounded-lg border p-2 text-left',
                        'transition-[background-color,border-color,transform] duration-fast ease-brand active:scale-[0.98]',
                        active
                          ? 'border-[var(--focus-ring)] bg-brand-soft'
                          : 'border-line bg-surface hover:border-line-strong hover:bg-surface-sunken',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'grid size-7 shrink-0 place-items-center rounded-full font-display text-[11px] font-bold',
                          active
                            ? 'bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)]'
                            : 'bg-brand-soft text-brand-soft-fg',
                        )}
                      >
                        {active ? <Check className="size-3.5" /> : initials(a.label)}
                      </span>
                      <span
                        className={cn(
                          'min-w-0 text-xs font-medium leading-tight',
                          active ? 'text-brand-soft-fg' : 'text-primary',
                        )}
                      >
                        {a.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <p aria-live="polite" className="mt-3 min-h-10 px-1 text-xs text-secondary">
              {picked ? (
                <>
                  <span className="font-semibold text-primary">{picked.label}</span>
                  <span className="mx-1.5 font-mono">{picked.email}</span>
                  <br />
                  {picked.description}
                </>
              ) : (
                'Each role sees a different portal. Pick one to see what it can do.'
              )}
            </p>
          </div>
        </section>
      ) : null}
    </>
  );
}
