#!/usr/bin/env tsx
/**
 * Collect everything the permission suite needs to address the app, in
 * ONE process, and write it to `e2e/.state/fixtures.json`.
 *
 * Two jobs, deliberately fused:
 *
 *  1. **Mint a session cookie for every demo role.** Same HMAC, same
 *     payload shape and same secret as `scripts/mint-session.ts` — the
 *     signature check lives in `src/lib/auth/route-policy.ts`, and this
 *     is the third copy of it. If the cookie format changes there, it
 *     changes here or every request in the suite starts 307ing to /login.
 *
 *  2. **Read real ids and slugs out of the seed.** A permission test that
 *     probes `/directory/some-slug` and gets a 404 has proved nothing
 *     about permissions — "not found" and "not for you" are the same
 *     status by design (see `src/app/api/members/[slug]/route.ts`). Every
 *     dynamic segment in the route table is therefore filled from the
 *     fixture dataset, so a 404 in the matrix is a real finding.
 *
 * Why a separate `tsx` process rather than an import from the Playwright
 * config: loading `src/lib/data/seed.ts` builds the entire fixture
 * dataset, and `scripts/mint-all.ts` carries a warning that doing that
 * repeatedly beside a running dev server is enough memory pressure to get
 * the dev server OOM-killed. One short-lived process, once per run, cached
 * on disk. Playwright itself never imports the app.
 */

import { createHmac } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SEED,
  SEED_NOW,
  TENANTS,
  EVENTS,
  EVENT_REGISTRATIONS,
  JOBS,
  JOB_APPLICATIONS,
  CONNECTIONS,
  CAMPAIGNS,
  AUDIT_LOG,
  DATA_REQUESTS,
  VERIFICATION_CLAIMS,
  DEGREE_REGISTER,
} from '../../src/lib/data/seed';
import { ALBUMS, NEWS, MENTOR_TOPICS } from '../../src/lib/data/content';
import type { StateFile } from '../lib/state-types';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', '.state', 'fixtures.json');

const SECRET = process.env.SESSION_SECRET || 'fixture-mode-development-secret';
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? 'alumni_session';
const SUBDOMAIN = process.env.E2E_TENANT ?? 'diet';
const tenantId = TENANTS.find((t) => t.subdomain === SUBDOMAIN)?.id ?? 'ten-diet';

/** The cookie value for an arbitrary member. See the note above about the third copy. */
function mint(memberId: string): string {
  const payload = { memberId, tenantId, issuedAt: Date.now() };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${COOKIE_NAME}=${body}.${mac}`;
}

/**
 * Demo email → the role key the suite uses. Same names as
 * `scripts/mint-all.ts` emits, lowercased, so a reader can move between
 * the two without a translation table.
 */
const ROLE_BY_EMAIL: Record<string, string> = {
  'student@diet.ac.in': 'student',
  'alumni@example.com': 'alumni',
  'faculty.ece@diet.ac.in': 'faculty',
  'hod.cse@diet.ac.in': 'hod',
  'tpo@diet.ac.in': 'tpo',
  'alumnicell@diet.ac.in': 'operator',
  'finance@diet.ac.in': 'finance',
  'admin@diet.ac.in': 'admin',
  'platform@ifbash.com': 'platform',
};

const byId = new Map(SEED.members.map((m) => [m.id, m]));

const sessions: Record<string, { cookie: string; memberId: string; email: string; label: string }> = {};
for (const account of SEED.demoAccounts) {
  const key = ROLE_BY_EMAIL[account.email];
  if (!key) continue;
  sessions[key] = {
    cookie: mint(account.memberId),
    memberId: account.memberId,
    email: account.email,
    label: account.label,
  };
}

const missing = Object.values(ROLE_BY_EMAIL).filter((k) => !sessions[k]);
if (missing.length) {
  throw new Error(
    `The seed no longer has a demo account for: ${missing.join(', ')}. ` +
      'Either buildSeed() changed or an email in ROLE_BY_EMAIL is stale — ' +
      'the suite cannot assert a role it cannot sign in as.',
  );
}

// ---------------------------------------------------------------
// Members with a known contact-visibility setting
// ---------------------------------------------------------------

/**
 * The nine demo members are excluded from every generic pick below.
 *
 * Not tidiness. `releaseContact()` short-circuits on
 * `viewer.memberId === owner.memberId`, so a target that happens to be the
 * viewer tests the self branch and reports it as a visibility pass — the
 * `on_accept` fixture resolved to the demo alumnus on the first run and
 * would have asserted precisely nothing.
 */
const DEMO_IDS = new Set(Object.values(sessions).map((s) => s.memberId));

/**
 * `releaseContact()` has four branches and the suite tests each against
 * two different viewers, so it needs a member sitting on each setting —
 * picked from the seed rather than hardcoded, because the generator
 * assigns visibility by weighted pick and a hardcoded slug goes stale the
 * first time a pool changes.
 *
 * `active_alumni` with no role but `alumni`: a student cannot resolve a
 * student's profile at all (`visibleStatusesFor`), and a target holding a
 * staff role would muddy which gate refused.
 */
function firstAlumnusWithVisibility(v: string) {
  const m = SEED.members.find(
    (x) =>
      x.status === 'active_alumni' &&
      !DEMO_IDS.has(x.id) &&
      x.privateContact?.visibility === v &&
      x.roles.every((r) => r.role === 'alumni'),
  );
  if (!m) throw new Error(`No alumnus in the seed has contact visibility "${v}". The suite cannot test that branch.`);
  return {
    slug: m.slug,
    id: m.id,
    fullName: m.fullName,
    /**
     * The literal strings the two-gate release test looks for.
     *
     * A regex sweep proves "no address shaped like an email"; these prove
     * "not *this* person's address", which is the assertion that survives
     * somebody changing the seed's email format.
     */
    email: m.privateContact.email,
    mobile: m.privateContact.mobile,
    rollNumber: m.rollNumber ?? null,
  };
}

const anyStudent = SEED.members.find((m) => m.status === 'active_student' && !DEMO_IDS.has(m.id));
if (!anyStudent) throw new Error('No active student in the seed.');

const anyAlumnus = SEED.members.find((m) => m.status === 'active_alumni' && !DEMO_IDS.has(m.id));
if (!anyAlumnus) throw new Error('No alumnus in the seed other than the demo accounts.');

// ---------------------------------------------------------------
// Events
// ---------------------------------------------------------------

const upcomingEvent = EVENTS.find((e) => e.published && new Date(e.startsAt) > SEED_NOW) ?? EVENTS[0]!;
const pastEvent = EVENTS.find((e) => e.published && new Date(e.startsAt) < SEED_NOW) ?? EVENTS[0]!;

/**
 * An event the demo alumnus actually holds a ticket for. `/events/:slug/ticket`
 * answers 404 without a registration, and a 404 would look like a refusal
 * in the matrix when it is nothing of the kind.
 */
const alumnusRegistration = EVENT_REGISTRATIONS.find((r) => r.memberId === sessions.alumni!.memberId);
const ticketEventSlug = alumnusRegistration
  ? (EVENTS.find((e) => e.id === alumnusRegistration.eventId)?.slug ?? upcomingEvent.slug)
  : upcomingEvent.slug;

// ---------------------------------------------------------------
// A job posted by somebody who is NOT the demo alumnus
// ---------------------------------------------------------------

/**
 * The whole point of the cross-poster test. `job.postedBy.id` is compared
 * against `session.memberId` in the applicants handler; a job the demo
 * alumnus happens to own would make the assertion pass for the wrong
 * reason. Applicants are required too — an empty list refuses with 422 on
 * the export path and would hide a 403 that never happened.
 */
const appsByJob = new Map<string, number>();
for (const a of JOB_APPLICATIONS) appsByJob.set(a.jobId, (appsByJob.get(a.jobId) ?? 0) + 1);

const foreignJob = JOBS.find(
  (j) => j.state === 'live' && j.postedBy.id !== sessions.alumni!.memberId && (appsByJob.get(j.id) ?? 0) > 0,
);
if (!foreignJob) throw new Error('No live job with applicants posted by somebody other than the demo alumnus.');

const ownJob = JOBS.find((j) => j.postedBy.id === sessions.alumni!.memberId);

const state: StateFile = {
  generatedAt: new Date().toISOString(),
  tenant: { id: tenantId, subdomain: SUBDOMAIN },
  cookieName: COOKIE_NAME,
  sessions,

  /** A cookie for the alumnus who posted `job.foreign`, so the positive half of the cross-poster test is real. */
  foreignPoster: {
    cookie: mint(foreignJob.postedBy.id),
    memberId: foreignJob.postedBy.id,
    fullName: foreignJob.postedBy.fullName,
  },

  ids: {
    memberSlug: anyAlumnus.slug,
    memberId: anyAlumnus.id,
    studentSlug: anyStudent.slug,
    studentId: anyStudent.id,
    studentRollNumber: anyStudent.rollNumber ?? '',
    ownSlug: byId.get(sessions.alumni!.memberId)?.slug ?? anyAlumnus.slug,

    visibilityPrivate: firstAlumnusWithVisibility('private'),
    visibilityAlumniOnly: firstAlumnusWithVisibility('alumni_only'),
    visibilityAllMembers: firstAlumnusWithVisibility('all_members'),
    visibilityOnAccept: firstAlumnusWithVisibility('on_accept'),

    jobId: foreignJob.id,
    jobPostedByOther: foreignJob.id,
    jobPostedByDemoAlumnus: ownJob?.id ?? null,

    eventSlug: upcomingEvent.slug,
    eventPastSlug: pastEvent.slug,
    eventTicketSlug: ticketEventSlug,
    hasAlumnusTicket: Boolean(alumnusRegistration),
    connectionId: CONNECTIONS[0]!.id,
    campaignSlug: CAMPAIGNS[0]!.slug,
    auditId: AUDIT_LOG[0]!.id,
    dataRequestId: DATA_REQUESTS[0]!.id,
    verificationId: VERIFICATION_CLAIMS[0]!.id,
    degreeRecordId: DEGREE_REGISTER[0]!.id,
    albumSlug: ALBUMS[0]!.slug,
    newsSlug: NEWS[0]!.slug,
    mentorTopic: MENTOR_TOPICS[0]!.id,
    departmentCode: 'CSE',
    batchYear: 2017,
    reportFramework: 'naac',
    tenantId,
    otherTenantId: (TENANTS.find((t) => t.id !== tenantId) ?? TENANTS[0]!).id,
  },

  /**
   * Every real contact string in the dataset.
   *
   * The leak detectors match a shape first (an email-looking token, a
   * roll-number-looking token) and then intersect against these. The
   * intersection is not optional tidiness — the branding studio renders
   * a *sample* directory row from the demo packs, complete with an
   * invented roll number and an `alumni@svu.example.ac.in`, and a
   * shape-only detector reports that as the vendor reading customer
   * data. One false positive in a suite like this is worse than none of
   * it: the next person learns to skim past a red test.
   */
  secrets: {
    emails: [...new Set(SEED.members.map((m) => m.privateContact.email).filter(Boolean))] as string[],
    mobiles: [...new Set(SEED.members.map((m) => m.privateContact.mobile).filter(Boolean))] as string[],
    rollNumbers: [...new Set(SEED.members.map((m) => m.rollNumber).filter(Boolean))] as string[],
  },

  counts: {
    members: SEED.members.length,
    alumni: SEED.alumni.length,
    students: SEED.students.length,
    jobs: JOBS.length,
  },
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
process.stderr.write(
  `[e2e] fixtures → ${OUT}\n` +
    `      ${Object.keys(sessions).length} role cookies, tenant ${SUBDOMAIN}, ` +
    `${state.counts.members} members, cross-poster job ${foreignJob.id} (${foreignJob.postedBy.fullName})\n`,
);
