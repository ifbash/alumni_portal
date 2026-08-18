import { DATA_MODE, DEFAULT_TENANT, IS_FIXTURE, NOTICE_VERSION } from '@/lib/config';
import { getTenant } from '@/lib/tenant';
import { fail, json } from '../_lib/http';

/**
 * Liveness and configuration check.
 *
 * Answers the three questions asked when a deployment looks wrong:
 * which data mode is this running in, did the host resolve to a tenant,
 * and which build is it. Tenant resolution is the one that actually
 * catches things — an unknown subdomain renders a "portal not found"
 * page that looks identical to a DNS mistake, and this says which it is.
 *
 * Unauthenticated on purpose: an uptime probe cannot hold a session.
 * Nothing here is a secret — the subdomain and the brand pack are both
 * derived from the Host header the caller already sent — and nothing
 * about *other* tenants is reachable from it.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenant = await getTenant();

    return json(
      {
        ok: true,
        status: tenant ? 'healthy' : 'degraded',
        mode: DATA_MODE,
        fixture: IS_FIXTURE,
        version: process.env.APP_VERSION ?? '0.2.0',
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        environment: process.env.NODE_ENV ?? 'development',
        region: process.env.VERCEL_REGION ?? null,
        noticeVersion: NOTICE_VERSION,
        tenant: tenant
          ? {
              resolved: true,
              id: tenant.id,
              subdomain: tenant.subdomain,
              shortName: tenant.shortName,
              packId: tenant.packId,
              fcraRegistered: tenant.fcraRegistered,
            }
          : {
              resolved: false,
              // The most common cause by a distance, and the one a
              // deployment checklist can act on.
              hint: `No college is configured for this host. Single-tenant deployments fall back to “${DEFAULT_TENANT}”; multi-tenant ones need a matching subdomain.`,
            },
        time: new Date().toISOString(),
      },
      // A degraded tenant resolution is still a running app, so the status
      // code stays 200 for the process check and the payload carries the
      // detail. A load balancer that cannot reach this at all is the
      // failure signal.
      { status: 200 },
    );
  } catch (err) {
    return fail(err);
  }
}
