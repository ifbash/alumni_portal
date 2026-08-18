'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Fieldset, FormActions, Radio, useToast } from '@/components/ui';
import type { ContactVisibility } from '@/lib/data/types';

/**
 * Contact visibility — the owner's half of the contact-release rule.
 *
 * Release needs two gates: the viewer must be entitled *and* the owner
 * must have consented. This control is the second gate, and it is the one
 * that belongs to the member. Role alone is never sufficient, which is
 * why an option here can lock out an administrator's colleague but not an
 * administrator with an explicit, audited export capability — and the
 * copy says so rather than implying an absolute.
 */

const OPTIONS: Array<{ value: ContactVisibility; label: string; hint: string }> = [
  {
    value: 'private',
    label: 'Nobody',
    hint: 'No member sees your email or mobile through the portal. People can still send you a connection request and you can reply from your own inbox — refusing to publish an address is not the same as refusing to be reachable.',
  },
  {
    value: 'on_accept',
    label: 'Only people whose request I accept',
    hint: 'Your email and mobile go to one person, once you accept them. Everyone else sees a masked address and is told why. This is the default, and it is the setting the network is designed around.',
  },
  {
    value: 'alumni_only',
    label: 'Alumni and faculty',
    hint: 'Alumni and faculty can see your email and mobile without asking. Students cannot, whatever they ask for.',
  },
  {
    value: 'all_members',
    label: 'Every verified member',
    hint: 'Students included. Your email is shown; your mobile number is still never listed in the directory, for anyone, at any setting.',
  },
];

export function VisibilityForm({ initial }: { initial: ContactVisibility }) {
  const router = useRouter();
  const toast = useToast();

  const [value, setValue] = React.useState<ContactVisibility>(initial);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const dirty = value !== initial;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/settings/privacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: value }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `The server refused the change (${res.status}).`);
      }

      toast.success(
        'Visibility updated',
        'A consent record was appended. The previous one stays in the log.',
      );
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nothing was changed.';
      setError(message);
      toast.error('That did not save', message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error ? (
        <Alert tone="danger" title="Your setting was not changed">
          {error}
        </Alert>
      ) : null}

      <Fieldset
        legend="Who can see your contact details"
        hint="This is your consent, and it can be changed at any time. Changing it does not withdraw contact details already released to someone who asked — it stops the next release."
      >
        <div className="space-y-3">
          {OPTIONS.map((o) => (
            // A plain div, not a wrapping <label>: `Radio` renders its own
            // label, and a label inside a label is invalid and confuses
            // every screen reader differently.
            <div
              key={o.value}
              className={
                value === o.value
                  ? 'rounded-lg border border-[var(--button-primary-bg)] bg-surface-sunken p-3.5 transition-colors duration-fast ease-brand'
                  : 'rounded-lg border border-line p-3.5 transition-colors duration-fast ease-brand hover:bg-surface-sunken'
              }
            >
              <Radio
                id={`visibility-${o.value}`}
                name="visibility"
                value={o.value}
                label={o.label}
                hint={o.hint}
                checked={value === o.value}
                onChange={() => setValue(o.value)}
              />
            </div>
          ))}
        </div>
      </Fieldset>

      <FormActions>
        <p className="mr-auto text-xs text-muted">
          {dirty ? 'Not saved yet.' : 'This is your current setting.'}
        </p>
        <Button type="submit" loading={saving} disabled={!dirty}>
          Save visibility
        </Button>
      </FormActions>
    </form>
  );
}
