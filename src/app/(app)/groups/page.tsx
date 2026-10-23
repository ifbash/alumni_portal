import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Search, UsersRound } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { isActive } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getGroups, joinVerdict } from '@/lib/data/groups';
import { Button, EmptyState, Input, PageHeader, Tabs } from '@/components/ui';
import { GroupCard } from '@/components/community/GroupCard';
import { JoinGroupButton } from '@/components/community/JoinGroupButton';

/**
 * Groups and chapters.
 *
 * Chapters are alumni in one city or country; interest groups are people who
 * share a field. A student sees interest groups only, and the page says so
 * rather than leaving them to wonder where the chapters went.
 *
 * Who is in a group is not on this page. A card shows how many, and who
 * leads, which is enough to decide whether to join; the roster is for the
 * people inside.
 */

export const metadata: Metadata = { title: 'Groups' };

type View = 'all' | 'chapter' | 'interest' | 'mine';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function href(view: View, q: string): string {
  const qs = new URLSearchParams();
  if (view !== 'all') qs.set('view', view);
  if (q) qs.set('q', q);
  const s = qs.toString();
  return s ? `/groups?${s}` : '/groups';
}

export default async function GroupsPage({
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
  if (!pack.features.groups) notFound();

  const params = await searchParams;
  const raw = one(params.view);
  const view: View = raw === 'chapter' || raw === 'interest' || raw === 'mine' ? raw : 'all';
  const q = one(params.q)?.trim().slice(0, 80) ?? '';

  const everything = getGroups(session);
  const groups = getGroups(session, {
    kind: view === 'chapter' || view === 'interest' ? view : undefined,
    mine: view === 'mine',
    q: q || undefined,
  });

  const chapters = everything.filter((g) => g.kind === 'chapter').length;
  const interests = everything.filter((g) => g.kind === 'interest').length;
  const mine = everything.filter((g) => g.viewer.state === 'active').length;
  const student = session.roles.some((r) => r.role === 'student');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Groups"
        title="Groups"
        description={`Chapters by city and groups by interest, run by ${pack.copy.shortName} alumni.`}
      />

      <div className="space-y-4">
        <Tabs
          ariaLabel="Kinds of group"
          items={[
            { label: 'All groups', href: href('all', q), count: everything.length, active: view === 'all' },
            ...(chapters > 0 ? [{ label: 'Chapters', href: href('chapter', q), count: chapters, active: view === 'chapter' }] : []),
            { label: 'Interest groups', href: href('interest', q), count: interests, active: view === 'interest' },
            { label: 'Yours', href: href('mine', q), count: mine, active: view === 'mine' },
          ]}
        />

        <form action="/groups" method="get" role="search" aria-label="Search groups" className="flex max-w-xl gap-2">
          {view !== 'all' ? <input type="hidden" name="view" value={view} /> : null}
          <div className="min-w-0 flex-1">
            <Input name="q" defaultValue={q} placeholder="Search by name or city" aria-label="Search groups" leading={<Search className="size-4" />} />
          </div>
          <Button type="submit" variant="secondary" className="min-h-11 sm:min-h-0">
            Search
          </Button>
        </form>

        {student ? (
          <p className="text-sm text-secondary">Chapters are for alumni. As a final-year student you can join interest groups.</p>
        ) : null}
      </div>

      {groups.length === 0 ? (
        view === 'mine' && !q ? (
          <EmptyState
            icon={<UsersRound className="size-5" />}
            title="You are not in a group yet"
            description="Join your city’s chapter or an interest group to see what its members post and which events they are running."
            action={
              <Link href="/groups" className="link inline-flex min-h-11 items-center">
                Browse every group
              </Link>
            }
          />
        ) : q ? (
          <EmptyState
            variant="inline"
            title="No group matches that."
            action={
              <Link href={href(view, '')} className="link inline-flex min-h-11 items-center">
                Clear the search
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={<UsersRound className="size-5" />}
            title="No groups yet"
            description={`The ${pack.copy.officeName} sets up chapters and interest groups here, and each has leads who look after it.`}
          />
        )
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => {
            const verdict = joinVerdict(session, g);
            return (
              <li key={g.id} className="min-w-0">
                <GroupCard
                  group={g}
                  action={
                    <JoinGroupButton
                      slug={g.slug}
                      name={g.name}
                      joinPolicy={g.joinPolicy}
                      state={g.viewer.state}
                      role={g.viewer.role}
                      blockedReason={!verdict.ok && g.viewer.state === null ? verdict.reason : null}
                      size="sm"
                    />
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
