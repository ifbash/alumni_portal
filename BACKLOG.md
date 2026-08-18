# Backlog

Ordered. Each item is scoped to be a single working session.

Context and constraints live in `CLAUDE.md` — read that first. This file is
only "what's next", and it changes weekly. Keep them separate.

**Where the project actually is.** The schema, the isolation model, the
capability matrix, the projection layer, the verification matcher, the branding
engine and the design system are written. The front end is finished: 78 pages,
39 route handlers, every interactive control wired to a guarded endpoint. What
is missing is everything between those endpoints and a real database — plus the
tests that would prove any of it holds.

Three facts that shape the whole list:

- `src/lib/data/repo.ts` reads the in-memory seed unconditionally. There is no
  Prisma implementation of the read layer, and `withTenant()` has no call sites.
- **Every write path exists and none of them writes.** This is a better
  position than it sounds, and worth stating precisely: each mutating endpoint
  parses its body with Zod, resolves the session, checks the capability, applies
  its rate limit, enforces its domain rules — FCRA segregation, the
  department-scope clamp, the last-`college_admin` guard, idempotency keys — and
  writes the audit entry. Then it calls `fixtureWrite()` and returns
  `persisted: false`, which the client surfaces honestly rather than as a green
  tick. The remaining work is the store, not the logic around it.
- The branding publish endpoint is the only path with a real persistence
  implementation behind it, and it is the model the others should follow.

---

## Sprint 1 — make the database real

Nothing else can be trusted until this sprint is done, because none of it has
ever run.

- [ ] **Fix the initial migration so it applies.** Two statements fail on
      Postgres 15: `citext` columns with no `CREATE EXTENSION citext`, and
      `chk_reconciler_not_creator` on `donations`, which is a `CHECK`
      containing a subquery — not permitted, `NOT VALID` included. Move the
      separation-of-duties rule to a trigger. Then actually run the file
      against a live database and confirm all 19 tables, the trigram indexes,
      the generated column and `rollover_batch()` exist.
- [ ] **Create a non-owner application role and force RLS.** Postgres exempts a
      table's owner from row-level security, and Prisma connects as the owner
      by default — which means every policy in the migration is currently
      inert. Create a dedicated role, `GRANT` it what it needs, revoke `DELETE`
      and `UPDATE` on `audit_log`, and `ALTER TABLE … FORCE ROW LEVEL SECURITY`
      on all 18 policied tables. Point `DATABASE_URL` at the new role.
- [ ] **Switch the policies to `current_setting('app.tenant_id', true)`.** The
      one-argument form raises `unrecognized configuration parameter` when the
      setting is absent rather than returning NULL, so the documented failure
      mode — policies evaluate false, queries return nothing — is not what
      happens today.
- [ ] **RLS integration test.** Two tenants, same table. Assert `withTenant(A)`
      cannot read B's rows, that a missing `app.tenant_id` yields zero rows
      rather than everything, and that the context does not survive the
      transaction into the next borrower of the pooled connection. **This is
      the single most important test in the codebase and it does not exist.**
- [ ] **Prisma implementation of `repo.ts`.** Same function signatures, same
      `Session` argument, same projection and contact-release rules applied
      internally, dispatched on `DATA_MODE`. Directory search first — it is the
      one with facets, paging and the trigram indexes. Build responses by
      selecting *into* the projection; never fetch a full record and delete
      keys.
- [ ] **Close the repository's session holes while porting.** `getMembersForAdmin()`
      returns full contact records and takes no session;
      `searchDegreeRegister()`, `getEventRegistrations()`, `getJobApplications()`,
      `getDonations()`, `getAuditLog()`, `getDataRequests()` and `getTenants()`
      are the same. `getNotifications()` ignores the session it is passed.
      Give each one a session and a capability check.
- [ ] **Reconcile `directory.view.cgpa` with the projection tiers.**
      `tierFor()` promotes to `privileged` on `directory.view.contact`, and
      `cgpa` / `placementStatus` / `rollNumber` are only in that tier — so the
      placement officer, who holds `directory.view.cgpa` and not
      `directory.view.contact`, can never actually see the fields their
      capability names. It fails safe and it is still wrong. The fix is a
      field set keyed off `directory.view.cgpa`, not a wider tier: alumni post
      jobs here and must never reach it.
- [ ] **A seed script for `db` mode.** The fixture generator already produces a
      realistic dataset; write it to Postgres so a staging environment is one
      command. Deterministic, idempotent, and it must not run against a
      database that already has members.

## Sprint 2 — authentication

The primitives in `src/lib/auth/session.ts` are written and have **no callers**.

- [ ] **Move the OTP store and the rate limiter to Redis**, behind the existing
      interfaces. In-process `Map`s mean two instances disagree about whether a
      code has been used, and the rate-limit budget multiplies by instance
      count. Do this before the routes, not after.
- [ ] **`POST /api/auth/request` and `/api/auth/verify`.** Zod at the boundary,
      rate limited by email *and* by IP, codes single-use and expiring. Issue
      the session cookie on success. Session shape must match `Session` in
      `src/lib/auth/guard.ts`.
- [ ] **`GET /api/auth/me`** — memberId, status, roles, departmentId.
- [ ] **Replace the fixture-secret and OTP-echo inferences with an explicit
      opt-in.** `SESSION_SECRET` currently falls back to a literal published in
      this repository whenever `IS_FIXTURE` is true, and `OTP_ECHO` returns the
      login code in the response under two conditions that are both common
      deployment mistakes. Make it an explicit `ALLOW_INSECURE_FIXTURE_MODE`
      that logs a warning on every boot.
- [ ] **Origin check on every mutating route.** `SameSite=Lax` is a browser
      default, not a control the application owns.
- [ ] **Gate the `.vercel.app` host fallback on `NODE_ENV`.** Today any
      `*.vercel.app` host resolves to `DEFAULT_TENANT` regardless of subdomain,
      so every tenant collapses to one.
- [ ] **Session revocation.** A `sessions` table or a per-member token epoch
      covered by the signature. Fourteen days of validity with no way to
      invalidate a specific token is too long to leave.

## Sprint 3 — writes

Every one of these calls `require(session, capability)` at the top and
`logAudit()` on success. No exceptions.

- [ ] **Profile edit** — `profile.write.own` / `profile.write.any`, including
      the contact visibility setting, which is the consent half of the release
      gate.
- [ ] **Connection requests** — send, accept, decline, withdraw, expire. Enforce
      `CONNECTION_LIMITS` server-side; the quota computation already exists.
      Contact is released only on accept, and the release must be the same
      `releaseContact()` path, not a second implementation.
- [ ] **Availability settings** — mentoring / referrals / speaking toggles.
- [ ] **Event RSVP and check-in** — capacity enforcement, guest counts,
      `event.checkin` for the desk on the day.
- [ ] **Job posting, moderation and application** — every posting through
      `pending_moderation`; the placement officer approves. Rejections carry a
      reason.
- [ ] **Verification decisions** — approve, reject, override, with the reviewer
      and note recorded, department scope enforced for HODs.
- [ ] **Consent capture at claim** — append to `consent_records` with
      `NOTICE_VERSION`, one row per purpose. Never an update.

## Sprint 4 — identity data

Blocked in practice on the degree register arriving; the loader can be built
against a synthetic file first.

- [ ] **Degree register CSV loader** — admin upload, column mapping, dry-run
      preview with row counts and rejects, then commit. Idempotent: re-running
      the same file must not duplicate.
- [ ] **Student batch import** — same shape, from the placement cell. Creates
      `unclaimed` members with roll number and department.
- [ ] **Profile claim flow** — email OTP, then `matchClaim()` against the
      register. Auto-approve, queue, or reject at intake. Retune
      `AUTO_APPROVE_AT` / `REVIEW_AT` against real data;
      `tests/matcher.manual.ts` is the harness.
- [ ] **Annual rollover UI** — dry-run preview against `rollover_batch()`, then
      execute. Admin-triggered only.
- [ ] **Role management UI** — grant and revoke, department-scoped, every change
      audited with before/after.
- [ ] **Member merge** — duplicate accounts are inevitable after an import.
      `profile.merge` exists; the flow does not.

## Sprint 5 — compliance endpoints

- [ ] **DPDP export endpoint** — a member downloads everything held on them, in
      a machine-readable format, including consent history and connection
      records.
- [ ] **DPDP deletion flow** — request, admin review, hard delete with an audit
      trail and a retention carve-out for financial records. An 80G receipt
      cannot be deleted because the donor asked; unlink it from the profile
      instead.
- [ ] **A capability for the data-request queue.** `/admin/data-requests` is
      gated on `tenant.configure`, which `platform_admin` holds — so the vendor
      account can read a queue listing member names. That contradicts the
      stated position that the platform admin cannot read member data.
- [ ] **Make `reason` enforceable on bulk export.** It is optional in
      `AuditArgs` and nullable in the table; the rule that a bulk contact export
      must carry one is enforced by nobody. Required parameter on the endpoint,
      constraint on the relevant actions.
- [ ] **Bulk contact export endpoint itself** — `college_admin` only, audit
      logged with actor, scope and reason. Not operator, not placement officer,
      not HOD.

## Sprint 6 — integrations

None of these are wired. `.env.example` declares the configuration and nothing
reads it.

- [ ] **Email provider (SES or Resend)** — OTP delivery first, then
      transactional notifications. Templates carry the tenant's brand.
- [ ] **Bounce and complaint webhooks.** Required, not optional. A hard bounce
      flips the member to `lapsed` and queues re-verification; a complaint
      revokes email consent with a `consent_records` row. Without this the
      directory rots silently and the sending domain's reputation goes with it.
- [ ] **BullMQ on Redis** — the queue everything asynchronous needs: sends,
      imports, exports, the nightly expiry of pending connection requests.
- [ ] **S3 upload in `ap-south-1`** — profile photos, event covers, and the logo
      upload the branding studio is missing. Presigned, size- and type-checked,
      served from a first-party path.
- [ ] **WhatsApp Business API** — needs a provider account per tenant. Consent
      is a separate `consent_records` purpose from email, and
      `member_contacts.whatsapp_opt_in` already exists. Gate on
      `features.whatsapp`.
- [ ] **Razorpay, UPI-first** — event ticketing before donations. Webhook
      verification, idempotent reconciliation, and `source_country` /
      `is_foreign_contribution` recorded at the point of collection.

## Test debt

Cross-cutting and overdue. Vitest is installed with **zero test files**;
`npm test` currently exits non-zero because there is nothing to run. Playwright
is not installed.

- [ ] **Playwright permission suite.** For each of the nine roles, assert the
      expected status on every route and every API. This is the regression net
      that stops a refactor quietly widening access, and it is the only thing
      that would catch a page which forgot to guard itself.
- [ ] **Unit tests for `permissions.ts` and `guard.ts`** — the grant union, the
      inactive-status refusal, and department scoping. Cheap, fast, and they
      pin the matrix against accidental edits.
- [ ] **Unit tests for `projection.ts`** — that no tier below `privileged` can
      emit `cgpa`, `placementStatus` or `rollNumber`, and that
      `releaseContact()` refuses on each of the four visibility settings.
- [ ] **Convert the two manual harnesses to assertions.**
      `tests/matcher.manual.ts` and `tests/branding.manual.ts` print output a
      human reads. Their expectations should fail a build.
- [ ] **Wire `npm run brand:check` into CI.** A customer's colours are data, and
      data ships without a code review.

## Hardening

- [ ] **Content-Security-Policy.** Not a one-liner: the root layout uses two
      `dangerouslySetInnerHTML` blocks — the tenant brand CSS and the pre-paint
      theme script — and both need a nonce or a hash.
- [ ] **HSTS**, once a custom domain is in place.
- [ ] **Assert the cookie's `tenantId` against the tenant resolved from the
      host** in `getSession()`. Two lines, removes a class.
- [ ] **Dependency audit in CI**, a documented rotation procedure for
      `SESSION_SECRET`, a backup and restore runbook, and an incident response
      note. None exist.

## Branding studio finish

The API and resolver are built (`src/app/api/admin/branding/route.ts`,
`src/lib/branding/resolve.ts`). What remains:

- [ ] **Widen `tenant_branding`.** `density`, `elevation`, `institutionName` and
      `shortName` are accepted by the form and applied in the preview, but have
      no columns, so they are silently lost on save. And the `radius` CHECK
      constraint permits only `none | subtle | rounded` while the pack schema
      allows `pill`, so publishing a pill radius violates the constraint.
- [ ] **Logo upload** — depends on S3 above.
- [ ] **Drop `--text-on-brand` from `OVERRIDABLE_TOKENS`**, or emit it. It is
      overridable today and nothing reads it; Tailwind's `text-on-brand` maps to
      `--button-primary-fg`.

---

## Blocked on the college

External dependencies on the critical path. Chase them; none of them get
shorter by waiting.

- **Degree register** from the examinations branch: roll number, name, branch,
  year of passing, every batch since ~2013. Longest lead time by far.
  Everything about alumni verification is blocked on it, and the matcher
  thresholds cannot be retuned without it.
- **Headcounts**: year of establishment, sanctioned intake by branch, current
  enrolment, staff count. Determines how much to invest in self-service
  verification versus a human queue.
- **FCRA registration status** of the college trust. Blocks donations entirely.
  Do not build the donations UI first — the payment flow must segregate foreign
  contributions at the point of collection, and that is a schema-level
  decision, not a report.
- **Hoopstr data export** — the contract has lapsed and the retention window may
  be closing. The migration itself is straightforward; `members.legacy_hoopstr_id`
  is already in the schema and retained permanently. Losing the export is not
  recoverable.
- **Brand assets**: the DIET crest in vector and the official colour hex values.
  `brands/diet.json` currently ships placeholders chosen to look plausible.
  When the real values arrive, that one file changes and nothing else does.
- **WhatsApp Business API provider account** — per tenant, and the college has
  to own it.

---

## Standing rules

Read `CLAUDE.md` before starting any item. If a task appears to require
relaxing one of the rules in it, stop and raise it rather than working
around it — those rules exist because the failure mode is a data leak or
a regulatory breach, not a bug.
