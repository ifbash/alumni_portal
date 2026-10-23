import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getMembersForAdminView } from '@/lib/data/repo';
import { memberLine } from '@/lib/format';
import { Breadcrumbs, PageHeader } from '@/components/ui';
import { CurateForm, type MemberOption } from '../CurateForm';

export const metadata = { title: 'New entry · Staff console' };

export default async function NewShowcaseEntryPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  if (!resolved.brand.pack.features.showcase) notFound();

  requireCap(session, 'showcase.manage');

  // The member picker reads member records, so it is offered only to a curator who may read them.
  // Anyone else adds entries about people who are not on the portal.
  const members: MemberOption[] = can(session, 'profile.read.any')
    ? getMembersForAdminView(session, { perPage: 1000 }).items
        .filter((m) => !m.isStudent && m.status === 'active_alumni')
        .map((m) => ({
          id: m.id,
          name: m.fullName,
          line: memberLine([m.batchYear ? `Batch of ${m.batchYear}` : null, m.departmentCode]),
          batchYear: m.batchYear,
          departmentCode: m.departmentCode,
        }))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Staff console', href: '/admin' },
              { label: 'Showcase', href: '/admin/showcase' },
              { label: 'New entry' },
            ]}
          />
        }
        eyebrow="Showcase"
        title="New entry"
        description="A prominent alumnus, an achievement or a success story."
      />
      <CurateForm members={members} />
    </div>
  );
}
