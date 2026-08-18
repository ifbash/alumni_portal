import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/lib/auth/guard';
import { CONNECTION_LIMITS } from '@/lib/config';
import {
  findMemberById,
  getConnectionQuota,
  getDemoAccounts,
  getEvents,
  getJobs,
  getMemberBySlug,
  getVerificationClaims,
  searchDirectory,
} from '@/lib/data/repo';
import { CONNECTIONS, JOBS, SEED, SEED_NOW } from '@/lib/data/seed';

/**
 * The read layer's guards.
 *
 * Fixture mode is where the permission tests run in CI without a
 * container, so these are the same assertions the Postgres implementation
 * has to satisfy under row-level security. A page cannot ask for more
 * than its viewer is entitled to, because there is no argument that would
 * express it — this is the suite that proves that claim.
 */

/**
 * Sessions built from the seeded demo accounts rather than invented.
 *
 * Note the mapping: a demo account carries `departmentCode`, and the
 * session's `departmentId` is what the repo compares against a claim's
 * `claimedDepartmentCode`. In fixture mode the department *code* is the
 * identifier, so the two are the same string.
 */
function sessionFor(email: string): Session {
  const account = getDemoAccounts().find((a) => a.email === email);
  if (!account) throw new Error(`No demo account for ${email}`);
  const member = findMemberById(account.memberId);
  if (!member) throw new Error(`Demo account ${email} points at a missing member`);

  return {
    memberId: member.id,
    tenantId: 'ten-diet',
    status: member.status,
    roles: account.roles.map((r) => ({ role: r.role, departmentId: r.departmentCode })),
    departmentId: member.departmentCode,
    batchYear: member.batchYear,
  };
}

const STUDENT = sessionFor('student@diet.ac.in');
const ALUMNUS = sessionFor('alumni@example.com');
const HOD_CSE = sessionFor('hod.cse@diet.ac.in');
const PLACEMENT = sessionFor('tpo@diet.ac.in');
const ADMIN = sessionFor('admin@diet.ac.in');

const DEMO_IDS = new Set(getDemoAccounts().map((a) => a.memberId));

/** An alumnus with the given visibility who is not also a staff demo account. */
function alumnusWithVisibility(visibility: string) {
  const m = SEED.alumni.find(
    (a) => a.privateContact.visibility === visibility && !DEMO_IDS.has(a.id),
  );
  if (!m) throw new Error(`Seed has no plain alumnus with visibility ${visibility}`);
  return m;
}

describe('searchDirectory', () => {
  it('refuses an anonymous caller', () => {
    // The directory is never anonymous, whatever the query says.
    let status: number | undefined;
    try {
      searchDirectory(null, {});
      throw new Error('expected searchDirectory to throw');
    } catch (e) {
      status = (e as Error & { status?: number }).status;
    }
    expect(status).toBe(401);
  });

  it('never returns a student to a student, on any page', () => {
    // Not "not on page one" — the whole result set. Students may not
    // enumerate students, and paging is not a security boundary.
    const result = searchDirectory(STUDENT, { perPage: 1000 });
    expect(result.items.length).toBe(result.total);
    expect(result.items.some((m) => m.status === 'active_student')).toBe(false);
    expect(result.items.some((m) => m.isStudent)).toBe(false);
    expect(result.total).toBe(SEED.alumni.length);
  });

  it('does not honour a student asking for the student cohort', () => {
    // The filter runs after the status gate, so the explicit request
    // narrows to nothing rather than widening anything.
    const result = searchDirectory(STUDENT, { cohort: 'students', perPage: 1000 });
    expect(result.items).toEqual([]);
  });

  it('gives a student the student tier and no placement-side fields', () => {
    const result = searchDirectory(STUDENT, { perPage: 50 });
    expect(result.tier).toBe('student');
    for (const item of result.items) {
      const keys = item as unknown as Record<string, unknown>;
      expect('cgpa' in keys).toBe(false);
      expect('placementStatus' in keys).toBe(false);
      expect('rollNumber' in keys).toBe(false);
      expect('contact' in keys).toBe(false);
      expect('email' in keys).toBe(false);
    }
  });

  it('lets the roles that hold directory.search.students see both cohorts', () => {
    const result = searchDirectory(ADMIN, { perPage: 2000 });
    expect(result.total).toBe(SEED.members.length);
    expect(result.items.some((m) => m.isStudent)).toBe(true);
    expect(result.tier).toBe('privileged');
  });
});

describe('getMemberBySlug', () => {
  it('returns no contact to a student for an alumni_only profile', () => {
    const owner = alumnusWithVisibility('alumni_only');
    expect(getMemberBySlug(STUDENT, owner.slug)?.contact).toBeNull();
  });

  it('returns no contact to a student for a private profile', () => {
    const owner = alumnusWithVisibility('private');
    expect(getMemberBySlug(STUDENT, owner.slug)?.contact).toBeNull();
  });

  it('returns no contact to a student for an on_accept profile with no connection', () => {
    const owner = alumnusWithVisibility('on_accept');
    expect(getMemberBySlug(STUDENT, owner.slug)?.contact).toBeNull();
  });

  it('releases an alumni_only profile to an alumnus', () => {
    // The second gate, from the other side: the owner consented to
    // members, and the viewer is one.
    const owner = alumnusWithVisibility('alumni_only');
    const detail = getMemberBySlug(ALUMNUS, owner.slug);
    expect(detail?.contact?.email).toBe(owner.privateContact.email);
  });

  it('withholds placement-side fields from a student and gives them to an admin', () => {
    const owner = alumnusWithVisibility('alumni_only');
    const asStudent = getMemberBySlug(STUDENT, owner.slug) as unknown as Record<string, unknown>;
    expect('cgpa' in asStudent).toBe(false);
    expect('rollNumber' in asStudent).toBe(false);

    const asAdmin = getMemberBySlug(ADMIN, owner.slug) as unknown as Record<string, unknown>;
    expect('rollNumber' in asAdmin).toBe(true);
  });

  it('hides a student profile from a student entirely', () => {
    const otherStudent = SEED.students.find((s) => s.id !== STUDENT.memberId)!;
    expect(getMemberBySlug(STUDENT, otherStudent.slug)).toBeNull();
    expect(getMemberBySlug(ADMIN, otherStudent.slug)).not.toBeNull();
  });

  it('lets a member see their own record even when the status filter would hide it', () => {
    const own = getMemberBySlug(STUDENT, findMemberById(STUDENT.memberId)!.slug);
    expect(own?.id).toBe(STUDENT.memberId);
  });
});

describe('getVerificationClaims', () => {
  it('scopes the CSE HOD to CSE claims', () => {
    // Holding verification.review.department is not the decision; the
    // claim's department is.
    const claims = getVerificationClaims(HOD_CSE);
    expect(claims.length).toBeGreaterThan(0);
    expect([...new Set(claims.map((c) => c.claimedDepartmentCode))]).toEqual(['CSE']);
  });

  it('gives the college admin the whole queue', () => {
    const all = getVerificationClaims(ADMIN);
    const cse = getVerificationClaims(HOD_CSE);
    expect(all.length).toBeGreaterThan(cse.length);
    expect(new Set(all.map((c) => c.claimedDepartmentCode)).size).toBeGreaterThan(1);
  });

  it('keeps the department scope when a status filter is applied', () => {
    for (const c of getVerificationClaims(HOD_CSE, { status: 'queued' })) {
      expect(c.claimedDepartmentCode).toBe('CSE');
      expect(c.status).toBe('queued');
    }
  });
});

describe('getJobs', () => {
  const pendingJob = JOBS.find((j) => j.state === 'pending_moderation')!;

  it('hides a non-live posting from a member who is neither author nor moderator', () => {
    expect(ALUMNUS.memberId).not.toBe(pendingJob.postedBy.id);
    expect(getJobs(ALUMNUS, { state: 'pending_moderation' })).toEqual([]);
    expect(getJobs(ALUMNUS, { state: 'rejected' })).toEqual([]);
    expect(getJobs(ALUMNUS, { state: 'all' })).toEqual([]);
  });

  it('shows the moderation queue to a moderator', () => {
    const queue = getJobs(PLACEMENT, { state: 'pending_moderation' });
    expect(queue.map((j) => j.id)).toContain(pendingJob.id);
    expect(getJobs(PLACEMENT, { state: 'all' }).length).toBe(JOBS.length);
  });

  it('shows an author their own pending posting', () => {
    // Otherwise it looks like the posting vanished, and they post it again.
    const author: Session = {
      ...ALUMNUS,
      memberId: pendingJob.postedBy.id,
      roles: [{ role: 'alumni', departmentId: null }],
    };
    expect(getJobs(author, { state: 'pending_moderation' }).map((j) => j.id)).toContain(pendingJob.id);
  });

  it('returns only live postings by default', () => {
    const live = getJobs(ALUMNUS, {});
    expect(live.length).toBeGreaterThan(0);
    expect(live.every((j) => j.state === 'live')).toBe(true);
  });
});

describe('getEvents', () => {
  it('hides an alumni-only event from a student', () => {
    // Not merely hidden from the list — not addressable by them anywhere.
    const alumniOnly = getEvents(ADMIN, { when: 'all' }).find((e) => e.alumniOnly)!;
    expect(alumniOnly).toBeDefined();
    expect(getEvents(STUDENT, { when: 'all' }).map((e) => e.id)).not.toContain(alumniOnly.id);
    expect(getEvents(ALUMNUS, { when: 'all' }).map((e) => e.id)).toContain(alumniOnly.id);
  });

  it('hides an event a student is not eligible for', () => {
    for (const e of getEvents(STUDENT, { when: 'all' })) {
      expect(e.studentEligible).toBe(true);
      expect(e.alumniOnly).toBe(false);
    }
  });

  it('hides drafts from everyone without event.create.any', () => {
    const draftId = 'evt-7';
    for (const viewer of [STUDENT, ALUMNUS, HOD_CSE, PLACEMENT]) {
      const ids = getEvents(viewer, { when: 'all', includeDrafts: true }).map((e) => e.id);
      expect(ids, 'a draft reached a viewer without event.create.any').not.toContain(draftId);
    }
    expect(getEvents(ADMIN, { when: 'all', includeDrafts: true }).map((e) => e.id)).toContain(draftId);
  });

  it('hides drafts from an event author who does not ask for them', () => {
    expect(getEvents(ADMIN, { when: 'all' }).every((e) => e.published)).toBe(true);
  });

  it('publishes nothing unpublished to an anonymous caller', () => {
    expect(getEvents(null, { when: 'all', includeDrafts: true }).every((e) => e.published)).toBe(true);
  });
});

// ---------------------------------------------------------------
// Connection quota
// ---------------------------------------------------------------

/**
 * The student-to-alumni valve.
 *
 * The seeded dataset sits well inside the shipped limits — deliberately,
 * because a demo where every account is already blocked shows nothing. To
 * exercise the refusal, the limits are pulled down to what the busiest
 * seeded sender has actually used, rather than inventing connection rows
 * the rest of the fixture does not know about.
 */
const monthStart = new Date(SEED_NOW.getFullYear(), SEED_NOW.getMonth(), 1).toISOString();

const sentBy = (memberId: string) => CONNECTIONS.filter((c) => c.from.id === memberId);

function busiestSender(by: (rows: typeof CONNECTIONS) => number) {
  const ids = [...new Set(CONNECTIONS.map((c) => c.from.id))];
  return ids
    .map((id) => ({ id, count: by(sentBy(id)) }))
    .sort((a, b) => b.count - a.count)[0]!;
}

type Limits = Partial<Record<keyof typeof CONNECTION_LIMITS, number>>;

async function repoWithLimits(limits: Limits) {
  vi.resetModules();
  vi.doMock('@/lib/config', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/config')>();
    return { ...actual, CONNECTION_LIMITS: { ...actual.CONNECTION_LIMITS, ...limits } };
  });
  return import('@/lib/data/repo');
}

describe('getConnectionQuota', () => {
  beforeEach(() => {
    vi.doUnmock('@/lib/config');
    vi.resetModules();
  });

  it('lets a member who is inside both limits send', () => {
    const quota = getConnectionQuota(STUDENT);
    expect(quota.canSend).toBe(true);
    expect(quota.reason).toBeNull();
    expect(quota.openLimit).toBe(CONNECTION_LIMITS.studentOpenRequests);
    expect(quota.monthlyLimit).toBe(CONNECTION_LIMITS.studentPerMonth);
  });

  it('applies the alumni limits to a member who is not a student', () => {
    const quota = getConnectionQuota(ALUMNUS);
    expect(quota.openLimit).toBe(CONNECTION_LIMITS.alumniOpenRequests);
    expect(quota.monthlyLimit).toBe(CONNECTION_LIMITS.alumniPerMonth);
  });

  it('refuses on the open-request limit and says which limit was hit', async () => {
    // "Limit exceeded" tells a student nothing. The copy has to say what
    // to do — wait for a reply — or they open a support ticket instead.
    const busiest = busiestSender((rows) => rows.filter((c) => c.state === 'pending').length);
    expect(busiest.count).toBeGreaterThan(0);

    const repo = await repoWithLimits({ studentOpenRequests: busiest.count, studentPerMonth: 999 });
    const quota = repo.getConnectionQuota({
      ...STUDENT,
      memberId: busiest.id,
      roles: [{ role: 'student', departmentId: null }],
    });

    expect(quota.canSend).toBe(false);
    expect(quota.openRequests).toBe(busiest.count);
    expect(quota.reason).toContain('waiting for a reply');
    expect(quota.reason).toContain(String(busiest.count));
    expect(quota.reason).not.toContain('this month');
  });

  it('refuses on the monthly limit and names that limit instead', async () => {
    const busiest = busiestSender((rows) =>
      rows.some((c) => c.state === 'pending') ? 0 : rows.filter((c) => c.createdAt >= monthStart).length,
    );
    expect(busiest.count).toBeGreaterThan(0);

    const repo = await repoWithLimits({ studentOpenRequests: 999, studentPerMonth: busiest.count });
    const quota = repo.getConnectionQuota({
      ...STUDENT,
      memberId: busiest.id,
      roles: [{ role: 'student', departmentId: null }],
    });

    expect(quota.canSend).toBe(false);
    expect(quota.usedThisMonth).toBe(busiest.count);
    expect(quota.reason).toContain(`all ${busiest.count} requests for this month`);
    expect(quota.reason).not.toContain('waiting for a reply');
  });
});
