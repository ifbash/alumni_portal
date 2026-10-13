import { notFound, redirect } from 'next/navigation';
import { ImageIcon, ImagePlus } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getAlbumPhotos, getAlbums, type GalleryAlbum } from '@/lib/data/content';
import { Badge, ButtonLink, Card, CardBody, EmptyState, MediaFrame, PageHeader, SummaryLine, Tabs } from '@/components/ui';
import { AlbumCard, parseContributor } from '@/components/content';
import { formatDate } from '@/lib/format';
import { siteOrigin } from '@/lib/share';
import { albumShareText } from '@/lib/share-text';
import { AlbumActionsMenu, ReviewActions } from './ReviewActions';

/**
 * The gallery console.
 *
 * The interesting album is never the one the alumni cell uploaded itself —
 * it is the one a graduate sent in and is now waiting on somebody's
 * decision. A contribution that sits unreviewed for three weeks is a
 * contributor who never sends a second batch, so the queue comes first.
 */

export const metadata = { title: 'Gallery · Staff console' };

type View = 'all' | 'published' | 'review';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminGalleryPage({
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

  // Publishing photographs of identifiable students and alumni is an
  // alumni-cell and college-admin job. An HOD holding only
  // `event.create.department` does not reach this console.
  requireCap(session, 'event.create.any');

  const params = await searchParams;
  const view: View = ((v) => (v === 'published' || v === 'review' ? v : 'all'))(one(params.view));

  const all = getAlbums({ includeDrafts: true });
  const published = all.filter((a) => a.published);
  const waiting = all.filter((a) => !a.published && parseContributor(a.contributedBy));
  const unpublished = all.filter((a) => !a.published && !parseContributor(a.contributedBy));

  // The album grid below the queue: everything not already waiting on you.
  const catalogue = view === 'published' ? published : view === 'review' ? unpublished : [...published, ...unpublished];
  catalogue.sort((a, b) => b.takenOn.localeCompare(a.takenOn));

  const origin = await siteOrigin();
  const timing = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };
  const officeName = pack.copy.officeName;

  const coverOf = (a: GalleryAlbum) => a.coverImage ?? getAlbumPhotos(a.id).find((p) => p.url)?.url ?? null;
  const withoutPhotos = published.filter((a) => !coverOf(a)).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Engagement"
        title="Gallery"
        description="Albums members can browse, and photos graduates send in."
        actions={
          <ButtonLink href="/admin/gallery/new">
            <ImagePlus className="size-4" aria-hidden="true" />
            New album
          </ButtonLink>
        }
      />

      <div className="space-y-2">
        <SummaryLine
          items={[
            { value: published.length, label: 'published', href: '/admin/gallery?view=published' },
            { value: waiting.length, label: 'waiting on you', href: '#waiting', tone: 'attention' },
            { value: unpublished.length, label: 'not published', href: '/admin/gallery?view=review' },
          ]}
        />
        {withoutPhotos > 0 ? (
          <p className="flex items-center gap-2 text-sm text-secondary">
            <ImageIcon className="size-4 shrink-0 text-muted" aria-hidden="true" />
            {withoutPhotos === 1
              ? '1 album has no photos yet, so members see it without photos.'
              : `${withoutPhotos} albums have no photos yet, so members see them without photos.`}
          </p>
        ) : null}
      </div>

      {waiting.length > 0 ? (
        <section id="waiting" aria-labelledby="waiting-heading" className="scroll-mt-20 space-y-3">
          <h2 id="waiting-heading" className="font-display text-xl font-semibold">
            Waiting on you
          </h2>
          {waiting.map((album) => {
            const who = parseContributor(album.contributedBy)!;
            const photos = getAlbumPhotos(album.id);
            // Only photos with a file: a row of blank squares under "First 6"
            // says nothing about what the graduate sent.
            const strip = photos.filter((p) => p.url).slice(0, 6);
            return (
              <Card key={album.id} id={`review-${album.id}`}>
                <CardBody className="grid gap-5 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
                  <AlbumCard
                    album={album}
                    coverSrc={coverOf(album)}
                    href={`#review-${album.id}`}
                    locale={pack.locale}
                    variant="large"
                    className="sm:col-span-1"
                    credit={`Sent in by ${who.name.split(/\s+/)[0]} · ${who.branch} ’${String(who.year).slice(-2)}`}
                    state={<Badge tone="warning">Waiting for review</Badge>}
                  />
                  <div className="min-w-0 space-y-4">
                    <div className="space-y-1.5">
                      <p className="text-sm text-primary">
                        Sent by {who.name} ({who.branch} ’{String(who.year).slice(-2)}) · photos from{' '}
                        {formatDate(album.takenOn, timing)}
                      </p>
                      {album.description ? <p className="text-sm text-secondary">{album.description}</p> : null}
                      <p className="text-sm text-secondary">
                        Link once published: <span className="break-all text-primary">/gallery/{album.slug}</span>
                      </p>
                    </div>

                    {strip.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-secondary">
                          First {strip.length} of {album.photoCount.toLocaleString('en-IN')} photos
                        </p>
                        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                          {strip.map((photo) => (
                            <li key={photo.id} className="min-w-0">
                              <MediaFrame src={photo.url} alt={photo.caption ?? ''} aspect="1/1" />
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <ReviewActions
                      albumId={album.id}
                      albumTitle={album.title}
                      contributorName={who.name}
                      photoCount={album.photoCount}
                    />
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </section>
      ) : null}

      <section aria-labelledby="albums-heading" className="space-y-4">
        <h2 id="albums-heading" className="sr-only">
          Albums
        </h2>
        <Tabs
          ariaLabel="Albums"
          items={[
            { label: 'All albums', href: '/admin/gallery', count: published.length + unpublished.length, active: view === 'all' },
            { label: 'Published', href: '/admin/gallery?view=published', count: published.length, active: view === 'published' },
            { label: 'Not published', href: '/admin/gallery?view=review', count: unpublished.length, active: view === 'review' },
          ]}
        />

        {catalogue.length === 0 ? (
          view === 'all' ? (
            <EmptyState
              icon={<ImageIcon className="size-5" />}
              title="No albums yet"
              description="Create one for the next event, or file the photos a graduate has sent in."
              action={
                <ButtonLink href="/admin/gallery/new" variant="secondary">
                  Create an album
                </ButtonLink>
              }
            />
          ) : (
            <p className="text-sm text-secondary">
              {view === 'review'
                ? 'Every album the college made is published.'
                : 'Nothing is published yet.'}
            </p>
          )
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 xl:grid-cols-4">
            {catalogue.map((album) => {
              const who = parseContributor(album.contributedBy);
              const credit = who
                ? `Sent in by ${who.name.split(/\s+/)[0]} · ${who.branch} ’${String(who.year).slice(-2)}`
                : album.contributedBy
                  ? `By ${album.contributedBy}`
                  : `By the ${officeName}`;
              const memberHref = album.published ? `/gallery/${album.slug}` : null;
              return (
                <li
                  key={album.id}
                  id={`album-${album.id}`}
                  className="relative min-w-0 has-[[aria-expanded=true]]:z-20"
                >
                  <AlbumCard
                    album={album}
                    coverSrc={coverOf(album)}
                    href={memberHref ?? `#album-${album.id}`}
                    locale={pack.locale}
                    credit={credit}
                    // Without a photo the art is a slim label strip, as members see it.
                    className={coverOf(album) ? undefined : '[&_figure>div]:aspect-[5/2]'}
                    state={album.published ? undefined : <Badge tone="neutral">Not published</Badge>}
                    action={
                      <AlbumActionsMenu
                        albumId={album.id}
                        albumTitle={album.title}
                        photoCount={album.photoCount}
                        memberHref={memberHref}
                        shareText={
                          memberHref
                            ? `${albumShareText(pack, album)} ${origin}${memberHref}`
                            : null
                        }
                        canPublish={!album.published}
                      />
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
