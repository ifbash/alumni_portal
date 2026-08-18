'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Globe2, Heart, Lock, Receipt } from 'lucide-react';

import {
  Alert,
  Badge,
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
  Switch,
  describedBy,
  useToast,
} from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';

/**
 * The donate flow.
 *
 * Two things here are structural rather than cosmetic and must not be
 * simplified away:
 *
 *  1. **Source country is asked before the amount is committed**, and it
 *     drives `is_foreign_contribution`. FCRA segregation happens at the
 *     point of collection. A contribution from outside India that is
 *     accepted first and reclassified later is the offence, not the fix.
 *     The disabled button below is a courtesy; `POST /api/donations` is
 *     the gate, and it refuses foreign money outright when the trust has
 *     no FCRA registration.
 *  2. **PAN above ₹50,000.** A receipt issued without it cannot be filed
 *     against a return, so the field is required at that threshold rather
 *     than chased afterwards by the accounts officer.
 *
 * It creates no payment. The endpoint validates, authorises, classifies
 * and audit-logs the contribution and then stops, because Razorpay is not
 * wired up — and the end of the flow says exactly that instead of showing
 * a receipt for money nobody has taken.
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

export function DonateForm({
  campaignTitle,
  institutionName,
  shortName,
  fcraRegistered,
  defaultCountry,
  donorName,
  locale,
  currency,
  supportEmail,
}: {
  campaignTitle: string;
  institutionName: string;
  shortName: string;
  fcraRegistered: boolean;
  defaultCountry: string;
  donorName: string;
  /** From the tenant's locale spec — this file must not import the fixture clock. */
  locale: string;
  currency: string;
  supportEmail: string | null;
}) {
  const toast = useToast();
  const router = useRouter();
  const params = useParams<{ slug: string }>();

  const [preset, setPreset] = React.useState<number | 'custom'>(5000);
  const [custom, setCustom] = React.useState('');
  const [country, setCountry] = React.useState(
    COUNTRIES.some((c) => c.code === defaultCountry) ? defaultCountry : 'OTHER',
  );
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

  if (result) {
    const d = result.data.donation;
    const countryName = COUNTRIES.find((c) => c.code === d.sourceCountry)?.name ?? d.sourceCountry;

    return (
      <Card as="section">
        <CardHeader>
          <CardTitle as="h2">No payment was created</CardTitle>
          <CardDescription>
            {result.persisted
              ? 'Your details are recorded. Nothing has been charged, and there is no receipt yet.'
              : 'Nothing has been charged and nothing has been stored.'}
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <Alert tone="info" title="Razorpay is not connected yet">
            <p>{result.data.note}</p>
            <p className="mt-2">
              {result.persisted
                ? 'The contribution is held as initiated and carries its FCRA classification from this moment — no payment can reclassify it later.'
                : 'This build runs on seeded data with no database behind it. The capability check, the student refusal, the FCRA classification, the PAN threshold and the audit entry all ran on the server; the write did not.'}
              {supportEmail ? (
                <>
                  {' '}
                  To give today, write to <a href={`mailto:${supportEmail}`}>{supportEmail}</a> and
                  the accounts officer will send bank details.
                </>
              ) : null}
            </p>
          </Alert>

          <dl className="divide-y divide-line rounded-lg border border-line">
            <Row label="Campaign" value={d.campaignTitle} />
            <Row label="Amount" value={money(d.amount)} />
            <Row label="Source country" value={countryName} />
            <Row
              label="Foreign contribution"
              value={
                d.isForeignContribution ? (
                  <Badge tone="warning" dot>
                    Yes — FCRA
                  </Badge>
                ) : (
                  <Badge tone="neutral">No — domestic</Badge>
                )
              }
            />
            <Row
              label="PAN"
              value={
                d.panProvided ? (
                  <span className="font-mono">{pan.trim().toUpperCase()}</span>
                ) : (
                  <span className="text-muted">Not given — no 80G deduction claimable</span>
                )
              }
            />
            <Row
              label="Donor listing"
              value={d.listPublicly ? `Listed as ${donorName}` : 'Name withheld from the donor list'}
            />
            <Row label="80G receipt" value={<span className="text-muted">None — no payment was taken</span>} />
          </dl>

          <div className="space-y-2">
            <p className="text-sm font-semibold">What happens once the gateway is connected</p>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-secondary">
              <li>
                The donation row is written first, carrying{' '}
                <span className="font-mono text-xs">source_country</span> and{' '}
                <span className="font-mono text-xs">is_foreign_contribution</span>, before the
                gateway is called.
              </li>
              <li>A Razorpay order is created — UPI first, then cards and netbanking.</li>
              <li>
                On capture, {institutionName} issues the 80G receipt by email within seven working
                days.
              </li>
            </ol>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setResult(null)}>
              Change something
            </Button>
            <ButtonLink href="/giving" variant="ghost">
              Back to campaigns
            </ButtonLink>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card as="section">
      <CardHeader>
        <CardTitle as="h2">
          <Heart className="mb-1 size-4 text-muted" aria-hidden="true" />
          <span className="block">Give to this campaign</span>
        </CardTitle>
        <CardDescription>{campaignTitle}</CardDescription>
      </CardHeader>

      <CardBody>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <Fieldset
            legend="Amount"
            hint={`Anything from ${money(MIN_AMOUNT)}. Most alumni give between ${money(2500)} and ${money(11000)}.`}
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
                  <span className="block cursor-pointer rounded border border-line bg-surface-raised px-3 py-2 text-center text-sm font-semibold tabular transition-colors duration-fast ease-brand hover:border-line-strong peer-checked:border-[var(--button-primary-bg)] peer-checked:bg-brand-soft peer-checked:text-brand-soft-fg peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus-ring)]">
                    {money(v)}
                  </span>
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
                <span className="block cursor-pointer rounded border border-line bg-surface-raised px-3 py-2 text-center text-sm font-semibold transition-colors duration-fast ease-brand hover:border-line-strong peer-checked:border-[var(--button-primary-bg)] peer-checked:bg-brand-soft peer-checked:text-brand-soft-fg peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus-ring)]">
                  Other
                </span>
              </label>
            </div>
          </Fieldset>

          {preset === 'custom' ? (
            <Field
              htmlFor="donate-custom"
              label="Your amount"
              hint="Rupees, no paise."
              error={errors.amount}
            >
              <Input
                id="donate-custom"
                name="customAmount"
                inputMode="numeric"
                autoFocus
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                invalid={Boolean(errors.amount)}
                aria-describedby={describedBy('donate-custom', {
                  hint: true,
                  error: Boolean(errors.amount),
                })}
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
            htmlFor="donate-country"
            label="Which country are you giving from?"
            required
            hint="Not where you studied — where the money leaves from. This is a legal question, not a profile field."
            error={errors.country}
          >
            <Select
              id="donate-country"
              name="sourceCountry"
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setErrors((x) => ({ ...x, country: undefined }));
                setRefusal(null);
              }}
              aria-describedby={describedBy('donate-country', {
                hint: true,
                error: Boolean(errors.country),
              })}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          {isForeign ? (
            refused ? (
              <Alert
                tone="danger"
                title={`${shortName} cannot accept this contribution`}
                icon={<Globe2 className="size-4" />}
              >
                <p>
                  A contribution from outside India is a foreign contribution under the Foreign
                  Contribution (Regulation) Act, even when it arrives in rupees from an NRE account.
                  The college trust has not confirmed FCRA registration, so this is refused here
                  rather than accepted and returned later. The server refuses it too — this is not
                  a disabled button standing in for a rule.
                </p>
                <p className="mt-2">
                  If you hold an Indian bank account and are giving from it while resident in India,
                  change the country above.
                  {supportEmail ? (
                    <>
                      {' '}
                      Otherwise write to <a href={`mailto:${supportEmail}`}>{supportEmail}</a> — the
                      alumni cell is chasing the registration.
                    </>
                  ) : null}
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

          <Field
            htmlFor="donate-pan"
            label="PAN"
            required={panRequired}
            hint={
              panRequired
                ? `Required above ${money(PAN_THRESHOLD)} — the 80G receipt cannot be filed without it.`
                : 'Optional at this amount, but without it you cannot claim the 80G deduction.'
            }
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

          <div className="rounded-lg border border-line bg-surface-sunken p-4">
            <Switch
              id="donate-named"
              label="List my name on the donor list"
              hint={`Turn this off and the gift is still receipted to you — ${shortName} simply publishes it as anonymous.`}
              checked={named}
              onChange={(e) => setNamed(e.target.checked)}
            />
          </div>

          <div className="space-y-2 rounded-lg border border-line p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Recorded with this contribution
            </p>
            <ul className="space-y-1 text-xs text-secondary">
              <li className="flex items-center justify-between gap-3">
                <span className="font-mono">source_country</span>
                <span className="font-semibold">{country}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="font-mono">is_foreign_contribution</span>
                <span className="font-semibold">{isForeign ? 'true' : 'false'}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="font-mono">amount</span>
                <span className="font-semibold tabular">{amount ? money(amount) : '—'}</span>
              </li>
            </ul>
          </div>

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
                <Receipt className="size-4" aria-hidden="true" />
                Continue — {amount ? money(amount) : 'choose an amount'}
              </>
            )}
          </Button>

          <p className="text-xs text-muted">
            This records the contribution — amount, source country, FCRA classification and PAN —
            and stops there. The next step would open Razorpay (UPI first); payments are not
            connected in this build, so no order is created, no money moves and no 80G receipt is
            issued.
          </p>
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
