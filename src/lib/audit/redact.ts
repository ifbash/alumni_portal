import type { AuditEntry } from '../data/types';

/**
 * What the vendor may read of the audit trail.
 *
 * `platform_admin` holds `audit.read` so that, answering an incident, it
 * can see who did what and when. The log also stores whole `before` and
 * `after` documents and free-text reasons, and those carry member data: a
 * name and roll number in a status change, the first 280 characters of a
 * broadcast, a data-subject's own words on an erasure request. Reading
 * them is reading the customer's data, which is the one thing the vendor
 * is promised it cannot do (CLAUDE.md).
 *
 * So the vendor gets the *event* - actor, action, resource, time - and
 * nothing that describes a person.
 */
export function redactAuditEntry(entry: AuditEntry): AuditEntry {
  return { ...entry, reason: null, before: null, after: null };
}
