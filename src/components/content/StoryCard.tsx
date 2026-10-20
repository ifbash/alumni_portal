import * as React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { CoverArt, MediaFrame } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import type { LocaleSpec } from '@/lib/branding/pack';
import type { NewsItem } from '@/lib/data/content';

/**
 * One story from the news desk, the same on the home page, the news hub
 * and the console's feed preview. Isomorphic.
 *
 * The photo is the story's own `coverImage`, else `CoverArt` with the
 * `motif` the page chose (a branch code, a year), else nothing. An
 * obituary is never dressed: no art, no tint, no coloured element — the
 * headline and the date.
 */

export type StoryCardData = Pick<
  NewsItem,
  'slug' | 'kind' | 'title' | 'summary' | 'coverImage' | 'departmentCode' | 'publishedAt'
>;

export function StoryCard({
  story,
  href,
  locale,
  variant,
  eyebrow,
  motif,
  action,
  className,
}: {
  story: StoryCardData;
  href: string;
  locale: LocaleSpec;
  variant: 'lead' | 'card' | 'row';
  /** The kind, as the page words it ("Achievement"), with its icon. */
  eyebrow: React.ReactNode;
  /** The CoverArt datum when there is no cover photo. Omit for no art. */
  motif?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  const obituary = story.kind === 'obituary';
  const date = story.publishedAt
    ? formatDate(story.publishedAt, { locale: locale.locale, timeZone: locale.timeZone })
    : null;

  const headline = (
    <Link href={href} className="link-quiet after:absolute after:inset-0 after:rounded-lg">
      {story.title}
    </Link>
  );

  const eyebrowLine = (
    <p className="flex flex-wrap items-center gap-x-2 text-xs font-medium text-secondary">
      <span className="inline-flex items-center gap-1.5 [&_svg]:size-3.5">{eyebrow}</span>
      {date ? (
        <>
          <span aria-hidden="true" className="text-muted">·</span>
          <span>{date}</span>
        </>
      ) : null}
    </p>
  );

  if (obituary && variant === 'row') {
    // Laid out like every other row so the list keeps its grid, but with
    // nothing dressed: the kind in plain words, the headline, the date.
    return (
      <article className={cn('relative flex items-start gap-4 py-4', className)}>
        {date ? <p className="hidden w-24 shrink-0 pt-0.5 text-sm tabular text-secondary sm:block">{date}</p> : null}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="sm:hidden">{eyebrowLine}</div>
          <p className="hidden items-center gap-1.5 text-xs font-medium text-secondary sm:flex [&_svg]:size-3.5">{eyebrow}</p>
          <h3 className="font-display text-md font-semibold leading-snug">{headline}</h3>
        </div>
        {action ? <div className="relative z-10 shrink-0 self-center">{action}</div> : null}
      </article>
    );
  }

  if (obituary) {
    return (
      <article className={cn('relative rounded-lg border border-line bg-surface-raised p-4', className)}>
        {eyebrowLine}
        <h3 className="mt-1 font-display text-md font-semibold leading-snug">{headline}</h3>
        {variant !== 'row' ? <p className="mt-1 line-clamp-2 text-sm text-secondary">{story.summary}</p> : null}
        {action ? <div className="relative z-10 mt-3">{action}</div> : null}
      </article>
    );
  }

  const art = motif ? <CoverArt motif={motif} /> : undefined;

  if (variant === 'row') {
    // Date-led, like a table of contents: the date sits in its own column so
    // a run of rows scans down the page by when, then by what.
    return (
      <article className={cn('relative flex items-start gap-4 py-4', className)}>
        {date ? (
          <p className="hidden w-24 shrink-0 pt-0.5 text-sm tabular text-secondary sm:block">{date}</p>
        ) : null}
        {story.coverImage ? (
          <MediaFrame src={story.coverImage} alt="" aspect="1/1" className="w-16 shrink-0" />
        ) : null}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="sm:hidden">{eyebrowLine}</div>
          <p className="hidden items-center gap-1.5 text-xs font-medium text-secondary sm:flex [&_svg]:size-3.5">{eyebrow}</p>
          <h3 className="line-clamp-2 font-display text-md font-semibold leading-snug">{headline}</h3>
        </div>
        {action ? <div className="relative z-10 shrink-0 self-center">{action}</div> : null}
      </article>
    );
  }

  const lead = variant === 'lead';
  const photo = Boolean(story.coverImage || art);

  return (
    <article
      className={cn(
        'lift relative flex h-full flex-col overflow-hidden rounded-xl border border-line shadow-sm',
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-[var(--surface)]',
        // Set in type alone, the lead takes a wash of the college's tint so the
        // front page still has a front; a photo replaces the wash.
        lead && !photo
          ? 'bg-[linear-gradient(135deg,var(--brand-soft),var(--surface-raised)_65%)]'
          : 'bg-surface-raised',
        className,
      )}
    >
      <MediaFrame
        src={story.coverImage}
        alt=""
        aspect={lead ? '16/9' : '3/2'}
        fallback={art}
        rounded={false}
        className="[&>div]:border-0 [&>div]:border-b"
      />
      <div className={cn('flex flex-1 flex-col gap-2', lead ? 'p-6 sm:p-8' : 'p-5')}>
        {eyebrowLine}
        {/* Joined, not `cn`: tailwind-merge drops `text-display-*` beside a colour. */}
        <h3
          className={`font-display font-semibold leading-tight ${lead ? 'max-w-[26ch] text-display-sm' : 'line-clamp-3 text-xl'}`}
        >
          {headline}
        </h3>
        <p className={cn('text-secondary', lead ? 'line-clamp-3 max-w-prose text-md' : 'line-clamp-3 text-sm')}>{story.summary}</p>
        {action ? (
          <div className="relative z-10 mt-auto pt-3">{action}</div>
        ) : (
          <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-semibold text-brand-fg" aria-hidden="true">
            Read
            <ArrowUpRight className="size-4" />
          </span>
        )}
      </div>
    </article>
  );
}
