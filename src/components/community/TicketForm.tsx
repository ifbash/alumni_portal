'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Alert, Button, Field, Input, Select, Textarea, describedBy, useToast } from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';
import { TICKET_CATEGORIES } from '@/lib/community';
import type { TicketCategory } from '@/lib/data/types';

/**
 * Ask the alumni office.
 *
 * Three fields: what it is about, a subject, and what happened. The
 * category is a short list of the things that actually come up (signing in,
 * registration, privacy), and it exists so the question reaches somebody
 * who can answer it rather than so a form looks thorough.
 */

interface Errors {
  category?: string;
  subject?: string;
  body?: string;
}

export function TicketForm({ officeName, defaultCategory }: { officeName: string; defaultCategory?: TicketCategory }) {
  const toast = useToast();
  const router = useRouter();

  const [category, setCategory] = React.useState<TicketCategory | ''>(defaultCategory ?? '');
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [errors, setErrors] = React.useState<Errors>({});
  const [saving, setSaving] = React.useState(false);
  const [refusal, setRefusal] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState<{ note: string; href: string; persisted: boolean } | null>(null);

  const submit = async () => {
    const e: Errors = {};
    if (!category) e.category = 'Pick what it is about.';
    if (subject.trim().length < 8) e.subject = 'A few words on what it is about.';
    if (body.trim().length < 20) e.body = 'Say what happened and what you expected. A line is rarely enough for someone to help.';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    setRefusal(null);
    const outcome = await api.post<{ note: string; href: string }>('/api/helpdesk', {
      category,
      subject: subject.trim(),
      body: body.trim(),
    });
    setSaving(false);

    const t = outcomeToast(outcome, 'Sent to the alumni office');
    if (t) toast.show(t);

    if (outcome.status === 'ok') {
      setSent({ note: outcome.data.note, href: outcome.data.href, persisted: outcome.persisted });
      setSubject('');
      setBody('');
      if (outcome.persisted) router.refresh();
      return;
    }
    if (outcome.status === 'invalid') {
      setErrors((cur) => ({ ...cur, ...(outcome.fieldErrors as Errors) }));
      if (!Object.keys(outcome.fieldErrors).length) setRefusal(outcome.message);
      return;
    }
    setRefusal(outcome.message);
  };

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        void submit();
      }}
    >
      {sent ? (
        <Alert tone={sent.persisted ? 'success' : 'neutral'} title={sent.persisted ? 'Sent' : 'Checked and ready to send'}>
          <p>{sent.note}</p>
        </Alert>
      ) : null}

      <Field htmlFor="hd-category" label="What is it about" required error={errors.category}>
        <Select
          id="hd-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as TicketCategory | '')}
          invalid={Boolean(errors.category)}
          aria-describedby={describedBy('hd-category', { error: Boolean(errors.category) })}
        >
          <option value="">Choose</option>
          {TICKET_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field htmlFor="hd-subject" label="Subject" required error={errors.subject}>
        <Input
          id="hd-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={120}
          invalid={Boolean(errors.subject)}
          aria-describedby={describedBy('hd-subject', { error: Boolean(errors.subject) })}
        />
      </Field>

      <Field
        htmlFor="hd-body"
        label="What happened"
        required
        hint={`The ${officeName} reads this. Do not include passwords or a full card number.`}
        error={errors.body}
      >
        <Textarea
          id="hd-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          maxLength={2000}
          invalid={Boolean(errors.body)}
          aria-describedby={describedBy('hd-body', { hint: true, error: Boolean(errors.body) })}
        />
      </Field>

      {refusal ? (
        <Alert tone="danger" title="Nothing was sent">
          <p>{refusal}</p>
        </Alert>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" loading={saving} className="min-h-11">
          Send
        </Button>
      </div>
    </form>
  );
}
