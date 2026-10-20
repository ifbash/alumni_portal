'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Lock, MapPin, Send } from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  CopyButton,
  Disclosure,
  Field,
  Fieldset,
  FormActions,
  Input,
  Radio,
  Select,
  Textarea,
  describedBy,
  useToast,
} from '@/components/ui';
import { EventSummary, type EventSummaryData } from '@/components/content';
import { api, outcomeToast } from '@/lib/client/api';
import { eventShareText } from '@/lib/share-text';
import type { BrandPack } from '@/lib/branding/pack';

/**
 * Event composer.
 *
 * The department scope is not validated after the fact — the server decides
 * which branches this viewer may pick and the select is built from that list
 * alone. That is presentation, though, and presentation is not
 * authorisation: `POST /api/admin/events` clamps the branch to the caller's
 * own grant and refuses an explicitly foreign one.
 *
 * The preview is the member card itself, built from what is typed. After
 * publishing, the screen turns to getting the word out.
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

export function EventForm({
  options,
  locked,
  scopeNote,
  share,
  origin,
  timeZoneLabel,
  canInvite,
  canAlbum,
}: {
  options: Array<{ value: string; label: string }>;
  locked: boolean;
  scopeNote: string;
  /** The pack's copy and locale: the share text and the preview card read them. */
  share: Pick<BrandPack, 'copy' | 'locale'>;
  origin: string;
  timeZoneLabel: string;
  canInvite: boolean;
  canAlbum: boolean;
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
  /** Set once the event is published (stored or not): the screen turns to spreading the word. */
  const [published, setPublished] = React.useState<(SavedEvent & { persisted: boolean }) | null>(null);

  const startsAt = startDate ? new Date(`${startDate}T${startTime || '00:00'}`) : null;
  const endsAt = endDate ? new Date(`${endDate}T${endTime || '00:00'}`) : null;
  const validStart = startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : null;
  const validEnd = endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null;

  const branchCode = department ? (options.find((o) => o.value === department)?.label.split(' — ')[0] ?? department) : null;
  const rupees = /^\d+$/.test(price || '0') ? Number(price || 0) : 0;

  const audienceLine =
    audience === 'alumni_only'
      ? `Alumni${branchCode ? ` of ${branchCode}` : ''}. Students cannot see it.`
      : `Alumni and final-year students${branchCode ? ` in ${branchCode}` : ''}.`;

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
      e.capacity = 'A whole number of seats, or blank for no limit.';
    }
    if (!/^\d+$/.test(price || '0')) e.price = 'A ticket price in whole rupees. 0 for a free event.';
    if (!venue.trim()) e.venue = 'Say where it is, even if that is “Online”.';
    return e;
  };

  const submit = (publish: boolean) => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error('Some details are missing', 'The fields marked in red need attention before this can be saved.');
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

    const rupees = Number(price || 0);

    // `toISOString()` throws on an unparseable date. `validate()` has
    // already refused those, and this is the belt to that pair of braces.
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
      if (publish) {
        setPublished({ ...outcome.data, persisted: outcome.persisted });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      // A draft that was not stored stays on screen; the toast has said so.
      if (!outcome.persisted) return;
      router.push('/admin/events?view=drafts');
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

  // ---------------------------------------------------------------
  // Preview: the member card, from what is typed
  // ---------------------------------------------------------------

  const previewEvent: EventSummaryData | null = validStart
    ? {
        slug: 'preview',
        title: title.trim() || 'Your event title',
        venue: venue.trim() || null,
        startsAt: validStart.toISOString(),
        endsAt: validEnd ? validEnd.toISOString() : null,
        departmentCode: branchCode,
        alumniOnly: audience === 'alumni_only',
        ticketPrice: rupees,
        coverImage: null,
        capacity: capacity && /^\d+$/.test(capacity) ? Number(capacity) : null,
        registeredCount: 0,
      }
    : null;

  const preview = (
    <div className="space-y-4">
      {previewEvent ? (
        <EventSummary event={previewEvent} href="#event-preview" locale={share.locale} variant="card" />
      ) : (
        // The card's own shape with the gaps shown as gaps, so the preview is
        // designed before the first keystroke and fills in as the form does.
        <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-raised p-3 shadow-sm">
          <span
            aria-hidden="true"
            className="grid size-14 shrink-0 place-items-center rounded-lg border border-line bg-surface-sunken text-center text-xs font-semibold uppercase tracking-wider text-secondary"
          >
            Date
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className={title.trim() ? 'font-display text-md font-semibold leading-snug' : 'font-display text-md font-semibold leading-snug text-secondary'}>
              {title.trim() || 'Your event title'}
            </p>
            <p className="text-sm text-secondary">{venue.trim() || 'Venue'} · add a date to see the full card</p>
          </div>
        </div>
      )}
      <div className="space-y-1 text-sm">
        <p className="font-medium text-primary">Who will see it</p>
        <p className="text-secondary">{audienceLine}</p>
      </div>
    </div>
  );

  // ---------------------------------------------------------------
  // After publishing
  // ---------------------------------------------------------------

  if (published) {
    const slug = published.event.slug;
    const shareText = validStart
      ? `${eventShareText(share, { title: title.trim(), startsAt: validStart.toISOString(), venue: venue.trim() || null })} ${origin}/events/${slug}`
      : `${title.trim()} ${origin}/events/${slug}`;

    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <div className="min-w-0 space-y-1">
              {published.persisted ? (
                <Badge tone="success" dot>
                  Published
                </Badge>
              ) : (
                <Badge tone="neutral">Not saved</Badge>
              )}
              <CardTitle as="h2" className="pt-1">
                Spread the word
              </CardTitle>
              <p className="text-sm text-secondary">
                {published.persisted
                  ? `“${title.trim()}” is open for registration. Most people hear about an event from a batch group.`
                  : `“${title.trim()}” passed every check. This is what to share once it is live.`}
              </p>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton text={shareText} label="Copy for WhatsApp" copiedLabel="Copied for WhatsApp" variant="primary" />
              {canInvite ? (
                <ButtonLink href={`/admin/comms/new?event=${slug}`} variant="secondary" className="min-h-11">
                  <Send className="size-4" aria-hidden="true" />
                  Send to a group
                </ButtonLink>
              ) : null}
              {canAlbum ? (
                <ButtonLink href={`/admin/gallery/new?event=${slug}`} variant="secondary" className="min-h-11">
                  <ImagePlus className="size-4" aria-hidden="true" />
                  Create the album now
                </ButtonLink>
              ) : null}
            </div>
            <p className="rounded border border-line bg-surface p-3 text-sm text-secondary">{shareText}</p>
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <ButtonLink href="/admin/events" variant="ghost" className="min-h-11 sm:min-h-0">
                Back to events
              </ButtonLink>
            </div>
          </CardBody>
        </Card>
        <aside aria-label="Preview" className="min-w-0">
          {preview}
        </aside>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // The form
  // ---------------------------------------------------------------

  return (
    <>
      <Disclosure summary="Preview" className="mb-6 lg:hidden">
        {preview}
      </Disclosure>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <form
          className="min-w-0 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
          noValidate
        >
          <Card>
            <CardHeader>
              <CardTitle as="h2">Basics</CardTitle>
            </CardHeader>
            <CardBody className="space-y-5">
              <Field htmlFor="evt-title" label="Title" required error={errors.title}>
                <Input
                  id="evt-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Annual Alumni Meet 2027"
                  invalid={Boolean(errors.title)}
                  maxLength={120}
                  aria-describedby={describedBy('evt-title', { error: Boolean(errors.title) })}
                />
              </Field>

              <Fieldset legend="Date and time" hint={`Times are in ${timeZoneLabel}. Leave the end blank if it is open-ended.`}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field htmlFor="evt-start-date" label="Starts on" required error={errors.startDate}>
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
                  <Field htmlFor="evt-end-date" label="Ends on" error={errors.end}>
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
                    <Input id="evt-end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                  </Field>
                </div>
              </Fieldset>

              <Field
                htmlFor="evt-venue"
                label="Venue"
                required
                hint="A hall and a block, or “Online” and how the link arrives."
                error={errors.venue}
              >
                <Input
                  id="evt-venue"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="e.g. Main auditorium"
                  leading={<MapPin className="size-4" />}
                  invalid={Boolean(errors.venue)}
                  aria-describedby={describedBy('evt-venue', { hint: true, error: Boolean(errors.venue) })}
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Who and how many</CardTitle>
              {locked ? (
                <Badge tone="neutral">
                  <Lock className="size-3" aria-hidden="true" />
                  {branchCode ?? 'Your branch'}
                </Badge>
              ) : null}
            </CardHeader>
            <CardBody className="space-y-5">
              <Field htmlFor="evt-department" label="Branch" required hint={scopeNote} error={errors.department}>
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

              <Fieldset legend="Audience">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Radio
                    id="evt-aud-both"
                    name="audience"
                    label="Alumni and final-year students"
                    hint="Most sessions are for both."
                    checked={audience === 'both'}
                    onChange={() => setAudience('both')}
                  />
                  <Radio
                    id="evt-aud-alumni"
                    name="audience"
                    label="Alumni only"
                    hint="Reunions and dinners. Students cannot see it."
                    checked={audience === 'alumni_only'}
                    onChange={() => setAudience('alumni_only')}
                  />
                </div>
              </Fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  htmlFor="evt-capacity"
                  label="Seats"
                  hint="Registration closes when it is full. Leave blank for no limit."
                  error={errors.capacity}
                >
                  <Input
                    id="evt-capacity"
                    inputMode="numeric"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    placeholder="e.g. 120"
                    invalid={Boolean(errors.capacity)}
                    aria-describedby={describedBy('evt-capacity', { hint: true, error: Boolean(errors.capacity) })}
                  />
                </Field>
                <Field
                  htmlFor="evt-price"
                  label="Ticket price"
                  hint={
                    rupees > 0
                      ? 'Charged per seat, guests included. A seat is held until payment completes.'
                      : 'Whole rupees. 0 makes it free.'
                  }
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
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Details</CardTitle>
            </CardHeader>
            <CardBody>
              <Field
                htmlFor="evt-description"
                label="Description"
                hint="What happens, in what order, and what to bring."
                error={errors.description}
              >
                <Textarea
                  id="evt-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  invalid={Boolean(errors.description)}
                  aria-describedby={describedBy('evt-description', {
                    hint: true,
                    error: Boolean(errors.description),
                  })}
                />
              </Field>
            </CardBody>
          </Card>

          {refusal ? (
            <Alert tone="danger" title="Nothing was saved">
              <p>{refusal}</p>
            </Alert>
          ) : null}

          <FormActions sticky>
            <Button type="submit" variant="secondary" loading={saving}>
              Save as draft
            </Button>
            <Button type="button" onClick={() => submit(true)} loading={saving}>
              Publish
            </Button>
          </FormActions>
        </form>

        <aside aria-label="Preview" className="hidden min-w-0 lg:sticky lg:top-20 lg:block lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-md">
                How members see it
              </CardTitle>
            </CardHeader>
            <CardBody>{preview}</CardBody>
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
              <strong className="text-primary">{title.trim() || 'This event'}</strong> becomes visible and
              registration opens straight away.
            </p>
            <p>{audienceLine}</p>
          </div>
        }
      />
    </>
  );
}
