import { IS_FIXTURE } from '../config';
import type { Session } from '../auth/guard';

/**
 * Audit writer.
 *
 * Every admin mutation calls this. Snapshots are stored whole rather than
 * as diffs — reconstructing state from a diff chain during an incident is
 * exactly when you cannot afford the extra step.
 *
 * Never throws: a failed audit write must not roll back the operation it
 * describes, but it must be loud in the logs. Silence here is how an
 * audit trail turns out to have been empty for six months.
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

export async function logAudit(args: AuditArgs): Promise<void> {
  if (IS_FIXTURE) {
    memoryLog.push({ ...args, at: new Date().toISOString() });
    if (memoryLog.length > 200) memoryLog.shift();
    console.info('[audit]', args.action, args.resource, args.resourceId ?? '');
    return;
  }

  try {
    const { prisma } = await import('../db/client');
    await prisma.auditLog.create({
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
        // X-Forwarded-For is a list; the client address is the first entry
        // and everything after it is a proxy we control.
        ip: args.ip?.split(',')[0]?.trim() ?? null,
      },
    });
  } catch (err) {
    console.error('[audit] write failed', { action: args.action, err });
  }
}
