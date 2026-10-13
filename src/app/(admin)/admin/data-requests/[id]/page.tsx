import { notFound, redirect } from 'next/navigation';
import { ScrollText, TriangleAlert, UserRound } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getDataRequests } from '@/lib/data/repo';
import { getTenantBrand } from '@/lib/tenant';
import { formatDate, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  DetailRow,
  Disclosure,
  HowThisWorks,
  PageHeader,
} from '@/components/ui';

import {
  KIND_LABEL,
  KIND_SUMMARY,
  RESPONSE_WINDOW_DAYS,
  STATE_LABEL,
  STATE_TONE,
  dueStatus,
} from '../dpdp';
import { RequestActions } from '../RequestActions';

export const metadata = { title: 'Data request · Staff console' };

// ---------------------------------------------------------------
// What the request actually touches
// ---------------------------------------------------------------

/**
 * `change` is work this request does (erased, included, corrected);
 * `keep` is what it leaves; `careful` is a change with a condition.
 */
type Verdict = 'change' | 'keep' | 'careful';

interface ScopeRow {
  area: string;
  table: string;
  /** The badge while the request is open: what will happen. */
  pending: string;
  /** The badge once it is fulfilled: what happened. */
  done: string;
  note: string;
  verdict: Verdict;
}

/**
 * Status colour follows the request, not the plan. An open request shows
 * what will happen in outline and neutral; only a fulfilled one earns the
 * success tone, so nobody reads a green "Erased" on a request nobody has
 * started.
 */
function verdictTone(verdict: Verdict, fulfilled: boolean): 'success' | 'neutral' | 'outline' {
  if (verdict === 'keep') return 'neutral';
  return fulfilled ? 'success' : 'outline';
}

const EXPORT_SCOPE: ScopeRow[] = [
  { area: 'Identity', table: 'members', pending: 'To include', done: 'Included', verdict: 'change', note: 'Name, roll number, branch, batch and status history.' },
  { area: 'Contact details', table: 'member_contacts', pending: 'To include', done: 'Included', verdict: 'change', note: 'Email, mobile, links and who may see them.' },
  { area: 'Consent history', table: 'consent_records', pending: 'To include', done: 'Included', verdict: 'change', note: 'Every consent, with the privacy notice version in force.' },
  { area: 'Requests', table: 'connections', pending: 'To include', done: 'Included', verdict: 'change', note: 'Who was asked, when, and how it was answered.' },
  { area: 'Message bodies', table: 'messages', pending: 'In the copy only', done: 'In the copy only', verdict: 'careful', note: 'Packaged for the member. No role reads them in this console.' },
  { area: 'Events and jobs', table: 'event_registrations, job_applications', pending: 'To include', done: 'Included', verdict: 'change', note: 'Registrations, postings made and applications sent.' },
  { area: 'Donations', table: 'donations', pending: 'To include', done: 'Included', verdict: 'change', note: 'Amounts, dates and receipt numbers.' },
  { area: 'Audit entries about them', table: 'audit_log', pending: 'Staff names removed', done: 'Staff names removed', verdict: 'careful', note: 'What was done to their record, not who did it.' },
  { area: 'Degree register row', table: 'degree_register', pending: 'To include', done: 'Included', verdict: 'change', note: 'The register row their registration was matched against.' },
];

const DELETION_SCOPE: ScopeRow[] = [
  { area: 'Identity', table: 'members', pending: 'Will be erased', done: 'Erased', verdict: 'change', note: 'Deleted outright, not hidden.' },
  { area: 'Contact details', table: 'member_contacts', pending: 'Will be erased', done: 'Erased', verdict: 'change', note: 'Including anything a bulk import added.' },
  { area: 'Photo and profile media', table: 'object storage (S3, stored in India)', pending: 'Will be erased', done: 'Erased', verdict: 'change', note: 'Stored files, not only the links to them.' },
  { area: 'Messages and requests', table: 'messages, connections', pending: 'Will be erased', done: 'Erased', verdict: 'change', note: 'Both sides of every thread they were part of.' },
  { area: 'Event registrations', table: 'event_registrations', pending: 'Totals kept', done: 'Erased, totals kept', verdict: 'careful', note: 'The person goes; reported attendance totals stay as numbers.' },
  { area: 'Job postings they made', table: 'job_postings', pending: 'Will be de-linked', done: 'De-linked', verdict: 'careful', note: 'Postings others applied to stay, credited to a former member.' },
  { area: 'Donation records and tax receipts', table: 'donations', pending: 'Kept', done: 'Kept', verdict: 'keep', note: 'Kept for their statutory period.' },
  { area: 'Audit trail', table: 'audit_log', pending: 'Kept, reduced', done: 'Kept, reduced', verdict: 'keep', note: 'Actor, action and time, with personal details removed.' },
  { area: 'Degree register row', table: 'degree_register', pending: 'Kept', done: 'Kept', verdict: 'keep', note: 'The college’s record of a degree conferred.' },
];

const CORRECTION_SCOPE: ScopeRow[] = [
  { area: 'Name and preferred name', table: 'members', pending: 'Correct here', done: 'Corrected', verdict: 'change', note: 'The old value stays in the audit log.' },
  { area: 'Contact details', table: 'member_contacts', pending: 'Correct here', done: 'Corrected', verdict: 'change', note: 'Members can change these themselves; ask why they could not.' },
  { area: 'Employment and city', table: 'member_employment', pending: 'Correct here', done: 'Corrected', verdict: 'change', note: 'Company, designation, dates and location.' },
  { area: 'Visibility settings', table: 'member_contacts.visibility', pending: 'Narrow only', done: 'Corrected', verdict: 'careful', note: 'Never widen who may see their details on their behalf.' },
  { area: 'Roll number, branch, year of passing', table: 'degree_register', pending: 'Not here', done: 'Not here', verdict: 'keep', note: 'These come from the examinations branch; send it there.' },
  { area: 'Verification status', table: 'members.status', pending: 'Not here', done: 'Not here', verdict: 'keep', note: 'Re-run verification instead of setting it by hand.' },
  { area: 'Donation records and tax receipts', table: 'donations', pending: 'Reissued', done: 'Reissued', verdict: 'careful', note: 'A corrected receipt is a new receipt; the original stays.' },
  { area: 'CGPA and placement status', table: 'members', pending: 'Not here', done: 'Not here', verdict: 'keep', note: 'Placement-side only. This console cannot read them.' },
];

const SCOPE: Record<'export' | 'deletion' | 'correction', ScopeRow[]> = {
  export: EXPORT_SCOPE,
  deletion: DELETION_SCOPE,
  correction: CORRECTION_SCOPE,
};

const SCOPE_HEADING: Record<'export' | 'deletion' | 'correction', string> = {
  export: 'What goes into the package',
  deletion: 'What is erased, and what is not',
  correction: 'What can be corrected here',
};

// ---------------------------------------------------------------
// Page
// ---------------------------------------------------------------

export default async function DataRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  requireCap(session, 'data_request.manage');

  const { id } = await params;
  const request = getDataRequests().find((r) => r.id === id);
  if (!request) notFound();

  const due = dueStatus(request);
  const scope = SCOPE[request.kind];
  const isErasure = request.kind === 'deletion';
  const fulfilled = request.state === 'fulfilled';

  const pack = (await getTenantBrand())?.brand.pack;
  const fmt = { locale: pack?.locale.locale, timeZone: pack?.locale.timeZone };

  const dueTone =
    due.tone === 'danger' ? 'text-danger-fg' : due.tone === 'warning' ? 'text-warning-fg' : 'text-secondary';

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Staff console', href: '/admin' },
              { label: 'Data requests', href: '/admin/data-requests' },
              { label: request.memberName },
            ]}
          />
        }
        eyebrow="Data requests"
        title={request.memberName}
        description={`${KIND_SUMMARY[request.kind]} Received ${formatDate(request.createdAt, fmt)}.`}
        meta={
          <>
            <Badge tone="neutral">{KIND_LABEL[request.kind]}</Badge>
            <Badge tone={STATE_TONE[request.state]} dot>
              {STATE_LABEL[request.state]}
            </Badge>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* The rail holds the action, so on phones it comes first. */}
        <aside aria-label="Act on this request" className="min-w-0 space-y-6 lg:order-last">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Act on it</CardTitle>
              <span className={cn('flex shrink-0 items-center gap-1 text-sm font-semibold', dueTone)}>
                {due.overdue ? <TriangleAlert className="size-4 shrink-0" aria-hidden="true" /> : null}
                {due.label}
              </span>
            </CardHeader>
            <CardBody className="space-y-4">
              {due.open ? (
                <p className="text-sm text-secondary">
                  {due.detail} Deadline{' '}
                  <span className="font-medium text-primary">{formatDate(request.dueAt, fmt)}</span>.
                </p>
              ) : null}
              {isErasure && due.open ? (
                <p className="text-sm font-medium text-danger-fg">
                  Read what an erasure keeps before you confirm. There is no undo.
                </p>
              ) : null}
              <RequestActions
                id={request.id}
                memberName={request.memberName}
                kind={request.kind}
                state={request.state}
                dueLabel={due.label}
                overdue={due.overdue}
                sticky
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <dl className="divide-y divide-line">
                <DetailRow label="Received">
                  <span className="tabular">{formatDate(request.createdAt, fmt)}</span>
                  <span className="block text-xs font-normal text-secondary">
                    {formatRelative(request.createdAt, fmt)}
                  </span>
                </DetailRow>
                <DetailRow label="Deadline">
                  <span className="tabular">{formatDate(request.dueAt, fmt)}</span>
                  <span className="block text-xs font-normal text-secondary">
                    {RESPONSE_WINDOW_DAYS} days from receipt
                  </span>
                </DetailRow>
                {request.state === 'fulfilled' ? (
                  <DetailRow label="Answered">
                    {request.fulfilledAt ? (
                      <span className="tabular">{formatDate(request.fulfilledAt, fmt)}</span>
                    ) : (
                      <span className="text-warning-fg">Marked fulfilled with no date recorded</span>
                    )}
                  </DetailRow>
                ) : null}
              </dl>
            </CardBody>
            <CardFooter className="flex-col items-stretch gap-1">
              <ButtonLink
                variant="ghost"
                size="sm"
                className="min-h-11 justify-start lg:min-h-9"
                href={`/admin/members?q=${encodeURIComponent(request.memberName)}`}
              >
                <UserRound className="size-3.5" aria-hidden="true" />
                Open the member record
              </ButtonLink>
              <ButtonLink
                variant="ghost"
                size="sm"
                className="min-h-11 justify-start lg:min-h-9"
                href={`/admin/audit?q=${encodeURIComponent(request.memberName)}`}
              >
                <ScrollText className="size-3.5" aria-hidden="true" />
                Audit entries naming them
              </ButtonLink>
            </CardFooter>
          </Card>
        </aside>

        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <CardHeader variant="stack">
              <CardTitle as="h2">{SCOPE_HEADING[request.kind]}</CardTitle>
              <CardDescription>Every place this member exists in the portal, in the order to work through.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
              <ol className="divide-y divide-line">
                {scope.map((row, i) => (
                  <li key={row.area} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    <span
                      className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-sunken text-xs font-semibold tabular text-secondary"
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <p className="font-medium">{row.area}</p>
                        <Badge tone={verdictTone(row.verdict, fulfilled)} className="whitespace-nowrap">
                          {fulfilled ? row.done : row.pending}
                        </Badge>
                      </div>
                      <p className="text-sm text-secondary">{row.note}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <Disclosure summary="Technical details">
                <p className="mb-3">Where each area is stored, for whoever carries out the request.</p>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
                  {scope.map((row) => (
                    <div key={row.area} className="contents">
                      <dt className="text-primary">{row.area}</dt>
                      <dd className="font-mono text-xs">{row.table}</dd>
                    </div>
                  ))}
                </dl>
              </Disclosure>
            </CardBody>
          </Card>

          <HowThisWorks summary={isErasure ? 'What an erasure keeps' : 'Before you answer'}>
            {isErasure ? (
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  Donation records and tax receipts stay for their statutory period. Neither the member nor this
                  console can waive that.
                </li>
                <li>The audit trail stays, with personal details removed, so the erasure can be shown to have happened.</li>
                <li>The degree register row is the college&rsquo;s record, not the member&rsquo;s.</li>
                <li>Everything else is deleted. Backups age out on their own schedule.</li>
              </ul>
            ) : (
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  The member raised this from their signed-in account, so their identity is settled. Send requests
                  that arrive by email or WhatsApp back through the portal.
                </li>
                <li>Your answer must not disclose another member&rsquo;s personal data.</li>
                <li>No one reads private message contents in this console.</li>
              </ul>
            )}
          </HowThisWorks>
        </div>
      </div>

      {/* Room for the phone action bar RequestActions pins below `lg`. */}
      {due.open ? <div aria-hidden="true" className="h-20 lg:hidden" data-print-hide="" /> : null}
    </div>
  );
}
