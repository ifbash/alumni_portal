'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Mail } from 'lucide-react';
import {
  Alert,
  Button,
  ButtonLink,
  Checkbox,
  Disclosure,
  Field,
  Input,
  Select,
  describedBy,
} from '@/components/ui';
import type { rollNumber } from '@/lib/branding/copy';
import { cn } from '@/lib/cn';
import { mailto } from '@/lib/mailto';

/**
 * Alumni registration against the degree register.
 *
 * The four identity fields are the ones the matcher scores; everything
 * else on this form exists to tell the person what happens to them next.
 * They are asked for the name **on the certificate** rather than the name
 * they use, because that is the string the register holds — and a form
 * that asks for the wrong one manufactures the ambiguous registrations a
 * person then has to resolve by hand.
 *
 * The consent checkbox records the notice version it was given against.
 * A consent that cannot be tied back to the exact words shown is not
 * evidence of anything, which is why its label must not be reworded
 * without a new NOTICE_VERSION.
 *
 * "What happens next" and "If your record will not match" live in here,
 * not in the page, so the help mailto can carry what has been typed.
 */

interface DepartmentOption {
  code: string;
  name: string;
}

type RollCopy = ReturnType<typeof rollNumber>;

const FIELDS = ['rollNumber', 'fullName', 'departmentCode', 'yearOfPassing', 'email', 'mobile', 'consent'] as const;
type FieldKey = (typeof FIELDS)[number];
type Errors = Partial<Record<FieldKey, string>>;

type ServerAlert =
  | { kind: 'failed'; message: string; offerEmail: boolean }
  | { kind: 'already_registered'; email: string }
  | { kind: 'pending'; email: string }
  | { kind: 'notice_changed'; message: string }
  | { kind: 'rate_limited'; message: string }
  | { kind: 'rejected' };

type ClaimResponse = {
  error?: string;
  code?: string;
  status?: string;
  fieldErrors?: Record<string, string>;
} | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HELP_ID = 'roll-number-help';

const SOMETHING_WRONG = 'Something went wrong on our side. Try again in a minute — nothing has been recorded.';

/** Digits only; a pasted "+91 98765 43210" becomes the ten digits the API expects. */
function normaliseMobile(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
}

/** Scrolls a control into view with its label above it, then focuses it. */
function focusControl(id: string) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLElement)) return;
  el.scrollIntoView({ block: 'center' });
  el.focus({ preventScroll: true });
}

export function ClaimForm({
  departments,
  years,
  initialYear,
  initialEmail,
  noticeVersion,
  supportEmail,
  shortName,
  office,
  roll,
  whatsappEnabled,
  reviewTurnaround,
}: {
  departments: DepartmentOption[];
  years: number[];
  initialYear?: number;
  initialEmail: string;
  noticeVersion: string;
  supportEmail?: string;
  shortName: string;
  office: string;
  roll: RollCopy;
  whatsappEnabled: boolean;
  reviewTurnaround?: string;
}) {
  const router = useRouter();
  const alertRef = React.useRef<HTMLDivElement>(null);

  const [values, setValues] = React.useState({
    rollNumber: '',
    fullName: '',
    departmentCode: '',
    yearOfPassing: String(initialYear ?? ''),
    email: initialEmail,
    mobile: '',
  });
  const [consent, setConsent] = React.useState(false);
  const [errors, setErrors] = React.useState<Errors>({});
  const [showSummary, setShowSummary] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [serverAlert, setServerAlert] = React.useState<ServerAlert | null>(null);

  const [src0, src1] = roll.sourcesMid;

  const labels: Record<FieldKey, string> = {
    rollNumber: roll.label,
    fullName: 'Name as printed on your degree certificate',
    departmentCode: 'Branch',
    yearOfPassing: 'Year of passing',
    email: 'Email address',
    mobile: 'Mobile number',
    consent: 'Consent to the register check',
  };

  // `/claim#roll-number-help` is linked from the landing page and the
  // footer. A closed <details> does not open itself for a fragment, so
  // open it on arrival and whenever the hash changes to it.
  React.useEffect(() => {
    function openHelp() {
      if (window.location.hash !== `#${HELP_ID}`) return;
      const el = document.getElementById(HELP_ID);
      if (!(el instanceof HTMLDetailsElement)) return;
      el.open = true;
      el.scrollIntoView({ block: 'start' });
    }
    openHelp();
    window.addEventListener('hashchange', openHelp);
    return () => window.removeEventListener('hashchange', openHelp);
  }, []);

  // A server answer is announced and focused, so a keyboard or
  // screen-reader user lands on it rather than on a button that did
  // nothing visible.
  React.useEffect(() => {
    if (serverAlert) alertRef.current?.focus();
  }, [serverAlert]);

  function set<K extends keyof typeof values>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): Errors {
    const next: Errors = {};
    const officeAction = supportEmail ? `Email the ${office}` : `Contact the ${office}`;

    const rollValue = values.rollNumber.trim();
    if (!rollValue) next.rollNumber = `Enter your ${roll.mid}. It is on your ${src0} and ${src1}.`;
    else if (rollValue.replace(/\s/g, '').length < 6)
      next.rollNumber = `That looks too short. Copy the ${roll.mid} from your certificate.`;

    const name = values.fullName.trim();
    if (!name) next.fullName = 'Enter your name exactly as it is printed on the certificate.';
    else if (name.length < 3) next.fullName = 'Enter your full name, not initials alone.';

    if (!values.departmentCode) next.departmentCode = 'Choose the branch you graduated in.';

    if (!values.yearOfPassing) next.yearOfPassing = 'Choose the year your degree was awarded.';
    else if (values.yearOfPassing === 'unlisted')
      next.yearOfPassing = `The register does not include that year yet. ${officeAction} using the button below.`;

    const email = values.email.trim();
    if (!email) next.email = 'Enter an email address — you will sign in with it.';
    else if (!EMAIL_RE.test(email)) next.email = 'That does not look like an email address. Check for a typo.';

    const mobile = normaliseMobile(values.mobile);
    if (mobile && mobile.length !== 10)
      next.mobile = 'A mobile number is ten digits. Leave it blank if you would rather not give one.';

    if (!consent) next.consent = 'Tick the box so the college can check your details against its register.';

    return next;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerAlert(null);

    const found = validate();
    setErrors(found);
    const invalid = FIELDS.filter((k) => found[k]);
    if (invalid.length > 0) {
      setShowSummary(true);
      // Focus goes to the control, not the summary: the person fixes the
      // first thing without having to find it.
      focusControl(invalid[0]!);
      return;
    }
    setShowSummary(false);

    const email = values.email.trim();
    setPending(true);

    let res: Response;
    try {
      res = await fetch('/api/auth/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          rollNumber: values.rollNumber.trim().toUpperCase(),
          fullName: values.fullName.trim(),
          departmentCode: values.departmentCode,
          yearOfPassing: Number(values.yearOfPassing),
          email,
          mobile: normaliseMobile(values.mobile) || null,
          consent: { accepted: true, noticeVersion },
        }),
      });
    } catch {
      setServerAlert({
        kind: 'failed',
        message: 'We could not reach the portal. Check your connection and try again — nothing has been recorded.',
        offerEmail: false,
      });
      setPending(false);
      return;
    }

    const data = (await res.json().catch(() => null)) as ClaimResponse;

    if (res.ok && (data?.status === 'approved' || data?.status === 'queued')) {
      // `match=1` tells /pending the records check is already done. An exact
      // match still waits for the office to confirm it.
      const params = new URLSearchParams({ email, ...(data?.status === 'approved' ? { match: '1' } : {}) });
      router.push(`/pending?${params.toString()}`);
      return;
    }

    setPending(false);

    if (res.ok && data?.status === 'rejected') {
      setServerAlert({ kind: 'rejected' });
      return;
    }

    if (res.status === 422 && data?.fieldErrors) {
      const mapped: Errors = {};
      for (const [key, message] of Object.entries(data.fieldErrors)) {
        const field = key.startsWith('consent') ? 'consent' : key;
        if ((FIELDS as readonly string[]).includes(field) && !mapped[field as FieldKey]) {
          mapped[field as FieldKey] = message;
        }
      }
      const first = FIELDS.find((k) => mapped[k]);
      if (first) {
        setErrors(mapped);
        focusControl(first);
        return;
      }
    }

    if (res.status === 422) {
      setServerAlert({ kind: 'failed', message: data?.error ?? SOMETHING_WRONG, offerEmail: false });
      return;
    }

    if (res.status === 409 && data?.code === 'already_registered') {
      setServerAlert({ kind: 'already_registered', email });
      return;
    }
    if (res.status === 409 && data?.code === 'claim_pending') {
      setServerAlert({ kind: 'pending', email });
      return;
    }
    if (res.status === 409 && data?.code === 'notice_changed') {
      setServerAlert({ kind: 'notice_changed', message: data.error ?? '' });
      return;
    }
    if (res.status === 429) {
      setServerAlert({
        kind: 'rate_limited',
        message: data?.error ?? 'Too many registrations have been sent from here. Wait a while, then try again.',
      });
      return;
    }

    setServerAlert({ kind: 'failed', message: data?.error ?? SOMETHING_WRONG, offerEmail: Boolean(supportEmail) });
  }

  const loginHref = (email: string) => `/login${email ? `?email=${encodeURIComponent(email)}` : ''}`;

  /**
   * "Email the {office}", prefilled with whatever has been typed so far.
   * A plain render helper rather than a component: declared inside the
   * form, a component would be a new type on every keystroke and remount.
   */
  function registrationHelp(size: 'sm' | 'md' = 'md', className?: string) {
    if (!supportEmail) {
      return (
        <ButtonLink href="/contact#corrections" variant="secondary" size={size} className={cn('min-h-11', className)}>
          Contact the {office}
        </ButtonLink>
      );
    }
    const href = mailto(supportEmail, `Registration help — ${shortName} alumni portal`, [
      `${roll.label}: ${values.rollNumber.trim().toUpperCase()}`,
      `Name as on the certificate: ${values.fullName.trim()}`,
      `Branch: ${values.departmentCode}`,
      `Year of passing: ${values.yearOfPassing === 'unlisted' ? '' : values.yearOfPassing}`,
      `Email address: ${values.email.trim()}`,
      '',
      'What is not matching:',
    ]);
    return (
      <ButtonLink href={href} variant="secondary" size={size} className={cn('min-h-11', className)}>
        <Mail className="size-4" aria-hidden="true" />
        Email the {office}
      </ButtonLink>
    );
  }

  const summaryKeys = showSummary ? FIELDS.filter((k) => errors[k]) : [];
  const unlisted = values.yearOfPassing === 'unlisted';

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} noValidate className="space-y-8">
        {summaryKeys.length > 0 ? (
          <Alert tone="danger" title={`Check ${summaryKeys.length} ${summaryKeys.length === 1 ? 'detail' : 'details'}`}>
            <ul>
              {summaryKeys.map((k) => (
                <li key={k}>
                  <a
                    href={`#${k}`}
                    className="inline-flex min-h-11 items-center font-medium"
                    onClick={(e) => {
                      e.preventDefault();
                      focusControl(k);
                    }}
                  >
                    {labels[k]}
                  </a>
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <div ref={alertRef} tabIndex={-1} className="scroll-mt-20 outline-none empty:hidden">
          {serverAlert ? renderServerAlert(serverAlert) : null}
        </div>

        {/* ---------------------------------------------- Your degree */}
        <fieldset className="space-y-5" aria-describedby="degree-intro">
          <legend className="font-display text-lg font-semibold">Your degree</legend>
          <p id="degree-intro" className="!mt-1 text-sm text-secondary">
            Exactly as your certificate shows it. This is what the college matches.
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              htmlFor="rollNumber"
              label={roll.label}
              hint={
                roll.example
                  ? `As printed on your certificate — for example ${roll.example}.`
                  : 'As printed on your certificate.'
              }
              error={errors.rollNumber}
              required
              className="sm:col-span-2"
            >
              <Input
                id="rollNumber"
                name="rollNumber"
                required
                sizeVariant="lg"
                className="min-h-11 font-mono uppercase"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                enterKeyHint="next"
                placeholder={roll.example}
                value={values.rollNumber}
                invalid={Boolean(errors.rollNumber)}
                aria-describedby={describedBy('rollNumber', { hint: true, error: Boolean(errors.rollNumber) })}
                onChange={(e) => set('rollNumber', e.target.value)}
              />
            </Field>

            <Disclosure
              id={HELP_ID}
              className="scroll-mt-20 sm:col-span-2"
              summary={`Where do I find my ${roll.mid}?`}
            >
              <ol className="space-y-4">
                <Step n={1} title="Check your certificates.">
                  <p>It is printed on each of these:</p>
                  <ul className="mt-1 list-disc pl-5">
                    {roll.sources.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </Step>
                <Step n={2} title="Copy it exactly.">
                  <p>
                    Letters and numbers, no spaces
                    {roll.example ? (
                      <>
                        , for example <span className="font-mono">{roll.example}</span>
                      </>
                    ) : null}
                    . Take it from the document, not from memory — a {roll.mid} typed from memory is
                    the most common reason a registration does not match.
                  </p>
                </Step>
                <Step n={3} title="Still cannot find it?">
                  <p>
                    Write to the {office} with your name as on the certificate, your branch and your
                    year of passing. They can look it up in the register.
                  </p>
                  {supportEmail ? (
                    <ButtonLink
                      variant="secondary"
                      size="sm"
                      className="mt-2 min-h-11"
                      href={mailto(supportEmail, `Finding my ${roll.mid} — ${shortName} alumni portal`, [
                        'Name as on the degree certificate:',
                        'Branch:',
                        'Year of passing:',
                        'Email address to reply to:',
                      ])}
                    >
                      <Mail className="size-4" aria-hidden="true" />
                      Email the {office}
                    </ButtonLink>
                  ) : (
                    <ButtonLink variant="secondary" size="sm" className="mt-2 min-h-11" href="/contact">
                      Contact the {office}
                    </ButtonLink>
                  )}
                </Step>
              </ol>
            </Disclosure>

            <Field
              htmlFor="fullName"
              label={labels.fullName}
              hint="In full, exactly as printed. If it says Venkata Sai Krishna, write that — not V. S. Krishna."
              error={errors.fullName}
              required
              className="sm:col-span-2"
            >
              <Input
                id="fullName"
                name="fullName"
                required
                sizeVariant="lg"
                className="min-h-11"
                autoComplete="name"
                autoCapitalize="words"
                value={values.fullName}
                invalid={Boolean(errors.fullName)}
                aria-describedby={describedBy('fullName', { hint: true, error: Boolean(errors.fullName) })}
                onChange={(e) => set('fullName', e.target.value)}
              />
            </Field>

            <Field
              htmlFor="departmentCode"
              label="Branch"
              error={errors.departmentCode}
              required
              // Side by side with the year, whose hint wraps to two lines: push
              // this select down so the two controls line up. The control's
              // wrapper is the Field's only <div> child.
              className={cn(!errors.yearOfPassing && 'sm:flex sm:flex-col sm:[&>div]:!mt-auto')}
            >
              <Select
                id="departmentCode"
                name="departmentCode"
                required
                sizeVariant="lg"
                className="min-h-11"
                value={values.departmentCode}
                invalid={Boolean(errors.departmentCode)}
                aria-describedby={describedBy('departmentCode', { error: Boolean(errors.departmentCode) })}
                onChange={(e) => set('departmentCode', e.target.value)}
              >
                <option value="">Choose your branch</option>
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
              hint="The year your degree was awarded, not the year you joined."
              error={errors.yearOfPassing}
              required
            >
              <Select
                id="yearOfPassing"
                name="yearOfPassing"
                required
                sizeVariant="lg"
                className="min-h-11"
                value={values.yearOfPassing}
                invalid={Boolean(errors.yearOfPassing)}
                aria-describedby={describedBy('yearOfPassing', { hint: true, error: Boolean(errors.yearOfPassing) })}
                onChange={(e) => set('yearOfPassing', e.target.value)}
              >
                <option value="">Choose a year</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
                <option value="unlisted">My year is not listed</option>
              </Select>
            </Field>

            {unlisted ? (
              <Alert tone="neutral" title="Your year is not on the register yet" className="sm:col-span-2">
                <p>
                  The college has not loaded that batch. Write to the {office} and they will add you by
                  hand.
                </p>
                {registrationHelp('sm', 'mt-2 !no-underline')}
              </Alert>
            ) : null}
          </div>
        </fieldset>

        {/* ---------------------------------------- How we will reach you */}
        <fieldset className="space-y-5" aria-describedby="reach-intro">
          <legend className="font-display text-lg font-semibold">How we will reach you</legend>
          <p id="reach-intro" className="!mt-1 text-sm text-secondary">
            You will sign in with this email.
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              htmlFor="email"
              label="Email address"
              hint="Use a personal address you will keep — not a college or work email."
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
                sizeVariant="lg"
                className="min-h-11"
                leading={<Mail className="size-4" />}
                value={values.email}
                invalid={Boolean(errors.email)}
                aria-describedby={describedBy('email', { hint: true, error: Boolean(errors.email) })}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>

            <Field
              htmlFor="mobile"
              label="Mobile number (optional)"
              hint={
                whatsappEnabled
                  ? `For account recovery and WhatsApp updates from the ${office}. Never used to sign in.`
                  : 'Used only to help you recover your account. Never used to sign in.'
              }
              error={errors.mobile}
              className="sm:col-span-2"
            >
              <Input
                id="mobile"
                name="mobile"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                sizeVariant="lg"
                className="min-h-11"
                leading={<span className="text-xs font-medium text-secondary">+91</span>}
                value={values.mobile}
                invalid={Boolean(errors.mobile)}
                aria-describedby={describedBy('mobile', { hint: true, error: Boolean(errors.mobile) })}
                onChange={(e) => set('mobile', e.target.value)}
              />
            </Field>
          </div>
        </fieldset>

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
          <Button type="submit" size="lg" loading={pending} className="min-h-11">
            {pending ? 'Submitting your registration' : 'Submit registration'}
            {pending ? null : <ArrowRight className="size-4" aria-hidden="true" />}
          </Button>
          <Link
            href={loginHref(values.email.trim())}
            className="inline-flex min-h-11 items-center text-sm text-secondary hover:text-primary"
          >
            I already have an account
          </Link>
        </div>
      </form>

      {/* ------------------------------------------------ What happens next */}
      <section aria-labelledby="next-title" className="space-y-3">
        <h2 id="next-title" className="font-display text-lg font-semibold">
          What happens next
        </h2>
        <ol className="space-y-4">
          <Step n={1} title="We check the college's records." titleClassName="text-base">
            <p>
              Your {roll.mid}, name, branch and year are matched against the degree register.
            </p>
          </Step>
          <Step n={2} title={`The ${office} confirms the match.`} titleClassName="text-base">
            <p>
              They open your account once it is confirmed
              {reviewTurnaround ? `, usually within ${reviewTurnaround}` : ''}. Anything unclear is
              compared by hand, record against record.
            </p>
          </Step>
          <Step n={3} title="You sign in with a code." titleClassName="text-base">
            <p>
              We email you at the address you gave either way. Once your account is open, you sign in
              with a six-digit code — there is no password.
            </p>
          </Step>
        </ol>
      </section>

      {/* ------------------------------------------ If your record will not match */}
      <section
        aria-labelledby="mismatch-title"
        className="space-y-2 rounded-lg border border-line bg-surface-sunken p-4"
      >
        <h2 id="mismatch-title" className="text-base font-semibold">
          If your record will not match
        </h2>
        <p className="text-sm text-secondary">
          Changed your name since graduating, passed in a supplementary examination, or joined through
          lateral entry? Register with your details exactly as the certificate shows them, then write
          to the {office} with a scan of it. They correct the record rather than turn you away.
        </p>
        {registrationHelp('md', 'mt-1')}
      </section>
    </div>
  );

  function renderServerAlert(a: ServerAlert): React.ReactNode {
    switch (a.kind) {
      case 'rejected':
        return (
          <Alert tone="warning" title="We could not find a matching record">
            <p>
              This usually means the {roll.mid} was typed from memory. Check it against your
              certificate and submit again. If it still does not match, the {office} can look it up by
              hand.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" className="min-h-11" onClick={() => focusControl('rollNumber')}>
                Check my {roll.mid}
              </Button>
              {registrationHelp('sm', '!no-underline')}
            </div>
          </Alert>
        );
      case 'already_registered':
        return (
          <Alert tone="warning" title="You already have an account">
            <p>There is an account on {a.email}. Sign in instead — a code will be emailed to you.</p>
            <ButtonLink size="sm" className="mt-2 min-h-11 !no-underline" href={loginHref(a.email)}>
              Sign in
            </ButtonLink>
          </Alert>
        );
      case 'pending':
        return (
          <Alert tone="warning" title={`Already with the ${office}`}>
            <p>A registration for this {roll.mid} is already being checked.</p>
            <Link
              href={`/pending?${new URLSearchParams({ email: a.email }).toString()}`}
              className="inline-flex min-h-11 items-center font-medium"
            >
              See where it is
            </Link>
          </Alert>
        );
      case 'notice_changed':
        return (
          <Alert tone="warning" title="The privacy notice has changed">
            {a.message ? <p>{a.message}</p> : null}
            <Button type="button" variant="secondary" size="sm" className="mt-2 min-h-11" onClick={() => location.reload()}>
              Reload the page
            </Button>
          </Alert>
        );
      case 'rate_limited':
        return (
          <Alert tone="warning" title="Please wait before trying again">
            <p>{a.message}</p>
          </Alert>
        );
      case 'failed':
        return (
          <Alert tone="danger" title="Your registration was not sent">
            <p>{a.message}</p>
            {a.offerEmail && supportEmail ? (
              <p className="pt-1">
                If it keeps failing, email <a href={`mailto:${supportEmail}`}>{supportEmail}</a> with your{' '}
                {roll.mid} and year of passing.
              </p>
            ) : null}
          </Alert>
        );
    }
  }
}

/** One numbered step: a disc, a title, and a line or two under it. */
function Step({
  n,
  title,
  titleClassName,
  children,
}: {
  n: number;
  title: string;
  titleClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft font-display text-xs font-bold text-brand-soft-fg tabular"
        aria-hidden="true"
      >
        {n}
      </span>
      <div className="min-w-0 space-y-1 pt-0.5 text-sm text-secondary">
        <p className={cn('font-semibold text-primary', titleClassName)}>{title}</p>
        {children}
      </div>
    </li>
  );
}
