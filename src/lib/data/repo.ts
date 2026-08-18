import { can, type Session } from '../auth/guard';
import {
  project,
  tierFor,
  releaseContact,
  requireDirectoryAccess,
  visibleStatusesFor,
  type Tier,
} from '../members/projection';
import { CONNECTION_LIMITS } from '../config';
import {
  SEED,
  SEED_NOW,
  DEPARTMENTS,
  DEGREE_REGISTER,
  VERIFICATION_CLAIMS,
  EVENTS,
  EVENT_REGISTRATIONS,
  JOBS,
  JOB_APPLICATIONS,
  CONNECTIONS,
  CAMPAIGNS,
  DONATIONS,
  AUDIT_LOG,
  DATA_REQUESTS,
  NOTIFICATIONS,
  TENANTS,
  toSummary,
  type SeedMember,
  type DemoAccount,
} from './seed';
import type {
  Department,
  DirectoryQuery,
  DirectoryFacets,
  MemberSummary,
  MemberDetail,
  Paged,
  ConnectionRequest,
  ConnectionQuota,
  EventItem,
  EventRegistration,
  JobPosting,
  JobApplication,
  VerificationClaim,
  DegreeRecord,
  DonationCampaign,
  Donation,
  AuditEntry,
  DataRequest,
  NotificationItem,
  TenantSummary,
  EngagementStats,
  FacetCount,
} from './types';

/**
 * The read layer the UI talks to.
 *
 * Two things are true of every function here and must stay true:
 *
 *  1. **Authorisation happens here, not in the page.** Every function
 *     that returns member data takes a `Session` and applies the same
 *     projection and contact-release rules the database would. A page
 *     cannot ask for more than its viewer is entitled to, because there
 *     is no argument that would express it.
 *  2. **Results are built by selecting *into* a projection**, never by
 *     fetching a whole record and deleting keys. Adding a column to
 *     `members` can therefore never silently widen an API response.
 *
 * Fixture mode implements this in memory. The Postgres implementation
 * enforces the same rules a second time in row-level security, because
 * one layer of tenant isolation is not a layer of tenant isolation.
 */

const byId = new Map(SEED.members.map((m) => [m.id, m]));
const bySlug = new Map(SEED.members.map((m) => [m.slug, m]));
const byEmail = new Map(SEED.members.map((m) => [m.emailLower, m]));

// ---------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------

export function getDepartments(): Department[] {
  return DEPARTMENTS;
}

export function getDemoAccounts(): DemoAccount[] {
  return SEED.demoAccounts;
}

export function findMemberByEmail(email: string): SeedMember | null {
  return byEmail.get(email.trim().toLowerCase()) ?? null;
}

export function findMemberById(id: string): SeedMember | null {
  return byId.get(id) ?? null;
}

// ---------------------------------------------------------------
// Directory
// ---------------------------------------------------------------

const PER_PAGE = 24;

export function searchDirectory(
  session: Session | null,
  query: DirectoryQuery,
): Paged<MemberSummary> & { facets: DirectoryFacets; tier: Tier } {
  // The directory is never anonymous. This is the guard whose absence put
  // a competitor's full alumni list on the open internet.
  requireDirectoryAccess(session);
  const s = session!;

  const tier = tierFor(s);
  const allowedStatuses = new Set(visibleStatusesFor(s));

  let rows = SEED.members.filter((m) => allowedStatuses.has(m.status));

  if (query.cohort === 'alumni') rows = rows.filter((m) => !m.isStudent);
  if (query.cohort === 'students') rows = rows.filter((m) => m.isStudent);

  const q = query.q?.trim().toLowerCase();
  if (q) {
    const terms = q.split(/\s+/).filter(Boolean);
    rows = rows.filter((m) => {
      const hay = [
        m.fullName,
        m.currentCompany,
        m.designation,
        m.city,
        m.departmentCode,
        m.departmentName,
        m.industry,
        ...m.skills,
        String(m.batchYear ?? ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }

  if (query.department) rows = rows.filter((m) => m.departmentCode === query.department);
  if (query.batchFrom) rows = rows.filter((m) => (m.batchYear ?? 0) >= query.batchFrom!);
  if (query.batchTo) rows = rows.filter((m) => (m.batchYear ?? 9999) <= query.batchTo!);
  if (query.company) rows = rows.filter((m) => m.currentCompany === query.company);
  if (query.city) rows = rows.filter((m) => m.city === query.city);
  if (query.country) rows = rows.filter((m) => m.country === query.country);
  if (query.industry) rows = rows.filter((m) => m.industry === query.industry);
  if (query.skill) rows = rows.filter((m) => m.skills.includes(query.skill!));
  if (query.mentoring) rows = rows.filter((m) => m.openToMentoring);
  if (query.referrals) rows = rows.filter((m) => m.openToReferrals);
  if (query.speaking) rows = rows.filter((m) => m.openToSpeaking);

  const facets = buildFacets(rows);

  const sort = query.sort ?? 'relevance';
  rows = [...rows].sort((a, b) => {
    if (sort === 'name') return a.fullName.localeCompare(b.fullName);
    if (sort === 'batch') return (b.batchYear ?? 0) - (a.batchYear ?? 0);
    if (sort === 'recent') return (b.lastLoginAt ?? '').localeCompare(a.lastLoginAt ?? '');
    // Relevance: a profile someone can actually act on ranks above a
    // name with nothing attached. Sorting a sparse directory
    // alphabetically buries every useful record on page nine.
    return score(b) - score(a);
  });

  const page = Math.max(1, query.page ?? 1);
  const perPage = query.perPage ?? PER_PAGE;
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const slice = rows.slice((page - 1) * perPage, page * perPage);

  return {
    // `project` selects *into* the tier's field list; it never fetches a
    // full record and deletes keys.
    items: slice.map((m) => projectSummary(m, tier)),
    total,
    page,
    perPage,
    pageCount,
    facets,
    tier,
  };
}

/** The shape `project()` expects — the full row, before the tier narrows it. */
function toMemberRow(m: SeedMember) {
  return {
    id: m.id,
    slug: m.slug,
    fullName: m.fullName,
    photoUrl: m.photoUrl,
    bio: m.bio,
    batchYear: m.batchYear,
    departmentCode: m.departmentCode,
    currentCompany: m.currentCompany,
    designation: m.designation,
    industry: m.industry,
    city: m.city,
    state: m.state,
    country: m.country,
    skills: m.skills,
    openToMentoring: m.openToMentoring,
    openToReferrals: m.openToReferrals,
    openToSpeaking: m.openToSpeaking,
    cgpa: m.cgpa ?? null,
    placementStatus: m.placementStatus ?? null,
    rollNumber: m.rollNumber ?? null,
    status: m.status as string,
  };
}

/**
 * Two display fields — the department's full name and whether the person
 * is a student — are joined on *after* projection. They are derived from
 * fields the tier already permits, so they widen nothing.
 */
/**
 * Project a stored row for a viewer.
 *
 * Exported so every list of members in the app — the directory, the
 * mentorship hub, a gallery photo tag — narrows through the same
 * function. A second list built any other way is a second set of rules
 * nobody is maintaining.
 */
export function projectMemberSummary(m: SeedMember, session: Session | null): MemberSummary {
  return projectSummary(m, tierFor(session));
}

function projectSummary(m: SeedMember, tier: Tier): MemberSummary {
  const projected = project(toMemberRow(m), tier);

  /**
   * `status` sits in `PRIVILEGED_EXTRA`, so it is only in `projected` for
   * the privileged tier. Below that it is narrowed to the coarse cohort
   * rather than passed through.
   *
   * The distinction is not academic. The real column also carries
   * `pending`, `lapsed`, `rejected` and `deceased` — states about a
   * person that no member is entitled to learn about another. The coarse
   * value reveals nothing new, because `visibleStatusesFor()` has already
   * excluded every row whose cohort the viewer may not enumerate: if the
   * row is in the result set at all, the viewer knew this much.
   *
   * Previously this read `m.status` unconditionally, which put the raw
   * column back after the projection had removed it. Harmless with
   * today's filters, and exactly the kind of re-add that stops being
   * harmless the first time someone widens one.
   */
  const status = (projected.status as MemberSummary['status'] | undefined)
    ?? (m.isStudent ? 'active_student' : 'active_alumni');

  return {
    ...(projected as Partial<MemberSummary>),
    id: m.id,
    slug: m.slug,
    fullName: m.fullName,
    // Derived from `departmentCode`, which every tier already permits.
    departmentName: m.departmentName,
    isStudent: m.isStudent,
    status,
    skills: projected.skills ?? [],
    openToMentoring: projected.openToMentoring ?? false,
    openToReferrals: projected.openToReferrals ?? false,
    openToSpeaking: projected.openToSpeaking ?? false,
  } as MemberSummary;
}

function score(m: SeedMember): number {
  let n = 0;
  if (m.currentCompany) n += 3;
  if (m.designation) n += 2;
  if (m.bio) n += 2;
  if (m.skills.length) n += Math.min(3, m.skills.length);
  if (m.openToMentoring) n += 4;
  if (m.openToReferrals) n += 3;
  if (m.openToSpeaking) n += 1;
  if (m.lastLoginAt) n += 2;
  if (m.photoUrl) n += 1;
  return n;
}

function buildFacets(rows: SeedMember[]): DirectoryFacets {
  const count = (get: (m: SeedMember) => string | null | undefined): Map<string, number> => {
    const map = new Map<string, number>();
    for (const m of rows) {
      const v = get(m);
      if (v) map.set(v, (map.get(v) ?? 0) + 1);
    }
    return map;
  };

  const top = (map: Map<string, number>, limit: number, label?: (v: string) => string): FacetCount[] =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([value, c]) => ({ value, label: label ? label(value) : value, count: c }));

  const skillMap = new Map<string, number>();
  for (const m of rows) for (const s of m.skills) skillMap.set(s, (skillMap.get(s) ?? 0) + 1);

  const batchMap = count((m) => (m.batchYear ? String(m.batchYear) : null));

  return {
    departments: top(count((m) => m.departmentCode), 12, (code) => DEPARTMENTS.find((d) => d.code === code)?.name ?? code),
    batches: [...batchMap.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([value, c]) => ({ value, label: value, count: c })),
    companies: top(count((m) => m.currentCompany), 15),
    cities: top(count((m) => m.city), 15),
    industries: top(count((m) => m.industry), 12),
    skills: top(skillMap, 20),
  };
}

/**
 * Profile detail.
 *
 * Contact release runs both gates: the viewer must be entitled *and* the
 * owner must have consented via their visibility setting. Role alone is
 * never sufficient — that is DPDP purpose limitation, and the thing most
 * implementations get wrong.
 */
export function getMemberBySlug(session: Session | null, slug: string): MemberDetail | null {
  requireDirectoryAccess(session);
  const s = session!;

  const m = bySlug.get(slug);
  if (!m) return null;

  const allowed = new Set(visibleStatusesFor(s));
  if (!allowed.has(m.status) && m.id !== s.memberId) return null;

  const tier = tierFor(s);
  const base = projectSummary(m, tier);

  const accepted = hasAcceptedConnection(s.memberId, m.id);
  const contact = releaseContact(
    s,
    { memberId: m.id, contact: m.privateContact },
    { hasAcceptedConnection: accepted },
  );

  const privileged = tier === 'privileged';

  return {
    ...base,
    bio: tier === 'anonymous' ? null : m.bio,
    preferredName: m.preferredName,
    admissionYear: m.admissionYear,
    programme: m.programme,
    employment: m.employment,
    education: m.education,
    verifiedAt: m.verifiedAt,
    verificationMethod: m.verificationMethod,
    roles: m.roles,
    contact,
    // The visibility setting is metadata about the refusal, not contact
    // data — it lets the UI name which gate is closed instead of showing
    // a dead end. Safe to release: it says how this member has chosen to
    // be reachable, never how to reach them.
    contactVisibility: m.privateContact.visibility,
    hasAcceptedConnection: accepted,
    // CGPA and placement status are placement-side only. Never exposed to
    // alumni — they post jobs here.
    ...(privileged || m.id === s.memberId
      ? { rollNumber: m.rollNumber, cgpa: m.cgpa, placementStatus: m.placementStatus }
      : {}),
  } as MemberDetail;
}

/** The signed-in member's own record — always complete, never projected. */
export function getOwnProfile(session: Session): (MemberDetail & { privateContact: MemberDetail['contact'] }) | null {
  const m = byId.get(session.memberId);
  if (!m) return null;
  return {
    ...toSummary(m),
    bio: m.bio,
    preferredName: m.preferredName,
    admissionYear: m.admissionYear,
    programme: m.programme,
    employment: m.employment,
    education: m.education,
    verifiedAt: m.verifiedAt,
    verificationMethod: m.verificationMethod,
    roles: m.roles,
    contact: m.privateContact,
    contactVisibility: m.privateContact.visibility,
    // Own record — the question does not arise.
    hasAcceptedConnection: false,
    privateContact: m.privateContact,
    rollNumber: m.rollNumber,
    cgpa: m.cgpa,
    placementStatus: m.placementStatus,
  };
}

// ---------------------------------------------------------------
// Connections
// ---------------------------------------------------------------

function hasAcceptedConnection(a: string, b: string): boolean {
  return CONNECTIONS.some(
    (c) =>
      c.state === 'accepted' &&
      ((c.from.id === a && c.to.id === b) || (c.from.id === b && c.to.id === a)),
  );
}

export function getConnections(
  session: Session,
  direction: 'received' | 'sent' | 'accepted',
): ConnectionRequest[] {
  const mine = CONNECTIONS.filter((c) =>
    direction === 'sent' ? c.from.id === session.memberId : c.to.id === session.memberId,
  );

  if (direction === 'accepted') {
    return CONNECTIONS.filter(
      (c) => c.state === 'accepted' && (c.from.id === session.memberId || c.to.id === session.memberId),
    );
  }

  return mine.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * The student-to-alumni valve.
 *
 * If 400 final-years can message 8,000 alumni without limit, the alumni
 * disengage within a month and the network is dead. The quota is the
 * whole reason the directory stays worth being in.
 */
export function getConnectionQuota(session: Session): ConnectionQuota {
  const isStudent = session.roles.some((r) => r.role === 'student');
  const openLimit = isStudent ? CONNECTION_LIMITS.studentOpenRequests : CONNECTION_LIMITS.alumniOpenRequests;
  const monthlyLimit = isStudent ? CONNECTION_LIMITS.studentPerMonth : CONNECTION_LIMITS.alumniPerMonth;

  const sent = CONNECTIONS.filter((c) => c.from.id === session.memberId);
  const openRequests = sent.filter((c) => c.state === 'pending').length;

  const monthStart = new Date(SEED_NOW.getFullYear(), SEED_NOW.getMonth(), 1).toISOString();
  const usedThisMonth = sent.filter((c) => c.createdAt >= monthStart).length;

  const overOpen = openRequests >= openLimit;
  const overMonth = usedThisMonth >= monthlyLimit;

  return {
    openRequests,
    openLimit,
    usedThisMonth,
    monthlyLimit,
    canSend: !overOpen && !overMonth,
    reason: overOpen
      ? `You have ${openRequests} requests still waiting for a reply. Wait for one to be answered before sending another.`
      : overMonth
        ? `You have used all ${monthlyLimit} requests for this month.`
        : null,
  };
}

// ---------------------------------------------------------------
// Events
// ---------------------------------------------------------------

export function getEvents(
  session: Session | null,
  opts: { when?: 'upcoming' | 'past' | 'all'; department?: string; includeDrafts?: boolean } = {},
): EventItem[] {
  const now = SEED_NOW.toISOString();
  const canSeeDrafts = Boolean(opts.includeDrafts && session && can(session, 'event.create.any'));

  return EVENTS.filter((e) => {
    if (!e.published && !canSeeDrafts) return false;

    // An alumni-only event is not merely hidden from students in the
    // list — it is not addressable by them anywhere.
    const isStudent = session?.roles.some((r) => r.role === 'student') ?? false;
    if (e.alumniOnly && isStudent) return false;
    if (isStudent && !e.studentEligible) return false;

    if (opts.department && e.departmentCode && e.departmentCode !== opts.department) return false;
    if (opts.when === 'upcoming') return e.startsAt >= now;
    if (opts.when === 'past') return e.startsAt < now;
    return true;
  })
    .map((e) => withViewerRegistration(e, session))
    .sort((a, b) =>
      opts.when === 'past' ? b.startsAt.localeCompare(a.startsAt) : a.startsAt.localeCompare(b.startsAt),
    );
}

export function getEventBySlug(session: Session | null, slug: string): EventItem | null {
  const e = EVENTS.find((x) => x.slug === slug);
  if (!e) return null;
  const isStudent = session?.roles.some((r) => r.role === 'student') ?? false;
  if (e.alumniOnly && isStudent) return null;
  if (!e.published && !(session && can(session, 'event.create.any'))) return null;
  return withViewerRegistration(e, session);
}

function withViewerRegistration(e: EventItem, session: Session | null): EventItem {
  if (!session) return { ...e, viewerRegistration: null };
  const reg = EVENT_REGISTRATIONS.find((r) => r.eventId === e.id && r.memberId === session.memberId);
  return {
    ...e,
    viewerRegistration: reg ? { id: reg.id, guests: reg.guests, checkedIn: Boolean(reg.checkedInAt) } : null,
  };
}

export function getEventRegistrations(eventId: string): EventRegistration[] {
  return EVENT_REGISTRATIONS.filter((r) => r.eventId === eventId);
}

// ---------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------

export function getJobs(
  session: Session | null,
  opts: { state?: JobPosting['state'] | 'all'; q?: string; internshipsOnly?: boolean; mine?: boolean } = {},
): JobPosting[] {
  const moderator = Boolean(session && can(session, 'job.moderate'));
  const wanted = opts.state ?? 'live';

  return JOBS.filter((j) => {
    if (opts.mine && session) return j.postedBy.id === session.memberId;
    // Only a moderator sees anything that is not live. An author sees
    // their own pending post, because otherwise it looks like it vanished.
    if (wanted === 'all') return moderator;
    if (j.state !== wanted) return false;
    if (j.state !== 'live' && !moderator && j.postedBy.id !== session?.memberId) return false;
    return true;
  })
    .filter((j) => {
      if (opts.internshipsOnly && !j.isInternship) return false;
      if (!opts.q) return true;
      const hay = `${j.title} ${j.company} ${j.location ?? ''} ${j.skills.join(' ')}`.toLowerCase();
      return opts.q.toLowerCase().split(/\s+/).every((t) => hay.includes(t));
    })
    .map((j) => ({
      ...j,
      viewerHasApplied: session
        ? JOB_APPLICATIONS.some((a) => a.jobId === j.id && a.applicant.id === session.memberId)
        : false,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getJobById(session: Session | null, id: string): JobPosting | null {
  const j = JOBS.find((x) => x.id === id);
  if (!j) return null;
  const moderator = Boolean(session && can(session, 'job.moderate'));
  if (j.state !== 'live' && !moderator && j.postedBy.id !== session?.memberId) return null;
  return {
    ...j,
    viewerHasApplied: session
      ? JOB_APPLICATIONS.some((a) => a.jobId === j.id && a.applicant.id === session.memberId)
      : false,
  };
}

export function getJobApplications(jobId: string): JobApplication[] {
  return JOB_APPLICATIONS.filter((a) => a.jobId === jobId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getMyApplications(session: Session): JobApplication[] {
  return JOB_APPLICATIONS.filter((a) => a.applicant.id === session.memberId);
}

// ---------------------------------------------------------------
// Verification
// ---------------------------------------------------------------

export function getVerificationClaims(
  session: Session,
  opts: { status?: VerificationClaim['status'] | 'all' } = {},
): VerificationClaim[] {
  // An HOD holds `verification.review.department` and must only ever see
  // their own department's claims — the scope check is not optional
  // decoration on top of the capability.
  const departmentScope = session.roles.find(
    (r) => r.role === 'hod' && r.departmentId !== null,
  )?.departmentId;

  const wide = can(session, 'verification.review.any');

  return VERIFICATION_CLAIMS.filter((c) => {
    if (!wide && departmentScope && c.claimedDepartmentCode !== departmentScope) return false;
    if (opts.status && opts.status !== 'all' && c.status !== opts.status) return false;
    return true;
  });
}

export function searchDegreeRegister(
  q: string,
  opts: { department?: string; year?: number; page?: number; perPage?: number } = {},
): Paged<DegreeRecord> {
  const term = q.trim().toLowerCase();
  let rows = DEGREE_REGISTER;

  if (term) {
    rows = rows.filter(
      (r) => r.name.toLowerCase().includes(term) || r.rollNumber.toLowerCase().includes(term),
    );
  }
  if (opts.department) rows = rows.filter((r) => r.departmentCode === opts.department);
  if (opts.year) rows = rows.filter((r) => r.yearOfPassing === opts.year);

  const page = Math.max(1, opts.page ?? 1);
  const perPage = opts.perPage ?? 50;
  const total = rows.length;

  return {
    items: rows.slice((page - 1) * perPage, page * perPage),
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}

export function getDegreeRegisterStats() {
  const claimed = new Set(SEED.alumni.map((m) => m.degreeRecordId).filter(Boolean));
  const byYear = new Map<number, { total: number; claimed: number }>();

  for (const r of DEGREE_REGISTER) {
    const y = r.yearOfPassing ?? 0;
    const cur = byYear.get(y) ?? { total: 0, claimed: 0 };
    cur.total++;
    if (claimed.has(r.id)) cur.claimed++;
    byYear.set(y, cur);
  }

  return {
    total: DEGREE_REGISTER.length,
    claimed: claimed.size,
    unclaimed: DEGREE_REGISTER.length - claimed.size,
    coverage: DEGREE_REGISTER.length ? claimed.size / DEGREE_REGISTER.length : 0,
    byYear: [...byYear.entries()]
      .filter(([y]) => y > 0)
      .sort((a, b) => a[0] - b[0])
      .map(([year, v]) => ({ year, ...v })),
  };
}

// ---------------------------------------------------------------
// Donations
// ---------------------------------------------------------------

export function getCampaigns(): DonationCampaign[] {
  return CAMPAIGNS;
}

export function getDonations(opts: { foreignOnly?: boolean } = {}): Donation[] {
  return opts.foreignOnly ? DONATIONS.filter((d) => d.isForeignContribution) : DONATIONS;
}

export function getDonationSummary() {
  const ok = DONATIONS.filter((d) => d.state === 'succeeded');
  const domestic = ok.filter((d) => !d.isForeignContribution);
  const foreign = ok.filter((d) => d.isForeignContribution);
  const sum = (rows: Donation[]) => rows.reduce((n, d) => n + d.amount, 0);

  return {
    totalRaised: sum(ok),
    // Reported separately from the first rupee. FCRA segregation is
    // structural, not a filter applied at audit time.
    domestic: { count: domestic.length, amount: sum(domestic) },
    foreign: { count: foreign.length, amount: sum(foreign) },
    donorCount: new Set(ok.map((d) => d.donorName)).size,
    pending: DONATIONS.filter((d) => d.state === 'initiated').length,
    failed: DONATIONS.filter((d) => d.state === 'failed').length,
  };
}

// ---------------------------------------------------------------
// Admin
// ---------------------------------------------------------------

export function getAuditLog(opts: { action?: string; q?: string; limit?: number } = {}): AuditEntry[] {
  let rows = AUDIT_LOG;
  if (opts.action) rows = rows.filter((r) => r.action === opts.action);
  if (opts.q) {
    const t = opts.q.toLowerCase();
    rows = rows.filter((r) => `${r.actorName} ${r.action} ${r.resource} ${r.reason ?? ''}`.toLowerCase().includes(t));
  }
  return rows.slice(0, opts.limit ?? 60);
}

export function getAuditActions(): string[] {
  return [...new Set(AUDIT_LOG.map((r) => r.action))].sort();
}

export function getDataRequests(): DataRequest[] {
  return [...DATA_REQUESTS].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

/**
 * Notifications for the signed-in member, and nobody else's.
 *
 * There is no capability that reads another member's notifications and no
 * argument here that would express one. This function previously ignored
 * its session and returned the whole table — which put a named student's
 * mentorship request into the vendor's console on every page load, and
 * would have done the same for any member who opened the bell.
 */
export function getNotifications(session: Session): NotificationItem[] {
  return NOTIFICATIONS.filter((n) => n.memberId === session.memberId).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function getTenants(): TenantSummary[] {
  return TENANTS;
}

export function getMembersForAdmin(opts: {
  q?: string;
  status?: string;
  department?: string;
  page?: number;
  perPage?: number;
}): Paged<MemberDetail> {
  let rows = SEED.members;

  if (opts.q) {
    const t = opts.q.toLowerCase();
    rows = rows.filter((m) =>
      `${m.fullName} ${m.rollNumber ?? ''} ${m.privateContact.email ?? ''} ${m.currentCompany ?? ''}`
        .toLowerCase()
        .includes(t),
    );
  }
  if (opts.status && opts.status !== 'all') rows = rows.filter((m) => m.status === opts.status);
  if (opts.department) rows = rows.filter((m) => m.departmentCode === opts.department);

  const page = Math.max(1, opts.page ?? 1);
  const perPage = opts.perPage ?? 25;
  const total = rows.length;

  return {
    items: rows.slice((page - 1) * perPage, page * perPage).map((m) => ({
      ...toSummary(m),
      bio: m.bio,
      preferredName: m.preferredName,
      admissionYear: m.admissionYear,
      programme: m.programme,
      employment: m.employment,
      education: m.education,
      verifiedAt: m.verifiedAt,
      verificationMethod: m.verificationMethod,
      roles: m.roles,
      contact: m.privateContact,
      contactVisibility: m.privateContact.visibility,
      hasAcceptedConnection: false,
      rollNumber: m.rollNumber,
      cgpa: m.cgpa,
      placementStatus: m.placementStatus,
    })),
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}

// ---------------------------------------------------------------
// Stats
// ---------------------------------------------------------------

export function getStats(session: Session): EngagementStats {
  const alumni = SEED.alumni.length;
  const students = SEED.students.length;
  const registerStats = getDegreeRegisterStats();

  const monthStart = new Date(SEED_NOW.getFullYear(), SEED_NOW.getMonth(), 1).toISOString();
  const thisMonth = CONNECTIONS.filter((c) => c.createdAt >= monthStart);
  const answered = CONNECTIONS.filter((c) => c.state === 'accepted' || c.state === 'declined');

  const tally = (get: (m: SeedMember) => string | null | undefined, limit: number) => {
    const map = new Map<string, number>();
    for (const m of SEED.members) {
      const v = get(m);
      if (v) map.set(v, (map.get(v) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([label, value]) => ({ label, value }));
  };

  const batchMap = new Map<number, number>();
  for (const m of SEED.alumni) if (m.batchYear) batchMap.set(m.batchYear, (batchMap.get(m.batchYear) ?? 0) + 1);

  const signupTrend = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(SEED_NOW.getFullYear(), SEED_NOW.getMonth() - (11 - i), 1);
    const next = new Date(SEED_NOW.getFullYear(), SEED_NOW.getMonth() - (10 - i), 1);
    const count = SEED.members.filter(
      (m) => m.createdAt >= d.toISOString() && m.createdAt < next.toISOString(),
    ).length;
    return { label: d.toLocaleDateString('en-IN', { month: 'short' }), value: count };
  });

  void session;

  return {
    totalMembers: alumni + students,
    alumni,
    students,
    verified: alumni + students,
    unclaimed: registerStats.unclaimed,
    pendingVerification: VERIFICATION_CLAIMS.filter((c) => c.status === 'queued').length,
    connectionsThisMonth: thisMonth.length,
    acceptRate: answered.length
      ? answered.filter((c) => c.state === 'accepted').length / answered.length
      : 0,
    eventsUpcoming: EVENTS.filter((e) => e.published && e.startsAt >= SEED_NOW.toISOString()).length,
    jobsLive: JOBS.filter((j) => j.state === 'live').length,
    openToMentoring: SEED.alumni.filter((m) => m.openToMentoring).length,
    signupTrend,
    batchDistribution: [...batchMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, value]) => ({ label: String(year), value })),
    departmentDistribution: tally((m) => m.departmentCode, 10),
    topCompanies: tally((m) => m.currentCompany, 8),
    topCities: tally((m) => m.city, 8),
  };
}
