import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CalendarDays, Camera, Images, ImageOff, Ticket, UserRound } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { isActive } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDepartments } from '@/lib/data/repo';
import { getAlbums, type GalleryAlbum } from '@/lib/data/content';
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  EmptyState,
  Field,
  PageHeader,
  Select,
} from '@/components/ui';
import { MarginNote } from '@/components/brand/Marks';
import { formatDate, formatRelative } from '@/lib/format';

/**
 * Photographs.
 *
 * Two things this page has to get right, and neither of them is the grid.
 *
 * First, the **credit**. An album of the CSE block as it stood in 2011
 * exists because one graduate went through a drawer and sent thirty-four
 * scans to the alumni cell. Their name on the card is the whole of what
 * they get for it, and it is the reason a second person does the same, so
 * the contributor is a first-class field here rather than a footnote on
 * the detail page.
 *
 * Second, the **honest empty**. No photograph in this build carries an
 * image file, and a college's first month looks exactly the same — albums
 * created, files not yet uploaded. A layout that only works once the
 * pictures arrive is a layout nobody has tested, so a cover with no image
 * is drawn as a labelled tile instead of being left to the browser's
 * broken-image icon.
 */

export const metadata: Metadata = {
  title: 'Photographs',
  description: 'Albums from campus events, reunions and batches, including photographs contributed by alumni.',
};

const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  // A pending account can sign in and read its own profile. It holds no
  // roles, so it has no business browsing the college's photographs.
  if (!isActive(session)) redirect('/pending');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  // A bought feature, not a given. A college that has not taken the gallery
  // must 404 here, not merely lose the sidebar link.
  if (!pack.features.gallery) notFound();

  const params = await searchParams;
  const departments = getDepartments();
  const branch = pickBranch(
    one(params.branch),
    departments.map((d) => d.code),
  );
  const batch = pickBatch(one(params.batch));

  // `getAlbums` keeps college-wide albums in the result whichever branch is
  // chosen — an album with no branch on it belongs to everybody. The batch
  // filter below follows the same rule, for the same reason.
  const everything = getAlbums();
  const albums = getAlbums({ departmentCode: branch || undefined }).filter((a) => inBatch(a, batch));

  const years = [...new Set(everything.map((a) => a.batchYear).filter((y): y is number => y !== null))].sort(
    (a, b) => b - a,
  );

  const branchOptions = departments
    .map((d) => ({
      code: d.code,
      name: d.name,
      count: getAlbums({ departmentCode: d.code }).filter((a) => inBatch(a, batch)).length,
    }))
    .filter((d) => d.count > 0 || d.code === branch);

  const batchOptions = years
    .map((year) => ({
      year,
      count: getAlbums({ departmentCode: branch || undefined }).filter((a) => inBatch(a, String(year))).length,
    }))
    .filter((b) => b.count > 0 || String(b.year) === batch);

  const filtered = Boolean(branch || batch);
  const photographs = albums.reduce((n, a) => n + a.photoCount, 0);
  const contributed = everything.filter((a) => credit(a.contributedBy).byMember).length;
  const support = pack.copy.supportEmail;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${pack.copy.shortName} archive`}
        title="Photographs"
        description="Albums from meets, convocations, lab openings and sports days — and whatever graduates have sent in from their own drawers. Every album names who contributed it, because that credit is the only thing anybody gets for the trouble."
      />

      <Card>
        <CardBody>
          <form
            method="get"
            action="/gallery"
            className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
          >
            <Field
              htmlFor="gal-branch"
              label="Branch"
              hint="College-wide albums stay in the list whichever branch you pick."
            >
              <Select id="gal-branch" name="branch" defaultValue={branch}>
                <option value="">All branches</option>
                {branchOptions.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.code} — {d.name} ({d.count})
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              htmlFor="gal-batch"
              label="Batch"
              hint="Year of passing the album is about, where one has been recorded."
            >
              <Select id="gal-batch" name="batch" defaultValue={batch}>
                <option value="">Every batch</option>
                {batchOptions.map((b) => (
                  <option key={b.year} value={String(b.year)}>
                    {b.year} ({b.count})
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex items-center gap-2">
              <Button type="submit">Apply</Button>
              {filtered ? (
                <ButtonLink href="/gallery" variant="ghost">
                  Clear
                </ButtonLink>
              ) : null}
            </div>
          </form>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-secondary">
          {albums.length === 0 ? (
            <>No albums match</>
          ) : (
            <>
              <span className="tabular font-medium text-primary">{albums.length}</span>{' '}
              {albums.length === 1 ? 'album' : 'albums'}
              {filtered ? <> under {describeFilter(branch, batch, departments)}</> : null} ·{' '}
              <span className="tabular">{photographs.toLocaleString('en-IN')}</span> photographs on record
            </>
          )}
        </p>

        {contributed > 0 ? (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <UserRound className="size-3.5" aria-hidden="true" />
            {contributed} {contributed === 1 ? 'album was' : 'albums were'} sent in by graduates
          </p>
        ) : null}
      </div>

      {albums.length === 0 ? (
        <EmptyState
          icon={<Images className="size-5" />}
          title={filtered ? 'Nothing filed under that yet' : 'The archive is empty so far'}
          description={
            filtered
              ? 'Albums carry a branch and a batch only when the photographs are about one. Meets and convocations are filed college-wide, so widening the filter usually brings them back.'
              : 'The alumni cell files photographs here after each meet, and graduates send in their own. Neither has happened for this college yet.'
          }
          action={
            filtered ? (
              <ButtonLink href="/gallery" variant="secondary">
                Show every album
              </ButtonLink>
            ) : null
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <li key={album.id} className="relative">
              <AlbumCard album={album} />
            </li>
          ))}
        </ul>
      )}

      <Card>
        <CardBody className="space-y-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Camera className="size-4 text-muted" aria-hidden="true" />
            Sending in your own
          </h2>
          <p className="max-w-prose text-sm text-secondary">
            Scans of a batch trip, a lab that has since been rebuilt, a hostel corridor at 2am before an exam — the
            alumni cell will file them as an album under your name and your batch. Write to{' '}
            {support ? (
              <a href={`mailto:${support}`} className="link">
                {support}
              </a>
            ) : (
              <span className="font-medium text-primary">the alumni cell</span>
            )}{' '}
            with the year and the branch, and somebody will come back to you before anything goes live.
          </p>
          <MarginNote className="max-w-prose border-t border-line pt-3">
            A contributed album is reviewed before it appears, and whoever reviews it tells you what was decided
            either way. Tagging somebody in a photograph is a link to their profile and releases none of their
            contact details; anyone can ask to be untagged, and it is done without an argument.
          </MarginNote>
        </CardBody>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------
// Card
// ---------------------------------------------------------------

function AlbumCard({ album }: { album: GalleryAlbum }) {
  const by = credit(album.contributedBy);

  return (
    <Card as="article" interactive className="flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[3/2] border-b border-line bg-surface-sunken">
        {album.coverImage ? (
          // College- and member-supplied storage URLs; see next.config.ts on
          // why brand and archive imagery bypasses the image optimiser.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={album.coverImage} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1.5 p-4 text-center">
            <ImageOff className="size-6 text-muted" aria-hidden="true" />
            <p className="text-xs font-medium text-secondary">No cover picked yet</p>
            <p className="text-xs text-muted">
              <span className="tabular">{album.photoCount.toLocaleString('en-IN')}</span> photographs waiting on
              an upload
            </p>
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge tone={album.departmentCode ? 'brand' : 'outline'}>{album.departmentCode ?? 'All branches'}</Badge>
          {album.batchYear ? <Badge tone="neutral">Batch of {album.batchYear}</Badge> : null}
        </div>
      </div>

      <CardBody className="flex min-w-0 flex-1 flex-col gap-2.5">
        <h2 className="font-display text-lg font-semibold leading-snug">
          <Link href={`/gallery/${album.slug}`} className="link-quiet after:absolute after:inset-0">
            {album.title}
          </Link>
        </h2>

        {album.description ? (
          <p className="line-clamp-3 text-sm text-secondary">{album.description}</p>
        ) : (
          <p className="text-sm text-muted">
            Nobody wrote a description for this one. The photographs are still there.
          </p>
        )}

        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <Images className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
            <span className="tabular">{album.photoCount.toLocaleString('en-IN')}</span> photographs
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
            {formatDate(album.takenOn)}
          </span>
          {album.eventSlug ? (
            <span className="inline-flex items-center gap-1.5">
              <Ticket className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
              Tied to an event
            </span>
          ) : null}
        </p>

        <div className="mt-auto flex items-center gap-2.5 border-t border-line pt-3">
          <Avatar name={by.name} size="xs" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{by.name}</p>
            <p className="truncate text-xs text-muted">
              {by.byMember ? by.line : 'College record'} · {formatRelative(album.takenOn)}
            </p>
          </div>
          {by.byMember ? <Badge tone="accent">Contributed</Badge> : null}
        </div>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

/**
 * Who contributed an album, and whether that was a member.
 *
 * The contribution form records a graduate as "Name (BRANCH, YEAR)" and a
 * college office by its own name. Telling the two apart matters: a
 * member's credit is the reason they sent the photographs, and it earns
 * the badge that shows the next graduate this is a thing people do here.
 */
const MEMBER_CREDIT = /^(.+?)\s*\(([A-Za-z]+),\s*(\d{4})\)$/;

function credit(contributedBy: string | null): { name: string; byMember: boolean; line: string | null } {
  if (!contributedBy) return { name: 'Alumni Cell', byMember: false, line: null };
  const match = MEMBER_CREDIT.exec(contributedBy.trim());
  if (!match) return { name: contributedBy, byMember: false, line: null };
  return { name: match[1]!, byMember: true, line: `${match[2]} · Batch of ${match[3]}` };
}

function inBatch(album: GalleryAlbum, batch: string): boolean {
  if (!batch) return true;
  // An album with no year on it is not about a batch, so a batch filter
  // never excludes it — the same rule the branch filter already applies.
  if (album.batchYear === null) return true;
  return String(album.batchYear) === batch;
}

function pickBranch(raw: string | undefined, codes: string[]): string {
  const value = raw?.trim().toUpperCase() ?? '';
  return codes.includes(value) ? value : '';
}

function pickBatch(raw: string | undefined): string {
  const value = raw?.trim() ?? '';
  return /^(19|20)\d{2}$/.test(value) ? value : '';
}

function describeFilter(
  branch: string,
  batch: string,
  departments: Array<{ code: string; name: string }>,
): string {
  const parts: string[] = [];
  if (branch) parts.push(departments.find((d) => d.code === branch)?.name ?? branch);
  if (batch) parts.push(`the batch of ${batch}`);
  return parts.join(' and ');
}
