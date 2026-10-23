import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getGroups } from '@/lib/data/groups';
import { Breadcrumbs, PageHeader } from '@/components/ui';
import { GroupEditor } from '../GroupEditor';

export const metadata = { title: 'New group · Staff console' };

export default async function NewGroupPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  if (!resolved.brand.pack.features.groups) notFound();

  requireCap(session, 'group.manage');

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Staff console', href: '/admin' },
              { label: 'Groups', href: '/admin/groups' },
              { label: 'New group' },
            ]}
          />
        }
        eyebrow="Groups"
        title="New group"
        description="Create the group first, then appoint a lead from its page so somebody is looking after it."
      />
      <GroupEditor mode="create" takenSlugs={getGroups(session).map((g) => g.slug)} />
    </div>
  );
}
