import type { Capability, Role } from '@/lib/auth/permissions';
import { roleHas } from '@/lib/auth/permissions';

/**
 * Vocabulary shared by the audit list and the entry detail.
 *
 * Colocated with the two routes that use it rather than pushed into
 * `src/lib`: nothing else in the product needs to know how an audit
 * action is worded, and a shared module that only ever has two callers
 * is a shared module nobody maintains.
 */

/**
 * Human phrasing for the machine action names the log stores.
 *
 * The machine name is still shown next to it. An incident review is read
 * by a registrar and grepped by an engineer, and neither audience should
 * have to translate for the other.
 */
const ACTION_LABEL: Record<string, string> = {
  'member.verify': 'Verified a member',
  'member.reject': 'Rejected a registration',
  'member.export': 'Bulk contact export',
  'member.merge': 'Merged two member records',
  'role.grant': 'Granted a role',
  'role.revoke': 'Revoked a role',
  'rollover.execute': 'Ran the annual rollover',
  'degree_register.import': 'Imported degree register rows',
  'branding.publish': 'Published branding',
  'job.moderate': 'Moderated a job posting',
  'event.create': 'Created an event',
  'comms.send': 'Sent a campaign',
  'data_request.fulfil': 'Fulfilled a data request',
  'tenant.configure': 'Changed tenant settings',
};

export function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action.replace(/[._]/g, ' ');
}

export interface FlaggedAction {
  /** One line, on the entry itself, saying why a reviewer stopped here. */
  why: string;
  /**
   * The capability the matrix says this action needs. Compared against the
   * role recorded on the entry — see `capabilityMismatch`.
   */
  capability: Capability;
}

/**
 * The four actions an incident review starts from.
 *
 * Not "important actions" in the abstract: these are the four that either
 * move data off the platform, widen who can see it, or rewrite identity in
 * bulk. Everything else in the log is context around one of them. They are
 * shaded in the list so a reviewer scrolling 84 rows finds them without
 * filtering first — the filter is for when you already know what you are
 * looking for.
 */
export const FLAGGED: Record<string, FlaggedAction> = {
  'member.export': {
    why: 'A bulk export is the one action that can move the entire alumni list off the platform. It is restricted to college_admin, and every export has to name a scope and a reason before it runs.',
    capability: 'member.export',
  },
  'role.grant': {
    why: 'A role grant widens what somebody can see, permanently and quietly. Most privilege escalation found in a review turns out to be a legitimate-looking grant made by the right person at the wrong time.',
    capability: 'role.manage',
  },
  'rollover.execute': {
    why: 'The rollover rewrites the status of an entire batch in one statement. Undoing it is a database restore, not a button — which is why it is admin-triggered with a dry run and never scheduled.',
    capability: 'rollover.execute',
  },
  'member.merge': {
    why: 'A merge collapses two identities into one and moves the losing row’s history across. If the merge was wrong, this entry is the only record of what the two records looked like beforehand.',
    capability: 'profile.merge',
  },
};

export function isFlagged(action: string): boolean {
  return Object.prototype.hasOwnProperty.call(FLAGGED, action);
}

/**
 * True when the role stamped on the entry does not carry the capability
 * the action needs.
 *
 * Not proof of anything on its own — the log records one role, and a
 * person can hold several — but it is the cheapest question worth asking
 * of a flagged entry, and asking it costs a lookup in the capability
 * matrix rather than an afternoon in the roles table.
 */
export function capabilityMismatch(action: string, actorRole: Role | null): boolean {
  const flagged = FLAGGED[action];
  if (!flagged || !actorRole) return false;
  return !roleHas(actorRole, flagged.capability);
}
