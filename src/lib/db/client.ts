import { PrismaClient } from '@prisma/client';

/**
 * Tenant-scoped database access.
 *
 * Row-level security in Postgres reads `app.tenant_id` from the session.
 * If it is not set, every policy evaluates false and queries return
 * nothing — which is the correct failure mode. A missing tenant context
 * yields an empty result set, never another college's data.
 *
 * Never use the bare client for tenant data. `prisma` is exported only
 * for migrations, health checks and the tenant lookup itself.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Run a callback with RLS scoped to one tenant.
 *
 * Uses an interactive transaction so the `SET LOCAL` applies to the same
 * connection as the queries inside it, and is discarded when the
 * transaction ends. Connection-pool safe — a plain `SET` would leak the
 * tenant context to whichever request picked up the connection next.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Omit<PrismaClient, '$transaction' | '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>) => Promise<T>,
): Promise<T> {
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) {
    throw new Error('withTenant: tenantId must be a uuid');
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    return fn(tx);
  });
}

/** Resolve a tenant from the request host. Runs outside RLS by design. */
export async function tenantFromHost(host: string) {
  const sub = host.split('.')[0]?.toLowerCase();
  if (!sub) return null;
  return prisma.tenant.findUnique({
    where: { subdomain: sub },
    include: { branding: true },
  });
}
