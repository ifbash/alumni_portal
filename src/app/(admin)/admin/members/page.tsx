import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Search, ShieldCheck, Users } from 'lucide-react';
import { getSessionMember } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getDepartments, getMembersForAdmin } from '@/lib/data/repo';
import type { MemberStatus } from '@/lib/data/types';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  DefinitionCard,
  EmptyState,
  Field,
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
import { formatDate, memberLine } from '@/lib/format';
import { ExportDialog } from './ExportDialog';
import { STATUS_META, STATUS_ORDER } from './status';

export const metadata = { title: 'Members' };

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
  const result = getMembersForAdmin({ q, status, department, page, perPage: PER_PAGE });

  // Counts respect the search box and branch filter, so the tabs describe
  // the result set the admin is actually looking at.
  const countFor = (s: string) => getMembersForAdmin({ q, department, status: s, perPage: 1 }).total;

  const tabs: TabItem[] = [
    { label: 'Everyone', href: buildHref({ q, department }), count: countFor('all'), active: status === 'all' },
    {
      label: 'Alumni',
      href: buildHref({ q, department, status: 'active_alumni' }),
      count: countFor('active_alumni'),
      active: status === 'active_alumni',
    },
    {
      label: 'Final years',
      href: buildHref({ q, department, status: 'active_student' }),
      count: countFor('active_student'),
      active: status === 'active_student',
    },
    {
      label: 'Awaiting verification',
      href: buildHref({ q, department, status: 'pending' }),
      count: countFor('pending'),
      active: status === 'pending',
    },
  ];

  const filtered = Boolean(q || department || status !== 'all');
  const scopeLabel = memberLine([
    STATUS_ORDER.includes(status as MemberStatus) ? STATUS_META[status as MemberStatus].label : 'All statuses',
    department ? departments.find((d) => d.code === department)?.name ?? department : 'All branches',
    q ? `search "${q}"` : null,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Member records"
        title="Members"
        description="One row per person, students and alumni alike, keyed on roll number. Status is what separates the two cohorts; the annual rollover flips it."
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

      {!canExport ? (
        <Alert tone="neutral" icon={<ShieldCheck className="size-4" />}>
          <p>
            You can read these records and correct them. Bulk contact export is held by the college
            admin alone and is not available from this screen — staff leave, and an exportable
            directory leaves with them.
          </p>
        </Alert>
      ) : null}

      <Card>
        <CardBody>
          <form method="get" action="/admin/members" className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-end">
            <Field htmlFor="member-q" label="Search" hint="Name, roll number, email or employer.">
              <Input
                id="member-q"
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Kandula, 19JN1A0512, @gmail.com…"
                leading={<Search className="size-4" />}
                autoComplete="off"
              />
            </Field>

            <Field htmlFor="member-department" label="Branch" className="sm:w-52">
              <Select id="member-department" name="department" defaultValue={department}>
                <option value="">All branches</option>
                {departments.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field htmlFor="member-status" label="Status" className="sm:w-52">
              <Select id="member-status" name="status" defaultValue={status}>
                <option value="all">All statuses</option>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex items-center gap-2">
              <Button type="submit">Apply</Button>
              {filtered ? (
                <ButtonLink href="/admin/members" variant="ghost">
                  Clear
                </ButtonLink>
              ) : null}
            </div>
          </form>
        </CardBody>
      </Card>

      <Tabs items={tabs} ariaLabel="Member cohorts" />

      {result.items.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title={q ? `Nothing matches “${q}”` : 'No records with this status'}
          description={
            q
              ? 'Roll numbers are matched exactly and names are matched on whole words. If the person registered under a transliteration variant, search the surname alone.'
              : 'Nobody currently sits in this state. Statuses fill up as invitations go out, registrations arrive and the annual rollover runs.'
          }
          action={
            filtered ? (
              <ButtonLink href="/admin/members" variant="secondary">
                Clear filters
              </ButtonLink>
            ) : null
          }
        />
      ) : (
        <>
          {/* Below sm a seven-column table is unreadable however it scrolls. */}
          <div className="space-y-3 sm:hidden">
            {result.items.map((m) => (
              <DefinitionCard
                key={m.id}
                title={
                  <Link href={`/admin/members/${m.id}`} className="link-quiet">
                    {m.fullName}
                  </Link>
                }
                subtitle={<span className="font-mono">{m.rollNumber ?? 'No roll number'}</span>}
                rows={[
                  {
                    label: 'Status',
                    value: <Badge tone={STATUS_META[m.status].tone}>{STATUS_META[m.status].label}</Badge>,
                  },
                  { label: 'Branch', value: m.departmentCode ?? '—' },
                  { label: 'Batch', value: m.batchYear ?? '—' },
                  { label: 'Employer', value: m.currentCompany ?? 'Not on record' },
                  { label: 'Verified', value: formatDate(m.verifiedAt) },
                ]}
                actions={
                  <ButtonLink href={`/admin/members/${m.id}`} variant="secondary" size="sm">
                    Open record
                  </ButtonLink>
                }
              />
            ))}
          </div>

          <TableWrap caption="Member records" className="hidden sm:block">
            <Table>
              <THead>
                <TR>
                  <TH>Roll number</TH>
                  <TH>Name</TH>
                  <TH>Branch</TH>
                  <TH align="right">Batch</TH>
                  <TH>Status</TH>
                  <TH>Current employer</TH>
                  <TH>Verified</TH>
                </TR>
              </THead>
              <TBody>
                {result.items.map((m) => (
                  <TR key={m.id} interactive>
                    <TD className="whitespace-nowrap font-mono text-xs">
                      {m.rollNumber ?? <span className="text-muted">—</span>}
                    </TD>
                    <TD>
                      <Link href={`/admin/members/${m.id}`} className="font-medium link-quiet">
                        {m.fullName}
                      </Link>
                      {m.preferredName ? (
                        <span className="block text-xs text-muted">Goes by {m.preferredName}</span>
                      ) : null}
                    </TD>
                    <TD className="whitespace-nowrap">{m.departmentCode ?? '—'}</TD>
                    <TD numeric>{m.batchYear ?? '—'}</TD>
                    <TD>
                      <Badge tone={STATUS_META[m.status].tone}>{STATUS_META[m.status].label}</Badge>
                    </TD>
                    <TD>
                      {m.currentCompany ? (
                        <span className="block max-w-56 truncate">{m.currentCompany}</span>
                      ) : (
                        <span className="text-muted">Not on record</span>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-secondary">{formatDate(m.verifiedAt)}</TD>
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

      <p className="max-w-prose text-xs text-secondary">
        Around a third of alumni records carry no employer and no city. That is what a 2014 graduate
        who registered once looks like, and it is not a data-quality failure to be cleaned up — it is
        the reason the profile-completion nudge exists.
      </p>
    </div>
  );
}
