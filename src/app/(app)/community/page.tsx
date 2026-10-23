import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { MessagesSquare, Search } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, isActive } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getFeed, getFeedTags } from '@/lib/data/feed';
import { getMyGroups } from '@/lib/data/groups';
import { getMemberPages } from '@/lib/data/pages';
import { POST_KINDS, POST_KIND_VALUES } from '@/lib/community';
import { Button, Card, CardBody, ChipNav, EmptyState, Input, PageHeader, Pagination } from '@/components/ui';
import { PostCard } from '@/components/community/PostCard';
import { PostComposer } from '@/components/community/PostComposer';
import type { PostKind } from '@/lib/data/types';

/**
 * The community feed.
 *
 * Short posts from alumni, filtered by type, tag and group. What appears is
 * decided in `getFeed()`: a post written inside a group appears only to that
 * group's members, a hidden post only to moderators and its author. This
 * page never filters for permission, so it cannot show more than the feed
 * layer allows.
 *
 * Students read, like and report; they do not write (`post.create`), and the
 * page says so plainly where the composer would be.
 */

export const metadata: Metadata = { title: 'Community' };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

interface Filters {
  kind?: PostKind;
  tag?: string;
  group?: string;
  q?: string;
}

function href(filters: Filters, page?: number): string {
  const qs = new URLSearchParams();
  if (filters.kind) qs.set('type', filters.kind);
  if (filters.tag) qs.set('tag', filters.tag);
  if (filters.group) qs.set('group', filters.group);
  if (filters.q) qs.set('q', filters.q);
  if (page && page > 1) qs.set('page', String(page));
  const s = qs.toString();
  return s ? `/community?${s}` : '/community';
}

export default async function CommunityPage({
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
  if (!pack.features.feed) notFound();

  const params = await searchParams;
  const rawKind = one(params.type)?.toLowerCase() ?? '';
  const filters: Filters = {
    kind: (POST_KIND_VALUES as readonly string[]).includes(rawKind) ? (rawKind as PostKind) : undefined,
    tag: one(params.tag)?.trim().toLowerCase().slice(0, 40) || undefined,
    group: one(params.group)?.trim().slice(0, 80) || undefined,
    q: one(params.q)?.trim().slice(0, 120) || undefined,
  };
  const page = Math.max(1, Number(one(params.page)) || 1);

  const feed = getFeed(session, { ...filters, page, perPage: 10 });
  const canPost = can(session, 'post.create');
  const canModerate = can(session, 'post.moderate');
  const myGroups = pack.features.groups ? getMyGroups(session) : [];
  const tags = getFeedTags(session, 12);
  const guidelines = pack.features.pages ? getMemberPages().find((p) => p.slug === 'community-guidelines') : undefined;
  const filtered = Boolean(filters.kind || filters.tag || filters.group || filters.q);

  const kindChips = [
    { label: 'Everything', href: href({ ...filters, kind: undefined }), active: !filters.kind },
    ...POST_KINDS.map((k) => ({ label: k.plural, href: href({ ...filters, kind: k.value }), active: filters.kind === k.value })),
  ];
  const groupChips = myGroups.length
    ? [
        { label: 'Every group', href: href({ ...filters, group: undefined }), active: !filters.group },
        ...myGroups.map((g) => ({ label: g.name, href: href({ ...filters, group: g.slug }), active: filters.group === g.slug })),
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Community"
        title="Community"
        description={`Updates, questions and opportunities from ${pack.copy.shortName} alumni.`}
      />

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-5">
          {canPost ? (
            <PostComposer groups={myGroups.map((g) => ({ slug: g.slug, name: g.name }))} />
          ) : (
            <p className="rounded-lg border border-line bg-surface-sunken px-4 py-3 text-sm text-secondary">
              Alumni write on this feed. You can read it, like a post, and report anything that breaks the guidelines.
            </p>
          )}

          <div className="space-y-3">
            <form action="/community" method="get" className="flex gap-2" role="search" aria-label="Search the feed">
              {filters.kind ? <input type="hidden" name="type" value={filters.kind} /> : null}
              {filters.tag ? <input type="hidden" name="tag" value={filters.tag} /> : null}
              {filters.group ? <input type="hidden" name="group" value={filters.group} /> : null}
              <div className="min-w-0 flex-1">
                <Input
                  name="q"
                  defaultValue={filters.q ?? ''}
                  placeholder="Search posts"
                  aria-label="Search posts"
                  leading={<Search className="size-4" />}
                />
              </div>
              <Button type="submit" variant="secondary" className="min-h-11 sm:min-h-0">
                Search
              </Button>
            </form>
            <ChipNav items={kindChips} ariaLabel="Type of post" />
            {groupChips.length > 0 ? <ChipNav items={groupChips} ariaLabel="Group" /> : null}
            {filters.tag ? (
              <p className="text-sm text-secondary">
                Showing posts tagged <span className="font-medium text-primary">#{filters.tag}</span>.{' '}
                <Link href={href({ ...filters, tag: undefined })} className="link">
                  Clear the tag
                </Link>
              </p>
            ) : null}
          </div>

          {feed.items.length === 0 ? (
            filtered ? (
              <EmptyState
                variant="inline"
                title="Nothing matches that."
                action={
                  <Link href="/community" className="link inline-flex min-h-11 items-center">
                    Clear the filters
                  </Link>
                }
              />
            ) : (
              <EmptyState
                icon={<MessagesSquare className="size-5" />}
                title="Nothing has been posted yet"
                description={
                  canPost
                    ? 'Be the first: a promotion, a question about moving cities, or a role your team is hiring for.'
                    : 'Alumni post updates, questions and opportunities here. They appear as soon as they are written.'
                }
              />
            )
          ) : (
            <ul className="space-y-4">
              {feed.items.map((post) => (
                <li key={post.id} className="min-w-0">
                  <PostCard
                    post={post}
                    locale={pack.locale}
                    viewerId={session.memberId}
                    canModerate={canModerate}
                    directory={pack.features.directory}
                    tagHref={(t) => href({ ...filters, tag: t })}
                  />
                </li>
              ))}
            </ul>
          )}

          {feed.pageCount > 1 ? (
            <Pagination page={feed.page} pageCount={feed.pageCount} total={feed.total} buildHref={(p) => href(filters, p)} />
          ) : null}
        </div>

        <aside aria-label="Around the feed" className="min-w-0 space-y-4">
          {tags.length > 0 ? (
            <Card>
              <CardBody className="space-y-3">
                <h2 className="text-sm font-semibold">Popular tags</h2>
                <ul className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <li key={t.tag}>
                      <Link
                        href={href({ ...filters, tag: t.tag })}
                        className="inline-flex min-h-8 items-center rounded-full bg-surface-sunken px-2.5 text-xs text-secondary hover:text-primary"
                      >
                        #{t.tag}
                        <span className="ml-1 tabular text-muted">{t.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          {pack.features.groups ? (
            <Card>
              <CardBody className="space-y-2">
                <h2 className="text-sm font-semibold">Groups</h2>
                <p className="text-sm text-secondary">
                  {myGroups.length > 0
                    ? `You are in ${myGroups.length} ${myGroups.length === 1 ? 'group' : 'groups'}. Their posts appear here, and nowhere else.`
                    : 'Join a chapter or an interest group to see what its members post.'}
                </p>
                <Link href="/groups" className="link inline-flex min-h-11 items-center text-sm">
                  {myGroups.length > 0 ? 'Your groups' : 'Find a group'}
                </Link>
              </CardBody>
            </Card>
          ) : null}

          {guidelines ? (
            <p className="px-1 text-sm text-secondary">
              Posts follow the{' '}
              <Link href={`/p/${guidelines.slug}`} className="link">
                {guidelines.title.toLowerCase()}
              </Link>
              .
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
