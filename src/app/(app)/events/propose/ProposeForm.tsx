'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Info } from 'lucide-react';

import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Fieldset,
  FormActions,
  Input,
  Radio,
  Textarea,
  describedBy,
  useToast,
} from '@/components/ui';
import {
  EMPTY_EVENT_KIND,
  EventKindFields,
  type EventKindErrors,
  type EventKindValue,
} from '@/components/community/EventKindFields';
import { api, outcomeToast } from '@/lib/client/api';
import type { EventKind } from '@/lib/data/types';

/**
 * The proposal form.
 *
 * Says up front what happens next, because the question in a member's mind
 * is whether pressing the button publishes the event. It does not: it goes
 * to the alumni cell, and nobody else can see it until it is approved.
 */

type Audience = 'both' | 'alumni_only';

interface Errors {
  title?: string;
  description?: string;
  startDate?: string;
  startTime?: string;
  end?: string;
  venue?: string;
  capacity?: string;
  price?: string;
}

interface Sent {
  href: string;
  note: string;
  persisted: boolean;
}

const FIELD_MAP: Record<string, keyof Errors> = {
  title: 'title',
  description: 'description',
  startsAt: 'startDate',
  endsAt: 'end',
  venue: 'venue',
  capacity: 'capacity',
  ticketPrice: 'price',
};

export function ProposeForm({
  groups,
  years,
  initialKind,
  initialBatch,
  initialGroup,
  earliest,
  leadDays,
  timeZoneLabel,
  officeName,
}: {
  groups: Array<{ slug: string; name: string }>;
  years: number[];
  initialKind: EventKind | null;
  initialBatch: number | null;
  initialGroup: string | null;
  /** YYYY-MM-DD: the earliest start the alumni cell can act on. */
  earliest: string;
  leadDays: number;
  timeZoneLabel: string;
  officeName: string;
}) {
  const toast = useToast();
  const router = useRouter();

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [venue, setVenue] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [startTime, setStartTime] = React.useState('18:00');
  const [endDate, setEndDate] = React.useState('');
  const [endTime, setEndTime] = React.useState('21:00');
  const [audience, setAudience] = React.useState<Audience>('both');
  const [capacity, setCapacity] = React.useState('');
  const [price, setPrice] = React.useState('0');
  const [kindValue, setKindValue] = React.useState<EventKindValue>({
    ...EMPTY_EVENT_KIND,
    kind: initialKind ?? 'meetup',
    batchYear: initialBatch ? String(initialBatch) : '',
    groupSlug: initialGroup ?? '',
  });

  const [errors, setErrors] = React.useState<Errors>({});
  const [kindErrors, setKindErrors] = React.useState<EventKindErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [refusal, setRefusal] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState<Sent | null>(null);

  const startsAt = startDate ? new Date(`${startDate}T${startTime || '00:00'}`) : null;
  const endsAt = endDate ? new Date(`${endDate}T${endTime || '00:00'}`) : null;
  const ok = (d: Date | null) => (d && !Number.isNaN(d.getTime()) ? d : null);

  const validate = (): { e: Errors; k: EventKindErrors } => {
    const e: Errors = {};
    const k: EventKindErrors = {};
    if (title.trim().length < 4) e.title = 'Give the event a title members will recognise in a list.';
    if (description.trim().length < 40) {
      e.description = 'Say what it is, who it is for and what happens, in a couple of sentences at least.';
    }
    if (!startDate) e.startDate = 'A start date is required.';
    else if (!ok(startsAt)) e.startDate = 'That date and time could not be read.';
    else if (startDate < earliest) e.startDate = `Pick a date on or after ${earliest}, so the ${officeName} has ${leadDays} days to act on it.`;
    if (ok(startsAt) && ok(endsAt) && endsAt!.getTime() <= startsAt!.getTime()) e.end = 'The event cannot finish before it starts.';
    if (!venue.trim()) e.venue = 'Say where it is, even if that is “Online”.';
    if (capacity && (!/^\d+$/.test(capacity) || Number(capacity) < 1)) e.capacity = 'A whole number of seats, or blank for no limit.';
    if (!/^\d+$/.test(price || '0')) e.price = 'A ticket price in whole rupees. 0 for a free event.';
    if (kindValue.mode !== 'in_person') {
      if (!kindValue.meetingUrl.trim()) k.meetingUrl = 'An online event needs the link people join with.';
      else if (!/^https:\/\//i.test(kindValue.meetingUrl.trim())) k.meetingUrl = 'Use an https link.';
    }
    return { e, k };
  };

  const submit = async () => {
    const { e, k } = validate();
    setErrors(e);
    setKindErrors(k);
    if (Object.keys(e).length > 0 || Object.keys(k).length > 0) {
      toast.error('Some details need attention', 'The fields marked in red are stopping this from being sent.');
      return;
    }

    setSaving(true);
    setRefusal(null);
    const outcome = await api.post<{ href: string; note: string }>('/api/events/propose', {
      title: title.trim(),
      description: description.trim(),
      venue: venue.trim(),
      startsAt: startsAt!.toISOString(),
      endsAt: ok(endsAt) ? endsAt!.toISOString() : undefined,
      audience,
      capacity: capacity ? Number(capacity) : undefined,
      ticketPrice: Number(price || 0),
      kind: kindValue.kind,
      mode: kindValue.mode,
      meetingUrl: kindValue.mode === 'in_person' ? undefined : kindValue.meetingUrl.trim(),
      groupSlug: kindValue.groupSlug || undefined,
      batchYear: kindValue.kind === 'reunion' && kindValue.batchYear ? Number(kindValue.batchYear) : undefined,
    });
    setSaving(false);

    const t = outcomeToast(outcome, 'Proposal sent');
    if (t) toast.show(t);

    if (outcome.status === 'ok') {
      setSent({ href: outcome.data.href, note: outcome.data.note, persisted: outcome.persisted });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (outcome.persisted) router.refresh();
      return;
    }
    if (outcome.status === 'invalid') {
      const mapped: Errors = {};
      const mappedKind: EventKindErrors = {};
      for (const [key, message] of Object.entries(outcome.fieldErrors)) {
        const slot = FIELD_MAP[key];
        if (slot) mapped[slot] = message;
        else if (key === 'kind' || key === 'mode' || key === 'meetingUrl' || key === 'groupSlug' || key === 'batchYear') {
          mappedKind[key] = message;
        }
      }
      setErrors((cur) => ({ ...cur, ...mapped }));
      setKindErrors((cur) => ({ ...cur, ...mappedKind }));
      if (Object.keys(mapped).length === 0 && Object.keys(mappedKind).length === 0) setRefusal(outcome.message);
      return;
    }
    if (outcome.status === 'conflict') {
      setErrors((cur) => ({ ...cur, title: outcome.message }));
      return;
    }
    setRefusal(outcome.message);
  };

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-success-fg" aria-hidden="true" />
            {sent.persisted ? 'Sent to the ' + officeName : 'Checked and ready to send'}
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-md">{sent.note}</p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/events" variant="secondary" className="min-h-11">
              Back to events
            </ButtonLink>
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => {
                setSent(null);
                setTitle('');
                setDescription('');
                setVenue('');
              }}
            >
              Propose another
            </Button>
          </div>
          {sent.persisted ? (
            <p className="text-sm text-secondary">
              You can see where it stands on your <Link href="/events" className="link">Events page</Link>.
            </p>
          ) : null}
        </CardBody>
      </Card>
    );
  }

  return (
    <form
      className="max-w-3xl space-y-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Alert tone="neutral" icon={<Info className="size-4 text-brand-fg" />} title="Nothing is published yet">
        <p>
          The {officeName} reads every proposal and approves or declines it. Until then only you and the people who run
          events can see it. Give at least {leadDays} days of notice.
        </p>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle as="h2">The event</CardTitle>
        </CardHeader>
        <CardBody className="space-y-5">
          <Field htmlFor="prop-title" label="Title" required error={errors.title}>
            <Input
              id="prop-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              placeholder="e.g. Batch of 2016 — ten year reunion"
              invalid={Boolean(errors.title)}
              aria-describedby={describedBy('prop-title', { error: Boolean(errors.title) })}
            />
          </Field>

          <Field
            htmlFor="prop-description"
            label="What is it"
            required
            hint="Who it is for, what happens, and anything people need to decide whether to come."
            error={errors.description}
          >
            <Textarea
              id="prop-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              invalid={Boolean(errors.description)}
              aria-describedby={describedBy('prop-description', { hint: true, error: Boolean(errors.description) })}
            />
          </Field>

          <EventKindFields
            idPrefix="prop"
            value={kindValue}
            onChange={setKindValue}
            errors={kindErrors}
            groups={groups}
            years={years}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">When and where</CardTitle>
        </CardHeader>
        <CardBody className="space-y-5">
          <Fieldset legend="Date and time" hint={`Times are in ${timeZoneLabel}. Leave the end blank if it is open-ended.`}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field htmlFor="prop-start-date" label="Starts on" required error={errors.startDate}>
                <Input
                  id="prop-start-date"
                  type="date"
                  min={earliest}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  invalid={Boolean(errors.startDate)}
                  aria-describedby={describedBy('prop-start-date', { error: Boolean(errors.startDate) })}
                />
              </Field>
              <Field htmlFor="prop-start-time" label="Start time" required>
                <Input id="prop-start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </Field>
              <Field htmlFor="prop-end-date" label="Ends on" error={errors.end}>
                <Input
                  id="prop-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  invalid={Boolean(errors.end)}
                  aria-describedby={describedBy('prop-end-date', { error: Boolean(errors.end) })}
                />
              </Field>
              <Field htmlFor="prop-end-time" label="End time">
                <Input id="prop-end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </Field>
            </div>
          </Fieldset>

          <Field
            htmlFor="prop-venue"
            label="Venue"
            required
            hint="A place, or “Online”. For an online event, the join link goes above and is shown only to people who register."
            error={errors.venue}
          >
            <Input
              id="prop-venue"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              invalid={Boolean(errors.venue)}
              aria-describedby={describedBy('prop-venue', { hint: true, error: Boolean(errors.venue) })}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Who and how many</CardTitle>
        </CardHeader>
        <CardBody className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-primary">Who it is for</legend>
            <Radio
              id="prop-aud-both"
              name="audience"
              checked={audience === 'both'}
              onChange={() => setAudience('both')}
              label="Alumni and final-year students"
            />
            <Radio
              id="prop-aud-alumni"
              name="audience"
              checked={audience === 'alumni_only'}
              onChange={() => setAudience('alumni_only')}
              label="Alumni only"
              hint="Students will not see it anywhere on the portal."
            />
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              htmlFor="prop-capacity"
              label="Seats"
              hint="Leave blank for no limit."
              error={errors.capacity}
            >
              <Input
                id="prop-capacity"
                inputMode="numeric"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                invalid={Boolean(errors.capacity)}
                aria-describedby={describedBy('prop-capacity', { hint: true, error: Boolean(errors.capacity) })}
              />
            </Field>
            <Field
              htmlFor="prop-price"
              label="Ticket price (₹)"
              hint="0 for a free event."
              error={errors.price}
            >
              <Input
                id="prop-price"
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                invalid={Boolean(errors.price)}
                aria-describedby={describedBy('prop-price', { hint: true, error: Boolean(errors.price) })}
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      {refusal ? (
        <Alert tone="danger" title="Nothing was sent">
          <p>{refusal}</p>
        </Alert>
      ) : null}

      <FormActions sticky>
        <ButtonLink href="/events" variant="ghost">
          Cancel
        </ButtonLink>
        <Button type="submit" loading={saving}>
          Send for approval
        </Button>
      </FormActions>
    </form>
  );
}
