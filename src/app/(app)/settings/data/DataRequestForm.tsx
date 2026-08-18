'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  ConfirmDialog,
  Field,
  Fieldset,
  FormActions,
  Radio,
  Textarea,
  useToast,
} from '@/components/ui';
import type { DataRequest } from '@/lib/data/types';

/**
 * Raise a DPDP request.
 *
 * Deletion goes through a typed confirmation, not a second button. It is
 * the one action here that cannot be undone by anybody at the college:
 * the profile, the contact record and the connection history go, and the
 * roll number stops matching a portal account. A misclick that costs
 * somebody their alumni membership is worth eight keystrokes to avoid.
 */

type Kind = DataRequest['kind'];

const KINDS: Array<{ value: Kind; label: string; hint: string }> = [
  {
    value: 'export',
    label: 'Send me a copy of my data',
    hint: 'A machine-readable file with your profile, contact record, connection history, event registrations, job applications and consent log. Delivered as a download link to your sign-in address.',
  },
  {
    value: 'correction',
    label: 'Correct something that is wrong',
    hint: 'For anything you cannot edit yourself — a misspelled name in the degree register, the wrong branch, the wrong year of passing. Say what it should be.',
  },
  {
    value: 'deletion',
    label: 'Delete my account and data',
    hint: 'Removes your profile, contact record and connection history. Records the college is legally required to keep — donation receipts, the audit trail of staff actions — survive this, and the notes below say exactly which.',
  },
];

export function DataRequestForm({ openKinds }: { openKinds: Kind[] }) {
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

      toast.success(
        'Request received',
        'You will get an acknowledgement by email. The college has 30 days to answer.',
      );
      setDetail('');
      setConfirming(false);
      router.refresh();
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
      <form onSubmit={onSubmit} className="space-y-5">
        {error ? (
          <Alert tone="danger" title="Nothing was submitted">
            {error}
          </Alert>
        ) : null}

        <Fieldset legend="What do you want to ask for?">
          <div className="space-y-3">
            {KINDS.map((k) => (
              <div
                key={k.value}
                className={
                  kind === k.value
                    ? 'rounded-lg border border-[var(--button-primary-bg)] bg-surface-sunken p-3.5'
                    : 'rounded-lg border border-line p-3.5 hover:bg-surface-sunken'
                }
              >
                <Radio
                  id={`kind-${k.value}`}
                  name="kind"
                  value={k.value}
                  label={k.label}
                  hint={k.hint}
                  checked={kind === k.value}
                  onChange={() => setKind(k.value)}
                />
              </div>
            ))}
          </div>
        </Fieldset>

        <Field
          htmlFor="detail"
          label={needsDetail ? 'What is wrong, and what should it say?' : 'Anything to add (optional)'}
          hint={
            needsDetail
              ? 'Be specific. "Name is Kandula Sridevi, register shows Sridevi K" is actionable; "my details are wrong" starts a week of email.'
              : 'The alumni cell reads this. It does not change how long they have to answer.'
          }
          required={needsDetail}
        >
          <Textarea
            id="detail"
            value={detail}
            onChange={(e) => setDetail(e.currentTarget.value)}
            rows={4}
            maxLength={800}
            placeholder={
              needsDetail
                ? 'My year of passing shows 2018. I graduated in 2017 — roll 12KN1A0512.'
                : ''
            }
          />
        </Field>

        {alreadyOpen ? (
          <Alert tone="warning" title="You already have a request of this kind open">
            Sending a second one does not make it faster and restarts nothing. The due date on the
            existing request is below.
          </Alert>
        ) : null}

        <FormActions>
          <p className="mr-auto text-xs text-muted">
            The college must answer within 30 days of receiving this.
          </p>
          <Button
            type="submit"
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
              Your profile, contact record, connection history and event registrations are removed.
              You disappear from the directory, and anyone who was connected to you loses your
              details.
            </p>
            <p>
              Your row in the college&rsquo;s degree register is <strong>not</strong> touched — that
              is the examinations branch&rsquo;s record of your degree, not portal data. Donation
              receipts and the audit trail of staff actions on your record are retained under the
              legal exception explained on this page.
            </p>
            <p>Signing up again later means going through verification again.</p>
          </div>
        }
      />
    </>
  );
}
