import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { requireSession } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getTicketForViewer } from '@/lib/data/helpdesk';
import { TICKET_KIND_LABELS, TICKET_STATE_LABELS, ticketCategoryLabel } from '@/lib/community';
import { Badge, Breadcrumbs, PageHeader } from '@/components/ui';
import { TicketThread } from '@/components/community/TicketThread';

export const metadata: Metadata = { title: 'Your question' };

const STATE_TONE = { open: 'warning', answered: 'success', closed: 'neutral' } as const;

/**
 * One of the member's own questions, with its answers.
 *
 * A ticket that is not the viewer's, one that does not exist and one in a
 * different college all answer 404: whether somebody else has a ticket is
 * not something an error should reveal.
 */
export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  requireSession(session);

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.helpdesk) notFound();

  const { id } = await params;
  const ticket = getTicketForViewer(session, id);
  if (!ticket || ticket.memberId !== session.memberId) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: 'Help', href: '/help' }, { label: ticket.reference }]} />}
        eyebrow={ticket.reference}
        title={ticket.subject}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={STATE_TONE[ticket.state]}>{TICKET_STATE_LABELS[ticket.state]}</Badge>
            <Badge tone="outline">{TICKET_KIND_LABELS[ticket.kind]}</Badge>
            <span className="text-sm text-secondary">{ticketCategoryLabel(ticket.category)}</span>
          </span>
        }
      />
      <TicketThread
        reference={ticket.reference}
        initial={ticket.messages}
        state={ticket.state}
        audience="member"
        locale={pack.locale.locale}
        timeZone={pack.locale.timeZone}
        officeName={pack.copy.officeName}
      />
    </div>
  );
}
