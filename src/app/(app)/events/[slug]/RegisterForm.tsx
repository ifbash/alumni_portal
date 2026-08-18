'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CircleCheck, Info, QrCode, Ticket, TriangleAlert, Wallet } from 'lucide-react';
import {
  Alert,
  Button,
  ConfirmDialog,
  Field,
  FormActions,
  Select,
  describedBy,
  useToast,
} from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';

/**
 * Event registration.
 *
 * The only interactive piece on the event page. Everything it needs is
 * computed on the server and passed in — currency strings included — so
 * this file never imports the formatting layer (which reaches the seed
 * data) and the client bundle stays a form.
 *
 * Two rules about capacity, and they pull in opposite directions on
 * purpose:
 *
 *  - The seat count on screen is a snapshot. Between render and submit
 *    somebody else can take the last two seats, or cancel and free five.
 *    So this form never refuses a submission on its own arithmetic. It
 *    posts, and it shows whatever the server decides — the 409 for a full
 *    event is the authoritative answer and is surfaced as one.
 *  - The warning that a guest count may not fit is still worth showing
 *    before the click, because a member who is told afterwards has already
 *    made plans.
 *
 * The payment step is deliberately blunt. Razorpay is not wired up, and a
 * button that opens a fake UPI sheet would be worse than useless at a
 * college that is about to take real money for a reunion ticket: it would
 * get somebody to the gate believing they had paid.
 */

export interface GuestOption {
  value: number;
  label: string;
  /** Preformatted total for this guest count. `null` for a free event. */
  totalLabel: string | null;
}

interface RegisterResult {
  registration: { id: string; guests: number; seats: number; amountDue: number; currency: string };
  requiresPayment: boolean;
  note: string;
}

interface CancelResult {
  cancelled: { registrationId: string; seatsReleased: number };
  note: string;
}

type Step = 'form' | 'payment' | 'done' | 'registered' | 'cancelled' | 'refused';

export function RegisterForm({
  eventTitle,
  mode,
  isPaid,
  priceLabel,
  guestOptions,
  registration,
  seatsLeft,
  supportEmail,
}: {
  eventTitle: string;
  mode: 'register' | 'waitlist' | 'registered';
  isPaid: boolean;
  /** "Free" or "₹500" — already in the tenant's currency and locale. */
  priceLabel: string;
  guestOptions: GuestOption[];
  registration: { guests: number; checkedIn: boolean; amountLabel: string } | null;
  seatsLeft: number | null;
  supportEmail: string | null;
}) {
  const toast = useToast();
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const fieldId = React.useId();

  const [step, setStep] = React.useState<Step>(mode === 'registered' ? 'registered' : 'form');
  const [guests, setGuests] = React.useState(registration?.guests ?? 0);
  const [confirmingCancel, setConfirmingCancel] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [guestError, setGuestError] = React.useState<string | undefined>(undefined);
  const [result, setResult] = React.useState<{ note: string; persisted: boolean } | null>(null);
  const [refusal, setRefusal] = React.useState<{ code: string; message: string } | null>(null);

  const selected = guestOptions.find((o) => o.value === guests) ?? guestOptions[0];
  const totalLabel = selected?.totalLabel ?? null;
  const slug = params?.slug ?? '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setGuestError(undefined);
    setRefusal(null);

    const outcome = await api.post<RegisterResult>(`/api/events/${slug}/register`, { guests });
    setBusy(false);

    if (outcome.status === 'invalid') {
      // A 422 belongs on the field that caused it, not only in a toast.
      setGuestError(outcome.fieldErrors.guests);
      const t = outcomeToast(outcome, '');
      if (t && !outcome.fieldErrors.guests) toast.show(t);
      return;
    }

    if (outcome.status === 'conflict') {
      // Full, closed, or already registered. The server is the only thing
      // that knows the seat count at this instant, so its answer is what
      // gets shown — the client never pre-empts it.
      setRefusal({ code: outcome.code, message: outcome.message });
      setStep('refused');
      router.refresh();
      return;
    }

    if (outcome.status !== 'ok') {
      const t = outcomeToast(outcome, '');
      if (t) toast.show(t);
      return;
    }

    setResult({ note: outcome.data.note, persisted: outcome.persisted });
    setStep(outcome.data.requiresPayment ? 'payment' : 'done');

    const t = outcomeToast(
      outcome,
      outcome.data.requiresPayment ? 'Seat held, pending payment' : 'You are on the list',
    );
    if (t) toast.show(t);

    if (outcome.persisted) router.refresh();
  };

  const cancel = async () => {
    if (busy) return;
    setBusy(true);

    const outcome = await api.del<CancelResult>(`/api/events/${slug}/register`);
    setBusy(false);
    setConfirmingCancel(false);

    if (outcome.status !== 'ok') {
      // Nothing was released, so the registration panel stays exactly as
      // it was. Checked in at the gate already? That is a 409 and it says
      // so rather than silently doing nothing.
      const t = outcomeToast(outcome, '');
      if (t) toast.show(t);
      if (outcome.status === 'conflict') router.refresh();
      return;
    }

    setResult({ note: outcome.data.note, persisted: outcome.persisted });
    setStep('cancelled');

    const t = outcomeToast(outcome, 'Registration cancelled');
    if (t) toast.show(t);

    if (outcome.persisted) router.refresh();
  };

  // ---------------------------------------------------------------
  // Already registered
  // ---------------------------------------------------------------

  if (step === 'registered' && registration) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="You are registered" icon={<CircleCheck className="size-4" />}>
          <dl className="mt-1 space-y-1">
            <div className="flex justify-between gap-4">
              <dt>Attending</dt>
              <dd className="font-medium">
                You{registration.guests > 0 ? ` + ${registration.guests} guest${registration.guests === 1 ? '' : 's'}` : ''}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Ticket</dt>
              <dd className="font-medium tabular">{registration.amountLabel}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Check-in</dt>
              <dd className="font-medium">{registration.checkedIn ? 'Scanned at the gate' : 'Not yet scanned'}</dd>
            </div>
          </dl>
        </Alert>

        <p className="flex items-start gap-2 text-xs text-muted">
          <QrCode className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            The desk checks you in against this list — carry a photo ID. Bringing someone who is
            not on your guest count slows the queue for everyone behind you.
          </span>
        </p>

        <Button variant="secondary" onClick={() => setConfirmingCancel(true)} disabled={busy}>
          Cancel my registration
        </Button>

        <ConfirmDialog
          open={confirmingCancel}
          onClose={() => setConfirmingCancel(false)}
          onConfirm={() => void cancel()}
          pending={busy}
          title="Cancel your registration?"
          confirmLabel="Cancel my seat"
          body={
            <div className="space-y-2">
              <p>
                Your seat and any guest seats go back to the pool, and to the waiting list first if
                there is one.
              </p>
              <p>
                You can register again while seats last
                {isPaid ? '. A paid ticket is refunded by the alumni cell, not automatically.' : '.'}
              </p>
            </div>
          }
        />
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Cancelled
  // ---------------------------------------------------------------

  if (step === 'cancelled') {
    return (
      <div className="space-y-4">
        <Alert tone="neutral" title="Registration cancelled">
          <p>Your seat has been released. Nothing is held for you at the gate for {eventTitle}.</p>
          {result ? <p className="mt-1">{result.note}</p> : null}
        </Alert>
        <Button onClick={() => setStep('form')}>Register again</Button>
        {result && !result.persisted ? <FixtureNote /> : null}
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Refused by the server — full, closed, or already on the list
  // ---------------------------------------------------------------

  if (step === 'refused' && refusal) {
    const full = refusal.code === 'full' || refusal.code === 'not_enough_seats';

    return (
      <div className="space-y-4">
        <Alert
          tone={full ? 'warning' : 'danger'}
          title={full ? 'That seat had gone' : 'Registration was not accepted'}
          icon={<TriangleAlert className="size-4" />}
        >
          <p>{refusal.message}</p>
          {full && supportEmail ? (
            <p className="mt-1.5">
              Write to{' '}
              <a href={`mailto:${supportEmail}`} className="link">
                {supportEmail}
              </a>{' '}
              to go on the waiting list — the alumni cell keeps it by hand and offers returned seats
              in the order people joined.
            </p>
          ) : null}
        </Alert>

        <p className="text-xs text-muted">
          Nothing was registered and no seat is held for you. Seats do come back when people cancel,
          so trying again later is worth it.
        </p>

        <FormActions className="justify-start">
          <Button variant="secondary" onClick={() => setStep('form')}>
            Try again
          </Button>
        </FormActions>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Done
  // ---------------------------------------------------------------

  if (step === 'done') {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="You are on the list" icon={<CircleCheck className="size-4" />}>
          <p>{eventTitle} — bring a photo ID to the registration desk.</p>
          {guests > 0 ? (
            <p className="mt-1">
              {guests} guest{guests === 1 ? '' : 's'} counted with you
              {totalLabel ? `, ${totalLabel} in total` : ''}.
            </p>
          ) : null}
          {result ? <p className="mt-1">{result.note}</p> : null}
        </Alert>

        {result && !result.persisted ? <FixtureNote /> : null}

        <Button variant="ghost" size="sm" onClick={() => setStep('form')} disabled={busy}>
          Change my answer
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Payment — the seat is held, the gateway is not connected
  // ---------------------------------------------------------------

  if (step === 'payment') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded bg-surface-sunken px-3.5 py-3 text-sm">
          <span className="text-secondary">
            {guests > 0 ? `You + ${guests} guest${guests === 1 ? '' : 's'}` : 'You'} · {priceLabel} each
          </span>
          <span className="font-semibold tabular">{totalLabel}</span>
        </div>

        <Alert tone="info" title="Your seat is held, pending payment" icon={<Ticket className="size-4" />}>
          <p>{result?.note ?? 'Your seat is held until payment completes.'}</p>
        </Alert>

        <Alert
          tone="warning"
          title="Payment is not connected yet"
          icon={<TriangleAlert className="size-4" />}
        >
          <p>
            Razorpay is the gateway this portal will use, UPI first — GPay, PhonePe, Paytm or any
            UPI ID, with cards and net banking behind it. It is not wired up in this build, so
            nothing has been charged.
          </p>
          <p className="mt-1.5">
            Until it is live, the alumni cell collects the ticket at the registration desk
            {supportEmail ? (
              <>
                {' '}or on UPI — write to{' '}
                <a href={`mailto:${supportEmail}`} className="link">
                  {supportEmail}
                </a>{' '}
                and they will send the collect request.
              </>
            ) : (
              '.'
            )}
          </p>
        </Alert>

        {result && !result.persisted ? <FixtureNote /> : null}

        <FormActions className="justify-start">
          <Button disabled>
            <Wallet className="size-4" aria-hidden="true" />
            Pay {totalLabel} by UPI — not yet available
          </Button>
          <Button variant="ghost" onClick={() => setStep('form')} disabled={busy}>
            Back
          </Button>
        </FormActions>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // The form
  // ---------------------------------------------------------------

  const waitlist = mode === 'waitlist';

  return (
    <form onSubmit={submit} className="space-y-4">
      {waitlist ? (
        <Alert tone="info" title="Every seat was taken when this page loaded" icon={<Info className="size-4" />}>
          <p>
            Ask anyway. The seat count is checked on the server as you submit, so if somebody has
            cancelled since this page loaded the seat is yours.
          </p>
          <p className="mt-1.5">
            If it is still full you are told so and nothing is held — the alumni cell keeps the
            waiting list by hand
            {supportEmail ? (
              <>
                , so write to{' '}
                <a href={`mailto:${supportEmail}`} className="link">
                  {supportEmail}
                </a>{' '}
                and they will add you
              </>
            ) : null}
            .
          </p>
        </Alert>
      ) : null}

      {!waitlist ? (
        <Field
          htmlFor={`${fieldId}-guests`}
          label="Guests coming with you"
          hint={
            isPaid
              ? `Each guest is charged the same ${priceLabel} ticket.`
              : 'Family or friends attending with you. The desk counts them at the gate.'
          }
          error={guestError}
        >
          <Select
            id={`${fieldId}-guests`}
            name="guests"
            value={String(guests)}
            onChange={(e) => {
              setGuests(Number(e.target.value));
              setGuestError(undefined);
            }}
            aria-describedby={describedBy(`${fieldId}-guests`, {
              hint: true,
              error: Boolean(guestError),
            })}
          >
            {guestOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {!waitlist ? (
        <div className="flex items-center justify-between gap-3 rounded bg-surface-sunken px-3.5 py-3 text-sm">
          <span className="inline-flex items-center gap-2 text-secondary">
            <Ticket className="size-4 text-muted" aria-hidden="true" />
            Total
          </span>
          <span className="font-semibold tabular">{totalLabel ?? 'Free'}</span>
        </div>
      ) : null}

      {!waitlist && seatsLeft !== null && seatsLeft <= guests ? (
        <p className="text-xs font-medium text-warning-fg">
          Only {seatsLeft} {seatsLeft === 1 ? 'seat is' : 'seats are'} left — a guest count this
          high may not fit. The seat check runs when you submit, and you are told straight away if
          it does not.
        </p>
      ) : null}

      <FormActions className="justify-start">
        <Button type="submit" loading={busy}>
          {waitlist
            ? 'Ask for a returned seat'
            : isPaid
              ? 'Hold my seat'
              : 'Confirm my seat'}
        </Button>
      </FormActions>

      {isPaid && !waitlist ? (
        <p className="text-xs text-muted">
          This holds the seat and shows what is owed. Payment is a separate step, and it is not
          connected in this build.
        </p>
      ) : null}
    </form>
  );
}

/**
 * Fixture mode, said once and said plainly. Every guard, validation and
 * the audit entry ran on the server; the row was not written.
 */
function FixtureNote() {
  return (
    <p className="text-xs text-muted">
      Held on this screen only — this build runs on seeded data with no database behind it. The
      permission checks, the seat arithmetic and the audit entry all ran; nothing was stored, so
      the alumni cell has not been told.
    </p>
  );
}
