'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Download, PencilLine, Trash2 } from 'lucide-react';
import {
  Alert,
  Button,
  ConfirmDialog,
  Field,
  FormActions,
  Radio,
  Textarea,
  useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { outcomeToast } from '@/lib/client/api';
import type { DataRequest } from '@/lib/data/types';

/**
 * Ask the college about your data: a copy, a correction, or deletion.
 *
 * Three cards, one choice. Deletion goes through a typed confirmation, not
 * a second button: it is the one action here nobody at the college can
 * undo, and a misclick that costs somebody their alumni membership is worth
 * a few keystrokes to avoid.
 */

type Kind = DataRequest['kind'];

const KINDS: Array<{ value: Kind; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }> = [
  {
    value: 'export',
    label: 'A copy of my data',
    hint: 'A file with your profile, contact details, requests, registrations and consent history.',
    icon: Download,
  },
  {
    value: 'correction',
    label: 'A correction',
    hint: 'For anything you cannot edit yourself, such as your name, branch or year in the register.',
    icon: PencilLine,
  },
  {
    value: 'deletion',
    label: 'Delete my account',
    hint: 'Removes your profile, contact details and requests. Some records must be kept.',
    icon: Trash2,
  },
];

export function DataRequestForm({ openKinds, responseDays }: { openKinds: Kind[]; responseDays: number }) {
  const router = useRouter();
  const toast = useToast();

  const [kind, setKind] = React.useState<Kind>('export');
  const [detail, setDetail] = React.useState('');
  const [confirming, setConfirming] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const alreadyOpen = openKinds.includes(kind);
  const needsDetail = kind === 'correction';
  const detailMissing = needsDetail && detail.trim().length < 10;

  async function send() {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/data-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, detail: detail.trim() || null }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `The request was not accepted (${res.status}).`);
      }

      const body = (await res.json().catch(() => null)) as { persisted?: boolean } | null;
      const persisted = body?.persisted !== false;
      const t = outcomeToast({ status: 'ok', data: body, persisted }, 'Request received');
      if (t) toast.show(t);
      setDetail('');
      setConfirming(false);
      if (persisted) router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The request was not sent.';
      setError(message);
      toast.error('Not sent', message);
    } finally {
      setSaving(false);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (kind === 'deletion') {
      setConfirming(true);
      return;
    }
    void send();
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-4" aria-labelledby="data-ask">
        <h2 id="data-ask" className="font-display text-xl font-semibold">
          What do you need?
        </h2>

        {error ? (
          <Alert tone="danger" title="Nothing was sent">
            {error}
          </Alert>
        ) : null}

        <fieldset>
          <legend className="sr-only">What do you need?</legend>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {KINDS.map((k) => {
              const selected = kind === k.value;
              return (
                <div
                  key={k.value}
                  className={cn(
                    'relative rounded-lg border bg-surface-raised p-4 transition-colors duration-fast ease-brand',
                    selected
                      ? 'border-[var(--button-primary-bg)] ring-1 ring-[var(--button-primary-bg)]'
                      : 'border-line hover:border-line-strong',
                  )}
                >
                  <Radio
                    id={`kind-${k.value}`}
                    name="kind"
                    value={k.value}
                    checked={selected}
                    // Above the card-wide label target, so the control itself stays clickable.
                    className="relative z-10"
                    onChange={() => setKind(k.value)}
                    label={
                      <span className="block space-y-1 after:absolute after:inset-0 after:rounded-lg">
                        <span className="flex items-center gap-2 font-medium">
                          <k.icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
                          {k.label}
                        </span>
                        <span className="block text-xs text-secondary">{k.hint}</span>
                      </span>
                    }
                  />
                </div>
              );
            })}
          </div>
        </fieldset>

        <Field
          htmlFor="detail"
          label={needsDetail ? 'What is wrong, and what should it say?' : 'Anything to add (optional)'}
          hint={needsDetail ? 'Be specific, so the college can act on it.' : undefined}
          required={needsDetail}
          className="max-w-2xl"
        >
          <Textarea
            id="detail"
            value={detail}
            onChange={(e) => setDetail(e.currentTarget.value)}
            rows={3}
            maxLength={800}
            placeholder={needsDetail ? 'My year of passing shows 2018. It should be 2017.' : ''}
            aria-describedby={needsDetail ? 'detail-hint' : undefined}
          />
        </Field>

        {alreadyOpen ? (
          <Alert tone="warning" title="You already have a request of this kind open">
            A second one does not make it faster. Its due date is shown above.
          </Alert>
        ) : null}

        <FormActions>
          <p className="mr-auto text-xs text-secondary">
            The college must answer within {responseDays} days of receiving this.
          </p>
          <Button
            type="submit"
            className="min-h-11"
            variant={kind === 'deletion' ? 'danger' : 'primary'}
            loading={saving}
            disabled={alreadyOpen || detailMissing}
          >
            {kind === 'deletion' ? 'Request deletion' : 'Send request'}
          </Button>
        </FormActions>
      </form>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void send()}
        pending={saving}
        title="Delete your alumni account"
        confirmLabel="Request deletion"
        requireTyped="DELETE"
        body={
          <div className="space-y-2">
            <p>
              Your profile, contact details, requests and event registrations are removed. You
              disappear from the directory, and people you were connected to lose your details.
            </p>
            <p>
              Your row in the college&rsquo;s degree register is <strong>not</strong> touched.
              Donation records, tax receipts and the record of staff actions are kept, as the law
              requires.
            </p>
            <p>Registering again later means being verified again.</p>
          </div>
        }
      />
    </>
  );
}
