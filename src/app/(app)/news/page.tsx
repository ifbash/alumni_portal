import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight, Newspaper, Pin } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getTenantBrand } from '@/lib/tenant';
import { getNews, type NewsItem } from '@/lib/data/content';
import { getDepartments } from '@/lib/data/repo';
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  EmptyState,
  PageHeader,
  Tabs,
  type TabItem,
} from '@/components/ui';
import { MarginNote } from '@/components/brand/Marks';
import { formatDate, formatRelative, memberLine } from '@/lib/format';
import { KIND_META, KIND_ORDER, isNewsKind, newsHref } from './kinds';

/**
 * The news feed.
 *
 * Two rules hold this page together. Drafts are never requested — the
 * member route calls `getNews()` without `includeDrafts`, so an
 * unpublished item is not merely hidden here, it is not in the array. And
 * an obituary is rendered by a different branch from everything else: no
 * badge, no icon, no hover lift, no read-more arrow. The restraint lives
 * in `KIND_META.restrained` rather than in a condition somebody has to
 * remember to write on the next screen.
 */

export const metadata: Metadata = {
  title: 'News',
  description: 'Announcements, achievements, milestones and press from the college and its graduates.',
};

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

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

  const departments = getDepartments();
  const deptName = (code: string | null) =>
    code ? (departments.find((d) => d.code === code)?.name ?? code) : null;

  const tabs: TabItem[] = [
    { label: 'Everything', href: newsHref(null), count: total, active: kind === null },
    ...KIND_ORDER.map((k) => ({
      label: KIND_META[k].tab,
      href: newsHref(k),
      count: countFor(k),
      active: kind === k,
    })),
  ];

  const pinned = items.filter((n) => n.pinned).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={pack.copy.shortName}
        title="News"
        description="What the alumni cell, the placement cell and the principal’s office have published — announcements, graduates’ achievements, what the network has funded, and press coverage. Every filter below is a link, so a story or a whole section can be forwarded as it stands."
      />

      {unknownKind ? (
        <Alert tone="warning" title={`There is nothing published under “${requested}”`}>
          <p>
            The feed is filed under five kinds and that is not one of them. The tabs below are the
            complete list;{' '}
            <Link href={newsHref(null)} className="link">
              everything published
            </Link>{' '}
            is the widest view.
          </p>
        </Alert>
      ) : null}

      <Tabs items={tabs} ariaLabel="Kinds of story" />

      {kind ? (
        <p className="max-w-prose text-sm text-secondary">{KIND_META[kind].blurb}</p>
      ) : pinned > 0 ? (
        <p className="flex items-center gap-1.5 text-sm text-secondary">
          <Pin className="size-3.5 text-muted" aria-hidden="true" />
          {pinned === 1
            ? 'One story is pinned to the top by the alumni cell.'
            : `${pinned} stories are pinned to the top by the alumni cell.`}
        </p>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={<Newspaper className="size-5" />}
          title={kind ? `Nothing filed under ${KIND_META[kind].tab.toLowerCase()} yet` : 'Nothing published yet'}
          description={
            kind
              ? KIND_META[kind].empty
              : 'The alumni cell writes here. Until the first story goes up there is genuinely nothing to show — this is not a loading state.'
          }
          action={
            kind ? (
              <ButtonLink href={newsHref(null)} variant="secondary">
                Read everything else
              </ButtonLink>
            ) : null
          }
        />
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.id}>
              {KIND_META[item.kind].restrained ? (
                <Notice item={item} departmentName={deptName(item.departmentCode)} />
              ) : (
                <StoryCard item={item} departmentName={deptName(item.departmentCode)} />
              )}
            </li>
          ))}
        </ul>
      )}

      <MarginNote className="max-w-prose border-t border-line pt-4">
        Every story carries the desk that wrote it. Notices under <em>In memoriam</em> are published
        to this page and are never sent as a notification — they are found by opening the portal,
        not pushed at anybody.
      </MarginNote>
    </div>
  );
}

// ---------------------------------------------------------------
// Cards
// ---------------------------------------------------------------

function StoryCard({ item, departmentName }: { item: NewsItem; departmentName: string | null }) {
  const meta = KIND_META[item.kind];
  const Icon = meta.icon;

  return (
    <Card as="article" interactive className="relative">
      <CardBody className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={meta.tone}>
            {Icon ? <Icon className="size-3" /> : null}
            {meta.label}
          </Badge>
          {item.pinned ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
              <Pin className="size-3" aria-hidden="true" />
              Pinned
            </span>
          ) : null}
        </div>

        <h2 className="font-display text-lg font-semibold leading-snug">
          {/* The whole card is the hit target on a phone; the arrow below is
              the same destination for anyone who wants something to aim at. */}
          <Link href={`/news/${item.slug}`} className="link-quiet after:absolute after:inset-0">
            {item.title}
          </Link>
        </h2>

        <p className="max-w-prose text-sm text-secondary">{item.summary}</p>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-0.5">
          <p className="text-xs text-muted">
            {memberLine([item.author, departmentName])}
            {' · '}
            <time dateTime={item.publishedAt ?? undefined}>{formatDate(item.publishedAt)}</time>
            {' · '}
            {formatRelative(item.publishedAt)}
          </p>

          <span className="relative">
            <Link
              href={`/news/${item.slug}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-fg hover:underline"
            >
              Read the story
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </span>
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * An obituary in the feed.
 *
 * Deliberately not a `Card`: no raised surface, no hover lift, no
 * full-card overlay link, no arrow inviting a click. The heading is a
 * step quieter than its neighbours and the only affordance is the title
 * itself.
 */
function Notice({ item, departmentName }: { item: NewsItem; departmentName: string | null }) {
  return (
    <article className="rounded-lg border border-line bg-surface p-card">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">
        {KIND_META[item.kind].label}
      </p>

      <h2 className="mt-2 font-display text-md font-medium leading-snug">
        <Link href={`/news/${item.slug}`} className="link-quiet">
          {item.title}
        </Link>
      </h2>

      <p className="mt-1.5 max-w-prose text-sm text-secondary">{item.summary}</p>

      <p className="mt-3 text-xs text-muted">
        {memberLine([item.author, departmentName])}
        {' · '}
        <time dateTime={item.publishedAt ?? undefined}>{formatDate(item.publishedAt)}</time>
      </p>
    </article>
  );
}
