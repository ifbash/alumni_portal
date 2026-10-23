import { getSession } from '@/lib/auth/session';
import { requireSession } from '@/lib/auth/guard';
import { getMyTickets, nextTicketReference } from '@/lib/data/helpdesk';
import { TicketCreate } from '@/lib/schemas/helpdesk';
import { clientIp, draftId, fail, fixtureWrite, json, limit, readJson } from '../_lib/http';
import { requireFeature } from '../_lib/feature';

/**
 * Ask the alumni office.
 *
 * Open to any signed-in member, **including one still waiting to be
 * verified**: "my registration has been pending for two weeks" is the most
 * common ticket there will ever be, and the people who write it are not yet
 * active. So this is `requireSession`, not `requireActive`; a pending member
 * can ask and can read their own tickets, and nothing else.
 *
 * A ticket is a member describing their own account, so it is private to
 * them and to the people who answer tickets. It is not audited on creation
 * (the audit log records decisions staff make, not messages members send);
 * staff replies are.
 */

export async function GET() {
  try {
    const session = await getSession();
    requireSession(session);
    await requireFeature('helpdesk', 'The help desk is');
    return json({ tickets: getMyTickets(session) });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    requireSession(session);
    await requireFeature('helpdesk', 'The help desk is');

    const body = await readJson(request, TicketCreate);

    limit(
      `helpdesk-create:${session.memberId}`,
      5,
      24 * 60 * 60,
      'Five questions in a day is the limit. Add to the one you have already sent rather than starting another.',
    );
    limit(`helpdesk-ip:${clientIp(request)}`, 30, 60 * 60, 'Too many questions from this connection in an hour.');

    const now = new Date().toISOString();
    const ticket = {
      id: draftId('tkt'),
      reference: nextTicketReference(),
      kind: 'help' as const,
      category: body.category,
      subject: body.subject,
      state: 'open' as const,
      createdAt: now,
      messages: [{ authorId: session.memberId, fromStaff: false, body: body.body, createdAt: now }],
    };

    const write = fixtureWrite();
    return json(
      {
        ok: true,
        ...write,
        ticket,
        href: `/help/tickets/${ticket.reference}`,
        note: `Sent. Your reference is ${ticket.reference}. The alumni office answers here, and you will see the reply under your questions.`,
      },
      { status: 201 },
    );
  } catch (err) {
    return fail(err);
  }
}
