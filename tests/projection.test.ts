import { describe, expect, it } from 'vitest';
import type { Session } from '@/lib/auth/guard';
import {
  project,
  releaseContact,
  requireDirectoryAccess,
  tierFor,
  visibleStatusesFor,
  type ContactRow,
  type MemberRow,
  type Tier,
} from '@/lib/members/projection';

/**
 * Field projection and contact release.
 *
 * This is the layer that decides what leaves the server. Everything else
 * in the product can be rebuilt; a directory that handed 400 final-years
 * 8,000 alumni phone numbers cannot be un-sent.
 */

function session(over: Partial<Session> = {}): Session {
  return {
    memberId: 'viewer',
    tenantId: 'ten-diet',
    status: 'active_alumni',
    roles: [],
    departmentId: null,
    batchYear: 2017,
    ...over,
  };
}

const STUDENT = session({
  memberId: 'viewer-student',
  status: 'active_student',
  roles: [{ role: 'student', departmentId: null }],
});
const ALUMNUS = session({
  memberId: 'viewer-alumnus',
  roles: [{ role: 'alumni', departmentId: null }],
});
const FACULTY = session({
  memberId: 'viewer-faculty',
  roles: [{ role: 'faculty', departmentId: 'ECE' }],
});
const ADMIN = session({
  memberId: 'viewer-admin',
  roles: [{ role: 'college_admin', departmentId: null }],
});
const PLACEMENT = session({
  memberId: 'viewer-tpo',
  roles: [{ role: 'placement_officer', departmentId: null }],
});

const ROW: MemberRow = {
  id: 'mem-a-42',
  slug: 'vamsi-krishna-pothineni-42',
  fullName: 'Vamsi Krishna Pothineni',
  photoUrl: null,
  bio: 'Senior Software Engineer at Amazon.',
  batchYear: 2017,
  departmentCode: 'CSE',
  currentCompany: 'Amazon',
  designation: 'Senior Software Engineer',
  industry: 'Product Engineering',
  city: 'Hyderabad',
  state: 'Telangana',
  country: 'IN',
  skills: ['Java', 'AWS'],
  openToMentoring: true,
  openToReferrals: true,
  openToSpeaking: false,
  cgpa: 8.42,
  placementStatus: 'Placed — Amazon',
  rollNumber: '13JN1A0533',
  status: 'active_alumni',
};

const BASE = [
  'id', 'slug', 'fullName', 'photoUrl', 'batchYear', 'departmentCode',
  'currentCompany', 'designation', 'skills',
];

const EXPECTED_KEYS: Record<Tier, string[]> = {
  anonymous: BASE,
  student: [...BASE, 'bio', 'openToMentoring', 'openToReferrals', 'openToSpeaking'],
  member: [
    ...BASE, 'bio', 'industry', 'city', 'state', 'country',
    'openToMentoring', 'openToReferrals', 'openToSpeaking',
  ],
  privileged: [
    ...BASE, 'bio', 'industry', 'city', 'state', 'country',
    'openToMentoring', 'openToReferrals', 'openToSpeaking',
    'rollNumber', 'status', 'cgpa', 'placementStatus',
  ],
};

const TIERS = Object.keys(EXPECTED_KEYS) as Tier[];

describe('project', () => {
  it.each(TIERS)('returns exactly the %s field set', (tier) => {
    const out = project(ROW, tier);
    expect(Object.keys(out).sort()).toEqual([...EXPECTED_KEYS[tier]].sort());
  });

  it.each(['anonymous', 'student', 'member'] as Tier[])(
    'omits the placement-side fields entirely at %s',
    (tier) => {
      const out = project(ROW, tier) as Record<string, unknown>;
      // Key presence, not value. `{ cgpa: undefined }` serialises away in
      // JSON but survives a spread into a wider object, which is exactly
      // how a field nobody meant to expose reappears three files later.
      expect('cgpa' in out).toBe(false);
      expect('placementStatus' in out).toBe(false);
      expect('rollNumber' in out).toBe(false);
    },
  );

  it('carries the placement-side fields at privileged', () => {
    const out = project(ROW, 'privileged');
    expect(out.cgpa).toBe(8.42);
    expect(out.placementStatus).toBe('Placed — Amazon');
    expect(out.rollNumber).toBe('13JN1A0533');
  });

  it('does not widen when the input row grows a field', () => {
    // Adding a column to `members` must never widen an API response.
    // This is the whole reason projection selects *into* a field list.
    const wider = { ...ROW, secretField: 'internal note about this member' } as MemberRow;
    for (const tier of TIERS) {
      const out = project(wider, tier) as Record<string, unknown>;
      expect('secretField' in out, `secretField leaked at ${tier}`).toBe(false);
      expect(Object.keys(out).sort()).toEqual([...EXPECTED_KEYS[tier]].sort());
    }
  });
});

describe('tierFor', () => {
  it('gives no session the anonymous tier', () => {
    expect(tierFor(null)).toBe('anonymous');
  });

  it('gives a student the narrowest signed-in tier', () => {
    expect(tierFor(STUDENT)).toBe('student');
  });

  it('gives alumni and faculty the member tier', () => {
    expect(tierFor(ALUMNUS)).toBe('member');
    expect(tierFor(FACULTY)).toBe('member');
  });

  it('reaches privileged through either the contact or the cgpa capability', () => {
    // Two capabilities open the privileged field list, for two different
    // reasons, and both must. The admin route is `directory.view.contact`.
    expect(tierFor(ADMIN)).toBe('privileged');
    // The placement officer route is `directory.view.cgpa`. While only the
    // first capability was checked, `directory.view.cgpa` was unreachable:
    // the one role that exists to read CGPA landed on tier `student` and
    // never saw `cgpa` / `placementStatus` / `rollNumber` at all.
    expect(tierFor(PLACEMENT)).toBe('privileged');
    // Neither capability is granted by seniority. Holding no capability
    // still means the tier is decided by cohort alone.
    expect(tierFor(ALUMNUS)).toBe('member');
    expect(tierFor(STUDENT)).toBe('student');
  });
});

// ---------------------------------------------------------------
// Contact release
// ---------------------------------------------------------------

const CONTACT = (visibility: ContactRow['visibility']): ContactRow => ({
  email: 'vamsi.pothineni@example.com',
  mobile: '+91 9848012345',
  linkedin: 'https://linkedin.com/in/vamsi',
  github: 'https://github.com/vamsi',
  portfolio: null,
  visibility,
});

const OWNER_ID = 'mem-a-42';
const OWNER_SESSION = session({ memberId: OWNER_ID, roles: [{ role: 'alumni', departmentId: null }] });

type Expected = 'full' | 'none' | 'no_mobile';

interface ViewerCase {
  label: string;
  viewer: Session | null;
  connected: boolean;
}

const VIEWERS: ViewerCase[] = [
  { label: 'owner', viewer: OWNER_SESSION, connected: false },
  { label: 'student, no connection', viewer: STUDENT, connected: false },
  { label: 'student, accepted connection', viewer: STUDENT, connected: true },
  { label: 'alumnus, no connection', viewer: ALUMNUS, connected: false },
  { label: 'alumnus, accepted connection', viewer: ALUMNUS, connected: true },
  { label: 'admin', viewer: ADMIN, connected: false },
];

/**
 * The full matrix. `no_mobile` is `all_members` seen by an entitled
 * viewer: everything except the phone number, which is never
 * bulk-visible whatever the owner ticked.
 *
 * "All members" means all *alumni and faculty*. A student is not one of
 * them under any visibility, so every student row here is `none` except
 * the accepted connection on `on_accept`.
 */
const MATRIX: Record<ContactRow['visibility'], Record<string, Expected>> = {
  private: {
    owner: 'full',
    'student, no connection': 'none',
    'student, accepted connection': 'none',
    'alumnus, no connection': 'none',
    'alumnus, accepted connection': 'none',
    admin: 'full',
  },
  on_accept: {
    owner: 'full',
    'student, no connection': 'none',
    'student, accepted connection': 'full',
    'alumnus, no connection': 'none',
    'alumnus, accepted connection': 'full',
    admin: 'full',
  },
  alumni_only: {
    owner: 'full',
    'student, no connection': 'none',
    'student, accepted connection': 'none',
    'alumnus, no connection': 'full',
    'alumnus, accepted connection': 'full',
    admin: 'full',
  },
  all_members: {
    owner: 'full',
    'student, no connection': 'none',
    'student, accepted connection': 'none',
    'alumnus, no connection': 'no_mobile',
    'alumnus, accepted connection': 'no_mobile',
    admin: 'full',
  },
};

function assertRelease(actual: Partial<ContactRow> | null, expected: Expected, contact: ContactRow) {
  if (expected === 'none') {
    expect(actual).toBeNull();
    return;
  }
  expect(actual).not.toBeNull();
  expect(actual!.email).toBe(contact.email);
  expect(actual!.mobile).toBe(expected === 'full' ? contact.mobile : null);
}

describe('releaseContact', () => {
  for (const visibility of ['private', 'on_accept', 'alumni_only', 'all_members'] as const) {
    for (const v of VIEWERS) {
      const expected = MATRIX[visibility][v.label]!;
      it(`${visibility} → ${v.label} → ${expected}`, () => {
        const contact = CONTACT(visibility);
        const out = releaseContact(
          v.viewer,
          { memberId: OWNER_ID, contact },
          { hasAcceptedConnection: v.connected },
        );
        assertRelease(out, expected, contact);
      });
    }
  }

  it('refuses an anonymous viewer under every visibility', () => {
    for (const visibility of ['private', 'on_accept', 'alumni_only', 'all_members'] as const) {
      expect(
        releaseContact(null, { memberId: OWNER_ID, contact: CONTACT(visibility) }, { hasAcceptedConnection: true }),
      ).toBeNull();
    }
  });

  it('withholds mobile under all_members for everyone but the owner and the contact capability', () => {
    // A phone number is the one field that is never bulk-visible. An
    // 8,000-row directory with mobiles in it is a marketing list.
    for (const v of VIEWERS) {
      const contact = CONTACT('all_members');
      const out = releaseContact(
        v.viewer,
        { memberId: OWNER_ID, contact },
        { hasAcceptedConnection: v.connected },
      );
      const entitledToMobile = v.label === 'owner' || v.label === 'admin';
      // A student is released nothing at all under all_members, so there
      // is no mobile to withhold — the stronger outcome, asserted as such
      // rather than folded into the same expectation.
      if (v.viewer === STUDENT) {
        expect(out, `${v.label} under all_members`).toBeNull();
        continue;
      }
      expect(out!.mobile, `${v.label} under all_members`).toBe(entitledToMobile ? contact.mobile : null);
    }
  });

  it('gives a student an alumnus contact only through an accepted connection on on_accept', () => {
    // The rule from CLAUDE.md: "Students never see alumni contact
    // details." It now holds for all four visibilities. An accepted
    // connection on `on_accept` is the single route, and it is the owner
    // who opens it.
    for (const visibility of ['private', 'alumni_only', 'all_members'] as const) {
      for (const connected of [false, true]) {
        expect(
          releaseContact(
            STUDENT,
            { memberId: OWNER_ID, contact: CONTACT(visibility) },
            { hasAcceptedConnection: connected },
          ),
          `student under ${visibility}, connected=${connected}`,
        ).toBeNull();
      }
    }
    expect(
      releaseContact(STUDENT, { memberId: OWNER_ID, contact: CONTACT('on_accept') }, { hasAcceptedConnection: false }),
    ).toBeNull();
    expect(
      releaseContact(STUDENT, { memberId: OWNER_ID, contact: CONTACT('on_accept') }, { hasAcceptedConnection: true }),
    ).not.toBeNull();
  });

  /**
   * The student→alumni valve, and the reason `all_members` is named for
   * *members* rather than for everyone signed in.
   *
   * "All members" means all alumni and faculty. If a student could reach
   * this branch, 400 final-years would hold the email addresses of 8,000
   * alumni, and a directory that can be mailed in bulk is one the alumni
   * leave — they disengage within a month and the network is dead. The
   * student's route to this person is a connection request the owner can
   * accept; that route is the product, and it keeps the decision with the
   * person whose contact details are at stake.
   *
   * Not one field escapes here, not just the mobile: email, LinkedIn,
   * GitHub and portfolio are all withheld.
   */
  it('all_members still withholds everything from a student', () => {
    const contact = CONTACT('all_members');
    for (const connected of [false, true]) {
      const out = releaseContact(
        STUDENT,
        { memberId: OWNER_ID, contact },
        { hasAcceptedConnection: connected },
      );
      expect(out, `student under all_members, connected=${connected}`).toBeNull();
    }
  });

  it('withholds another member contact from the placement officer despite its privileged tier', () => {
    // This is the property that makes the tier widening safe, so it is
    // pinned here rather than left to inference. `directory.view.cgpa`
    // carries the placement officer to tier `privileged` for the *field
    // list*, but contact release is a separate decision made against
    // `directory.view.contact`, which this role does not hold. Reading a
    // CGPA must never become a way to read an email address.
    expect(tierFor(PLACEMENT)).toBe('privileged');
    for (const visibility of ['private', 'on_accept', 'alumni_only', 'all_members'] as const) {
      expect(
        releaseContact(
          PLACEMENT,
          { memberId: OWNER_ID, contact: CONTACT(visibility) },
          { hasAcceptedConnection: false },
        ),
        `placement officer under ${visibility}`,
      ).toBeNull();
    }
    // `alumni_only` and `all_members` stay shut even so: this role is
    // neither alumni nor faculty, and no connection is on offer.
    for (const visibility of ['private', 'alumni_only', 'all_members'] as const) {
      expect(
        releaseContact(
          PLACEMENT,
          { memberId: OWNER_ID, contact: CONTACT(visibility) },
          { hasAcceptedConnection: true },
        ),
        `placement officer under ${visibility}, connected`,
      ).toBeNull();
    }
    // The one opening is `on_accept` with a connection the owner accepted
    // — the owner's own consent, not anything the capability granted.
    expect(
      releaseContact(
        PLACEMENT,
        { memberId: OWNER_ID, contact: CONTACT('on_accept') },
        { hasAcceptedConnection: true },
      ),
    ).not.toBeNull();
  });

  it('never returns a mobile it was not given', () => {
    const contact = { ...CONTACT('all_members'), mobile: null };
    const out = releaseContact(ALUMNUS, { memberId: OWNER_ID, contact }, { hasAcceptedConnection: false });
    expect(out!.mobile).toBeNull();
  });

  it('reports the owner visibility alongside the released fields', () => {
    // The UI has to be able to say *why* a field is missing.
    const out = releaseContact(
      ALUMNUS,
      { memberId: OWNER_ID, contact: CONTACT('all_members') },
      { hasAcceptedConnection: false },
    );
    expect(out!.visibility).toBe('all_members');
  });
});

describe('requireDirectoryAccess', () => {
  it('throws 401 for a null session', () => {
    // The guard whose absence put a competitor's full alumni list on the
    // open internet.
    let status: number | undefined;
    try {
      requireDirectoryAccess(null);
      throw new Error('expected requireDirectoryAccess to throw');
    } catch (e) {
      status = (e as Error & { status?: number }).status;
      expect((e as Error).message).toBe('Sign in required');
    }
    expect(status).toBe(401);
  });

  it('passes any signed-in session', () => {
    expect(() => requireDirectoryAccess(STUDENT)).not.toThrow();
    expect(() => requireDirectoryAccess(ALUMNUS)).not.toThrow();
  });
});

describe('visibleStatusesFor', () => {
  it('lets a student see alumni only', () => {
    // Students may not enumerate students. 400 final-years with a
    // searchable roster of each other is a different product.
    expect(visibleStatusesFor(STUDENT)).toEqual(['active_alumni']);
  });

  it('lets the roles that hold directory.search.students see both cohorts', () => {
    for (const viewer of [FACULTY, PLACEMENT, ADMIN]) {
      expect(visibleStatusesFor(viewer).sort()).toEqual(['active_alumni', 'active_student']);
    }
  });

  it('never exposes a status that is not one of the two active ones', () => {
    for (const viewer of [STUDENT, ALUMNUS, FACULTY, PLACEMENT, ADMIN]) {
      for (const status of visibleStatusesFor(viewer)) {
        expect(['active_alumni', 'active_student']).toContain(status);
      }
    }
  });
});
