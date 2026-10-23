import Link from 'next/link';
import { ArrowRight, MessagesSquare } from 'lucide-react';

import { Avatar, Badge, Card, CardBody, CardHeader, CardTitle } from '@/components/ui';
import { getFeed } from '@/lib/data/feed';
import { getMyGroups } from '@/lib/data/groups';
import { getShowcase } from '@/lib/data/showcase';
import { excerpt, postKindLabel } from '@/lib/community';
import { formatRelative } from '@/lib/format';
import { isActive, type Session } from '@/lib/auth/guard';
import type { BrandPack } from '@/lib/branding/pack';
import { ShowcaseCard } from './ShowcaseCard';

/**
 * What is happening in the community, on the home page.
 *
 * A short strip, not a second feed: the three newest posts, the groups the
 * member is in, and one featured person. It shows only what the college has
 * switched on, only what this viewer may read (the feed layer decides that),
 * and nothing at all when there is nothing to show, so a quiet college does
 * not get a home page with an empty box on it.
 */
export function CommunityStrip({ session, pack }: { session: Session; pack: BrandPack }) {
  if (!isActive(session)) return null;

  const posts = pack.features.feed ? getFeed(session, { perPage: 3 }).items : [];
  const groups = pack.features.groups ? getMyGroups(session) : [];
  const featured = pack.features.showcase ? (getShowcase(session, { kind: 'prominent' }).find((e) => e.featured) ?? null) : null;
  const timing = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };

  if (posts.length === 0 && groups.length === 0 && !featured) return null;

  return (
    <section aria-labelledby="community-strip-title" className="mt-6 space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h2 id="community-strip-title" className="font-display text-xl font-semibold">
          From the community
        </h2>
        {pack.features.feed ? (
          <Link href="/community" className="link inline-flex min-h-11 items-center gap-1 text-sm">
            See everything
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {posts.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle as="h3" className="flex items-center gap-2 text-md">
                <MessagesSquare className="size-4 text-muted" aria-hidden="true" />
                Latest posts
              </CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              <ul className="divide-y divide-line">
                {posts.map((p) => (
                  <li key={p.id}>
                    <Link href={`/community#post-${p.id}`} className="flex items-start gap-3 px-card py-3 transition-colors duration-fast ease-brand hover:bg-surface-sunken">
                      <Avatar name={p.author.fullName} src={p.author.photoUrl ?? undefined} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span className="font-medium">{p.author.fullName}</span>
                          <Badge tone="outline">{postKindLabel(p.kind)}</Badge>
                          <span className="text-xs text-secondary">{formatRelative(p.createdAt, timing)}</span>
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-sm text-secondary">{excerpt(p.body, 150)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}

        {/* A flex column, not a stack: the showcase card is `h-full`, and in a plain
            stack that resolves against the whole column and spills out of the row. */}
        <div className="flex min-w-0 flex-col gap-4">
          {groups.length > 0 ? (
            <Card>
              <CardBody className="space-y-3">
                <h3 className="text-md font-semibold">Your groups</h3>
                <ul className="flex flex-wrap gap-2">
                  {groups.slice(0, 6).map((g) => (
                    <li key={g.id}>
                      <Link href={`/groups/${g.slug}`} className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface-raised px-4 text-sm transition-colors duration-fast ease-brand hover:border-line-strong">
                        {g.name}
                      </Link>
                    </li>
                  ))}
                </ul>
                {groups.length > 6 ? (
                  <Link href="/groups?view=mine" className="link inline-flex min-h-11 items-center text-sm">
                    All {groups.length} of your groups
                  </Link>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          {featured ? (
            <div className="flex flex-1 flex-col [&>*]:flex-1">
              <ShowcaseCard entry={featured} />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
