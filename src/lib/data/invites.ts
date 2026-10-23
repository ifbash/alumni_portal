import type { Session } from '../auth/guard';
import { INVITATIONS } from './seed-community';
import { SEED_NOW } from '../clock';
import type { InvitationItem, InviteQuota } from './types';

/**
 * Invitations.
 *
 * A member can bring in a batchmate who has not registered. What that
 * records is somebody's name and address, supplied by a third party, for a
 * person who has agreed to nothing yet. So the list is the inviter's own
 * and nobody else's (not the college's, not the vendor's), the volume is
 * capped, and the invitation expires.
 */

/** Invitations a member may send in a rolling week. */
export const INVITE_WEEKLY_LIMIT = 10;

/** How long an invitation stays open, in days. */
export const INVITE_VALID_DAYS = 30;

const WEEK = 7 * 86400000;

export function getMyInvitations(session: Session): InvitationItem[] {
  return INVITATIONS.filter((i) => i.inviterId === session.memberId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((i) => ({
      id: i.id,
      email: i.email,
      name: i.name,
      batchYear: i.batchYear,
      message: i.message,
      state: i.state,
      createdAt: i.createdAt,
    }));
}

export function getInviteQuota(session: Session, now: Date = SEED_NOW): InviteQuota {
  const since = now.getTime() - WEEK;
  const sentThisWeek = INVITATIONS.filter(
    (i) => i.inviterId === session.memberId && new Date(i.createdAt).getTime() >= since,
  ).length;
  const remaining = Math.max(0, INVITE_WEEKLY_LIMIT - sentThisWeek);

  return {
    sentThisWeek,
    weeklyLimit: INVITE_WEEKLY_LIMIT,
    remaining,
    canSend: remaining > 0,
    reason:
      remaining > 0
        ? null
        : `You have sent ${INVITE_WEEKLY_LIMIT} invitations in the last week, which is the limit. It frees up as the oldest one passes seven days.`,
  };
}
