import { getSession } from '@/lib/auth/session';
import { requireSession } from '@/lib/auth/guard';
import { getTicketForViewer } from '@/lib/data/helpdesk';
import { TicketMemberAction, TicketReply } from '@/lib/schemas/helpdesk';
import { fail, fixtureWrite, HttpError, json, limit, readJson } from '../../_lib/http';
import { requireFeature } from '../../_lib/feature';

/**
 * A member adding to, or closing, their own ticket.
 *
 * Only the member who wrote it. `getTicketForViewer` returns a ticket to its
 * author or to staff who answer tickets, so this checks the author again: a
 * staff member replying goes through the staff route, which records who.
 * Replying reopens a ticket that was answered, because a member answering
 * the question is a member who is not done.
 */

type Ctx = { params: Promise<{ id: string }> };

async function ownTicket(id: string) {
  const session = await getSession();
  requireSession(session);
  await requireFeature('helpdesk', 'The help desk is');

  const ticket = getTicketForViewer(session, id);
  // Not yours reads as not found, the same as a ticket that does not exist.
  if (!ticket || ticket.memberId !== session.memberId) {
    throw new HttpError(404, 'not_found', 'There is no question of yours with that reference.');
  }
  return { session, ticket };
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { session, ticket } = await ownTicket(id);
    const { body } = await readJson(request, TicketReply);

    limit(`helpdesk-reply:${session.memberId}`, 30, 60 * 60, 'Thirty messages in an hour is the limit.');

    if (ticket.state === 'closed') {
      throw new HttpError(409, 'closed', 'That question is closed. Ask a new one and mention the reference.');
    }

    const write = fixtureWrite();
    return json({
      ok: true,
      ...write,
      message: { authorName: ticket.memberName, fromStaff: false, body, createdAt: new Date().toISOString() },
      ticket: { reference: ticket.reference, state: 'open' },
      note: 'Sent. The alumni office will see it.',
    });
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { ticket } = await ownTicket(id);
    await readJson(request, TicketMemberAction);

    if (ticket.state === 'closed') throw new HttpError(409, 'closed', 'That question is already closed.');

    const write = fixtureWrite();
    return json({ ok: true, ...write, ticket: { reference: ticket.reference, state: 'closed' }, note: 'Closed. You can ask a new question any time.' });
  } catch (err) {
    return fail(err);
  }
}
