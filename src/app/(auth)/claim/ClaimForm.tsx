'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Mail, Smartphone, TriangleAlert } from 'lucide-react';
import {
  Alert,
  Button,
  Checkbox,
  Field,
  Input,
  Select,
  describedBy,
} from '@/components/ui';

/**
 * Self-registration against the degree register.
 *
 * The four identity fields are the ones the matcher scores; everything
 * else on this form exists to tell the person what happens to them next.
 * They are asked for the name **on the certificate** rather than the name
 * they use, because that is the string the register holds — and a form
 * that asks for the wrong one manufactures the ambiguous claims a human
 * then has to resolve.
 *
 * The consent checkbox records the notice version it was given against.
 * A consent that cannot be tied back to the exact words shown is not
 * evidence of anything.
 */

interface DepartmentOption {
  code: string;
  name: string;
}

type Errors = Partial<Record<'rollNumber' | 'fullName' | 'departmentCode' | 'yearOfPassing' | 'email' | 'mobile' | 'consent', string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function ClaimForm({
  departments,
  years,
  noticeVersion,
  supportEmail,
}: {
  departments: DepartmentOption[];
  years: number[];
  noticeVersion: string;
  supportEmail?: string;
}) {
  const router = useRouter();

  const [values, setValues] = React.useState({
    rollNumber: '',
    fullName: '',
    departmentCode: '',
    yearOfPassing: '',
    email: '',
    mobile: '',
  });
  const [consent, setConsent] = React.useState(false);
  const [errors, setErrors] = React.useState<Errors>({});
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formErrorCode, setFormErrorCode] = React.useState<string | null>(null);

  function set<K extends keyof typeof values>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): Errors {
    const next: Errors = {};

    const roll = values.rollNumber.trim();
    if (!roll) next.rollNumber = 'Your roll number is on your degree certificate and your marks memos.';
    else if (roll.replace(/\s/g, '').length < 8)
      next.rollNumber = 'That looks too short for a roll number — it is usually ten characters.';

    if (!values.fullName.trim()) next.fullName = 'Enter your name exactly as it is printed on the certificate.';
    else if (values.fullName.trim().length < 3) next.fullName = 'Enter your full name, not initials alone.';

    if (!values.departmentCode) next.departmentCode = 'Pick the branch you graduated in.';
    if (!values.yearOfPassing) next.yearOfPassing = 'Pick the year your degree was awarded.';

    const email = values.email.trim();
    if (!email) next.email = 'We need an address to tell you the outcome.';
    else if (!EMAIL_RE.test(email)) next.email = 'That does not look like an email address.';

    const mobile = values.mobile.replace(/\D/g, '');
    if (mobile && mobile.length !== 10) next.mobile = 'An Indian mobile number is ten digits. Leave it blank if you would rather not give one.';

    if (!consent) next.consent = 'We cannot check your records against the register without your agreement.';

    return next;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setFormErrorCode(null);

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = Object.keys(found)[0];
      const el = first ? document.getElementById(first) : null;
      if (el instanceof HTMLElement) el.focus();
      return;
    }

    setPending(true);

    try {
      const res = await fetch('/api/auth/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          rollNumber: values.rollNumber.trim().toUpperCase(),
          fullName: values.fullName.trim(),
          departmentCode: values.departmentCode,
          yearOfPassing: Number(values.yearOfPassing),
          email: values.email.trim(),
          mobile: values.mobile.replace(/\D/g, '') || null,
          consent: { accepted: true, noticeVersion },
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | { error?: string; code?: string; field?: string }
        | null;

      if (!res.ok || data?.error) {
        setFormErrorCode(data?.code ?? null);
        setFormError(
          data?.error ??
            'We could not submit your claim just now. Try again in a minute — nothing has been recorded.',
        );
        setPending(false);
        return;
      }

      const params = new URLSearchParams({ email: values.email.trim() });
      router.push(`/pending?${params.toString()}`);
    } catch {
      setFormError(
        'We could not reach the portal. Check your connection and try again — nothing has been recorded.',
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {formError ? (
        <Alert tone="danger" title="Your claim was not submitted" icon={<TriangleAlert className="size-4" />}>
          <p>{formError}</p>
          {formErrorCode === 'already_registered' ? (
            <p className="pt-1">
              <Link href={`/login?email=${encodeURIComponent(values.email.trim())}`}>
                Sign in instead
              </Link>{' '}
              — a code will be emailed to you.
            </p>
          ) : null}
          {formErrorCode === 'claim_pending' ? (
            <p className="pt-1">
              <Link href="/pending">See the status of your claim</Link>.
            </p>
          ) : null}
          {supportEmail && !formErrorCode ? (
            <p className="pt-1">
              If it keeps failing, email <a href={`mailto:${supportEmail}`}>{supportEmail}</a> with
              your roll number and year of passing.
            </p>
          ) : null}
        </Alert>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          htmlFor="rollNumber"
          label="Roll number"
          hint="As printed on your certificate — for example 13JN1A0501."
          error={errors.rollNumber}
          required
          className="sm:col-span-2"
        >
          <Input
            id="rollNumber"
            name="rollNumber"
            required
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="13JN1A0501"
            className="font-mono uppercase"
            value={values.rollNumber}
            invalid={Boolean(errors.rollNumber)}
            aria-describedby={describedBy('rollNumber', { hint: true, error: Boolean(errors.rollNumber) })}
            onChange={(e) => set('rollNumber', e.target.value)}
          />
        </Field>

        <Field
          htmlFor="fullName"
          label="Name as it appears on the degree certificate"
          hint="Not the short form you use day to day. If the certificate says Venkata Sai Krishna, write that."
          error={errors.fullName}
          required
          className="sm:col-span-2"
        >
          <Input
            id="fullName"
            name="fullName"
            required
            autoComplete="name"
            placeholder="Venkata Sai Krishna Kandula"
            value={values.fullName}
            invalid={Boolean(errors.fullName)}
            aria-describedby={describedBy('fullName', { hint: true, error: Boolean(errors.fullName) })}
            onChange={(e) => set('fullName', e.target.value)}
          />
        </Field>

        <Field htmlFor="departmentCode" label="Branch" error={errors.departmentCode} required>
          <Select
            id="departmentCode"
            name="departmentCode"
            required
            value={values.departmentCode}
            invalid={Boolean(errors.departmentCode)}
            aria-describedby={describedBy('departmentCode', { error: Boolean(errors.departmentCode) })}
            onChange={(e) => set('departmentCode', e.target.value)}
          >
            <option value="">Select your branch</option>
            {departments.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name} ({d.code})
              </option>
            ))}
          </Select>
        </Field>

        <Field
          htmlFor="yearOfPassing"
          label="Year of passing"
          hint="The year the degree was awarded, not the year you joined."
          error={errors.yearOfPassing}
          required
        >
          <Select
            id="yearOfPassing"
            name="yearOfPassing"
            required
            value={values.yearOfPassing}
            invalid={Boolean(errors.yearOfPassing)}
            aria-describedby={describedBy('yearOfPassing', { hint: true, error: Boolean(errors.yearOfPassing) })}
            onChange={(e) => set('yearOfPassing', e.target.value)}
          >
            <option value="">Select a year</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          htmlFor="email"
          label="Email address"
          hint="This becomes how you sign in. Use one you will still have in five years."
          error={errors.email}
          required
          className="sm:col-span-2"
        >
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            leading={<Mail className="size-4" />}
            value={values.email}
            invalid={Boolean(errors.email)}
            aria-describedby={describedBy('email', { hint: true, error: Boolean(errors.email) })}
            onChange={(e) => set('email', e.target.value)}
          />
        </Field>

        <Field
          htmlFor="mobile"
          label="Mobile number"
          hint="Optional. Used to send you the outcome on WhatsApp and to recover your account — never to sign in."
          error={errors.mobile}
          className="sm:col-span-2"
        >
          <Input
            id="mobile"
            name="mobile"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="98765 43210"
            leading={<Smartphone className="size-4" />}
            trailing={<span className="text-xs text-muted">+91</span>}
            value={values.mobile}
            invalid={Boolean(errors.mobile)}
            aria-describedby={describedBy('mobile', { hint: true, error: Boolean(errors.mobile) })}
            onChange={(e) => set('mobile', e.target.value)}
          />
        </Field>
      </div>

      <div className="space-y-2 rounded-lg border border-line bg-surface-sunken p-4">
        <Checkbox
          id="consent"
          name="consent"
          checked={consent}
          aria-invalid={errors.consent ? true : undefined}
          aria-describedby={errors.consent ? 'consent-error' : 'consent-hint'}
          onChange={(e) => {
            setConsent(e.target.checked);
            setErrors((err) => ({ ...err, consent: undefined }));
          }}
          label={
            <>
              I agree to the college checking these details against its degree register, and to a
              profile being created for me if they match.
            </>
          }
        />
        <p id="consent-hint" className="pl-[1.625rem] text-xs text-secondary">
          You are agreeing to the{' '}
          <Link href="/privacy" className="link" target="_blank" rel="noreferrer">
            privacy notice
          </Link>
          , version <span className="font-mono">{noticeVersion}</span>. That version is stored with
          your consent so it is always clear what you were shown. You can withdraw it later from your
          settings.
        </p>
        {errors.consent ? (
          <p id="consent-error" role="alert" className="flex gap-1.5 pl-[1.625rem] text-xs font-medium text-danger-fg">
            <span aria-hidden="true">⚠</span>
            <span>{errors.consent}</span>
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Button type="submit" size="lg" loading={pending}>
          {pending ? 'Submitting your claim' : 'Submit my claim'}
          {pending ? null : <ArrowRight className="size-4" aria-hidden="true" />}
        </Button>
        <Link href="/login" className="text-sm text-secondary hover:text-primary">
          I already have an account
        </Link>
      </div>
    </form>
  );
}
