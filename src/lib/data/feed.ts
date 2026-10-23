import { can, type Session } from '../auth/guard';
import { findMemberById, projectMemberSummary } from './repo';
import { GROUPS, GROUP_MEMBERSHIPS, POSTS, type PostRecord } from './seed-community';
import type { Paged, PostItem, PostKind } from './types';

/**
 * The community feed.
 *
 * What a viewer can read is decided here, once, and every screen and API
 * route that lists posts goes through it:
 *
 *  - A post written inside a group is for that group. Outside it, the post
 *    does not exist: not in the feed, not by id, not in a count.
 *  - A hidden post is for the people who hid it and for its author, who has
 *    to be able to see that it was hidden and why; otherwise it looks like
 *    the post vanished, which invites the same post again.
 *  - Reports are for moderators. The author never learns who reported them.
 *
 * Authors are `MemberSummary` values narrowed to the viewer's tier, so a
 * student reading the feed sees what the directory shows a student.
 */

function inGroup(session: Session, slug: string): boolean {
  const group = GROUPS.find((g) => g.slug === slug);
  if (!group) return false;
  return GROUP_MEMBERSHIPS.some((r) => r.groupId === group.id && r.memberId === session.memberId && r.state === 'active');
}

function visibleTo(post: PostRecord, session: Session): boolean {
  const moderator = can(session, 'post.moderate');
  if (post.groupSlug && !moderator && !inGroup(session, post.groupSlug)) return false;
  if (post.state === 'hidden' && !moderator && post.authorId !== session.memberId) return false;
  return true;
}

function shape(post: PostRecord, session: Session): PostItem | null {
  const author = findMemberById(post.authorId);
  if (!author) return null;
  const moderator = can(session, 'post.moderate');
  const group = post.groupSlug ? GROUPS.find((g) => g.slug === post.groupSlug) : undefined;

  return {
    id: post.id,
    kind: post.kind,
    body: post.body,
    tags: post.tags,
    author: projectMemberSummary(author, session),
    group: group ? { id: group.id, slug: group.slug, name: group.name } : null,
    state: post.state,
    createdAt: post.createdAt,
    likeCount: post.likedBy.length,
    viewerLiked: post.likedBy.includes(session.memberId),
    moderation:
      moderator || (post.state === 'hidden' && post.authorId === session.memberId)
        ? {
            reportCount: moderator ? post.reports.length : 0,
            reportReasons: moderator ? post.reports.map((r) => r.reason) : [],
            hiddenReason: post.hiddenReason,
          }
        : null,
    viewerReported: post.reports.some((r) => r.by === session.memberId),
  };
}

export interface FeedQuery {
  kind?: PostKind;
  tag?: string;
  /** One group's noticeboard, by slug. */
  group?: string;
  q?: string;
  /** Only the viewer's own posts. */
  mine?: boolean;
  page?: number;
  perPage?: number;
}

export function getFeed(session: Session, query: FeedQuery = {}): Paged<PostItem> {
  const perPage = Math.min(Math.max(query.perPage ?? 10, 1), 50);
  const needle = query.q?.trim().toLowerCase();

  const rows = POSTS.filter((p) => visibleTo(p, session))
    // The main feed is the open posts plus those from the viewer's own
    // groups (anything else was removed by `visibleTo`); `group` narrows it
    // to one noticeboard.
    .filter((p) => !query.group || p.groupSlug === query.group)
    .filter((p) => !query.kind || p.kind === query.kind)
    .filter((p) => !query.tag || p.tags.includes(query.tag))
    .filter((p) => !query.mine || p.authorId === session.memberId)
    .filter((p) => !needle || `${p.body} ${p.tags.join(' ')}`.toLowerCase().includes(needle))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(query.page ?? 1, 1), pageCount);
  const items = rows
    .slice((page - 1) * perPage, page * perPage)
    .map((p) => shape(p, session))
    .filter((p): p is PostItem => p !== null);

  return { items, total, page, perPage, pageCount };
}

export function getPostById(session: Session, id: string): PostItem | null {
  const post = POSTS.find((p) => p.id === id);
  if (!post || !visibleTo(post, session)) return null;
  return shape(post, session);
}

/** The most-used tags on posts this viewer can read, most used first. */
export function getFeedTags(session: Session, limit = 12): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const p of POSTS) {
    if (p.state !== 'published' || !visibleTo(p, session)) continue;
    for (const tag of p.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}

/** Reported posts, and posts already hidden, for a moderator. Empty for anyone else. */
export function getModerationQueue(session: Session): PostItem[] {
  if (!can(session, 'post.moderate')) return [];
  return POSTS.filter((p) => p.reports.length > 0 || p.state === 'hidden')
    .sort((a, b) => b.reports.length - a.reports.length || b.createdAt.localeCompare(a.createdAt))
    .map((p) => shape(p, session))
    .filter((p): p is PostItem => p !== null);
}

/** Live posts with an open report: the number on the staff task list. */
export function countReportedPosts(session: Session): number {
  if (!can(session, 'post.moderate')) return 0;
  return POSTS.filter((p) => p.state === 'published' && p.reports.length > 0).length;
}

/** Whether the viewer may write in this group (or on the open feed, with `null`). */
export function canPostIn(session: Session, groupSlug: string | null): boolean {
  if (!can(session, 'post.create')) return false;
  return groupSlug === null || inGroup(session, groupSlug);
}
