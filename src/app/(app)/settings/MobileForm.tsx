'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, Input, useToast } from '@/components/ui';

/**
 * Mobile number.
 *
 * Captured and stored, never used as a sign-in credential — email OTP is
 * the primary factor and the only one. A portal that lets a number
 * authenticate is a portal where a recycled SIM is an account takeover,
 * and Indian numbers get recycled after 90 days of inactivity.
 */
export function MobileForm({ initial }: { initial: string }) {
  const router = useRouter();
  const toast = useToast();

  const [value, setValue] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const dirty = value.trim() !== initial.trim();

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

      toast.success('Mobile number saved', 'Used for recovery only. It stays out of the directory.');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nothing was saved.';
      setError(message);
      toast.error('That did not save', message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <Field
        htmlFor="account-mobile"
        label="Mobile number"
        hint="Country code included. Recovery and WhatsApp only — never sign-in, never the directory."
        error={error}
        className="min-w-56 flex-1"
      >
        <Input
          id="account-mobile"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          placeholder="+91 98480 00000"
          invalid={Boolean(error)}
        />
      </Field>

      <Button type="submit" variant="secondary" loading={saving} disabled={!dirty} className="mb-0.5">
        Save number
      </Button>
    </form>
  );
}
