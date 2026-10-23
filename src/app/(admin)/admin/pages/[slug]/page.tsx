import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getAllPages } from '@/lib/data/pages';
import { Breadcrumbs, PageHeader } from '@/components/ui';
import { PageEditor } from '../PageEditor';

export const metadata = { title: 'Edit page · Staff console' };

export default async function EditPagePage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  if (!resolved.brand.pack.features.pages) notFound();

  requireCap(session, 'page.manage');

  const { slug } = await params;
  const page = getAllPages(session).find((p) => p.slug === slug);
  if (!page) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Staff console', href: '/admin' },
              { label: 'Pages', href: '/admin/pages' },
              { label: page.title },
            ]}
          />
        }
        eyebrow="Pages"
        title={page.title}
        description={`Shown at /p/${page.slug}. The address stays fixed; everything else can change.`}
      />
      <PageEditor
        mode="edit"
        takenSlugs={[]}
        initial={{
          slug: page.slug,
          title: page.title,
          body: page.body,
          audience: page.audience,
          published: page.published,
          showInFooter: page.showInFooter,
          sortOrder: page.sortOrder,
        }}
      />
    </div>
  );
}
