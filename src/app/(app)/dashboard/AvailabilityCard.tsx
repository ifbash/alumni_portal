'use client';

import * as React from 'react';
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
  useToast,
} from '@/components/ui';

/**
 * The three switches that decide whether the directory is worth anything.
 *
 * They live on the home screen as a quick action because they are the one
 * setting an alumnus changes with the seasons — mentoring on in December
 * when placements start, off in March when work gets heavy. Burying them
 * three clicks into a profile editor means they are set once and never
 * revisited, and a stale yes is worse than an honest no.
 *
 * The copy states the commitment plainly. Someone who turns mentoring on
 * without knowing what it lets a student do is someone who turns it off
 * permanently the first time they are asked.
 */

type Key = 'openToMentoring' | 'openToReferrals' | 'openToSpeaking';

export function AvailabilityCard({
  initial,
  company,
}: {
  initial: Record<Key, boolean>;
  company: string | null;
}) {
  const toast = useToast();
  const [state, setState] = React.useState(initial);
  const [pending, setPending] = React.useState<Key | null>(null);

  async function toggle(key: Key, next: boolean) {
    const previous = state;
    setState({ ...state, [key]: next });
    setPending(key);

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `The server refused the change (${res.status}).`);
      }

      toast.success(
        next ? `${LABEL[key]} is on` : `${LABEL[key]} is off`,
        next ? ON_TOAST[key] : 'Existing requests are unaffected — you can still answer them.',
      );
    } catch (err) {
      // Put the switch back. A control that shows the new state after a
      // failed save is a control that lies about what the college holds.
      setState(previous);
      toast.error(
        'That did not save',
        err instanceof Error ? err.message : 'Check your connection and try again.',
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="space-y-1">
          <CardTitle as="h2">What you are open to</CardTitle>
          <CardDescription>Change these whenever. Students see the result immediately.</CardDescription>
        </div>
      </CardHeader>

      <CardBody className="space-y-4">
        <Switch
          id="quick-mentoring"
          label="Open to mentoring"
          hint="Students may send you a mentorship request with a message. You are never obliged to accept, and declining is not shown to them as a rejection."
          checked={state.openToMentoring}
          disabled={pending !== null}
          onChange={(e) => toggle('openToMentoring', e.currentTarget.checked)}
        />

        <Switch
          id="quick-referrals"
          label="Open to referral requests"
          hint={
            company
              ? `Students may ask you to refer them at ${company}. Asking is capped — five open requests each, across the whole portal.`
              : 'Add your current employer to your profile first — a referral request needs a company to point at.'
          }
          checked={state.openToReferrals}
          disabled={pending !== null || !company}
          onChange={(e) => toggle('openToReferrals', e.currentTarget.checked)}
        />

        <Switch
          id="quick-speaking"
          label="Open to speaking on campus"
          hint="The alumni cell may invite you to a session — usually two hours on a Saturday, in person or over video. An invitation, not a booking."
          checked={state.openToSpeaking}
          disabled={pending !== null}
          onChange={(e) => toggle('openToSpeaking', e.currentTarget.checked)}
        />
      </CardBody>
    </Card>
  );
}

const LABEL: Record<Key, string> = {
  openToMentoring: 'Mentoring',
  openToReferrals: 'Referrals',
  openToSpeaking: 'Speaking',
};

const ON_TOAST: Record<Key, string> = {
  openToMentoring: 'You now appear in the mentors list for every branch.',
  openToReferrals: 'Students can ask you for a referral at your current employer.',
  openToSpeaking: 'The alumni cell can invite you to campus sessions.',
};
