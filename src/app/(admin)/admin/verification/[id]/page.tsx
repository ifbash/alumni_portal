import { notFound, redirect } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  CircleSlash,
  FileSearch,
  MinusCircle,
  ScanSearch,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import {
  Alert,
  Badge,
  ButtonLink,
  Breadcrumbs,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  DetailRow,
  PageHeader,
  Progress,
  Section,
  Separator,
  TableWrap,
} from '@/components/ui';
import { getSession, getSessionMember } from '@/lib/auth/session';
import { require as requireCap, can } from '@/lib/auth/guard';
import { getDepartments, getVerificationClaims, searchDegreeRegister } from '@/lib/data/repo';
import type { DegreeRecord, VerificationClaim } from '@/lib/data/types';
import {
  AUTO_APPROVE_AT,
  REVIEW_AT,
  admissionYearFromRoll,
  nameTokens,
  normaliseRoll,
} from '@/lib/verification/matcher';
import { formatDate, formatDateTime, formatRelative } from '@/lib/format';
import { ReviewActions, type ReviewCandidate } from '../ReviewActions';

export const metadata = { title: 'Review a verification claim' };

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
        tokenKey(claim.claimedName) === tokenKey(record.name) && claim.claimedName !== record.name
          ? 'Same name tokens in a different order — the register keeps surname first.'
          : undefined,
    },
    {
      field: 'Roll number',
      claimed: claim.claimedRoll,
      register: record.rollNumber,
      verdict: normaliseRoll(claim.claimedRoll) === normaliseRoll(record.rollNumber) ? 'match' : 'differs',
      discriminating: contested,
      note: contested ? 'This is the field that separates the two rows.' : undefined,
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
      note: derivedAdmission
        ? 'Read from the first two digits of the roll number the applicant typed — not something they were asked separately.'
        : 'The roll number does not start with two year digits, so nothing can be derived from it.',
    },
    {
      field: 'Programme',
      claimed: '—',
      register: record.programme ?? '—',
      verdict: 'unknown',
      note: 'Registration does not ask for the programme; it comes from the register.',
    },
    {
      field: 'Source file',
      claimed: '—',
      register: record.sourceFile ?? 'unknown',
      verdict: 'unknown',
      discriminating: contested,
      note: 'Which file from the examinations branch this row arrived in.',
    },
  ];
}

// ---------------------------------------------------------------
// Matcher reasons
// ---------------------------------------------------------------

const REASON_LABEL: Record<string, string> = {
  roll_exact: 'Roll number matches the register exactly',
  name_exact: 'Name matches after normalisation',
  name_close: 'Name is close after normalisation',
  name_weak: 'Name overlaps only weakly',
  name_mismatch: 'Name does not match',
  department_match: 'Branch matches',
  department_mismatch: 'Branch does not match',
  batch_match: 'Year of passing matches',
  batch_near: 'Year of passing is one year out',
  batch_mismatch: 'Year of passing does not match',
  ambiguous_match: 'Two register rows score too closely to separate',
  batch_before_admission: 'Batch year is not after the admission year in the roll number',
  low_confidence: 'No candidate scored high enough to act on',
  no_register_match: 'No row in the register matched',
  roll_format_invalid: 'Roll number is not in JNTU format',
};

function reasonLabel(raw: string): string {
  return REASON_LABEL[raw] ?? raw;
}

function reasonTone(raw: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (/mismatch|invalid|no_register|low_confidence|does not/i.test(raw)) return 'danger';
  if (/ambiguous|near|weak|differs|close|absent|order/i.test(raw)) return 'warning';
  if (/exact|match/i.test(raw)) return 'success';
  return 'neutral';
}

// ---------------------------------------------------------------
// Register sweep
// ---------------------------------------------------------------

/**
 * What the register holds for the claimed batch, searched on the name the
 * applicant typed rather than on the matcher's shortlist.
 *
 * A reviewer should not have to open a second tab to answer "is there
 * anyone in that batch this could be". An empty result here is itself
 * evidence, and is written as such.
 */
function RegisterSweep({
  batchLabel,
  batchTotal,
  claimedName,
  lookAlikes,
}: {
  batchLabel: string;
  batchTotal: number;
  claimedName: string;
  lookAlikes: DegreeRecord[];
}) {
  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ScanSearch className="size-4 text-muted" aria-hidden="true" />
          The rest of {batchLabel}, swept for this name
        </h3>
        <p className="text-xs text-secondary tabular">{batchTotal} rows in that batch</p>
      </div>

      {lookAlikes.length === 0 ? (
        <p className="text-sm text-secondary">
          Every row for that branch and year was compared against{' '}
          <span className="font-medium text-primary">{claimedName}</span> on name tokens, ignoring order, initials and
          case. None of them could be this person. The register has been looked at — this is an absence, not an
          oversight.
        </p>
      ) : (
        <>
          <p className="text-sm text-secondary">
            These carry a name that could be <span className="font-medium text-primary">{claimedName}</span> spelled
            differently, in the same branch and year, but are not among the candidates above — the roll numbers do not
            agree. One of them may still be the applicant under a roll they mistyped. A name alone is never enough:
            ask for the memorandum of marks before binding an account to any of them.
          </p>
          <ul className="space-y-2">
            {lookAlikes.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                <span className="font-mono font-medium">{r.rollNumber}</span>
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span className="text-xs text-secondary">
                  admitted {r.admissionYear ?? '—'} ·{' '}
                  <span className="font-mono">{r.sourceFile ?? 'source unknown'}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
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
  const departments = getDepartments();
  const wide = can(session, 'verification.review.any');
  const hodScope = session.roles.find((r) => r.role === 'hod' && r.departmentId)?.departmentId ?? null;
  const scopedTo = !wide && hodScope ? hodScope : null;

  const ranked = [...claim.candidates].sort((a, b) => b.confidence - a.confidence);
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
   * of the other's. Register spellings differ between files — "Kandula
   * Ravi Teja" in one, "Kandula R. Teja" in the next — so equality on the
   * printed name would miss precisely the pair a reviewer needs to see.
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

  const twinsByCandidate = new Map<string, DegreeRecord[]>(
    ranked.map((c) => [c.record.id, registerTwins(c.record)]),
  );
  const anyTwins = homonymInQueue || [...twinsByCandidate.values()].some((v) => v.length > 0);

  /**
   * A sweep of the claimed batch, run against the name the applicant
   * typed rather than against the matcher's candidates.
   *
   * "An approver must never be asked to decide against no evidence"
   * includes evidence of absence: when the sweep comes back empty, the
   * reviewer knows the register was actually looked at, and has not been
   * left to wonder whether the matcher simply missed something.
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

  const batchLabel = `${claim.claimedDepartmentCode ?? 'every branch'} ${claim.claimedBatchYear ?? ''}`.trim();

  const reviewCandidates: ReviewCandidate[] = ranked.map((c) => ({
    id: c.record.id,
    rollNumber: c.record.rollNumber,
    name: c.record.name,
    departmentCode: c.record.departmentCode,
    yearOfPassing: c.record.yearOfPassing,
    admissionYear: c.record.admissionYear,
    sourceFile: c.record.sourceFile,
    confidence: c.confidence,
    contested: homonymInQueue || ambiguous || (twinsByCandidate.get(c.record.id)?.length ?? 0) > 0,
  }));

  const decided =
    claim.status === 'approved' || claim.status === 'rejected'
      ? {
          status: claim.status,
          reviewedBy: claim.reviewedBy,
          reviewedAt: formatDateTime(claim.reviewedAt),
          note: claim.reviewNote,
        }
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Admin', href: '/admin' },
              { label: 'Verification queue', href: '/admin/verification' },
              { label: claim.claimedName },
            ]}
          />
        }
        eyebrow={`Claim ${claim.id}`}
        title={claim.claimedName}
        description={`Submitted ${formatRelative(claim.submittedAt)} — ${formatDateTime(claim.submittedAt)}. Decide against the register, field by field.`}
        actions={
          <>
            <ButtonLink href={`/admin/degree-register?q=${encodeURIComponent(claim.claimedRoll)}`} variant="secondary">
              <FileSearch className="size-4" aria-hidden="true" />
              Search the register
            </ButtonLink>
            <ButtonLink href="/admin/verification" variant="ghost">
              Back to the queue
            </ButtonLink>
          </>
        }
      />

      {scopedTo ? (
        <p className="text-xs text-muted">
          <ShieldCheck className="mr-1 inline size-3.5 align-[-2px]" aria-hidden="true" />
          You are reviewing within {scopedTo}. Claims outside your branch are not addressable from this console.
        </p>
      ) : null}

      {anyTwins ? (
        <Alert
          tone="warning"
          title="Two register rows carry this name in the same branch and year"
          icon={<ArrowLeftRight className="size-4" />}
        >
          <p>
            Name, branch and year of passing cannot separate these people — in a CSE cohort of 240 this is not rare. The
            fields that <em>do</em> separate them are the roll number, the admission year encoded in it, and the source
            file the row came from. Those three are marked below. If none of them settles it, ask the applicant for
            their memorandum of marks rather than guessing.
          </p>
        </Alert>
      ) : ambiguous ? (
        <Alert tone="warning" title="The matcher cannot choose between two rows" icon={<AlertTriangle className="size-4" />}>
          <p>
            The top two candidates are within {Math.round(gap * 100)} points of each other, which is inside the
            ambiguity guard of 15. That is why this claim is in front of a person instead of being approved
            automatically.
          </p>
        </Alert>
      ) : null}

      <div className="grid items-start gap-gutter lg:grid-cols-[21rem_minmax(0,1fr)]">
        {/* ---- What the applicant submitted ---- */}
        <Card className="lg:sticky lg:top-4">
          <CardHeader>
            <div className="space-y-1">
              <CardTitle as="h2">What the applicant submitted</CardTitle>
              <CardDescription>Typed by the person registering. None of it is evidence on its own.</CardDescription>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <dl className="divide-y divide-line">
              <DetailRow label="Name">{claim.claimedName}</DetailRow>
              <DetailRow label="Roll number">
                <span className="font-mono">{claim.claimedRoll}</span>
              </DetailRow>
              <DetailRow label="Branch">
                {claim.claimedDepartmentCode ?? '—'}
                {claim.claimedDepartmentCode ? (
                  <span className="block text-xs font-normal text-secondary">
                    {departments.find((d) => d.code === claim.claimedDepartmentCode)?.name ?? 'Unknown branch code'}
                  </span>
                ) : null}
              </DetailRow>
              <DetailRow label="Year of passing">
                <span className="tabular">{claim.claimedBatchYear ?? '—'}</span>
              </DetailRow>
              <DetailRow label="Email">
                <span className="break-all">{claim.email}</span>
                <span className="block text-xs font-normal text-secondary">
                  The login credential. Verified by OTP before this claim was created.
                </span>
              </DetailRow>
              <DetailRow label="Mobile">
                {claim.mobile ? (
                  <>
                    <span className="font-mono">{claim.mobile}</span>
                    <span className="block text-xs font-normal text-secondary">
                      Used for WhatsApp and recovery. Never a login credential.
                    </span>
                  </>
                ) : (
                  <span className="text-secondary">Not given</span>
                )}
              </DetailRow>
              <DetailRow label="Submitted">
                <span className="tabular">{formatDate(claim.submittedAt)}</span>
                <span className="block text-xs font-normal text-secondary">{formatRelative(claim.submittedAt)}</span>
              </DetailRow>
            </dl>

            <Alert tone="neutral">
              <p className="text-xs">
                Registration collects the name, roll number, branch and year of passing. It does not ask for the
                programme or the admission year — the admission year below is read out of the roll number itself.
              </p>
            </Alert>
          </CardBody>
        </Card>

        {/* ---- Candidate register rows ---- */}
        <div className="space-y-gutter">
          {ranked.length === 0 ? (
            <Card>
              <CardBody className="space-y-4">
                <Alert
                  tone="danger"
                  title="No register row matches this claim"
                  icon={<CircleSlash className="size-4" />}
                >
                  <p>
                    Nothing in <span className="font-mono">degree_register</span> carries roll number{' '}
                    <span className="font-mono">{claim.claimedRoll}</span>, and no row within two years of{' '}
                    {claim.claimedBatchYear ?? 'the claimed batch'} carries this name in{' '}
                    {claim.claimedDepartmentCode ?? 'this branch'}.
                  </p>
                </Alert>

                <div className="space-y-2 text-sm">
                  <p className="font-medium">There are exactly two honest explanations, and they need different actions.</p>
                  <ol className="list-decimal space-y-2 pl-5 text-secondary">
                    <li>
                      <span className="font-medium text-primary">The batch file has not been loaded.</span> The register
                      is built from files the examinations branch sends, one per year and branch. If{' '}
                      <span className="font-mono">
                        DIET_{claim.claimedBatchYear ?? 'YYYY'}_{claim.claimedDepartmentCode ?? 'BRANCH'}.csv
                      </span>{' '}
                      is not in the import history, the applicant is not at fault — chase the file, and leave the claim
                      queued.
                    </li>
                    <li>
                      <span className="font-medium text-primary">The roll number is wrong.</span> Ask for the memorandum
                      of marks. A roll typed from memory eight years after graduating is wrong more often than anyone
                      expects.
                    </li>
                  </ol>
                  <p className="text-secondary">
                    Approving with neither resolved puts an unverified person into the alumni directory. That is the one
                    outcome this queue exists to prevent.
                  </p>
                </div>

                <RegisterSweep
                  batchLabel={batchLabel}
                  batchTotal={batch.total}
                  claimedName={claim.claimedName}
                  lookAlikes={lookAlikes}
                />

                <div className="flex flex-wrap gap-2">
                  <ButtonLink href="/admin/imports" variant="secondary" size="sm">
                    Check the import history
                  </ButtonLink>
                  <ButtonLink
                    href={`/admin/degree-register?q=${encodeURIComponent(claim.claimedName.split(' ')[0] ?? '')}&year=${claim.claimedBatchYear ?? ''}`}
                    variant="secondary"
                    size="sm"
                  >
                    <ScanSearch className="size-4" aria-hidden="true" />
                    Look for the name by hand
                  </ButtonLink>
                </div>
              </CardBody>
            </Card>
          ) : (
            ranked.map((candidate, index) => {
              const twins = twinsByCandidate.get(candidate.record.id) ?? [];
              const contested = homonymInQueue || ambiguous || twins.length > 0;
              const rows = compare(claim, candidate.record, contested);
              const pct = Math.round(candidate.confidence * 100);
              const tone =
                candidate.confidence >= AUTO_APPROVE_AT
                  ? 'success'
                  : candidate.confidence >= REVIEW_AT
                    ? 'warning'
                    : 'danger';

              return (
                <Card key={candidate.record.id}>
                  <CardHeader>
                    <div className="min-w-0 space-y-1">
                      <CardTitle as="h2">
                        {index === 0 ? 'Best candidate' : `Candidate ${index + 1}`}
                        <span className="ml-2 font-mono text-sm font-normal text-secondary">
                          {candidate.record.rollNumber}
                        </span>
                      </CardTitle>
                      <CardDescription>
                        {candidate.record.name} · {candidate.record.departmentCode ?? 'branch not recorded'} · passed{' '}
                        {candidate.record.yearOfPassing ?? '—'}
                      </CardDescription>
                    </div>
                    <div className="w-40 shrink-0 space-y-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs text-secondary">Confidence</span>
                        <span className="font-display text-lg font-bold tabular">{pct}%</span>
                      </div>
                      <Progress value={pct} tone={tone} label={`Match confidence ${pct} per cent`} />
                      <p className="text-right text-xs text-muted">
                        {candidate.confidence >= AUTO_APPROVE_AT
                          ? 'above the auto-approve line'
                          : candidate.confidence >= REVIEW_AT
                            ? 'in the review band'
                            : 'below the review line'}
                      </p>
                    </div>
                  </CardHeader>

                  <CardBody className="space-y-5">
                    {/* Field-by-field, claim on the left, register on the right. */}
                    <TableWrap
                      caption={`Field by field comparison of the claim against register row ${candidate.record.rollNumber}`}
                    >
                      <table className="w-full border-collapse text-sm">
                        <caption className="sr-only">
                          Field by field comparison of the claim against register row {candidate.record.rollNumber}
                        </caption>
                        <thead className="border-b border-line bg-surface-sunken">
                          <tr>
                            <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-secondary">
                              Field
                            </th>
                            <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-secondary">
                              Applicant said
                            </th>
                            <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-secondary">
                              Degree register
                            </th>
                            <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-secondary">
                              Verdict
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {rows.map((r) => (
                            <tr
                              key={r.field}
                              className={r.discriminating ? 'bg-[color-mix(in_srgb,var(--warning)_9%,transparent)]' : undefined}
                            >
                              <th scope="row" className="whitespace-nowrap px-3 py-3 text-left align-top text-sm font-medium">
                                {r.field}
                                {r.discriminating ? (
                                  <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-warning-fg">
                                    Discriminating
                                  </span>
                                ) : null}
                              </th>
                              <td className="px-3 py-3 align-top">
                                <span className={r.field === 'Roll number' ? 'font-mono' : undefined}>{r.claimed}</span>
                              </td>
                              <td className="px-3 py-3 align-top">
                                <span className={r.field === 'Roll number' || r.field === 'Source file' ? 'font-mono' : undefined}>
                                  {r.register}
                                </span>
                                {r.note ? <span className="mt-1 block text-xs text-secondary">{r.note}</span> : null}
                              </td>
                              <td className="px-3 py-3 align-top">
                                <VerdictBadge verdict={r.verdict} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </TableWrap>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                        Why the matcher surfaced this row
                      </p>
                      <ul className="flex flex-wrap gap-2">
                        {candidate.reasons.map((r) => (
                          <li key={r}>
                            <Badge tone={reasonTone(r)}>{reasonLabel(r)}</Badge>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {twins.length > 0 ? (
                      <div className="space-y-2 rounded-lg border border-line bg-surface p-4">
                        <Separator
                          label={`Also in ${candidate.record.departmentCode ?? 'this branch'} ${candidate.record.yearOfPassing ?? ''}: ${twins.length} row${twins.length === 1 ? '' : 's'} that could be the same person`}
                        />
                        <p className="text-xs text-secondary">
                          Same branch, same year of passing, and a name that is this one spelled differently — the
                          register prints initials in one file and full middle names in the next. The matcher did not
                          surface these, because a reviewer choosing between two people should see every row that could
                          be them, not only the ones that scored.
                        </p>
                        <ul className="space-y-2">
                          {twins.map((t) => (
                            <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                              <span className="font-mono font-medium">{t.rollNumber}</span>
                              <span className="min-w-0 flex-1 truncate">{t.name}</span>
                              <span className="text-xs text-secondary">
                                admitted {t.admissionYear ?? '—'} ·{' '}
                                <span className="font-mono">{t.sourceFile ?? 'source unknown'}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </CardBody>
                </Card>
              );
            })
          )}

          {ranked.length > 0 && lookAlikes.length > 0 ? (
            <Card>
              <CardBody>
                <RegisterSweep
                  batchLabel={batchLabel}
                  batchTotal={batch.total}
                  claimedName={claim.claimedName}
                  lookAlikes={lookAlikes}
                />
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      <Section>
        <ReviewActions
          claimId={claim.id}
          claimName={claim.claimedName}
          claimRoll={claim.claimedRoll}
          claimEmail={claim.email}
          claimMobile={claim.mobile}
          candidates={reviewCandidates}
          reviewerName={member?.fullName ?? 'You'}
          canOverride={can(session, 'verification.override')}
          decided={decided}
        />
      </Section>
    </div>
  );
}
