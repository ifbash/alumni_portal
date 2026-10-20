import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Camera, Images, Mail, MessageCircle } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { isActive } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDepartments } from '@/lib/data/repo';
import { getAlbumPhotos, getAlbums, type GalleryAlbum } from '@/lib/data/content';
import { ButtonLink, Card, CardBody, ChipNav, EmptyState, PageHeader } from '@/components/ui';
import { AlbumCard, parseContributor } from '@/components/content';
import { viewerBatchYear, viewerBranch } from '@/lib/identity';
import { mailto } from '@/lib/mailto';
import { cn } from '@/lib/cn';

/**
 * Photographs.
 *
 * Two things this page has to get right, and neither of them is the grid.
 *
 * First, the **credit**. An album of the CSE block as it stood in 2011
 * exists because one graduate went through a drawer and sent their scans
 * to the office. Their name on the card is the whole of what they get for
 * it, and it is the reason a second person does the same, so the
 * contributor is a first-class line on every album rather than a footnote.
 *
 * Second, the **honest empty**. An album with no photo to show is drawn
 * as an even, slim `CoverArt` strip carrying its year or branch, never as
 * a large empty frame, and it states no photo count it cannot back. There
 * is no broken-image icon and no "waiting on an upload" anywhere.
 */

export const metadata: Metadata = {
  title: 'Photos',
  description: 'Meets, convocations and batch memories, including photos sent in by graduates.',
};

/** Frame shapes for the mosaic, cycled by position. Art-only albums keep to wide and square. */
const PHOTO_SHAPES = ['3/2', '4/5', '1/1', '4/3', '3/2', '4/5'] as const;
const ART_SHAPES = ['4/3', '5/2', '1/1', '5/2', '4/3'] as const;

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

  const office = pack.copy.officeName;
  const locale = pack.locale;
  const filtered = Boolean(branch || batch);

  // Chips: All · My batch · My branch, then the years and branches that
  // actually have an album. Each is a link, so a filtered view can be sent
  // to a batch group as it stands.
  const myBatch = viewerBatchYear(session);
  const myBranch = viewerBranch(session);
  const years = [...new Set(everything.map((a) => a.batchYear).filter((y): y is number => y !== null))].sort(
    (a, b) => b - a,
  );
  const branches = departments
    .map((d) => d.code)
    .filter((code) => everything.some((a) => a.departmentCode === code));
  const href = (q: { branch?: string; batch?: string | number }) => {
    const s = new URLSearchParams();
    if (q.branch) s.set('branch', q.branch);
    if (q.batch) s.set('batch', String(q.batch));
    const qs = s.toString();
    return qs ? `/gallery?${qs}` : '/gallery';
  };
  const chips = [
    { label: 'All', href: '/gallery', active: !filtered },
    ...(myBatch
      ? [{ label: 'My batch', href: href({ batch: myBatch }), active: batch === String(myBatch) && !branch }]
      : []),
    ...(myBranch
      ? [{ label: 'My branch', href: href({ branch: myBranch }), active: branch === myBranch && !batch }]
      : []),
    ...years
      .filter((y) => y !== myBatch)
      .map((y) => ({ label: String(y), href: href({ batch: y }), active: batch === String(y) && !branch })),
    ...branches
      .filter((code) => code !== myBranch)
      .map((code) => ({ label: code, href: href({ branch: code }), active: branch === code && !batch })),
  ];

  const coverOf = (album: GalleryAlbum): string | null =>
    album.coverImage ?? getAlbumPhotos(album.id).find((p) => p.url)?.url ?? null;
  // A photo count is only stated for an album that has a photo to show;
  // otherwise the album page would promise what it cannot draw.
  const hasPhotos = (album: GalleryAlbum): boolean => getAlbumPhotos(album.id).some((p) => p.url);

  const creditOf = (album: GalleryAlbum): string => albumCredit(album.contributedBy, office);

  // The newest album leads the unfiltered page, and the next is drawn
  // large, but only when each has a photo of its own. A large slot holding
  // nothing but a year reads as a picture that failed to load, so an album
  // without photos is always an even, slim tile.
  const hero = !filtered && albums[0] && coverOf(albums[0]) ? albums[0] : null;
  const mosaic = hero ? albums.slice(1) : albums;

  const support = pack.copy.supportEmail ?? null;
  const phoneDigits = pack.copy.supportPhone?.replace(/\D/g, '') ?? '';
  const sendHref =
    pack.features.whatsapp && phoneDigits
      ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent('I have photos to send in for the gallery.')}`
      : support
        ? mailto(support, 'Photos for the gallery', [
            'Event or occasion:',
            'Year:',
            'Branch:',
            'How I would like to be credited:',
            '',
          ])
        : null;
  const untagHref = support
    ? mailto(support, 'Please untag me', ['Album:', 'Photo (a caption or a description):', ''])
    : null;

  const viaWhatsApp = Boolean(sendHref?.startsWith('https://'));
  const contribute =
    sendHref || untagHref ? (
      <Card>
        <CardBody className={cn('flex flex-col gap-4', !hero && 'sm:flex-row sm:items-center sm:justify-between')}>
          <p className="flex items-start gap-3 text-md">
            <Camera className="mt-1 size-5 shrink-0 text-muted" aria-hidden="true" />
            <span>Have photos from your batch? Send them in and we will credit you.</span>
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {sendHref ? (
              <ButtonLink
                href={sendHref}
                variant="secondary"
                className="min-h-11"
                {...(viaWhatsApp ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
              >
                {viaWhatsApp ? (
                  <MessageCircle className="size-4 shrink-0" aria-hidden="true" />
                ) : (
                  <Mail className="size-4 shrink-0" aria-hidden="true" />
                )}
                Send in photos
                {viaWhatsApp ? <span className="sr-only"> (opens WhatsApp)</span> : null}
              </ButtonLink>
            ) : null}
            {untagHref ? (
              <a href={untagHref} className="link inline-flex min-h-11 items-center text-sm">
                Ask to be untagged
              </a>
            ) : null}
          </div>
        </CardBody>
      </Card>
    ) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gallery"
        title="Photos"
        description={`Meets, convocations and batch memories from ${pack.copy.shortName}, including photos sent in by graduates.`}
      />

      {/* With no photo to lead with, the way to add some leads instead. */}
      {!hero && contribute ? contribute : null}

      {hero ? (
        <div className="grid grid-cols-1 gap-gutter lg:grid-cols-3 lg:items-start">
          <AlbumCard
            album={hero}
            coverSrc={coverOf(hero)}
            href={`/gallery/${hero.slug}`}
            locale={locale}
            credit={creditOf(hero)}
            variant="hero"
            showCount={hasPhotos(hero)}
            className="lg:col-span-2"
          />
          {contribute ? <div className="hidden lg:block">{contribute}</div> : null}
        </div>
      ) : null}

      {chips.length > 1 ? <ChipNav items={chips} ariaLabel="Filter albums" /> : null}

      {albums.length === 0 ? (
        filtered ? (
          <EmptyState
            variant="inline"
            title="No albums are filed under that yet."
            action={
              <ButtonLink href="/gallery" variant="secondary" className="min-h-11">
                Show every album
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            icon={<Images className="size-5" />}
            title="No albums yet"
            description={`The ${office} files photos here after each meet, and graduates send in their own.`}
            action={
              sendHref ? (
                <ButtonLink href={sendHref} variant="secondary" className="min-h-11">
                  Send in your photos
                </ButtonLink>
              ) : null
            }
          />
        )
      ) : mosaic.length > 0 ? (
        <section aria-labelledby="albums-heading" className="space-y-3">
          <h2 id="albums-heading" className={hero ? 'font-display text-xl font-semibold' : 'sr-only'}>
            {hero ? 'More albums' : 'Albums'}
          </h2>
          {/* A masonry of shapes: CSS columns, so each tile keeps its own height. The shape cycles by position;
              an album with no photo stays gentler (no tall frames), because a tall block that holds only a year
              reads as a picture that failed to load. */}
          <ul className={cn('columns-2 gap-x-4 lg:columns-3', mosaic.length > 8 && 'xl:columns-4')}>
            {mosaic.map((album, i) => {
              const cover = coverOf(album);
              const aspect = cover ? PHOTO_SHAPES[i % PHOTO_SHAPES.length]! : ART_SHAPES[i % ART_SHAPES.length]!;
              return (
                <li key={album.id} className="mb-6 min-w-0 break-inside-avoid">
                  <AlbumCard
                    album={album}
                    coverSrc={cover}
                    href={`/gallery/${album.slug}`}
                    locale={locale}
                    credit={creditOf(album)}
                    variant="tile"
                    aspect={aspect}
                    showCount={hasPhotos(album)}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {hero && contribute ? <div className="lg:hidden">{contribute}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

/**
 * One line of credit. A graduate's own album reads "Sent in by Sandeep
 * Kolli · CSE ’15"; the office's reads "Posted by the alumni cell"; any
 * other college body is named as it named itself.
 */
function albumCredit(contributedBy: string | null, office: string): string {
  const who = credit(contributedBy);
  const member = parseContributor(contributedBy);
  if (who.byMember && member) {
    return `Sent in by ${member.name} · ${member.branch} ’${String(member.year).slice(-2)}`;
  }
  if (!contributedBy || contributedBy.trim().toLowerCase() === office.trim().toLowerCase()) {
    return `Posted by the ${office}`;
  }
  const body = contributedBy.trim();
  const needsThe = !/^the\b/i.test(body) && /\b(department|office|cell|club|committee|society|association|council)\b/i.test(body);
  return `Posted by ${needsThe ? 'the ' : ''}${body}`;
}

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
