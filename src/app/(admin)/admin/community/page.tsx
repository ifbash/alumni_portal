import { notFound, redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getModerationQueue } from '@/lib/data/feed';
import { EmptyState, PageHeader, SummaryLine, Tabs } from '@/components/ui';
import { PostCard } from '@/components/community/PostCard';

/**
 * Moderating the community feed.
 *
 * Posts are published on arrival, so this is where the after-the-fact half
 * lives: what members have reported, and what has already been hidden.
 * Reported posts come first, most reported first, because a post three
 * people flagged is a post still live.
 *
 * Each card carries its own Hide and Restore, with a reason the author
 * reads. Nothing here lets a moderator edit someone's words.
 */

export const metadata = { title: 'Community · Staff console' };

type View = 'reported' | 'hidden';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminCommunityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.feed) notFound();

  requireCap(session, 'post.moderate');

  const params = await searchParams;
  const view: View = one(params.view) === 'hidden' ? 'hidden' : 'reported';

  const queue = getModerationQueue(session);
  const reported = queue.filter((p) => p.state === 'published' && (p.moderation?.reportCount ?? 0) > 0);
  const hidden = queue.filter((p) => p.state === 'hidden');
  const rows = view === 'hidden' ? hidden : reported;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Community"
        description="Posts members have reported, and posts already hidden."
      />

      <SummaryLine
        items={[
          ...(reported.length > 0
            ? [{ value: reported.length, label: reported.length === 1 ? 'reported post still live' : 'reported posts still live', href: '/admin/community', tone: 'attention' as const }]
            : []),
          ...(hidden.length > 0 ? [{ value: hidden.length, label: hidden.length === 1 ? 'hidden post' : 'hidden posts', href: '/admin/community?view=hidden' }] : []),
        ]}
      />

      <Tabs
        ariaLabel="Moderation lists"
        items={[
          { label: 'Reported', href: '/admin/community', count: reported.length, active: view === 'reported' },
          { label: 'Hidden', href: '/admin/community?view=hidden', count: hidden.length, active: view === 'hidden' },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="size-5" />}
          title={view === 'hidden' ? 'Nothing is hidden' : 'Nothing is waiting on you'}
          description={
            view === 'hidden'
              ? 'A post you hide, with the reason, is kept here so you can restore it.'
              : 'When a member reports a post it appears here, most reported first.'
          }
        />
      ) : (
        <ul className="space-y-4">
          {rows.map((post) => (
            <li key={post.id} className="min-w-0">
              <PostCard
                post={post}
                locale={pack.locale}
                viewerId={session.memberId}
                canModerate
                directory={pack.features.directory}
                tagHref={() => '/community'}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
