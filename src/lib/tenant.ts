import { cache } from 'react';
import { headers } from 'next/headers';
import { IS_FIXTURE, DEFAULT_TENANT } from './config';
import { getBrand, type ResolvedBrand } from './branding/resolve';
import { PACKS } from './branding/registry';
import { TENANTS } from './data/seed';

/**
 * Tenant resolution.
 *
 * One deployment serves many colleges, separated by subdomain:
 * `diet.portal.example` and `xyz.portal.example` are the same code and
 * different worlds. The tenant is resolved once per request, from the
 * Host header, and everything downstream — branding, row-level security,
 * feature flags — hangs off the result.
 *
 * Development hosts (`localhost`, `127.0.0.1`, Vercel preview URLs) have
 * no usable subdomain, so they fall back to `DEFAULT_TENANT`. That
 * fallback is deliberately *not* available in production: an unknown host
 * there is a misconfigured DNS record or someone probing, and both should
 * 404 rather than quietly serve the first college in the table.
 */

export interface Tenant {
  id: string;
  name: string;
  shortName: string;
  subdomain: string;
  packId: string | null;
  fcraRegistered: boolean;
}

function subdomainFrom(host: string): string | null {
  const clean = host.split(':')[0]?.toLowerCase() ?? '';
  if (!clean) return null;

  const isLocal =
    clean === 'localhost' ||
    clean.endsWith('.localhost') ||
    clean === '127.0.0.1' ||
    clean.endsWith('.vercel.app');

  if (isLocal) {
    const sub = clean.endsWith('.localhost') ? clean.replace('.localhost', '') : null;
    return sub ?? DEFAULT_TENANT;
  }

  const parts = clean.split('.');
  if (parts.length < 3) return null;
  return parts[0] ?? null;
}

export const getTenant = cache(async (): Promise<Tenant | null> => {
  const host = (await headers()).get('host') ?? '';
  const sub = subdomainFrom(host);
  if (!sub) return IS_FIXTURE ? fixtureTenant(DEFAULT_TENANT) : null;

  if (IS_FIXTURE) return fixtureTenant(sub);

  const { prisma } = await import('./db/client');
  const row = await prisma.tenant.findUnique({ where: { subdomain: sub } });
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    subdomain: row.subdomain,
    packId: (row.settings as { packId?: string } | null)?.packId ?? row.subdomain,
    fcraRegistered: row.fcraRegistered,
  };
});

function fixtureTenant(sub: string): Tenant | null {
  const seeded = TENANTS.find((t) => t.subdomain === sub);
  if (seeded) {
    return {
      id: seeded.id,
      name: seeded.name,
      shortName: seeded.shortName,
      subdomain: seeded.subdomain,
      packId: seeded.packId,
      fcraRegistered: seeded.fcraRegistered,
    };
  }

  // A brand pack with no tenant row still resolves, so dropping a JSON
  // file into `brands/` is enough to preview a prospect's portal.
  const pack = PACKS[sub];
  if (pack) {
    return {
      id: `pack-${sub}`,
      name: pack.copy.institutionName,
      shortName: pack.copy.shortName,
      subdomain: sub,
      packId: sub,
      fcraRegistered: false,
    };
  }

  return null;
}

/** Tenant plus its resolved design tokens — what every layout needs. */
export const getTenantBrand = cache(
  async (): Promise<{ tenant: Tenant; brand: ResolvedBrand } | null> => {
    const tenant = await getTenant();
    if (!tenant) return null;
    const brand = await getBrand(tenant.id, tenant.packId);
    return { tenant, brand };
  },
);
