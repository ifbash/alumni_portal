import { PrismaClient } from '@prisma/client';

/**
 * Tenant-scoped database access.
 *
 * Row-level security in Postgres reads `app.tenant_id` from the session
 * through `app_tenant_id()` (migration 0001). If it is absent or empty that
 * function returns NULL, no policy matches, and a query returns nothing - an
 * INSERT is refused. A missing tenant context yields an empty result set,
 * never another college's data, and never an error that something might
 * catch and turn into "no results found".
 *
 * That only holds when the connection is not the table owner and has no
 * BYPASSRLS: `DATABASE_URL` must name a login role that is a member of
 * `alumni_app` (see the end of the initial migration), not the role that
 * runs migrations. `tests/rls.test.ts` runs the migration and proves it.
 *
 * Never use the bare client for tenant data. `prisma` is exported only
 * for migrations, health checks and the tenant lookup itself.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (!UUID.test(tenantId)) {
    throw new Error('withTenant: tenantId must be a uuid');
  }

  return prisma.$transaction(async (tx) => {
    // `set_config(..., true)` is `SET LOCAL` with a bound parameter: scoped to
    // this transaction, discarded at COMMIT, and nothing is interpolated into
    // SQL. (`SET LOCAL x = '${id}'` was only safe because of the regex above.)
    await tx.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}
