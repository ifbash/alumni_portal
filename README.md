# Alumni Portal

A multi-tenant alumni engagement platform for Indian engineering colleges,
built by [ifBash](https://ifbash.com). First tenant: Dhanekula Institute of
Engineering & Technology (DIET), Ganguru, Vijayawada.

One deployment serves many colleges. Each college gets its own subdomain,
its own colours and copy, and its own rows — isolated in Postgres by
row-level security rather than by remembering a `WHERE` clause.

## Two member cohorts, not one

Most alumni portals have exactly one kind of user: a graduate. This one has
two, and the second is the reason the first stays engaged.

- **Final-year students** search the directory, request mentorship and
  referrals, apply to jobs alumni post, and register for events. They never
  see contact details, never see the donations module, and cannot enumerate
  other students.
- **Alumni** get the full directory, post jobs, answer students, and give to
  campaigns.

Around them sit seven staff roles — faculty, HOD, placement officer, alumni
cell operator, finance, college admin, and the ifBash platform admin. Nine
roles, one capability matrix (`src/lib/auth/permissions.ts`), 37 named
capabilities. Route handlers ask for a capability and never inspect a role, so
adding or splitting a role is one table edit rather than a grep.

The whole product turns on one number: how many requests a student can send.
If 400 final-years can email 8,000 alumni without limit, the alumni disengage
within a month and the network is dead. That valve is `CONNECTION_LIMITS` in
`src/lib/config.ts`; the quota is computed server-side, never a client-side
hint.

## Run it in under a minute

```bash
npm install
npm run dev
```

Open <http://diet.localhost:3000>.

**No database, no migrations, no environment file, no network.** With
`DATABASE_URL` unset, `src/lib/config.ts` resolves `DATA_MODE` to `fixture`
and the whole portal runs off an in-memory dataset generated from a fixed
seed. `SESSION_SECRET` falls back to a development value in the same mode.

This is deliberate, and it is the product's best demo property. Fixture mode
is how the portal gets shown to a college that has not signed anything, how
the UI stays reviewable while the degree register is still stuck in the
examinations branch, and how permission tests will run in CI without a
container. Every screen must render fully in it — an empty state that only
appears because there is no data is a screen nobody has designed.

The data is shaped to be awkward on purpose: 214 alumni and 96 students,
834 degree-register rows of which most have no account attached, members with
no photo and no company, two people with the same name in the same branch and
year, and a verification queue with genuine ambiguity in it. "Now" is pinned
to 2026-08-17, so relative dates and screenshots do not drift between builds.

### Demo accounts

Nine fixed identities, one per role, defined in `buildSeed()` in
`src/lib/data/seed.ts`. There is no password — sign-in is email OTP, and in
fixture mode `OTP_ECHO` is on, so the code is written to the server log and
returned in the response instead of being emailed.

| Email | Role | What it proves |
|---|---|---|
| `student@diet.ac.in` | Final-year student | The student cohort exists in the IA. Contact blocks are withheld with a reason, the donations module is absent from navigation entirely, and students cannot search students. |
| `alumni@example.com` | Alumnus | The `member` projection tier: bio, city, industry and availability flags, but no roll number, CGPA or placement status. Posts jobs, mentors, gives. |
| `faculty.ece@diet.ac.in` | Faculty (ECE) | A role that reads both cohorts. Sees students, but `directory.view.cgpa` is not in its grant. |
| `hod.cse@diet.ac.in` | HOD (CSE) | Department scoping. Holds `verification.review.department` and still cannot see an ECE claim — the capability is not enough on its own. |
| `tpo@diet.ac.in` | Placement officer | Holds `directory.view.cgpa`, the only non-admin role that does. Can enumerate students, and moderates every job posting before it goes live. |
| `alumnicell@diet.ac.in` | Alumni cell operator | The day-to-day operator: verification queue, events, check-in. Deliberately has no bulk export — staff leave, and an exportable directory leaves with them. |
| `finance@diet.ac.in` | Finance | Donation reconciliation and reporting with **no directory access at all**. Capabilities are additive, so a role that does not need member data does not get it. |
| `admin@diet.ac.in` | College admin | Everything: bulk export (audit-logged with actor, scope and reason), role management, branding, rollover. The `privileged` projection tier. |
| `platform@ifbash.com` | Platform admin (ifBash) | The vendor account. Provisions tenants and reads audit logs, and cannot read member data — the SaaS operator is not automatically an insider. |

Signing in as any of these and comparing the *same* profile page is the
fastest way to understand the authorisation model. See [docs/DEMO.md](docs/DEMO.md).

### Multi-tenant, locally

The tenant is resolved once per request from the `Host` header
(`src/lib/tenant.ts`). Any `*.localhost` subdomain works without editing
`hosts` in Chromium and Firefox:

| URL | Resolves to |
|---|---|
| <http://diet.localhost:3000> | DIET — the first customer tenant |
| <http://ifbash.localhost:3000> | The house brand, brick and charcoal |
| <http://srivarsity.localhost:3000> | Demonstration pack: maroon, gold, serif, rounded, lifted |
| <http://northgate.localhost:3000> | Demonstration pack: monochrome, square, compact, flat |
| <http://localhost:3000> | Falls back to `DEFAULT_TENANT_SUBDOMAIN` (`diet`) |

Same code, same components, same seed data — four portals that do not look
like each other. A brand pack with no tenant row still resolves, so dropping
a JSON file into `brands/` is enough to preview a prospect's portal before
anyone provisions anything.

The localhost fallback is not available in production. There, an unresolved
host 404s rather than quietly serving the first college in the table.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next dev server on :3000 |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `next lint` |
| `npm run brand:check` | Validates and contrast-audits **every** pack in `brands/`. Exits non-zero on an error. Run this in CI — a customer's colours are data, and data ships without a code review. |
| `npm run brand:new -- --id <slug> --name "…" --primary "#…"` | Scaffolds `brands/<slug>.json`, validates it, prints the derived tokens and the two lines to add to the registry |
| `npm run check:branding` | Feeds eleven deliberately awkward seed colours (pale gold, neon lime, near-black) through the token engine and asserts the derivation still produces legible output |
| `npm run check:matcher` | Runs the degree-register matcher against nine hand-written claims — married surname, initials, transliteration, junk roll number, twins, impostor |
| `npm run db:generate` | `prisma generate` |
| `npm run db:migrate` / `db:deploy` / `db:studio` | Prisma migration and studio commands |
| `npm test` | Vitest. **Vitest is installed but there are no test files yet**, so this currently exits non-zero. The suites that belong here are listed in [BACKLOG.md](BACKLOG.md). |

## What is built, and what is not

Read this before drawing conclusions from a click-through.

**Built and exercisable today:** the Postgres schema (19 tables, RLS policies,
the annual rollover function), the capability matrix and guards, the projection
and contact-release layer, the degree-register matcher, the branding engine
end to end including the publish API, the design system, and a complete read
layer over realistic data.

**Not built:** nothing in the product writes. Connection requests, RSVPs, job
applications, verification decisions and profile edits are all reads of fixture
data; the branding publish endpoint is the only write path that exists end to
end. There are no auth route handlers — the OTP, session and rate-limit
primitives are written and have no callers. There is no email provider, queue,
object storage, payment gateway or WhatsApp integration; `.env.example` declares
the configuration and nothing reads it. There are no tests. The initial
migration has never been applied to a live database.

[BACKLOG.md](BACKLOG.md) has the ordered list, and
[docs/SECURITY.md](docs/SECURITY.md) §7 has the gaps a security reviewer would
raise.

## Moving to Postgres

Fixture mode is complete for reads. The database path is not, and the honest
statement of where the seam sits is this: **`src/lib/data/repo.ts` reads the
in-memory seed unconditionally.** Setting `DATABASE_URL` switches tenant
lookup (`src/lib/tenant.ts`) and saved branding (`src/lib/branding/resolve.ts`)
onto Prisma, and makes the audit writer persist; it does not yet move the
directory, events, jobs or verification queries. Writing that implementation
behind the same function signatures is the first item in the backlog.

When you do:

```bash
cp .env.example .env          # DATABASE_URL and SESSION_SECRET are required
npm run db:generate
psql $DATABASE_URL -f prisma/migrations/0001_init/migration.sql
DATA_MODE=db npm run dev
```

The initial migration is applied with `psql`, not `prisma migrate`, because it
contains row-level security policies, a generated column, trigram indexes and
a plpgsql function that Prisma cannot express. Never let `prisma migrate dev`
regenerate it — the RLS policies would be silently dropped and tenant
isolation would disappear with them.

Two things in that file are known not to apply cleanly to a live Postgres 15
yet; both are one-line fixes and both are in the backlog:

- `member_contacts.email`, `alt_email` and `tenant_branding.support_email` are
  `citext`, but only `pgcrypto` and `pg_trgm` are created.
- `chk_reconciler_not_creator` on `donations` uses a subquery, which Postgres
  does not permit in a `CHECK` constraint.

`DATABASE_URL` must point at an `ap-south-1` instance. India data residency is
a load-bearing decision, not a preference — it keeps DPDP cross-border
transfer out of scope entirely.

## Where to look

| File | What is in it |
|---|---|
| `CLAUDE.md` | Domain model, load-bearing decisions, and the rules that must not be relaxed |
| `docs/ARCHITECTURE.md` | Why each decision was made and what it prevents; request lifecycle; file map |
| `docs/WHITE-LABEL.md` | The full brand pack schema and how a new college is onboarded |
| `docs/DESIGN-SYSTEM.md` | The design contract every screen is written against |
| `docs/SECURITY.md` | DPDP posture, the authorisation model, and a frank list of known gaps |
| `docs/DEMO.md` | A twelve-minute walkthrough with the exact routes and accounts |
| `BACKLOG.md` | What is actually left, in order |

## Stack

TypeScript (strict) · Next.js 15 App Router · Tailwind 3 · PostgreSQL 15+
with Prisma · Zod at every route boundary · Vitest.

Planned and not yet wired: SES or Resend with bounce webhooks, BullMQ on
Redis, S3 in `ap-south-1`, Razorpay, WhatsApp Business API, Playwright for
permission boundaries.
