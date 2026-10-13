'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, Input, describedBy, useToast } from '@/components/ui';
import { outcomeToast } from '@/lib/client/api';

/**
 * Mobile number, edited in place on the account card.
 *
 * Captured and stored, never used as a sign-in credential — email OTP is
 * the primary factor and the only one. A portal that lets a number
 * authenticate is a portal where a recycled SIM is an account takeover.
 */
export function MobileForm({ initial, hint }: { initial: string; hint: string }) {
  const router = useRouter();
  const toast = useToast();

  const [value, setValue] = React.useState(initial);
  const [saved, setSaved] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const dirty = value.trim() !== saved.trim();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: value.trim() }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string; fieldErrors?: { mobile?: string } }
          | null;
        throw new Error(
          body?.fieldErrors?.mobile ??
            body?.error ??
            `The server refused the change (${res.status}).`,
        );
      }

      const body = (await res.json().catch(() => null)) as { persisted?: boolean } | null;
      const persisted = body?.persisted !== false;
      const t = outcomeToast({ status: 'ok', data: body, persisted }, 'Mobile number saved');
      if (t) toast.show(t);
      setSaved(value);
      if (persisted) router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nothing was saved.';
      setError(message);
      toast.error('That did not save', message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-1.5">
      <Field htmlFor="account-mobile" label="Mobile number" hint={hint} error={error} className="[&>label]:sr-only">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="account-mobile"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
            placeholder="+91"
            invalid={Boolean(error)}
            aria-describedby={describedBy('account-mobile', { hint: true, error: Boolean(error) })}
            className="min-w-0 max-w-56 flex-1"
          />
          <Button type="submit" variant="secondary" className="min-h-11" loading={saving} disabled={!dirty}>
            Save number
          </Button>
        </div>
      </Field>
    </form>
  );
}
