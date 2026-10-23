'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';

import { Alert, Button, Card, CardBody, CardHeader, CardTitle, Field, Input, Select, Textarea, describedBy, useToast } from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';
import { INVITE_BATCH_MAX } from '@/lib/schemas/invitations';

/**
 * Invite by email, up to five at a time.
 *
 * Secondary to the share link above it, and the page says so: most people
 * in a batch group are reached faster on WhatsApp than by an address. What
 * the form is for is the batchmate you only have an email for.
 *
 * The answer is the same whether an address is new, already invited, or
 * already registered. That is deliberate (the endpoint will not say who is
 * on the portal), and the form does not try to guess.
 */

interface Row {
  key: number;
  email: string;
  name: string;
  batchYear: string;
}

const blank = (key: number): Row => ({ key, email: '', name: '', batchYear: '' });

export function InviteForm({ years, remaining, defaultBatch }: { years: number[]; remaining: number; defaultBatch: number | null }) {
  const toast = useToast();
  const router = useRouter();

  const next = React.useRef(1);
  const [rows, setRows] = React.useState<Row[]>([{ ...blank(0), batchYear: defaultBatch ? String(defaultBatch) : '' }]);
  const [message, setMessage] = React.useState('');
  const [errors, setErrors] = React.useState<Record<number, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [refusal, setRefusal] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ n: number; persisted: boolean } | null>(null);

  const limit = Math.min(INVITE_BATCH_MAX, Math.max(remaining, 0));

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const submit = async () => {
    const filled = rows.filter((r) => r.email.trim());
    const e: Record<number, string> = {};
    for (const r of filled) if (!/^\S+@\S+\.\S+$/.test(r.email.trim())) e[r.key] = 'That email address does not look right.';
    setErrors(e);
    if (filled.length === 0) {
      setRefusal('Add at least one address.');
      return;
    }
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    setRefusal(null);
    const outcome = await api.post<{ accepted: number }>('/api/invitations', {
      invitations: filled.map((r) => ({
        email: r.email.trim(),
        name: r.name.trim() || undefined,
        batchYear: r.batchYear ? Number(r.batchYear) : undefined,
      })),
      message: message.trim() || undefined,
    });
    setSaving(false);

    const t = outcomeToast(outcome, filled.length === 1 ? 'Invitation recorded' : `${filled.length} invitations recorded`);
    if (t) toast.show(t);

    if (outcome.status === 'ok') {
      setDone({ n: filled.length, persisted: outcome.persisted });
      setRows([blank(next.current++)]);
      setMessage('');
      if (outcome.persisted) router.refresh();
      return;
    }
    setRefusal(outcome.message);
  };

  if (limit === 0) {
    return (
      <Alert tone="neutral" title="You have used this week’s invitations">
        <p>The limit frees up as your oldest invitation passes seven days. The share link above has no limit.</p>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Invite by email</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          className="space-y-5"
          noValidate
          onSubmit={(ev) => {
            ev.preventDefault();
            void submit();
          }}
        >
          <ul className="space-y-4">
            {rows.map((r, i) => (
              <li key={r.key} className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_9rem_auto] sm:items-start">
                <Field htmlFor={`inv-email-${r.key}`} label={i === 0 ? 'Email' : `Email ${i + 1}`} error={errors[r.key]}>
                  <Input
                    id={`inv-email-${r.key}`}
                    type="email"
                    value={r.email}
                    onChange={(ev) => update(r.key, { email: ev.target.value })}
                    autoComplete="off"
                    invalid={Boolean(errors[r.key])}
                    aria-describedby={describedBy(`inv-email-${r.key}`, { error: Boolean(errors[r.key]) })}
                  />
                </Field>
                <Field htmlFor={`inv-name-${r.key}`} label="Name">
                  <Input id={`inv-name-${r.key}`} value={r.name} onChange={(ev) => update(r.key, { name: ev.target.value })} autoComplete="off" maxLength={80} />
                </Field>
                <Field htmlFor={`inv-batch-${r.key}`} label="Batch">
                  <Select id={`inv-batch-${r.key}`} value={r.batchYear} onChange={(ev) => update(r.key, { batchYear: ev.target.value })}>
                    <option value="">Any</option>
                    {years.map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
                  </Select>
                </Field>
                {rows.length > 1 ? (
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove address ${i + 1}`} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="min-h-11 sm:mt-6">
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                ) : (
                  <span className="hidden sm:block" />
                )}
              </li>
            ))}
          </ul>

          {rows.length < limit ? (
            <Button type="button" variant="ghost" onClick={() => setRows((rs) => [...rs, blank(next.current++)])} className="min-h-11">
              <Plus className="size-4" aria-hidden="true" />
              Add another
            </Button>
          ) : null}

          <Field htmlFor="inv-message" label="A note" hint="Optional. A line they will recognise you by." className="max-w-xl">
            <Textarea id="inv-message" value={message} onChange={(ev) => setMessage(ev.target.value)} rows={2} maxLength={300} />
          </Field>

          {refusal ? (
            <Alert tone="danger" title="Nothing was recorded">
              <p>{refusal}</p>
            </Alert>
          ) : null}
          {done ? (
            <Alert tone={done.persisted ? 'success' : 'neutral'} title={done.persisted ? 'Recorded' : 'Checked and ready'}>
              <p>
                {done.n === 1 ? 'That invitation is' : `Those ${done.n} invitations are`} on your list below. Each stays open for 30 days.
              </p>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-secondary">{remaining} left this week.</p>
            <Button type="submit" loading={saving} className="min-h-11">
              Invite
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
