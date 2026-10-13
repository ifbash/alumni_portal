'use client';

import * as React from 'react';
import { Disclosure, Switch, useToast } from '@/components/ui';
import type { AvailabilityKey } from '@/lib/availability-copy';

/**
 * The three switches that decide whether the directory is worth anything.
 *
 * They live on the home screen as a quick action because they are the one
 * setting an alumnus changes with the seasons. Burying them three clicks
 * into a profile editor means they are set once and never revisited, and
 * a stale yes is worse than an honest no.
 *
 * The words come from `availabilityCopy()`, the same source as the profile
 * form and the directory chips, so the promise made by switching one on
 * reads the same everywhere. One line under each switch; the longer
 * explanation sits in a single disclosure below them.
 *
 * Rendered inside the home's "Give back" card, so it draws no card of its
 * own.
 */

type Key = 'openToMentoring' | 'openToReferrals' | 'openToSpeaking';

/** One row, worded on the server by `availabilityCopy()`. */
export interface AvailabilityEntry {
  key: AvailabilityKey;
  label: string;
  line: string;
  detail: string;
}

const FIELD: Record<AvailabilityKey, Key> = {
  mentoring: 'openToMentoring',
  referrals: 'openToReferrals',
  speaking: 'openToSpeaking',
};

export function AvailabilityCard({
  initial,
  company,
  entries,
  officeName,
}: {
  initial: Record<Key, boolean>;
  company: string | null;
  entries: AvailabilityEntry[];
  /** The pack's office, mid-sentence ("alumni cell"), for the speaking toast. */
  officeName: string;
}) {
  const toast = useToast();
  const [state, setState] = React.useState(initial);
  const [pending, setPending] = React.useState<Key | null>(null);
  const ON_TOAST = onToast(officeName);

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
    <div className="space-y-4">
      <ul className="space-y-4">
        {entries.map((e) => {
          const field = FIELD[e.key];
          // A referral needs an employer to point at. Without one the switch
          // is off and says what turns it on.
          const needsCompany = e.key === 'referrals' && !company;
          return (
            <li key={e.key}>
              <Switch
                id={`quick-${e.key}`}
                label={e.label}
                hint={needsCompany ? 'Add where you work to your profile to turn this on.' : e.line}
                checked={state[field]}
                disabled={pending !== null || needsCompany}
                onChange={(ev) => toggle(field, ev.currentTarget.checked)}
              />
            </li>
          );
        })}
      </ul>

      <Disclosure summary="What this means" className="bg-surface">
        <dl className="space-y-3">
          {entries.map((e) => (
            <div key={e.key} className="space-y-0.5">
              <dt className="font-medium text-primary">{e.label}</dt>
              <dd>{e.detail}</dd>
            </div>
          ))}
        </dl>
      </Disclosure>
    </div>
  );
}

const LABEL: Record<Key, string> = {
  openToMentoring: 'Mentoring',
  openToReferrals: 'Referrals',
  openToSpeaking: 'Speaking',
};

function onToast(officeName: string): Record<Key, string> {
  return {
    openToMentoring: 'Final-year students can now ask you for advice.',
    openToReferrals: 'Students can ask you for a referral at your current employer.',
    openToSpeaking: `The ${officeName} can invite you to speak to students.`,
  };
}
