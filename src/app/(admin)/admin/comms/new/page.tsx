import { redirect, notFound } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { searchDirectory, getDepartments, getDegreeRegisterStats } from '@/lib/data/repo';
import type { DirectoryQuery } from '@/lib/data/types';
import { PageHeader, Breadcrumbs } from '@/components/ui';
import { ComposeForm, type Segment } from './ComposeForm';

export const metadata = { title: 'New message' };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function NewCommsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const pack = resolved.brand.pack;

  const all = can(session, 'comms.send.all');
  const segmentCap = can(session, 'comms.send.segment');
  const departmentCap = can(session, 'comms.send.department');
  if (!all && !segmentCap && !departmentCap) requireCap(session, 'comms.send.department');

  const tier: 'all' | 'segment' | 'department' = all ? 'all' : segmentCap ? 'segment' : 'department';
  const myDepartment = session.roles.find((r) => r.role === 'hod')?.departmentId ?? session.departmentId;

  const params = await searchParams;
  const raw = {
    cohort: one(params.cohort),
    department: one(params.department) ?? '',
    batchFrom: one(params.batchFrom) ?? '',
    batchTo: one(params.batchTo) ?? '',
    city: one(params.city) ?? '',
    availability: one(params.availability) ?? '',
  };

  /**
   * The department is clamped here, on the server, before the count is
   * computed. An HOD cannot widen their audience by editing the query
   * string, and the composer is handed the clamped value so the control
   * shows the truth rather than a rejected wish.
   */
  const lockedDepartment = tier === 'department' ? (myDepartment ?? '') : null;

  const segment: Segment = {
    cohort: raw.cohort === 'alumni' || raw.cohort === 'students' ? raw.cohort : 'all',
    department: lockedDepartment ?? raw.department,
    batchFrom: /^\d{4}$/.test(raw.batchFrom) ? raw.batchFrom : '',
    batchTo: /^\d{4}$/.test(raw.batchTo) ? raw.batchTo : '',
    city: raw.city,
    availability:
      raw.availability === 'mentoring' || raw.availability === 'referrals' || raw.availability === 'speaking'
        ? raw.availability
        : '',
  };

  const query: DirectoryQuery = {
    cohort: segment.cohort,
    ...(segment.department ? { department: segment.department } : {}),
    ...(segment.batchFrom ? { batchFrom: Number(segment.batchFrom) } : {}),
    ...(segment.batchTo ? { batchTo: Number(segment.batchTo) } : {}),
    ...(segment.city ? { city: segment.city } : {}),
    ...(segment.availability === 'mentoring' ? { mentoring: true } : {}),
    ...(segment.availability === 'referrals' ? { referrals: true } : {}),
    ...(segment.availability === 'speaking' ? { speaking: true } : {}),
    perPage: 4,
    sort: 'name',
  };

  // Two reads: the segment as chosen, and the widest audience this viewer
  // could reach, which is what the filter option lists are drawn from.
  const result = searchDirectory(session, query);
  const scope = searchDirectory(session, {
    ...(lockedDepartment ? { department: lockedDepartment } : {}),
    perPage: 1,
  });

  const departments = getDepartments();
  const registerStats = getDegreeRegisterStats();

  const departmentOptions = lockedDepartment
    ? departments
        .filter((d) => d.code === lockedDepartment)
        .map((d) => ({ value: d.code, label: `${d.code} — ${d.name}` }))
    : [
        { value: '', label: 'Every branch' },
        ...scope.facets.departments.map((f) => ({
          value: f.value,
          label: `${f.value} — ${f.label} (${f.count.toLocaleString('en-IN')})`,
        })),
      ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Admin', href: '/admin' },
              { label: 'Communications', href: '/admin/comms' },
              { label: 'New message' },
            ]}
          />
        }
        eyebrow="Engagement"
        title="New message"
        description="Build the segment first and watch the count. A broadcast cannot be recalled, and a list that stops trusting the college's mail is not won back by the next one."
      />

      <ComposeForm
        tier={tier}
        segment={segment}
        lockedDepartment={lockedDepartment}
        lockedDepartmentName={
          lockedDepartment
            ? (departments.find((d) => d.code === lockedDepartment)?.name ?? lockedDepartment)
            : null
        }
        recipientCount={result.total}
        scopeTotal={scope.total}
        sampleNames={result.items.slice(0, 3).map((m) => m.fullName)}
        departmentOptions={departmentOptions}
        cityOptions={scope.facets.cities.map((f) => ({
          value: f.value,
          label: `${f.label} (${f.count.toLocaleString('en-IN')})`,
        }))}
        batchYears={scope.facets.batches.map((f) => f.value)}
        studentsAddressable={can(session, 'directory.search.students')}
        whatsappEnabled={pack.features.whatsapp}
        portalName={pack.copy.portalName}
        institutionName={pack.copy.institutionName}
        supportEmail={pack.copy.supportEmail ?? null}
        unclaimedRegisterRows={registerStats.unclaimed}
      />
    </div>
  );
}
