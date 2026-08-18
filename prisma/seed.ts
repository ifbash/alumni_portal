/* eslint-disable no-console */
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  DEPARTMENTS,
  DEGREE_REGISTER,
  SEED,
  EVENTS,
  EVENT_REGISTRATIONS,
  JOBS,
  JOB_APPLICATIONS,
  CONNECTIONS,
  CAMPAIGNS,
  DONATIONS,
  TENANTS,
} from '../src/lib/data/seed';

/**
 * Load the fixture dataset into Postgres.
 *
 * Fixture mode and database mode must show the same portal. Everything
 * that gets demonstrated, screenshotted or reviewed comes out of
 * `src/lib/data/seed.ts`; this script is how that same data reaches a real
 * database, so the first time the app runs against Postgres it is not also
 * the first time anyone has seen it with data in it.
 *
 * Run it against a scratch database, a reviewer's environment, or a new
 * college's instance before their own register arrives. Never against a
 * live tenant — see the production guard below.
 *
 *     DATABASE_URL=... npx tsx prisma/seed.ts
 *
 * (`prisma db seed` would run it too, once package.json carries
 * `"prisma": { "seed": "tsx prisma/seed.ts" }`. It does not today.)
 *
 * Idempotency: every primary key is a UUIDv5 derived from the row's
 * natural key — roll number, department code, event slug — under a
 * namespace that includes the tenant subdomain. Re-running updates the
 * same rows rather than inserting a second copy, and a row keeps its id
 * even if the fixture generator is reseeded, so foreign keys survive.
 */

const TENANT = TENANTS.find((t) => t.subdomain === 'diet')!;

/**
 * Only DIET is imported.
 *
 * The fixture's second tenant ("demo") exists to prove the platform
 * console renders more than one row; it owns no members, events or jobs.
 * Importing it would create an empty college that someone then has to
 * explain.
 */

// ---------------------------------------------------------------
// Deterministic ids
// ---------------------------------------------------------------

/** RFC 4122 v5 — a hash, not a random. Same input, same uuid, forever. */
function uuid5(name: string): string {
  const h = createHash('sha1').update(`alumni-portal:${name}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const hex = h.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * `key` is the row's natural key wherever the database has one, and the
 * fixture's own id otherwise. The fixture ids are safe to lean on: the
 * generator runs off a fixed seed, so `job-3` is the same job on every
 * machine and every run.
 */
const idFor = (kind: string, key: string): string => uuid5(`${TENANT.subdomain}:${kind}:${key}`);

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

const date = (v: string | null | undefined): Date | null => (v ? new Date(v) : null);

function chunk<T>(rows: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

/**
 * Keep the first row per key, drop the rest.
 *
 * The fixture wraps its roll-number serial at 90 per branch, so a cohort
 * of 214 alumni reuses roll numbers — 4 rows among members and 42 in the
 * degree register at the time of writing. `UNIQUE (tenant_id,
 * roll_number)` is right and the fixture is the thing that is wrong, but
 * inventing a roll number to get past the constraint would put a
 * fabricated identifier in the table the whole verification flow treats as
 * authoritative. Dropping the duplicate is the honest option; the count is
 * printed so it does not pass unnoticed.
 */
function dedupe<T>(rows: T[], key: (row: T) => string, label: string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  let dropped = 0;
  for (const row of rows) {
    const k = key(row);
    if (seen.has(k)) {
      dropped++;
      continue;
    }
    seen.add(k);
    out.push(row);
  }
  if (dropped) console.warn(`  ! ${label}: skipped ${dropped} row(s) with a duplicate natural key`);
  return out;
}

const VERIFICATION_METHODS = [
  'auto_roll_match',
  'admin_manual',
  'hod_manual',
  'bulk_import',
  'placement_cell_import',
] as const;
type VerificationMethodName = (typeof VERIFICATION_METHODS)[number];

function verificationMethod(v: string | null): VerificationMethodName | null {
  return VERIFICATION_METHODS.includes(v as VerificationMethodName) ? (v as VerificationMethodName) : null;
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. In fixture mode there is nothing to seed.');
  }

  // Demo alumni in a college's production directory is not a bug anyone
  // gets to fix quietly — 8,000 real people share that table.
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'yes') {
    throw new Error(
      'Refusing to seed with NODE_ENV=production. Set ALLOW_PRODUCTION_SEED=yes if this is genuinely a fresh instance.',
    );
  }

  const prisma = new PrismaClient();
  const tenantId = idFor('tenant', TENANT.subdomain);

  console.log(`Seeding ${TENANT.name} (${TENANT.subdomain}) → ${tenantId}`);

  try {
    await prisma.$transaction(
      async (tx) => {
        // ---------------------------------------------------------
        // Tenant. `tenants` is the one table without an RLS policy —
        // it is what the policies are keyed on — so it can be written
        // before the tenant context exists.
        // ---------------------------------------------------------
        await tx.tenant.upsert({
          where: { subdomain: TENANT.subdomain },
          create: {
            id: tenantId,
            name: TENANT.name,
            shortName: TENANT.shortName,
            subdomain: TENANT.subdomain,
            established: TENANT.established,
            fcraRegistered: TENANT.fcraRegistered,
            // getTenant() reads packId out of settings to pick the brand
            // pack in brands/. Without it the pack is looked up by
            // subdomain, which happens to work here and will not for a
            // college whose subdomain is not their pack name.
            settings: { packId: TENANT.packId ?? TENANT.subdomain },
            createdAt: new Date(TENANT.createdAt),
          },
          update: {
            name: TENANT.name,
            shortName: TENANT.shortName,
            established: TENANT.established,
            fcraRegistered: TENANT.fcraRegistered,
            settings: { packId: TENANT.packId ?? TENANT.subdomain },
          },
        });

        /**
         * READ THIS BEFORE DEBUGGING AN EMPTY DATABASE.
         *
         * Every table below has row-level security keyed on
         * `app.tenant_id`. Nothing here works until that setting exists on
         * this connection:
         *
         *  - unset entirely, `current_setting('app.tenant_id')` raises
         *    "unrecognized configuration parameter" and each statement
         *    dies with an error that says nothing about tenancy;
         *  - set to the wrong tenant, the policy's USING clause doubles as
         *    the WITH CHECK for INSERT (0001_init declares no separate
         *    WITH CHECK), so every insert is rejected and every select
         *    comes back empty.
         *
         * The trap is that a table owner bypasses RLS entirely — the
         * migration enables it but does not FORCE it. So a seed missing
         * this line runs perfectly against the Postgres on your laptop,
         * where you own the tables, and silently writes nothing against
         * the managed database where the app role does not. That is the
         * afternoon this comment exists to save.
         *
         * SET LOCAL, not SET: it is scoped to this transaction and cannot
         * leak the tenant to whatever picks up the connection next. Same
         * reasoning as withTenant() in src/lib/db/client.ts, which this
         * would use directly if it did not need a transaction timeout far
         * longer than any request should have.
         */
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);

        // ---------------------------------------------------------
        // Departments
        // ---------------------------------------------------------
        const departmentId = new Map<string, string>();
        for (const d of DEPARTMENTS) {
          const id = idFor('department', d.code);
          departmentId.set(d.code, id);
          await tx.department.upsert({
            where: { tenantId_code: { tenantId, code: d.code } },
            create: { id, tenantId, code: d.code, name: d.name },
            update: { name: d.name },
          });
        }
        console.log(`  departments        ${departmentId.size}`);

        // ---------------------------------------------------------
        // Degree register — the source of truth. Loaded first because
        // members reference it, and because most of it never will:
        // ~620 of these rows are graduates who have not signed up, which
        // is what the file actually looks like in month one.
        // ---------------------------------------------------------
        const degreeRows = dedupe(DEGREE_REGISTER, (d) => d.rollNumber, 'degree_register');
        const degreeId = new Map<string, string>();

        for (const d of degreeRows) {
          const id = idFor('degree', d.rollNumber);
          degreeId.set(d.id, id);
          const data = {
            name: d.name,
            departmentId: d.departmentCode ? (departmentId.get(d.departmentCode) ?? null) : null,
            programme: d.programme,
            admissionYear: d.admissionYear,
            yearOfPassing: d.yearOfPassing,
            sourceFile: d.sourceFile,
          };
          await tx.degreeRegister.upsert({
            where: { tenantId_rollNumber: { tenantId, rollNumber: d.rollNumber } },
            create: { id, tenantId, rollNumber: d.rollNumber, ...data },
            update: data,
          });
        }
        console.log(`  degree register    ${degreeRows.length}`);

        // ---------------------------------------------------------
        // Members — students and alumni in one table, as in production.
        // ---------------------------------------------------------
        const memberRows = dedupe(
          SEED.members.filter((m) => m.rollNumber),
          (m) => m.rollNumber!,
          'members',
        );
        const memberId = new Map<string, string>();
        for (const m of memberRows) memberId.set(m.id, idFor('member', m.rollNumber!));

        for (const m of memberRows) {
          const id = memberId.get(m.id)!;
          const data = {
            status: m.status,
            fullName: m.fullName,
            preferredName: m.preferredName,
            photoUrl: m.photoUrl,
            bio: m.bio,
            departmentId: m.departmentCode ? (departmentId.get(m.departmentCode) ?? null) : null,
            admissionYear: m.admissionYear,
            batchYear: m.batchYear,
            programme: m.programme,
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
            // Placement-side columns. They belong in the row; keeping them
            // out of an alumnus's view is the projection layer's job.
            cgpa: m.cgpa ?? null,
            placementStatus: m.placementStatus ?? null,
            verifiedAt: date(m.verifiedAt),
            verificationMethod: verificationMethod(m.verificationMethod),
            // A handful of alumni point at a register row that lost a
            // roll-number collision above. Null beats a dangling FK.
            degreeRegisterId: m.degreeRecordId ? (degreeId.get(m.degreeRecordId) ?? null) : null,
            lastLoginAt: date(m.lastLoginAt),
          };
          await tx.member.upsert({
            where: { tenantId_rollNumber: { tenantId, rollNumber: m.rollNumber! } },
            create: {
              id,
              tenantId,
              rollNumber: m.rollNumber!,
              createdAt: new Date(m.createdAt),
              // members.updated_at defaults to now() and has no @updatedAt
              // trigger behind it, so both paths have to say what they mean.
              updatedAt: new Date(m.createdAt),
              ...data,
            },
            update: { ...data, updatedAt: new Date() },
          });
        }
        console.log(`  members            ${memberRows.length}`);

        // ---------------------------------------------------------
        // Contacts — separate table on purpose. Field-level access
        // control is which table you joined, not which keys you
        // remembered to delete.
        // ---------------------------------------------------------
        // Two partial unique indexes guard this table — one on email, one
        // on mobile — so both have to be deduped or the whole transaction
        // aborts on a unique violation two hundred rows in.
        const contactRows = dedupe(
          dedupe(memberRows, (m) => m.privateContact.email ?? m.id, 'member_contacts.email'),
          (m) => m.privateContact.mobile ?? m.id,
          'member_contacts.mobile',
        );
        for (const m of contactRows) {
          const id = memberId.get(m.id)!;
          const c = m.privateContact;
          const data = {
            email: c.email,
            emailVerified: true,
            mobile: c.mobile,
            mobileVerified: true,
            linkedin: c.linkedin,
            github: c.github,
            portfolio: c.portfolio,
            visibility: c.visibility,
            whatsappOptIn: true,
            emailOptIn: true,
          };
          await tx.memberContact.upsert({
            where: { memberId: id },
            create: { memberId: id, tenantId, ...data },
            update: data,
          });
        }
        console.log(`  contacts           ${contactRows.length}`);

        /**
         * Role grants, employment and education have no natural key in the
         * database, so they go in with createMany + skipDuplicates against
         * a derived primary key. That is idempotent — a second run inserts
         * nothing — but it does not carry edits, unlike the upserts above.
         * These rows are append-shaped in the product too: a role is
         * granted and revoked, not edited in place.
         */
        const roleRows = memberRows.flatMap((m) =>
          m.roles.map((r) => ({
            id: idFor('role', `${m.rollNumber}:${r.role}:${r.departmentCode ?? ''}`),
            tenantId,
            memberId: memberId.get(m.id)!,
            role: r.role,
            departmentId: r.departmentCode ? (departmentId.get(r.departmentCode) ?? null) : null,
          })),
        );
        for (const part of chunk(roleRows)) {
          await tx.memberRoleGrant.createMany({ data: part, skipDuplicates: true });
        }
        console.log(`  role grants        ${roleRows.length}`);

        const employmentRows = memberRows.flatMap((m) =>
          m.employment.map((e) => ({
            id: idFor('employment', e.id),
            tenantId,
            memberId: memberId.get(m.id)!,
            company: e.company,
            designation: e.designation,
            industry: m.industry,
            location: e.location,
            startedOn: date(e.startedOn),
            endedOn: date(e.endedOn),
            isCurrent: e.isCurrent,
          })),
        );
        for (const part of chunk(employmentRows)) {
          await tx.employmentHistory.createMany({ data: part, skipDuplicates: true });
        }

        const educationRows = memberRows.flatMap((m) =>
          m.education.map((e) => ({
            id: idFor('education', e.id),
            tenantId,
            memberId: memberId.get(m.id)!,
            institution: e.institution,
            qualification: e.qualification,
            field: e.field,
            startedOn: date(e.startedOn),
            endedOn: date(e.endedOn),
          })),
        );
        for (const part of chunk(educationRows)) {
          await tx.educationHistory.createMany({ data: part, skipDuplicates: true });
        }
        console.log(`  history            ${employmentRows.length} employment, ${educationRows.length} education`);

        // ---------------------------------------------------------
        // Events
        // ---------------------------------------------------------
        const eventId = new Map<string, string>();
        for (const e of EVENTS) {
          const id = idFor('event', e.slug);
          eventId.set(e.id, id);
          const data = {
            title: e.title,
            description: e.description,
            venue: e.venue,
            startsAt: new Date(e.startsAt),
            endsAt: date(e.endsAt),
            departmentId: e.departmentCode ? (departmentId.get(e.departmentCode) ?? null) : null,
            studentEligible: e.studentEligible,
            alumniOnly: e.alumniOnly,
            capacity: e.capacity,
            ticketPrice: e.ticketPrice,
            published: e.published,
          };
          await tx.event.upsert({
            where: { tenantId_slug: { tenantId, slug: e.slug } },
            create: { id, tenantId, slug: e.slug, ...data },
            update: data,
          });
        }

        /**
         * The fixture's `registeredCount` is a headline number — 341 for
         * the annual meet — while it carries at most 24 actual rows per
         * event. The database gets the rows that exist. A dashboard that
         * counts registrations will therefore read lower here than in
         * fixture mode, and it is the database that is telling the truth.
         */
        const registrationRows = EVENT_REGISTRATIONS.filter(
          (r) => eventId.has(r.eventId) && memberId.has(r.memberId),
        ).map((r) => ({
          id: idFor('event_registration', r.id),
          tenantId,
          eventId: eventId.get(r.eventId)!,
          memberId: memberId.get(r.memberId)!,
          guests: r.guests,
          amountPaid: r.amountPaid,
          checkedInAt: date(r.checkedInAt),
          createdAt: new Date(r.createdAt),
        }));
        for (const part of chunk(registrationRows)) {
          await tx.eventRegistration.createMany({ data: part, skipDuplicates: true });
        }
        console.log(`  events             ${EVENTS.length}, ${registrationRows.length} registrations`);

        // ---------------------------------------------------------
        // Jobs
        // ---------------------------------------------------------
        const postableJobs = JOBS.filter((j) => memberId.has(j.postedBy.id));
        const jobId = new Map<string, string>();

        for (const j of postableJobs) {
          const id = idFor('job', j.id);
          jobId.set(j.id, id);
          const data = {
            postedBy: memberId.get(j.postedBy.id)!,
            title: j.title,
            company: j.company,
            location: j.location,
            isInternship: j.isInternship,
            description: j.description,
            applyUrl: j.applyUrl,
            state: j.state,
            closesOn: date(j.closesOn),
          };
          await tx.jobPosting.upsert({
            where: { id },
            create: { id, tenantId, createdAt: new Date(j.createdAt), ...data },
            update: data,
          });
        }

        const applicationRows = JOB_APPLICATIONS.filter(
          (a) => jobId.has(a.jobId) && memberId.has(a.applicant.id),
        ).map((a) => ({
          id: idFor('job_application', a.id),
          tenantId,
          jobId: jobId.get(a.jobId)!,
          memberId: memberId.get(a.applicant.id)!,
          note: a.note,
          createdAt: new Date(a.createdAt),
        }));
        for (const part of chunk(applicationRows)) {
          await tx.jobApplication.createMany({ data: part, skipDuplicates: true });
        }
        console.log(`  jobs               ${postableJobs.length}, ${applicationRows.length} applications`);

        // ---------------------------------------------------------
        // Connections — the student-to-alumni valve. Every attempt is a
        // row, which is what makes rate limiting and responsiveness
        // measurable at all.
        // ---------------------------------------------------------
        const connectionRows = CONNECTIONS.filter(
          (c) => memberId.has(c.from.id) && memberId.has(c.to.id) && c.from.id !== c.to.id,
        ).map((c) => ({
          id: idFor('connection', c.id),
          tenantId,
          fromMemberId: memberId.get(c.from.id)!,
          toMemberId: memberId.get(c.to.id)!,
          kind: c.kind,
          state: c.state,
          message: c.message,
          respondedAt: date(c.respondedAt),
          expiresAt: date(c.expiresAt),
          createdAt: new Date(c.createdAt),
        }));
        for (const part of chunk(connectionRows)) {
          await tx.connectionRequest.createMany({ data: part, skipDuplicates: true });
        }
        console.log(`  connections        ${connectionRows.length}`);

        // ---------------------------------------------------------
        // Donations. Seeded because the finance and FCRA screens need
        // something to segregate; the UI stays behind features.donations
        // until the college confirms FCRA registration.
        // ---------------------------------------------------------
        const campaignId = new Map<string, string>();
        for (const c of CAMPAIGNS) {
          const id = idFor('campaign', c.slug);
          campaignId.set(c.title, id);
          const data = {
            title: c.title,
            description: c.description,
            target: c.target,
            startsOn: date(c.startsOn),
            endsOn: date(c.endsOn),
            active: c.active,
          };
          await tx.donationCampaign.upsert({
            where: { tenantId_slug: { tenantId, slug: c.slug } },
            create: { id, tenantId, slug: c.slug, ...data },
            update: data,
          });
        }

        const donationRows = DONATIONS.map((d) => ({
          id: idFor('donation', d.id),
          tenantId,
          campaignId: d.campaignTitle ? (campaignId.get(d.campaignTitle) ?? null) : null,
          // The fixture keeps donors as names only. Linking them back to
          // member rows is deliberate work the donations module has to do
          // properly, not something to guess at from a display name.
          memberId: null,
          donorName: d.donorName,
          amount: d.amount,
          currency: d.currency,
          sourceCountry: d.sourceCountry,
          // Recorded at the point of collection, never derived later by a
          // report. FCRA segregation is structural.
          isForeignContribution: d.isForeignContribution,
          state: d.state,
          gateway: 'razorpay',
          gatewayRef: d.gatewayRef,
          receipt80gNo: d.receipt80gNo,
          createdAt: new Date(d.createdAt),
        }));
        for (const part of chunk(donationRows)) {
          await tx.donation.createMany({ data: part, skipDuplicates: true });
        }
        console.log(`  donations          ${CAMPAIGNS.length} campaigns, ${donationRows.length} donations`);

        /**
         * Not seeded, on purpose: audit_log, consent_records and
         * data_requests.
         *
         * Those three are records of things that happened. Writing
         * plausible rows into them produces an audit trail of actions
         * nobody took, consent nobody gave, and a DPDP statutory clock
         * counting down on a request nobody made. The admin console will
         * look emptier than in fixture mode; that is the correct emptiness.
         */
      },
      // About 1,450 round trips, most of them the degree register. The
      // default 5s interactive-transaction timeout is nowhere near enough
      // against a Mumbai database from a laptop, and the failure looks
      // like a hang rather than a timeout.
      { maxWait: 30_000, timeout: 15 * 60_000 },
    );

    console.log('Done.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
