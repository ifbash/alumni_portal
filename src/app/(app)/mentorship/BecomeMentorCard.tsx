'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, Megaphone, MessageSquare } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Disclosure,
  Switch,
  useToast,
} from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';
import { cn } from '@/lib/cn';
import { availabilityCopy, type AvailabilityKey } from '@/lib/availability-copy';

/**
 * What a graduate is open to, one switch per commitment.
 *
 * Each switch carries one line on what it means, from the same copy the
 * profile form and the directory chips use, with the longer detail in a
 * disclosure for whoever wants it. Faculty without the alumni role get no
 * referrals switch: a referral is an alumnus vouching for a student at
 * their own employer.
 *
 * This is the one interactive leaf in the module. It receives its initial
 * state as props: a client component may not read the session or the
 * repository, and the page above it has already done both.
 */

interface Availability {
  mentoring: boolean;
  referrals: boolean;
  speaking: boolean;
}

const ICON: Record<AvailabilityKey, React.ReactNode> = {
  mentoring: <MessageSquare className="size-4" />,
  referrals: <Briefcase className="size-4" />,
  speaking: <Megaphone className="size-4" />,
};

export function BecomeMentorCard({
  mentoring,
  referrals,
  speaking,
  audience,
  company,
  officeName,
  openLimit,
}: {
  mentoring: boolean;
  referrals: boolean;
  speaking: boolean;
  /** `faculty` means faculty without the alumni role. */
  audience: 'alumni' | 'faculty';
  company: string | null;
  officeName: string;
  /** The per-student open-request limit, from the server's configuration. */
  openLimit: number;
}) {
  const router = useRouter();
  const toast = useToast();

  const initial = React.useMemo<Availability>(
    () => ({ mentoring, referrals, speaking }),
    [mentoring, referrals, speaking],
  );

  const [value, setValue] = React.useState<Availability>(initial);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Re-sync when the server sends a fresh record after `router.refresh()`,
  // so a save that succeeded elsewhere does not leave this form dirty.
  React.useEffect(() => setValue(initial), [initial]);

  const ctx = { audience, company, officeName, openLimit };
  const entries = (['mentoring', 'referrals', 'speaking'] as const).flatMap((key) => {
    const copy = availabilityCopy(key, ctx);
    return copy ? [{ key, ...copy }] : [];
  });

  const dirty =
    value.mentoring !== initial.mentoring ||
    value.referrals !== initial.referrals ||
    value.speaking !== initial.speaking;

  const onCount = entries.filter((e) => value[e.key]).length;

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const outcome = await api.patch('/api/profile', {
      openToMentoring: value.mentoring,
      openToReferrals: value.referrals,
      openToSpeaking: value.speaking,
    });
    setSaving(false);

    const t = outcomeToast(
      outcome,
      onCount === 0 ? 'You are no longer offered to students' : 'What you are open to is saved',
    );
    if (t) toast.show(t);

    if (outcome.status !== 'ok') {
      setError(outcome.message);
      return;
    }
    // A real write re-renders the page from the stored record. A write
    // that was not stored leaves the switches where they are, still
    // marked unsaved, rather than showing a success that reverts.
    if (outcome.persisted) router.refresh();
  }

  return (
    <Card as="section" id="availability" aria-labelledby="availability-title" className="scroll-mt-20">
      <CardHeader variant="stack">
        <CardTitle as="h2" id="availability-title">
          What you are open to
        </CardTitle>
        <CardDescription>Your email and phone stay with your privacy setting, whatever you switch on here.</CardDescription>
      </CardHeader>

      <form onSubmit={save}>
        <CardBody className="space-y-3">
          {error ? (
            <Alert tone="danger" title="Nothing was changed">
              {error}
            </Alert>
          ) : null}

          {entries.map((c) => {
            const on = value[c.key];
            return (
              <div
                key={c.key}
                className={cn(
                  'rounded-lg border p-3.5 transition-colors duration-fast ease-brand',
                  on ? 'border-[var(--button-primary-bg)] bg-surface-sunken' : 'border-line hover:bg-surface-sunken',
                )}
              >
                <Switch
                  id={`availability-${c.key}`}
                  name={c.key}
                  checked={on}
                  onChange={(e) => setValue((cur) => ({ ...cur, [c.key]: e.target.checked }))}
                  label={
                    <span className="flex items-center gap-2">
                      <span className="text-muted" aria-hidden="true">
                        {ICON[c.key]}
                      </span>
                      {c.label}
                    </span>
                  }
                  hint={c.line}
                />
              </div>
            );
          })}

          <Disclosure summary="What each one means in practice" className="bg-surface">
            <dl className="space-y-3">
              {entries.map((c) => (
                <div key={c.key} className="space-y-0.5">
                  <dt className="font-medium text-primary">{c.label}</dt>
                  <dd>{c.detail}</dd>
                </div>
              ))}
            </dl>
          </Disclosure>
        </CardBody>

        <CardFooter className="flex-wrap rounded-b-lg">
          <p className="mr-auto text-sm text-secondary">
            {dirty
              ? 'Not saved yet.'
              : onCount === 0
                ? 'You are not offered to students at the moment.'
                : `${onCount} of ${entries.length} switched on.`}
          </p>
          <Button type="submit" loading={saving} disabled={!dirty} className="min-h-11">
            Save what I am open to
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
