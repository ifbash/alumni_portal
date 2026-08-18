import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { requireSession } from '@/lib/auth/guard';
import { getNotifications } from '@/lib/data/repo';
import { clientIp, fail, fixtureWrite, json, limit, readJson } from '../_lib/http';

/**
 * Notifications.
 *
 * Read state is per member and is never shared: there is no capability
 * that lets one member mark another's notifications, and no parameter
 * that would express it. Both handlers resolve the member from the
 * session and ignore anything the caller might send about identity.
 *
 * `GET` is deliberately uncached. A notification list that a CDN serves
 * from thirty seconds ago is a list that shows a request the member has
 * already answered, and that is worse than no list.
 */

const Body = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('mark_read'),
    ids: z.array(z.string().min(1).max(64)).min(1).max(200),
  }),
  z.object({ action: z.literal('mark_all_read') }),
]);

export async function GET() {
  try {
    const session = await getSession();
    requireSession(session);

    const items = getNotifications(session);

    return json(
      {
        items,
        unread: items.filter((n) => !n.readAt).length,
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    requireSession(session);

    const body = await readJson(request, Body);

    // Generous, because marking things read is a normal burst — a member
    // clearing twenty rows should never be told to slow down. The cap
    // exists to stop a loop, not to police the member.
    limit(
      `notifications:${session.memberId}:${clientIp(request)}`,
      120,
      60,
      'That is a lot of requests at once. Wait a moment and try again.',
    );

    const own = getNotifications(session);
    const ownIds = new Set(own.map((n) => n.id));

    const targeted =
      body.action === 'mark_all_read'
        ? own.filter((n) => !n.readAt).map((n) => n.id)
        : // Silently drop ids that are not the caller's rather than 403ing.
          // A stale tab holding an id from a previous session is the common
          // cause, and it is not an attack worth an error screen. Nothing
          // is revealed either way: the response says how many matched.
          body.ids.filter((id) => ownIds.has(id));

    return json({
      ok: true,
      action: body.action,
      marked: targeted.length,
      // Fixture mode has no writable store, so the client is told plainly
      // that this did not persist rather than being shown a green tick
      // over nothing. `NotificationList` renders that as its own state.
      ...fixtureWrite(),
    });
  } catch (err) {
    return fail(err);
  }
}
