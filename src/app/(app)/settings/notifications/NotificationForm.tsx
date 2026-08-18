'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Mail, MessageCircle } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FormActions,
  Select,
  Switch,
  useToast,
} from '@/components/ui';

/**
 * Notification opt-ins.
 *
 * Split by channel rather than by topic, because the channels do not
 * behave alike. Email open rates on an Indian alumni list of this age are
 * poor and the address decays; WhatsApp is read. A member who wants
 * nothing by email and everything on WhatsApp is the normal case, not an
 * edge one, so the two columns are independent all the way down.
 */

export type Channel = 'connections' | 'events' | 'jobs' | 'newsletter' | 'giving';

export interface NotificationPrefs {
  email: Record<Channel, boolean>;
  whatsapp: Record<Channel, boolean>;
  digest: 'daily' | 'weekly' | 'never';
}

const TOPICS: Array<{ key: Channel; label: string; hint: string }> = [
  {
    key: 'connections',
    label: 'Connection requests and replies',
    hint: 'Someone asks to connect, or answers a request you sent. The one message most people want.',
  },
  {
    key: 'events',
    label: 'Events you are eligible for',
    hint: 'Reunions, industry connect sessions, and anything on campus. Sent once when announced, once a week before.',
  },
  {
    key: 'jobs',
    label: 'Jobs and internships',
    hint: 'New openings posted by alumni and the placement cell, batched — never one message per listing.',
  },
  {
    key: 'newsletter',
    label: 'College newsletter',
    hint: 'Quarterly. Department news, what the current batches are building, obituaries.',
  },
  {
    key: 'giving',
    label: 'Fundraising appeals',
    hint: 'Campaign launches and progress. Turning this off never affects anything else you receive.',
  },
];

export function NotificationForm({
  initial,
  whatsappEnabled,
  givingEnabled,
  collegeName,
}: {
  initial: NotificationPrefs;
  whatsappEnabled: boolean;
  givingEnabled: boolean;
  collegeName: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [prefs, setPrefs] = React.useState<NotificationPrefs>(initial);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const topics = TOPICS.filter((t) => t.key !== 'giving' || givingEnabled);
  const dirty = JSON.stringify(prefs) !== JSON.stringify(initial);

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

      toast.success('Preferences saved', 'Anything already queued for tonight still goes out.');
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
    <form onSubmit={onSubmit} className="space-y-6">
      {error ? (
        <Alert tone="danger" title="Your preferences were not changed">
          {error}
        </Alert>
      ) : null}

      {/* ---- Email ------------------------------------------------------ */}

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle as="h3" className="text-md">
              Email
            </CardTitle>
            <CardDescription>
              Sent to your sign-in address. If it starts bouncing, the college stops sending to it
              and asks you for another one — a list that keeps mailing dead addresses gets the whole
              college marked as spam.
            </CardDescription>
          </div>
          <Mail className="size-5 shrink-0 text-muted" aria-hidden="true" />
        </CardHeader>

        <CardBody className="space-y-5">
          {topics.map((t) => (
            <Switch
              key={t.key}
              id={`email-${t.key}`}
              label={t.label}
              hint={t.hint}
              checked={prefs.email[t.key]}
              onChange={(e) => toggle('email', t.key, e.currentTarget.checked)}
            />
          ))}

          <div className="border-t border-line pt-4">
            <Field
              htmlFor="digest"
              label="How often to batch the jobs email"
              hint="Applies to jobs and internships only. Connection requests are always sent as they happen — a referral that arrives four days late is not a referral."
              className="max-w-xs"
            >
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
                <option value="never">Do not batch — send nothing</option>
              </Select>
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* ---- WhatsApp --------------------------------------------------- */}

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle as="h3" className="text-md">
              WhatsApp
            </CardTitle>
            <CardDescription>
              Sent to the mobile number on your account, from the college&rsquo;s verified business
              number. Reply STOP on the thread and everything here switches off at once.
            </CardDescription>
          </div>
          <MessageCircle className="size-5 shrink-0 text-muted" aria-hidden="true" />
        </CardHeader>

        <CardBody className="space-y-5">
          {!whatsappEnabled ? (
            <Alert tone="neutral" title="Not connected yet">
              {collegeName} has not completed WhatsApp Business verification, so nothing is sent on
              this channel today. Your choices below are stored and take effect the day it goes
              live — they are not applied retrospectively to anything.
            </Alert>
          ) : null}

          {topics.map((t) => (
            <Switch
              key={t.key}
              id={`whatsapp-${t.key}`}
              label={t.label}
              hint={t.hint}
              checked={prefs.whatsapp[t.key]}
              onChange={(e) => toggle('whatsapp', t.key, e.currentTarget.checked)}
            />
          ))}
        </CardBody>
      </Card>

      <FormActions>
        <p className="mr-auto text-xs text-muted">
          {dirty ? 'Not saved yet.' : 'These are your current preferences.'}
        </p>
        <Button type="submit" loading={saving} disabled={!dirty}>
          Save preferences
        </Button>
      </FormActions>
    </form>
  );
}
