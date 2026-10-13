'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CalendarPlus, CircleCheck, Ticket, TriangleAlert, UsersRound } from 'lucide-react';
import {
  Alert,
  Button,
  ButtonLink,
  ConfirmDialog,
  Field,
  FormActions,
  Select,
  describedBy,
  useToast,
} from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';
import { mailto } from '@/lib/mailto';

/**
 * Event registration.
 *
 * The only interactive piece on the event page. Everything it needs is
 * computed on the server and passed in — currency strings, the calendar
 * file and the ticket address included — so this file never imports the
 * formatting layer (which reaches the seed data) and the client bundle
 * stays a form.
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
 * Payment is not taken here. A button that opened a fake UPI sheet would
 * get somebody to the gate believing they had paid, so a paid registration
 * holds the seat and says, in one line, that the office will tell them how
 * to pay. Fixture honesty is the Demo data marker and `outcomeToast`.
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
  capacity,
  supportEmail,
  officeName,
  ticketHref,
  calendar,
}: {
  eventTitle: string;
  mode: 'register' | 'full' | 'registered';
  isPaid: boolean;
  /** "Free" or "₹500" — already in the tenant's currency and locale. */
  priceLabel: string;
  guestOptions: GuestOption[];
  registration: { id: string; guests: number; checkedIn: boolean; amountLabel: string } | null;
  seatsLeft: number | null;
  capacity: number | null;
  supportEmail: string | null;
  /** `copy.officeName`, used mid-sentence: "the alumni cell". */
  officeName: string;
  ticketHref: string;
  calendar: { icsHref: string; icsFilename: string; googleHref: string };
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

  const guestWords = (n: number) => `${n} guest${n === 1 ? '' : 's'}`;
  const seatsTaken = capacity
    ? `All ${capacity.toLocaleString('en-IN')} seats are taken.`
    : 'Every seat is taken.';
  const askHref = supportEmail
    ? mailto(supportEmail, `Asking for a seat — ${eventTitle}`, [
        `I would like a seat at ${eventTitle} if one comes back.`,
        `Guests with me: ${guests}`,
        '',
      ])
    : null;

  // ---------------------------------------------------------------
  // Already registered
  // ---------------------------------------------------------------

  if (step === 'registered' && registration) {
    const changeHref = supportEmail
      ? mailto(supportEmail, `Change of guests — ${eventTitle}`, [
          `Registration reference: ${registration.id}`,
          `Guests registered now: ${registration.guests}`,
          'Guests I would like instead: ',
          '',
        ])
      : null;

    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm text-secondary">
          <UsersRound className="size-4 shrink-0 text-muted" aria-hidden="true" />
          <span>
            You{registration.guests > 0 ? ` + ${guestWords(registration.guests)}` : ''} ·{' '}
            <span className="font-medium tabular text-primary">{registration.amountLabel}</span>
          </span>
        </p>

        <ButtonLink href={ticketHref} className="min-h-11 w-full">
          <Ticket className="size-4" aria-hidden="true" />
          Show my ticket
        </ButtonLink>

        <div className="grid grid-cols-1 gap-2">
          <ButtonLink href={calendar.icsHref} download={calendar.icsFilename} variant="secondary" className="min-h-11">
            <CalendarPlus className="size-4 shrink-0" aria-hidden="true" />
            Add to calendar
          </ButtonLink>
          {changeHref ? (
            <ButtonLink href={changeHref} variant="secondary" className="min-h-11">
              Change guests
            </ButtonLink>
          ) : null}
        </div>

        <p className="text-xs text-secondary">
          On Google Calendar?{' '}
          <a href={calendar.googleHref} target="_blank" rel="noreferrer noopener" className="link">
            Add it there
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          .
        </p>

        <button
          type="button"
          onClick={() => setConfirmingCancel(true)}
          disabled={busy}
          className="inline-flex min-h-11 items-center text-sm text-secondary underline underline-offset-4 hover:text-primary disabled:opacity-50"
        >
          Cancel my registration
        </button>

        <ConfirmDialog
          open={confirmingCancel}
          onClose={() => setConfirmingCancel(false)}
          onConfirm={() => void cancel()}
          pending={busy}
          title="Cancel your registration?"
          confirmLabel="Cancel my seat"
          body={
            <div className="space-y-2">
              <p>Your seat and any guest seats are released for somebody else to take.</p>
              <p>
                You can register again while seats last.
                {isPaid ? ` The ${officeName} handles refunds for paid tickets.` : ''}
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
          <p>
            Your seat has been released.
            {isPaid ? ` The ${officeName} handles refunds for paid tickets.` : ''}
          </p>
        </Alert>
        <Button onClick={() => setStep('form')} className="min-h-11">
          Register again
        </Button>
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
          tone={full ? 'neutral' : 'danger'}
          title={full ? 'That seat had gone' : 'Registration was not accepted'}
          icon={full ? undefined : <TriangleAlert className="size-4" />}
        >
          <p>{refusal.code === 'full' ? `${seatsTaken} Seats come back when people cancel.` : refusal.message}</p>
        </Alert>

        <FormActions className="justify-start">
          <Button variant="secondary" onClick={() => setStep('form')} className="min-h-11">
            Try again
          </Button>
          {full && askHref ? (
            <ButtonLink href={askHref} variant="ghost" className="min-h-11">
              Ask the {officeName}
            </ButtonLink>
          ) : null}
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
          <p>Bring a photo ID to the registration desk.</p>
          {guests > 0 ? (
            <p className="mt-1">
              {guestWords(guests)} counted with you
              {totalLabel ? `, ${totalLabel} in total` : ''}.
            </p>
          ) : null}
        </Alert>

        {result?.persisted ? (
          <ButtonLink href={ticketHref} className="min-h-11 w-full">
            <Ticket className="size-4" aria-hidden="true" />
            Show my ticket
          </ButtonLink>
        ) : null}

        <Button variant="ghost" size="sm" onClick={() => setStep('form')} disabled={busy} className="min-h-11">
          Change my answer
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Payment — the seat is held; payment happens off the portal for now
  // ---------------------------------------------------------------

  if (step === 'payment') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded border border-line px-3.5 py-3 text-sm">
          <span className="text-secondary">
            {guests > 0 ? `You + ${guestWords(guests)}` : 'You'} · {priceLabel} each
          </span>
          <span className="font-semibold tabular">{totalLabel}</span>
        </div>

        <p className="text-sm">
          <span className="font-semibold">Your seat is held.</span>{' '}
          <span className="text-secondary">
            Online payment is not switched on yet. The {officeName} will tell you how to pay.
          </span>
        </p>

        <Button variant="ghost" size="sm" onClick={() => setStep('form')} disabled={busy} className="min-h-11">
          Back
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Full — every seat was taken when the page loaded
  // ---------------------------------------------------------------

  if (mode === 'full') {
    return (
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-secondary">{seatsTaken} Seats come back when people cancel.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="secondary" loading={busy} className="min-h-11 flex-1">
            Try for a returned seat
          </Button>
          {askHref ? (
            <ButtonLink href={askHref} variant="ghost" className="min-h-11 flex-1">
              Ask the {officeName}
            </ButtonLink>
          ) : null}
        </div>
      </form>
    );
  }

  // ---------------------------------------------------------------
  // The form
  // ---------------------------------------------------------------

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field
        htmlFor={`${fieldId}-guests`}
        label="Guests coming with you"
        hint="Family or friends coming with you."
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

      <div className="flex items-center justify-between gap-3 rounded border border-line px-3.5 py-3 text-sm">
        <span className="inline-flex items-center gap-2 text-secondary">
          <Ticket className="size-4 text-muted" aria-hidden="true" />
          Total
        </span>
        <span className="font-semibold tabular">{totalLabel ?? 'Free'}</span>
      </div>

      {seatsLeft !== null && seatsLeft <= guests ? (
        <p className="text-xs font-medium text-warning-fg">
          Only {seatsLeft} {seatsLeft === 1 ? 'seat is' : 'seats are'} left, so this many guests may not
          fit. You will know as soon as you submit.
        </p>
      ) : null}

      <Button type="submit" loading={busy} className="min-h-11 w-full">
        {isPaid ? 'Hold my seat' : 'Register'}
      </Button>
    </form>
  );
}
