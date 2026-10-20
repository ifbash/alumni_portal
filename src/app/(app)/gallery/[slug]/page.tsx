import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Camera, Images, Info, Ticket } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { isActive } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDepartments, getEventBySlug, searchDirectory } from '@/lib/data/repo';
import { getAlbumBySlug, getAlbumPhotos, getAlbums, type GalleryAlbum } from '@/lib/data/content';
import type { MemberSummary } from '@/lib/data/types';
import {
  Breadcrumbs,
  ButtonLink,
  EmptyState,
  Section,
  ShareActions,
  Tooltip,
} from '@/components/ui';
import { BandChip, PageBand } from '@/components/brand/PageBand';
import { AlbumCard, parseContributor } from '@/components/content';
import { formatDate, memberLine } from '@/lib/format';
import { mailto } from '@/lib/mailto';
import { albumShareText } from '@/lib/share-text';
import { siteOrigin, whatsappShareUrl } from '@/lib/share';
import { OutlineNumeral } from '@/app/(app)/directory/batch/OutlineNumeral';
import { PhotoWall, type PhotoTag, type WallPhoto } from './Lightbox';

/**
 * One album.
 *
 * The state the fixtures insist on is an album that exists, has a real
 * photograph count against it, and has no image files yet. That is what a
 * college looks like in week one, so it gets one plain sentence and a way
 * to send photos in — no placeholder tiles, no pixel sizes. When some
 * files have arrived, only those are drawn and the rest are counted.
 *
 * Tags resolve through `searchDirectory`, which applies the viewer's
 * projection and the directory's own visibility rules. A member the viewer
 * may not enumerate comes back as a name with no link, never as a profile
 * URL the guard would have refused.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const album = getAlbumBySlug(slug);
  if (!album) return { title: 'Album not found' };
  return {
    title: album.title,
    description: album.description ?? `Photographs filed under ${album.title}.`,
  };
}

export default async function AlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!isActive(session)) redirect('/pending');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.gallery) notFound();

  const { slug } = await params;

  // No `includeDrafts` on the member side, deliberately. An unpublished
  // album is not merely hidden from the list — it is not addressable here,
  // by direct link or otherwise.
  const album = getAlbumBySlug(slug);
  if (!album) notFound();

  const photos = getAlbumPhotos(album.id);

  const departments = getDepartments();
  const branchName = album.departmentCode
    ? (departments.find((d) => d.code === album.departmentCode)?.name ?? album.departmentCode)
    : null;

  // The event link is resolved through the guarded repo function, so an
  // album pointing at a draft or an alumni-only event simply has no link
  // for a viewer who could not open it anyway.
  const event =
    album.eventSlug && pack.features.events ? getEventBySlug(session, album.eventSlug) : null;

  const directory = searchDirectory(session, { cohort: 'all', perPage: 1000 });
  const members = new Map<string, MemberSummary>(directory.items.map((m) => [m.id, m]));

  const wall: WallPhoto[] = photos.map((photo) => ({
    id: photo.id,
    url: photo.url,
    caption: photo.caption,
    width: photo.width,
    height: photo.height,
    tags: photo.taggedMemberIds.map((id) => toTag(id, members.get(id))),
  }));

  // Only photographs with a file are drawn; the rest are counted.
  const shown = wall.filter((p) => p.url);
  const coming = Math.max(0, album.photoCount - shown.length);
  const hasTags = shown.some((p) => p.tags.length > 0);

  const office = pack.copy.officeName;
  const locale = pack.locale;
  const support = pack.copy.supportEmail ?? null;
  const coverSrc = album.coverImage ?? shown[0]?.url ?? null;
  const creditLine = albumCredit(album.contributedBy, office);
  const contributor = parseContributor(album.contributedBy);
  // The count is stated only when there are photos to show; a count over
  // an empty page is a promise the page then breaks.
  const photoCount =
    shown.length > 0 ? `${album.photoCount.toLocaleString('en-IN')} photo${album.photoCount === 1 ? '' : 's'}` : null;
  const date = formatDate(album.takenOn, locale);
  const place = memberLine([branchName, album.batchYear ? `Batch of ${album.batchYear}` : null]);

  const origin = await siteOrigin();
  const url = `${origin}/gallery/${album.slug}`;
  const addHref = support
    ? mailto(support, `Photos for ${album.title}`, [
        `Album: ${album.title}`,
        'How many photos I have:',
        'How I would like to be credited:',
        '',
      ])
    : null;
  const untagHref = support
    ? mailto(support, 'Please untag me', [`Album: ${album.title}`, 'Photo (a caption or a description):', ''])
    : null;

  // More from the same batch and the same branch, each only when there is
  // something; an album filed college-wide gets the newest others instead.
  const others = getAlbums().filter((a) => a.id !== album.id);
  const sameBatch = album.batchYear ? others.filter((a) => a.batchYear === album.batchYear).slice(0, 4) : [];
  const sameBranch = album.departmentCode
    ? others.filter((a) => a.departmentCode === album.departmentCode && !sameBatch.includes(a)).slice(0, 4)
    : [];
  const rows: Array<{ title: string; albums: GalleryAlbum[] }> = [
    ...(sameBatch.length ? [{ title: `More from Batch of ${album.batchYear}`, albums: sameBatch }] : []),
    ...(sameBranch.length ? [{ title: `More from ${branchName ?? album.departmentCode}`, albums: sameBranch }] : []),
  ];
  if (rows.length === 0 && others.length > 0) rows.push({ title: 'More albums', albums: others.slice(0, 4) });

  // The band carries the album: its cover behind the scrim at lg when there
  // is one, otherwise the batch, branch or year as a giant outlined numeral.
  // Actions sit on the band in the band's own button variants.
  const bandPhoto = coverSrc ? { src: coverSrc, alt: '', focus: '50% 50%' } : null;
  const motif = album.batchYear ? String(album.batchYear) : (album.departmentCode ?? date.slice(-4));

  const band = (
    <PageBand
      pack={pack}
      eyebrow={place || 'Photos'}
      title={album.title}
      lead={album.description ?? undefined}
      photo={bandPhoto}
      photoOnPhones
      aside={bandPhoto ? undefined : <OutlineNumeral>{motif}</OutlineNumeral>}
      meta={
        <>
          <BandChip icon={<Camera />}>{date}</BandChip>
          {photoCount ? <BandChip icon={<Images />}>{photoCount}</BandChip> : null}
          <BandChip>{creditLine}</BandChip>
          {contributor ? <BandChip>Contributed</BandChip> : null}
        </>
      }
      actions={
        <div className="w-full space-y-3">
          <ShareActions
            band
            url={url}
            whatsappHref={whatsappShareUrl(albumShareText(pack, album), url)}
            title={album.title}
            size="sm"
          />
          {event || addHref ? (
            <div className="flex flex-wrap gap-2">
              {event ? (
                <ButtonLink href={`/events/${event.slug}`} variant="band-outline" size="sm" className="min-h-11">
                  <Ticket className="size-4 shrink-0" aria-hidden="true" />
                  From the event: {event.title}
                </ButtonLink>
              ) : null}
              {addHref ? (
                <ButtonLink href={addHref} variant="band-outline" size="sm" className="min-h-11">
                  <Camera className="size-4 shrink-0" aria-hidden="true" />
                  Add your photos
                </ButtonLink>
              ) : null}
            </div>
          ) : null}
        </div>
      }
    />
  );

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Breadcrumbs items={[{ label: 'Photos', href: '/gallery' }, { label: album.title }]} />
        {band}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={<Images className="size-5" />}
          // "Add your photos" sits in the actions above; one ask is enough.
          title={
            addHref
              ? 'There are no photos to show in this album yet. Graduates who were there can add theirs.'
              : 'There are no photos to show in this album yet.'
          }
        />
      ) : (
        <section aria-labelledby="album-photos" className="space-y-3">
          <h2 id="album-photos" className="sr-only">
            Photos
          </h2>
          {hasTags ? (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-secondary">
              <Tooltip label="Tags link to profiles and never share contact details">
                <span
                  tabIndex={0}
                  aria-label="Tags link to profiles and never share contact details"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                >
                  <Info className="size-4 shrink-0 text-muted" aria-hidden="true" />
                  About tags
                </span>
              </Tooltip>
              {untagHref ? (
                <a href={untagHref} className="link inline-flex min-h-11 items-center">
                  Ask to be untagged
                </a>
              ) : null}
            </p>
          ) : null}
          <PhotoWall
            photos={shown}
            albumTitle={album.title}
            credit={contributor ? creditLine : null}
          />
          {coming > 0 ? (
            <p className="text-sm text-secondary">+{coming.toLocaleString('en-IN')} more coming</p>
          ) : null}
        </section>
      )}

      {rows.map((row) => (
        <Section key={row.title} title={row.title} className="border-t border-line pt-6">
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4">
            {row.albums.map((a) => (
              <li key={a.id} className="min-w-0">
                <AlbumCard
                  album={a}
                  coverSrc={a.coverImage ?? getAlbumPhotos(a.id).find((p) => p.url)?.url ?? null}
                  href={`/gallery/${a.slug}`}
                  locale={locale}
                  credit={albumCredit(a.contributedBy, office)}
                  showCount={getAlbumPhotos(a.id).some((p) => p.url)}
                  className={
                    a.coverImage || getAlbumPhotos(a.id).some((p) => p.url) ? undefined : '[&_figure>div]:aspect-[5/2]'
                  }
                />
              </li>
            ))}
          </ul>
        </Section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

/**
 * A tagged member, as far as this viewer is concerned.
 *
 * `searchDirectory` has already applied the viewer's tier and the statuses
 * they may enumerate — a student cannot list other students, so a tagged
 * final-year comes back missing. The tag is still shown, because the
 * photograph plainly has somebody in it, but it is not a link to a profile
 * the guard would refuse a second later.
 */
function toTag(id: string, member: MemberSummary | undefined): PhotoTag {
  if (!member) {
    return { id, name: 'A tagged member', slug: null, photoUrl: null, line: null };
  }
  return {
    id,
    name: member.fullName,
    slug: member.slug,
    photoUrl: member.photoUrl,
    line: memberLine([member.departmentCode, member.batchYear]),
  };
}

/**
 * One line of credit, as on the album grid: "Sent in by Sandeep Kolli ·
 * CSE ’15" for a graduate's own album, "Posted by the alumni cell" for the
 * office's, and any other college body named as it named itself.
 */
function albumCredit(contributedBy: string | null, office: string): string {
  const member = parseContributor(contributedBy);
  if (member) return `Sent in by ${member.name} · ${member.branch} ’${String(member.year).slice(-2)}`;
  if (!contributedBy || contributedBy.trim().toLowerCase() === office.trim().toLowerCase()) {
    return `Posted by the ${office}`;
  }
  const body = contributedBy.trim();
  const needsThe = !/^the\b/i.test(body) && /\b(department|office|cell|club|committee|society|association|council)\b/i.test(body);
  return `Posted by ${needsThe ? 'the ' : ''}${body}`;
}
