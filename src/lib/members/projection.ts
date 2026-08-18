import { can, type Session } from '../auth/guard';

/**
 * Field projection.
 *
 * Directory responses are built by *selecting into* a projection, never
 * by fetching a full record and deleting keys. A field that is not in
 * the tier below cannot reach the client, so adding a column to
 * `members` can never silently widen an API response.
 *
 * Contact data lives in `member_contacts` (separate table) and is only
 * joined when `releaseContact` says so.
 */

export type Tier = 'anonymous' | 'student' | 'member' | 'privileged';

export interface MemberRow {
  id: string;
  slug: string;
  fullName: string;
  photoUrl: string | null;
  bio: string | null;
  batchYear: number | null;
  departmentCode: string | null;
  currentCompany: string | null;
  designation: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  skills: string[];
  openToMentoring: boolean;
  openToReferrals: boolean;
  openToSpeaking: boolean;
  // never projected below 'privileged'
  cgpa: number | null;
  placementStatus: string | null;
  rollNumber: string | null;
  status: string;
}

export interface ContactRow {
  email: string | null;
  mobile: string | null;
  linkedin: string | null;
  github: string | null;
  portfolio: string | null;
  visibility: 'private' | 'on_accept' | 'alumni_only' | 'all_members';
}

const BASE = [
  'id', 'slug', 'fullName', 'photoUrl', 'batchYear', 'departmentCode',
  'currentCompany', 'designation', 'skills',
] as const;

const MEMBER_EXTRA = [
  'bio', 'industry', 'city', 'state', 'country',
  'openToMentoring', 'openToReferrals', 'openToSpeaking',
] as const;

const PRIVILEGED_EXTRA = ['rollNumber', 'status', 'cgpa', 'placementStatus'] as const;

const FIELDS: Record<Tier, readonly (keyof MemberRow)[]> = {
  // Reserved for genuinely public surfaces (a featured-alumni carousel
  // on the marketing page). The directory itself is never anonymous —
  // see requireDirectoryAccess below.
  anonymous: BASE,
  student: [...BASE, 'bio', 'openToMentoring', 'openToReferrals', 'openToSpeaking'],
  member: [...BASE, ...MEMBER_EXTRA],
  privileged: [...BASE, ...MEMBER_EXTRA, ...PRIVILEGED_EXTRA],
};

export function tierFor(session: Session | null): Tier {
  if (!session) return 'anonymous';
  // Two separate capabilities reach the privileged field list, and both
  // must, for different reasons: an admin holds `directory.view.contact`,
  // and the placement officer holds `directory.view.cgpa` — which was
  // unreachable while this only checked the first, so the one role that
  // exists to read CGPA could not.
  //
  // Widening the tier does not widen contact access. Contact release is a
  // separate decision made by `releaseContact()` against
  // `directory.view.contact`, which the placement officer does not hold.
  if (can(session, 'directory.view.contact') || can(session, 'directory.view.cgpa')) return 'privileged';
  const roles = session.roles.map((r) => r.role);
  if (roles.includes('alumni') || roles.includes('faculty')) return 'member';
  return 'student';
}

export function project(row: MemberRow, tier: Tier): Partial<MemberRow> {
  const out: Record<string, unknown> = {};
  for (const f of FIELDS[tier]) out[f] = row[f];
  return out as Partial<MemberRow>;
}

/**
 * Contact release.
 *
 * Two gates, both must pass: the *viewer* must be entitled, and the
 * *owner* must have consented via their visibility setting. Role alone
 * is never sufficient — that is the purpose-limitation requirement
 * under the DPDP Act, and the thing most implementations get wrong.
 */
export function releaseContact(
  viewer: Session | null,
  owner: { memberId: string; contact: ContactRow },
  opts: { hasAcceptedConnection: boolean },
): Partial<ContactRow> | null {
  if (!viewer) return null;

  // Own record, and admins with an explicit capability, see everything.
  if (viewer.memberId === owner.memberId) return owner.contact;
  if (can(viewer, 'directory.view.contact')) return owner.contact;

  const roles = viewer.roles.map((r) => r.role);
  const viewerIsMember = roles.includes('alumni') || roles.includes('faculty');

  switch (owner.contact.visibility) {
    case 'private':
      return null;
    case 'on_accept':
      return opts.hasAcceptedConnection ? owner.contact : null;
    case 'alumni_only':
      return viewerIsMember ? owner.contact : null;
    case 'all_members':
      // "All members" means all *alumni and faculty*, never students.
      // A student reaching this branch used to receive an email address,
      // which contradicts the rule the whole directory is built around:
      // if 400 final-years can mail 8,000 alumni directly, the alumni
      // disengage within a month and the network is dead. A student still
      // has a route to this person — a connection request the owner can
      // accept — and that route is the product.
      if (!viewerIsMember) return null;

      // Mobile is excluded even for entitled viewers. A phone number is
      // never bulk-visible; it is released only on an accepted connection
      // or to an admin holding directory.view.contact.
      return {
        email: owner.contact.email,
        linkedin: owner.contact.linkedin,
        github: owner.contact.github,
        portfolio: owner.contact.portfolio,
        mobile: null,
        visibility: owner.contact.visibility,
      };
  }
}

/**
 * The directory is never anonymous. This is the guard whose absence
 * put a competitor's full alumni list on the open internet.
 */
export function requireDirectoryAccess(session: Session | null): void {
  if (!session) {
    const e = new Error('Sign in required') as Error & { status?: number };
    e.status = 401;
    throw e;
  }
}

/** Students may not enumerate students. */
export function visibleStatusesFor(session: Session): string[] {
  if (can(session, 'directory.search.students')) {
    return ['active_alumni', 'active_student'];
  }
  return ['active_alumni'];
}
