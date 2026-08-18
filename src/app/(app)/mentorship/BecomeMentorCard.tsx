'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, Megaphone, MessageSquare } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
  Switch,
  useToast,
} from '@/components/ui';

/**
 * The three commitments, stated in full before the switch is flipped.
 *
 * "Open to mentoring" is a checkbox on most alumni portals and it means
 * nothing to the person ticking it, which is why the ones who tick it stop
 * replying by March. Each switch here says what actually lands in your
 * inbox, how often, and what you are never being asked to do — because the
 * only version of this that survives a placement season is the one the
 * graduate understood when they agreed to it.
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

const COMMITMENTS: Array<{
  key: keyof Availability;
  label: string;
  icon: React.ReactNode;
  commits: string;
  doesNot: string;
}> = [
  {
    key: 'mentoring',
    label: 'Answer questions from final-years',
    icon: <MessageSquare className="size-4" />,
    commits:
      'Your name appears under the topics your record already matches, and students may send you a written request. Each of them is rationed to five open requests at a time, so in practice this is a handful of messages a year outside placement season.',
    doesNot:
      'It does not publish your email or mobile, and it does not commit you to a call, a deadline or a reply at all.',
  },
  {
    key: 'referrals',
    label: 'Refer someone into your company',
    icon: <Briefcase className="size-4" />,
    commits:
      'Students and junior alumni can ask you to put a name forward where you work. You see the request, their branch and batch, and whatever they wrote, before you decide anything.',
    doesNot:
      'It does not share your employer with anyone who could not already see it on your profile, and refusing costs you nothing — most referral requests are declined and none of them are recorded against you.',
  },
  {
    key: 'speaking',
    label: 'Come back and speak',
    icon: <Megaphone className="size-4" />,
    commits:
      'The alumni cell and the heads of department can invite you to a session — Industry Connect, a workshop, a placement-prep talk. Invitations come from staff, never from students directly.',
    doesNot:
      'It does not add you to a roster or an obligation for the annual meet. Dates are always proposed to you, not assigned.',
  },
];

export function BecomeMentorCard({
  mentoring,
  referrals,
  speaking,
}: {
  mentoring: boolean;
  referrals: boolean;
  speaking: boolean;
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

  const dirty =
    value.mentoring !== initial.mentoring ||
    value.referrals !== initial.referrals ||
    value.speaking !== initial.speaking;

  const onCount = Number(value.mentoring) + Number(value.referrals) + Number(value.speaking);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openToMentoring: value.mentoring,
          openToReferrals: value.referrals,
          openToSpeaking: value.speaking,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `The server refused the change (${res.status}).`);
      }

      toast.success(
        onCount === 0 ? 'You are no longer being offered to students' : 'Availability updated',
        onCount === 0
          ? 'Your profile stays in the directory. Nothing else changed.'
          : 'It takes effect on the next search. You can turn any of it off again at any time.',
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
    <Card as="section">
      <CardHeader>
        <div className="min-w-0 space-y-1.5">
          <CardTitle as="h2">What you are open to</CardTitle>
          <CardDescription>
            Three separate commitments, and each one says exactly what it puts in your inbox.
            Turning one on never releases your email or mobile — that stays with your privacy
            setting, and it is a different decision.
          </CardDescription>
        </div>
      </CardHeader>

      <form onSubmit={save}>
        <CardBody className="space-y-4">
          {error ? (
            <Alert tone="danger" title="Your availability was not changed">
              {error}
            </Alert>
          ) : null}

          {COMMITMENTS.map((c) => {
            const on = value[c.key];
            return (
              <div
                key={c.key}
                className={
                  on
                    ? 'rounded-lg border border-[var(--button-primary-bg)] bg-surface-sunken p-3.5 transition-colors duration-fast ease-brand'
                    : 'rounded-lg border border-line p-3.5 transition-colors duration-fast ease-brand hover:bg-surface-sunken'
                }
              >
                <Switch
                  id={`availability-${c.key}`}
                  name={c.key}
                  checked={on}
                  onChange={(e) => setValue((cur) => ({ ...cur, [c.key]: e.target.checked }))}
                  label={
                    <span className="flex items-center gap-2">
                      <span className="text-muted" aria-hidden="true">
                        {c.icon}
                      </span>
                      {c.label}
                    </span>
                  }
                />

                <div className="mt-2.5 space-y-1.5 border-t border-line pt-2.5 text-xs leading-relaxed">
                  <p className="text-secondary">
                    <span className="font-semibold text-primary">Turning this on means: </span>
                    {c.commits}
                  </p>
                  <p className="text-muted">{c.doesNot}</p>
                </div>
              </div>
            );
          })}
        </CardBody>

        <CardFooter>
          <p className="mr-auto text-xs text-muted">
            {dirty
              ? 'Not saved yet.'
              : onCount === 0
                ? 'You are not currently offered to students.'
                : `${onCount} of 3 switched on.`}
          </p>
          <Button type="submit" loading={saving} disabled={!dirty}>
            Save what I am open to
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
