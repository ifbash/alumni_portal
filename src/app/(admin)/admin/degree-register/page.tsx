import { redirect } from 'next/navigation';
import { CalendarX2, FileUp, History, Landmark, ScrollText, Search, UserCheck, UserX } from 'lucide-react';

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
  EmptyState,
  Field,
  Input,
  PageHeader,
  Pagination,
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
} from '@/components/ui';
import { ColumnChart, ProportionBar } from '@/components/charts';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getDegreeRegisterStats, getDepartments, getMembersForAdmin, searchDegreeRegister } from '@/lib/data/repo';
import { formatNumber, formatPercent } from '@/lib/format';

export const metadata = { title: 'Degree register' };

const PER_PAGE = 25;
const CURRENT_YEAR = 2026;

export default async function DegreeRegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  requireCap(session, 'verification.review.any');

  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const q = (first(params.q) ?? '').trim();
  const department = first(params.department) ?? '';
  const yearRaw = first(params.year) ?? '';
  const year = /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : undefined;
  const page = Math.max(1, Number(first(params.page) ?? 1) || 1);

  const departments = getDepartments();
  const stats = getDegreeRegisterStats();
  const results = searchDegreeRegister(q, {
    department: department || undefined,
    year,
    page,
    perPage: PER_PAGE,
  });

  // Which register rows have actually been claimed. Built from the member
  // table by roll number, so the answer is "does an account exist", not a
  // flag someone has to remember to set.
  const accounts = new Map<string, { fullName: string; isStudent: boolean }>();
  for (const m of getMembersForAdmin({ perPage: 5000 }).items) {
    if (m.rollNumber) accounts.set(m.rollNumber.toUpperCase(), { fullName: m.fullName, isStudent: m.isStudent });
  }

  const yearsPresent = new Set(stats.byYear.map((y) => y.year));
  const earliest = stats.byYear[0]?.year ?? CURRENT_YEAR;
  const missingYears: number[] = [];
  for (let y = earliest; y <= CURRENT_YEAR; y++) if (!yearsPresent.has(y)) missingYears.push(y);

  const thinnest = [...stats.byYear]
    .filter((y) => y.total >= 5)
    .sort((a, b) => a.claimed / a.total - b.claimed / b.total)
    .slice(0, 3);

  const buildHref = (nextPage: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (department) sp.set('department', department);
    if (yearRaw) sp.set('year', yearRaw);
    if (nextPage > 1) sp.set('page', String(nextPage));
    const qs = sp.toString();
    return qs ? `/admin/degree-register?${qs}` : '/admin/degree-register';
  };

  const filtered = Boolean(q || department || year);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Identity"
        title="Degree register"
        description="The college's authoritative list of everyone who has graduated. Every alumni account in the portal is verified against a row in here — nothing else counts as evidence."
        actions={
          <>
            <ButtonLink href="/admin/degree-register/upload">
              <FileUp className="size-4" aria-hidden="true" />
              Load a register file
            </ButtonLink>
            <ButtonLink href="/admin/imports" variant="secondary">
              <History className="size-4" aria-hidden="true" />
              Import history
            </ButtonLink>
          </>
        }
      />

      <Alert tone="info" title="Where this comes from, and what an unclaimed row means" icon={<Landmark className="size-4" />}>
        <p>
          The register is loaded from files supplied by the examinations branch — roll number, name, branch, programme
          and year of passing, one file per batch and branch. It exists for every graduate whether or not they have ever
          opened the portal.
        </p>
        <p className="mt-2">
          <span className="font-semibold">
            {formatNumber(stats.unclaimed)} rows have no account against them. Those are not errors and not missing
            data.
          </span>{' '}
          They are graduates who have not signed up yet — the number the alumni cell exists to move. Nothing here should
          be deleted to make the figure look better.
        </p>
      </Alert>

      <div className="grid gap-gutter sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Rows in the register"
          value={formatNumber(stats.total)}
          hint={`${stats.byYear.length} years of passing loaded`}
          icon={<ScrollText className="size-4" />}
        />
        <Stat
          label="Claimed by a member"
          value={formatNumber(stats.claimed)}
          hint="Matched to a portal account"
          icon={<UserCheck className="size-4" />}
        />
        <Stat
          label="Not signed up"
          value={formatNumber(stats.unclaimed)}
          hint="Reachable if the college has an address for them"
          icon={<UserX className="size-4" />}
        />
        <Stat
          label="Coverage"
          value={formatPercent(stats.coverage, 1)}
          hint="Share of graduates on the portal"
          icon={<Landmark className="size-4" />}
        />
      </div>

      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle as="h2">Coverage by year of passing</CardTitle>
              <CardDescription>
                Share of each batch that has claimed its row. Recent batches are always ahead — they were still on
                campus when the portal launched.
              </CardDescription>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <ColumnChart
              label="Coverage by year of passing, per cent of register rows with a portal account"
              data={stats.byYear.map((y) => ({
                label: String(y.year),
                value: y.total ? Math.round((y.claimed / y.total) * 100) : 0,
              }))}
              highlight={String(stats.byYear[stats.byYear.length - 1]?.year ?? '')}
              height={180}
            />

            {thinnest.length > 0 ? (
              <p className="text-sm text-secondary">
                Thinnest batches:{' '}
                {thinnest.map((y, i) => (
                  <span key={y.year}>
                    {i > 0 ? ', ' : ''}
                    <span className="font-semibold text-primary tabular">{y.year}</span> ({y.claimed} of {y.total})
                  </span>
                ))}
                . These are where a WhatsApp campaign earns the most, and where the college is most likely to be holding
                a dead email address.
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle as="h2">What is loaded</CardTitle>
              <CardDescription>Files the examinations branch has actually sent.</CardDescription>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <ProportionBar
              label="Register rows by claim state"
              segments={[
                { label: 'Claimed', value: stats.claimed, tone: 'brand' },
                { label: 'Not signed up', value: stats.unclaimed, tone: 'neutral' },
              ]}
            />

            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-secondary">Years present</dt>
                <dd className="font-medium tabular">
                  {stats.byYear[0]?.year} – {stats.byYear[stats.byYear.length - 1]?.year}
                </dd>
              </div>
              <div>
                <dt className="text-secondary">Branches</dt>
                <dd className="font-medium">{departments.map((d) => d.code).join(' · ')}</dd>
              </div>
            </dl>

            {missingYears.length > 0 ? (
              <Alert tone="warning" title="Missing years" icon={<CalendarX2 className="size-4" />}>
                <p>
                  No rows for {missingYears.join(', ')}. Results for a batch reach the examinations branch months after
                  the ceremony, so a recent gap is normal — anything older is a file nobody chased. A graduate from a
                  missing year cannot be verified at all, and their claim will sit in the queue with no evidence behind
                  it.
                </p>
              </Alert>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Section
        title="Search the register"
        description="Roll number or name. Matching is a plain substring here — the fuzzy matching is what the verification queue does."
      >
        <form action="/admin/degree-register">
          <Card className="p-card">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_12rem_9rem_auto] lg:items-end">
              <Field htmlFor="q" label="Roll number or name" hint="Try a surname, or the first digits of a roll">
                <Input
                  id="q"
                  name="q"
                  defaultValue={q}
                  placeholder="e.g. 16JN1A05 or Vemulapalli"
                  leading={<Search className="size-4" />}
                  autoComplete="off"
                />
              </Field>

              <Field htmlFor="department" label="Branch">
                <Select id="department" name="department" defaultValue={department}>
                  <option value="">All branches</option>
                  {departments.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field htmlFor="year" label="Year of passing">
                <Select id="year" name="year" defaultValue={yearRaw}>
                  <option value="">Any year</option>
                  {[...stats.byYear].reverse().map((y) => (
                    <option key={y.year} value={y.year}>
                      {y.year} ({y.total})
                    </option>
                  ))}
                </Select>
              </Field>

              <div className="flex gap-2">
                <Button type="submit" variant="secondary">
                  Search
                </Button>
                {filtered ? (
                  <ButtonLink href="/admin/degree-register" variant="ghost">
                    Clear
                  </ButtonLink>
                ) : null}
              </div>
            </div>
          </Card>
        </form>

        {results.items.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="size-5" />}
            title="No register row matches that"
            description={
              q
                ? `Nothing in the register contains "${q}"${department ? ` within ${department}` : ''}${year ? ` for ${year}` : ''}. Register spellings follow the marks memo — surname first, initials expanded — so search a single distinctive part of the name rather than the whole thing. If the whole batch is absent, the file has not been loaded.`
                : 'No rows for that combination of branch and year. That usually means the file for that batch has not been supplied yet.'
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink href="/admin/degree-register" variant="secondary">
                  Clear the filters
                </ButtonLink>
                <ButtonLink href="/admin/degree-register/upload">Load a register file</ButtonLink>
              </div>
            }
          />
        ) : (
          <>
            <TableWrap className="hidden sm:block" caption="Degree register rows">
              <Table>
                <THead>
                  <TR>
                    <TH>Roll number</TH>
                    <TH>Name as printed</TH>
                    <TH>Branch</TH>
                    <TH align="right">Admitted</TH>
                    <TH align="right">Passed</TH>
                    <TH>Source file</TH>
                    <TH>Portal account</TH>
                  </TR>
                </THead>
                <TBody>
                  {results.items.map((r) => {
                    const account = accounts.get(r.rollNumber.toUpperCase());
                    return (
                      <TR key={r.id} interactive>
                        <TD>
                          <span className="font-mono font-medium">{r.rollNumber}</span>
                        </TD>
                        <TD>{r.name}</TD>
                        <TD>
                          <span className="font-medium">{r.departmentCode ?? '—'}</span>
                          <span className="block text-xs text-muted">{r.programme ?? 'Programme not recorded'}</span>
                        </TD>
                        <TD numeric>{r.admissionYear ?? '—'}</TD>
                        <TD numeric>{r.yearOfPassing ?? '—'}</TD>
                        <TD>
                          <span className="font-mono text-xs text-secondary">{r.sourceFile ?? 'unknown'}</span>
                        </TD>
                        <TD>
                          {account ? (
                            <>
                              <Badge tone="success">Signed up</Badge>
                              <span className="mt-1 block text-xs text-secondary">{account.fullName}</span>
                            </>
                          ) : (
                            <Badge tone="neutral">Not signed up</Badge>
                          )}
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableWrap>

            <ul className="space-y-3 sm:hidden">
              {results.items.map((r) => {
                const account = accounts.get(r.rollNumber.toUpperCase());
                return (
                  <li key={r.id}>
                    <DefinitionCard
                      title={<span className="font-mono">{r.rollNumber}</span>}
                      subtitle={r.name}
                      rows={[
                        { label: 'Branch', value: r.departmentCode ?? '—' },
                        { label: 'Passed', value: r.yearOfPassing ?? '—' },
                        { label: 'Admitted', value: r.admissionYear ?? '—' },
                        { label: 'Source', value: <span className="font-mono text-xs">{r.sourceFile ?? 'unknown'}</span> },
                        {
                          label: 'Account',
                          value: account ? (
                            <Badge tone="success">{account.fullName}</Badge>
                          ) : (
                            <Badge tone="neutral">Not signed up</Badge>
                          ),
                        },
                      ]}
                    />
                  </li>
                );
              })}
            </ul>

            <Pagination page={results.page} pageCount={results.pageCount} total={results.total} buildHref={buildHref} />
          </>
        )}
      </Section>
    </div>
  );
}
