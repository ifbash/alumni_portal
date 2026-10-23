import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { LifeBuoy } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getTicketQueue } from '@/lib/data/helpdesk';
import { TICKET_KIND_LABELS, TICKET_STATE_LABELS, ticketCategoryLabel } from '@/lib/community';
import { formatRelative } from '@/lib/format';
import { Badge, EmptyState, PageHeader, SummaryLine, Table, TableWrap, TBody, TD, TH, THead, TR, Tabs } from '@/components/ui';
import type { TicketState } from '@/lib/data/types';

/**
 * The help desk, for the people who answer it.
 *
 * Oldest open ticket first, because a member who asked a fortnight ago is
 * the one most likely to have given up. Feedback arrives in the same queue
 * as questions, marked as such, so there is one inbox.
 *
 * A ticket is a member describing their own account, so this console is for
 * `helpdesk.manage` only, and the vendor is turned away at the route policy
 * as well as here.
 */

export const metadata = { title: 'Help desk · Staff console' };

const STATE_TONE = { open: 'warning', answered: 'success', closed: 'neutral' } as const;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminHelpdeskPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.helpdesk) notFound();

  requireCap(session, 'helpdesk.manage');

  const params = await searchParams;
  const raw = one(params.state);
  const state: TicketState = raw === 'answered' || raw === 'closed' ? raw : 'open';

  const open = getTicketQueue(session, { state: 'open' });
  const answered = getTicketQueue(session, { state: 'answered' });
  const closed = getTicketQueue(session, { state: 'closed' });
  const rows = state === 'open' ? open : state === 'answered' ? answered : closed;
  const timing = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Governance" title="Help desk" description="Questions and feedback from members." />

      {open.length > 0 ? (
        <SummaryLine
          items={[
            { value: open.length, label: open.length === 1 ? 'waiting for an answer' : 'waiting for an answer', tone: 'attention' },
            { value: `Oldest ${formatRelative(open[0]!.createdAt, timing)}`, label: '' },
          ]}
        />
      ) : null}

      <Tabs
        ariaLabel="Tickets"
        items={[
          { label: 'Open', href: '/admin/helpdesk', count: open.length, active: state === 'open' },
          { label: 'Answered', href: '/admin/helpdesk?state=answered', count: answered.length, active: state === 'answered' },
          { label: 'Closed', href: '/admin/helpdesk?state=closed', count: closed.length, active: state === 'closed' },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<LifeBuoy className="size-5" />}
          title={state === 'open' ? 'Nobody is waiting on you' : state === 'answered' ? 'Nothing is awaiting a reply from the member' : 'Nothing is closed yet'}
          description={state === 'open' ? 'A question or a piece of feedback appears here the moment a member sends one.' : undefined}
        />
      ) : (
        <TableWrap caption={`${TICKET_STATE_LABELS[state]} tickets`}>
          <Table>
            <THead>
              <TR>
                <TH>Reference</TH>
                <TH>Subject</TH>
                <TH>From</TH>
                <TH>Type</TH>
                <TH>{state === 'open' ? 'Waiting' : 'Updated'}</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((t) => (
                <TR key={t.id}>
                  <TD className="whitespace-nowrap font-mono text-xs">
                    <Link href={`/admin/helpdesk/${t.reference}`} className="link">
                      {t.reference}
                    </Link>
                  </TD>
                  <TD className="min-w-48">
                    <Link href={`/admin/helpdesk/${t.reference}`} className="link-quiet font-medium">
                      {t.subject}
                    </Link>
                    <p className="text-xs text-secondary">{ticketCategoryLabel(t.category)}</p>
                  </TD>
                  <TD className="text-sm">{t.memberName}</TD>
                  <TD>
                    <Badge tone={t.kind === 'help' ? 'brand' : t.kind === 'bug' ? 'warning' : 'outline'}>{TICKET_KIND_LABELS[t.kind]}</Badge>
                  </TD>
                  <TD className="whitespace-nowrap text-sm text-secondary">
                    <Badge tone={STATE_TONE[t.state]} dot>
                      {formatRelative(state === 'open' ? t.createdAt : t.updatedAt, timing)}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </div>
  );
}
