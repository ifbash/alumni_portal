import type { Capability, Role } from '@/lib/auth/permissions';
import { ROLES, roleHas } from '@/lib/auth/permissions';
import { ROLE_LABELS } from '@/lib/identity';

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
 * The list shows only this; the machine name sits on the entry page, for
 * the engineer who greps for it.
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
  'comms.send': 'Sent a message',
  'data_request.fulfil': 'Fulfilled a data request',
  'tenant.configure': 'Changed college settings',
};

export function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action.replace(/[._]/g, ' ');
}

/** The action as a verb phrase mid-sentence: "Sridevi Kandula (Alumni cell) verified a member". */
export function actionSentence(action: string): string {
  if (action === 'member.export') return 'ran a bulk contact export';
  const label = actionLabel(action);
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/** What kind of record an entry touched, in words. Never linked to a member. */
const RESOURCE_LABEL: Record<string, string> = {
  member: 'Member record',
  member_role: 'Role grant',
  tenant_branding: 'Branding',
  tenant: 'College settings',
  degree_register: 'Degree register',
  job_posting: 'Job posting',
  event: 'Event',
  campaign: 'Message',
  data_request: 'Data request',
};

export function resourceLabel(resource: string): string {
  const known = RESOURCE_LABEL[resource];
  if (known) return known;
  const words = resource.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function roleLabel(role: Role | null): string | null {
  return role ? (ROLE_LABELS[role] ?? role) : null;
}

export interface FlaggedAction {
  /** One line, on the entry itself, saying why a reviewer stopped here. */
  why: string;
  /** What the action is, after "cannot": "run a bulk contact export". */
  toDo: string;
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
 * bulk. Everything else in the log is context around one of them. They
 * carry a flag in the list so a reviewer scrolling 84 rows finds them
 * without filtering first — the quick filters are for when you already
 * know what you are looking for.
 */
export const FLAGGED: Record<string, FlaggedAction> = {
  'member.export': {
    why: 'A bulk export can move the whole alumni list off the platform. Only the college admin can run one, and every export names a scope and a reason first.',
    capability: 'member.export',
    toDo: 'run a bulk contact export',
  },
  'role.grant': {
    why: 'A role grant widens what somebody can see, permanently and quietly. Most escalation found in a review is a legitimate-looking grant made at the wrong time.',
    capability: 'role.manage',
    toDo: 'grant a role',
  },
  'rollover.execute': {
    why: 'The rollover changes the status of a whole batch at once. Undoing it means restoring the database, which is why it is run by hand after a dry run.',
    capability: 'rollover.execute',
    toDo: 'run the annual rollover',
  },
  'member.merge': {
    why: 'A merge folds two records into one. If it was wrong, this entry is the only record of what the two looked like before.',
    capability: 'profile.merge',
    toDo: 'merge member records',
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

/** The roles that can take a flagged action, by name: "College admin". */
export function rolesAllowed(action: string): string[] {
  const flagged = FLAGGED[action];
  if (!flagged) return [];
  return ROLES.filter((r) => r !== 'platform_admin' && roleHas(r, flagged.capability)).map((r) => ROLE_LABELS[r] ?? r);
}

/**
 * The quick filters above the list. Each is a set of machine actions, so
 * "Role changes" covers grants and revocations together.
 */
export const QUICK_FILTERS: Record<string, { label: string; actions: string[] }> = {
  exports: { label: 'Exports', actions: ['member.export'] },
  roles: { label: 'Role changes', actions: ['role.grant', 'role.revoke'] },
  merges: { label: 'Merges', actions: ['member.merge'] },
  rollovers: { label: 'Rollovers', actions: ['rollover.execute'] },
};

/** Member statuses and other stored enums, as a reader says them. */
const VALUE_LABEL: Record<string, string> = {
  unclaimed: 'Not registered',
  invited: 'Invited',
  pending: 'Awaiting verification',
  active_student: 'Final-year student',
  active_alumni: 'Alumni',
  rejected: 'Rejected',
  lapsed: 'Lapsed',
  deceased: 'Deceased',
  ...ROLE_LABELS,
};

/** A stored value for display: known enums as words, the rest as written. */
export function valueLabel(value: string): string {
  return VALUE_LABEL[value] ?? value;
}
