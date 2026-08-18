import { redirect } from 'next/navigation';
import {
  ArrowRight,
  CircleCheck,
  Download,
  FileClock,
  Hourglass,
  Landmark,
  PencilLine,
  Trash2,
  TriangleAlert,
} from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getDataRequests } from '@/lib/data/repo';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  DefinitionCard,
  EmptyState,
  PageHeader,
  Section,
  Stat,
  Table,
  TableWrap,
  Tabs,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';

import {
  KIND_LABEL,
  RESPONSE_WINDOW_DAYS,
  STATE_LABEL,
  STATE_TONE,
  dueStatus,
} from './dpdp';

export const metadata = { title: 'Data requests' };

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
  const deletions = withDue.filter((r) => r.request.kind === 'deletion' && r.due.open);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Data requests"
        description={`Access, correction and erasure requests raised by members under the DPDP Act. Every one carries a ${RESPONSE_WINDOW_DAYS}-day statutory window measured from the day it was received — not from the day somebody picked it up.`}
        actions={
          <Badge tone={overdue.length ? 'danger' : 'success'} dot>
            {overdue.length
              ? `${overdue.length} past the deadline`
              : 'Nothing past the deadline'}
          </Badge>
        }
      />

      {overdue.length ? (
        <Alert
          tone="danger"
          title={`${overdue.length} request${overdue.length === 1 ? ' is' : 's are'} past the statutory deadline`}
          icon={<TriangleAlert className="size-4" />}
        >
          <p>
            {overdue
              .map(({ request, due }) => `${request.memberName} (${due.label.toLowerCase()})`)
              .join(', ')}
            . A missed window is reportable to the Data Protection Board whether or not the member
            complains. Answer these before anything else in the queue, and record why each slipped.
          </p>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Open now"
          value={counts.open}
          icon={<FileClock className="size-4" />}
          hint="received or in progress"
        />
        <Stat
          label="Overdue"
          value={counts.overdue}
          icon={<TriangleAlert className="size-4" />}
          hint={counts.overdue ? 'already reportable' : 'inside the window'}
        />
        <Stat
          label="Due within a week"
          value={dueThisWeek.length}
          icon={<Hourglass className="size-4" />}
          hint="start anything needing finance or exams now"
        />
        <Stat
          label="Erasures open"
          value={deletions.length}
          icon={<Trash2 className="size-4" />}
          hint="irreversible — read the retention exceptions"
        />
      </div>

      <Tabs
        ariaLabel="Request queue"
        items={VIEWS.map((v) => ({
          label: VIEW_LABEL[v],
          href: v === 'open' ? '/admin/data-requests' : `/admin/data-requests?view=${v}`,
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
              ? `All ${counts.open} open request${counts.open === 1 ? '' : 's'} are still inside the ${RESPONSE_WINDOW_DAYS}-day window. This is the state to keep it in — the clock does not pause for term breaks.`
              : view === 'open'
                ? `Every request raised has been answered. ${counts.closed} closed request${counts.closed === 1 ? '' : 's'} remain in the record; DPDP responses are auditable long after they are sent.`
                : 'Members raise these from Settings → Privacy in the member portal. None has arrived in this category yet.'
          }
          action={
            view !== 'all' ? (
              <ButtonLink variant="secondary" href="/admin/data-requests?view=all">
                See every request
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <>
          <TableWrap className="hidden sm:block" caption="Data requests, soonest deadline first">
            <Table className="min-w-[54rem]">
              <THead>
                <TR>
                  <TH>Member</TH>
                  <TH>Request</TH>
                  <TH>Received</TH>
                  <TH>Deadline</TH>
                  <TH>State</TH>
                  <TH>
                    <span className="sr-only">Open request</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {rows.map(({ request, due }) => {
                  const Icon = KIND_ICON[request.kind];
                  return (
                    <TR
                      key={request.id}
                      className={cn(
                        due.overdue
                          ? 'bg-danger-soft'
                          : 'transition-colors duration-fast ease-brand hover:bg-surface-sunken',
                      )}
                    >
                      <TD className="align-top">
                        <p className="font-medium">{request.memberName}</p>
                        <p className="font-mono text-xs text-muted">{request.id}</p>
                      </TD>

                      <TD className="align-top">
                        <p className="flex items-center gap-1.5 font-medium">
                          <Icon
                            className={cn(
                              'size-3.5 shrink-0',
                              request.kind === 'deletion' ? 'text-danger-fg' : 'text-muted',
                            )}
                            aria-hidden="true"
                          />
                          {KIND_LABEL[request.kind]}
                        </p>
                        <p className="font-mono text-xs text-muted">{request.kind}</p>
                      </TD>

                      <TD className="whitespace-nowrap align-top tabular">
                        {formatDate(request.createdAt)}
                      </TD>

                      <TD className="align-top">
                        <p className="tabular">{formatDate(request.dueAt)}</p>
                        <p
                          className={cn(
                            'mt-1 inline-flex items-center gap-1 text-xs font-semibold',
                            due.tone === 'danger' && 'text-danger-fg',
                            due.tone === 'warning' && 'text-warning-fg',
                            due.tone === 'neutral' && 'text-muted',
                          )}
                        >
                          {due.overdue ? (
                            <TriangleAlert className="size-3 shrink-0" aria-hidden="true" />
                          ) : null}
                          {due.label}
                        </p>
                      </TD>

                      <TD className="align-top">
                        <Badge tone={STATE_TONE[request.state]} dot>
                          {STATE_LABEL[request.state]}
                        </Badge>
                        {request.state === 'fulfilled' && request.fulfilledAt ? (
                          <p className="mt-1 text-xs text-muted">
                            {formatDate(request.fulfilledAt)}
                          </p>
                        ) : null}
                      </TD>

                      <TD className="align-top">
                        <ButtonLink
                          variant="ghost"
                          size="sm"
                          href={`/admin/data-requests/${request.id}`}
                          aria-label={`Open the ${KIND_LABEL[request.kind].toLowerCase()} request from ${request.memberName}`}
                        >
                          Open
                          <ArrowRight className="size-3.5" aria-hidden="true" />
                        </ButtonLink>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>

          <ul className="space-y-3 sm:hidden">
            {rows.map(({ request, due }) => (
              <li key={request.id}>
                <DefinitionCard
                  className={due.overdue ? 'bg-danger-soft' : undefined}
                  title={request.memberName}
                  subtitle={
                    <span>
                      {KIND_LABEL[request.kind]} · <span className="font-mono">{request.id}</span>
                    </span>
                  }
                  rows={[
                    { label: 'Received', value: formatDate(request.createdAt) },
                    {
                      label: 'Deadline',
                      value: (
                        <span
                          className={cn(
                            'font-semibold',
                            due.tone === 'danger' && 'text-danger-fg',
                            due.tone === 'warning' && 'text-warning-fg',
                          )}
                        >
                          {due.label}
                        </span>
                      ),
                    },
                    {
                      label: 'State',
                      value: (
                        <Badge tone={STATE_TONE[request.state]} dot>
                          {STATE_LABEL[request.state]}
                        </Badge>
                      ),
                    },
                  ]}
                  actions={
                    <ButtonLink
                      variant="secondary"
                      size="sm"
                      href={`/admin/data-requests/${request.id}`}
                    >
                      Open request
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </ButtonLink>
                  }
                />
              </li>
            ))}
          </ul>
        </>
      )}

      <Section
        title="What each kind obliges the college to do"
        description="The rules, on the screen where the work happens. A policy document nobody opens is not a control."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h3" className="flex items-center gap-2">
                  <Download className="size-4 text-brand-fg" aria-hidden="true" />
                  Access copy
                </CardTitle>
                <CardDescription>Everything held, in a form they can take elsewhere.</CardDescription>
              </div>
            </CardHeader>
            <CardBody className="space-y-3 text-sm text-secondary">
              <p>
                Profile, contact details, consent history with the notice version they agreed to,
                connection requests, event registrations, job applications and donation receipts.
              </p>
              <p>
                The package is built by a background job and delivered to the member’s verified
                email. It is never rendered in this console: an export that an operator can read on
                screen is a bulk contact export with extra steps.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h3" className="flex items-center gap-2">
                  <PencilLine className="size-4 text-brand-fg" aria-hidden="true" />
                  Correction
                </CardTitle>
                <CardDescription>Fix the field, keep the history.</CardDescription>
              </div>
            </CardHeader>
            <CardBody className="space-y-3 text-sm text-secondary">
              <p>
                Name spelling, contact details, employment, city and visibility settings are
                corrected in place, with the previous value kept in the audit log.
              </p>
              <p>
                Roll number, branch and year of passing are not corrected here. They come from the
                degree register, and a portal that lets those be edited on request is a portal whose
                verification means nothing. Route those to the examinations branch.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h3" className="flex items-center gap-2">
                  <Trash2 className="size-4 text-danger-fg" aria-hidden="true" />
                  Erasure
                </CardTitle>
                <CardDescription>Irreversible, and not unconditional.</CardDescription>
              </div>
            </CardHeader>
            <CardBody className="space-y-3 text-sm text-secondary">
              <p>
                A hard delete of the personal record — not a hidden flag. Personal fields, contact
                rows, photo and message history go, and they do not come back.
              </p>
              <p className="flex gap-2 rounded border border-[color-mix(in_srgb,var(--danger)_40%,var(--border))] bg-danger-soft p-3 text-danger-fg">
                <Landmark className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  Financial records are the exception and cannot be erased. Donations, 80G receipts
                  and anything reportable under FCRA are kept for the statutory retention period.
                  The exception is stated in full on the request itself, above the button.
                </span>
              </p>
            </CardBody>
          </Card>
        </div>
      </Section>
    </div>
  );
}
