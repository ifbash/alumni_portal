import { getSession } from '@/lib/auth/session';
import { requireActive } from '@/lib/auth/guard';
import { getPostById } from '@/lib/data/feed';
import { PostLike } from '@/lib/schemas/feed';
import { fail, fixtureWrite, HttpError, json, limit, readJson } from '../../../_lib/http';
import { requireFeature } from '../../../_lib/feature';

/**
 * Like or unlike a post.
 *
 * Open to every active member, students included: reading and reacting are
 * not the same as writing, and a final-year congratulating an alumnus on a
 * promotion is the kind of contact the quotas elsewhere exist to make
 * possible, not to stop. A like is not audited (it is not a decision by
 * anybody about anything) and is rate limited so a script cannot inflate
 * a count.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    requireActive(session);
    await requireFeature('feed', 'The community feed is');

    const { id } = await params;
    const { liked } = await readJson(request, PostLike);

    limit(`post-like:${session.memberId}`, 120, 60 * 60, 'That is a lot of likes in an hour. Slow down a little.');

    const post = getPostById(session, id);
    if (!post || post.state !== 'published') throw new HttpError(404, 'not_found', 'There is no post with that id.');

    const write = fixtureWrite();
    // The count the screen should show, as this call leaves it.
    const likeCount = Math.max(0, post.likeCount + (liked ? (post.viewerLiked ? 0 : 1) : post.viewerLiked ? -1 : 0));
    return json({ ok: true, ...write, post: { id: post.id, liked, likeCount } });
  } catch (err) {
    return fail(err);
  }
}
