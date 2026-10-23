'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';

import { Avatar, Badge, Button, useToast } from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';

/**
 * The join requests a lead has to answer.
 *
 * Each row decides on its own and shows its own outcome, so deciding one
 * does not redraw the list under your thumb. A decline is quiet, with no
 * text box: the leads of a group are volunteers, and a form letter to a
 * stranger is a chore nobody signed up for.
 */

export interface RequestRow {
  memberId: string;
  name: string;
  photoUrl: string | null;
  line: string;
}

export function GroupRequests({ slug, rows }: { slug: string; rows: RequestRow[] }) {
  const toast = useToast();
  const router = useRouter();
  const [decided, setDecided] = React.useState<Record<string, { action: 'approve' | 'decline'; persisted: boolean }>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const decide = async (memberId: string, name: string, action: 'approve' | 'decline') => {
    setBusy(memberId);
    setErrors((e) => ({ ...e, [memberId]: '' }));
    const outcome = await api.patch(`/api/groups/${slug}/requests`, { memberId, action });
    setBusy(null);

    const t = outcomeToast(outcome, action === 'approve' ? `${name} is in` : 'Request declined');
    if (t) toast.show(t);

    if (outcome.status === 'ok') {
      setDecided((d) => ({ ...d, [memberId]: { action, persisted: outcome.persisted } }));
      if (outcome.persisted) router.refresh();
      return;
    }
    setErrors((e) => ({ ...e, [memberId]: outcome.message }));
  };

  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-surface-raised">
      {rows.map((r) => {
        const done = decided[r.memberId];
        return (
          <li key={r.memberId} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Avatar name={r.name} src={r.photoUrl ?? undefined} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.name}</p>
              {r.line ? <p className="truncate text-sm text-secondary">{r.line}</p> : null}
              {errors[r.memberId] ? <p role="alert" className="text-sm font-medium text-danger-fg">{errors[r.memberId]}</p> : null}
            </div>
            {done ? (
              <Badge tone={!done.persisted ? 'neutral' : done.action === 'approve' ? 'success' : 'neutral'} dot={done.persisted}>
                {!done.persisted ? 'Not saved' : done.action === 'approve' ? 'Approved' : 'Declined'}
              </Badge>
            ) : (
              <span className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => void decide(r.memberId, r.name, 'decline')} disabled={busy !== null} className="min-h-11 sm:min-h-0">
                  <X className="size-4" aria-hidden="true" />
                  Decline
                  <span className="sr-only"> {r.name}</span>
                </Button>
                <Button size="sm" onClick={() => void decide(r.memberId, r.name, 'approve')} loading={busy === r.memberId} disabled={busy !== null && busy !== r.memberId} className="min-h-11 sm:min-h-0">
                  <Check className="size-4" aria-hidden="true" />
                  Approve
                  <span className="sr-only"> {r.name}</span>
                </Button>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
