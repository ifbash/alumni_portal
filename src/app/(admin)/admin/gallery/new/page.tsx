import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDegreeRegisterStats, getDepartments, getEvents } from '@/lib/data/repo';
import { getAlbums } from '@/lib/data/content';
import { Breadcrumbs, PageHeader } from '@/components/ui';
import { AlbumForm } from './AlbumForm';

/**
 * New album.
 *
 * Everything the form is allowed to offer is decided here, on the server:
 * the branches that exist, the events that can be linked, the batch years
 * the degree register actually knows about, and the slugs already taken.
 * A select built from the real data cannot produce a value the server
 * would then have to reject.
 */

export const metadata = { title: 'New album' };

export default async function NewAlbumPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.gallery) notFound();

  requireCap(session, 'event.create.any');

  const departments = getDepartments().map((d) => ({ value: d.code, label: `${d.code} — ${d.name}` }));

  // Both drafts and published events are offerable: an album is usually
  // created for an event that has not happened yet.
  const events = getEvents(session, { when: 'all', includeDrafts: true }).map((e) => ({
    value: e.slug,
    label: e.published ? e.title : `${e.title} (draft)`,
  }));

  // Batch years come from the degree register rather than a hardcoded
  // range — it is the college's own list of the years it has graduated,
  // and it is the same source verification matches against.
  const years = getDegreeRegisterStats()
    .byYear.map((y) => y.year)
    .sort((a, b) => b - a);

  const takenSlugs = getAlbums({ includeDrafts: true }).map((a) => a.slug);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Admin', href: '/admin' },
              { label: 'Gallery', href: '/admin/gallery' },
              { label: 'New album' },
            ]}
          />
        }
        eyebrow="Engagement"
        title="New album"
        description="Create the album first and upload into it. Leaving it unpublished is the normal case — an album with no photographs in it yet is not something members should be able to open."
      />

      <AlbumForm
        departments={departments}
        events={events}
        years={years}
        takenSlugs={takenSlugs}
        portalName={pack.copy.portalName}
      />
    </div>
  );
}
