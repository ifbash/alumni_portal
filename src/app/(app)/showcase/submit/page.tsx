import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { Breadcrumbs, PageHeader } from '@/components/ui';
import { ShowcaseSubmitForm } from '@/components/community/ShowcaseSubmitForm';

export const metadata: Metadata = { title: 'Share an achievement' };

export default async function SubmitShowcasePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.showcase) notFound();

  requireCap(session, 'showcase.submit');

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: 'Showcase', href: '/showcase' }, { label: 'Share an achievement' }]} />}
        eyebrow="Showcase"
        title="Share an achievement"
        description="Something you did that other alumni, and the final-years, would want to know about."
      />
      <ShowcaseSubmitForm officeName={pack.copy.officeName} />
    </div>
  );
}
