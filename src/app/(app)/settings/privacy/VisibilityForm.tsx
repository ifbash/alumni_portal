'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Eye, GraduationCap, Lock, ShieldCheck, UserCheck, Users, X, type LucideIcon } from 'lucide-react';
import { Alert, Badge, Button, Card, FormActions, Radio, useToast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { outcomeToast } from '@/lib/client/api';
import { VISIBILITY_FOOTNOTE, VISIBILITY_OPTIONS } from '@/lib/visibility-copy';
import type { ContactVisibility } from '@/lib/data/types';

/**
 * Contact visibility — the owner's half of contact release.
 *
 * Release needs two things at once: the viewer must be entitled, and the
 * owner must have agreed. This control is the owner's part. The matrix
 * under it shows, for the option being chosen, what each kind of viewer
 * gets; the server computes it by running the release rule, so choosing
 * an option shows its real consequence before anything is saved.
 */

/** One glyph per option, so the four cards read at a glance before the words do. */
const OPTION_ICON: Record<ContactVisibility, LucideIcon> = {
  private: Lock,
  on_accept: UserCheck,
  alumni_only: GraduationCap,
  all_members: Users,
};

export type MatrixCell = 'yes' | 'on_accept' | 'no';

export interface MatrixRow {
  key: string;
  label: string;
  profile: MatrixCell;
  email: MatrixCell;
  mobile: MatrixCell;
}

export type Matrices = Record<ContactVisibility, MatrixRow[]>;

export function VisibilityForm({
  initial,
  matrices,
  readOnly = false,
  officeName,
  ownerIsStudent = false,
}: {
  initial: ContactVisibility;
  matrices: Matrices;
  /** A role without profile editing sees its setting but cannot change it. */
  readOnly?: boolean;
  officeName: string;
  ownerIsStudent?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [value, setValue] = React.useState<ContactVisibility>(initial);
  const [saved, setSaved] = React.useState<ContactVisibility>(initial);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const dirty = value !== saved;
  const current = VISIBILITY_OPTIONS.find((o) => o.value === saved);
  const chosen = VISIBILITY_OPTIONS.find((o) => o.value === value);

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

      const body = (await res.json().catch(() => null)) as { persisted?: boolean } | null;
      const persisted = body?.persisted !== false;
      const t = outcomeToast({ status: 'ok', data: body, persisted }, 'Setting saved');
      if (t) toast.show(t);
      setSaved(value);
      if (persisted) router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nothing was changed.';
      setError(message);
      toast.error('That did not save', message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <section aria-labelledby="who-can-reach" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 id="who-can-reach" className="font-display text-xl font-semibold">
              Who can see your contact details
            </h2>
            <p className="text-sm text-secondary">
              {readOnly ? 'Your email and mobile.' : 'Your email and mobile. You can change this at any time.'}
            </p>
          </div>
          {current ? (
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-brand-soft px-3 text-xs font-semibold text-brand-soft-fg">
              <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
              Now: {current.label}
            </span>
          ) : null}
        </div>

        {error ? (
          <Alert tone="danger" title="Your setting was not changed">
            {error}
          </Alert>
        ) : null}

        <fieldset className="space-y-3" disabled={readOnly}>
          <legend className="sr-only">Who can see your contact details</legend>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {VISIBILITY_OPTIONS.map((o) => {
              const selected = value === o.value;
              const OptionIcon = OPTION_ICON[o.value];
              return (
                <div
                  key={o.value}
                  className={cn(
                    'relative rounded-lg border bg-surface-raised p-4 transition-colors duration-fast ease-brand',
                    selected
                      ? 'border-[var(--button-primary-bg)] ring-1 ring-[var(--button-primary-bg)]'
                      : 'border-line hover:border-line-strong',
                  )}
                >
                  {/* The label's stretched span makes the whole card the
                      target, without a label inside a label. */}
                  <Radio
                    id={`visibility-${o.value}`}
                    name="visibility"
                    value={o.value}
                    checked={selected}
                    // Above the card-wide label target, so the control itself stays clickable.
                    className="relative z-10"
                    onChange={() => setValue(o.value)}
                    label={
                      <span className="block space-y-1 after:absolute after:inset-0 after:rounded-lg">
                        <span
                          aria-hidden="true"
                          className={cn(
                            'mb-2 grid size-9 place-items-center rounded-full',
                            selected ? 'bg-brand-soft text-brand-soft-fg' : 'bg-surface-sunken text-secondary',
                          )}
                        >
                          <OptionIcon className="size-4" />
                        </span>
                        <span className="flex flex-wrap items-center gap-2 font-medium">
                          {o.label}
                          {o.recommended ? <Badge tone="brand">Recommended</Badge> : null}
                        </span>
                        <span className="block text-xs text-secondary">{o.line}</span>
                      </span>
                    }
                  />
                </div>
              );
            })}
          </div>
        </fieldset>

        <p className="text-xs text-secondary">
          {VISIBILITY_FOOTNOTE}
          {readOnly ? ` Your role cannot change this setting; the ${officeName} can.` : ''}
        </p>
      </section>

      <section aria-labelledby="who-sees-what" className="space-y-3">
        <div className="space-y-1">
          <h2 id="who-sees-what" className="font-display text-xl font-semibold">
            Who can see what
          </h2>
          <p className="text-sm text-secondary" aria-live="polite">
            With “{chosen?.label ?? value}”{dirty ? ', not saved yet' : ''}.
          </p>
        </div>

        <Card className="overflow-x-auto">
          <table className="w-full min-w-[20rem] text-sm">
            <caption className="sr-only">
              What each kind of viewer sees with the setting chosen above
            </caption>
            <thead>
              <tr className="border-b border-line text-left text-xs text-secondary">
                <th scope="col" className="px-4 py-3 font-medium sm:px-card">
                  <span className="sr-only">Viewer</span>
                </th>
                <th scope="col" className="px-2 py-3 font-medium">
                  Profile
                </th>
                <th scope="col" className="px-2 py-3 font-medium">
                  Email
                </th>
                <th scope="col" className="px-2 py-3 font-medium sm:pr-card">
                  Mobile
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {matrices[value].map((row) => (
                <tr key={row.key}>
                  <th scope="row" className="px-4 py-3 text-left font-medium text-primary sm:px-card">
                    {row.label}
                  </th>
                  <td className="px-2 py-3">
                    <Cell value={row.profile} />
                  </td>
                  <td className="px-2 py-3">
                    <Cell value={row.email} />
                  </td>
                  <td className="px-2 py-3 sm:pr-card">
                    <Cell value={row.mobile} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <p className="text-xs text-secondary">
          {ownerIsStudent
            ? 'Alumni see your name, branch and batch when you write to them. Someone who holds two roles gets both.'
            : 'Someone who holds two roles gets both.'}
        </p>
      </section>

      {dirty && !readOnly ? (
        <FormActions sticky>
          <p className="mr-auto text-sm font-medium" role="status">
            Not saved yet
          </p>
          <Button type="button" variant="ghost" className="min-h-11" onClick={() => setValue(saved)}>
            Undo
          </Button>
          <Button type="submit" className="min-h-11" loading={saving}>
            Save setting
          </Button>
        </FormActions>
      ) : null}
    </form>
  );
}

function Cell({ value }: { value: MatrixCell }) {
  if (value === 'yes') {
    return (
      <span className="inline-flex items-center gap-1.5 text-primary">
        <Eye className="size-3.5 shrink-0 text-brand-fg" aria-hidden="true" />
        Yes
      </span>
    );
  }
  if (value === 'on_accept') {
    return (
      <span className="inline-flex items-center gap-1.5 text-primary">
        <Clock className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
        If you accept
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-secondary">
      <X className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
      No
    </span>
  );
}
