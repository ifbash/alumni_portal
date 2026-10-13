import { IS_FIXTURE } from '../config';
import type { Session } from '../auth/guard';
import { auditIpFrom } from '../client-ip';

/**
 * Audit writer.
 *
 * Every admin mutation calls this. Snapshots are stored whole rather than
 * as diffs — reconstructing state from a diff chain during an incident is
 * exactly when you cannot afford the extra step.
 *
 * By default it never throws: a failed audit write must not roll back the
 * operation it describes, but it must be loud in the logs. Silence here is
 * how an audit trail turns out to have been empty for six months.
 *
 * The exception is an action that *releases data* - a bulk export. Those
 * pass `{ strict: true }` and the write is a precondition: "who exported
 * the alumni list" has to have an answer before the list leaves, so if the
 * entry cannot be written, the file is not produced.
 */

export interface AuditArgs {
  tenantId: string;
  session: Session | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  /**
   * Required by convention for anything touching bulk contact data.
   * "Who exported the alumni list and why" is the first question asked
   * after a leak, and an empty column is not an answer.
   */
  reason?: string | null;
  ip?: string | null;
}

/** Fixture-mode sink, so admin screens are exercisable without Postgres. */
const memoryLog: Array<AuditArgs & { at: string }> = [];

export function recentAuditWrites() {
  return [...memoryLog].reverse();
}

export async function logAudit(args: AuditArgs, options: { strict?: boolean } = {}): Promise<void> {
  if (IS_FIXTURE) {
    memoryLog.push({ ...args, at: new Date().toISOString() });
    if (memoryLog.length > 200) memoryLog.shift();
    console.info('[audit]', args.action, args.resource, args.resourceId ?? '');
    return;
  }

  try {
    // Through withTenant: audit_log is under row-level security, and an INSERT
    // with no tenant context is refused - which, swallowed below, would mean
    // an audit trail that is silently empty.
    const { withTenant } = await import('../db/client');
    await withTenant(args.tenantId, (tx) =>
      tx.auditLog.create({
      data: {
        tenantId: args.tenantId,
        actorId: args.session?.memberId ?? null,
        actorRole: args.session?.roles[0]?.role ?? null,
        action: args.action,
        resource: args.resource,
        resourceId: args.resourceId ?? null,
        before: (args.before ?? null) as never,
        after: (args.after ?? null) as never,
        reason: args.reason ?? null,
        // Counted from the right of X-Forwarded-For and checked to be a real
        // address: a forged or sentinel value must not reject the whole row.
        ip: auditIpFrom(args.ip),
      },
      }),
    );
  } catch (err) {
    console.error('[audit] write failed', { action: args.action, err });
    if (options.strict) throw err;
  }
}
