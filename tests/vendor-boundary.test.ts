import { describe, expect, it } from 'vitest';
import { ROLES, CAPABILITIES, capabilitiesFor, roleHas, type Capability } from '../src/lib/auth/permissions';

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

const VENDOR = 'platform_admin';

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
