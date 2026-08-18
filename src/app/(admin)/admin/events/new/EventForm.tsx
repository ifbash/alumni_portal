'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, MapPin, Ticket, Eye, Lock } from 'lucide-react';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Field,
  describedBy,
  Input,
  Textarea,
  Select,
  Radio,
  Fieldset,
  FormActions,
  Button,
  Badge,
  Alert,
  ConfirmDialog,
  useToast,
} from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';

/**
 * Event composer.
 *
 * The department scope is not validated after the fact — the server decides
 * which branches this viewer may pick and the select is built from that list
 * alone. An HOD cannot choose ECE here because ECE is not an option, which
 * is the difference between a rule and a message about a rule.
 *
 * That is presentation, though, and presentation is not authorisation.
 * `POST /api/admin/events` clamps the branch to the caller's own grant and
 * refuses an explicitly foreign one, so the rule holds for anything that
 * posts to it — this form included, and whatever posts to it next.
 */

type Audience = 'both' | 'alumni_only';

interface Errors {
  title?: string;
  startDate?: string;
  startTime?: string;
  end?: string;
  capacity?: string;
  price?: string;
  venue?: string;
  department?: string;
  description?: string;
}

interface SavedEvent {
  event: { id: string; slug: string; title: string; published: boolean };
  href: string;
  note: string;
}

/**
 * The server names its fields for the record it writes; this form names its
 * controls for the person filling them in. One map, in one place, rather
 * than a rename scattered through the error handling.
 */
const FIELD_MAP: Record<string, keyof Errors> = {
  title: 'title',
  venue: 'venue',
  description: 'description',
  startsAt: 'startDate',
  endsAt: 'end',
  capacity: 'capacity',
  ticketPrice: 'price',
  ticketed: 'price',
  departmentCode: 'department',
  slug: 'title',
};

const fmtDate = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
const fmtTime = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export function EventForm({
  options,
  locked,
  scopeNote,
  portalName,
}: {
  options: Array<{ value: string; label: string }>;
  locked: boolean;
  scopeNote: string;
  portalName: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [venue, setVenue] = React.useState('');
  const [department, setDepartment] = React.useState(options[0]?.value ?? '');
  const [startDate, setStartDate] = React.useState('');
  const [startTime, setStartTime] = React.useState('10:00');
  const [endDate, setEndDate] = React.useState('');
  const [endTime, setEndTime] = React.useState('16:00');
  const [audience, setAudience] = React.useState<Audience>('both');
  const [capacity, setCapacity] = React.useState('');
  const [price, setPrice] = React.useState('0');

  const [errors, setErrors] = React.useState<Errors>({});
  const [confirming, setConfirming] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [refusal, setRefusal] = React.useState<string | null>(null);
  /** Set when the write ran but nothing was stored, so the screen says so rather than navigating to a list without it. */
  const [unstored, setUnstored] = React.useState<SavedEvent | null>(null);

  const startsAt = startDate ? new Date(`${startDate}T${startTime || '00:00'}`) : null;
  const endsAt = endDate ? new Date(`${endDate}T${endTime || '00:00'}`) : null;

  const branchLabel = department
    ? (options.find((o) => o.value === department)?.label.split(' — ')[0] ?? department)
    : 'All branches';

  const audienceLine =
    audience === 'alumni_only'
      ? `Alumni of ${branchLabel === 'All branches' ? 'every branch' : branchLabel}. Students cannot see it at all.`
      : `Alumni and final-year students${branchLabel === 'All branches' ? '' : ` in ${branchLabel}`}.`;

  const validate = (): Errors => {
    const e: Errors = {};
    if (title.trim().length < 4) e.title = 'Give the event a title members will recognise in a list.';
    if (!startDate) e.startDate = 'A start date is required.';
    if (!startTime) e.startTime = 'A start time is required.';
    if (startsAt && Number.isNaN(startsAt.getTime())) {
      e.startDate = 'That date and time could not be read. Check both boxes.';
    }
    if (endsAt && Number.isNaN(endsAt.getTime())) {
      e.end = 'That end date and time could not be read.';
    }
    if (
      startsAt &&
      endsAt &&
      !Number.isNaN(startsAt.getTime()) &&
      !Number.isNaN(endsAt.getTime()) &&
      endsAt.getTime() <= startsAt.getTime()
    ) {
      e.end = 'The event cannot finish before it starts.';
    }
    if (capacity && (!/^\d+$/.test(capacity) || Number(capacity) < 1)) {
      e.capacity = 'Capacity is a whole number of seats, or blank for no cap.';
    }
    if (!/^\d+$/.test(price || '0')) e.price = 'A ticket price in whole rupees. 0 for a free event.';
    if (!venue.trim()) e.venue = 'Say where it is, even if that is “Online — link sent on registration”.';
    return e;
  };

  const submit = (publish: boolean) => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error('Some details are missing', 'The fields with a red note need attention before this can be saved.');
      return;
    }
    if (publish) {
      setConfirming(true);
      return;
    }
    void finish(false);
  };

  const finish = async (publish: boolean) => {
    setSaving(true);
    setConfirming(false);
    setRefusal(null);
    setUnstored(null);

    const rupees = Number(price || 0);

    // `toISOString()` throws on an unparseable date. `validate()` has
    // already refused those, and this is the belt to that pair of braces —
    // a RangeError inside a click handler is a screen that stops
    // responding with nothing in the console to explain it.
    const iso = (d: Date | null) => (d && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined);

    const outcome = await api.post<SavedEvent>('/api/admin/events', {
      title: title.trim(),
      description: description.trim() || undefined,
      venue: venue.trim(),
      // Sent even when the select offers one option. The endpoint clamps
      // this to the caller's own grant regardless, and refuses a branch
      // outside it — the select is convenience, not the boundary.
      departmentCode: department || undefined,
      startsAt: iso(startsAt),
      endsAt: iso(endsAt),
      audience,
      capacity: capacity ? Number(capacity) : undefined,
      // Declared rather than inferred on the server, so "paid" and "₹0"
      // cannot both be true of the same event.
      ticketed: rupees > 0,
      ticketPrice: rupees,
      publish,
    });

    setSaving(false);

    const t = outcomeToast(
      outcome,
      publish ? `“${title.trim()}” is published` : `“${title.trim()}” saved as a draft`,
    );
    if (t) toast.show(t);

    if (outcome.status === 'ok') {
      if (!outcome.persisted) {
        setUnstored(outcome.data);
        return;
      }
      router.push(publish ? '/admin/events?view=upcoming' : '/admin/events?view=drafts');
      return;
    }

    if (outcome.status === 'invalid') {
      const mapped: Errors = {};
      for (const [key, message] of Object.entries(outcome.fieldErrors)) {
        const slot = FIELD_MAP[key];
        if (slot) mapped[slot] = message;
      }
      setErrors((cur) => ({ ...cur, ...mapped }));
      // A 422 on a field this form has no control for would otherwise
      // disappear entirely.
      if (Object.keys(mapped).length === 0) setRefusal(outcome.message);
      return;
    }

    if (outcome.status === 'conflict' && outcome.code === 'slug_taken') {
      setErrors((cur) => ({ ...cur, title: outcome.message }));
      return;
    }

    // A 403 here is the department clamp doing its job. It is worth
    // stating rather than reducing to "not permitted".
    setRefusal(outcome.message);
  };

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
          noValidate
        >
          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">What it is</CardTitle>
                <CardDescription>This is the copy members read before deciding to come.</CardDescription>
              </div>
            </CardHeader>
            <CardBody className="space-y-5">
              <Field htmlFor="evt-title" label="Title" required error={errors.title}>
                <Input
                  id="evt-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Annual Alumni Meet 2027"
                  invalid={Boolean(errors.title)}
                  maxLength={120}
                  aria-describedby={describedBy('evt-title', { error: Boolean(errors.title) })}
                />
              </Field>

              <Field
                htmlFor="evt-description"
                label="Description"
                hint="What happens, in what order, and what to bring. Batch coordinators paste this into WhatsApp verbatim."
                error={errors.description}
              >
                <Textarea
                  id="evt-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  placeholder="Department sessions in the morning, the general body meeting after lunch, and the cultural evening in the open-air auditorium."
                  invalid={Boolean(errors.description)}
                  aria-describedby={describedBy('evt-description', {
                    hint: true,
                    error: Boolean(errors.description),
                  })}
                />
              </Field>

              <Field
                htmlFor="evt-venue"
                label="Venue"
                required
                hint="A hall and a block, or “Online” with how the link arrives."
                error={errors.venue}
              >
                <Input
                  id="evt-venue"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="Seminar Hall 2, CSE Block, DIET Campus, Ganguru"
                  leading={<MapPin className="size-4" />}
                  invalid={Boolean(errors.venue)}
                  aria-describedby={describedBy('evt-venue', { hint: true, error: Boolean(errors.venue) })}
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">When</CardTitle>
                <CardDescription>Times are Asia/Kolkata. Leave the end blank if it is open-ended.</CardDescription>
              </div>
            </CardHeader>
            <CardBody className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor="evt-start-date" label="Start date" required error={errors.startDate}>
                  <Input
                    id="evt-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    invalid={Boolean(errors.startDate)}
                    aria-describedby={describedBy('evt-start-date', { error: Boolean(errors.startDate) })}
                  />
                </Field>
                <Field htmlFor="evt-start-time" label="Start time" required error={errors.startTime}>
                  <Input
                    id="evt-start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    invalid={Boolean(errors.startTime)}
                    aria-describedby={describedBy('evt-start-time', { error: Boolean(errors.startTime) })}
                  />
                </Field>
                <Field htmlFor="evt-end-date" label="End date" error={errors.end}>
                  <Input
                    id="evt-end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    invalid={Boolean(errors.end)}
                    aria-describedby={describedBy('evt-end-date', { error: Boolean(errors.end) })}
                  />
                </Field>
                <Field htmlFor="evt-end-time" label="End time">
                  <Input
                    id="evt-end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </Field>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">Who it is for</CardTitle>
                <CardDescription>Scope decides who can see the event, not merely who is invited.</CardDescription>
              </div>
              {locked ? (
                <Badge tone="neutral">
                  <Lock className="size-3" aria-hidden="true" />
                  Scope fixed
                </Badge>
              ) : null}
            </CardHeader>
            <CardBody className="space-y-5">
              <Field
                htmlFor="evt-department"
                label="Branch"
                required
                hint={scopeNote}
                error={errors.department}
              >
                <Select
                  id="evt-department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  disabled={locked}
                  aria-describedby={describedBy('evt-department', {
                    hint: true,
                    error: Boolean(errors.department),
                  })}
                >
                  {options.map((o) => (
                    <option key={o.value || 'all'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Fieldset
                legend="Audience"
                hint="An alumni-only event is not merely hidden from students — it is not addressable by them anywhere in the portal."
              >
                <Radio
                  id="evt-aud-both"
                  name="audience"
                  label="Alumni and final-year students"
                  hint="The default. Students are the reason most sessions happen."
                  checked={audience === 'both'}
                  onChange={() => setAudience('both')}
                />
                <Radio
                  id="evt-aud-alumni"
                  name="audience"
                  label="Alumni only"
                  hint="Batch reunions and paid dinners, where a student audience changes the room."
                  checked={audience === 'alumni_only'}
                  onChange={() => setAudience('alumni_only')}
                />
              </Fieldset>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">Seats and tickets</CardTitle>
                <CardDescription>
                  A capacity closes registration by itself. Without one, nobody is ever turned away.
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  htmlFor="evt-capacity"
                  label="Capacity"
                  hint="Blank for no cap — right for an online panel, wrong for a hall with 120 chairs."
                  error={errors.capacity}
                >
                  <Input
                    id="evt-capacity"
                    inputMode="numeric"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    placeholder="120"
                    invalid={Boolean(errors.capacity)}
                    aria-describedby={describedBy('evt-capacity', { hint: true, error: Boolean(errors.capacity) })}
                  />
                </Field>
                <Field
                  htmlFor="evt-price"
                  label="Ticket price"
                  hint="Whole rupees. 0 makes it free and skips the payment step entirely."
                  error={errors.price}
                >
                  <Input
                    id="evt-price"
                    inputMode="numeric"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    leading={<span className="text-sm">₹</span>}
                    invalid={Boolean(errors.price)}
                    aria-describedby={describedBy('evt-price', { hint: true, error: Boolean(errors.price) })}
                  />
                </Field>
              </div>

              {Number(price || 0) > 0 ? (
                <Alert tone="info" title="A ticketed event collects money through Razorpay">
                  <p>
                    Registration is only confirmed once payment succeeds, and refunds are handled from the giving
                    console, not from here. Guests are counted on the roster but are not charged separately.
                  </p>
                </Alert>
              ) : null}
            </CardBody>
          </Card>

          {refusal ? (
            <Alert tone="danger" title="Nothing was saved">
              <p>{refusal}</p>
            </Alert>
          ) : null}

          {unstored ? (
            <Alert tone="info" title="Checked and audited, but not stored">
              <p>{unstored.note}</p>
              <p className="mt-2">
                This build runs on seeded data with no database behind it. Your grant was checked and clamped to the
                branch you hold, the address <span className="font-mono text-xs">{unstored.href}</span> was found to
                be free and the audit entry was written — the event row itself was not. Nothing you have typed has
                been lost.
              </p>
            </Alert>
          ) : null}

          <FormActions>
            <p className="mr-auto max-w-prose text-xs text-muted">
              Both buttons post to the events API, which checks the times, the seats and the price, and writes the
              branch from your own grant rather than from this form.
            </p>
            <Button type="submit" variant="secondary" loading={saving}>
              Save as draft
            </Button>
            <Button type="button" onClick={() => submit(true)} loading={saving}>
              Publish
            </Button>
          </FormActions>
        </form>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">
                  <span className="flex items-center gap-2">
                    <Eye className="size-4 text-muted" aria-hidden="true" />
                    Preview
                  </span>
                </CardTitle>
                <CardDescription>How the card reads in {portalName}.</CardDescription>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="brand">{branchLabel}</Badge>
                  {audience === 'alumni_only' ? <Badge tone="accent">Alumni only</Badge> : null}
                  <Badge tone={Number(price || 0) > 0 ? 'warning' : 'success'}>
                    <Ticket className="size-3" aria-hidden="true" />
                    {Number(price || 0) > 0 ? money.format(Number(price)) : 'Free'}
                  </Badge>
                </div>

                <p className="font-display text-lg font-semibold">
                  {title.trim() || 'Your event title appears here'}
                </p>

                <p className="flex items-start gap-2 text-sm text-secondary">
                  <CalendarDays className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>
                    {startsAt && !Number.isNaN(startsAt.getTime()) ? (
                      <>
                        {fmtDate.format(startsAt)}, {fmtTime.format(startsAt)}
                        {endsAt && !Number.isNaN(endsAt.getTime()) ? ` – ${fmtTime.format(endsAt)}` : ''}
                      </>
                    ) : (
                      'Date not set'
                    )}
                  </span>
                </p>

                <p className="flex items-start gap-2 text-sm text-secondary">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{venue.trim() || 'Venue not set'}</span>
                </p>

                {description.trim() ? (
                  <p className="text-sm text-secondary">{description.trim().slice(0, 220)}
                    {description.trim().length > 220 ? '…' : ''}
                  </p>
                ) : null}

                <p className="text-xs text-muted">
                  {capacity ? `${Number(capacity).toLocaleString('en-IN')} seats` : 'No seat limit'}
                </p>
              </div>

              <div className="space-y-1 border-t border-line pt-3 text-sm">
                <p className="font-medium">Who will see this</p>
                <p className="text-secondary">{audienceLine}</p>
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void finish(true)}
        pending={saving}
        tone="primary"
        confirmLabel="Publish now"
        title="Publish to members?"
        body={
          <div className="space-y-2">
            <p>
              <strong className="text-primary">{title.trim() || 'This event'}</strong> becomes visible immediately and
              registration opens the same second.
            </p>
            <p>{audienceLine}</p>
            <p>
              Unpublishing later does not un-notify anyone who has already seen it, so check the date and the venue
              first.
            </p>
          </div>
        }
      />
    </>
  );
}
