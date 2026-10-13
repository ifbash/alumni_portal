import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeftRight, ArrowRight, Building2, ChevronRight, CircleSlash, FileSearch, Search } from 'lucide-react';

import {
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  ButtonLink,
  ChipNav,
  EmptyState,
  HowThisWorks,
  Input,
  PageHeader,
  Select,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Tabs,
  TrustChip,
} from '@/components/ui';
import { getSession } from '@/lib/auth/session';
import { require as requireCap, can } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { canOpen } from '@/lib/navigation';
import { getDegreeRegisterStats, getDepartments, getVerificationClaims } from '@/lib/data/repo';
import type { VerificationClaim } from '@/lib/data/types';
import { AUTO_APPROVE_AT, REVIEW_AT, nameTokens } from '@/lib/verification/matcher';
import { daysUntil, formatRelative, memberLine } from '@/lib/format';
import { cn } from '@/lib/cn';
import { evidenceWords, rescoredCandidates } from '../_shared/verification-labels';
import { batchCommsHref, weakestBatches } from '../_shared/RegisterFilesGrid';

export const metadata = { title: 'Verification queue · Staff console' };

type StatusKey = 'queued' | 'approved' | 'rejected' | 'all';
type ShowKey = 'all' | 'contested' | 'no-row' | 'overdue';

const STATUS_TABS: Array<{ key: StatusKey; label: string }> = [
  { key: 'queued', label: 'Waiting' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'Everything' },
];

/** A registration waiting longer than this is late, and the row says so. */
const LATE_AFTER_DAYS = 14;

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
  const ranked = rescoredCandidates(claim).sort((a, b) => b.confidence - a.confidence);
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

function EvidenceCell({ signal }: { signal: Signal }) {
  if (!signal.top) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-danger-fg">
        <CircleSlash className="size-4 shrink-0" aria-hidden="true" />
        No register row
      </span>
    );
  }

  if (signal.ambiguous || signal.homonym) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-warning-fg">
        <ArrowLeftRight className="size-4 shrink-0" aria-hidden="true" />
        Two rows too close
      </span>
    );
  }

  const pct = Math.round(signal.top.confidence * 100);
  return (
    <span className="block w-40 max-w-full space-y-1">
      <span className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{evidenceWords(signal.top.confidence)}</span>
        <span className="tabular text-secondary">{pct}%</span>
      </span>
      <span className="block h-1.5 overflow-hidden rounded-full bg-chart-track" aria-hidden="true">
        <span className="block h-full rounded-full bg-chart-bar" style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}

function StatusBadge({ claim }: { claim: VerificationClaim }) {
  if (claim.status === 'approved') return <Badge tone="success">Approved</Badge>;
  if (claim.status === 'rejected') return <Badge tone="danger">Rejected</Badge>;
  if (claim.decision === 'auto_approve') return <Badge tone="brand">Likely match</Badge>;
  if (claim.decision === 'reject') return <Badge tone="warning">Likely no match</Badge>;
  return <Badge tone="neutral">Needs review</Badge>;
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
  const showRaw = first(params.show) ?? 'all';
  const show: ShowKey = (['all', 'contested', 'no-row', 'overdue'] as const).includes(showRaw as ShowKey)
    ? (showRaw as ShowKey)
    : 'all';

  const departments = getDepartments();
  const all = getVerificationClaims(session, { status: 'all' });

  const wide = can(session, 'verification.review.any');
  const hodScope = session.roles.find((r) => r.role === 'hod' && r.departmentId)?.departmentId ?? null;
  const scopedTo = !wide && hodScope ? hodScope : null;
  const scopeName = departments.find((d) => d.code === scopedTo)?.name ?? scopedTo;

  const resolved = await getTenantBrand();
  if (!resolved) redirect('/login');
  const pack = resolved.brand.pack;
  const tz = pack.locale.timeZone;
  const fmt = { locale: pack.locale.locale, timeZone: tz };

  const counts = {
    queued: all.filter((c) => c.status === 'queued').length,
    approved: all.filter((c) => c.status === 'approved').length,
    rejected: all.filter((c) => c.status === 'rejected').length,
    all: all.length,
  };

  const waitedDays = (c: VerificationClaim) => -daysUntil(c.submittedAt, tz);
  const isLate = (c: VerificationClaim) => c.status === 'queued' && waitedDays(c) > LATE_AFTER_DAYS;

  const withSignals = all.map((claim) => ({ claim, signal: signalsFor(claim) }));
  const contested = (r: (typeof withSignals)[number]) => Boolean(r.signal.top && (r.signal.ambiguous || r.signal.homonym));

  // The fetched claims for this tab and search, before the chip filter.
  let fetched = withSignals.filter((r) => activeStatus === 'all' || r.claim.status === activeStatus);
  if (branch && !scopedTo) fetched = fetched.filter((r) => r.claim.claimedDepartmentCode === branch);
  if (q) {
    const t = q.toLowerCase();
    fetched = fetched.filter((r) =>
      `${r.claim.claimedName} ${r.claim.claimedRoll} ${r.claim.email}`.toLowerCase().includes(t),
    );
  }

  const showCounts: Record<ShowKey, number> = {
    all: fetched.length,
    contested: fetched.filter(contested).length,
    'no-row': fetched.filter((r) => !r.signal.top).length,
    overdue: fetched.filter((r) => isLate(r.claim)).length,
  };

  let rows = fetched.filter((r) =>
    show === 'contested' ? contested(r) : show === 'no-row' ? !r.signal.top : show === 'overdue' ? isLate(r.claim) : true,
  );

  // A queue is first-in-first-out; the person who has waited longest is
  // the one the college is failing. Decided claims read newest first.
  rows = rows.sort((a, b) =>
    activeStatus === 'queued'
      ? a.claim.submittedAt.localeCompare(b.claim.submittedAt)
      : b.claim.submittedAt.localeCompare(a.claim.submittedAt),
  );

  const oldest = [...all].filter((c) => c.status === 'queued').sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))[0];

  const hrefWith = (next: { status?: StatusKey; show?: ShowKey }) => {
    const sp = new URLSearchParams();
    sp.set('status', next.status ?? activeStatus);
    const s = next.show ?? show;
    if (s !== 'all') sp.set('show', s);
    if (q) sp.set('q', q);
    if (branch && !scopedTo) sp.set('branch', branch);
    return `/admin/verification?${sp.toString()}`;
  };

  const chips: Array<{ key: ShowKey; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'contested', label: 'Contested' },
    { key: 'no-row', label: 'No register row' },
    { key: 'overdue', label: `Waiting over ${LATE_AFTER_DAYS} days` },
  ];

  const openRegister = canOpen(session, pack, '/admin/degree-register');
  const openComms = canOpen(session, pack, '/admin/comms');
  const decidedTab = activeStatus !== 'queued';
  const filtered = Boolean(q || (branch && !scopedTo) || show !== 'all');

  // "While it is quiet": the batches furthest behind, for the empty queue.
  const register = getDegreeRegisterStats();
  const under20 = register.byYear.filter((y) => y.total && y.claimed / y.total < 0.2);
  const weakest = weakestBatches(register.byYear, 1)[0];

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs items={[{ label: 'Staff console', href: '/admin' }, { label: 'Verification queue' }]} />
        }
        eyebrow="People and records"
        title="Registrations to review"
        description="Oldest first. Open one to compare it with the degree register."
        meta={
          <TrustChip icon={<Building2 />}>{scopedTo ? `${scopeName} only` : 'All branches'}</TrustChip>
        }
        actions={
          <>
            {openRegister ? (
              // Phones keep the one primary action; the register is a tap away in the menu.
              <ButtonLink href="/admin/degree-register" variant="secondary" className="hidden sm:inline-flex">
                <FileSearch className="size-4" aria-hidden="true" />
                Search the register
              </ButtonLink>
            ) : null}
            {oldest ? (
              <ButtonLink href={`/admin/verification/${oldest.id}`}>
                Start with the oldest
                <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <Tabs
        ariaLabel="Registration status"
        items={STATUS_TABS.map((t) => ({
          label: t.label,
          href: hrefWith({ status: t.key, show: 'all' }),
          count: counts[t.key],
          active: t.key === activeStatus,
        }))}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <ChipNav
          ariaLabel="Show"
          className="lg:flex-1"
          items={chips
            .filter((c) => c.key === 'all' || c.key === show || showCounts[c.key] > 0)
            .map((c) => ({
              label: c.label,
              href: hrefWith({ show: c.key }),
              count: showCounts[c.key],
              active: c.key === show,
            }))}
        />

        <form action="/admin/verification" role="search" className="flex min-w-0 flex-wrap items-center gap-2">
          <input type="hidden" name="status" value={activeStatus} />
          {show !== 'all' ? <input type="hidden" name="show" value={show} /> : null}
          <label htmlFor="q" className="sr-only">
            Search by name, roll number or email
          </label>
          <div className="min-w-0 flex-1 basis-48 sm:w-64 sm:flex-none">
            <Input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Name, roll number or email"
              leading={<Search className="size-4" />}
              autoComplete="off"
            />
          </div>
          {scopedTo ? null : (
            <div className="w-36">
              <label htmlFor="branch" className="sr-only">
                Branch
              </label>
              <Select id="branch" name="branch" defaultValue={branch}>
                <option value="">All branches</option>
                {departments.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.code}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <Button type="submit" variant="secondary">
            Apply
          </Button>
          {q || (branch && !scopedTo) ? (
            <ButtonLink href={`/admin/verification?status=${activeStatus}`} variant="ghost">
              Clear
            </ButtonLink>
          ) : null}
        </form>
      </div>

      {rows.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={<Search className="size-5" />}
            title="No registration matches that"
            description="Search covers the name, roll number and email of registrations you can review."
            action={
              <ButtonLink href={`/admin/verification?status=${activeStatus}`} variant="secondary">
                Clear the filter
              </ButtonLink>
            }
          />
        ) : activeStatus === 'queued' ? (
          <EmptyState
            title="All caught up."
            description={
              under20.length > 0 && openComms && weakest
                ? `While it is quiet: ${under20.length} ${under20.length === 1 ? 'batch is' : 'batches are'} under 20%.`
                : 'New registrations land here as soon as they are submitted.'
            }
            action={
              under20.length > 0 && openComms && weakest ? (
                <ButtonLink href={batchCommsHref(weakest.year)} variant="secondary">
                  Write to the {weakest.year} batch
                </ButtonLink>
              ) : null
            }
          />
        ) : (
          <EmptyState
            title={`No ${activeStatus === 'all' ? '' : `${activeStatus} `}registrations yet`}
            description="Each decision keeps the reviewer, the date and the reason."
          />
        )
      ) : (
        <>
          <TableWrap className="hidden sm:block" caption="Registrations to review">
            <Table>
              <THead>
                <TR>
                  <TH>Applicant</TH>
                  <TH>Batch</TH>
                  <TH>{decidedTab ? 'Submitted' : 'Waiting'}</TH>
                  <TH>Evidence</TH>
                  {decidedTab ? <TH>Status</TH> : null}
                  <TH className="w-8">
                    <span className="sr-only">Open</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {rows.map(({ claim, signal }) => (
                  <TR key={claim.id} interactive className="relative">
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar name={claim.claimedName} size="sm" />
                        <div className="min-w-0">
                          <Link
                            href={`/admin/verification/${claim.id}`}
                            className="block font-medium text-primary after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded focus-visible:after:ring-2 focus-visible:after:ring-[var(--focus-ring)]"
                          >
                            {claim.claimedName}
                          </Link>
                          <span className="block font-mono text-xs text-secondary">{claim.claimedRoll}</span>
                        </div>
                      </div>
                    </TD>
                    <TD className="whitespace-nowrap">
                      {memberLine([claim.claimedDepartmentCode, claim.claimedBatchYear]) || '—'}
                    </TD>
                    <TD className="whitespace-nowrap">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-secondary">{formatRelative(claim.submittedAt, fmt)}</span>
                        {isLate(claim) ? <Badge tone="warning">Over {LATE_AFTER_DAYS} days</Badge> : null}
                      </span>
                    </TD>
                    <TD>
                      <EvidenceCell signal={signal} />
                    </TD>
                    {decidedTab ? (
                      <TD>
                        <StatusBadge claim={claim} />
                      </TD>
                    ) : null}
                    <TD align="right">
                      <ChevronRight className="size-4 text-muted" aria-hidden="true" />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>

          <ul className="space-y-2 sm:hidden" aria-label="Registrations to review">
            {rows.map(({ claim, signal }) => (
              <li key={claim.id}>
                <Link
                  href={`/admin/verification/${claim.id}`}
                  className="flex min-h-11 items-start gap-3 rounded-lg border border-line bg-surface-raised p-3 transition-colors duration-fast ease-brand hover:border-line-strong"
                >
                  <Avatar name={claim.claimedName} size="sm" />
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0 font-medium text-primary">{claim.claimedName}</span>
                      {decidedTab ? <StatusBadge claim={claim} /> : null}
                    </span>
                    <span className="block text-xs text-secondary">
                      <span className="font-mono">{claim.claimedRoll}</span>
                      {' · '}
                      {memberLine([claim.claimedDepartmentCode, claim.claimedBatchYear])}
                      {' · '}
                      {formatRelative(claim.submittedAt, fmt)}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 pt-1">
                      <EvidenceCell signal={signal} />
                      {isLate(claim) ? <Badge tone="warning">Over {LATE_AFTER_DAYS} days</Badge> : null}
                    </span>
                  </span>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-muted" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <HowThisWorks summary="How matching works" className={cn(rows.length === 0 && 'mt-2')}>
        <p>
          When someone registers, the portal looks for their row in the degree register by roll number, then compares
          the name, branch and year of passing. A close match on every field is approved without anyone looking.
          Anything less certain waits here, oldest first, with the rows it could be.
        </p>
        <p>
          Approve against the row that is theirs. Ask for a document when you are not sure. Reject only when no row can
          be theirs. Register names are typed by hand, so spelling and word order often differ; the roll number
          carries the match.
        </p>
      </HowThisWorks>
    </div>
  );
}

// The matcher's own bands stay the single source of what is approved
// automatically; this page shows their outcome in words, never the numbers.
void AUTO_APPROVE_AT;
void REVIEW_AT;
