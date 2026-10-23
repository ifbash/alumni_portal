import { getSession } from '@/lib/auth/session';
import { requireSession } from '@/lib/auth/guard';
import { nextTicketReference } from '@/lib/data/helpdesk';
import { Feedback } from '@/lib/schemas/helpdesk';
import { clientIp, draftId, fail, fixtureWrite, json, limit, readJson } from '../_lib/http';
import { requireFeature } from '../_lib/feature';

/**
 * The feedback button.
 *
 * One endpoint behind the button every member page carries. What arrives is
 * filed as a help-desk ticket of kind `feedback`, so it is read by the same
 * people, in the same queue, and answered the same way; there is no second
 * inbox to forget. It records the page the button was pressed on (a path
 * only, never a query string) because "this page is slow" is useless
 * without the page.
 *
 * Open to any signed-in member, pending ones included. The vendor is turned
 * away by the route policy: feedback names the sender, and the vendor does
 * not read member correspondence.
 */

export async function POST(request: Request) {
  try {
    const session = await getSession();
    requireSession(session);
    await requireFeature('helpdesk', 'The help desk is');

    const body = await readJson(request, Feedback);

    limit(`feedback:${session.memberId}`, 10, 24 * 60 * 60, 'Ten pieces of feedback in a day is the limit. Add the rest to one message.');
    limit(`feedback-ip:${clientIp(request)}`, 40, 60 * 60, 'Too much feedback from this connection in an hour.');

    const now = new Date().toISOString();
    const ticket = {
      id: draftId('tkt'),
      reference: nextTicketReference(),
      kind: 'feedback' as const,
      category: 'other' as const,
      subject: body.message.length > 70 ? `${body.message.slice(0, 67).trimEnd()}…` : body.message,
      pagePath: body.pagePath ?? null,
      state: 'open' as const,
      createdAt: now,
      messages: [{ authorId: session.memberId, fromStaff: false, body: body.message, createdAt: now }],
    };

    const write = fixtureWrite();
    return json(
      {
        ok: true,
        ...write,
        ticket,
        note: 'Thank you. It has gone to the alumni office, and you will find it under your questions on the help page.',
      },
      { status: 201 },
    );
  } catch (err) {
    return fail(err);
  }
}
