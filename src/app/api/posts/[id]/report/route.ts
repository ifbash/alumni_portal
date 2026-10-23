import { getSession } from '@/lib/auth/session';
import { requireActive } from '@/lib/auth/guard';
import { getPostById } from '@/lib/data/feed';
import { PostReport } from '@/lib/schemas/feed';
import { logAudit } from '@/lib/audit/log';
import { clientIp, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../../_lib/http';
import { requireFeature } from '../../../_lib/feature';

/**
 * Report a post.
 *
 * Any active member can. The reporter is recorded and shown to moderators,
 * and never to the author: a report that names its sender is a report
 * nobody makes about a batchmate. Reporting your own post is refused (that
 * is a delete), and reporting the same post twice is a no-op with a kind
 * answer rather than a second report that inflates the count.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    requireActive(session);
    const { tenant } = await requireFeature('feed', 'The community feed is');

    const { id } = await params;
    const { reason } = await readJson(request, PostReport);

    limit(`post-report:${session.memberId}`, 20, 24 * 60 * 60, 'Twenty reports in a day is the limit. If something is badly wrong, write to the help desk.');

    const post = getPostById(session, id);
    if (!post || post.state !== 'published') throw new HttpError(404, 'not_found', 'There is no post with that id.');
    if (post.author.id === session.memberId) {
      throw new HttpError(409, 'own_post', 'That is your own post. You can remove it from its menu.');
    }
    if (post.viewerReported) {
      return json({ ok: true, persisted: false, alreadyReported: true, note: 'You have already reported this post. A moderator will look at it.' });
    }

    await logAudit({
      tenantId: tenant.id,
      session,
      action: 'post.report',
      resource: 'posts',
      resourceId: post.id,
      before: null,
      after: { reason },
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();
    return json({
      ok: true,
      ...write,
      note: 'Reported. A moderator at the college will look at it. The author is not told who reported it.',
    });
  } catch (err) {
    return fail(err);
  }
}
