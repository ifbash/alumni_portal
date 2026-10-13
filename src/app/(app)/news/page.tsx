import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Newspaper } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { can, isActive } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getNews, type NewsItem } from '@/lib/data/content';
import { findMemberById, getMemberBySlug } from '@/lib/data/repo';
import { ChipNav, EmptyState, PageHeader, ShareActions } from '@/components/ui';
import { StoryCard } from '@/components/content';
import { mailto } from '@/lib/mailto';
import { cn } from '@/lib/cn';
import { storyShareText } from '@/lib/share-text';
import { siteOrigin, whatsappShareUrl } from '@/lib/share';
import { KIND_META, KIND_ORDER, isNewsKind, newsHref } from './kinds';

/**
 * The news feed, laid out like a front page: one lead story, two beside
 * it, the rest as a list.
 *
 * Two rules hold this page together. Drafts are never requested — the
 * member route calls `getNews()` without `includeDrafts`, so an
 * unpublished item is not merely hidden here, it is not in the array. And
 * an obituary is never dressed: it is never the lead, never a card with
 * art beside it, and the shared `StoryCard` draws it with no tint and no
 * colour. The restraint lives in `KIND_META.restrained` rather than in a
 * condition somebody has to remember to write on the next screen.
 */

/**
 * Beside the lead, a card's photo is a 21:9 strip rather than the default
 * 3:2, so the two cards stack to about the lead's height instead of
 * leaving a hole under it.
 *
 * A story with no photo of its own gets no art at all. A large tile that
 * holds only a year or a branch code reads as a picture that failed to
 * load, so the front page is set in type until the college adds photos.
 */
const SLIM_ART = '[&_figure>div]:aspect-[21/9]';

export const metadata: Metadata = {
  title: 'News',
  description: 'What the college and its graduates have been up to.',
};

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!isActive(session)) redirect('/pending');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  // A college that publishes news on its own website turns this off, and
  // then the route does not exist for this tenant at all.
  if (!pack.features.news) notFound();

  const params = await searchParams;
  const requested = Array.isArray(params.kind) ? params.kind[0] : params.kind;
  const kind = isNewsKind(requested) ? requested : null;
  const unknownKind = Boolean(requested) && !kind;

  // No `includeDrafts`. Nothing on a member route may ask for one.
  const items = getNews(kind ? { kind } : {});
  const total = getNews().length;
  const countFor = (k: (typeof KIND_ORDER)[number]) => getNews({ kind: k }).length;

  const locale = pack.locale;
  const office = pack.copy.officeName;
  const origin = await siteOrigin();

  /**
   * An achievement may borrow the photo of the graduate it is about — but
   * only through the directory's own guarded lookup, and only for a viewer
   * who could have found that profile by searching. A news story does not
   * become the way around the directory's rules.
   */
  const canOpenDirectory = pack.features.directory && can(session, 'directory.search.alumni');
  const withPhoto = (item: NewsItem): NewsItem => {
    if (item.coverImage || item.kind !== 'achievement' || !item.aboutMemberId || !canOpenDirectory) return item;
    const seed = findMemberById(item.aboutMemberId);
    const member = seed ? getMemberBySlug(session, seed.slug) : null;
    return member?.photoUrl ? { ...item, coverImage: member.photoUrl } : item;
  };

  // Chips: every kind with something in it, plus the active one. In
  // memoriam carries no count and always comes last.
  const chips = [
    { label: 'Everything', href: newsHref(null), active: kind === null, count: total },
    ...KIND_ORDER.filter((k) => k === kind || countFor(k) > 0).map((k) => ({
      label: KIND_META[k].tab,
      href: newsHref(k),
      active: kind === k,
      count: KIND_META[k].restrained ? undefined : countFor(k),
    })),
  ];

  // The front page. The lead is the first pinned story that is not a
  // notice, else the first that is not; two more sit beside it.
  const dressed = items.filter((n) => !KIND_META[n.kind].restrained);
  const lead = dressed.find((n) => n.pinned) ?? dressed[0] ?? null;
  const cards = dressed.filter((n) => n.id !== lead?.id).slice(0, 2);
  const shown = new Set([lead?.id, ...cards.map((c) => c.id)]);
  const rows = items.filter((n) => !shown.has(n.id));
  const leadHasPhoto = Boolean(lead && withPhoto(lead).coverImage);

  const eyebrow = (item: NewsItem) => {
    const meta = KIND_META[item.kind];
    const Icon = meta.icon;
    return (
      <>
        {Icon ? <Icon className="text-muted" aria-hidden="true" /> : null}
        {meta.label}
      </>
    );
  };

  const tellHref = pack.copy.supportEmail
    ? mailto(pack.copy.supportEmail, 'An achievement to share', [
        'Who it is about:',
        'Their branch and batch:',
        'What happened:',
        '',
      ])
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="News"
        title={`News from ${pack.copy.shortName}`}
        description="What the college and its graduates have been up to."
      />

      <div className="space-y-2">
        <ChipNav items={chips} ariaLabel="Kinds of story" />
        {unknownKind ? (
          <p className="text-sm text-secondary">
            Nothing is filed under “{requested}”, so this is everything.
          </p>
        ) : kind ? (
          <p className="text-sm text-secondary">{KIND_META[kind].blurb}</p>
        ) : null}
      </div>

      {items.length === 0 ? (
        kind ? (
          <EmptyState
            variant="inline"
            title={KIND_META[kind].empty}
            action={
              <Link href={newsHref(null)} className="link inline-flex min-h-11 items-center">
                See all news
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={<Newspaper className="size-5" />}
            title="No news yet"
            description={`The ${office} posts reunions, achievements and what graduates have built together here.`}
            action={
              tellHref ? (
                <a href={tellHref} className="link inline-flex min-h-11 items-center text-sm">
                  Tell us about an achievement
                </a>
              ) : null
            }
          />
        )
      ) : (
        <>
          {lead ? (
            <section aria-labelledby="news-latest">
              <h2 id="news-latest" className="sr-only">
                Latest
              </h2>
              {/* With a photo the lead takes two columns and the cards stack
                  beside it; set in type alone it runs the full width with the
                  two cards side by side beneath, so no card stretches round
                  empty space. */}
              <div className={cn('grid grid-cols-1 gap-gutter', leadHasPhoto && 'lg:grid-cols-3')}>
                <StoryCard
                  story={withPhoto(lead)}
                  href={`/news/${lead.slug}`}
                  locale={locale}
                  variant="lead"
                  eyebrow={eyebrow(lead)}
                  className={leadHasPhoto ? 'lg:col-span-2' : undefined}
                  action={
                    <ShareActions
                      url={`${origin}/news/${lead.slug}`}
                      whatsappHref={whatsappShareUrl(storyShareText(pack, lead), `${origin}/news/${lead.slug}`)}
                      title={lead.title}
                      size="sm"
                    />
                  }
                />
                {cards.length > 0 ? (
                  <div className={cn('grid grid-cols-1 gap-gutter sm:grid-cols-2', leadHasPhoto && 'lg:grid-cols-1')}>
                    {cards.map((item) => (
                      <StoryCard
                        key={item.id}
                        story={withPhoto(item)}
                        href={`/news/${item.slug}`}
                        locale={locale}
                        variant="card"
                        eyebrow={eyebrow(item)}
                        className={SLIM_ART}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {rows.length > 0 ? (
            <section aria-labelledby="news-more" className="space-y-1">
              <h2 id="news-more" className={lead ? 'font-display text-xl font-semibold' : 'sr-only'}>
                Earlier
              </h2>
              <ul className="divide-y divide-line">
                {rows.map((item) => (
                  <li key={item.id}>
                    <StoryCard
                      story={withPhoto(item)}
                      href={`/news/${item.slug}`}
                      locale={locale}
                      variant="row"
                      eyebrow={eyebrow(item)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {tellHref && !kind ? (
            <p className="border-t border-line pt-4 text-sm text-secondary">
              Know about something a graduate has done?{' '}
              <a href={tellHref} className="link">
                Tell the {office}
              </a>
              .
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
