import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeftRight,
  BadgeCheck,
  FileSearch,
  Landmark,
  MessageCircle,
  ScanSearch,
  ScrollText,
  UserPlus,
  UserX,
} from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import {
  getDegreeRegisterStats,
  getDepartments,
  getMembersForAdmin,
  getVerificationClaims,
  searchDegreeRegister,
} from '@/lib/data/repo';
import type { DegreeRecord } from '@/lib/data/types';
import { nameTokens, normaliseRoll } from '@/lib/verification/matcher';
import { formatDate, formatNumber, formatPercent, formatRelative, memberLine } from '@/lib/format';
import {
  Alert,
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  DefinitionCard,
  DetailRow,
  PageHeader,
  Progress,
  Separator,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';

/**
 * One row of the degree register.
 *
 * Deliberately not a person page. A register row is a statement by the
 * examinations branch that a roll number was awarded a degree, and its
 * identity is the roll number rather than the name printed beside it —
 * names are typed by hand from mark sheets and vary between files, roll
 * numbers do not. The member record, if one exists, lives elsewhere and
 * links from here.
 *
 * The near-matches section is the working part. An approver deciding
 * whether two rows are one person needs the rows that could be confused
 * with this one in front of them, not a second tab and a search box.
 */

export const metadata = { title: 'Register row' };

const VERIFICATION_METHOD: Record<string, string> = {
  auto_roll_match: 'Automatic — the roll number matched this row exactly',
  admin_manual: 'Manual — approved by the alumni cell against evidence supplied',
  bulk_import: 'Bulk import — loaded from a batch file, not self-registered',
  placement_cell_import: 'Placement cell import — current student roll list',
};

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

  const departments = getDepartments();
  const branchName = record.departmentCode
    ? (departments.find((d) => d.code === record.departmentCode)?.name ?? record.departmentCode)
    : null;

  // Which register rows have an account against them, built from the member
  // table by roll number. "Does an account exist" is the question, not "did
  // somebody remember to tick a claimed flag".
  const members = getMembersForAdmin({ perPage: 100000 }).items;
  const accounts = new Map(
    members.filter((m) => m.rollNumber).map((m) => [normaliseRoll(m.rollNumber!), m]),
  );
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
  // Two separate questions, deliberately not merged into one list. A row
  // with a similar name is a candidate for "these are the same person
  // spelled twice". A row with an adjacent roll number is a candidate for
  // "somebody typed one digit wrong", and it usually carries a completely
  // different name.

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
            return {
              record: r,
              why: subset
                ? 'Every name token this row has is also on that one — the same name written to a different convention'
                : `${shared} name tokens in common`,
              shared,
            };
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
            return {
              record: r,
              why: gap === 1 ? 'The next serial in the same block' : `${gap} serials away in the same block`,
              gap,
            };
          })
          .filter((x): x is NearMatch & { gap: number } => x !== null)
          .sort((a, b) => a.gap - b.gap)
          .slice(0, 6)
      : [];

  const claimedOf = (r: DegreeRecord) => accounts.get(normaliseRoll(r.rollNumber)) ?? null;

  const inviteHref = `/admin/comms/new?cohort=alumni${record.departmentCode ? `&department=${record.departmentCode}` : ''}${
    record.yearOfPassing ? `&batchFrom=${record.yearOfPassing}&batchTo=${record.yearOfPassing}` : ''
  }`;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Console', href: '/admin' },
              { label: 'Degree register', href: '/admin/degree-register' },
              { label: record.rollNumber },
            ]}
          />
        }
        eyebrow="Degree register row"
        title={<span className="font-mono">{record.rollNumber}</span>}
        description={`Recorded as “${record.name}”. ${memberLine([
          branchName,
          record.programme,
          record.yearOfPassing ? `passed ${record.yearOfPassing}` : null,
        ])}. Loaded from the examinations branch — this row is the evidence every alumni account in that batch is verified against.`}
        actions={
          <>
            <ButtonLink
              href={`/admin/degree-register?q=${encodeURIComponent(record.rollNumber)}`}
              variant="secondary"
            >
              <FileSearch className="size-4" aria-hidden="true" />
              Search the register
            </ButtonLink>
            <ButtonLink href="/admin/degree-register" variant="ghost">
              Back to the register
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]">
        {/* ---------------------------------------------------------------
            Main column
           --------------------------------------------------------------- */}
        <div className="space-y-6">
          {/* The row itself */}
          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h2">The row as loaded</CardTitle>
              <CardDescription>
                Exactly the seven fields the examinations branch supplies. Nothing on this record is entered in the
                portal, and nothing in the portal writes back to it.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-4 pt-4">
              <dl className="divide-y divide-line">
                <DetailRow label="Roll number">
                  <span className="font-mono">{record.rollNumber}</span>
                </DetailRow>
                <DetailRow label="Name as recorded">
                  {record.name}
                  {claimant && claimant.fullName !== record.name ? (
                    <span className="mt-0.5 block text-xs font-normal text-secondary">
                      The account under this roll is held as &ldquo;{claimant.fullName}&rdquo;.
                    </span>
                  ) : null}
                </DetailRow>
                <DetailRow label="Branch">
                  {record.departmentCode ? (
                    <span>
                      <span className="font-medium">{record.departmentCode}</span>
                      <span className="mt-0.5 block text-xs font-normal text-secondary">
                        {branchName ?? 'Branch code not in the department list'}
                      </span>
                    </span>
                  ) : (
                    <span className="font-normal text-muted">Not recorded on the row</span>
                  )}
                </DetailRow>
                <DetailRow label="Programme">
                  {record.programme ?? <span className="font-normal text-muted">Not recorded on the row</span>}
                </DetailRow>
                <DetailRow label="Admission year">
                  <span className="tabular">{record.admissionYear ?? '—'}</span>
                </DetailRow>
                <DetailRow label="Year of passing">
                  <span className="tabular">{record.yearOfPassing ?? '—'}</span>
                </DetailRow>
                <DetailRow label="Source file">
                  <span className="font-mono text-xs">{record.sourceFile ?? 'unknown'}</span>
                  <span className="mt-0.5 block text-xs font-normal text-secondary">
                    Which file this row arrived in. Two rows from two files are two statements by the college, and that
                    is worth knowing when they disagree.
                  </span>
                </DetailRow>
                <DetailRow label="Register row id">
                  <span className="font-mono text-xs text-secondary">{record.id}</span>
                </DetailRow>
              </dl>

              <Alert tone="info" icon={<ScrollText className="size-4" />}>
                <p>
                  Register spellings follow the memorandum of marks — surname first in some files, initials expanded in
                  others, the whole name in capitals in a third. A name here that does not look like the one a graduate
                  writes on a form is normal and is not a data error. The roll number is the field that carries the
                  match.
                </p>
              </Alert>
            </CardBody>
          </Card>

          {/* Claim state */}
          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">Claim state</CardTitle>
                <CardDescription>
                  Whether a portal account has been bound to this row, and on what evidence.
                </CardDescription>
              </div>
              {claimant ? (
                <Badge tone="success" dot>
                  Claimed
                </Badge>
              ) : (
                <Badge tone="neutral" dot>
                  Not signed up
                </Badge>
              )}
            </CardHeader>

            <CardBody className="space-y-5 pt-4">
              {claimant ? (
                <>
                  <dl className="divide-y divide-line">
                    <DetailRow label="Claimed by">
                      <Link href={`/admin/members/${claimant.id}`} className="link-quiet font-medium">
                        {claimant.fullName}
                      </Link>
                      <span className="mt-0.5 block text-xs font-normal text-secondary">
                        {memberLine([
                          claimant.departmentCode,
                          claimant.batchYear ? `Batch of ${claimant.batchYear}` : null,
                          claimant.currentCompany,
                        ]) || 'No profile detail on the account yet'}
                      </span>
                    </DetailRow>
                    <DetailRow label="Verified on">
                      {claimant.verifiedAt ? (
                        <span>
                          <span className="tabular">{formatDate(claimant.verifiedAt)}</span>
                          <span className="ml-2 font-normal text-muted">
                            ({formatRelative(claimant.verifiedAt)})
                          </span>
                        </span>
                      ) : (
                        <span className="font-normal text-muted">
                          Account exists against this roll but carries no verification date
                        </span>
                      )}
                    </DetailRow>
                    <DetailRow label="Method">
                      {claimant.verificationMethod ? (
                        <span>
                          <span className="font-mono text-xs">{claimant.verificationMethod}</span>
                          <span className="mt-0.5 block text-xs font-normal text-secondary">
                            {VERIFICATION_METHOD[claimant.verificationMethod] ?? 'Method not documented.'}
                          </span>
                        </span>
                      ) : (
                        <span className="font-normal text-muted">Not recorded</span>
                      )}
                    </DetailRow>
                    <DetailRow label="Confidence">
                      {scored ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="tabular">{formatPercent(scored.confidence, 1)}</span>
                          <Badge tone={scored.confidence >= 0.9 ? 'success' : 'warning'}>
                            {scored.confidence >= 0.9 ? 'Auto-approve band' : 'Review band'}
                          </Badge>
                        </span>
                      ) : (
                        <span className="font-normal text-muted">
                          No scored claim is held against this row. Accounts loaded in bulk, or approved before the
                          matcher existed, carry no score — the binding is still recorded, the arithmetic behind it is
                          not.
                        </span>
                      )}
                    </DetailRow>
                    <DetailRow label="Reviewed by">
                      {claim?.reviewedBy ? (
                        <span>
                          {claim.reviewedBy}
                          {claim.reviewedAt ? (
                            <span className="ml-2 font-normal text-muted">{formatDate(claim.reviewedAt)}</span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="font-normal text-muted">No reviewer recorded against this roll</span>
                      )}
                    </DetailRow>
                  </dl>

                  {scored?.reasons.length ? (
                    <div className="rounded-lg border border-line bg-surface-sunken p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">
                        What the matcher found
                      </p>
                      <ul className="space-y-1.5 text-sm text-secondary">
                        {scored.reasons.map((r) => (
                          <li key={r} className="flex gap-2">
                            <span aria-hidden="true" className="text-brand-fg">
                              ·
                            </span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <ButtonLink href={`/admin/members/${claimant.id}`} variant="secondary" size="sm">
                      <BadgeCheck className="size-4" aria-hidden="true" />
                      Open the member record
                    </ButtonLink>
                    {claim ? (
                      <ButtonLink href={`/admin/verification/${claim.id}`} variant="ghost" size="sm">
                        <ScanSearch className="size-4" aria-hidden="true" />
                        The claim it was decided on
                      </ButtonLink>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <div className="max-w-prose space-y-3 text-sm text-secondary">
                    <p>
                      <span className="font-semibold text-primary">
                        No account has been bound to this row, and that is not an error.
                      </span>{' '}
                      It means a graduate of{' '}
                      {memberLine([record.departmentCode, record.yearOfPassing ? String(record.yearOfPassing) : null]) ||
                        'this batch'}{' '}
                      has not signed up. Most of the register looks like this — {formatNumber(stats.unclaimed)} of{' '}
                      {formatNumber(stats.total)} rows have nobody against them today.
                    </p>
                    <p>
                      That figure is the number the alumni cell exists to move, and it is the reason nothing here is
                      ever deleted to make coverage look better. A row with no account is a person the college has not
                      reached yet, recorded so that the day they do sign up there is something to check them against.
                    </p>
                  </div>

                  <Separator label="How this row gets claimed" />

                  <div className="space-y-3 text-sm">
                    <p className="text-secondary">
                      The register carries a roll number, a name, a branch and two years. It carries no email address
                      and no mobile number, so there is nothing on this row to write to. Every route below goes through
                      somebody who already has the person&rsquo;s number.
                    </p>
                    <ol className="list-decimal space-y-2 pl-5 text-secondary">
                      <li>
                        <span className="font-medium text-primary">They register themselves.</span> A graduate signing
                        up types this roll number, the matcher scores the claim against this exact row, and anything
                        above the auto-approve line binds without a human. That is the path that scales, and everything
                        else exists to start it.
                      </li>
                      <li>
                        <span className="font-medium text-primary">The batch passes it on.</span> Write to the
                        graduates of this batch who <em>have</em> signed up and ask them to put the link in the batch
                        WhatsApp group. One coordinator with a group of ninety is worth more than any mail the college
                        can send.
                      </li>
                      <li>
                        <span className="font-medium text-primary">The college finds an address.</span> The
                        examinations and placement records from the year of admission usually hold a mobile number. It
                        will often be stale — a number from eight years ago is a coin toss — which is exactly why the
                        first two routes come before this one.
                      </li>
                    </ol>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {can(session, 'comms.send.segment') || can(session, 'comms.send.all') ? (
                      <ButtonLink href={inviteHref} variant="secondary" size="sm">
                        <MessageCircle className="size-4" aria-hidden="true" />
                        Write to this batch
                      </ButtonLink>
                    ) : null}
                    <ButtonLink
                      href={`/admin/degree-register?${new URLSearchParams({
                        ...(record.departmentCode ? { department: record.departmentCode } : {}),
                        ...(record.yearOfPassing ? { year: String(record.yearOfPassing) } : {}),
                      }).toString()}`}
                      variant="ghost"
                      size="sm"
                    >
                      <UserX className="size-4" aria-hidden="true" />
                      The rest of this batch
                    </ButtonLink>
                  </div>
                </>
              )}
            </CardBody>
          </Card>

          {/* Near matches */}
          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h2">Near matches in the register</CardTitle>
              <CardDescription>
                Rows that could be confused with this one. Approving a claim means deciding whether two records are one
                person, and that decision is only as good as the rows put in front of it.
              </CardDescription>
            </CardHeader>

            <CardBody className="space-y-6 pt-4">
              <MatchGroup
                title="Similar name"
                icon={<ArrowLeftRight className="size-4 text-muted" aria-hidden="true" />}
                caption={`Register rows whose name tokens overlap ${record.name}`}
                matches={nameMatches}
                claimedOf={claimedOf}
                empty={
                  longestToken.length >= 3
                    ? `No other row in the register shares two name tokens with “${record.name}”. The name on this row is distinctive across every batch loaded, which makes it evidence in its own right rather than something the roll number has to carry alone.`
                    : 'The name on this row has no token long enough to search on, so a name sweep would return the register. The roll number comparison below is the only one worth reading here.'
                }
                note="Same tokens in a different order, or the same name with a middle name dropped, is the ordinary case: the files are typed by hand and the conventions change between them. Two of these being the same person is common. Two of them being two people in the same branch and year is also common, and only the roll number and the source file separate those two situations."
              />

              <MatchGroup
                title="Adjacent roll number"
                icon={<ScanSearch className="size-4 text-muted" aria-hidden="true" />}
                caption={`Register rows within three serials of ${record.rollNumber}`}
                matches={rollMatches}
                claimedOf={claimedOf}
                empty={
                  prefix.length >= 4
                    ? `Nothing else in the register sits within three serials of ${record.rollNumber}. Either the block is sparse or the neighbouring file has not been loaded.`
                    : 'This roll number does not end in a serial the register can walk, so there is no adjacency to compute.'
                }
                note="A graduate typing their roll from memory eight years on gets the last two digits wrong more often than any other part of it. These are the rows a mistyped claim would have been aimed at — they usually carry a different name entirely, which is what makes them easy to rule out once you can see them."
              />
            </CardBody>
          </Card>
        </div>

        {/* ---------------------------------------------------------------
            Aside
           --------------------------------------------------------------- */}
        <aside className="space-y-6">
          {batch ? (
            <Card>
              <CardHeader className="flex-col items-start gap-1">
                <CardTitle as="h2">
                  {record.yearOfPassing} — the whole batch
                </CardTitle>
                <CardDescription>Where this row sits in its year of passing.</CardDescription>
              </CardHeader>
              <CardBody className="space-y-4 pt-4">
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-secondary">Claimed</span>
                    <span className="font-display text-lg font-bold tabular">
                      {formatNumber(batch.claimed)}/{formatNumber(batch.total)}
                    </span>
                  </div>
                  <Progress
                    value={batch.claimed}
                    max={batch.total || 1}
                    label={`${batch.claimed} of ${batch.total} rows in the ${record.yearOfPassing} batch have a portal account`}
                    tone={
                      batch.total && batch.claimed / batch.total >= 0.5
                        ? 'success'
                        : batch.total && batch.claimed / batch.total >= 0.2
                          ? 'brand'
                          : 'warning'
                    }
                  />
                  <p className="text-xs text-muted">
                    {formatPercent(batch.total ? batch.claimed / batch.total : 0, 0)} of that batch is on the portal ·
                    register-wide it is {formatPercent(stats.coverage, 1)}
                  </p>
                </div>

                <ButtonLink
                  href={`/admin/degree-register?year=${record.yearOfPassing}`}
                  variant="secondary"
                  size="sm"
                  className="w-full"
                >
                  Open the {record.yearOfPassing} rows
                </ButtonLink>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody className="flex gap-3">
                <Landmark className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                <p className="text-sm text-secondary">
                  This row carries no year of passing, so it belongs to no batch the coverage figures can count. A row
                  loaded without a year is a file that needs re-supplying, not a graduate who needs chasing.
                </p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h2">What this row is not</CardTitle>
              <CardDescription>Three things it is regularly mistaken for.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-3 pt-4 text-sm text-secondary">
              <p>
                <span className="font-medium text-primary">It is not a member record.</span> Nothing here is editable
                from the portal. A correction belongs in a re-supplied file from the examinations branch, because the
                moment the register can be edited to match a claim it stops being evidence for anything.
              </p>
              <p>
                <span className="font-medium text-primary">It holds no contact details.</span> Roll number, name,
                branch, programme, two years and the file it came in. There is no address on this row to release, so
                the contact rules that govern member records never come into play here.
              </p>
              <p>
                <span className="font-medium text-primary">It is not deleted when nobody claims it.</span> An unclaimed
                row is the college&rsquo;s own record of a graduate. Removing it would improve the coverage figure and
                destroy the only thing that could verify that person if they signed up next year.
              </p>
              <div className="border-t border-line pt-3">
                <ButtonLink href="/admin/imports" variant="ghost" size="sm" className="w-full">
                  <UserPlus className="size-4" aria-hidden="true" />
                  Import history for {record.sourceFile ?? 'the register'}
                </ButtonLink>
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Near-match group
// ---------------------------------------------------------------

function MatchGroup({
  title,
  icon,
  caption,
  matches,
  claimedOf,
  empty,
  note,
}: {
  title: string;
  icon: ReactNode;
  caption: string;
  matches: NearMatch[];
  claimedOf: (r: DegreeRecord) => { id: string; fullName: string } | null;
  empty: string;
  note: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </h3>
        <span className="text-xs text-muted tabular">
          {matches.length} row{matches.length === 1 ? '' : 's'}
        </span>
      </div>

      {matches.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface p-4 text-sm text-secondary">{empty}</p>
      ) : (
        <>
          <TableWrap caption={caption} className="hidden sm:block">
            <Table>
              <THead>
                <TR>
                  <TH>Roll number</TH>
                  <TH>Name as printed</TH>
                  <TH>Branch</TH>
                  <TH align="right">Passed</TH>
                  <TH>Portal account</TH>
                  <TH>Why it is here</TH>
                </TR>
              </THead>
              <TBody>
                {matches.map(({ record: r, why }) => {
                  const account = claimedOf(r);
                  return (
                    <TR key={r.id} interactive>
                      <TD>
                        <Link href={`/admin/degree-register/${r.id}`} className="link-quiet font-mono font-medium">
                          {r.rollNumber}
                        </Link>
                      </TD>
                      <TD>{r.name}</TD>
                      <TD>
                        <span className="font-medium">{r.departmentCode ?? '—'}</span>
                        <span className="block font-mono text-xs text-muted">{r.sourceFile ?? 'source unknown'}</span>
                      </TD>
                      <TD numeric>{r.yearOfPassing ?? '—'}</TD>
                      <TD>
                        {account ? (
                          <Link href={`/admin/members/${account.id}`} className="link-quiet text-sm">
                            {account.fullName}
                          </Link>
                        ) : (
                          <Badge tone="neutral">Not signed up</Badge>
                        )}
                      </TD>
                      <TD className="min-w-56 text-xs text-secondary">{why}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>

          {/* Below sm a six-column register table is unreadable however it scrolls. */}
          <div className="space-y-3 sm:hidden">
            {matches.map(({ record: r, why }) => {
              const account = claimedOf(r);
              return (
                <DefinitionCard
                  key={r.id}
                  title={<span className="font-mono">{r.rollNumber}</span>}
                  subtitle={r.name}
                  rows={[
                    { label: 'Branch', value: r.departmentCode ?? '—' },
                    { label: 'Passed', value: r.yearOfPassing ?? '—' },
                    {
                      label: 'Account',
                      value: account ? account.fullName : <Badge tone="neutral">Not signed up</Badge>,
                    },
                    {
                      label: 'Why it is here',
                      value: <span className="block text-left font-normal">{why}</span>,
                    },
                  ]}
                  actions={
                    <ButtonLink href={`/admin/degree-register/${r.id}`} variant="secondary" size="sm">
                      Open this row
                    </ButtonLink>
                  }
                />
              );
            })}
          </div>
        </>
      )}

      <p className="max-w-prose text-xs text-secondary">{note}</p>
    </section>
  );
}
