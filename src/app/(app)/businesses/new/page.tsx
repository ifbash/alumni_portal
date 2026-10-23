import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { businessSlugs } from '@/lib/data/businesses';
import { Breadcrumbs, PageHeader } from '@/components/ui';
import { BusinessForm } from '@/components/community/BusinessForm';

export const metadata: Metadata = { title: 'List your business' };

export default async function NewBusinessPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.businesses) notFound();

  requireCap(session, 'business.list');

  // Every address in use, in any state, so the form can say so before the server has to.
  const taken = businessSlugs();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: 'Businesses', href: '/businesses' }, { label: 'List your business' }]} />}
        eyebrow="Businesses"
        title="List your business"
        description={`The ${pack.copy.officeName} reviews every listing before it appears.`}
      />
      <BusinessForm mode="create" takenSlugs={taken} />
    </div>
  );
}
