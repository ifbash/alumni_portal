import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getAllPages } from '@/lib/data/pages';
import { Breadcrumbs, PageHeader } from '@/components/ui';
import { PageEditor } from '../PageEditor';

export const metadata = { title: 'New page · Staff console' };

export default async function NewPagePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  if (!resolved.brand.pack.features.pages) notFound();

  requireCap(session, 'page.manage');

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Staff console', href: '/admin' },
              { label: 'Pages', href: '/admin/pages' },
              { label: 'New page' },
            ]}
          />
        }
        eyebrow="Pages"
        title="New page"
        description="Save a draft while you write. Nothing is visible to readers until you publish."
      />
      <PageEditor mode="create" takenSlugs={getAllPages(session).map((p) => p.slug)} />
    </div>
  );
}
