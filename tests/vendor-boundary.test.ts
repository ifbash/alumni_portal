import { describe, expect, it } from 'vitest';
import { ROLES, CAPABILITIES, capabilitiesFor, roleHas, type Capability } from '../src/lib/auth/permissions';
import { VENDOR_ROLE, coarseVerdict, policyFor } from '../src/lib/auth/route-policy';
import { VENDOR_ROLES, isVendorRole, tenantRoleChangeRefusal } from '../src/lib/auth/role-grants';

/**
 * The vendor boundary.
 *
 * This product is sold to colleges and operated by ifBash. The single
 * most important promise in that arrangement is that the vendor can run
 * the infrastructure without being able to read the data on it — and a
 * promise that is only written in a document is not a promise.
 *
 * Every assertion here failed at least once during development.
 * `platform_admin` held `tenant.configure`, which gated the DPDP data
 * request queue, which lists members by name alongside what they have
 * asked the college to erase. Nobody wrote that on purpose; two
 * reasonable decisions met in the middle and produced it. That is why
 * the boundary is pinned by a test rather than by care.
 */

// `as const`: a bare const string widens to `string` inside an array
// literal, which made `[role, VENDOR]` below a `string[]` and not a role list.
const VENDOR = 'platform_admin' as const;

/** Capabilities that read, write or export anything about a person. */
const MEMBER_DATA: Capability[] = [
  'profile.read.any',
  'profile.write.any',
  'profile.merge',
  'directory.search.alumni',
  'directory.search.students',
  'directory.view.contact',
  'directory.view.cgpa',
  'member.export',
  'data_request.manage',
  'connection.stats.tenant',
  'connection.stats.department',
  'verification.review.any',
  'verification.review.department',
  'verification.override',
  'job.applicants.export',
];

describe('platform_admin cannot reach member data', () => {
  for (const cap of MEMBER_DATA) {
    it(`does not hold ${cap}`, () => {
      expect(roleHas(VENDOR, cap)).toBe(false);
    });
  }

  it('holds only operational capabilities', () => {
    // Asserted as an exact set, not a subset. A subset check passes
    // happily while somebody quietly adds a tenth capability.
    expect([...capabilitiesFor([VENDOR])].sort()).toEqual(
      ['audit.read', 'tenant.configure', 'tenant.provision'].sort(),
    );
  });

  it('keeps audit.read, because incident response needs it', () => {
    // The audit log records who did what. It is the one thing a vendor
    // must be able to read to answer "what happened on the 14th", and it
    // holds actions rather than member records.
    expect(roleHas(VENDOR, 'audit.read')).toBe(true);
  });
});

/**
 * The capability matrix above is necessary and was not sufficient.
 *
 * `/jobs`, `/news` and `/gallery` ask for a session and a feature flag and
 * no capability — "any signed-in member" is the right bar for a member —
 * so the vendor, holding none of the capabilities listed above, was still
 * served job postings naming the alumni who posted them, an obituary, and
 * contributor names under photographs. `GET /api/jobs` served the postings
 * as JSON. Every assertion in the first block passed the whole time.
 *
 * The route gate now refuses a session whose only role is the vendor's on
 * every member-community surface. The full contract (loops, lookups, the
 * lockout direction) is in `tests/route-policy.test.ts`; this is the
 * promise itself, stated where the boundary is pinned.
 */
describe('platform_admin is kept off the member community', () => {
  const vendorOnly = { status: 'active_alumni', roles: [VENDOR] } as const;

  it('is the role the route gate treats as the vendor', () => {
    expect(VENDOR_ROLE).toBe(VENDOR);
  });

  for (const path of [
    '/dashboard',
    '/directory',
    '/connections',
    '/mentorship',
    '/events',
    '/jobs',
    '/jobs/job-0',
    '/news',
    '/news/in-memoriam-prof-narasimha-rao',
    '/gallery',
    '/gallery/cse-block-then-and-now',
    '/giving',
    '/notifications',
  ]) {
    it(`is sent to /platform from ${path}`, () => {
      expect(coarseVerdict(policyFor(path), vendorOnly)).toEqual({ admit: false, redirectTo: '/platform' });
    });
  }

  for (const path of ['/api/jobs', '/api/directory', '/api/members/x', '/api/events/x/ticket', '/api/connections', '/api/notifications', '/api/donations']) {
    it(`is refused ${path} with a JSON 403`, () => {
      const rule = policyFor(path);
      expect(rule.refuse).toBe('json');
      expect(coarseVerdict(rule, vendorOnly).admit).toBe(false);
    });
  }

  it('still reaches its own console', () => {
    expect(coarseVerdict(policyFor('/platform'), vendorOnly)).toEqual({ admit: true });
  });

  it('refuses no college role, alone or alongside the vendor role', () => {
    // The wall has to hold in the other direction too: a member of the
    // college who also works for ifBash is still a member of the college.
    for (const role of ROLES.filter((r) => r !== VENDOR)) {
      for (const roles of [[role], [role, VENDOR]]) {
        for (const path of ['/jobs', '/news', '/gallery', '/api/jobs']) {
          expect(
            coarseVerdict(policyFor(path), { status: 'active_alumni', roles }),
            `${roles.join(' + ')} on ${path}`,
          ).toEqual({ admit: true });
        }
      }
    }
  });
});

/**
 * Nobody inside a college can make somebody the vendor.
 *
 * The first block pins what `platform_admin` may do. This pins who may
 * hand it out, which the matrix cannot express: `role.manage` is a tenant
 * capability, and `POST /api/admin/roles` refused only the cohort roles —
 * so a college admin could grant `platform_admin`, and with it
 * `tenant.provision`, to any member of their own college. The handler now
 * asks `tenantRoleChangeRefusal()` first; `vendor-boundary.routes.test.ts`
 * pins that it does.
 */
describe('a tenant role manager cannot grant or revoke the vendor role', () => {
  it('treats platform_admin as the vendor role, and nothing else', () => {
    expect(VENDOR_ROLES).toEqual([VENDOR]);
  });

  it('counts every role holding tenant.provision as the vendor’s', () => {
    // Derived, so a future operator role cannot slip into the picker.
    for (const role of ROLES) {
      if (roleHas(role, 'tenant.provision')) expect(isVendorRole(role), role).toBe(true);
    }
  });

  for (const action of ['grant', 'revoke'] as const) {
    it(`refuses to ${action} platform_admin with 422 vendor_role`, () => {
      const refusal = tenantRoleChangeRefusal(action, VENDOR, 'Platform admin');
      expect(refusal).not.toBeNull();
      expect(refusal!.status).toBe(422);
      expect(refusal!.code).toBe('vendor_role');
      expect(refusal!.message).toMatch(/Platform admin cannot be (granted|revoked)/);
      expect(refusal!.fieldErrors.role).toEqual(expect.any(String));
    });

    it(`does not refuse to ${action} any college role`, () => {
      // Cohort roles are refused by the endpoint for their own reason;
      // this rule must not claim them, or the error would say the wrong
      // thing about why.
      for (const role of ROLES.filter((r) => r !== VENDOR)) {
        expect(tenantRoleChangeRefusal(action, role), `${action} ${role}`).toBeNull();
      }
    });
  }

  it('closes the escalation the rule exists for', () => {
    // The capability a college admin was able to hand out.
    const refused = ROLES.filter((r) => tenantRoleChangeRefusal('grant', r) !== null);
    expect(refused.some((r) => roleHas(r, 'tenant.provision'))).toBe(true);
    expect(ROLES.filter((r) => roleHas(r, 'tenant.provision')).every((r) => refused.includes(r))).toBe(true);
  });
});

describe('data_request.manage is separate from tenant.configure', () => {
  it('is held by college_admin', () => {
    expect(roleHas('college_admin', 'data_request.manage')).toBe(true);
  });

  it('is held by nobody else', () => {
    const holders = ROLES.filter((r) => roleHas(r, 'data_request.manage'));
    expect(holders).toEqual(['college_admin']);
  });

  it('is not implied by holding tenant.configure', () => {
    // The regression this whole file exists for: these two travelled
    // together, so gating the DPDP queue on the second let the first in.
    const configurers = ROLES.filter((r) => roleHas(r, 'tenant.configure'));
    expect(configurers).toContain(VENDOR);
    expect(configurers.filter((r) => roleHas(r, 'data_request.manage'))).toEqual(['college_admin']);
  });
});

describe('bulk export stays with one role', () => {
  it('member.export is college_admin only', () => {
    expect(ROLES.filter((r) => roleHas(r, 'member.export'))).toEqual(['college_admin']);
  });

  it('the alumni cell operator runs verification without it', () => {
    // Staff leave, and an exportable directory leaves with them. The
    // operator does the day-to-day work and still cannot take the list.
    expect(roleHas('alumni_cell_operator', 'verification.review.any')).toBe(true);
    expect(roleHas('alumni_cell_operator', 'member.export')).toBe(false);
  });
});

describe('no capability to read a private message exists', () => {
  it('is absent from the capability list entirely', () => {
    // Not "granted to nobody" — absent. A capability that exists is a
    // capability somebody can be granted in a hurry.
    const suspicious = CAPABILITIES.filter((c) => /message|inbox|dm\b|correspond/i.test(c));
    expect(suspicious).toEqual([]);
  });
});
