import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { require as requireCap, requireSession } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { findMemberById, getConnections, getConnectionQuota } from '@/lib/data/repo';
import { visibleStatusesFor } from '@/lib/members/projection';
import type { ConnectionKind } from '@/lib/data/types';
import { draftId, fail, fixtureWrite, HttpError, json, parseQuery, readJson } from '../_lib/http';
import { narrowSummary } from '../_lib/summary';

/**
 * Connection requests — the student-to-alumni valve.
 *
 * If 400 final-years can write to 8,000 alumni without limit, the alumni
 * disengage within a month and the network is dead. The quota is not a
 * throttle bolted on for abuse; it is the reason the directory stays
 * worth being listed in, and it is enforced here before anything else
 * happens.
 *
 * Availability is the second gate. A mentorship request to somebody who
 * has not offered mentorship is refused rather than delivered, because
 * the switch on their profile is a commitment they made and not a
 * preference the sender may overrule.
 */

const MIN_MESSAGE = 30;
const MAX_MESSAGE = 1200;

const ListQuery = z.object({
  direction: z.enum(['received', 'sent', 'accepted']).optional(),
});

const SendBody = z.object({
  toMemberId: z.string().trim().min(1).max(64),
  kind: z.enum(['mentorship', 'referral', 'introduction', 'speaking']),
  message: z
    .string()
    .trim()
    .min(
      MIN_MESSAGE,
      'Say a little more — two or three sentences on who you are and what you want to ask.',
    )
    .max(MAX_MESSAGE, 'Keep it under 1,200 characters. Anything longer reads as a form letter.'),
});

/** The availability switch each kind of request depends on. */
const REQUIRES: Record<ConnectionKind, 'openToMentoring' | 'openToReferrals' | 'openToSpeaking' | null> = {
  mentorship: 'openToMentoring',
  referral: 'openToReferrals',
  speaking: 'openToSpeaking',
  introduction: null,
};

const UNAVAILABLE: Record<string, string> = {
  openToMentoring: 'This member is not taking mentorship requests at the moment.',
  openToReferrals: 'This member is not taking referral requests at the moment.',
  openToSpeaking: 'This member is not taking speaking invitations at the moment.',
};

async function connectionsFeature() {
  const resolved = await getTenantBrand();
  if (!resolved) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');
  if (!resolved.brand.pack.features.connections) {
    throw new HttpError(404, 'feature_off', 'Connections are not enabled for this college.');
  }
  return resolved;
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    requireSession(session);
    await connectionsFeature();

    const { direction = 'received' } = parseQuery(request, ListQuery);

    // `getConnections` scopes to the signed-in member on both sides; there
    // is no argument that would return somebody else's inbox.
    const items = getConnections(session, direction);

    return json({
      direction,
      items: items.map((c) => ({
        id: c.id,
        kind: c.kind,
        state: c.state,
        message: c.message,
        createdAt: c.createdAt,
        respondedAt: c.respondedAt,
        expiresAt: c.expiresAt,
        from: narrowSummary(session, c.from),
        to: narrowSummary(session, c.to),
        role: c.from.id === session.memberId ? 'sender' : 'recipient',
      })),
      total: items.length,
      quota: getConnectionQuota(session),
    });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    requireCap(session, 'connection.send');
    await connectionsFeature();

    const body = await readJson(request, SendBody);

    if (body.toMemberId === session.memberId) {
      throw new HttpError(422, 'invalid_input', 'You cannot send yourself a connection request.', {
        fieldErrors: { toMemberId: 'That is your own profile.' },
      });
    }

    // The quota check comes before the lookup, so a caller who is over
    // limit cannot use this endpoint to probe which member ids exist.
    const quota = getConnectionQuota(session);
    if (!quota.canSend) {
      throw new HttpError(
        429,
        'quota_exhausted',
        quota.reason ?? 'You have reached your request limit for now.',
        { quota, retryAfter: 60 * 60 },
      );
    }

    const target = findMemberById(body.toMemberId);
    const visible = new Set(visibleStatusesFor(session));

    // One answer for "no such member" and "not someone you can see", for
    // the same reason the profile route has one 404: a distinguishable
    // response is a membership oracle over the whole student roll.
    if (!target || !visible.has(target.status)) {
      throw new HttpError(404, 'not_found', 'That member is not available to connect with.');
    }

    const requiredFlag = REQUIRES[body.kind];
    if (requiredFlag && !target[requiredFlag]) {
      throw new HttpError(409, 'not_available', UNAVAILABLE[requiredFlag]);
    }

    const existing = [...getConnections(session, 'sent'), ...getConnections(session, 'received')].find(
      (c) =>
        (c.to.id === target.id || c.from.id === target.id) &&
        (c.state === 'pending' || c.state === 'accepted' || c.state === 'blocked'),
    );

    if (existing) {
      // A block is never disclosed as a block. The sender is told the
      // request cannot be sent, which is true, and nothing about why.
      if (existing.state === 'blocked') {
        throw new HttpError(409, 'unavailable', 'You cannot send a request to this member.');
      }
      throw new HttpError(
        409,
        existing.state === 'accepted' ? 'already_connected' : 'already_pending',
        existing.state === 'accepted'
          ? 'You are already connected. Write to them directly rather than opening a second request.'
          : 'You already have a request waiting with this member. Give them time to reply.',
        { connectionId: existing.id },
      );
    }

    const write = fixtureWrite();

    return json(
      {
        ok: true,
        ...write,
        request: {
          id: draftId('conn'),
          kind: body.kind,
          state: 'pending' as const,
          message: body.message,
          createdAt: new Date().toISOString(),
          respondedAt: null,
          // Fourteen days. A request that sits open forever is a quota
          // slot the sender never gets back.
          expiresAt: new Date(Date.now() + 14 * 86400000).toISOString(),
          // The target is a full member row. `narrowSummary` selects into
          // the viewer's tier, so the contact record and academic columns
          // it also carries cannot travel with it.
          to: narrowSummary(session, target),
        },
        quota,
        note: 'Contact details are released only if they accept, and only if their visibility setting allows it.',
      },
      { status: 201 },
    );
  } catch (err) {
    return fail(err);
  }
}
