import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { can, require as requireCap, requireActive } from '@/lib/auth/guard';
import { canPostIn, getFeed } from '@/lib/data/feed';
import { POST_KIND_VALUES } from '@/lib/community';
import { PostCreate } from '@/lib/schemas/feed';
import { logAudit } from '@/lib/audit/log';
import { clientIp, draftId, fail, fixtureWrite, HttpError, json, limit, parseQuery, readJson } from '../_lib/http';
import { requireFeature } from '../_lib/feature';
import { narrowSummary } from '../_lib/summary';

/**
 * The community feed.
 *
 * Reading needs an active membership and nothing more; what a viewer gets
 * back is decided in `lib/data/feed.ts` (group posts only for the group,
 * hidden posts only for moderators and their author). Writing needs
 * `post.create`, which alumni and faculty hold and students do not.
 *
 * A post is published the moment it is written: moderation here is after
 * the fact (a report, then a moderator), because a feed that waits for
 * approval is a feed nobody posts to. That is also why the rules are narrow
 * and enforced at the door: ten characters at least, two links at most, no
 * tags beyond five, and a rate limit.
 */

const ListQuery = z.object({
  kind: z.enum(POST_KIND_VALUES).optional(),
  tag: z.string().trim().max(40).optional(),
  group: z.string().trim().max(80).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(500).optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getSession();
    requireActive(session);
    await requireFeature('feed', 'The community feed is');

    const query = parseQuery(request, ListQuery);
    const feed = getFeed(session, { ...query, perPage: 10 });

    return json({
      total: feed.total,
      page: feed.page,
      pageCount: feed.pageCount,
      canPost: can(session, 'post.create'),
      items: feed.items.map((p) => ({
        id: p.id,
        kind: p.kind,
        body: p.body,
        tags: p.tags,
        group: p.group,
        state: p.state,
        createdAt: p.createdAt,
        likeCount: p.likeCount,
        viewerLiked: p.viewerLiked,
        author: narrowSummary(session, p.author),
        moderation: p.moderation,
      })),
    });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    requireCap(session, 'post.create');
    const { tenant } = await requireFeature('feed', 'The community feed is');

    const body = await readJson(request, PostCreate);

    limit(
      `post-create:${session.memberId}`,
      10,
      24 * 60 * 60,
      'Ten posts in a day is the limit. If you have a lot to say, gather it into one post and say it once.',
    );

    if (!canPostIn(session, body.groupSlug ?? null)) {
      throw new HttpError(403, 'not_in_group', 'You can only write in a group you belong to.', {
        fieldErrors: { groupSlug: 'Pick one of your own groups, or post to everyone.' },
      });
    }

    const post = {
      id: draftId('post'),
      kind: body.kind,
      body: body.body,
      tags: body.tags,
      groupSlug: body.groupSlug ?? null,
      // Published on arrival. Moderation follows a report; it does not stand in front of the post.
      state: 'published' as const,
      createdAt: new Date().toISOString(),
    };

    await logAudit({
      tenantId: tenant.id,
      session,
      action: 'post.create',
      resource: 'posts',
      resourceId: post.id,
      before: null,
      // Length, not the text: the audit log is not a second copy of the feed.
      after: { kind: post.kind, groupSlug: post.groupSlug, tags: post.tags, bodyLength: post.body.length },
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();

    return json(
      {
        ok: true,
        ...write,
        post,
        note: post.groupSlug
          ? 'Posted to the group. Anyone in the group can see it.'
          : 'Posted. Other members can see it, and anyone can report it if it breaks the guidelines.',
      },
      { status: 201 },
    );
  } catch (err) {
    return fail(err);
  }
}
