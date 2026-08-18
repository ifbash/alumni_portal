import { redirect } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  CircleSlash,
  FileSearch,
  Inbox,
  Scale,
  Search,
  ShieldCheck,
} from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  DefinitionCard,
  Disclosure,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Progress,
  Section,
  Select,
  Stat,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Tabs,
} from '@/components/ui';
import { getSession } from '@/lib/auth/session';
import { require as requireCap, can } from '@/lib/auth/guard';
import { getDepartments, getVerificationClaims } from '@/lib/data/repo';
import type { VerificationClaim } from '@/lib/data/types';
import { AUTO_APPROVE_AT, REVIEW_AT, nameTokens } from '@/lib/verification/matcher';
import { formatDate, formatRelative, memberLine } from '@/lib/format';

export const metadata = { title: 'Verification queue' };

type StatusKey = 'queued' | 'approved' | 'rejected' | 'all';

const STATUS_TABS: Array<{ key: StatusKey; label: string }> = [
  { key: 'queued', label: 'Waiting' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'Everything' },
];

/**
 * The queue's whole reason to exist: an approver must never be asked to
 * decide against no evidence. Every row therefore carries what the
 * matcher found, how sure it was, and whether two register rows are
 * fighting over the same claim — before anyone opens anything.
 */
interface Signal {
  top: VerificationClaim['candidates'][number] | null;
  runnerUp: VerificationClaim['candidates'][number] | null;
  /** Two candidates close enough that the score cannot separate them. */
  ambiguous: boolean;
  /** Two register rows with the same name in the same branch and year. */
  homonym: boolean;
}

function identityKey(name: string, dept: string | null, year: number | null): string {
  return `${nameTokens(name).slice().sort().join(' ')}|${dept ?? '?'}|${year ?? '?'}`;
}

function signalsFor(claim: VerificationClaim): Signal {
  const ranked = [...claim.candidates].sort((a, b) => b.confidence - a.confidence);
  const top = ranked[0] ?? null;
  const runnerUp = ranked[1] ?? null;

  const keys = ranked.map((c) => identityKey(c.record.name, c.record.departmentCode, c.record.yearOfPassing));
  const homonym = keys.length > 1 && new Set(keys).size < keys.length;

  return {
    top,
    runnerUp,
    ambiguous: Boolean(top && runnerUp && top.confidence - runnerUp.confidence < 0.15),
    homonym,
  };
}

function toneFor(confidence: number): 'success' | 'warning' | 'danger' {
  if (confidence >= AUTO_APPROVE_AT) return 'success';
  if (confidence >= REVIEW_AT) return 'warning';
  return 'danger';
}

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="w-36 space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-secondary">Best match</span>
        <span className="text-sm font-semibold tabular">{pct}%</span>
      </div>
      <Progress value={pct} tone={toneFor(value)} label={`Match confidence ${pct} per cent`} />
    </div>
  );
}

function EvidenceCell({ claim, signal }: { claim: VerificationClaim; signal: Signal }) {
  if (!signal.top) {
    return (
      <div className="space-y-1.5">
        <Badge tone="danger" dot>
          No register row
        </Badge>
        <p className="text-xs text-secondary">Nothing to approve against.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <ConfidenceMeter value={signal.top.confidence} />
      <p className="text-xs text-secondary">
        {claim.candidates.length === 1
          ? 'One candidate row'
          : `${claim.candidates.length} candidate rows`}
        {signal.homonym ? ' · same name, same branch, same year' : signal.ambiguous ? ' · scores too close to separate' : ''}
      </p>
    </div>
  );
}

function StatusBadge({ claim }: { claim: VerificationClaim }) {
  if (claim.status === 'approved') return <Badge tone="success">Approved</Badge>;
  if (claim.status === 'rejected') return <Badge tone="danger">Rejected</Badge>;
  if (claim.decision === 'auto_approve') return <Badge tone="info">Auto-approve suggested</Badge>;
  if (claim.decision === 'reject') return <Badge tone="warning">Reject suggested</Badge>;
  return <Badge tone="neutral">Needs a human</Badge>;
}

export default async function VerificationQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  // An alumni cell operator and a college admin hold the wider grant
  // (`verification.review.any`); an HOD holds the department-scoped one.
  // Either may stand at this queue — nothing else may.
  if (!can(session, 'verification.review.any')) {
    requireCap(session, 'verification.review.department');
  }

  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const status = (first(params.status) as StatusKey) ?? 'queued';
  const activeStatus: StatusKey = STATUS_TABS.some((t) => t.key === status) ? status : 'queued';
  const q = (first(params.q) ?? '').trim();
  const branch = first(params.branch) ?? '';

  const departments = getDepartments();
  const all = getVerificationClaims(session, { status: 'all' });

  const wide = can(session, 'verification.review.any');
  const hodScope = session.roles.find((r) => r.role === 'hod' && r.departmentId)?.departmentId ?? null;
  const scopedTo = !wide && hodScope ? hodScope : null;
  const scopeName = departments.find((d) => d.code === scopedTo)?.name ?? scopedTo;

  const counts = {
    queued: all.filter((c) => c.status === 'queued').length,
    approved: all.filter((c) => c.status === 'approved').length,
    rejected: all.filter((c) => c.status === 'rejected').length,
    all: all.length,
  };

  const withSignals = all.map((claim) => ({ claim, signal: signalsFor(claim) }));

  const waiting = withSignals.filter((r) => r.claim.status === 'queued');
  const noEvidence = waiting.filter((r) => !r.signal.top).length;
  const contested = waiting.filter((r) => r.signal.ambiguous || r.signal.homonym).length;
  const oldest = waiting
    .map((r) => r.claim.submittedAt)
    .sort((a, b) => a.localeCompare(b))[0];

  let rows = withSignals.filter((r) => activeStatus === 'all' || r.claim.status === activeStatus);
  if (branch) rows = rows.filter((r) => r.claim.claimedDepartmentCode === branch);
  if (q) {
    const t = q.toLowerCase();
    rows = rows.filter((r) =>
      `${r.claim.claimedName} ${r.claim.claimedRoll} ${r.claim.email}`.toLowerCase().includes(t),
    );
  }

  // A queue is first-in-first-out; the person who has waited longest is
  // the one the college is failing. Decided claims read newest first.
  rows = rows.sort((a, b) =>
    activeStatus === 'queued'
      ? a.claim.submittedAt.localeCompare(b.claim.submittedAt)
      : b.claim.submittedAt.localeCompare(a.claim.submittedAt),
  );

  const tabHref = (key: StatusKey) => {
    const sp = new URLSearchParams();
    sp.set('status', key);
    if (q) sp.set('q', q);
    if (branch) sp.set('branch', branch);
    return `/admin/verification?${sp.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Identity"
        title="Verification queue"
        description="Every claim is decided against the degree register from the examinations branch — never against a hunch. Open a claim to see the applicant's answers and the register rows side by side, field by field."
        actions={
          <>
            <ButtonLink href="/admin/degree-register" variant="secondary">
              <FileSearch className="size-4" aria-hidden="true" />
              Search the register
            </ButtonLink>
          </>
        }
      />

      {scopedTo ? (
        <Alert
          tone="info"
          title={`This view is scoped to ${scopeName}`}
          icon={<ShieldCheck className="size-4" />}
        >
          <p>
            You hold <span className="font-mono">verification.review.department</span> for {scopeName} ({scopedTo}).
            Claims from every other branch are filtered out before this page is rendered — a short queue here does not
            mean the college has a short queue. The alumni cell reviews the rest.
          </p>
        </Alert>
      ) : (
        <p className="text-xs text-muted">
          You hold <span className="font-mono">verification.review.any</span> — this queue covers every branch. An HOD
          sees only their own department.
        </p>
      )}

      <div className="grid gap-gutter sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Waiting for a decision"
          value={counts.queued}
          hint={oldest ? `Oldest submitted ${formatRelative(oldest)}` : 'Nothing waiting'}
          icon={<Inbox className="size-4" />}
        />
        <Stat
          label="Contested"
          value={contested}
          hint="Two register rows the score cannot separate"
          icon={<Scale className="size-4" />}
        />
        <Stat
          label="No register match"
          value={noEvidence}
          hint="Cannot be approved until the batch file is loaded"
          icon={<CircleSlash className="size-4" />}
        />
        <Stat
          label="Decided so far"
          value={counts.approved + counts.rejected}
          hint={`${counts.approved} approved · ${counts.rejected} rejected`}
          icon={<ShieldCheck className="size-4" />}
        />
      </div>

      {noEvidence > 0 ? (
        <Alert tone="warning" title="Some claims have no evidence behind them" icon={<AlertTriangle className="size-4" />}>
          <p>
            {noEvidence} {noEvidence === 1 ? 'claim carries' : 'claims carry'} a roll number with no row in the degree
            register. Approving one would put an unverified person into the alumni directory. Either the batch file has
            not been loaded yet, or the roll number is wrong — ask the applicant for their provisional certificate
            before doing anything else.
          </p>
        </Alert>
      ) : null}

      <form action="/admin/verification">
        <Card className="p-card">
          <input type="hidden" name="status" value={activeStatus} />
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
            <Field htmlFor="q" label="Search this queue" hint="Name, roll number or email address">
              <Input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="e.g. 18JN1A0521 or Sravani"
                leading={<Search className="size-4" />}
                autoComplete="off"
              />
            </Field>

            <Field
              htmlFor="branch"
              label="Branch"
              hint={scopedTo ? 'Fixed to your department.' : undefined}
            >
              <Select id="branch" name="branch" defaultValue={branch} disabled={Boolean(scopedTo)}>
                <option value="">{scopedTo ? `${scopedTo} only` : 'All branches'}</option>
                {departments.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex gap-2">
              <Button type="submit" variant="secondary">
                Apply
              </Button>
              {q || branch ? (
                <ButtonLink href={`/admin/verification?status=${activeStatus}`} variant="ghost">
                  Clear
                </ButtonLink>
              ) : null}
            </div>
          </div>
        </Card>
      </form>

      <Section>
        <Tabs
          ariaLabel="Claim status"
          items={STATUS_TABS.map((t) => ({
            label: t.label,
            href: tabHref(t.key),
            count: counts[t.key],
            active: t.key === activeStatus,
          }))}
        />

        {rows.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-5" />}
            title={
              q || branch
                ? 'No claim matches that filter'
                : activeStatus === 'queued'
                  ? 'Nothing is waiting for you'
                  : `No ${activeStatus} claims yet`
            }
            description={
              q || branch
                ? 'Search runs over the applicant name, roll number and email address of claims already inside your review scope.'
                : activeStatus === 'queued'
                  ? scopedTo
                    ? `Every ${scopedTo} claim has been decided. New registrations from ${scopedTo} land here within a minute of the applicant submitting their roll number.`
                    : 'Every claim has been decided. New registrations land here within a minute of the applicant submitting their roll number.'
                  : 'Claims appear here once someone has decided them. Each decision keeps the reviewer, the timestamp and the reason.'
            }
            action={
              q || branch ? (
                <ButtonLink href={`/admin/verification?status=${activeStatus}`} variant="secondary">
                  Clear the filter
                </ButtonLink>
              ) : null
            }
          />
        ) : (
          <>
            <TableWrap
              className="hidden sm:block"
              caption={`Verification claims — ${activeStatus === 'all' ? 'all statuses' : activeStatus}`}
            >
              <Table>
                <THead>
                  <TR>
                    <TH>Applicant</TH>
                    <TH>Claimed branch &amp; batch</TH>
                    <TH>Submitted</TH>
                    <TH>Evidence</TH>
                    <TH>Status</TH>
                    <TH align="right">Review</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map(({ claim, signal }) => (
                    <TR key={claim.id} interactive>
                      <TD>
                        <p className="font-medium">{claim.claimedName}</p>
                        <p className="font-mono text-xs text-secondary">{claim.claimedRoll}</p>
                        <p className="truncate text-xs text-muted">{claim.email}</p>
                      </TD>
                      <TD>
                        <p className="text-sm">
                          {memberLine([claim.claimedDepartmentCode, claim.claimedBatchYear])}
                        </p>
                        <p className="text-xs text-muted">
                          {departments.find((d) => d.code === claim.claimedDepartmentCode)?.name ?? 'Branch not stated'}
                        </p>
                      </TD>
                      <TD>
                        <p className="text-sm">{formatRelative(claim.submittedAt)}</p>
                        <p className="text-xs text-muted tabular">{formatDate(claim.submittedAt)}</p>
                      </TD>
                      <TD>
                        <EvidenceCell claim={claim} signal={signal} />
                      </TD>
                      <TD>
                        <StatusBadge claim={claim} />
                      </TD>
                      <TD align="right">
                        <ButtonLink href={`/admin/verification/${claim.id}`} variant="secondary" size="sm">
                          Open
                          <ArrowRight className="size-4" aria-hidden="true" />
                        </ButtonLink>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>

            <ul className="space-y-3 sm:hidden">
              {rows.map(({ claim, signal }) => (
                <li key={claim.id}>
                  <DefinitionCard
                    title={claim.claimedName}
                    subtitle={
                      <span className="font-mono">
                        {claim.claimedRoll} · {memberLine([claim.claimedDepartmentCode, claim.claimedBatchYear])}
                      </span>
                    }
                    rows={[
                      { label: 'Submitted', value: formatRelative(claim.submittedAt) },
                      {
                        label: 'Evidence',
                        value: signal.top
                          ? `${Math.round(signal.top.confidence * 100)}% · ${claim.candidates.length} candidate${claim.candidates.length === 1 ? '' : 's'}`
                          : 'No register row',
                      },
                      { label: 'Status', value: <StatusBadge claim={claim} /> },
                    ]}
                    actions={
                      <ButtonLink href={`/admin/verification/${claim.id}`} variant="secondary" size="sm">
                        Open the claim
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </ButtonLink>
                    }
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle as="h2">How a claim reaches this queue</CardTitle>
            <CardDescription>
              The matcher decides what needs a person. These thresholds are provisional until the full register lands.
            </CardDescription>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded border border-line bg-surface p-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-secondary">Auto-approve</dt>
              <dd className="mt-1 text-sm">
                Confidence at or above <span className="font-mono tabular">{AUTO_APPROVE_AT.toFixed(2)}</span> with no
                runner-up nearby. Roll number exact, name matching after normalisation, year of passing agreeing.
              </dd>
            </div>
            <div className="rounded border border-line bg-surface p-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-secondary">Sent here</dt>
              <dd className="mt-1 text-sm">
                Between <span className="font-mono tabular">{REVIEW_AT.toFixed(2)}</span> and{' '}
                <span className="font-mono tabular">{AUTO_APPROVE_AT.toFixed(2)}</span>, or any score at all when two
                rows sit within <span className="font-mono tabular">0.15</span> of each other.
              </dd>
            </div>
            <div className="rounded border border-line bg-surface p-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-secondary">Rejected at intake</dt>
              <dd className="mt-1 text-sm">
                Roll numbers that are not JNTU-shaped, and claims with no register row within two years of the batch
                claimed. These still appear here so a person can overturn them.
              </dd>
            </div>
          </dl>

          <Disclosure summary="Why an approval is never one click">
            <p>
              Approving a claim writes the member&rsquo;s status from <span className="font-mono">pending</span> to{' '}
              <span className="font-mono">active_alumni</span>, links their account to a row in{' '}
              <span className="font-mono">degree_register</span>, and grants them the alumni role — which is what opens
              the directory to them. Every one of those changes is recorded in{' '}
              <span className="font-mono">audit_log</span> with the before and after snapshot, your name, and the reason
              you gave. Retuning the thresholds against the real register is tracked in{' '}
              <span className="font-mono">test-matcher.ts</span>.
            </p>
          </Disclosure>
        </CardBody>
      </Card>
    </div>
  );
}
