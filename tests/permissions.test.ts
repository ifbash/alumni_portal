import { describe, expect, it } from 'vitest';
import {
  CAPABILITIES,
  DEPARTMENT_SCOPED,
  ROLES,
  capabilitiesFor,
  roleHas,
  type Capability,
  type Role,
} from '@/lib/auth/permissions';

/**
 * The capability matrix.
 *
 * The omissions in `permissions.ts` are the product, not an oversight, and
 * every one of them is a single-line edit away from disappearing. These
 * tests name them so that the edit fails loudly instead of shipping.
 */

const rolesHolding = (cap: Capability): Role[] => ROLES.filter((r) => roleHas(r, cap));

describe('deliberate omissions', () => {
  it('grants member.export to college_admin and to nothing else', () => {
    // Staff leave, and an exportable directory leaves with them. Not the
    // operator, not the placement officer, not the HOD.
    for (const role of ROLES) {
      expect(
        roleHas(role, 'member.export'),
        `${role} must not hold member.export`,
      ).toBe(role === 'college_admin');
    }
    expect(rolesHolding('member.export')).toEqual(['college_admin']);
  });

  it('keeps directory.view.cgpa on the placement side only', () => {
    // Alumni post jobs here. A searchable CGPA list is a recruiting
    // shortcut nobody agreed to.
    expect(rolesHolding('directory.view.cgpa').sort()).toEqual(
      ['college_admin', 'placement_officer'].sort(),
    );
    expect(roleHas('alumni', 'directory.view.cgpa')).toBe(false);
    expect(roleHas('faculty', 'directory.view.cgpa')).toBe(false);
    expect(roleHas('hod', 'directory.view.cgpa')).toBe(false);
  });

  it('gives students neither donation.give nor directory.search.students', () => {
    expect(roleHas('student', 'donation.give')).toBe(false);
    expect(roleHas('student', 'directory.search.students')).toBe(false);
  });

  it('has no capability for reading private message bodies at all', () => {
    // Asserted over CAPABILITIES rather than over the grants: a capability
    // nobody currently holds is one `GRANTS` edit from being held. The
    // defence is that the capability does not exist to grant.
    const forbidden = /message.*read|read.*message/i;
    const offenders = CAPABILITIES.filter((c) => forbidden.test(c));
    expect(offenders, 'no message-reading capability may exist').toEqual([]);
  });

  it('keeps platform_admin out of member data entirely', () => {
    // ifBash operates the platform. Operating it must not mean being able
    // to read a college's alumni.
    expect(roleHas('platform_admin', 'profile.read.any')).toBe(false);
    expect(roleHas('platform_admin', 'member.export')).toBe(false);

    const directoryCaps = CAPABILITIES.filter((c) => c.startsWith('directory.'));
    expect(directoryCaps.length).toBeGreaterThan(0);
    for (const cap of directoryCaps) {
      expect(roleHas('platform_admin', cap), `platform_admin must not hold ${cap}`).toBe(false);
    }
  });
});

describe('capabilitiesFor', () => {
  it('unions the grants of every role a member holds', () => {
    // The real case from the seed: an HOD who is also faculty in the same
    // department. Neither role alone is what the routes see.
    const union = capabilitiesFor(['faculty', 'hod']);

    // faculty-only
    expect(union.has('job.post')).toBe(true);
    expect(union.has('donation.give')).toBe(true);
    // hod-only
    expect(union.has('verification.review.department')).toBe(true);
    expect(union.has('comms.send.department')).toBe(true);
    // held by both, present once
    expect(union.has('directory.search.students')).toBe(true);

    const expected = new Set([...capabilitiesFor(['faculty']), ...capabilitiesFor(['hod'])]);
    expect([...union].sort()).toEqual([...expected].sort());
  });

  it('does not widen when a role is repeated', () => {
    expect([...capabilitiesFor(['alumni', 'alumni'])].sort()).toEqual(
      [...capabilitiesFor(['alumni'])].sort(),
    );
  });

  it('returns nothing for no roles', () => {
    expect(capabilitiesFor([]).size).toBe(0);
  });

  it('does not let a second role smuggle in an omitted capability', () => {
    // A person can be alumni + faculty + hod + placement_officer at once.
    // The union of everything below college_admin still must not export.
    const everythingBelowAdmin = ROLES.filter(
      (r) => r !== 'college_admin' && r !== 'platform_admin',
    );
    expect(capabilitiesFor(everythingBelowAdmin).has('member.export')).toBe(false);
  });
});

describe('matrix integrity', () => {
  it('grants only capabilities that exist', () => {
    const known = new Set<string>(CAPABILITIES);
    for (const role of ROLES) {
      for (const cap of capabilitiesFor([role])) {
        expect(known.has(cap), `${role} is granted unknown capability ${cap}`).toBe(true);
      }
    }
  });

  it('scopes only capabilities that exist', () => {
    const known = new Set<string>(CAPABILITIES);
    for (const cap of DEPARTMENT_SCOPED) {
      expect(known.has(cap), `${cap} is department-scoped but not a capability`).toBe(true);
    }
  });

  it('leaves no capability granted to nobody', () => {
    // An ungranted capability is either dead code or a routing guard that
    // silently refuses everyone. Both are worth knowing about.
    const orphans = CAPABILITIES.filter((c) => rolesHolding(c).length === 0);
    expect(orphans).toEqual([]);
  });
});
