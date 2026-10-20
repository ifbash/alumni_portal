import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BookOpen, CircleCheck, Download, PencilLine, Trash2, TriangleAlert } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getDataRequests } from '@/lib/data/repo';
import { getTenantBrand } from '@/lib/tenant';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Alert,
  Badge,
  ButtonLink,
  Disclosure,
  EmptyState,
  PageHeader,
  Table,
  TableWrap,
  Tabs,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';

import { ClockBar } from './ClockBar';
import { KIND_LABEL, RESPONSE_WINDOW_DAYS, STATE_LABEL, STATE_TONE, dueStatus, type DueStatus } from './dpdp';

export const metadata = { title: 'Data requests · Staff console' };

type View = 'open' | 'overdue' | 'closed' | 'all';

const VIEWS: View[] = ['open', 'overdue', 'closed', 'all'];

const VIEW_LABEL: Record<View, string> = {
  open: 'Open',
  overdue: 'Overdue',
  closed: 'Answered',
  all: 'Everything',
};

const KIND_ICON = {
  export: Download,
  correction: PencilLine,
  deletion: Trash2,
} as const;

const viewHref = (v: View) => (v === 'open' ? '/admin/data-requests' : `/admin/data-requests?view=${v}`);

function Countdown({ due, className }: { due: DueStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-semibold',
        due.tone === 'danger' && 'text-danger-fg',
        due.tone === 'warning' && 'text-warning-fg',
        due.tone === 'neutral' && 'text-secondary',
        className,
      )}
    >
      {due.overdue ? <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" /> : null}
      {due.label}
    </span>
  );
}

export default async function DataRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  requireCap(session, 'data_request.manage');

  const params = await searchParams;
  const raw = Array.isArray(params.view) ? params.view[0] : params.view;
  const view: View = VIEWS.includes(raw as View) ? (raw as View) : 'open';

  const all = getDataRequests();
  const withDue = all.map((request) => ({ request, due: dueStatus(request) }));

  const pack = (await getTenantBrand())?.brand.pack;
  const fmt = { locale: pack?.locale.locale, timeZone: pack?.locale.timeZone };

  const counts: Record<View, number> = {
    open: withDue.filter((r) => r.due.open).length,
    overdue: withDue.filter((r) => r.due.overdue).length,
    closed: withDue.filter((r) => !r.due.open).length,
    all: withDue.length,
  };

  const rows = withDue.filter(({ due }) => {
    if (view === 'open') return due.open;
    if (view === 'overdue') return due.overdue;
    if (view === 'closed') return !due.open;
    return true;
  });

  const overdue = withDue.filter((r) => r.due.overdue);
  const dueThisWeek = withDue.filter((r) => r.due.open && !r.due.overdue && r.due.days <= 7);
  const upcoming = withDue.filter((r) => r.due.open && !r.due.overdue);
  // The queue is sorted by deadline, so the first open request still inside
  // its window is the next deadline.
  const next = upcoming[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Data requests"
        description={`Members' access, correction and erasure requests, each answered within ${RESPONSE_WINDOW_DAYS} days of receipt.`}
      />

      {/* ---- Summary: what is open, what is late, what is next ------ */}
      <p className="text-sm text-secondary">
        {counts.open ? (
          <Link href={viewHref('open')} className="underline-offset-4 hover:text-brand-fg hover:underline">
            <span className="font-semibold tabular text-primary">{counts.open}</span> open
          </Link>
        ) : (
          <span>Nothing open</span>
        )}
        {counts.overdue ? (
          <>
            <span aria-hidden="true"> · </span>
            <Link href={viewHref('overdue')} className="underline-offset-4 hover:text-brand-fg hover:underline">
              <span className="font-semibold tabular text-danger-fg">{counts.overdue}</span> overdue
            </Link>
          </>
        ) : null}
        <span aria-hidden="true"> · </span>
        {dueThisWeek.length === 0 && counts.overdue === 0 ? (
          <span className="font-medium text-success-fg">Nothing due this week</span>
        ) : next ? (
          <span>
            next deadline{' '}
            <span className="font-semibold tabular text-primary">{formatDate(next.request.dueAt, fmt)}</span>
          </span>
        ) : (
          <span>no other deadline pending</span>
        )}
      </p>

      {overdue.length ? (
        <Alert
          tone="danger"
          title={`${overdue.length} ${overdue.length === 1 ? 'request is' : 'requests are'} past the deadline`}
          icon={<TriangleAlert className="size-4" />}
        >
          <p>
            {overdue.map(({ request, due }) => `${request.memberName} (${due.label.toLowerCase()})`).join(', ')}. Answer
            these first and record why each slipped.
          </p>
        </Alert>
      ) : null}

      <Tabs
        ariaLabel="Request queue"
        items={VIEWS.map((v) => ({
          label: VIEW_LABEL[v],
          href: viewHref(v),
          count: counts[v],
          active: v === view,
        }))}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<CircleCheck className="size-5" />}
          title={
            view === 'overdue'
              ? 'Nothing has run past its deadline'
              : view === 'open'
                ? 'No requests are waiting on you'
                : 'Nothing in this view'
          }
          description={
            view === 'overdue'
              ? `Every open request is still inside its ${RESPONSE_WINDOW_DAYS}-day window.`
              : view === 'open'
                ? 'Every request raised has been answered; the answered ones stay on the record.'
                : 'Members raise these from their privacy settings. None of this kind has arrived yet.'
          }
          action={
            view !== 'all' ? (
              <ButtonLink variant="secondary" href={viewHref('all')}>
                See every request
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <>
          <TableWrap className="hidden sm:block" caption="Data requests, soonest deadline first">
            <Table>
              <THead>
                <TR>
                  <TH>Deadline</TH>
                  <TH>Member</TH>
                  <TH>Request</TH>
                  <TH>Received</TH>
                  <TH>State</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map(({ request, due }) => {
                  const Icon = KIND_ICON[request.kind];
                  return (
                    <TR key={request.id} interactive>
                      <TD className={cn('whitespace-nowrap', due.overdue && 'border-l-4 border-l-danger')}>
                        <Countdown due={due} />
                        <ClockBar due={due} className="my-1.5 w-32" />
                        <span className="block text-xs tabular text-secondary">{formatDate(request.dueAt, fmt)}</span>
                      </TD>
                      <TD>
                        <Link
                          href={`/admin/data-requests/${request.id}`}
                          className="font-medium hover:text-brand-fg hover:underline"
                        >
                          {request.memberName}
                        </Link>
                      </TD>
                      <TD className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <Icon
                            className={cn(
                              'size-4 shrink-0',
                              request.kind === 'deletion' ? 'text-danger-fg' : 'text-secondary',
                            )}
                            aria-hidden="true"
                          />
                          {KIND_LABEL[request.kind]}
                        </span>
                      </TD>
                      <TD className="whitespace-nowrap tabular text-secondary">
                        {formatDate(request.createdAt, fmt)}
                      </TD>
                      <TD className="whitespace-nowrap">
                        <Badge tone={STATE_TONE[request.state]} dot>
                          {STATE_LABEL[request.state]}
                        </Badge>
                        {request.state === 'fulfilled' && request.fulfilledAt ? (
                          <span className="ml-2 text-xs text-secondary">{formatDate(request.fulfilledAt, fmt)}</span>
                        ) : null}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>

          <ul className="space-y-3 sm:hidden">
            {rows.map(({ request, due }) => {
              const Icon = KIND_ICON[request.kind];
              return (
                <li key={request.id}>
                  <Link
                    href={`/admin/data-requests/${request.id}`}
                    className={cn(
                      'block space-y-1.5 rounded-lg border border-line bg-surface-raised p-4 transition-colors duration-fast ease-brand hover:border-line-strong',
                      due.overdue && 'border-l-4 border-l-danger',
                    )}
                  >
                    <span className="flex items-center justify-between gap-3 text-sm">
                      <Countdown due={due} />
                      <Badge tone={STATE_TONE[request.state]} dot className="shrink-0">
                        {STATE_LABEL[request.state]}
                      </Badge>
                    </span>
                    <ClockBar due={due} />
                    <span className="block font-semibold">{request.memberName}</span>
                    <span className="flex items-center gap-1.5 text-sm text-secondary">
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      {KIND_LABEL[request.kind]} · received {formatDate(request.createdAt, fmt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Disclosure
        id="playbook"
        summary={
          <span className="flex items-center gap-2">
            <BookOpen className="size-4 shrink-0 text-brand-fg" aria-hidden="true" />
            Playbook: what each kind of request needs
          </span>
        }
      >
        <dl className="grid gap-5 md:grid-cols-3">
          <div className="space-y-1.5">
            <dt className="flex items-center gap-2 font-semibold text-primary">
              <Download className="size-4 text-brand-fg" aria-hidden="true" />
              Access copy
            </dt>
            <dd>
              Everything held about the member — profile, contact details, consent history, requests, registrations,
              applications and donation records — packaged for the member, never shown on screen here.
            </dd>
          </div>
          <div className="space-y-1.5">
            <dt className="flex items-center gap-2 font-semibold text-primary">
              <PencilLine className="size-4 text-brand-fg" aria-hidden="true" />
              Correction
            </dt>
            <dd>
              Names, contact details, work and city are corrected in place, with the old value kept in the audit log.
              Roll number, branch and year of passing come from the degree register: send those to the examinations
              branch.
            </dd>
          </div>
          <div className="space-y-1.5">
            <dt className="flex items-center gap-2 font-semibold text-primary">
              <Trash2 className="size-4 text-danger-fg" aria-hidden="true" />
              Erasure
            </dt>
            <dd>
              The personal record is deleted for good. Donation records and tax receipts are kept for their statutory
              period; the request itself says so above the button.
            </dd>
          </div>
        </dl>
      </Disclosure>
    </div>
  );
}
