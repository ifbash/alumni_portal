import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { can, requireSession, AuthzError } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getConnections, getConnectionQuota } from '@/lib/data/repo';
import type { ConnectionRequest, ConnectionState } from '@/lib/data/types';
import { fail, fixtureWrite, HttpError, json, readJson } from '../../_lib/http';
import { narrowSummary } from '../../_lib/summary';

/**
 * Answer a connection request.
 *
 * Four actions, and which of them you may take is decided by which end of
 * the request you are on — not by a role. The recipient accepts, declines
 * or blocks; the sender withdraws. A handler that checked only the
 * capability would let any member with `connection.send` decline somebody
 * else's request by guessing an id.
 *
 * Accepting is the moment the `on_accept` visibility setting opens. That
 * release is computed at read time by `releaseContact()`, never copied
 * into the connection row, so a member who later narrows their visibility
 * narrows it for connections already accepted too.
 */

const Body = z.object({
  action: z.enum(['accept', 'decline', 'withdraw', 'block']),
  /** Shown to the sender on a decline. Optional, and never required. */
  note: z.string().trim().max(400).optional(),
});

const NEXT_STATE: Record<z.infer<typeof Body>['action'], ConnectionState> = {
  accept: 'accepted',
  decline: 'declined',
  withdraw: 'withdrawn',
  block: 'blocked',
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    requireSession(session);

    const resolved = await getTenantBrand();
    if (!resolved) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');
    if (!resolved.brand.pack.features.connections) {
      throw new HttpError(404, 'feature_off', 'Connections are not enabled for this college.');
    }

    const { id } = await params;
    const body = await readJson(request, Body);

    // Both lists are already scoped to the signed-in member, so a request
    // that belongs to somebody else simply is not in here to be found.
    const mine: ConnectionRequest[] = [
      ...getConnections(session, 'sent'),
      ...getConnections(session, 'received'),
    ];
    const connection = mine.find((c) => c.id === id);

    if (!connection) {
      throw new HttpError(404, 'not_found', 'That request is not one of yours.');
    }

    const isRecipient = connection.to.id === session.memberId;
    const isSender = connection.from.id === session.memberId;

    if (body.action === 'withdraw') {
      if (!isSender) {
        throw new AuthzError(403, 'forbidden', 'Only the sender can withdraw a request.');
      }
    } else {
      if (!isRecipient) {
        throw new AuthzError(403, 'forbidden', 'Only the person a request was sent to can answer it.');
      }
      // Students hold `connection.send` and not `connection.receive`; they
      // cannot be on the answering end of a request at all.
      if (!can(session, 'connection.receive')) {
        throw new AuthzError(403, 'forbidden', 'Your account cannot receive connection requests.');
      }
    }

    const from = connection.state;
    const to = NEXT_STATE[body.action];

    const allowed =
      body.action === 'block'
        ? from === 'pending' || from === 'accepted' || from === 'declined'
        : from === 'pending';

    if (!allowed) {
      throw new HttpError(
        409,
        'invalid_transition',
        from === 'accepted'
          ? 'That request has already been accepted.'
          : from === 'blocked'
            ? 'That request is blocked and cannot be changed.'
            : `That request is already ${from}, so there is nothing left to answer.`,
        { state: from },
      );
    }

    if (body.action === 'decline' && body.note && body.note.length < 5) {
      throw new HttpError(422, 'invalid_input', 'Either write a short line back or leave the note empty.', {
        fieldErrors: { note: 'Too short to be worth sending. Leave it blank instead.' },
      });
    }

    const write = fixtureWrite();

    return json({
      ok: true,
      ...write,
      connection: {
        id: connection.id,
        kind: connection.kind,
        state: to,
        previousState: from,
        respondedAt: new Date().toISOString(),
        counterparty: narrowSummary(session, isSender ? connection.to : connection.from),
      },
      // Only true when the owner's visibility setting is `on_accept` or
      // wider; the read path decides, not this response.
      contactMayRelease: to === 'accepted',
      quota: isSender ? getConnectionQuota(session) : null,
      note:
        to === 'accepted'
          ? 'They can now see the contact details your visibility setting allows, and you can see theirs.'
          : to === 'declined'
            ? 'The sender is told the request was answered, not that it was refused. Declining is never shown as a rejection.'
            : to === 'blocked'
              ? 'They will not be able to send you another request, and they are not told why.'
              : 'The request is withdrawn and the quota slot is back.',
    });
  } catch (err) {
    return fail(err);
  }
}
