import { describe, expect, it } from 'vitest';
import { capabilityMismatch } from '@/app/(admin)/admin/audit/audit-taxonomy';
import type { Session } from '@/lib/auth/guard';
import { roleHas, type Capability } from '@/lib/auth/permissions';
import { releaseContact } from '@/lib/members/projection';
import { findMemberById } from '@/lib/data/repo';
import {
  AUDIT_LOG,
  CONNECTIONS,
  DATA_REQUESTS,
  EVENTS,
  JOB_APPLICATIONS,
  JOBS,
  NOTIFICATIONS,
  SEED,
  type SeedMember,
} from '@/lib/data/seed';
import { SEED_NOW } from '@/lib/clock';

/**
 * The demo dataset tells one consistent story.
 *
 * Fixture mode is how the portal is shown to a college before anything is
 * signed, so a contradiction in the seed is a contradiction a principal
 * sees: a faculty member greeted by somebody else's name, a Dean listed
 * as a mentor, a notification about a request that does not exist. Each
 * block below pins one of the fixes (S1–S11 in the foundation brief).
 */

const account = (email: string) => {
  const a = SEED.demoAccounts.find((x) => x.email === email);
  if (!a) throw new Error(`No demo account ${email}`);
  return findMemberById(a.memberId)!;
};

function sessionOf(m: SeedMember): Session {
  return {
    memberId: m.id,
    tenantId: 'ten-diet',
    status: m.status,
    roles: m.roles.map((r) => ({ role: r.role, departmentId: r.departmentCode })),
    departmentId: m.departmentCode,
    batchYear: m.batchYear,
  };
}

const accepted = (a: string, b: string) =>
  CONNECTIONS.some(
    (c) => c.state === 'accepted' && ((c.from.id === a && c.to.id === b) || (c.from.id === b && c.to.id === a)),
  );

const STAFF = [
  'admin@diet.ac.in',
  'alumnicell@diet.ac.in',
  'hod.cse@diet.ac.in',
  'tpo@diet.ac.in',
  'finance@diet.ac.in',
  'faculty.ece@diet.ac.in',
];

describe('S0 · the clock', () => {
  it('is the same instant wherever it is imported from', async () => {
    const seed = await import('@/lib/data/seed');
    expect(seed.SEED_NOW).toBe(SEED_NOW);
    expect(SEED_NOW.toISOString()).toBe('2026-08-17T04:00:00.000Z');
  });
});

describe('S1 · demo accounts carry no borrowed preferred name', () => {
  it.each(SEED.demoAccounts.map((a) => a.email))('%s', (email) => {
    expect(account(email).preferredName).toBeNull();
  });
});

describe('S2 · staff are not employees of a random company', () => {
  it.each(STAFF)('%s', (email) => {
    const m = account(email);
    expect(m.currentCompany).toBeNull();
    expect(m.employment).toEqual([]);
    expect(m.industry).toBeNull();
  });
});

describe('S3 · the demo alumnus has a coherent history', () => {
  it('Amazon since 2021, Infosys before, one B.Tech', () => {
    const m = account('alumni@example.com');
    expect(m.industry).toBe('E-commerce');
    expect(m.employment.map((e) => [e.company, e.designation, e.startedOn, e.endedOn, e.isCurrent])).toEqual([
      ['Amazon', 'Senior Software Engineer', '2021-04-01', null, true],
      ['Infosys', 'Systems Engineer', '2017-07-01', '2021-03-31', false],
    ]);
    expect(m.education).toHaveLength(1);
    expect(m.education[0]).toMatchObject({ qualification: 'B.Tech', startedOn: '2013-08-01', endedOn: '2017-05-31' });
    expect(m.batchYear).toBe(2017);
  });
});

describe('S4 · the Dean is not a mentor', () => {
  it('has mentoring off', () => {
    expect(account('admin@diet.ac.in').openToMentoring).toBe(false);
  });
});

describe('S5 · every persona has real requests', () => {
  const harika = SEED.students[0]!;
  const vamsi = SEED.alumni[9]!;
  const demo = CONNECTIONS.filter((c) => c.id.startsWith('conn-demo-'));
  const byId = (id: string) => demo.find((c) => c.id === id)!;

  it('appends six rows and leaves the generated ones where they were', () => {
    expect(demo.map((c) => c.id)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `conn-demo-${n}`));
    expect(CONNECTIONS.slice(-6).every((c) => c.id.startsWith('conn-demo-'))).toBe(true);
  });

  it('gives Vamsi three requests to answer, Harika’s among them', () => {
    const waiting = demo.filter((c) => c.to.id === vamsi.id && c.state === 'pending');
    expect(waiting).toHaveLength(3);
    expect(byId('conn-demo-1')).toMatchObject({ kind: 'mentorship', state: 'pending' });
    expect(byId('conn-demo-1').from.id).toBe(harika.id);
    expect(byId('conn-demo-1').message).toMatch(/interview|assessment/i);
    expect(byId('conn-demo-2')).toMatchObject({ kind: 'referral', state: 'pending' });
  });

  it('connects Harika to an alumni_only mentor, and her contact stays withheld', () => {
    const c = byId('conn-demo-4');
    expect(c).toMatchObject({ kind: 'mentorship', state: 'accepted' });
    const m = findMemberById(c.to.id)!;
    expect(m.privateContact.visibility).toBe('alumni_only');
    expect(m.roles.every((r) => r.role === 'alumni')).toBe(true);
    // Last month, so it does not use this month's quota.
    expect(new Date(c.createdAt).getMonth()).toBeLessThan(SEED_NOW.getMonth());

    const got = releaseContact(sessionOf(harika), { memberId: m.id, contact: m.privateContact }, {
      hasAcceptedConnection: accepted(harika.id, m.id),
    });
    expect(accepted(harika.id, m.id)).toBe(true);
    expect(got).toBeNull();
  });

  it('releases an on_accept alumna’s contact to Vamsi, who she accepted', () => {
    const c = byId('conn-demo-5');
    expect(c).toMatchObject({ kind: 'introduction', state: 'accepted' });
    expect(c.from.id).toBe(vamsi.id);
    const m2 = findMemberById(c.to.id)!;
    expect(m2.privateContact.visibility).toBe('on_accept');

    const got = releaseContact(sessionOf(vamsi), { memberId: m2.id, contact: m2.privateContact }, {
      hasAcceptedConnection: accepted(vamsi.id, m2.id),
    });
    expect(got?.email).toBe(m2.privateContact.email);
  });

  it('keeps the e2e contact targets (the first of each visibility) unconnected', () => {
    const demoIds = new Set(SEED.demoAccounts.map((a) => a.memberId));
    const first = (v: string) =>
      SEED.members.find(
        (x) =>
          x.status === 'active_alumni' &&
          !demoIds.has(x.id) &&
          x.privateContact.visibility === v &&
          x.roles.every((r) => r.role === 'alumni'),
      )!;
    for (const v of ['alumni_only', 'on_accept']) {
      const target = first(v).id;
      expect(demo.some((c) => c.from.id === target || c.to.id === target), v).toBe(false);
    }
  });

  it('gives the ECE faculty account one request to answer', () => {
    const faculty = account('faculty.ece@diet.ac.in');
    expect(byId('conn-demo-6')).toMatchObject({ kind: 'introduction', state: 'pending' });
    expect(byId('conn-demo-6').to.id).toBe(faculty.id);
  });

  it('tells Harika the truth about who accepted, and promises no contact details', () => {
    const n5 = NOTIFICATIONS.find((n) => n.id === 'n-5')!;
    expect(n5.memberId).toBe(harika.id);
    expect(n5.title).toBe(`${byId('conn-demo-4').to.fullName} accepted your request`);
    expect(n5.body).toBe('See their profile.');
    expect(`${n5.title} ${n5.body}`).not.toMatch(/contact/i);
  });
});

describe('S6 · the vendor is not on the jobs board', () => {
  it('has no ifBash posting and no DIET-only wording', () => {
    for (const j of JOBS) {
      expect(j.company).not.toBe('ifBash');
      expect(j.description).not.toMatch(/DIET network/);
    }
    expect(JOBS.some((j) => j.company === 'Tech Mahindra' && j.title === 'ServiceNow Developer')).toBe(true);
  });
});

describe('S7 · posters work where they hire', () => {
  it('makes the live Amazon role the demo alumnus’s own, and says so', () => {
    const vamsi = SEED.alumni[9]!;
    expect(JOBS[0]).toMatchObject({ company: 'Amazon', state: 'live' });
    expect(JOBS[0]!.postedBy.id).toBe(vamsi.id);

    const n3 = NOTIFICATIONS.find((n) => n.id === 'n-3')!;
    expect(n3.title).toBe('Your posting was approved');
    expect(n3.body).toBe('Software Engineer I at Amazon is now live on the jobs board.');
    expect(n3.href).toBe('/jobs/job-0');
  });

  it('re-homes every single-posting poster of a live job at that company', () => {
    const demoIds = new Set(SEED.demoAccounts.map((a) => a.memberId));
    for (const job of JOBS.filter((j) => j.state === 'live')) {
      const posts = JOBS.filter((j) => j.postedBy.id === job.postedBy.id).length;
      if (posts !== 1 || demoIds.has(job.postedBy.id)) continue;
      expect(job.postedBy.currentCompany, job.id).toBe(job.company);
      expect(findMemberById(job.postedBy.id)!.currentCompany, job.id).toBe(job.company);
    }
  });
});

describe('S8 · applications add up', () => {
  it('counts what is stored', () => {
    for (const job of JOBS.filter((j) => j.state === 'live')) {
      expect(job.applicationCount, job.id).toBe(JOB_APPLICATIONS.filter((a) => a.jobId === job.id).length);
    }
  });

  it('writes each note in the applicant’s own branch', () => {
    for (const a of JOB_APPLICATIONS.filter((x) => x.note)) {
      const dept = a.applicant.departmentCode;
      if (dept && ['CSE', 'IT', 'AIML', 'ECE', 'EEE', 'MECH', 'CIVIL'].includes(dept)) {
        expect(a.note, a.id).toContain(`Final-year ${dept} student`);
      }
      if (dept !== 'CSE' && dept !== 'IT' && dept !== 'AIML') expect(a.note, a.id).not.toMatch(/capstone/);
    }
  });
});

describe('S9 · the audit log', () => {
  const ACTION_CAPABILITY: Record<string, Capability[]> = {
    'member.verify': ['verification.review.any', 'verification.review.department'],
    'member.reject': ['verification.review.any', 'verification.review.department'],
    'member.export': ['member.export'],
    'role.grant': ['role.manage'],
    'role.revoke': ['role.manage'],
    'branding.publish': ['tenant.configure'],
    'degree_register.import': ['verification.review.any'],
    'job.moderate': ['job.moderate'],
    'event.create': ['event.create.any', 'event.create.department'],
    'comms.send': ['comms.send.all', 'comms.send.segment', 'comms.send.department'],
    'rollover.execute': ['rollover.execute'],
    'data_request.fulfil': ['data_request.manage'],
    'member.merge': ['profile.merge'],
    'tenant.configure': ['tenant.configure'],
  };

  it('keeps exactly one showcase mismatch: the HOD’s export at index 2', () => {
    const flagged = AUDIT_LOG.map((r, i) => ({ i, r })).filter(({ r }) => capabilityMismatch(r.action, r.actorRole));
    expect(flagged.map(({ i }) => i)).toEqual([2]);
    expect(AUDIT_LOG[2]).toMatchObject({ action: 'member.export', actorRole: 'hod' });
  });

  it('has every other entry made by a role that holds the action', () => {
    AUDIT_LOG.forEach((r, i) => {
      if (i === 2) return;
      const caps = ACTION_CAPABILITY[r.action];
      expect(caps, r.action).toBeDefined();
      expect(caps!.some((c) => roleHas(r.actorRole!, c)), `${r.id} ${r.action} by ${r.actorRole}`).toBe(true);
    });
  });

  it('derives its figures from the seed', () => {
    const exports = AUDIT_LOG.filter((r) => r.action === 'member.export');
    for (const r of exports) expect(r.reason).toContain(`${SEED.members.length} rows, contact fields included`);

    const activeAlumni = SEED.members.filter((m) => m.status === 'active_alumni').length;
    const comms = AUDIT_LOG.filter((r) => r.action === 'comms.send');
    for (const r of comms) expect(r.reason).toMatch(new RegExp(` · ${activeAlumni} recipients$`));
    expect(new Set(comms.map((r) => r.reason)).size).toBe(comms.length);

    for (const r of AUDIT_LOG.filter((x) => x.action === 'degree_register.import')) {
      expect(r.reason).toMatch(/^\d{4} batch, \d+ rows, 4 rejected$/);
    }
  });

  it('records one rollover, last July, at the end of the list', () => {
    const rollovers = AUDIT_LOG.filter((r) => r.action === 'rollover.execute');
    expect(rollovers).toHaveLength(1);
    expect(rollovers[0]!.reason).toMatch(/^Batch of 2025 promoted to alumni · \d+ rows$/);
    expect(rollovers[0]!.createdAt.startsWith('2025-07-15')).toBe(true);
    expect(AUDIT_LOG.at(-1)).toBe(rollovers[0]);
    expect(AUDIT_LOG).toHaveLength(84);
  });
});

describe('S10 · the data-request queue', () => {
  it('has an open deletion and an open correction, neither fulfilled', () => {
    expect(DATA_REQUESTS[1]).toMatchObject({ kind: 'deletion', state: 'received', fulfilledAt: null });
    expect(DATA_REQUESTS[2]).toMatchObject({ kind: 'correction', state: 'in_progress', fulfilledAt: null });
  });
});

describe('S11 · the faculty account is described truthfully', () => {
  it('names what it can do', () => {
    const a = SEED.demoAccounts.find((x) => x.email === 'faculty.ece@diet.ac.in')!;
    expect(a.description).toBe('Searches alumni and final-year students, registers for events, posts jobs.');
  });
});

describe('S12 · venues and times', () => {
  it('names rooms, not another college’s campus', () => {
    for (const e of EVENTS) expect(e.venue ?? '', e.slug).not.toMatch(/DIET|Ganguru/);
  });

  it('ends events on the quarter hour', () => {
    for (const e of EVENTS.filter((x) => x.endsAt)) {
      expect(new Date(e.endsAt!).getUTCMinutes() % 15, e.slug).toBe(0);
    }
  });
});
