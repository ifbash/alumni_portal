# Alumni Portal

Multi-tenant alumni engagement platform. First tenant: Dhanekula Institute of
Engineering & Technology (DIET), Ganguru, Vijayawada, Andhra Pradesh.

Built by ifBash.

## What this is

A portal used by **two member cohorts** — final-year students and alumni —
plus faculty and several operational staff roles. It replaces a lapsed
Hoopstr (formerly Vaave) subscription.

Single college today, but built multi-tenant from the first migration.
There are hundreds of JNTUK/JNTUA-affiliated colleges in the same position.

## Load-bearing decisions

Do not change these without a deliberate discussion — everything else is
swappable.

1. **PostgreSQL with row-level security.** Tenant isolation is enforced in
   the database via `app.tenant_id`, not in application code. One forgotten
   `WHERE` clause must not be able to leak across colleges.
2. **Email OTP is the primary credential.** Mobile is captured and verified
   at profile completion, used for account recovery and WhatsApp — never as
   the primary login.
3. **India data residency.** Postgres and object storage stay in `ap-south-1`.
   This keeps DPDP cross-border transfer entirely out of scope.
4. **WhatsApp Business API is the real comms channel.** Email open rates on
   Indian alumni lists are poor. Design flows assuming WhatsApp.

## Stack

- TypeScript, strict
- Next.js 15 App Router, Tailwind
- API via Route Handlers (same repo)
- PostgreSQL 15+, Prisma (RLS policies in raw SQL migrations)
- Auth: email OTP / magic link, HTTP-only cookie session
- Queue: BullMQ + Redis
- Storage: S3 `ap-south-1`
- Email: SES or Resend — **bounce webhooks are required, not optional**
- Payments: Razorpay, UPI-first
- Validation: Zod at every route boundary
- Tests: Vitest, Playwright for permission boundaries

## Domain model

**One person, one row.** `members` holds students and alumni alike, keyed on
roll number, with a `status` enum that transitions:

    unclaimed → invited → pending → active_student → active_alumni

Students do **not** get a separate table. Splitting them means every
graduating batch becomes a manual migration. The annual rollover
(`rollover_batch()`) flips status; it is admin-triggered with a dry-run
preview, never automatic.

**Roles are a set, separate from status.** A person can be `alumni` +
`faculty` + `hod` of CSE simultaneously. Nine roles; see
`src/lib/auth/permissions.ts`.

**`degree_register` is the source of truth.** Loaded from the college
examinations branch. Exists for every graduate whether or not they sign up.
Verification is a match between a self-registration and this table. Without
it, every registration is a manual decision made against no evidence.

**Contact data lives in `member_contacts`, a separate table.** Field-level
access control is "which table did you join", not "did you remember to strip
columns in this serializer".

## Rules that must not be relaxed

- **Students never see alumni contact details.** Enforce at the query layer.
  If 400 final-years can email 8,000 alumni directly, the alumni disengage
  within a month and the network is dead.
- **Contact release requires two gates**: the viewer must be entitled *and*
  the owner must have consented via their visibility setting. Role alone is
  never sufficient — that is DPDP purpose limitation.
- **Bulk contact export is `college_admin` only**, audit-logged with actor,
  scope and reason. Not operator, not placement officer, not HOD.
- **No role reads private message bodies.** There is no capability for it,
  deliberately.
- **The vendor cannot read customer data.** `platform_admin` provisions
  colleges and configures branding, and holds exactly three capabilities:
  `tenant.provision`, `tenant.configure`, `audit.read`. No `profile.*`, no
  `directory.*`, no `member.export`, no `data_request.manage`. This is the
  central promise of selling the portal as a hosted product, and it is
  pinned by `tests/vendor-boundary.test.ts` — it broke once already, when
  the DPDP queue was gated on `tenant.configure`, which the vendor holds.
- **The directory is never anonymous.** See `requireDirectoryAccess()`.
- **Students never see the donations module.**
- **CGPA and placement status are placement-side only.** Never exposed to
  alumni — they post jobs here.
- **Donations carry `source_country` and `is_foreign_contribution` from day
  one.** FCRA segregation is structural. Do not build the donations UI until
  the college confirms FCRA registration status.

## The white-label seam

This is sold as a product, so the visual identity is data, not code.

A **brand pack** is one JSON file in `brands/` holding a customer's entire
identity: colour seeds, type, shape, assets, copy, feature flags, locale.
Onboarding a college is: write the file, add one line to
`src/lib/branding/registry.ts`, point a subdomain at it. There is
deliberately no component to touch.

Three rules keep it that way:

1. **Seeds in, tokens out.** A customer supplies colours they can name
   from their own style guide. The 10-stop OKLCH ramps, hover states,
   tinted fills, dark mode and every text/background pairing are derived
   (`src/lib/branding/tokens.ts`) and contrast-checked on the way out.
   Colleges have a crest and a hex code, not a design system.
2. **No free-form CSS.** `overrides` accepts values for *named* tokens
   only. Unbounded theming makes every support ticket CSS archaeology.
3. **No component contains a colour.** Everything resolves through the
   token contract in `docs/DESIGN-SYSTEM.md`. One hardcoded hex breaks
   white-labelling for every customer at once.

`npm run brand:check` audits every pack. Contrast **errors** block
publication; warnings do not.

## Fixture mode

`DATA_MODE=fixture` (the default when `DATABASE_URL` is unset) runs the
whole portal against a seeded in-memory dataset — no database, no
migrations, no network. `npm install && npm run dev` is a working portal.

It is not a toy. It is how the product is demonstrated before a college
has signed anything, how the UI stays reviewable while the degree register
is still stuck in the examinations branch, and how permission tests run in
CI without a container. Every screen must render fully in it; an empty
state that only appears because there is no data is a screen nobody has
designed. The two modes sit behind one repository interface
(`src/lib/data/repo.ts`), so no page knows which it is talking to.

Nine demo accounts, one per role, are listed on the sign-in screen in
fixture mode. See `buildSeed()` in `src/lib/data/seed.ts`.

## Already built

    prisma/migrations/0001_init/      19 tables, RLS on all, rollover fn
    src/lib/auth/permissions.ts       capability matrix, 9 roles
    src/lib/auth/guard.ts             session, can(), department scoping
    src/lib/auth/session.ts           signed cookie, OTP issue/verify, rate limit
    src/lib/members/projection.ts     viewer-tiered field projection
    src/lib/verification/matcher.ts   degree register matching (pure)
    src/lib/branding/color.ts         OKLCH ramps, WCAG contrast, accessible-stop walk
    src/lib/branding/pack.ts          the BrandPack schema — the product's seam
    src/lib/branding/tokens.ts        pack → CSS custom properties, both modes
    src/lib/branding/registry.ts      the pack registry; one line per customer
    src/lib/data/                     DTOs, seeded fixtures, the read layer
    src/components/ui/                the kit — nothing in it holds a colour
    src/components/charts/            server-rendered SVG, token-coloured
    src/app/                          the full portal, admin console and API
    docs/DESIGN-SYSTEM.md             the binding contract for any new screen

Matcher thresholds (`AUTO_APPROVE_AT`, `REVIEW_AT`) are provisional.
Retune against the real degree register when it arrives;
`tests/matcher.manual.ts` has the harness.

## Not built

Real persistence behind the mutation endpoints (they validate, guard,
rate-limit and audit, then return `persisted: false` in fixture mode).
Email provider and bounce webhooks. S3 upload. Razorpay. WhatsApp Business
API. The Playwright permission suite. RLS integration tests. Hoopstr
migration.

## Blocked on the college

These are external dependencies on the critical path. Chase them.

- **Degree register** from the examinations branch: roll number, name,
  branch, year of passing, every batch since ~2013. Longest lead time.
  Everything about alumni verification is blocked on this.
- **Headcounts**: year of establishment, sanctioned intake by branch,
  current enrolment, staff count. Determines how much to invest in
  self-service verification.
- **FCRA registration status** of the college trust. Blocks donations.
- **Hoopstr data export** — contract lapsed; retention window may be closing.
- **Brand assets**: DIET crest in vector, official colour hex values.

## Conventions

- Route handlers call `require(session, 'capability')` at the top. They never
  inspect roles directly.
- Every admin mutation writes to `audit_log` with before/after snapshots.
- Consent is append-only in `consent_records` with the notice version.
- Directory responses are built by selecting *into* a projection, never by
  fetching a full record and deleting keys.

## Context worth knowing

A competitor has a working, DIET-branded portal at
`diet-connect-test.netlify.app`. Studied as a reference: their authorisation
layer is genuinely good (server-side enforcement, per-role field selection).
Their gaps — no student cohort in the IA, no degree register, no DPDP
endpoints, single admin role, publicly exposed directory — are the
differentiators to build against.
