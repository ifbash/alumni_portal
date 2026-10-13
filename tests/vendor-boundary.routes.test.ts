import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '../src/lib/auth/guard';

/**
 * The vendor boundary, at the two route handlers that could move it.
 *
 * `vendor-boundary.test.ts` pins what `platform_admin` may do. That was
 * never the whole promise: it also matters who can *become* the vendor,
 * and whose audit log the vendor's own work lands in. Both were wrong in
 * a way no capability-matrix test could see, because each lived in a
 * handler rather than in the matrix.
 *
 *  1. `POST /api/admin/roles` refused cohort roles and nothing else, so a
 *     college admin — `role.manage`, a tenant capability — could grant
 *     `platform_admin` to any member of their college. That role holds
 *     `tenant.provision`: tenant to vendor in one request.
 *  2. `POST /api/platform/tenants` filed the provisioning entry in the
 *     audit scope of whichever college the vendor happened to be browsing
 *     from, with the new college's admin email in the snapshot. DIET's
 *     `audit.read` holders would have been reading another customer's
 *     onboarding.
 *
 * These call the real handlers. Only the two request-scoped inputs are
 * stubbed — the signed-in session (which needs a cookie jar) and the
 * resolved tenant (which needs a Host header) — so every guard, schema,
 * refusal and audit write below is the production code path.
 */

const ctx = vi.hoisted(() => ({
  session: null as Session | null,
  tenant: { id: 'ten-diet', name: 'DIET', shortName: 'DIET', subdomain: 'diet', packId: 'diet', fcraRegistered: false } as {
    id: string;
    name: string;
    shortName: string;
    subdomain: string;
    packId: string | null;
    fcraRegistered: boolean;
  } | null,
}));

vi.mock('@/lib/auth/session', () => ({
  getSession: async () => ctx.session,
  // Every limit admits: these tests are about refusals the rate limiter
  // must not be the reason for.
  rateLimit: () => ({ ok: true, retryAfter: 0 }),
}));

vi.mock('@/lib/tenant', () => ({
  getTenant: async () => ctx.tenant,
}));

const { POST: rolesPOST } = await import('../src/app/api/admin/roles/route');
const { POST: tenantsPOST } = await import('../src/app/api/platform/tenants/route');
const { recentAuditWrites } = await import('../src/lib/audit/log');

// The seeded fixture accounts, exactly as the sign-in screen lists them.
const DIET_ADMIN: Session = {
  memberId: 'mem-a-0',
  tenantId: 'ten-diet',
  status: 'active_alumni',
  roles: [{ role: 'alumni', departmentId: null }, { role: 'college_admin', departmentId: null }],
  departmentId: null,
  batchYear: null,
};

const VENDOR: Session = {
  memberId: 'mem-a-10',
  tenantId: 'ten-diet',
  status: 'active_alumni',
  roles: [{ role: 'platform_admin', departmentId: null }],
  departmentId: null,
  batchYear: null,
};

const HOST = 'diet.localhost:3000';

function post(path: string, body: unknown): Request {
  return new Request(`http://${HOST}${path}`, {
    method: 'POST',
    headers: { host: HOST, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const REASON = 'Requested in writing by the principal, ref DIET/ADM/2026/114.';

beforeEach(() => {
  ctx.session = DIET_ADMIN;
});

// ---------------------------------------------------------------
// 1. Nobody inside a tenant can make — or unmake — the vendor
// ---------------------------------------------------------------

describe('POST /api/admin/roles — a college admin cannot grant or revoke platform_admin', () => {
  it('refuses the grant with 422, in the same shape as a cohort refusal, and audits nothing', async () => {
    const before = recentAuditWrites().length;

    const res = await rolesPOST(
      post('/api/admin/roles', { action: 'grant', memberId: 'mem-a-6', role: 'platform_admin', department: null, reason: REASON }),
    );
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.code).toBe('vendor_role');
    expect(typeof body.error).toBe('string');
    expect(body.fieldErrors?.role).toEqual(expect.any(String));
    expect(body.ok).toBeUndefined();
    // Refusals on this route write nothing — the cohort and department
    // refusals never did. A refused request changed nothing to record.
    expect(recentAuditWrites().length).toBe(before);
  });

  it('refuses the grant when a branch is attached, before any department rule gets a say', async () => {
    const res = await rolesPOST(
      post('/api/admin/roles', { action: 'grant', memberId: 'mem-a-6', role: 'platform_admin', department: 'CSE', reason: REASON }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe('vendor_role');
  });

  it('refuses to revoke the vendor grant a member already holds', async () => {
    // mem-a-10 is the seeded ifBash operator, who holds platform_admin.
    // A college that could strip it could lock the vendor out of its own
    // console; the grant is not the tenant's to manage in either direction.
    const before = recentAuditWrites().length;

    const res = await rolesPOST(
      post('/api/admin/roles', { action: 'revoke', memberId: 'mem-a-10', role: 'platform_admin', department: null, reason: REASON }),
    );
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.code).toBe('vendor_role');
    expect(recentAuditWrites().length).toBe(before);
  });

  it('still grants a staff role, audited in the college’s scope (control)', async () => {
    const before = recentAuditWrites().length;

    const res = await rolesPOST(
      post('/api/admin/roles', { action: 'grant', memberId: 'mem-a-6', role: 'finance', department: null, reason: REASON }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, action: 'grant', role: 'finance', auditedAs: 'role.grant' });
    const writes = recentAuditWrites();
    expect(writes.length).toBe(before + 1);
    expect(writes[0]).toMatchObject({ action: 'role.grant', tenantId: 'ten-diet', resourceId: 'mem-a-6:finance' });
  });
});

// ---------------------------------------------------------------
// 2. Provisioning is audited in the college it creates
// ---------------------------------------------------------------

const PROVISION = {
  institutionName: 'Probe Institute of Technology',
  shortName: 'PIT',
  subdomain: 'probe-pit',
  packId: 'northgate',
  adminEmail: 'registrar@probe-pit.edu.in',
  plan: 'trial',
  fcra: 'unknown',
  features: {
    directory: true,
    connections: true,
    events: true,
    jobs: true,
    mentorship: true,
    donations: false,
    gallery: true,
    news: true,
    whatsapp: false,
    publicLanding: true,
  },
  requestDegreeRegister: true,
  confirm: 'probe-pit',
} as const;

describe('POST /api/platform/tenants — the audit entry never lands in the college the vendor browsed from', () => {
  beforeEach(() => {
    ctx.session = VENDOR;
  });

  it('files tenant.provision in the new college’s scope, not the browsing tenant’s', async () => {
    const before = recentAuditWrites().length;

    const res = await tenantsPOST(post('/api/platform/tenants', { ...PROVISION, dryRun: false }));
    expect(res.status).toBe(201);

    const writes = recentAuditWrites();
    expect(writes.length).toBe(before + 1);
    const entry = writes[0]!;
    expect(entry.action).toBe('tenant.provision');
    expect(entry.resourceId).toBe('ten-probe-pit');
    expect(entry.tenantId).toBe('ten-probe-pit');
    expect(entry.tenantId).not.toBe(VENDOR.tenantId);
  });

  it('puts the new admin’s email in no scope but the new college’s', async () => {
    await tenantsPOST(post('/api/platform/tenants', { ...PROVISION, subdomain: 'probe-two', confirm: 'probe-two', dryRun: false }));

    const carrying = recentAuditWrites().filter((w) => JSON.stringify(w).includes(PROVISION.adminEmail));
    expect(carrying.length).toBeGreaterThan(0);
    for (const w of carrying) {
      expect(w.tenantId, `${w.action} carries ${PROVISION.adminEmail}`).toMatch(/^ten-probe-/);
    }
    expect(recentAuditWrites().filter((w) => w.tenantId === 'ten-diet' && w.action === 'tenant.provision')).toEqual([]);
  });

  it('describes the same scope on the dry run, and writes nothing', async () => {
    const before = recentAuditWrites().length;

    const res = await tenantsPOST(post('/api/platform/tenants', { ...PROVISION, subdomain: 'probe-dry', dryRun: true }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.dryRun).toBe(true);
    expect(recentAuditWrites().length).toBe(before);

    // The console renders this list verbatim, so the preview has to name
    // the scope the write will actually use.
    const audit = body.creates.find((c: { key: string }) => c.key === 'audit');
    const scope = audit.fields.find((f: { label: string }) => f.label === 'audit_scope');
    expect(scope.value).toBe('ten-probe-dry');
    expect(scope.value).not.toBe(VENDOR.tenantId);
  });
});
