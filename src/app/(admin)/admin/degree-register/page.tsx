import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, ChevronRight, FileUp, ScrollText, Search } from 'lucide-react';

import {
  Badge,
  Breadcrumbs,
  Button,
  ButtonLink,
  Card,
  CardBody,
  DefinitionCard,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  Select,
  SummaryLine,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { canOpen } from '@/lib/navigation';
import { getDegreeRegisterStats, getDepartments, getMembersForAdmin, searchDegreeRegister } from '@/lib/data/repo';
import { displayNow, formatNumber, memberLine, yearIn } from '@/lib/format';
import {
  CoverageHeatmap,
  CoverageLegend,
  WeakestBatches,
  batchCommsHref,
  weakestBatches,
} from '../_shared/RegisterFilesGrid';

export const metadata = { title: 'Degree register · Staff console' };

const PER_PAGE = 25;

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

  const resolved = await getTenantBrand();
  if (!resolved) redirect('/login');
  const pack = resolved.brand.pack;
  const thisYear = yearIn(pack.locale.timeZone, displayNow());

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
  // flag someone has to remember to set. Only the id and name leave here.
  const accounts = new Map<string, { id: string; fullName: string }>();
  for (const m of getMembersForAdmin({ perPage: 5000 }).items) {
    const key = m.rollNumber?.toUpperCase();
    if (key && !accounts.has(key)) accounts.set(key, { id: m.id, fullName: m.fullName });
  }

  const firstYear = stats.byYear[0]?.year ?? thisYear;
  const lastYear = stats.byYear[stats.byYear.length - 1]?.year ?? thisYear;
  const yearsPresent = new Set(stats.byYear.map((y) => y.year));
  const missingYears: number[] = [];
  for (let y = firstYear; y <= thisYear; y++) if (!yearsPresent.has(y)) missingYears.push(y);

  const openMembers = canOpen(session, pack, '/admin/members');
  const openComms = canOpen(session, pack, '/admin/comms');
  const weakest = openComms ? weakestBatches(stats.byYear) : [];

  const buildHref = (next: { page?: number; year?: number | null }) => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (department) sp.set('department', department);
    const y = next.year === undefined ? yearRaw : next.year === null ? '' : String(next.year);
    if (y) sp.set('year', y);
    if (next.page && next.page > 1) sp.set('page', String(next.page));
    const qs = sp.toString();
    return qs ? `/admin/degree-register?${qs}` : '/admin/degree-register';
  };

  const filtered = Boolean(q || department || year);
  const under20 = stats.byYear.filter((y) => y.total && y.claimed / y.total < 0.2);

  const claimState = (roll: string, linkable: boolean) => {
    const account = accounts.get(roll.toUpperCase());
    if (!account) return <span className="text-secondary">Not joined yet</span>;
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge tone="success">Joined</Badge>
        {linkable && openMembers ? (
          <Link href={`/admin/members/${account.id}`} className="relative z-10 link-quiet font-medium">
            {account.fullName}
          </Link>
        ) : (
          <span className="font-medium">{account.fullName}</span>
        )}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs items={[{ label: 'Staff console', href: '/admin' }, { label: 'Degree register' }]} />
        }
        eyebrow="People and records"
        title="Degree register"
        description={`${formatNumber(stats.total)} graduates, ${firstYear}–${lastYear}, supplied by the examinations branch.`}
        actions={
          <ButtonLink href="/admin/degree-register/upload">
            <FileUp className="size-4" aria-hidden="true" />
            Load a register file
          </ButtonLink>
        }
      />

      <SummaryLine
        items={[
          { value: under20.length, label: under20.length === 1 ? 'batch under 20% joined' : 'batches under 20% joined', tone: 'attention' },
          {
            value: missingYears.length,
            label: missingYears.length === 1 ? 'year with no file' : 'years with no file',
            href: '/admin/imports',
            tone: 'attention',
          },
          ...(filtered ? [{ value: results.total, label: 'rows match' }] : []),
        ]}
      />

      <form action="/admin/degree-register" role="search" className="flex flex-wrap items-center gap-2">
        <label htmlFor="q" className="sr-only">
          Roll number or name
        </label>
        <div className="min-w-0 flex-1 basis-56 sm:max-w-md">
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Roll number or name"
            leading={<Search className="size-4" />}
            autoComplete="off"
          />
        </div>
        <div className="w-36">
          <label htmlFor="department" className="sr-only">
            Branch
          </label>
          <Select id="department" name="department" defaultValue={department}>
            <option value="">All branches</option>
            {departments.map((d) => (
              <option key={d.code} value={d.code}>
                {d.code}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-32">
          <label htmlFor="year" className="sr-only">
            Year of passing
          </label>
          <Select id="year" name="year" defaultValue={yearRaw}>
            <option value="">Any year</option>
            {[...stats.byYear].reverse().map((y) => (
              <option key={y.year} value={y.year}>
                {y.year}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {filtered ? (
          <ButtonLink href="/admin/degree-register" variant="ghost">
            Clear
          </ButtonLink>
        ) : null}
      </form>

      <Card>
        <CardBody className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-3">
            <h2 className="text-sm font-semibold text-secondary">Share of each batch that has joined</h2>
            <CoverageHeatmap
              ariaLabel="Share of each batch that has joined, by year of passing"
              batches={stats.byYear}
              hrefFor={(y) => (y === year ? buildHref({ year: null }) : buildHref({ year: y }))}
            />
            {year ? (
              <p className="text-sm text-secondary">
                Showing the {year} batch.{' '}
                <Link href={buildHref({ year: null })} className="link">
                  Show every batch
                </Link>
              </p>
            ) : null}
            {missingYears.length > 0 ? (
              <ul className="flex flex-wrap gap-2" aria-label="Years with no register file">
                {missingYears.map((y) => (
                  <li key={y}>
                    <Link
                      href="/admin/imports"
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,currentColor_26%,transparent)] bg-warning-soft px-3 text-sm text-warning-fg sm:min-h-8"
                    >
                      <AlertTriangle className="size-3.5" aria-hidden="true" />
                      <span className="font-mono font-semibold tabular">{y}</span> · no file yet
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            <CoverageLegend />
          </div>
          {weakest.length > 0 ? (
            <div className="min-w-0 space-y-1 border-t border-line pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <h2 className="text-sm font-semibold text-secondary">Furthest behind</h2>
              <WeakestBatches batches={weakest} commsHref={batchCommsHref} />
            </div>
          ) : null}
        </CardBody>
      </Card>

      {results.items.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="size-5" />}
          title="No register row matches that"
          description={
            q
              ? 'Register spellings follow the marks memo, surname first in some files. Search one distinctive part of the name.'
              : 'No rows for that branch and year. The file for that batch has probably not been loaded yet.'
          }
          action={
            <ButtonLink href="/admin/degree-register" variant="secondary">
              Clear the search
            </ButtonLink>
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
                  <TH>Batch</TH>
                  <TH>On the portal</TH>
                  <TH className="w-8">
                    <span className="sr-only">Open</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {results.items.map((r) => (
                  <TR key={r.id} interactive className="relative">
                    <TD className="whitespace-nowrap">
                      <Link
                        href={`/admin/degree-register/${r.id}`}
                        className="font-mono font-medium text-primary after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded focus-visible:after:ring-2 focus-visible:after:ring-[var(--focus-ring)]"
                      >
                        {r.rollNumber}
                      </Link>
                    </TD>
                    <TD>{r.name}</TD>
                    <TD className="whitespace-nowrap">{memberLine([r.departmentCode, r.yearOfPassing]) || '—'}</TD>
                    <TD>{claimState(r.rollNumber, true)}</TD>
                    <TD align="right">
                      <ChevronRight className="size-4 text-muted" aria-hidden="true" />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>

          <ul className="space-y-2 sm:hidden">
            {results.items.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/degree-register/${r.id}`} className="block rounded-lg transition-colors duration-fast ease-brand hover:bg-surface-sunken">
                  <DefinitionCard
                    title={<span className="font-mono">{r.rollNumber}</span>}
                    subtitle={r.name}
                    rows={[
                      { label: 'Batch', value: memberLine([r.departmentCode, r.yearOfPassing]) || '—' },
                      { label: 'Account', value: claimState(r.rollNumber, false) },
                    ]}
                  />
                </Link>
              </li>
            ))}
          </ul>

          <Pagination
            page={results.page}
            pageCount={results.pageCount}
            total={results.total}
            buildHref={(p) => buildHref({ page: p })}
          />
        </>
      )}
    </div>
  );
}
