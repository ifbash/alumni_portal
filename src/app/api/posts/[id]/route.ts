import { getSession } from '@/lib/auth/session';
import { can, require as requireCap, requireActive } from '@/lib/auth/guard';
import { getPostById } from '@/lib/data/feed';
import { PostModeration } from '@/lib/schemas/feed';
import { logAudit } from '@/lib/audit/log';
import { clientIp, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../_lib/http';
import { requireFeature } from '../../_lib/feature';

/**
 * One post: hide or restore it (moderators), or take down one's own.
 *
 * Hiding is not deleting. A hidden post stays on file with the reason, is
 * visible to moderators and to its author (who must be able to see that it
 * was hidden and why), and can be restored if the call was wrong. Only the
 * author's own `DELETE` removes it from view for good, and even that is a
 * flag in the audit trail rather than an erasure, because a post somebody
 * reported and then deleted is still something a moderator may need to read.
 */

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    requireCap(session, 'post.moderate');
    const { tenant } = await requireFeature('feed', 'The community feed is');

    const { id } = await params;
    const decision = await readJson(request, PostModeration);
    limit(`post-moderate:${session.memberId}`, 120, 60 * 60, 'A hundred and twenty moderation actions in an hour is the limit.');

    const post = getPostById(session, id);
    if (!post) throw new HttpError(404, 'not_found', 'There is no post with that id.');

    const hiding = decision.action === 'hide';
    if (hiding && post.state === 'hidden') throw new HttpError(409, 'already_hidden', 'That post is already hidden.');
    if (!hiding && post.state !== 'hidden') throw new HttpError(409, 'not_hidden', 'That post is not hidden.');

    await logAudit({
      tenantId: tenant.id,
      session,
      action: hiding ? 'post.hide' : 'post.restore',
      resource: 'posts',
      resourceId: post.id,
      before: { state: post.state },
      after: { state: hiding ? 'hidden' : 'published', reason: decision.action === 'hide' ? decision.reason : null },
      reason: decision.action === 'hide' ? decision.reason : null,
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();
    return json({
      ok: true,
      ...write,
      post: { id: post.id, state: hiding ? 'hidden' : 'published' },
      note: hiding
        ? 'Hidden. The author can see it was hidden and the reason you gave.'
        : 'Restored. It is back on the feed.',
    });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    requireActive(session);
    const { tenant } = await requireFeature('feed', 'The community feed is');

    const { id } = await params;
    const post = getPostById(session, id);
    if (!post) throw new HttpError(404, 'not_found', 'There is no post with that id.');

    // Your own post, or any post if you moderate. Nobody else's.
    if (post.author.id !== session.memberId && !can(session, 'post.moderate')) {
      throw new HttpError(403, 'forbidden', 'You can only remove your own posts.');
    }

    limit(`post-delete:${session.memberId}`, 30, 60 * 60, 'Thirty removals in an hour is the limit.');

    await logAudit({
      tenantId: tenant.id,
      session,
      action: 'post.delete',
      resource: 'posts',
      resourceId: post.id,
      before: { state: post.state, kind: post.kind, authorId: post.author.id },
      after: null,
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();
    return json({ ok: true, ...write, deleted: post.id });
  } catch (err) {
    return fail(err);
  }
}
