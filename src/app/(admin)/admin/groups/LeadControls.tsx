'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Badge, Button, useToast } from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';

/**
 * Appoint or relieve a lead, one member at a time. A student has no button:
 * the endpoint refuses it too, and a control that always fails is not a control.
 */
export function LeadControls({
  slug,
  memberId,
  name,
  isLead,
  canLead,
}: {
  slug: string;
  memberId: string;
  name: string;
  isLead: boolean;
  canLead: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [lead, setLead] = React.useState(isLead);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const change = async (role: 'lead' | 'member') => {
    setBusy(true);
    setError(null);
    const outcome = await api.patch(`/api/admin/groups/${slug}/leads`, { memberId, role });
    setBusy(false);
    const t = outcomeToast(outcome, role === 'lead' ? `${name} appointed` : `${name} relieved`);
    if (t) toast.show(t);
    if (outcome.status === 'ok') {
      setLead(role === 'lead');
      if (outcome.persisted) router.refresh();
      return;
    }
    setError(outcome.message);
  };

  return (
    <span className="flex flex-wrap items-center justify-end gap-2">
      {lead ? <Badge tone="brand">Lead</Badge> : null}
      {canLead ? (
        <Button
          type="button"
          size="sm"
          variant={lead ? 'ghost' : 'secondary'}
          loading={busy}
          onClick={() => void change(lead ? 'member' : 'lead')}
          className="min-h-11 sm:min-h-0"
        >
          {lead ? 'Relieve' : 'Make lead'}
          <span className="sr-only"> {name}</span>
        </Button>
      ) : null}
      {error ? <span role="alert" className="basis-full text-right text-xs font-medium text-danger-fg">{error}</span> : null}
    </span>
  );
}
