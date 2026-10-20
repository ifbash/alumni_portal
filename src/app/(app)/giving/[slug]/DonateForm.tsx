'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Globe2, Heart, Lock } from 'lucide-react';

import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardDescription,
  CardTitle,
  Field,
  Fieldset,
  Input,
  Select,
  ShareActions,
  Switch,
  describedBy,
  useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { inSentence } from '@/lib/branding/copy';
import { api, outcomeToast } from '@/lib/client/api';

/**
 * The donate flow.
 *
 * Two things here are structural rather than cosmetic and must not be
 * simplified away:
 *
 *  1. **Where the money comes from is asked first**, before the amount,
 *     and it drives `is_foreign_contribution`. FCRA segregation happens at
 *     the point of collection. A contribution from outside India that is
 *     accepted first and reclassified later is the offence, not the fix.
 *     The disabled button below is a courtesy; `POST /api/donations` is
 *     the gate, and it refuses foreign money outright when the trust has
 *     no FCRA registration.
 *  2. **PAN above the threshold.** The field is required at the same
 *     amount the API requires it, so the refusal arrives on the field.
 *
 * It creates no payment. The endpoint validates, authorises, classifies
 * and audit-logs the contribution and then stops, and the end of the flow
 * says that nothing was charged.
 */

const PRESETS = [1000, 2500, 5000, 11000, 25000, 100000];

/** PAN is mandatory for an 80G receipt above this. */
const PAN_THRESHOLD = 50000;
const MIN_AMOUNT = 100;

const COUNTRIES: Array<{ code: string; name: string }> = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'DE', name: 'Germany' },
  { code: 'IE', name: 'Ireland' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'QA', name: 'Qatar' },
  { code: 'OTHER', name: 'Somewhere else' },
];

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

interface DonationResult {
  donation: {
    id: string;
    campaignTitle: string;
    amount: number;
    currency: string;
    sourceCountry: string;
    isForeignContribution: boolean;
    panProvided: boolean;
    listPublicly: boolean;
    state: 'initiated';
    receipt80gNo: string | null;
  };
  paymentRequired: boolean;
  note: string;
}

const CHOICE =
  'block cursor-pointer rounded border border-line bg-surface-raised px-3 py-2.5 text-center text-sm font-semibold ' +
  'transition-colors duration-fast ease-brand hover:border-line-strong ' +
  'peer-checked:border-[var(--button-primary-bg)] peer-checked:bg-brand-soft peer-checked:text-brand-soft-fg ' +
  'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus-ring)]';

export function DonateForm({
  campaignTitle,
  shortName,
  officeName,
  fcraRegistered,
  defaultCountry,
  donorName,
  donorFirstName,
  locale,
  currency,
  supportEmail,
  averageGift,
  receiptLabel,
  shareUrl,
  whatsappHref,
  mentorHref,
  postJobHref,
}: {
  campaignTitle: string;
  shortName: string;
  officeName: string;
  fcraRegistered: boolean;
  defaultCountry: string;
  donorName: string;
  donorFirstName: string;
  /** From the tenant's locale spec — this file must not import the fixture clock. */
  locale: string;
  currency: string;
  supportEmail: string | null;
  /** Raised divided by donors, from the page; null before anyone has given. */
  averageGift: number | null;
  /** "Receipt", or the college's own name for it. */
  receiptLabel: string;
  shareUrl: string;
  whatsappHref: string;
  /** Other ways to help, each only when the viewer's navigation offers it. */
  mentorHref: string | null;
  postJobHref: string | null;
}) {
  const toast = useToast();
  const router = useRouter();
  const params = useParams<{ slug: string }>();

  const [preset, setPreset] = React.useState<number | 'custom'>(5000);
  const [custom, setCustom] = React.useState('');
  const [country, setCountry] = React.useState(
    COUNTRIES.some((c) => c.code === defaultCountry) ? defaultCountry : 'OTHER',
  );
  // The country abroad to return to when someone flips India → abroad →
  // India → abroad. Empty until chosen: nobody is placed in a country.
  const lastAbroad = React.useRef(country !== 'IN' ? country : '');
  const [pan, setPan] = React.useState('');
  const [named, setNamed] = React.useState(true);
  const [errors, setErrors] = React.useState<{ amount?: string; pan?: string; country?: string }>({});
  const [refusal, setRefusal] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ data: DonationResult; persisted: boolean } | null>(
    null,
  );

  const money = React.useCallback(
    (n: number) =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(n),
    [locale, currency],
  );

  const customAmount = Number(custom.replace(/[^0-9]/g, ''));
  const amount = preset === 'custom' ? (Number.isFinite(customAmount) ? customAmount : 0) : preset;

  const isForeign = country !== 'IN';
  const refused = isForeign && !fcraRegistered;
  const panRequired = amount > PAN_THRESHOLD;
  const campaignSlug = params?.slug ?? '';

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;

    const next: { amount?: string; pan?: string; country?: string } = {};
    if (!amount || amount < MIN_AMOUNT) {
      next.amount = `Enter an amount of ${money(MIN_AMOUNT)} or more.`;
    }
    if (panRequired && !PAN_PATTERN.test(pan.trim().toUpperCase())) {
      next.pan = 'Ten characters, like ABCDE1234F. Required above ' + money(PAN_THRESHOLD) + '.';
    }

    setErrors(next);
    setRefusal(null);

    if (Object.keys(next).length > 0) {
      toast.error('Check the form', 'Nothing has been sent.');
      return;
    }

    setBusy(true);
    const outcome = await api.post<DonationResult>('/api/donations', {
      campaignSlug,
      amount,
      sourceCountry: country,
      pan: pan.trim() ? pan.trim().toUpperCase() : undefined,
      listPublicly: named,
    });
    setBusy(false);

    if (outcome.status === 'invalid') {
      setErrors({
        amount: outcome.fieldErrors.amount,
        pan: outcome.fieldErrors.pan,
        country: outcome.fieldErrors.sourceCountry,
      });
      if (outcome.fieldErrors.campaignSlug) setRefusal(outcome.fieldErrors.campaignSlug);
      const t = outcomeToast(outcome, '');
      if (t) toast.show(t);
      return;
    }

    if (outcome.status !== 'ok') {
      // The FCRA refusal arrives here, and it stays on the form next to
      // the country that caused it rather than becoming a toast that
      // disappears after eight seconds.
      setRefusal(outcome.message);
      const t = outcomeToast(outcome, '');
      if (t) toast.show(t);
      return;
    }

    setResult({ data: outcome.data, persisted: outcome.persisted });

    const t = outcomeToast(outcome, 'Contribution recorded — no payment created');
    if (t) toast.show(t);

    if (outcome.persisted) router.refresh();
  };

  const countryName = (code: string) =>
    code ? (COUNTRIES.find((c) => c.code === code)?.name ?? code) : 'outside India';

  const chooseOrigin = (abroad: boolean) => {
    setRefusal(null);
    setErrors((x) => ({ ...x, country: undefined }));
    if (abroad) setCountry(lastAbroad.current);
    else setCountry('IN');
  };

  if (result) {
    const d = result.data.donation;

    return (
      <Card as="section" aria-labelledby="donate-thanks" className="overflow-hidden shadow-md">
        <CardHeader variant="stack" className="bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--brand-soft)_80%,transparent),transparent)] pb-4">
          <span
            className="mb-1 grid size-11 place-items-center rounded-full bg-surface-raised text-brand-fg shadow-sm"
            aria-hidden="true"
          >
            <Heart className="size-5" />
          </span>
          <CardTitle as="h2" id="donate-thanks">
            Thank you, {donorFirstName}.
          </CardTitle>
          <CardDescription>
            Your {money(d.amount)} for {d.campaignTitle} is recorded.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-secondary">Online payment is not switched on yet, so nothing was charged.</p>

          <dl className="divide-y divide-line rounded-lg border border-line">
            <Row label="Campaign" value={d.campaignTitle} />
            <Row label="Amount" value={money(d.amount)} />
            <Row
              label="From"
              value={
                d.isForeignContribution
                  ? `${countryName(d.sourceCountry)} · a foreign contribution`
                  : countryName(d.sourceCountry)
              }
            />
            <Row label="Shown as" value={d.listPublicly ? donorName : 'Kept private'} />
            <Row label="PAN" value={d.panProvided ? 'Given' : 'Not given'} />
          </dl>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Tell your batch</p>
            <ShareActions url={shareUrl} whatsappHref={whatsappHref} title={d.campaignTitle} size="sm" />
          </div>

          <ButtonLink href="/giving" variant="ghost" className="min-h-11">
            Back to campaigns
          </ButtonLink>
        </CardBody>
      </Card>
    );
  }

  const summary = amount
    ? [
        `${money(amount)} from ${countryName(country)}`,
        `${inSentence(receiptLabel)} to ${donorName}`,
        named ? 'shown as a supporter' : 'kept private',
      ].join(' · ')
    : 'Choose an amount.';

  return (
    <Card as="section" aria-labelledby="donate-title">
      <CardHeader variant="stack">
        <CardTitle as="h2" id="donate-title">
          Give to this campaign
        </CardTitle>
        <CardDescription>{campaignTitle}</CardDescription>
      </CardHeader>

      <CardBody>
        <form onSubmit={onSubmit} noValidate className="space-y-6">
          <Fieldset legend="Where are you giving from?">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <input
                  type="radio"
                  name="origin"
                  value="india"
                  checked={!isForeign}
                  onChange={() => chooseOrigin(false)}
                  className="peer sr-only"
                />
                <span className={CHOICE}>India</span>
              </label>
              <label className="block">
                <input
                  type="radio"
                  name="origin"
                  value="abroad"
                  checked={isForeign}
                  onChange={() => chooseOrigin(true)}
                  className="peer sr-only"
                />
                <span className={CHOICE}>Outside India</span>
              </label>
            </div>

            {/* The country matters only where a foreign gift can be taken. */}
            {isForeign && fcraRegistered ? (
              <Field htmlFor="donate-country" label="Which country?" required error={errors.country}>
                <Select
                  id="donate-country"
                  name="sourceCountry"
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    lastAbroad.current = e.target.value;
                    setErrors((x) => ({ ...x, country: undefined }));
                    setRefusal(null);
                  }}
                  aria-describedby={describedBy('donate-country', { error: Boolean(errors.country) })}
                >
                  <option value="">Choose a country</option>
                  {COUNTRIES.filter((c) => c.code !== 'IN').map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </Fieldset>

          {isForeign ? (
            refused ? (
              <Alert tone="danger" title={`${shortName} cannot accept gifts from outside India yet.`} icon={<Globe2 className="size-4" />}>
                <p>
                  You can still{' '}
                  {mentorHref ? (
                    <Link href={mentorHref}>mentor a final-year student</Link>
                  ) : (
                    'mentor a final-year student'
                  )}
                  ,{' '}
                  {postJobHref ? <Link href={postJobHref}>post a job</Link> : 'post a job'}
                  {supportEmail ? (
                    <>
                      , or write to <a href={`mailto:${supportEmail}`}>{supportEmail}</a> to be told when this opens
                    </>
                  ) : null}
                  .
                </p>
              </Alert>
            ) : (
              <Alert
                tone="warning"
                title="This will be recorded as a foreign contribution"
                icon={<Globe2 className="size-4" />}
              >
                <p>
                  It is routed to the trust&rsquo;s designated FCRA account, held separately from
                  domestic funds, and reported separately in the annual FCRA return. That
                  segregation happens as the payment is created — not at audit time — which is why
                  the question is asked before you pay rather than after.
                </p>
              </Alert>
            )
          ) : null}

          {refused ? null : (
            <>
              <Fieldset
                legend="How much?"
                hint={averageGift ? `Average gift to this campaign: ${money(averageGift)}` : undefined}
              >
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PRESETS.map((v) => (
                    <label key={v} className="block">
                      <input
                        type="radio"
                        name="amount"
                        value={v}
                        checked={preset === v}
                        onChange={() => {
                          setPreset(v);
                          setErrors((x) => ({ ...x, amount: undefined }));
                        }}
                        className="peer sr-only"
                      />
                      <span className={cn(CHOICE, 'px-1.5 py-3 font-display text-base tabular')}>{money(v)}</span>
                    </label>
                  ))}

                  <label className="block">
                    <input
                      type="radio"
                      name="amount"
                      value="custom"
                      checked={preset === 'custom'}
                      onChange={() => setPreset('custom')}
                      className="peer sr-only"
                    />
                    <span className={CHOICE}>Other</span>
                  </label>
                </div>
              </Fieldset>

              {preset === 'custom' ? (
                <Field htmlFor="donate-custom" label="Your amount, in rupees" error={errors.amount}>
                  <Input
                    id="donate-custom"
                    name="customAmount"
                    inputMode="numeric"
                    autoFocus
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    invalid={Boolean(errors.amount)}
                    aria-describedby={describedBy('donate-custom', { error: Boolean(errors.amount) })}
                    leading={<span aria-hidden="true">₹</span>}
                    placeholder="15000"
                    className="tabular"
                  />
                </Field>
              ) : errors.amount ? (
                <p role="alert" className="flex gap-1.5 text-xs font-medium text-danger-fg">
                  <span aria-hidden="true">⚠</span>
                  <span>{errors.amount}</span>
                </p>
              ) : null}

              <Field
                htmlFor="donate-pan"
                label="PAN"
                required={panRequired}
                hint={panRequired ? `Required above ${money(PAN_THRESHOLD)}.` : 'Optional at this amount.'}
                error={errors.pan}
              >
                <Input
                  id="donate-pan"
                  name="pan"
                  value={pan}
                  onChange={(e) => setPan(e.target.value.toUpperCase())}
                  invalid={Boolean(errors.pan)}
                  aria-describedby={describedBy('donate-pan', { hint: true, error: Boolean(errors.pan) })}
                  maxLength={10}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="ABCDE1234F"
                  className="font-mono uppercase"
                />
              </Field>

              <Switch
                id="donate-named"
                label="Show my name as a supporter"
                hint={`Turn this off and your name is kept with the ${officeName}'s records only.`}
                checked={named}
                onChange={(e) => setNamed(e.target.checked)}
              />

              <p className="border-t border-line pt-4 text-sm text-secondary" aria-live="polite">
                {summary}
              </p>
            </>
          )}

          {refusal ? (
            <Alert tone="danger" title="This contribution was not accepted">
              <p>{refusal}</p>
            </Alert>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={refused} loading={busy}>
            {refused ? (
              <>
                <Lock className="size-4" aria-hidden="true" />
                Cannot be accepted
              </>
            ) : (
              <>
                <Heart className="size-4" aria-hidden="true" />
                {amount ? `Give ${money(amount)}` : 'Choose an amount'}
              </>
            )}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <dt className="text-secondary">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{value}</dd>
    </div>
  );
}
