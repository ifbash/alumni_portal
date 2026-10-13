import * as React from 'react';
import Link from 'next/link';
import { Badge, CoverArt, MediaFrame } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import type { LocaleSpec } from '@/lib/branding/pack';
import type { GalleryAlbum } from '@/lib/data/content';

/**
 * One photo album. Isomorphic.
 *
 * `coverSrc` is resolved by the page: the album's `coverImage`, else its
 * first photo with a URL, else null. With none, `CoverArt` shows one real
 * datum (the batch year, the branch, or the year taken) and the photo
 * count. A campus photo is never an album cover.
 *
 * An album a graduate sent in is credited "Name (BRANCH, YEAR)" by the
 * console, and wears the accent: a "Contributed" badge, accent art.
 */

export type AlbumCardData = Pick<
  GalleryAlbum,
  'slug' | 'title' | 'takenOn' | 'photoCount' | 'departmentCode' | 'batchYear' | 'contributedBy'
>;

/** "Sandeep Kolli (CSE, 2015)" → its parts. Null for an office credit ("Alumni Cell"). */
export function parseContributor(
  contributedBy: string | null | undefined,
): { name: string; branch: string; year: number } | null {
  const m = contributedBy?.trim().match(/^(.+?)\s*\(([A-Za-z]{2,12}),\s*(\d{4})\)$/);
  if (!m) return null;
  return { name: m[1]!.trim(), branch: m[2]!.toUpperCase(), year: Number(m[3]) };
}

export function isContributed(album: Pick<GalleryAlbum, 'contributedBy'>): boolean {
  return parseContributor(album.contributedBy) !== null;
}

function photos(n: number): string {
  return `${n.toLocaleString('en-IN')} photo${n === 1 ? '' : 's'}`;
}

export function AlbumCard({
  album,
  coverSrc,
  href,
  locale,
  credit,
  variant = 'tile',
  showCount = true,
  state,
  action,
  className,
}: {
  album: AlbumCardData;
  coverSrc: string | null;
  href: string;
  locale: LocaleSpec;
  /** One line, worded by the page: "Posted by the alumni cell", "Sent in by Sandeep · CSE ’15". */
  credit: React.ReactNode;
  /** `hero` 21:9 with the facts on a scrim; `large` 3:2 spanning two columns; `tile` 3:2. */
  variant?: 'hero' | 'large' | 'tile';
  /**
   * Whether to state the photo count. A page passes false when none of the
   * album's photos can be shown, so the card never promises what the album
   * page then cannot draw.
   */
  showCount?: boolean;
  /** A staff chip: "Awaiting review". */
  state?: React.ReactNode;
  /** A staff Menu. */
  action?: React.ReactNode;
  className?: string;
}) {
  const contributed = isContributed(album);
  const date = formatDate(album.takenOn, { locale: locale.locale, timeZone: locale.timeZone });
  const yearTaken = new Intl.DateTimeFormat('en-IN', { year: 'numeric', timeZone: locale.timeZone }).format(
    new Date(album.takenOn),
  );
  const motif = album.batchYear ? String(album.batchYear) : (album.departmentCode ?? yearTaken);
  const count = showCount ? photos(album.photoCount) : null;
  const art = <CoverArt motif={motif} label={count ?? undefined} tone={contributed ? 'accent' : 'brand'} />;
  const facts = count ? `${date} · ${count}` : date;

  const title = (
    <Link href={href} className="link-quiet after:absolute after:inset-0 after:rounded-lg">
      {album.title}
    </Link>
  );

  const chips =
    contributed || state ? (
      <div className="flex flex-wrap items-center gap-1.5">
        {contributed ? <Badge tone="accent">Contributed</Badge> : null}
        {state}
      </div>
    ) : null;

  if (variant === 'hero') {
    return (
      <article className={cn('relative', className)}>
        <MediaFrame
          src={coverSrc}
          alt=""
          aspect="21/9"
          fallback={art}
          loading="eager"
          overlay={
            <div className="space-y-1">
              <h3 className="font-display text-xl font-semibold leading-snug text-band-fg">{title}</h3>
              <p className="text-sm">
                {facts} · {credit}
              </p>
            </div>
          }
        />
        {coverSrc ? null : (
          // No photo means no scrim: the facts go below the art instead.
          <div className="mt-3 space-y-1">
            <h3 className="font-display text-xl font-semibold leading-snug">{title}</h3>
            <p className="text-sm text-secondary">
              {facts} · {credit}
            </p>
          </div>
        )}
        {chips || action ? (
          <div className="relative z-10 mt-3 flex flex-wrap items-center justify-between gap-2">
            {chips}
            {action}
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <article className={cn('relative min-w-0', variant === 'large' && 'sm:col-span-2', className)}>
      <MediaFrame src={coverSrc} alt="" aspect="3/2" fallback={art} />
      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <h3 className="line-clamp-2 font-semibold leading-snug">{title}</h3>
          <p className="text-sm text-secondary">{facts}</p>
          <p className="truncate text-sm text-secondary">{credit}</p>
          {chips ? <div className="relative z-10 pt-1">{chips}</div> : null}
        </div>
        {action ? <div className="relative z-10 shrink-0">{action}</div> : null}
      </div>
    </article>
  );
}
