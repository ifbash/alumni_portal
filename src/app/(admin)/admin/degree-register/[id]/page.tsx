import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { MessageCircle } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { canOpen } from '@/lib/navigation';
import {
  getDegreeRegisterStats,
  getDepartments,
  getMembersForAdmin,
  getVerificationClaims,
  searchDegreeRegister,
} from '@/lib/data/repo';
import type { DegreeRecord } from '@/lib/data/types';
import { nameTokens, normaliseRoll } from '@/lib/verification/matcher';
import { formatDate, formatNumber, formatPercent, memberLine } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DetailRow,
} from '@/components/ui';
import {
  COVERAGE_CLASS,
  coverageTone,
  evidenceWords,
  methodLabel,
  sourceFileLabel,
} from '../../_shared/verification-labels';

/**
 * One row of the degree register.
 *
 * Deliberately not a person page. A register row is a statement by the
 * examinations branch that a roll number was awarded a degree, and its
 * identity is the roll number rather than the name printed beside it. The
 * member record, if one exists, lives elsewhere and links from here.
 *
 * The near matches are the working part: the rows that could be confused
 * with this one, each with the reason it is listed.
 */

export const metadata = { title: 'Register row · Staff console' };

interface NearMatch {
  record: DegreeRecord;
  why: string;
}

// ---------------------------------------------------------------
// Page
// ---------------------------------------------------------------

export default async function RegisterRowPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  // The whole register, not one branch of it. An HOD holding only
  // `verification.review.department` decides claims inside their branch;
  // reading the register itself is the wider grant.
  requireCap(session, 'verification.review.any');

  const { id } = await params;

  const register = searchDegreeRegister('', { perPage: 100000 });
  const record =
    register.items.find((r) => r.id === id) ??
    register.items.find((r) => normaliseRoll(r.rollNumber) === normaliseRoll(id)) ??
    null;
  if (!record) notFound();

  const resolved = await getTenantBrand();
  if (!resolved) redirect('/login');
  const pack = resolved.brand.pack;
  const fmt = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };
  const openMembers = canOpen(session, pack, '/admin/members');
  const openQueue = canOpen(session, pack, '/admin/verification');

  const departments = getDepartments();
  const branchName = record.departmentCode
    ? (departments.find((d) => d.code === record.departmentCode)?.name ?? record.departmentCode)
    : null;

  // Which register rows have an account against them, built from the member
  // table by roll number. Only the id and the name are kept.
  const accounts = new Map<string, { id: string; fullName: string; verifiedAt: string | null; verificationMethod: string | null }>();
  for (const m of getMembersForAdmin({ perPage: 100000 }).items) {
    if (m.rollNumber && !accounts.has(normaliseRoll(m.rollNumber))) {
      accounts.set(normaliseRoll(m.rollNumber), {
        id: m.id,
        fullName: m.fullName,
        verifiedAt: m.verifiedAt,
        verificationMethod: m.verificationMethod,
      });
    }
  }
  const claimant = accounts.get(normaliseRoll(record.rollNumber)) ?? null;

  // The registration this row was decided against, and the matcher's score
  // for this specific row rather than for the claim's best candidate.
  const claim = getVerificationClaims(session, { status: 'all' }).find(
    (c) => normaliseRoll(c.claimedRoll) === normaliseRoll(record.rollNumber),
  );
  const scored = claim?.candidates.find((c) => c.record.id === record.id) ?? null;

  const stats = getDegreeRegisterStats();
  const batch = record.yearOfPassing ? stats.byYear.find((y) => y.year === record.yearOfPassing) : undefined;

  // ---- Near matches -------------------------------------------------
  //
  // Two questions, answered in one list with the reason on each row. A
  // similar name is a candidate for "the same person spelled twice"; an
  // adjacent roll number is a candidate for "somebody typed one digit
  // wrong", and usually carries a completely different name.

  const mine = new Set(nameTokens(record.name));
  const longestToken = [...mine].sort((a, b) => b.length - a.length)[0] ?? '';

  const nameMatches: NearMatch[] =
    longestToken.length >= 3
      ? searchDegreeRegister(longestToken, { perPage: 600 })
          .items.map((r) => {
            if (r.id === record.id) return null;
            const theirs = new Set(nameTokens(r.name));
            const shared = [...mine].filter((t) => theirs.has(t)).length;
            if (shared < 2) return null;
            const subset = shared === Math.min(mine.size, theirs.size);
            return { record: r, why: subset ? 'Same name, written differently' : 'Similar name', shared };
          })
          .filter((x): x is NearMatch & { shared: number } => x !== null)
          .sort((a, b) => b.shared - a.shared || a.record.rollNumber.localeCompare(b.record.rollNumber))
          .slice(0, 6)
      : [];

  const roll = normaliseRoll(record.rollNumber);
  const serialMatch = /^(.*?)(\d{2})$/.exec(roll);
  const prefix = serialMatch?.[1] ?? '';
  const serial = serialMatch ? Number(serialMatch[2]) : null;

  const rollMatches: NearMatch[] =
    prefix.length >= 4 && serial !== null
      ? searchDegreeRegister(prefix, { perPage: 600 })
          .items.map((r) => {
            if (r.id === record.id) return null;
            const other = normaliseRoll(r.rollNumber);
            const m = /^(.*?)(\d{2})$/.exec(other);
            if (!m || m[1] !== prefix) return null;
            const gap = Math.abs(Number(m[2]) - serial);
            if (gap === 0 || gap > 3) return null;
            return { record: r, why: gap === 1 ? 'Next roll number' : `${gap} roll numbers away`, gap };
          })
          .filter((x): x is NearMatch & { gap: number } => x !== null)
          .sort((a, b) => a.gap - b.gap)
          .slice(0, 6)
      : [];

  const nearMatches = [...nameMatches, ...rollMatches];

  const inviteHref = `/admin/comms/new?cohort=alumni${record.departmentCode ? `&department=${record.departmentCode}` : ''}${
    record.yearOfPassing ? `&batchFrom=${record.yearOfPassing}&batchTo=${record.yearOfPassing}` : ''
  }`;
  const canWriteBatch = can(session, 'comms.send.segment') || can(session, 'comms.send.all');

  const years =
    record.admissionYear && record.yearOfPassing
      ? `${record.admissionYear}–${record.yearOfPassing}`
      : record.yearOfPassing
        ? `passed ${record.yearOfPassing}`
        : null;
  const batchName = memberLine([record.yearOfPassing, record.departmentCode]).replace(' · ', ' ');

  const pct = batch && batch.total ? batch.claimed / batch.total : 0;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Breadcrumbs
          items={[
            { label: 'Staff console', href: '/admin' },
            { label: 'Degree register', href: '/admin/degree-register' },
            { label: record.rollNumber },
          ]}
        />
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 space-y-1.5">
            <p className="font-mono text-sm font-semibold text-brand-fg">{record.rollNumber}</p>
            <h1 className="font-display text-display-xs font-bold">{record.name}</h1>
            <p className="text-sm text-secondary">{memberLine([branchName, record.programme, years])}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {claimant ? (
                <Badge tone="success">
                  Joined as{' '}
                  {openMembers ? (
                    <Link href={`/admin/members/${claimant.id}`} className="underline underline-offset-2">
                      {claimant.fullName}
                    </Link>
                  ) : (
                    claimant.fullName
                  )}
                </Badge>
              ) : (
                <Badge tone="neutral">Not joined yet</Badge>
              )}
            </div>
          </div>
          {canWriteBatch && record.yearOfPassing ? (
            <ButtonLink href={inviteHref} variant={claimant ? 'secondary' : 'primary'}>
              <MessageCircle className="size-4" aria-hidden="true" />
              Write to the {batchName} batch
            </ButtonLink>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-gutter lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="min-w-0 space-y-6">
          {/* How it was claimed */}
          {claimant ? (
            <Card>
              <CardHeader variant="stack">
                <CardTitle as="h2" className="text-md">
                  How {claimant.fullName} joined
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-4 pt-3">
                <dl className="divide-y divide-line">
                  <DetailRow label="Verified">
                    {claimant.verifiedAt ? (
                      <span>
                        {methodLabel(claimant.verificationMethod) ?? 'Verified'} on{' '}
                        <span className="tabular">{formatDate(claimant.verifiedAt, fmt)}</span>
                      </span>
                    ) : (
                      <span className="font-normal text-secondary">No verification date on the account</span>
                    )}
                  </DetailRow>
                  <DetailRow label="Match score">
                    {scored ? (
                      <span className="tabular">
                        {evidenceWords(scored.confidence)} · {Math.round(scored.confidence * 100)}%
                      </span>
                    ) : (
                      <span className="font-normal text-secondary">No score</span>
                    )}
                  </DetailRow>
                  <DetailRow label="Reviewed by">
                    {claim?.reviewedBy ? (
                      <span>
                        {claim.reviewedBy}
                        {claim.reviewedAt ? (
                          <span className="ml-2 font-normal text-secondary">{formatDate(claim.reviewedAt, fmt)}</span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="font-normal text-secondary">Nobody on record</span>
                    )}
                  </DetailRow>
                  {claimant.fullName.toLowerCase() !== record.name.toLowerCase() ? (
                    <DetailRow label="Name on the account">{claimant.fullName}</DetailRow>
                  ) : null}
                </dl>
                <div className="flex flex-wrap gap-2">
                  {openMembers ? (
                    <ButtonLink href={`/admin/members/${claimant.id}`} variant="secondary" size="sm" className="min-h-11 sm:min-h-0">
                      Open the member record
                    </ButtonLink>
                  ) : null}
                  {claim && openQueue ? (
                    <ButtonLink href={`/admin/verification/${claim.id}`} variant="ghost" size="sm" className="min-h-11 sm:min-h-0">
                      The registration it was decided on
                    </ButtonLink>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          ) : null}

          {/* Near matches */}
          <Card>
            <CardHeader variant="stack">
              <CardTitle as="h2" className="text-md">
                Near matches
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-3">
              {nearMatches.length === 0 ? (
                <p className="text-sm text-secondary">
                  No other row shares this name or sits within three roll numbers of it.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {nearMatches.map(({ record: r, why }) => {
                    const account = accounts.get(normaliseRoll(r.rollNumber));
                    return (
                      <li key={`${r.id}-${why}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                        <Link
                          href={`/admin/degree-register/${r.id}`}
                          className="inline-flex min-h-11 items-center font-mono font-medium link-quiet sm:min-h-0"
                        >
                          {r.rollNumber}
                        </Link>
                        <span className="min-w-0 flex-1 basis-40">
                          {r.name}
                          <span className="block text-xs text-secondary">
                            {memberLine([r.departmentCode, r.yearOfPassing])} ·{' '}
                            {account ? `joined as ${account.fullName}` : 'not joined yet'}
                          </span>
                        </span>
                        <Badge tone={why.startsWith('Same') || why.startsWith('Similar') ? 'accent' : 'neutral'}>
                          {why}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          <p className="text-sm text-secondary">
            Read-only. Corrections come in a new file from the examinations branch. This row came from{' '}
            {sourceFileLabel(record.sourceFile)}.
          </p>
        </div>

        {/* Aside */}
        <aside aria-label="The batch" className="min-w-0">
          {batch ? (
            <Card>
              <CardHeader variant="stack">
                <CardTitle as="h2" className="text-md">
                  The {record.yearOfPassing} batch
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-3 pt-3">
                {/* The percentage is the point; the tint repeats it, never replaces it. */}
                <div className={cn('flex items-end justify-between gap-3 rounded-lg p-3', COVERAGE_CLASS[coverageTone(pct)])}>
                  <p className="font-display text-display-xs font-bold leading-none tabular">{formatPercent(pct)}</p>
                  <p className="text-sm tabular">
                    {formatNumber(batch.claimed)} of {formatNumber(batch.total)} joined
                  </p>
                </div>
                <p className="text-xs text-secondary">Across the whole register it is {formatPercent(stats.coverage)}.</p>
                <ButtonLink
                  href={`/admin/degree-register?year=${record.yearOfPassing}`}
                  variant="secondary"
                  size="sm"
                  className="min-h-11 w-full sm:min-h-0"
                >
                  Open the {record.yearOfPassing} rows
                </ButtonLink>
              </CardBody>
            </Card>
          ) : (
            <p className="text-sm text-secondary">This row has no year of passing, so it belongs to no batch.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
