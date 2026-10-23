import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CalendarPlus, MapPin, Users } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, isActive } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getEvents } from '@/lib/data/repo';
import {
  canRunGroup,
  canSeeRoster,
  getGroupBySlug,
  getGroupMembers,
  getGroupRequests,
  joinVerdict,
} from '@/lib/data/groups';
import { canPostIn, getFeed } from '@/lib/data/feed';
import { memberLine } from '@/lib/format';
import {
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  EmptyState,
  PageHeader,
  Pagination,
  Tabs,
  type TabItem,
} from '@/components/ui';
import { EventSummary } from '@/components/content';
import { MemberRow } from '@/components/members/MemberCard';
import { PostCard } from '@/components/community/PostCard';
import { PostComposer } from '@/components/community/PostComposer';
import { JoinGroupButton } from '@/components/community/JoinGroupButton';
import { GroupRequests } from '@/components/community/GroupRequests';

/**
 * One group.
 *
 * Anyone allowed to see the group sees its description, its leads and how
 * many are in it. Its noticeboard and its roster are for the people inside
 * (and the staff who run groups), which `getFeed()` and `getGroupMembers()`
 * enforce: this page asks them and never filters for permission itself.
 *
 * The leads' own tools (the join requests) appear as a tab only for them.
 */

type Tab = 'noticeboard' | 'events' | 'members' | 'requests';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const session = await getSession();
  const group = session ? getGroupBySlug(session, slug) : null;
  return { title: group ? group.name : 'Group not found' };
}

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!isActive(session)) redirect('/pending');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.groups) notFound();

  const { slug } = await params;
  const group = getGroupBySlug(session, slug);
  if (!group) notFound();

  const query = await searchParams;
  const isMember = group.viewer.state === 'active';
  const runs = canRunGroup(session, slug);
  const seesRoster = canSeeRoster(session, slug);
  const showBoard = pack.features.feed && (isMember || can(session, 'post.moderate'));
  const showEvents = pack.features.events;

  const requests = runs ? getGroupRequests(session, slug) : [];
  const members = seesRoster ? getGroupMembers(session, slug) : [];
  const upcoming = showEvents ? getEvents(session, { when: 'upcoming', group: slug }) : [];
  const past = showEvents ? getEvents(session, { when: 'past', group: slug }) : [];

  const available: Tab[] = [
    ...(showBoard ? (['noticeboard'] as const) : []),
    ...(showEvents ? (['events'] as const) : []),
    ...(seesRoster ? (['members'] as const) : []),
    ...(runs ? (['requests'] as const) : []),
  ];
  const asked = one(query.tab) as Tab | undefined;
  const tab: Tab | null = asked && available.includes(asked) ? asked : (available[0] ?? null);

  const tabs: TabItem[] = available.map((t) => ({
    label: { noticeboard: 'Noticeboard', events: 'Events', members: 'Members', requests: 'Requests' }[t],
    href: `/groups/${slug}?tab=${t}`,
    count: t === 'members' ? group.memberCount : t === 'requests' ? requests.length : t === 'events' ? upcoming.length : undefined,
    active: tab === t,
  }));

  const verdict = joinVerdict(session, group);
  const place = group.kind === 'chapter' ? memberLine([group.city, group.country && group.country !== 'IN' ? group.country : null]) : '';
  const page = Math.max(1, Number(one(query.page)) || 1);
  const feed = tab === 'noticeboard' ? getFeed(session, { group: slug, page, perPage: 10 }) : null;
  const canWrite = canPostIn(session, slug);
  const student = session.roles.some((r) => r.role === 'student');

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: 'Groups', href: '/groups' }, { label: group.name }]} />}
        eyebrow={group.kind === 'chapter' ? 'Chapter' : 'Interest group'}
        title={group.name}
        description={group.description ?? undefined}
        actions={
          <JoinGroupButton
            slug={group.slug}
            name={group.name}
            joinPolicy={group.joinPolicy}
            state={group.viewer.state}
            role={group.viewer.role}
            blockedReason={!verdict.ok && group.viewer.state === null ? verdict.reason : null}
          />
        }
        meta={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4 text-muted" aria-hidden="true" />
              <span className="tabular">
                {group.memberCount.toLocaleString('en-IN')} {group.memberCount === 1 ? 'member' : 'members'}
              </span>
            </span>
            {place ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4 text-muted" aria-hidden="true" />
                {place}
              </span>
            ) : null}
            {group.joinPolicy === 'approval' ? <Badge tone="neutral">A lead approves requests</Badge> : null}
            {group.archived ? <Badge tone="warning">Archived</Badge> : null}
          </span>
        }
      />

      {group.leads.length > 0 ? (
        <section aria-labelledby="leads-heading" className="space-y-2">
          <h2 id="leads-heading" className="text-sm font-semibold">
            {group.leads.length === 1 ? 'Lead' : 'Leads'}
          </h2>
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {group.leads.map((l) => (
              <li key={l.id} className="min-w-0">
                <MemberRow member={l} linkProfile={!l.isStudent} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {available.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-md text-secondary">
              {isMember
                ? 'This group has nothing to show yet.'
                : 'Join the group to see its noticeboard and members.'}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-5">
          <Tabs items={tabs} ariaLabel="This group" />

          {tab === 'noticeboard' && feed ? (
            <div className="max-w-3xl space-y-4">
              {canWrite ? (
                <PostComposer groups={[]} fixedGroup={{ slug: group.slug, name: group.name }} prompt={`Write to ${group.name}`} />
              ) : isMember ? (
                <p className="rounded-lg border border-line bg-surface-sunken px-4 py-3 text-sm text-secondary">
                  {student
                    ? 'Alumni write on the noticeboard. You can read it, like a post, and report anything that breaks the guidelines.'
                    : 'You can read the noticeboard here.'}
                </p>
              ) : null}

              {feed.items.length === 0 ? (
                <EmptyState
                  variant="inline"
                  title="Nothing posted here yet"
                  description={canWrite ? 'Start the noticeboard: say who you are looking for, or what the group is up to.' : 'Posts from the group’s members appear here.'}
                />
              ) : (
                <ul className="space-y-4">
                  {feed.items.map((post) => (
                    <li key={post.id} className="min-w-0">
                      <PostCard
                        post={post}
                        locale={pack.locale}
                        viewerId={session.memberId}
                        canModerate={can(session, 'post.moderate')}
                        directory={pack.features.directory}
                        showGroup={false}
                        tagHref={(t) => `/community?tag=${encodeURIComponent(t)}`}
                      />
                    </li>
                  ))}
                </ul>
              )}

              {feed.pageCount > 1 ? (
                <Pagination
                  page={feed.page}
                  pageCount={feed.pageCount}
                  total={feed.total}
                  buildHref={(p) => `/groups/${slug}?tab=noticeboard${p > 1 ? `&page=${p}` : ''}`}
                />
              ) : null}
            </div>
          ) : null}

          {tab === 'events' ? (
            <div className="max-w-3xl space-y-4">
              {isMember && can(session, 'event.propose') ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-sunken px-4 py-3">
                  <p className="text-sm text-secondary">Planning something for this group? Put it forward and the alumni cell will approve it.</p>
                  <ButtonLink href={`/events/propose?group=${slug}`} variant="secondary" className="min-h-11">
                    <CalendarPlus className="size-4" aria-hidden="true" />
                    Propose an event
                  </ButtonLink>
                </div>
              ) : null}

              {upcoming.length === 0 && past.length === 0 ? (
                <EmptyState variant="inline" title="No events for this group yet" description="Meetups and talks hosted by the group appear here." />
              ) : (
                <>
                  {upcoming.length > 0 ? (
                    <section aria-labelledby="up-heading" className="space-y-2">
                      <h2 id="up-heading" className="text-sm font-semibold">
                        Coming up
                      </h2>
                      <Card>
                        <CardBody className="divide-y divide-line py-1">
                          {upcoming.map((e) => (
                            <EventSummary key={e.id} event={e} href={`/events/${e.slug}`} locale={pack.locale} variant="row" />
                          ))}
                        </CardBody>
                      </Card>
                    </section>
                  ) : null}
                  {past.length > 0 ? (
                    <section aria-labelledby="past-heading" className="space-y-2">
                      <h2 id="past-heading" className="text-sm font-semibold">
                        Earlier
                      </h2>
                      <Card>
                        <CardBody className="divide-y divide-line py-1">
                          {past.slice(0, 5).map((e) => (
                            <EventSummary key={e.id} event={e} href={`/events/${e.slug}`} locale={pack.locale} variant="row" />
                          ))}
                        </CardBody>
                      </Card>
                    </section>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {tab === 'members' ? (
            members.length === 0 ? (
              <EmptyState variant="inline" title="No members to show" />
            ) : (
              <Card>
                <CardBody>
                  <ul className="grid gap-x-8 divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
                    {members.map((m) => (
                      <li key={m.member.id} className="min-w-0">
                        <MemberRow
                          member={m.member}
                          linkProfile={!m.member.isStudent || can(session, 'directory.search.students')}
                          action={m.role === 'lead' ? <Badge tone="brand">Lead</Badge> : undefined}
                        />
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )
          ) : null}

          {tab === 'requests' ? (
            requests.length === 0 ? (
              <EmptyState variant="inline" title="No requests waiting" description="When somebody asks to join, you see it here." />
            ) : (
              <div className="max-w-3xl space-y-3">
                <p className="text-sm text-secondary">
                  {requests.length} {requests.length === 1 ? 'person is' : 'people are'} waiting to join. Approving adds them to the
                  group straight away.
                </p>
                <GroupRequests
                  slug={slug}
                  rows={requests.map((r) => ({
                    memberId: r.member.id,
                    name: r.member.fullName,
                    photoUrl: r.member.photoUrl,
                    line: memberLine([r.member.departmentCode, r.member.batchYear ? `Batch of ${r.member.batchYear}` : null, r.member.currentCompany]),
                  }))}
                />
              </div>
            )
          ) : null}
        </div>
      )}

      {runs && can(session, 'group.manage') ? (
        <p className="text-sm text-secondary">
          You run groups.{' '}
          <Link href={`/admin/groups/${slug}`} className="link">
            Manage this group in the staff console
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
