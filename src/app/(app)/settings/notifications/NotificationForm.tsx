'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, FormActions, Select, Switch, useToast } from '@/components/ui';
import { outcomeToast } from '@/lib/client/api';

/**
 * Notification preferences: one table, topics down the side, channels
 * across the top.
 *
 * The two channels are independent all the way down: a member who wants
 * nothing by email and everything on WhatsApp is the normal case in India,
 * not an edge one. When the college has not set WhatsApp up, its column
 * is shown switched off rather than hidden, so the member knows it exists.
 */

export type Channel = 'connections' | 'events' | 'jobs' | 'newsletter' | 'giving';

export interface NotificationPrefs {
  email: Record<Channel, boolean>;
  whatsapp: Record<Channel, boolean>;
  digest: 'daily' | 'weekly' | 'never';
}

const TOPICS: Array<{ key: Channel; label: string; hint: string }> = [
  { key: 'connections', label: 'Requests', hint: 'Someone asks you for help, or answers a request you sent.' },
  { key: 'events', label: 'Events', hint: 'New events you can register for, and reminders for yours.' },
  { key: 'jobs', label: 'Jobs', hint: 'New openings, gathered into one summary.' },
  { key: 'newsletter', label: 'Newsletter', hint: 'News from the college and your department.' },
  { key: 'giving', label: 'Giving', hint: 'Campaign launches and progress.' },
];

export function NotificationForm({
  initial,
  whatsappEnabled,
  givingEnabled,
  collegeName,
  hasMobile,
}: {
  initial: NotificationPrefs;
  whatsappEnabled: boolean;
  givingEnabled: boolean;
  collegeName: string;
  hasMobile: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [prefs, setPrefs] = React.useState<NotificationPrefs>(initial);
  const [saved, setSaved] = React.useState<NotificationPrefs>(initial);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const topics = TOPICS.filter((t) => t.key !== 'giving' || givingEnabled);
  const dirty = JSON.stringify(prefs) !== JSON.stringify(saved);

  function toggle(channel: 'email' | 'whatsapp', key: Channel, next: boolean) {
    setPrefs((p) => ({ ...p, [channel]: { ...p[channel], [key]: next } }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `The server refused the change (${res.status}).`);
      }

      const body = (await res.json().catch(() => null)) as { persisted?: boolean } | null;
      const persisted = body?.persisted !== false;
      const t = outcomeToast({ status: 'ok', data: body, persisted }, 'Preferences saved');
      if (t) toast.show(t);
      setSaved(prefs);
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
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-display text-xl font-semibold">Message preferences</h2>
        <p className="text-sm text-secondary">For each kind of message, choose where you would like it to reach you.</p>
      </div>

      {error ? (
        <Alert tone="danger" title="Your preferences were not changed">
          {error}
        </Alert>
      ) : null}

      {whatsappEnabled ? null : (
        <p className="sm:hidden">
          <span className="inline-block rounded-full border border-line bg-surface-sunken px-2.5 py-0.5 text-xs text-secondary">
            WhatsApp: not set up for {collegeName} yet
          </span>
        </p>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[18rem] text-sm">
          <caption className="sr-only">Messages you are sent, by topic and channel</caption>
          <thead>
            <tr className="border-b border-line text-left align-bottom text-xs text-secondary">
              <th scope="col" className="px-4 py-3 font-medium sm:px-card">
                Topic
              </th>
              <th scope="col" className="w-20 px-2 py-3 text-center font-medium sm:w-28">
                Email
              </th>
              <th scope="col" className="w-24 px-2 py-3 text-center font-medium sm:w-48 sm:pr-card">
                <span className="block">WhatsApp</span>
                {whatsappEnabled ? null : (
                  <span className="mt-1 hidden whitespace-nowrap rounded-full border border-line bg-surface-sunken px-2 py-0.5 font-normal sm:inline-block">
                    Not set up for {collegeName} yet
                  </span>
                )}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {topics.map((t) => (
              <tr key={t.key} className="align-top">
                <th scope="row" className="px-4 py-4 text-left font-normal sm:px-card">
                  <span className="block font-medium text-primary">{t.label}</span>
                  <span className="block text-xs text-secondary">{t.hint}</span>
                  {t.key === 'jobs' ? (
                    <span className="mt-2 flex flex-wrap items-center gap-2">
                      <label htmlFor="digest" className="text-xs text-secondary">
                        How often
                      </label>
                      <span className="w-40">
                        <Select
                          id="digest"
                          value={prefs.digest}
                          onChange={(e) =>
                            setPrefs((p) => ({
                              ...p,
                              digest: e.currentTarget.value as NotificationPrefs['digest'],
                            }))
                          }
                          disabled={!prefs.email.jobs && !prefs.whatsapp.jobs}
                        >
                          <option value="daily">Once a day</option>
                          <option value="weekly">Once a week</option>
                          <option value="never">Never</option>
                        </Select>
                      </span>
                    </span>
                  ) : null}
                </th>
                <td className="px-2 py-4">
                  <ChannelSwitch
                    id={`email-${t.key}`}
                    label={`${t.label} by email`}
                    checked={prefs.email[t.key]}
                    onChange={(next) => toggle('email', t.key, next)}
                  />
                </td>
                <td className="px-2 py-4 sm:pr-card">
                  <ChannelSwitch
                    id={`whatsapp-${t.key}`}
                    label={`${t.label} on WhatsApp`}
                    checked={whatsappEnabled && prefs.whatsapp[t.key]}
                    disabled={!whatsappEnabled}
                    onChange={(next) => toggle('whatsapp', t.key, next)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {whatsappEnabled && !hasMobile ? (
        <p className="text-sm text-secondary">
          Add a mobile number on the Account tab to use WhatsApp.
        </p>
      ) : null}

      {dirty ? (
        <FormActions sticky>
          <p className="mr-auto text-sm font-medium" role="status">
            Not saved yet
          </p>
          <Button type="button" variant="ghost" className="min-h-11" onClick={() => setPrefs(saved)}>
            Undo
          </Button>
          <Button type="submit" className="min-h-11" loading={saving}>
            Save preferences
          </Button>
        </FormActions>
      ) : null}
    </form>
  );
}

/** The kit Switch with its label read by screen readers only, centred in a table cell. */
function ChannelSwitch({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex min-h-11 items-start justify-center">
      <Switch
        id={id}
        label={<span className="sr-only">{label}</span>}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.currentTarget.checked)}
        className="gap-0"
      />
    </div>
  );
}
