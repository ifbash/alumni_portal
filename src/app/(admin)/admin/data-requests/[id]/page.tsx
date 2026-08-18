import { notFound, redirect } from 'next/navigation';
import {
  BadgeCheck,
  Fingerprint,
  Landmark,
  Lock,
  ScrollText,
  TriangleAlert,
  UserRound,
} from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getDataRequests } from '@/lib/data/repo';
import { formatDate, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Alert,
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
  PageHeader,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
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

export const metadata = { title: 'Data request' };

// ---------------------------------------------------------------
// What the request actually touches
// ---------------------------------------------------------------

type Verdict = 'go' | 'keep' | 'careful';

interface ScopeRow {
  area: string;
  table: string;
  outcome: string;
  note: string;
  verdict: Verdict;
}

const VERDICT_TONE: Record<Verdict, 'success' | 'danger' | 'warning'> = {
  go: 'success',
  keep: 'danger',
  careful: 'warning',
};

const EXPORT_SCOPE: ScopeRow[] = [
  { area: 'Identity', table: 'members', outcome: 'Included', verdict: 'go', note: 'Name, roll number, branch, batch, status and every status transition since registration.' },
  { area: 'Contact details', table: 'member_contacts', outcome: 'Included', verdict: 'go', note: 'Email, mobile, links, and the visibility setting that governs who else may see them.' },
  { area: 'Consent history', table: 'consent_records', outcome: 'Included', verdict: 'go', note: 'Append-only, with the version of the privacy notice in force at each point.' },
  { area: 'Connections', table: 'connections', outcome: 'Included', verdict: 'go', note: 'Who was asked, when, and how it was answered.' },
  { area: 'Message bodies', table: 'messages', outcome: 'In the package, not on this screen', verdict: 'careful', note: 'Packaged for the member and delivered to them. No role reads message bodies in this console — there is no capability for it.' },
  { area: 'Events and jobs', table: 'event_registrations, job_applications', outcome: 'Included', verdict: 'go', note: 'Registrations, guests, amounts paid, postings made and applications sent.' },
  { area: 'Donations', table: 'donations', outcome: 'Included', verdict: 'go', note: 'Amounts, dates, gateway references and 80G receipt numbers.' },
  { area: 'Audit entries about them', table: 'audit_log', outcome: 'Included, staff names redacted', verdict: 'careful', note: 'They are entitled to know what was done to their record. They are not entitled to the identity of the operator who did it.' },
  { area: 'Degree register row', table: 'degree_register', outcome: 'Included', verdict: 'go', note: 'The examinations-branch row their registration was matched against, and the confidence it matched at.' },
];

const DELETION_SCOPE: ScopeRow[] = [
  { area: 'Identity', table: 'members', outcome: 'Erased', verdict: 'go', note: 'Row deleted, not flagged. A soft delete that leaves the name in the directory is not an erasure.' },
  { area: 'Contact details', table: 'member_contacts', outcome: 'Erased', verdict: 'go', note: 'Deleted with the member row by foreign key, including anything a bulk import added.' },
  { area: 'Photo and profile media', table: 'S3 ap-south-1', outcome: 'Erased', verdict: 'go', note: 'Objects deleted and the CDN path invalidated. Object storage is the part most often forgotten.' },
  { area: 'Messages and connections', table: 'messages, connections', outcome: 'Erased', verdict: 'go', note: 'Both sides of every thread they were part of. The other member keeps no copy.' },
  { area: 'Event registrations', table: 'event_registrations', outcome: 'Erased, headcounts kept', verdict: 'careful', note: 'The person is removed. Attendance totals already reported for NAAC stay as aggregate numbers with nobody attached.' },
  { area: 'Job postings they made', table: 'job_postings', outcome: 'De-linked', verdict: 'careful', note: 'Live postings other members applied to are re-attributed to a former member rather than pulled, and the contact route closes.' },
  { area: 'Donations and 80G receipts', table: 'donations', outcome: 'Retained — statutory', verdict: 'keep', note: 'Income-tax receipting and FCRA reporting. Erasing these is not ours to agree to and would put the trust’s registration at risk.' },
  { area: 'Audit trail', table: 'audit_log', outcome: 'Retained, reduced', verdict: 'keep', note: 'Actor, action and timestamp survive with the personal fields stripped from the snapshots. An erasure that erases its own record cannot be shown to have happened.' },
  { area: 'Degree register row', table: 'degree_register', outcome: 'Retained', verdict: 'keep', note: 'The college’s record of a degree conferred, loaded from the examinations branch. It is not portal data and it is not the member’s to erase.' },
];

const CORRECTION_SCOPE: ScopeRow[] = [
  { area: 'Name and preferred name', table: 'members', outcome: 'Correct in place', verdict: 'go', note: 'Spelling, initials and the name they want shown. The old value stays in the audit log.' },
  { area: 'Contact details', table: 'member_contacts', outcome: 'Correct in place', verdict: 'go', note: 'The member can already do this themselves — check why they could not before you edit anything.' },
  { area: 'Employment and city', table: 'member_employment', outcome: 'Correct in place', verdict: 'go', note: 'Company, designation, dates and location.' },
  { area: 'Visibility settings', table: 'member_contacts.visibility', outcome: 'Correct in place', verdict: 'go', note: 'Who may see their contact details. Never widen this on their behalf — only narrow it.' },
  { area: 'Roll number, branch, year of passing', table: 'degree_register', outcome: 'Not correctable here', verdict: 'keep', note: 'These come from the degree register. A portal that edits them on request is a portal whose verification proves nothing. Route it to the examinations branch and re-run the match.' },
  { area: 'Verification status', table: 'members.status', outcome: 'Not correctable here', verdict: 'keep', note: 'Re-run verification against the register instead of setting the status by hand.' },
  { area: '80G receipts', table: 'donations', outcome: 'Reissued, never edited', verdict: 'careful', note: 'A receipt with a corrected figure is a new receipt with a new number, and the original stays.' },
  { area: 'CGPA and placement status', table: 'members', outcome: 'Not visible here', verdict: 'keep', note: 'Placement-side only. This console cannot read those fields, so it cannot correct them.' },
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

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Governance' },
              { label: 'Data requests', href: '/admin/data-requests' },
              { label: request.id },
            ]}
          />
        }
        eyebrow={`${KIND_LABEL[request.kind]} request`}
        title={request.memberName}
        description={`${KIND_SUMMARY[request.kind]} Received ${formatDate(request.createdAt)} — ${formatRelative(request.createdAt)}.`}
        actions={
          <Badge tone={STATE_TONE[request.state]} dot>
            {STATE_LABEL[request.state]}
          </Badge>
        }
      />

      <Alert
        tone={due.overdue ? 'danger' : due.tone === 'warning' ? 'warning' : due.open ? 'info' : 'neutral'}
        title={due.label}
        icon={due.overdue ? <TriangleAlert className="size-4" /> : <ScrollText className="size-4" />}
      >
        <p>
          {due.detail}
          {due.open ? ` Deadline ${formatDate(request.dueAt)}.` : null}
        </p>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">{SCOPE_HEADING[request.kind]}</CardTitle>
                <CardDescription>
                  The {scope.length} places this member exists in the system. Work down the list — a
                  request answered from memory is a request that misses object storage.
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <TableWrap
                className="hidden sm:block"
                caption={`${SCOPE_HEADING[request.kind]} for ${request.memberName}`}
              >
                <Table className="min-w-[44rem]">
                  <THead>
                    <TR>
                      <TH>Area</TH>
                      <TH>Outcome</TH>
                      <TH>Why</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {scope.map((row) => (
                      <TR key={row.area} className={row.verdict === 'keep' ? 'bg-surface-sunken' : undefined}>
                        <TD className="align-top">
                          <p className="font-medium">{row.area}</p>
                          <p className="font-mono text-xs text-muted">{row.table}</p>
                        </TD>
                        <TD className="align-top">
                          <Badge tone={VERDICT_TONE[row.verdict]}>{row.outcome}</Badge>
                        </TD>
                        <TD className="align-top text-secondary">{row.note}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>

              <ul className="space-y-3 sm:hidden">
                {scope.map((row) => (
                  <li
                    key={row.area}
                    className={cn(
                      'space-y-2 rounded border border-line p-3',
                      row.verdict === 'keep' && 'bg-surface-sunken',
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{row.area}</p>
                      <Badge tone={VERDICT_TONE[row.verdict]}>{row.outcome}</Badge>
                    </div>
                    <p className="font-mono text-xs text-muted">{row.table}</p>
                    <p className="text-sm text-secondary">{row.note}</p>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          {isErasure ? (
            <Card>
              <CardHeader>
                <div className="min-w-0 space-y-1">
                  <CardTitle as="h2" className="flex items-center gap-2">
                    <Landmark className="size-4 text-danger-fg" aria-hidden="true" />
                    Retention exceptions you cannot waive
                  </CardTitle>
                  <CardDescription>
                    An erasure is not unconditional, and the member is told so in the same reply.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="space-y-2 rounded-lg border border-[color-mix(in_srgb,var(--danger)_40%,var(--border))] bg-danger-soft p-4 text-sm text-danger-fg">
                  <p className="font-semibold">Financial records stay.</p>
                  <p>
                    Donations, 80G receipts and anything carrying{' '}
                    <span className="font-mono">is_foreign_contribution</span> are kept for their
                    statutory retention period under the Income-tax Act and, where the contribution
                    is foreign, the FCRA. The college is the one who has to produce them at audit;
                    a member cannot consent them away and neither can this console.
                  </p>
                </div>

                <div className="space-y-2 rounded-lg border border-line bg-surface-sunken p-4 text-sm text-secondary">
                  <p className="font-semibold text-primary">The audit trail stays, in reduced form.</p>
                  <p>
                    Actor, action and timestamp survive; the personal fields inside the before and
                    after snapshots are stripped. An erasure that also erased the record of itself
                    could never be shown to have happened — which is the one thing a regulator asks
                    for.
                  </p>
                </div>

                <div className="space-y-2 rounded-lg border border-line bg-surface-sunken p-4 text-sm text-secondary">
                  <p className="font-semibold text-primary">This is a hard delete.</p>
                  <p>
                    Everything not listed above is removed from Postgres and from object storage in{' '}
                    <span className="font-mono">ap-south-1</span>. Backups age out on their own
                    schedule; the erasure is not complete until the last backup containing the row
                    expires, and the member is told that window rather than a comfortable
                    “immediately”.
                  </p>
                </div>
              </CardBody>
            </Card>
          ) : null}

          {request.kind === 'export' ? (
            <Card>
              <CardHeader>
                <div className="min-w-0 space-y-1">
                  <CardTitle as="h2" className="flex items-center gap-2">
                    <Lock className="size-4 text-brand-fg" aria-hidden="true" />
                    How the copy is delivered
                  </CardTitle>
                  <CardDescription>The delivery path is part of the control.</CardDescription>
                </div>
              </CardHeader>
              <CardBody className="max-w-prose space-y-3 text-sm text-secondary">
                <p>
                  The package is assembled by a background job and sent to{' '}
                  {request.memberName}’s verified email as a time-limited link. It is never rendered
                  in this console and never downloadable from it: an access copy an operator can
                  open on screen is a bulk contact export wearing a different name, and bulk export
                  is <span className="font-mono">college_admin</span> only, with a reason.
                </p>
                <p>
                  Message bodies are inside the package. They are not readable here, by you or by
                  anyone — there is no capability in the matrix that reads a private message, and
                  fulfilling an access request is not a reason to add one.
                </p>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Request</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="divide-y divide-line">
                <DetailRow label="Member">{request.memberName}</DetailRow>
                <DetailRow label="Kind">
                  {KIND_LABEL[request.kind]}
                  <span className="block font-mono text-xs font-normal text-muted">
                    {request.kind}
                  </span>
                </DetailRow>
                <DetailRow label="Received">
                  <span className="tabular">{formatDate(request.createdAt)}</span>
                </DetailRow>
                <DetailRow label="Deadline">
                  <span className="tabular">{formatDate(request.dueAt)}</span>
                  <span
                    className={cn(
                      'block text-xs font-semibold',
                      due.tone === 'danger' && 'text-danger-fg',
                      due.tone === 'warning' && 'text-warning-fg',
                      due.tone === 'neutral' && 'text-muted',
                    )}
                  >
                    {due.label}
                  </span>
                </DetailRow>
                <DetailRow label="Window">
                  <span className="tabular">{RESPONSE_WINDOW_DAYS} days</span>
                  <span className="block text-xs font-normal text-muted">from receipt, not from pickup</span>
                </DetailRow>
                {request.state === 'fulfilled' ? (
                  <DetailRow label="Answered">
                    {request.fulfilledAt ? (
                      <span className="tabular">{formatDate(request.fulfilledAt)}</span>
                    ) : (
                      <span className="text-warning-fg">
                        Marked fulfilled with no date recorded
                      </span>
                    )}
                  </DetailRow>
                ) : null}
                <DetailRow label="Request id">
                  <span className="font-mono text-xs">{request.id}</span>
                </DetailRow>
              </dl>
            </CardBody>
            <CardFooter className="flex-col items-stretch gap-2">
              <ButtonLink
                variant="secondary"
                size="sm"
                href={`/admin/members?q=${encodeURIComponent(request.memberName)}`}
              >
                <UserRound className="size-3.5" aria-hidden="true" />
                Open the member record
              </ButtonLink>
              <ButtonLink
                variant="ghost"
                size="sm"
                href={`/admin/audit?q=${encodeURIComponent(request.memberName)}`}
              >
                <ScrollText className="size-3.5" aria-hidden="true" />
                Audit entries naming them
              </ButtonLink>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">Act on it</CardTitle>
                <CardDescription>
                  {isErasure
                    ? 'Read the retention exceptions before you confirm. There is no undo.'
                    : 'The clock stops when this is answered, not when it is picked up.'}
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <RequestActions
                id={request.id}
                memberName={request.memberName}
                kind={request.kind}
                state={request.state}
                dueLabel={due.label}
                overdue={due.overdue}
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Fingerprint className="size-4 text-brand-fg" aria-hidden="true" />
                Check this first
              </p>
              <ul className="space-y-2.5 text-sm text-secondary">
                <li className="flex gap-2">
                  <BadgeCheck className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                  <span>
                    The request was raised from inside the member’s signed-in session, so identity
                    is established by the session itself. A request that arrives by email or over
                    WhatsApp is not — send those back through the portal rather than answering them.
                  </span>
                </li>
                <li className="flex gap-2">
                  <UserRound className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                  <span>
                    Answering must not disclose another member’s personal data. Connection threads
                    have two people in them; the other person’s contact details are not part of this
                    request.
                  </span>
                </li>
                <li className="flex gap-2">
                  <ScrollText className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                  <span>
                    Whatever you do writes to <span className="font-mono">audit_log</span> with your
                    name and this request id, before the member is notified.
                  </span>
                </li>
              </ul>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
