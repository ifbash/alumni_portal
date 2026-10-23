import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getTicketForViewer } from '@/lib/data/helpdesk';
import { TICKET_KIND_LABELS, TICKET_STATE_LABELS, ticketCategoryLabel } from '@/lib/community';
import { Badge, Breadcrumbs, PageHeader } from '@/components/ui';
import { TicketThread } from '@/components/community/TicketThread';

export const metadata = { title: 'Ticket · Staff console' };

const STATE_TONE = { open: 'warning', answered: 'success', closed: 'neutral' } as const;

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.helpdesk) notFound();

  requireCap(session, 'helpdesk.manage');

  const { id } = await params;
  const ticket = getTicketForViewer(session, id);
  if (!ticket) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Staff console', href: '/admin' },
              { label: 'Help desk', href: '/admin/helpdesk' },
              { label: ticket.reference },
            ]}
          />
        }
        eyebrow={ticket.reference}
        title={ticket.subject}
        meta={
          <span className="flex flex-wrap items-center gap-2 text-sm text-secondary">
            <Badge tone={STATE_TONE[ticket.state]}>{TICKET_STATE_LABELS[ticket.state]}</Badge>
            <Badge tone="outline">{TICKET_KIND_LABELS[ticket.kind]}</Badge>
            <span>{ticketCategoryLabel(ticket.category)}</span>
            <span>
              From <span className="font-medium text-primary">{ticket.memberName}</span>
            </span>
            {ticket.pagePath ? (
              <span>
                on <span className="font-mono text-xs">{ticket.pagePath}</span>
              </span>
            ) : null}
          </span>
        }
      />
      <TicketThread
        reference={ticket.reference}
        initial={ticket.messages}
        state={ticket.state}
        audience="staff"
        locale={pack.locale.locale}
        timeZone={pack.locale.timeZone}
        officeName={pack.copy.officeName}
      />
      <p className="text-sm text-secondary">
        What you write is read by this member only. It is not copied into the audit log.{' '}
        <Link href="/admin/helpdesk" className="link">
          Back to the queue
        </Link>
      </p>
    </div>
  );
}
