import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  CircleSlash,
  BookMarked,
  ChevronLeft,
  MinusCircle,
  ScanSearch,
  UserRound,
  XCircle,
} from 'lucide-react';

import {
  Badge,
  ButtonLink,
  Breadcrumbs,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DetailRow,
  Disclosure,
  HowThisWorks,
  PageHeader,
} from '@/components/ui';
import { getSession, getSessionMember } from '@/lib/auth/session';
import { require as requireCap, can } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { canOpen } from '@/lib/navigation';
import { capitalise, greetingFor, joinList } from '@/lib/branding/copy';
import { firstNameOf } from '@/lib/identity';
import { getDepartments, getVerificationClaims, searchDegreeRegister } from '@/lib/data/repo';
import type { DegreeRecord, VerificationClaim } from '@/lib/data/types';
import {
  AUTO_APPROVE_AT,
  REVIEW_AT,
  admissionYearFromRoll,
  nameTokens,
  normaliseRoll,
} from '@/lib/verification/matcher';
import { daysUntil, formatDate, formatDateTime, formatRelative, memberLine } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  reasonLabel,
  reasonTone,
  rescoredCandidates,
  sourceFileLabel,
} from '../../_shared/verification-labels';
import { MatchMeter } from '../MatchMeter';
import { ReviewActions, type ReviewCandidate } from '../ReviewActions';

export const metadata = { title: 'Review a registration · Staff console' };

// ---------------------------------------------------------------
// Field-level comparison
// ---------------------------------------------------------------

type Verdict = 'match' | 'near' | 'differs' | 'unknown';

const VERDICT: Record<Verdict, { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string }> = {
  match: { tone: 'success', label: 'Matches' },
  near: { tone: 'warning', label: 'Close' },
  differs: { tone: 'danger', label: 'Differs' },
  unknown: { tone: 'neutral', label: 'Nothing to compare' },
};

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const v = VERDICT[verdict];
  const Icon =
    verdict === 'match' ? CheckCircle2 : verdict === 'near' ? AlertTriangle : verdict === 'differs' ? XCircle : MinusCircle;
  return (
    <Badge tone={v.tone}>
      <Icon className="size-3.5" aria-hidden="true" />
      {v.label}
    </Badge>
  );
}

interface FieldComparison {
  field: string;
  claimed: string;
  register: string;
  verdict: Verdict;
  note?: string;
  mono?: boolean;
  /** Marked when this is the field that separates two identical-looking rows. */
  discriminating?: boolean;
}

function tokenKey(name: string): string {
  return nameTokens(name).slice().sort().join(' ');
}

function nameVerdict(a: string, b: string): Verdict {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return 'unknown';

  const sa = new Set(ta);
  const sb = new Set(tb);
  const overlap = [...sa].filter((t) => sb.has(t)).length;
  const ratio = overlap / Math.min(sa.size, sb.size);

  if (ratio === 1 && sa.size === sb.size) return 'match';
  if (ratio === 1) return 'near';
  if (ratio >= 0.5) return 'near';
  return 'differs';
}

function yearVerdict(a: number | null, b: number | null): Verdict {
  if (a === null || b === null) return 'unknown';
  if (a === b) return 'match';
  return Math.abs(a - b) <= 1 ? 'near' : 'differs';
}

function compare(claim: VerificationClaim, record: DegreeRecord, contested: boolean): FieldComparison[] {
  const derivedAdmission = admissionYearFromRoll(claim.claimedRoll);

  return [
    {
      field: 'Name',
      claimed: claim.claimedName,
      register: record.name,
      verdict: nameVerdict(claim.claimedName, record.name),
      note:
        tokenKey(claim.claimedName) === tokenKey(record.name) &&
        nameTokens(claim.claimedName).join(' ') !== nameTokens(record.name).join(' ')
          ? 'Same name, written in a different order'
          : undefined,
    },
    {
      field: 'Roll number',
      claimed: claim.claimedRoll,
      register: record.rollNumber,
      verdict: normaliseRoll(claim.claimedRoll) === normaliseRoll(record.rollNumber) ? 'match' : 'differs',
      discriminating: contested,
      mono: true,
    },
    {
      field: 'Branch',
      claimed: claim.claimedDepartmentCode ?? '—',
      register: record.departmentCode ?? '—',
      verdict:
        !claim.claimedDepartmentCode || !record.departmentCode
          ? 'unknown'
          : claim.claimedDepartmentCode.toUpperCase() === record.departmentCode.toUpperCase()
            ? 'match'
            : 'differs',
    },
    {
      field: 'Year of passing',
      claimed: claim.claimedBatchYear ? String(claim.claimedBatchYear) : '—',
      register: record.yearOfPassing ? String(record.yearOfPassing) : '—',
      verdict: yearVerdict(claim.claimedBatchYear, record.yearOfPassing),
    },
    {
      field: 'Admission year',
      claimed: derivedAdmission ? String(derivedAdmission) : '—',
      register: record.admissionYear ? String(record.admissionYear) : '—',
      verdict: yearVerdict(derivedAdmission, record.admissionYear),
      discriminating: contested,
    },
  ];
}

const FIELD_NAME: Record<string, string> = {
  Name: 'the name',
  'Roll number': 'roll number',
  Branch: 'branch',
  'Year of passing': 'year of passing',
  'Admission year': 'admission year',
};

/** One line, above the evidence, saying what the evidence says. */
function verdictSummary(rows: FieldComparison[], roll: string): string {
  const named = (v: Verdict) => rows.filter((r) => r.verdict === v).map((r) => FIELD_NAME[r.field] ?? r.field);
  const matches = named('match').filter((f) => f !== 'the name');
  const nameRow = rows.find((r) => r.field === 'Name');
  const parts: string[] = [];
  if (matches.length) parts.push(`Matches register row ${roll} on ${joinList(matches)}`);
  else parts.push(`Register row ${roll} matches on nothing but the name`);
  if (nameRow?.verdict === 'match') parts[0] += ', and the name agrees';
  const close = named('near');
  const differs = named('differs');
  if (close.length) parts.push(`${capitalise(joinList(close))} ${close.length === 1 ? 'is' : 'are'} close`);
  if (differs.length) parts.push(`${capitalise(joinList(differs))} ${differs.length === 1 ? 'differs' : 'differ'}`);
  return `${parts.join('. ')}.`;
}

// ---------------------------------------------------------------
// Comparison views
// ---------------------------------------------------------------

/** A differing cell is tinted, so the eye lands on what disagrees before reading a word. */
const CELL_TINT: Record<Verdict, string | undefined> = {
  match: undefined,
  near: 'bg-[color-mix(in_srgb,var(--warning)_12%,transparent)]',
  differs: 'bg-[color-mix(in_srgb,var(--danger)_11%,transparent)]',
  unknown: undefined,
};

function ComparisonTable({ rows, roll }: { rows: FieldComparison[]; roll: string }) {
  return (
    <>
      {/* sm and up: the two records side by side, differences tinted. */}
      <div className="hidden overflow-x-auto rounded-lg border border-line sm:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">The registration compared with register row {roll}, field by field</caption>
          <thead className="border-b border-line bg-surface-sunken">
            <tr>
              <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-secondary">
                Field
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <UserRound className="size-3.5" aria-hidden="true" />
                  Applicant said
                </span>
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <BookMarked className="size-3.5" aria-hidden="true" />
                  Degree register
                </span>
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-secondary">
                Verdict
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.field} className={r.discriminating ? 'bg-[color-mix(in_srgb,var(--warning)_9%,transparent)]' : undefined}>
                <th scope="row" className="whitespace-nowrap px-3 py-2.5 text-left align-top font-medium">
                  {r.field}
                  {r.discriminating ? (
                    <span className="mt-0.5 block text-xs font-semibold text-warning-fg">Separates the two rows</span>
                  ) : null}
                </th>
                <td className={cn('px-3 py-2.5 align-top', CELL_TINT[r.verdict], r.mono && 'font-mono')}>{r.claimed}</td>
                <td className={cn('px-3 py-2.5 align-top', CELL_TINT[r.verdict])}>
                  <span className={cn(r.mono && 'font-mono')}>{r.register}</span>
                  {r.note ? <span className="mt-0.5 block text-xs text-secondary">{r.note}</span> : null}
                </td>
                <td className="px-3 py-2.5 align-top">
                  <VerdictBadge verdict={r.verdict} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: one definition block per field, never a wide table. */}
      <dl className="divide-y divide-line rounded-lg border border-line sm:hidden">
        {rows.map((r) => (
          <div
            key={r.field}
            className={cn('space-y-1.5 px-3 py-2.5', r.discriminating && 'bg-[color-mix(in_srgb,var(--warning)_9%,transparent)]')}
          >
            <dt className="flex items-center justify-between gap-3 text-sm font-medium">
              <span>
                {r.field}
                {r.discriminating ? (
                  <span className="block text-xs font-semibold text-warning-fg">Separates the two rows</span>
                ) : null}
              </span>
              <VerdictBadge verdict={r.verdict} />
            </dt>
            <dd className={cn('-mx-1 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 rounded px-1 py-1 text-sm', CELL_TINT[r.verdict])}>
              <span className="text-secondary">Applicant said</span>
              <span className={cn('break-words', r.mono && 'font-mono')}>{r.claimed}</span>
              <span className="text-secondary">Register</span>
              <span className="break-words">
                <span className={cn(r.mono && 'font-mono')}>{r.register}</span>
                {r.note ? <span className="block text-xs text-secondary">{r.note}</span> : null}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function RollLink({ record, linkable }: { record: DegreeRecord; linkable: boolean }) {
  return linkable ? (
    <Link href={`/admin/degree-register/${record.id}`} className="font-mono link-quiet">
      {record.rollNumber}
    </Link>
  ) : (
    <span className="font-mono">{record.rollNumber}</span>
  );
}

function RowList({ rows, linkable }: { rows: DegreeRecord[]; linkable: boolean }) {
  return (
    <ul className="divide-y divide-line text-sm">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5">
          <RollLink record={r} linkable={linkable} />
          <span className="min-w-0 flex-1">{r.name}</span>
          <span className="text-xs text-secondary">admitted {r.admissionYear ?? '—'}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------
// Page
// ---------------------------------------------------------------

export default async function VerificationClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  if (!can(session, 'verification.review.any')) {
    requireCap(session, 'verification.review.department');
  }

  const { id } = await params;

  // `getVerificationClaims` applies the department scope. An HOD asking
  // for another branch's claim by URL gets a 404, not a 403 — the claim
  // is not theirs to know about.
  const claim = getVerificationClaims(session, { status: 'all' }).find((c) => c.id === id);
  if (!claim) notFound();

  const { member } = await getSessionMember();
  const resolved = await getTenantBrand();
  if (!resolved) redirect('/login');
  const pack = resolved.brand.pack;
  const tz = pack.locale.timeZone;
  const fmt = { locale: pack.locale.locale, timeZone: tz };
  const departments = getDepartments();

  const openRegister = canOpen(session, pack, '/admin/degree-register');
  const openImports = canOpen(session, pack, '/admin/imports');

  // Scored here by the matcher against what the applicant typed, so the
  // score and any warning agree with the comparison table on the page.
  const ranked = rescoredCandidates(claim).sort((a, b) => b.confidence - a.confidence);
  const top = ranked[0] ?? null;
  const runnerUp = ranked[1] ?? null;
  const gap = top && runnerUp ? top.confidence - runnerUp.confidence : 1;
  const ambiguous = gap < 0.15;

  // The genuinely hard case: two register rows carrying the same name in
  // the same branch and the same year. The matcher cannot separate them
  // and neither can a reviewer, unless the discriminating fields are put
  // in front of them.
  const identityKeys = ranked.map((c) => `${tokenKey(c.record.name)}|${c.record.departmentCode}|${c.record.yearOfPassing}`);
  const homonymInQueue = identityKeys.length > 1 && new Set(identityKeys).size < identityKeys.length;

  /**
   * Rows elsewhere in the register that could be the same person: the same
   * branch, the same year of passing, and a name whose tokens are a subset
   * of the other's. Register spellings differ between files, so equality
   * on the printed name would miss precisely the pair a reviewer needs.
   */
  const registerTwins = (record: DegreeRecord): DegreeRecord[] => {
    const mine = new Set(nameTokens(record.name));
    if (mine.size === 0) return [];

    return searchDegreeRegister('', {
      department: record.departmentCode ?? undefined,
      year: record.yearOfPassing ?? undefined,
      perPage: 1000,
    })
      .items.filter((r) => {
        if (r.id === record.id) return false;
        const theirs = new Set(nameTokens(r.name));
        if (theirs.size === 0) return false;
        const shared = [...mine].filter((t) => theirs.has(t)).length;
        return shared >= 2 && shared === Math.min(mine.size, theirs.size);
      })
      .slice(0, 4);
  };

  const twinsByCandidate = new Map<string, DegreeRecord[]>(ranked.map((c) => [c.record.id, registerTwins(c.record)]));
  const anyTwins = homonymInQueue || [...twinsByCandidate.values()].some((v) => v.length > 0);
  const contestedClaim = ranked.length > 1 && (homonymInQueue || ambiguous);

  /**
   * A sweep of the claimed batch, run against the name the applicant typed
   * rather than against the matcher's candidates. An empty result is
   * evidence too: the register was looked at.
   */
  const batch = searchDegreeRegister('', {
    department: claim.claimedDepartmentCode ?? undefined,
    year: claim.claimedBatchYear ?? undefined,
    perPage: 1000,
  });
  const candidateIds = new Set(ranked.map((c) => c.record.id));
  const claimTokens = new Set(nameTokens(claim.claimedName));
  const lookAlikes = batch.items
    .filter((r) => {
      if (candidateIds.has(r.id)) return false;
      const theirs = new Set(nameTokens(r.name));
      if (theirs.size === 0 || claimTokens.size === 0) return false;
      const shared = [...claimTokens].filter((t) => theirs.has(t)).length;
      return shared >= 2 && shared === Math.min(claimTokens.size, theirs.size);
    })
    .slice(0, 5);

  const batchLabel = memberLine([claim.claimedDepartmentCode, claim.claimedBatchYear]) || 'the claimed batch';
  const batchFile =
    claim.claimedBatchYear && claim.claimedDepartmentCode
      ? `the ${claim.claimedBatchYear} ${claim.claimedDepartmentCode} file`
      : 'the file for that batch';
  const branchName = departments.find((d) => d.code === claim.claimedDepartmentCode)?.name ?? null;

  const reviewCandidates: ReviewCandidate[] = ranked.map((c) => ({
    id: c.record.id,
    rollNumber: c.record.rollNumber,
    name: c.record.name,
    departmentCode: c.record.departmentCode,
    yearOfPassing: c.record.yearOfPassing,
    admissionYear: c.record.admissionYear,
    sourceLabel: sourceFileLabel(c.record.sourceFile),
    confidence: c.confidence,
    contested: homonymInQueue || ambiguous || (twinsByCandidate.get(c.record.id)?.length ?? 0) > 0,
  }));

  const decided =
    claim.status === 'approved' || claim.status === 'rejected'
      ? {
          status: claim.status,
          reviewedBy: claim.reviewedBy,
          reviewedAt: formatDateTime(claim.reviewedAt, fmt),
          note: claim.reviewNote,
        }
      : null;

  // "Next registration": the next one in the queue's own order (oldest first),
  // from the list this viewer can see.
  const queue = getVerificationClaims(session, { status: 'queued' }).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  const at = queue.findIndex((c) => c.id === claim.id);
  const next = at >= 0 ? (queue[at + 1] ?? null) : (queue[0] ?? null);
  const nextHref = next ? `/admin/verification/${next.id}` : null;
  const prev = at > 0 ? queue[at - 1]! : null;
  const prevHref = prev ? `/admin/verification/${prev.id}` : null;

  const waited = -daysUntil(claim.submittedAt, tz);
  const late = claim.status === 'queued' && waited > 14;
  const first = firstNameOf(claim.claimedName);
  const office = capitalise(pack.copy.officeName);

  const topRows = top ? compare(claim, top.record, contestedClaim || anyTwins) : [];
  const summary = !top
    ? 'No register row matches this registration.'
    : contestedClaim
      ? 'Two register rows could be this person. The roll number and the admission year inside it separate them.'
      : verdictSummary(topRows, top.record.rollNumber);

  const statusBadge =
    claim.status === 'approved' ? (
      <Badge tone="success">Approved</Badge>
    ) : claim.status === 'rejected' ? (
      <Badge tone="danger">Rejected</Badge>
    ) : (
      <Badge tone="brand">Waiting</Badge>
    );

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Staff console', href: '/admin' },
              { label: 'Verification queue', href: '/admin/verification' },
              { label: claim.claimedName },
            ]}
          />
        }
        eyebrow="Registration"
        title={claim.claimedName}
        description={
          <>
            {memberLine([claim.claimedDepartmentCode, claim.claimedBatchYear])} ·{' '}
            <span className="font-mono">{claim.claimedRoll}</span> ·{' '}
            {claim.status === 'queued'
              ? waited <= 0
                ? 'waiting since today'
                : `waiting ${waited} ${waited === 1 ? 'day' : 'days'}`
              : `submitted ${formatRelative(claim.submittedAt, fmt)}`}
          </>
        }
        meta={
          <>
            {statusBadge}
            {late ? <Badge tone="warning">Over 14 days</Badge> : null}
          </>
        }
        actions={
          // Position in the queue, then the two neighbours: the screen is a
          // detail pane, and the reviewer should never need the list to move on.
          <>
            {at >= 0 ? (
              <span className="tabular text-sm text-secondary">
                {at + 1} of {queue.length} waiting
              </span>
            ) : null}
            {prevHref ? (
              <ButtonLink href={prevHref} variant="ghost" aria-label="Previous registration">
                <ChevronLeft className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Previous</span>
              </ButtonLink>
            ) : null}
            {nextHref ? (
              <ButtonLink href={nextHref} variant="secondary">
                Next registration
                <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {decided ? (
        <Card>
          <CardBody className="flex flex-wrap items-start gap-x-6 gap-y-3">
            <span
              className={cn(
                'grid size-10 shrink-0 place-items-center rounded-full',
                decided.status === 'approved' ? 'bg-success-soft text-success-fg' : 'bg-danger-soft text-danger-fg',
              )}
              aria-hidden="true"
            >
              {decided.status === 'approved' ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-display text-lg font-semibold">
                {decided.status === 'approved' ? 'Approved' : 'Rejected'} on {decided.reviewedAt}
              </p>
              <p className="text-sm text-secondary">
                By {decided.reviewedBy ?? 'an unrecorded reviewer'}.{' '}
                {decided.note ? <>Reason: {decided.note}</> : 'No reason was recorded.'}
              </p>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ---- Evidence ---- */}
        <div className="min-w-0 space-y-gutter lg:col-start-1">
          <p
            className={cn(
              'flex items-start gap-2 rounded-lg border px-4 py-3 text-sm font-medium',
              !top
                ? 'border-[color-mix(in_srgb,currentColor_26%,transparent)] bg-danger-soft text-danger-fg'
                : contestedClaim
                  ? 'border-[color-mix(in_srgb,currentColor_26%,transparent)] bg-warning-soft text-warning-fg'
                  : 'border-line bg-surface-raised text-primary',
            )}
          >
            {!top ? (
              <CircleSlash className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            ) : contestedClaim ? (
              <ArrowLeftRight className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            ) : (
              <ScanSearch className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            )}
            <span>{summary}</span>
          </p>

          {ranked.length === 0 ? (
            <Card>
              <CardBody className="space-y-4 text-sm">
                <p className="text-secondary">
                  Nothing in the register carries <span className="font-mono text-primary">{claim.claimedRoll}</span>,
                  and no row near {claim.claimedBatchYear ?? 'that year'} carries this name in{' '}
                  {claim.claimedDepartmentCode ?? 'this branch'}. Either {batchFile} has not been loaded yet,
                  or the roll number is wrong.
                </p>
                <div className="flex flex-wrap gap-2">
                  {openImports ? (
                    <ButtonLink href="/admin/imports" variant="secondary" size="sm">
                      Check which files are loaded
                    </ButtonLink>
                  ) : null}
                  {openRegister ? (
                    <ButtonLink
                      href={`/admin/degree-register?q=${encodeURIComponent(nameTokens(claim.claimedName)[0] ?? '')}${claim.claimedBatchYear ? `&year=${claim.claimedBatchYear}` : ''}`}
                      variant="secondary"
                      size="sm"
                    >
                      <ScanSearch className="size-4" aria-hidden="true" />
                      Look for the name by hand
                    </ButtonLink>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          ) : (
            ranked.map((candidate, index) => {
              const twins = twinsByCandidate.get(candidate.record.id) ?? [];
              const contested = contestedClaim || twins.length > 0;
              const rows = index === 0 ? topRows : compare(claim, candidate.record, contested);
              const identityMatch = rows.some(
                (r) => (r.field === 'Name' || r.field === 'Roll number') && (r.verdict === 'match' || r.verdict === 'near'),
              );
              const collapse = index > 0 && !contested && !identityMatch;
              const record = candidate.record;
              // What agrees is already green in the table; only what needs a
              // second look is repeated as a chip.
              const cautions = candidate.reasons.filter((r) => reasonTone(r) !== 'success');
              const footnote = `From ${sourceFileLabel(record.sourceFile)}${record.programme ? ` · ${record.programme}` : ''}`;

              const body = (
                <div className="space-y-4">
                  <ComparisonTable rows={rows} roll={record.rollNumber} />

                  {cautions.length ? (
                    <ul className="flex flex-wrap gap-1.5" aria-label="What needs a second look">
                      {cautions.map((r) => (
                        <li key={r}>
                          <Badge tone={reasonTone(r)}>{reasonLabel(r)}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {twins.length > 0 ? (
                    <div className="space-y-1 rounded-lg border border-line bg-surface p-3">
                      <p className="text-sm font-medium">
                        Also in {memberLine([record.departmentCode, record.yearOfPassing])} with this name
                      </p>
                      <RowList rows={twins} linkable={openRegister} />
                    </div>
                  ) : null}

                  <p className="text-xs text-secondary">{footnote}</p>
                </div>
              );

              if (collapse) {
                return (
                  <Disclosure
                    key={record.id}
                    summary={
                      <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="font-semibold">Candidate {index + 1}</span>
                        <span className="font-mono text-secondary">{record.rollNumber}</span>
                        <span className="text-secondary">
                          {record.name} · {Math.round(candidate.confidence * 100)}% · nothing that identifies them matches
                        </span>
                      </span>
                    }
                  >
                    {body}
                  </Disclosure>
                );
              }

              return (
                <Card key={record.id} className="min-w-0">
                  <CardHeader className="flex-wrap">
                    <div className="min-w-0 space-y-0.5">
                      <CardTitle as="h2" className="text-md">
                        {index === 0 ? 'Best candidate' : `Candidate ${index + 1}`}{' '}
                        <span className="text-sm font-normal text-secondary">
                          · <RollLink record={record} linkable={openRegister} />
                        </span>
                      </CardTitle>
                      <p className="text-sm text-secondary">
                        {memberLine([record.name, record.departmentCode, record.yearOfPassing ? `passed ${record.yearOfPassing}` : null])}
                      </p>
                    </div>
                    <MatchMeter confidence={candidate.confidence} size="lg" />
                  </CardHeader>
                  <CardBody>{body}</CardBody>
                </Card>
              );
            })
          )}

          {lookAlikes.length > 0 ? (
            <Card>
              <CardBody className="space-y-2">
                <p className="text-sm font-medium">
                  {lookAlikes.length} more {lookAlikes.length === 1 ? 'row' : 'rows'} in {batchLabel} with a similar name
                </p>
                <RowList rows={lookAlikes} linkable={openRegister} />
              </CardBody>
            </Card>
          ) : ranked.length > 0 ? (
            <p className="text-sm text-secondary">
              No other row in {batchLabel} carries a similar name.
            </p>
          ) : null}

        </div>

        {/* ---- Decision rail ---- */}
        <aside aria-label="Decision" className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-stretch">
          <div className="lg:sticky lg:top-20">
            <ReviewActions
              claimId={claim.id}
              claimName={claim.claimedName}
              firstName={first}
              claimRoll={claim.claimedRoll}
              claimEmail={claim.email}
              claimMobile={claim.mobile}
              candidates={reviewCandidates}
              reviewerName={member?.fullName ?? 'You'}
              canOverride={can(session, 'verification.override')}
              decided={decided}
              greeting={greetingFor(pack.copy)}
              signature={`— ${office}, ${pack.copy.shortName}`}
              whatsapp={pack.features.whatsapp}
              nextHref={nextHref}
              prevHref={prevHref}
              auditHref={can(session, 'audit.read') ? '/admin/audit' : null}
            />
          </div>
        </aside>

        <div className="min-w-0 space-y-gutter lg:col-start-1">
          <Card>
            <CardHeader variant="stack">
              <CardTitle as="h2" className="text-md">
                What they submitted
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-2">
              <dl className="divide-y divide-line">
                <DetailRow label="Branch">{branchName ?? claim.claimedDepartmentCode ?? '—'}</DetailRow>
                <DetailRow label="Email">
                  <span className="break-all">{claim.email}</span>
                </DetailRow>
                <DetailRow label="Mobile">
                  {claim.mobile ? <span className="font-mono">{claim.mobile}</span> : <span className="text-secondary">Not given</span>}
                </DetailRow>
                <DetailRow label="Submitted">
                  <span className="tabular">{formatDate(claim.submittedAt, fmt)}</span>
                </DetailRow>
              </dl>
            </CardBody>
          </Card>

          <HowThisWorks summary="How to read this">
            <p>
              Each row compares what the applicant typed with the degree register. Register names are typed by hand
              from mark sheets, so word order, initials and capitals often differ; the roll number carries the match.
              The admission year on the left is read from the first two digits of the roll number they typed.
            </p>
            <p>
              When two rows could be the same person, the roll number and admission year separate them. When no row
              matches, either that batch’s file has not been loaded yet or the roll number is wrong, so ask for a
              document rather than rejecting.
            </p>
          </HowThisWorks>
        </div>
      </div>

      {/* Room at the foot of a phone for the decision bar, so it never
          covers the last lines of the page. */}
      {!decided || can(session, 'verification.override') ? (
        <div aria-hidden="true" data-print-hide="" className="h-16 lg:hidden" />
      ) : null}
    </div>
  );
}

// The matcher's bands decide what reaches this page; the page itself
// shows their outcome in words.
void AUTO_APPROVE_AT;
void REVIEW_AT;
