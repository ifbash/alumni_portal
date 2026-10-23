import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getBusinessBySlug } from '@/lib/data/businesses';
import { Breadcrumbs, PageHeader } from '@/components/ui';
import { BusinessForm } from '@/components/community/BusinessForm';

export const metadata: Metadata = { title: 'Edit your listing' };

/**
 * Edit and resubmit. Only the owner: somebody else's listing is not found,
 * the same as a listing that does not exist.
 */
export default async function EditBusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.businesses) notFound();

  requireCap(session, 'business.list');

  const { slug } = await params;
  const b = getBusinessBySlug(session, slug);
  if (!b || b.owner.id !== session.memberId) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: 'Businesses', href: '/businesses' }, { label: b.name, href: `/businesses/${b.slug}` }, { label: 'Edit' }]} />}
        eyebrow="Businesses"
        title={`Edit ${b.name}`}
        description="Your changes go to the alumni cell for review before they appear."
      />
      <BusinessForm
        mode="resubmit"
        takenSlugs={[]}
        initial={{
          slug: b.slug,
          name: b.name,
          industry: b.industry,
          description: b.description,
          city: b.city ?? '',
          region: b.region ?? '',
          country: b.country ?? '',
          website: b.website ?? '',
          products: b.products.join(', '),
          services: b.services.join(', '),
          showContact: b.contactShared,
          contactEmail: b.contact?.email ?? '',
          contactPhone: b.contact?.phone ?? '',
          live: b.status === 'live',
        }}
      />
    </div>
  );
}
