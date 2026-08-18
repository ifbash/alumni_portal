import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CalendarDays, ImageOff, Images, ShieldCheck, Ticket, Users } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { isActive } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDepartments, getEventBySlug, searchDirectory } from '@/lib/data/repo';
import { getAlbumBySlug, getAlbumPhotos } from '@/lib/data/content';
import type { MemberSummary } from '@/lib/data/types';
import {
  Alert,
  Avatar,
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  DetailRow,
  EmptyState,
  PageHeader,
} from '@/components/ui';
import { MarginNote } from '@/components/brand/Marks';
import { formatDate, formatRelative, memberLine } from '@/lib/format';
import { PhotoWall, type PhotoTag, type WallPhoto } from './Lightbox';

/**
 * One album.
 *
 * The interesting state is the one the fixtures insist on: an album that
 * exists, has a real photograph count against it, and has no image files
 * yet. That is exactly what a college looks like in week one, and it is
 * what the archive looked like the day the previous system's contract
 * lapsed — so the page is built for it rather than around it.
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
    description: album.description ?? `${album.photoCount} photographs filed under ${album.title}.`,
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
  const uploaded = photos.filter((p) => p.url).length;
  const missing = photos.length - uploaded;
  const unindexed = Math.max(0, album.photoCount - photos.length);

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

  const taggedPeople = new Set(photos.flatMap((p) => p.taggedMemberIds));
  const by = credit(album.contributedBy);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Photographs', href: '/gallery' },
              { label: album.title },
            ]}
          />
        }
        eyebrow={memberLine([
          album.departmentCode ?? 'All branches',
          album.batchYear ? `Batch of ${album.batchYear}` : null,
        ])}
        title={album.title}
        description={
          album.description ??
          'No description was written for this album. What is in it is below, in the order the alumni cell filed it.'
        }
        actions={
          <>
            {event ? (
              <ButtonLink href={`/events/${event.slug}`} variant="secondary">
                <Ticket className="size-4" aria-hidden="true" />
                {event.title}
              </ButtonLink>
            ) : null}
            <ButtonLink href="/gallery" variant="ghost">
              All albums
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-4">
          {photos.length === 0 ? (
            <EmptyState
              icon={<Images className="size-5" />}
              title="This album has no photographs in it yet"
              description={
                album.photoCount > 0
                  ? `${album.photoCount.toLocaleString('en-IN')} photographs are counted against this album, but none of them has reached the portal. The alumni cell is working through the export from the previous system.`
                  : 'The album was created ahead of the event it is for. Photographs appear here as they are uploaded.'
              }
              action={
                <ButtonLink href="/gallery" variant="secondary">
                  Back to the albums
                </ButtonLink>
              }
            />
          ) : (
            <>
              {missing > 0 ? (
                <Alert
                  tone="neutral"
                  icon={<ImageOff className="size-4" />}
                  title={
                    uploaded === 0
                      ? 'None of these photographs has been uploaded yet'
                      : `${missing} of these ${photos.length} photographs are still missing their file`
                  }
                >
                  <p>
                    The records exist — caption, dimensions, who is in them — but the image files have not arrived.
                    Each tile below is drawn at the true shape of the photograph it is waiting for, so nothing on this
                    page will move when they land.
                  </p>
                </Alert>
              ) : null}

              <PhotoWall photos={wall} albumTitle={album.title} />

              {unindexed > 0 ? (
                <p className="text-xs text-muted">
                  Showing <span className="tabular">{photos.length}</span> of{' '}
                  <span className="tabular">{album.photoCount.toLocaleString('en-IN')}</span> photographs recorded
                  against this album. The rest are still on the alumni cell&rsquo;s drive, waiting on the migration
                  from the college&rsquo;s previous system.
                </p>
              ) : null}
            </>
          )}

          <Alert tone="neutral" icon={<ShieldCheck className="size-4" />} title="About the tags">
            <p>
              A tag is a link to that person&rsquo;s profile and nothing more. It releases no email address, no
              mobile number and no employer — the profile applies its own rules to whoever opens it, exactly as it
              does from the directory. If you are tagged and would rather not be, tell the alumni cell and the tag
              comes off; nobody will ask you to justify it.
            </p>
          </Alert>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardBody>
              <h2 className="mb-2 font-display text-lg font-semibold">About this album</h2>
              <dl>
                <DetailRow label="Photographs">
                  <span className="tabular">{album.photoCount.toLocaleString('en-IN')}</span>
                  {unindexed > 0 ? (
                    <span className="text-muted"> · {photos.length} in the portal</span>
                  ) : null}
                </DetailRow>
                <DetailRow label="Taken">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    {formatDate(album.takenOn, pack.locale)}
                    <span className="text-xs font-normal text-muted">{formatRelative(album.takenOn)}</span>
                  </span>
                </DetailRow>
                <DetailRow label="Branch">{branchName ?? 'All branches'}</DetailRow>
                <DetailRow label="Batch">
                  {album.batchYear ? `Class of ${album.batchYear}` : <span className="text-muted">Not batch-specific</span>}
                </DetailRow>
                <DetailRow label="Event">
                  {event ? (
                    <Link href={`/events/${event.slug}`} className="link">
                      {event.title}
                    </Link>
                  ) : album.eventSlug ? (
                    <span className="text-muted">Linked to an event you cannot open</span>
                  ) : (
                    <span className="text-muted">Not from an event</span>
                  )}
                </DetailRow>
                <DetailRow label="People tagged">
                  {taggedPeople.size > 0 ? (
                    <span className="tabular">{taggedPeople.size}</span>
                  ) : (
                    <span className="text-muted">Nobody yet</span>
                  )}
                </DetailRow>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <h2 className="font-display text-lg font-semibold">Contributed by</h2>

              <div className="flex items-center gap-3">
                <Avatar name={by.name} size="md" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{by.name}</p>
                  <p className="truncate text-xs text-muted">{by.byMember ? by.line : 'College record'}</p>
                </div>
              </div>

              {by.byMember ? (
                <>
                  <Badge tone="accent">
                    <Users className="size-3" aria-hidden="true" />
                    Sent in by a graduate
                  </Badge>
                  <MarginNote>
                    These photographs are here because one person went looking for them. The credit stays on the
                    album permanently — it is not removed when the alumni cell edits a caption or picks a different
                    cover.
                  </MarginNote>
                </>
              ) : (
                <p className="text-sm text-secondary">
                  Filed by the college. If you have photographs from the same day, the alumni cell will add them to
                  this album under your own name.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-2">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <CalendarDays className="size-4 text-muted" aria-hidden="true" />
                Near this one
              </h2>
              <p className="text-sm text-secondary">
                {album.departmentCode || album.batchYear
                  ? 'The archive filters on the same branch and batch this album is filed under.'
                  : 'This album is filed college-wide, so it turns up under every branch filter as well as none.'}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {album.departmentCode ? (
                  <ButtonLink href={`/gallery?branch=${album.departmentCode}`} variant="secondary" size="sm">
                    More from {album.departmentCode}
                  </ButtonLink>
                ) : null}
                {album.batchYear ? (
                  <ButtonLink href={`/gallery?batch=${album.batchYear}`} variant="secondary" size="sm">
                    More from {album.batchYear}
                  </ButtonLink>
                ) : null}
                {!album.departmentCode && !album.batchYear ? (
                  <ButtonLink href="/gallery" variant="secondary" size="sm">
                    Browse the archive
                  </ButtonLink>
                ) : null}
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>
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

/** Same rule as the album grid: "Name (BRANCH, YEAR)" is a member credit. */
const MEMBER_CREDIT = /^(.+?)\s*\(([A-Za-z]+),\s*(\d{4})\)$/;

function credit(contributedBy: string | null): { name: string; byMember: boolean; line: string | null } {
  if (!contributedBy) return { name: 'Alumni Cell', byMember: false, line: null };
  const match = MEMBER_CREDIT.exec(contributedBy.trim());
  if (!match) return { name: contributedBy, byMember: false, line: null };
  return { name: match[1]!, byMember: true, line: `${match[2]} · Batch of ${match[3]}` };
}
