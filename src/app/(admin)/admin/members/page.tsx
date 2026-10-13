import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronDown, ChevronRight, Search, Users } from 'lucide-react';
import { getSessionMember } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getDepartments, getMembersForAdminView, getVerificationClaims } from '@/lib/data/repo';
import type { MemberStatus, MemberSummary } from '@/lib/data/types';
import {
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  ButtonLink,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  Select,
  Table,
  TableWrap,
  Tabs,
  TBody,
  TD,
  TH,
  THead,
  TR,
  type TabItem,
} from '@/components/ui';
import { MemberRow } from '@/components/members/MemberCard';
import { formatNumber, memberLine } from '@/lib/format';
import { ExportDialog } from './ExportDialog';
import { STATUS_META, STATUS_ORDER } from './status';

export const metadata = { title: 'Members · Staff console' };

const PER_PAGE = 25;

const EXPORT_FIELDS = [
  'name',
  'roll number',
  'branch',
  'year of passing',
  'email',
  'mobile',
  'current employer',
  'city',
];

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

function buildHref(q: {
  q?: string;
  status?: string;
  department?: string;
  page?: number;
}): string {
  const sp = new URLSearchParams();
  if (q.q) sp.set('q', q.q);
  if (q.status && q.status !== 'all') sp.set('status', q.status);
  if (q.department) sp.set('department', q.department);
  if (q.page && q.page > 1) sp.set('page', String(q.page));
  const s = sp.toString();
  return s ? `/admin/members?${s}` : '/admin/members';
}

/** The statuses with their own tab. Everything else sits under "More". */
const MAIN_TABS: Array<{ status: string; label: string }> = [
  { status: 'all', label: 'Everyone' },
  { status: 'active_alumni', label: 'Alumni' },
  { status: 'active_student', label: 'Final years' },
  { status: 'pending', label: 'Awaiting verification' },
];

/** Display fields only: nothing from the contact table, nothing academic. */
interface Row {
  id: string;
  fullName: string;
  preferredName: string | null;
  photoUrl: string | null;
  departmentCode: string | null;
  batchYear: number | null;
  designation: string | null;
  currentCompany: string | null;
  city: string | null;
  rollNumber: string | null;
  status: MemberStatus;
  isStudent: boolean;
}

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { session, member: actor } = await getSessionMember();
  if (!session) redirect('/login');

  // Reading any member record at all is `profile.read.any` — held by the
  // alumni cell, HODs and the college admin, nobody else.
  requireCap(session, 'profile.read.any');

  const params = await searchParams;
  const q = first(params.q)?.trim() ?? '';
  const status = first(params.status) ?? 'all';
  const department = first(params.department) ?? '';
  const page = Math.max(1, Number(first(params.page) ?? 1) || 1);
  const wantsExport = first(params.export) === '1';

  const canExport = can(session, 'member.export');

  // The export surface is addressable by URL, so it is guarded by URL too.
  // Hiding the button is presentation; this is the authorisation.
  if (wantsExport) requireCap(session, 'member.export');

  const departments = getDepartments();
  const result = getMembersForAdminView(session, { q, status, department, page, perPage: PER_PAGE });
  const everyone = getMembersForAdminView(session, { perPage: 1 }).total;

  // Each record is narrowed here, on the server, to what a row shows.
  const rows: Row[] = result.items.map((m) => ({
    id: m.id,
    fullName: m.fullName,
    preferredName: m.preferredName,
    photoUrl: m.photoUrl,
    departmentCode: m.departmentCode,
    batchYear: m.batchYear,
    designation: m.designation,
    currentCompany: m.currentCompany,
    city: m.city,
    rollNumber: m.rollNumber ?? null,
    status: m.status,
    isStudent: m.isStudent,
  }));

  // Counts respect the search box and branch filter, so the tabs describe
  // the result set the admin is actually looking at.
  const countFor = (s: string) => getMembersForAdminView(session, { q, department, status: s, perPage: 1 }).total;

  const moreStatuses = STATUS_ORDER.filter((s) => !MAIN_TABS.some((t) => t.status === s));
  const activeMore = moreStatuses.find((s) => s === status) ?? null;

  const tabs: TabItem[] = [
    ...MAIN_TABS.map((t) => ({
      label: t.label,
      href: buildHref({ q, department, status: t.status }),
      count: countFor(t.status),
      active: status === t.status,
    })),
    ...(activeMore
      ? [{ label: STATUS_META[activeMore].label, href: buildHref({ q, department, status: activeMore }), count: countFor(activeMore), active: true }]
      : []),
  ];

  // The badge appears only when a row is not what its tab would lead you
  // to expect. On "Everyone", that means anyone who is not an alumnus.
  const expected: string = status === 'all' ? 'active_alumni' : status;

  const canReview = can(session, 'verification.review.any') || can(session, 'verification.review.department');
  const queued = status === 'pending' && canReview ? getVerificationClaims(session, { status: 'queued' }).length : 0;

  const filtered = Boolean(q || department);
  const scopeLabel = memberLine([
    STATUS_ORDER.includes(status as MemberStatus) ? STATUS_META[status as MemberStatus].label : 'All statuses',
    department ? departments.find((d) => d.code === department)?.name ?? department : 'All branches',
    q ? `search "${q}"` : null,
  ]);

  const summaryOf = (r: Row): MemberSummary => ({
    id: r.id,
    slug: r.id,
    fullName: r.fullName,
    photoUrl: r.photoUrl,
    batchYear: r.batchYear,
    departmentCode: r.departmentCode,
    departmentName: null,
    currentCompany: r.currentCompany,
    designation: r.designation,
    industry: null,
    city: r.city,
    state: null,
    country: null,
    skills: [],
    openToMentoring: false,
    openToReferrals: false,
    openToSpeaking: false,
    status: r.status,
    isStudent: r.isStudent,
  });

  const statusBadge = (r: Row) =>
    r.status !== expected ? <Badge tone={STATUS_META[r.status].tone}>{STATUS_META[r.status].label}</Badge> : null;

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: 'Staff console', href: '/admin' }, { label: 'Members' }]} />}
        title="Members"
        description={`${formatNumber(everyone)} alumni and final-year students. Search by name, roll number, email or company.`}
        meta={
          !canExport ? <p className="text-sm text-secondary">Contact export is done by the college admin.</p> : null
        }
        actions={
          canExport ? (
            <ExportDialog
              rowCount={result.total}
              scopeLabel={scopeLabel}
              actorName={actor?.fullName ?? 'Signed-in admin'}
              actorEmail={actor?.privateContact.email ?? 'your college address'}
              fields={EXPORT_FIELDS}
              defaultOpen={wantsExport}
            />
          ) : null
        }
      />

      <form method="get" action="/admin/members" role="search" className="flex flex-wrap items-center gap-2">
        {status !== 'all' ? <input type="hidden" name="status" value={status} /> : null}
        <label htmlFor="member-q" className="sr-only">
          Search by name, roll number, email or company
        </label>
        <div className="min-w-0 flex-1 basis-56 sm:max-w-md">
          <Input
            id="member-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Name, roll number, email or company"
            leading={<Search className="size-4" />}
            autoComplete="off"
          />
        </div>
        <div className="w-40">
          <label htmlFor="member-department" className="sr-only">
            Branch
          </label>
          <Select id="member-department" name="department" defaultValue={department}>
            <option value="">All branches</option>
            {departments.map((d) => (
              <option key={d.code} value={d.code}>
                {d.code}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {filtered ? (
          <ButtonLink href={buildHref({ status })} variant="ghost">
            Clear
          </ButtonLink>
        ) : null}
      </form>

      <div className="flex min-w-0 items-end gap-1 border-b border-line">
        <Tabs items={tabs} ariaLabel="Member cohorts" className="min-w-0 flex-1 border-b-0" />
        {/* A native disclosure rather than the kit Menu: this list is
            links only, and the page stays a server component. */}
        <details className="group relative mb-1 shrink-0">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded px-3 text-sm font-medium text-secondary marker:hidden hover:text-primary sm:min-h-9">
            More
            <ChevronDown className="size-4 transition-transform duration-fast group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul className="absolute right-0 z-20 mt-1.5 min-w-48 rounded-lg border border-line bg-surface-raised p-1 shadow-lg">
            {moreStatuses.map((s) => (
              <li key={s}>
                <Link
                  href={buildHref({ q, department, status: s })}
                  aria-current={status === s ? 'page' : undefined}
                  className="flex min-h-11 items-center rounded px-2.5 text-sm text-primary transition-colors duration-fast ease-brand hover:bg-surface-sunken sm:min-h-9"
                >
                  {STATUS_META[s].label}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </div>

      {rows.length === 0 ? (
        status === 'pending' && queued > 0 && !filtered ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title="Nobody is waiting here"
            description={`${formatNumber(queued)} ${queued === 1 ? 'registration is' : 'registrations are'} in the verification queue.`}
            action={
              <ButtonLink href="/admin/verification">
                Review {formatNumber(queued)} {queued === 1 ? 'registration' : 'registrations'}
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            icon={<Users className="size-5" />}
            title={q ? `Nothing matches “${q}”` : `No ${STATUS_ORDER.includes(status as MemberStatus) ? STATUS_META[status as MemberStatus].label.toLowerCase() : ''} records`}
            description={
              q
                ? 'Roll numbers match exactly and names match on whole words. Try the surname alone.'
                : 'Nobody on the portal has this status right now.'
            }
            action={
              filtered ? (
                <ButtonLink href={buildHref({ status })} variant="secondary">
                  Clear the search
                </ButtonLink>
              ) : null
            }
          />
        )
      ) : (
        <>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface-raised px-3 sm:hidden">
            {rows.map((r) => (
              <li key={r.id}>
                <MemberRow member={summaryOf(r)} href={`/admin/members/${r.id}`} action={statusBadge(r)} />
              </li>
            ))}
          </ul>

          <TableWrap caption="Member records" className="hidden sm:block">
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Batch</TH>
                  <TH>Work</TH>
                  <TH>Roll number</TH>
                  <TH className="w-8">
                    <span className="sr-only">Open</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={r.id} interactive className="relative">
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar name={r.fullName} src={r.photoUrl} size="sm" />
                        <div className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/admin/members/${r.id}`}
                              className="font-medium text-primary after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded focus-visible:after:ring-2 focus-visible:after:ring-[var(--focus-ring)]"
                            >
                              {r.fullName}
                            </Link>
                            {statusBadge(r)}
                          </span>
                          {r.preferredName ? (
                            <span className="block text-xs text-secondary">Goes by {r.preferredName}</span>
                          ) : null}
                        </div>
                      </div>
                    </TD>
                    <TD className="whitespace-nowrap">{memberLine([r.departmentCode, r.batchYear]) || '—'}</TD>
                    <TD className="max-w-80">
                      <span className="block truncate text-secondary">
                        {memberLine([r.designation, r.currentCompany, r.city]) || '—'}
                      </span>
                    </TD>
                    <TD className="whitespace-nowrap font-mono text-xs text-secondary">{r.rollNumber ?? '—'}</TD>
                    <TD align="right">
                      <ChevronRight className="size-4 text-muted" aria-hidden="true" />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </>
      )}

      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        buildHref={(p) => buildHref({ q, status, department, page: p })}
      />
    </div>
  );
}
