import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDegreeRegisterStats, getDepartments, getEvents } from '@/lib/data/repo';
import { getAlbums } from '@/lib/data/content';
import { Breadcrumbs, PageHeader } from '@/components/ui';
import { displayNow } from '@/lib/format';
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

export const metadata = { title: 'New album · Staff console' };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** "YYYY-MM-DD" for an instant, in the college's time zone. */
function dayIn(iso: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).format(
    new Date(iso),
  );
}

export default async function NewAlbumPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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

  // What choosing an event fills in: its title, the day it happened, its branch.
  const tz = pack.locale.timeZone;
  const eventFacts = getEvents(session, { when: 'all', includeDrafts: true }).map((e) => ({
    slug: e.slug,
    title: e.title,
    date: dayIn(e.startsAt, tz),
    departmentCode: e.departmentCode,
  }));

  const requested = one((await searchParams).event);
  const initialEvent = requested && events.some((e) => e.value === requested) ? requested : null;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Staff console', href: '/admin' },
              { label: 'Gallery', href: '/admin/gallery' },
              { label: 'New album' },
            ]}
          />
        }
        eyebrow="Gallery"
        title="New album"
        description="Start from an event, or from photos a graduate sent in."
      />

      <AlbumForm
        departments={departments}
        events={events}
        eventFacts={eventFacts}
        years={years}
        takenSlugs={takenSlugs}
        initialEvent={initialEvent}
        today={dayIn(displayNow(), tz)}
        officeName={pack.copy.officeName}
        locale={pack.locale}
      />
    </div>
  );
}
