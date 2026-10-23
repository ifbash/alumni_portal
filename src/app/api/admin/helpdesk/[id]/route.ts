import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTicketForViewer } from '@/lib/data/helpdesk';
import { StaffReply } from '@/lib/schemas/helpdesk';
import { logAudit } from '@/lib/audit/log';
import { clientIp, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../../_lib/http';
import { requireFeature } from '../../../_lib/feature';

/**
 * Answer a ticket.
 *
 * Behind `helpdesk.manage`: the alumni cell and the college admin. The
 * platform operator holds no such capability and is turned away at the
 * route policy too; a ticket is a member's own account described in their
 * own words.
 *
 * A reply says where the ticket goes next, `answered` or `closed`, so a
 * ticket never closes because somebody pressed the wrong button. The audit
 * entry records who answered and the new state, not the text: what staff
 * said to a member is the member's correspondence, not a log line.
 */

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    requireCap(session, 'helpdesk.manage');
    const { tenant } = await requireFeature('helpdesk', 'The help desk is');

    const { id } = await params;
    const { body, state } = await readJson(request, StaffReply);
    limit(`helpdesk-staff:${session.memberId}`, 200, 60 * 60, 'Two hundred replies in an hour is the limit.');

    const ticket = getTicketForViewer(session, id);
    if (!ticket) throw new HttpError(404, 'not_found', 'There is no ticket with that reference.');

    await logAudit({
      tenantId: tenant.id,
      session,
      action: 'helpdesk.reply',
      resource: 'support_tickets',
      resourceId: ticket.id,
      before: { state: ticket.state },
      after: { state, replyLength: body.length },
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();
    return json({
      ok: true,
      ...write,
      ticket: { reference: ticket.reference, state },
      message: { authorName: 'You', fromStaff: true, body, createdAt: new Date().toISOString() },
      note: state === 'closed' ? 'Sent and closed. The member can still ask a new question.' : 'Sent. It shows as answered until the member replies.',
    });
  } catch (err) {
    return fail(err);
  }
}
