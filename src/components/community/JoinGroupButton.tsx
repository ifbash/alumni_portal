'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, LogOut, UserPlus } from 'lucide-react';

import { Button, ConfirmDialog, useToast } from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';
import type { GroupJoinPolicy, GroupMembershipState, GroupMemberRole } from '@/lib/data/types';

/**
 * Join, request, withdraw or leave: one control that says what it will do.
 *
 * The state it shows is what the server last said, held locally so the
 * button changes the moment the answer arrives instead of after a page
 * refresh. A refusal (a chapter, for a student; the last lead trying to
 * walk away) is shown as the sentence the server wrote.
 */

export function JoinGroupButton({
  slug,
  name,
  joinPolicy,
  state,
  role,
  blockedReason,
  size = 'md',
}: {
  slug: string;
  name: string;
  joinPolicy: GroupJoinPolicy;
  state: GroupMembershipState | null;
  role: GroupMemberRole | null;
  /** When set, joining is not possible, and this says why. */
  blockedReason?: string | null;
  size?: 'sm' | 'md';
}) {
  const toast = useToast();
  const router = useRouter();

  const [current, setCurrent] = React.useState<GroupMembershipState | null>(state);
  const [pending, setPending] = React.useState(false);
  const [confirmLeave, setConfirmLeave] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const call = async (action: 'join' | 'leave') => {
    setPending(true);
    setError(null);
    const outcome = await api.post<{ membership: { state: GroupMembershipState | null } }>(
      `/api/groups/${slug}/membership`,
      { action },
    );
    setPending(false);
    setConfirmLeave(false);

    const t = outcomeToast(outcome, action === 'join' ? (joinPolicy === 'approval' ? 'Request sent' : `You joined ${name}`) : `You left ${name}`);
    if (t) toast.show(t);

    if (outcome.status === 'ok') {
      setCurrent(outcome.data.membership.state);
      if (outcome.persisted) router.refresh();
      return;
    }
    setError(outcome.message);
  };

  if (current === 'active') {
    return (
      <>
        <Button
          type="button"
          variant="secondary"
          size={size === 'sm' ? 'sm' : 'md'}
          onClick={() => setConfirmLeave(true)}
          loading={pending}
          className="min-h-11 sm:min-h-0"
        >
          <Check className="size-4" aria-hidden="true" />
          {role === 'lead' ? 'You lead this group' : 'Joined'}
        </Button>
        <ConfirmDialog
          open={confirmLeave}
          onClose={() => setConfirmLeave(false)}
          onConfirm={() => void call('leave')}
          pending={pending}
          tone="danger"
          confirmLabel="Leave group"
          title={`Leave ${name}?`}
          body={<p>You will stop seeing its noticeboard. You can join again whenever you like{joinPolicy === 'approval' ? ', though a lead has to approve it again' : ''}.</p>}
        />
        {error ? <p role="alert" className="pt-1 text-sm font-medium text-danger-fg">{error}</p> : null}
      </>
    );
  }

  if (current === 'requested') {
    return (
      <>
        <Button
          type="button"
          variant="secondary"
          size={size === 'sm' ? 'sm' : 'md'}
          onClick={() => void call('leave')}
          loading={pending}
          className="min-h-11 sm:min-h-0"
        >
          Requested. Withdraw
        </Button>
        {error ? <p role="alert" className="pt-1 text-sm font-medium text-danger-fg">{error}</p> : null}
      </>
    );
  }

  if (blockedReason) {
    return <p className="max-w-xs text-sm text-secondary">{blockedReason}</p>;
  }

  return (
    <>
      <Button type="button" size={size === 'sm' ? 'sm' : 'md'} onClick={() => void call('join')} loading={pending} className="min-h-11 sm:min-h-0">
        {current === null ? <UserPlus className="size-4" aria-hidden="true" /> : <LogOut className="size-4" aria-hidden="true" />}
        {joinPolicy === 'approval' ? 'Ask to join' : 'Join'}
      </Button>
      {error ? <p role="alert" className="pt-1 text-sm font-medium text-danger-fg">{error}</p> : null}
    </>
  );
}
