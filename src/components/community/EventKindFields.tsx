'use client';

import * as React from 'react';

import { Field, Input, Select, describedBy } from '@/components/ui';
import { EVENT_KINDS, EVENT_MODES } from '@/lib/community';
import type { EventKind, EventMode } from '@/lib/data/types';

/**
 * The parts of an event form that say what kind of gathering it is: the
 * type, how it is held, the join link, the group hosting it and, for a
 * reunion, the batch. One component for the staff composer and the member
 * proposal form, so both ask the same questions in the same words.
 *
 * The join link has a hint that says who sees it, because that is the thing
 * an organiser worries about: it is shown to people who register, and to
 * nobody browsing the list.
 */

export interface EventKindValue {
  kind: EventKind;
  mode: EventMode;
  meetingUrl: string;
  groupSlug: string;
  batchYear: string;
}

export interface EventKindErrors {
  kind?: string;
  mode?: string;
  meetingUrl?: string;
  groupSlug?: string;
  batchYear?: string;
}

export function EventKindFields({
  idPrefix,
  value,
  onChange,
  errors = {},
  groups,
  years,
}: {
  idPrefix: string;
  value: EventKindValue;
  onChange: (next: EventKindValue) => void;
  errors?: EventKindErrors;
  /** The groups this person may host an event for. Empty hides the question. */
  groups: Array<{ slug: string; name: string }>;
  /** Batch years on the register, for a reunion. */
  years: number[];
}) {
  const set = <K extends keyof EventKindValue>(key: K, v: EventKindValue[K]) => onChange({ ...value, [key]: v });
  const online = value.mode === 'online' || value.mode === 'hybrid';
  const kindHint = EVENT_KINDS.find((k) => k.value === value.kind)?.blurb;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor={`${idPrefix}-kind`} label="Type" required hint={kindHint} error={errors.kind}>
          <Select
            id={`${idPrefix}-kind`}
            value={value.kind}
            onChange={(e) => set('kind', e.target.value as EventKind)}
            aria-describedby={describedBy(`${idPrefix}-kind`, { hint: Boolean(kindHint), error: Boolean(errors.kind) })}
          >
            {EVENT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field htmlFor={`${idPrefix}-mode`} label="How it is held" required error={errors.mode}>
          <Select
            id={`${idPrefix}-mode`}
            value={value.mode}
            onChange={(e) => set('mode', e.target.value as EventMode)}
            aria-describedby={describedBy(`${idPrefix}-mode`, { error: Boolean(errors.mode) })}
          >
            {EVENT_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {online ? (
        <Field
          htmlFor={`${idPrefix}-link`}
          label="Join link"
          required
          hint="Shown only to people who register, never in the list. Use an https address."
          error={errors.meetingUrl}
        >
          <Input
            id={`${idPrefix}-link`}
            type="url"
            inputMode="url"
            value={value.meetingUrl}
            onChange={(e) => set('meetingUrl', e.target.value)}
            placeholder="https://meet.google.com/…"
            autoComplete="off"
            spellCheck={false}
            invalid={Boolean(errors.meetingUrl)}
            aria-describedby={describedBy(`${idPrefix}-link`, { hint: true, error: Boolean(errors.meetingUrl) })}
          />
        </Field>
      ) : null}

      {value.kind === 'reunion' ? (
        <Field
          htmlFor={`${idPrefix}-batch`}
          label="Which batch"
          hint={years.length ? 'Leave blank for a reunion open to every batch.' : 'No batch years are on the register yet.'}
          error={errors.batchYear}
        >
          <Select
            id={`${idPrefix}-batch`}
            value={value.batchYear}
            onChange={(e) => set('batchYear', e.target.value)}
            disabled={years.length === 0}
            aria-describedby={describedBy(`${idPrefix}-batch`, { hint: true, error: Boolean(errors.batchYear) })}
          >
            <option value="">Every batch</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                Batch of {y}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {groups.length > 0 ? (
        <Field
          htmlFor={`${idPrefix}-group`}
          label="Hosted by a group"
          hint="Optional. The event appears on the group’s page as well."
          error={errors.groupSlug}
        >
          <Select
            id={`${idPrefix}-group`}
            value={value.groupSlug}
            onChange={(e) => set('groupSlug', e.target.value)}
            aria-describedby={describedBy(`${idPrefix}-group`, { hint: true, error: Boolean(errors.groupSlug) })}
          >
            <option value="">No group</option>
            {groups.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
    </div>
  );
}

export const EMPTY_EVENT_KIND: EventKindValue = {
  kind: 'meetup',
  mode: 'in_person',
  meetingUrl: '',
  groupSlug: '',
  batchYear: '',
};
