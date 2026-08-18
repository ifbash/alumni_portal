import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { HardDriveUpload, ImageOff, Images, ImagePlus, Inbox, UserRound } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDepartments } from '@/lib/data/repo';
import { getAlbumPhotos, getAlbums, type GalleryAlbum } from '@/lib/data/content';
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  DefinitionCard,
  EmptyState,
  PageHeader,
  Stat,
  Table,
  TableWrap,
  Tabs,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { MarginNote } from '@/components/brand/Marks';
import { formatDate, formatRelative, memberLine } from '@/lib/format';
import { ReviewActions } from './ReviewActions';

/**
 * The gallery console.
 *
 * The interesting row is never the album the alumni cell uploaded itself —
 * it is the one a graduate sent in and is now waiting on somebody's
 * decision. A contribution that sits unreviewed for three weeks is a
 * contributor who never sends a second batch, so the queue is the first
 * thing on the page rather than a tab you have to remember to open.
 */

export const metadata = { title: 'Gallery' };

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
  const waiting = all.filter((a) => !a.published);
  const contributed = waiting.filter((a) => credit(a.contributedBy).byMember);

  const rows = view === 'published' ? published : view === 'review' ? waiting : all;

  const departments = getDepartments();
  const deptName = (code: string | null) =>
    code ? (departments.find((d) => d.code === code)?.name ?? code) : 'All branches';

  const recorded = all.reduce((n, a) => n + a.photoCount, 0);
  const files = all.reduce((n, a) => n + getAlbumPhotos(a.id).filter((p) => p.url).length, 0);
  const memberAlbums = all.filter((a) => credit(a.contributedBy).byMember).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Gallery"
        description="Albums from meets, convocations and departments, plus whatever graduates send in. An unpublished album is invisible to members — it has no page, and a direct link to it 404s."
        actions={
          <ButtonLink href="/admin/gallery/new">
            <ImagePlus className="size-4" aria-hidden="true" />
            New album
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Published albums"
          value={published.length}
          hint={waiting.length ? `${waiting.length} not published` : 'Nothing unpublished'}
          icon={<Images className="size-4" />}
        />
        <Stat
          label="Awaiting review"
          value={contributed.length}
          hint={contributed.length ? 'Sent in by graduates' : 'Queue is clear'}
          icon={<Inbox className="size-4" />}
        />
        <Stat
          label="Photographs recorded"
          value={recorded.toLocaleString('en-IN')}
          hint={`${files.toLocaleString('en-IN')} image files present`}
          icon={<HardDriveUpload className="size-4" />}
        />
        <Stat
          label="Contributed albums"
          value={memberAlbums}
          hint="Credited to a named graduate"
          icon={<UserRound className="size-4" />}
        />
      </div>

      {files === 0 && recorded > 0 ? (
        <Alert
          tone="warning"
          icon={<ImageOff className="size-4" />}
          title={`${recorded.toLocaleString('en-IN')} photographs are recorded and none has an image file`}
        >
          <p>
            The album records came across from the college&rsquo;s previous system; the image files did not. Members
            see a labelled placeholder at the true shape of each photograph rather than a broken image, so the pages
            read correctly in the meantime — but nothing here is worth publishing until the files land. Chase the
            export before the retention window on the old contract closes.
          </p>
        </Alert>
      ) : null}

      {contributed.length > 0 ? (
        <section aria-labelledby="review-queue" className="space-y-4">
          <h2 id="review-queue" className="font-display text-xl font-semibold">
            Waiting on you
          </h2>

          {contributed.map((album) => {
            const by = credit(album.contributedBy);
            const preview = getAlbumPhotos(album.id).slice(0, 6);

            return (
              <Card key={album.id}>
                <CardBody className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone="warning" dot>
                          Awaiting review
                        </Badge>
                        <Badge tone="accent">Contributed</Badge>
                        <Badge tone={album.departmentCode ? 'brand' : 'outline'}>
                          {album.departmentCode ?? 'All branches'}
                        </Badge>
                        {album.batchYear ? <Badge tone="neutral">Batch of {album.batchYear}</Badge> : null}
                      </div>
                      <h3 className="font-display text-lg font-semibold">{album.title}</h3>
                      <p className="text-sm text-secondary">
                        {by.name}
                        {by.line ? <span className="text-muted"> · {by.line}</span> : null} · submitted{' '}
                        {formatRelative(album.takenOn)} ·{' '}
                        <span className="tabular">{album.photoCount.toLocaleString('en-IN')}</span> photographs
                      </p>
                    </div>
                  </div>

                  {album.description ? (
                    <p className="max-w-prose rounded border border-line bg-surface-sunken p-3 text-sm text-secondary">
                      {album.description}
                    </p>
                  ) : null}

                  {preview.length > 0 ? (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                        First {preview.length} of {album.photoCount.toLocaleString('en-IN')}
                      </p>
                      <ul className="flex flex-wrap gap-2">
                        {preview.map((photo) => (
                          <li
                            key={photo.id}
                            style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
                            className="flex h-20 flex-col items-center justify-center gap-0.5 rounded border border-dashed border-line-strong bg-surface-sunken p-1 text-center"
                          >
                            <ImageOff className="size-4 text-muted" aria-hidden="true" />
                            <span className="font-mono text-xs tabular text-muted">
                              {photo.width}×{photo.height}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <ReviewActions
                    albumId={album.id}
                    albumTitle={album.title}
                    contributorName={by.name}
                    photoCount={album.photoCount}
                  />
                </CardBody>
              </Card>
            );
          })}
        </section>
      ) : null}

      <Tabs
        ariaLabel="Album lists"
        items={[
          { label: 'Every album', href: '/admin/gallery', count: all.length, active: view === 'all' },
          {
            label: 'Published',
            href: '/admin/gallery?view=published',
            count: published.length,
            active: view === 'published',
          },
          {
            label: 'Not published',
            href: '/admin/gallery?view=review',
            count: waiting.length,
            active: view === 'review',
          },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Images className="size-5" />}
          title={view === 'review' ? 'Nothing is waiting' : 'No albums yet'}
          description={
            view === 'review'
              ? 'Every album is published. Contributions from graduates land here first, and they are the ones worth answering quickly.'
              : 'Albums start here: create one for the next meet, or file the photographs a graduate has sent in under their name.'
          }
          action={
            view !== 'review' ? (
              <ButtonLink href="/admin/gallery/new" variant="secondary">
                Create an album
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <>
          <TableWrap caption="Albums with their photograph counts, contributor and publication state" className="hidden sm:block">
            <Table>
              <THead>
                <TR>
                  <TH>Album</TH>
                  <TH>Scope</TH>
                  <TH align="right">Photographs</TH>
                  <TH align="right">Files</TH>
                  <TH>Contributed by</TH>
                  <TH>Taken</TH>
                  <TH>State</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((album) => {
                  const by = credit(album.contributedBy);
                  const withFiles = getAlbumPhotos(album.id).filter((p) => p.url).length;

                  return (
                    <TR key={album.id} interactive className={album.published ? undefined : 'bg-surface-sunken'}>
                      <TD>
                        {album.published ? (
                          <Link
                            href={`/gallery/${album.slug}`}
                            className="font-semibold hover:text-brand-fg hover:underline"
                          >
                            {album.title}
                          </Link>
                        ) : (
                          <span className="font-semibold">{album.title}</span>
                        )}
                        <p className="mt-0.5 font-mono text-xs text-muted">/{album.slug}</p>
                      </TD>
                      <TD>
                        <p className="text-sm">{deptName(album.departmentCode)}</p>
                        <p className="text-xs text-muted">
                          {album.batchYear ? `Batch of ${album.batchYear}` : 'Not batch-specific'}
                          {album.eventSlug ? ' · from an event' : ''}
                        </p>
                      </TD>
                      <TD numeric>{album.photoCount.toLocaleString('en-IN')}</TD>
                      <TD numeric>
                        {withFiles > 0 ? (
                          withFiles.toLocaleString('en-IN')
                        ) : (
                          <span className="text-muted">None</span>
                        )}
                      </TD>
                      <TD>
                        <p className="text-sm">{by.name}</p>
                        <p className="text-xs text-muted">{by.byMember ? by.line : 'College record'}</p>
                      </TD>
                      <TD className="whitespace-nowrap text-secondary">{formatDate(album.takenOn, pack.locale)}</TD>
                      <TD>
                        <StateBadge album={album} />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>

          {/* Below sm a seven-column table is unreadable however it scrolls. */}
          <div className="space-y-3 sm:hidden">
            {rows.map((album) => {
              const by = credit(album.contributedBy);
              return (
                <DefinitionCard
                  key={album.id}
                  title={album.title}
                  subtitle={memberLine([deptName(album.departmentCode), album.batchYear])}
                  rows={[
                    { label: 'Photographs', value: album.photoCount.toLocaleString('en-IN') },
                    { label: 'Contributed by', value: by.name },
                    { label: 'Taken', value: formatDate(album.takenOn, pack.locale) },
                    { label: 'State', value: <StateBadge album={album} /> },
                  ]}
                  actions={
                    album.published ? (
                      <ButtonLink href={`/gallery/${album.slug}`} variant="secondary" size="sm">
                        Open the album
                      </ButtonLink>
                    ) : null
                  }
                />
              );
            })}
          </div>
        </>
      )}

      <MarginNote className="max-w-prose">
        Publishing an album makes every photograph in it visible to every verified member, students included. That is
        the point of an archive, and it is also why a face nobody can name is a reason to leave a photograph out
        rather than a reason to caption it carefully.
      </MarginNote>
    </div>
  );
}

// ---------------------------------------------------------------

function StateBadge({ album }: { album: GalleryAlbum }) {
  if (album.published) {
    return (
      <Badge tone="success" dot>
        Live
      </Badge>
    );
  }
  if (credit(album.contributedBy).byMember) {
    return (
      <Badge tone="warning" dot>
        Awaiting review
      </Badge>
    );
  }
  return (
    <Badge tone="neutral" dot>
      Draft — not visible to members
    </Badge>
  );
}

/** Same rule the member pages use: "Name (BRANCH, YEAR)" is a member credit. */
const MEMBER_CREDIT = /^(.+?)\s*\(([A-Za-z]+),\s*(\d{4})\)$/;

function credit(contributedBy: string | null): { name: string; byMember: boolean; line: string | null } {
  if (!contributedBy) return { name: 'Alumni Cell', byMember: false, line: null };
  const match = MEMBER_CREDIT.exec(contributedBy.trim());
  if (!match) return { name: contributedBy, byMember: false, line: null };
  return { name: match[1]!, byMember: true, line: `${match[2]} · Batch of ${match[3]}` };
}
