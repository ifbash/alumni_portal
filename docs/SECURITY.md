# Data protection and security

The posture, the mechanisms that implement it, and — at the end — a frank list
of what a security reviewer would flag today. The last section is the one
worth reading first if you are deciding whether to trust this.

Scope note: this describes an application that is partly built. Where a control
is designed but has no call site yet, it says so rather than implying coverage.

---

## 1. The DPDP position

The Digital Personal Data Protection Act, 2023 is the governing regime. Four
of its requirements shaped the schema rather than being layered on afterwards.

### Consent, with the notice version attached

`consent_records` is append-only. One row per consent event, never updated:

```
member_id · purpose · notice_version · granted · ip · user_agent · created_at
```

`purpose` is granular — `directory_listing`, `email_comms`, `whatsapp_comms`
are separate grants, because bundling them is precisely what the Act's
specific-and-informed requirement forbids. `notice_version` comes from
`NOTICE_VERSION` in `src/lib/config.ts` (currently `2026-08-01`).

The version is the defence. When the notice changes, the old consent is still
on file with the text it was given against — the question after an incident is
never "does this person consent" but "what were they told when they agreed",
and a boolean column cannot answer it. Withdrawal is a new row with
`granted = false`, so the history stays intact.

Consent is captured at profile claim. That flow is **not built** — see §7.

### Purpose limitation is the two-gate contact release

`releaseContact()` in `src/lib/members/projection.ts`. Contact details reach a
viewer only when **both** are true:

1. The viewer is entitled — by capability, by an accepted connection, or by
   being the owner.
2. The owner has consented, through the visibility setting on their own
   contact row: `private`, `on_accept`, `alumni_only`, or `all_members`.

Role alone is never sufficient. This is the single most commonly missed
requirement in this product category: implementations check the role, find it
adequate, and return the record. Being an administrator is a lawful basis for
some processing; it is not consent for disclosure of somebody else's mobile
number to a third party.

Two details worth noting. `all_members` still withholds the mobile number — a
phone number is never bulk-visible, whatever the owner ticked. And the
withheld state is *shown* rather than hidden, masked and with the reason,
because telling a student "released when this member accepts your request"
converts a support ticket into an understood boundary.

The structural backing is that contact data lives in its own table.
`member_contacts` is a separate join, so a field-level access decision is
"which table did I query", not "did whoever wrote this serializer remember to
delete the email key". Adding a column to `members` cannot widen a directory
response.

### Data-subject rights, and where they are served

| Right | Where it is served |
|---|---|
| Access / portability | `/admin/data-requests` queue; member-facing export endpoint **not built** |
| Correction | Members edit their own profile (`profile.write.own`); the queue tracks correction requests |
| Erasure | Deletion request → admin review → hard delete with an audit trail. **Not built** |
| Withdraw consent | A new `consent_records` row; visibility settings under `/settings` |
| Grievance | `copy.supportEmail` per tenant, surfaced on error and empty states |

The `data_requests` queue carries a due date thirty days from receipt, shown as
a countdown, so a request cannot quietly age past the statutory window. The
fixture data models the states (`received`, `in_progress`, `fulfilled`,
`refused`) and the clock; the endpoints that fulfil a request are scheduled
work, not shipped work.

### Retention, and the financial-records exception

Erasure is not unconditional. Donation records carry statutory retention under
tax law — an 80G receipt cannot be deleted because the donor asked — so the
deletion flow is specified as a hard delete of personal data *with a
carve-out for financial records*, which are retained under a separate lawful
basis and unlinked from the profile rather than destroyed.

`deceased` is a member status rather than a deletion. It suppresses all
outreach and retains the record, which is the only humane handling and the
only one that survives a family member calling the office.

`legacy_hoopstr_id` is retained permanently by design, so a member migrated
from the previous vendor can always be traced to their source record.

### No cross-border transfer

Postgres and object storage stay in `ap-south-1`. `.env.example` pins
`AWS_SES_REGION` and `S3_REGION` accordingly.

This is a design constraint rather than a control: by never moving personal
data out of India, the cross-border transfer provisions do not apply and there
is no adequacy assessment to maintain. Not needing an answer is cheaper than
having one.

Two dependencies sit outside that boundary today and should be stated plainly:
Google Fonts is fetched at runtime for packs with `type.source: 'google'`,
which discloses viewer IP addresses to Google. The house pack self-hosts its
typefaces (`type.source: 'local'`) and any tenant can do the same. Whichever
email, WhatsApp and payment providers are chosen must be assessed on the same
basis before they are wired in.

---

## 2. The authorisation model

Three layers, answering three different questions.

### Capabilities, not roles

`src/lib/auth/permissions.ts` holds nine roles and 37 named capabilities.
Route handlers call `require(session, 'member.export')`. They never inspect a
role.

The property this buys: adding, splitting or removing a role is one table edit.
There is no `role === 'admin'` to grep for, and no handler that quietly means
something different from the matrix. A member holding several roles gets the
union of their grants, which is what makes "an alumnus who is also faculty and
also HOD of CSE" a data question rather than a special case.

`can()` returns false for any status outside `active_student` and
`active_alumni`. A `pending` member is given no roles at all until verification
completes, so the restriction is structural rather than a conditional somebody
can forget.

**Department scoping is separate and additive.** `DEPARTMENT_SCOPED` names the
five capabilities where holding the grant is insufficient;
`canInDepartment()` compares the grant's department against the target's. An
HOD of CSE holding `verification.review.department` is refused an ECE claim.
Holding a capability and being in scope are two different checks and the code
keeps them apart.

### Projection, not serialisation

`src/lib/members/projection.ts`. Four tiers — `anonymous`, `student`,
`member`, `privileged` — each with an explicit field list. `project()` builds
the result by copying the tier's fields *into* a new object.

The direction matters. A serializer that fetches a full row and deletes keys
fails open: the next person to add a column ships it to everyone. Selecting
into a fixed list fails closed. `cgpa`, `placementStatus` and `rollNumber`
appear only in the `privileged` list, so no amount of refactoring in the
directory can expose a student's marks to an alumnus who posts jobs here.

`src/lib/data/types.ts` reinforces it: the UI consumes purpose-built shapes,
never Prisma row types. `MemberSummary` has no field an email could occupy, so
a list view cannot leak one through a careless spread.

### Row-level security as the second layer

Postgres enforces tenant isolation independently of the application. Every
tenant-scoped table has a `tenant_isolation` policy comparing `tenant_id` to
`app_tenant_id()`, which reads `app.tenant_id`, set per transaction by
`withTenant()` with `set_config(..., true)` (that is, `SET LOCAL`, with the
value bound as a parameter rather than interpolated).

The application already filters by tenant. That is one layer, and one layer of
tenant isolation is not a layer of tenant isolation — the failure being
defended against is a single missing `WHERE` clause in code written eighteen
months from now by somebody who has not read this document.

What makes the policies hold rather than merely exist, each pinned by
`tests/rls.test.ts` (which applies every migration to an in-memory Postgres and
acts as the application role):

- **It fails closed.** `app_tenant_id()` is `NULLIF(current_setting('app.tenant_id', true), '')::uuid`.
  With no tenant context it returns NULL, no row matches, and an INSERT is
  refused. The two simpler forms both fail badly: `current_setting('app.tenant_id')`
  raises when the setting was never set, and `current_setting(..., true)` alone
  returns `''` on a pooled connection that has run any earlier `SET LOCAL`
  transaction — and `''::uuid` is an error. The test reproduces both.
- **Policies carry an explicit `WITH CHECK`**, so writes are constrained by the
  same rule as reads and a row cannot be moved to another tenant.
- **`FORCE ROW LEVEL SECURITY`** on every policied table, because a table's owner
  is otherwise exempt.
- **The application connects as a non-owner role.** The migration creates
  `alumni_app` (`NOLOGIN`, no `BYPASSRLS`, owns nothing). `DATABASE_URL` must name
  a login role that is a member of it — not the role that runs migrations.
  `audit_log` and `consent_records` are `SELECT, INSERT` only for that role, so
  "append-only" is enforced by the database rather than by convention.
- **`SET LOCAL` inside an interactive transaction**, never a plain `SET`: with a
  connection pool a plain `SET` persists on the connection and leaks the tenant
  context into whichever request picks it up next — the worst version of this
  bug, because it is intermittent and load-dependent.

`tenants` is the one table without a policy, deliberately: a tenant has to be
resolved from the Host header before there is a tenant context to set.

`withTenant()` rejects any id that is not a canonical UUID before it reaches SQL.

### The deliberate absences

These are documented in the grants table and must not be "fixed" without a
decision:

- **No role below `college_admin` gets `member.export`.** Not the alumni cell
  operator who runs the directory day to day, not the placement officer, not
  the HOD. Staff leave, and an exportable directory leaves with them.
- **`directory.view.cgpa` is placement-side only.** Alumni post jobs on this
  portal. A searchable CGPA list would be a recruiting shortcut nobody agreed
  to give them.
- **Students never receive `donation.give` or `directory.search.students`.**
  The first is a product decision — asking a final-year for money on the portal
  meant to help them find work poisons it. The second prevents the student body
  enumerating itself through an alumni tool.
- **No role, at any level, can read private message bodies.** There is no
  capability for it, because the capability must not exist. A support workflow
  that requires reading a student's message to an alumnus is a workflow to
  redesign.
- **The directory is never anonymous.** `requireDirectoryAccess()` is the guard
  whose absence put a competitor's full alumni list on the open internet.
- **`platform_admin` — the vendor account — holds no member-data capability.**
  It provisions tenants and reads audit logs. The SaaS operator is not
  automatically an insider on a college's data.

---

## 3. Audit logging

`src/lib/audit/log.ts`. Every administrative mutation writes one row:

```
tenant_id · actor_id · actor_role · action · resource · resource_id
before (jsonb) · after (jsonb) · reason · ip · created_at
```

**Snapshots are whole, not diffs.** Reconstructing state from a diff chain
during an incident is exactly when you cannot afford the extra step.

**By default the writer does not throw.** A failed audit write must not roll
back the operation it describes — but it logs loudly to `console.error`, because
silence here is how an audit trail turns out to have been empty for six months.
**The exception is an action that releases data.** The bulk member export and the
applicant export pass `{ strict: true }`: if the entry cannot be written, the
file is not produced. "Who exported the alumni list" has to have an answer before
the list leaves.

**Writes go through `withTenant()`.** `audit_log` is under row-level security, and
an INSERT with no tenant context is refused — which, swallowed, would be an audit
trail that is silently empty.

**The vendor sees the event, not the person.** `platform_admin` holds
`audit.read` to see who did what, but snapshots, reasons and message previews
carry member data. `redactAuditEntry()` strips `before`, `after` and `reason` for a
vendor-only session, and the search runs only over what that session can see.

**`reason` is required by convention for anything touching bulk contact data.**
"Who exported the alumni list and why" is the first question after a leak, and
an empty column is not an answer. It is a convention rather than a constraint,
which is a gap — see §7.

The `ip` is the address counted from the right of `X-Forwarded-For` (see §5) and
is checked to be a real IP before it is written, because the column is `inet`.

Every administrative mutation route calls it. A code review that lets a new one
through without it has missed the point of the file.

---

## 4. Session handling

`src/lib/auth/session.ts`, with the cookie format and the signing secret in
`src/lib/auth/session-token.ts` — one module shared with the middleware gate, so
there is no second copy to drift.

**The signing secret.** `SESSION_SECRET` must be at least 32 characters in
production; the process refuses to start otherwise, so `changeme` is not a
configuration. Fixture mode with no secret falls back to a value published in
this repository, and a production build doing so logs a warning on first use —
acceptable for a throwaway demo on invented data, never for anything else.

**The credential is an email OTP.** Six digits from `randomBytes` — not
`Math.random()`, which is predictable enough that a login code drawn from it is
not a second factor at all. The code is HMAC-hashed with the email as salt and
stored hashed, verified in constant time, capped at five attempts, expiring in
ten minutes, and **deleted on first successful use**. A code that still works
after a login is a code that works for whoever else read the message.

Mobile numbers are captured and verified at profile completion and used for
recovery and WhatsApp. Never as the primary credential — SIM swap in this
market is not a theoretical attack.

**The cookie is `HttpOnly`, `SameSite=Lax`, `Secure` in production, path `/`,
14 days.** `HttpOnly` is not negotiable: a token readable by JavaScript is a
token that leaves with the first XSS.

**Signed, not encrypted.** The payload is `{ memberId, tenantId, issuedAt }`
and holds nothing secret. The signature is what stops someone editing the id to
somebody else's. The MAC comparison is length-checked and then
`timingSafeEqual` — a `===` on a MAC is a timing oracle, and forging a session
is the whole game.

**Roles are resolved from storage on every request, not carried in the
cookie.** Revoking an HOD takes effect on their next page load rather than
whenever their cookie happens to expire. The member's `status` is re-read on
the same path, so flipping an account to `lapsed` or `rejected` immediately
removes every capability — `can()` returns false for any non-active status.

---

## 5. Rate limiting

`rateLimit(key, limit, windowSeconds)` is keyed by **email and by IP**, and both
are necessary:

- **By email alone**, one attacker walks the entire member list from a single
  address, one OTP request at a time.
- **By IP alone**, a college computer lab behind one NAT gateway shares a
  quota, and an attacker locks out a whole batch of final-years by failing
  logins from the campus network — a denial of service that looks like the
  portal being broken during placement season.

Neither key alone produces an acceptable failure mode, so both are applied and
either can refuse.

**Which address is "the client".** `X-Forwarded-For` is a list that each proxy
appends to, so the *left* is whatever the client chose to send and the *right*
is what our own proxies added. `src/lib/client-ip.ts` counts from the right by
`TRUSTED_PROXY_HOPS` (default 1). Taking the leftmost entry — as this code once
did, in the rate limiter and the audit log both — lets any caller pick their
own bucket by sending a header. The audit `ip` is also validated as a real
address before it reaches the `inet` column, because a sentinel or forged value
rejects the whole row.

Both stores are in-process maps, swept for expired entries once a minute and
capped at 50,000 entries so a flood of fresh addresses cannot grow memory
without bound. They are still wrong for more than one instance (see §7).

A second, product-level limiter sits on connection requests
(`CONNECTION_LIMITS` in `src/lib/config.ts`): students get 5 open requests and
10 per month, alumni 25 and 60. This is the valve the whole network depends on.
If 400 final-years can message 8,000 alumni without limit, the alumni disengage
within a month and the directory stops being worth being in. The quota
computation is implemented (`getConnectionQuota`) and reports which limit was
hit, because "Limit exceeded" is not an answer a student can act on.

---

## 6. Transport and browser hardening

Set in `next.config.ts` for all paths: `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
and a `Permissions-Policy` disabling camera, microphone, geolocation and
interest-cohort. `poweredByHeader` is off.

Set per request in `src/middleware.ts`:

- **Content-Security-Policy** with a per-request nonce for scripts (plus a hash
  for the fixed theme-boot script), `object-src 'none'`, `frame-src 'none'`,
  `frame-ancestors 'none'`, `form-action 'self'`. `style-src` keeps
  `'unsafe-inline'`, for the reasons written next to it.
- **HSTS** (two years, `includeSubDomains`, `preload`) on requests that arrived
  over TLS only.
- **Cross-site request refusal** for state-changing requests. `SameSite=Lax` is a
  browser default, not a control this application owns, and it does not separate
  colleges: tenants are sibling subdomains, so a page on one college's host is
  *same-site* with another's and its credentialed POSTs carry the session
  cookie. `src/lib/auth/origin.ts` refuses any non-GET/HEAD/OPTIONS request whose
  `Sec-Fetch-Site` is not `same-origin`/`none`, or whose `Origin` does not match
  the `Host`. A caller that sends neither header is not a browser and has no
  ambient cookie to abuse.

Brand packs are customer-supplied and end up inside a `<style>` element, so the
schema is the trust boundary: colour overrides must match a colour grammar (no
`;`, braces, quotes, backslashes or angle brackets), font family names are
letters/digits/space/dot/underscore/hyphen, and every asset or link URL is an
https address or a site-relative path with no characters that can close a quote
or parenthesis. `safeForStyleElement()` is a second lock on the sink. `tenant_branding`
carries matching `CHECK` constraints. "No free-form CSS" is therefore enforced
on values, not only on the names of the tokens that may be overridden.

`robots: { index: false, follow: false }` is emitted for every page. Nothing is
indexed until a college explicitly opts in to a public marketing surface. The
directory sits behind authentication; a crawler that reaches it means something
is already wrong.

`next/image` remote patterns are limited to `**.amazonaws.com`. Tenant-supplied
brand imagery deliberately bypasses the optimiser via plain `<img>`, because an
allowlist wide enough to cover every college's own web host is an allowlist
that means nothing.

The sign-in `next` parameter is accepted only through `safeNextParam()`
(`route-policy.ts`), which refuses `//host` and `/\host` — the second is read
by browsers as the first, and a bare "starts with one slash" test lets it
through.

---

## 7. Known gaps

What a security reviewer would raise today, most consequential first. Items
fixed in the hardening pass that produced `tests/hardening.test.ts` and
`tests/rls.test.ts` are described in the sections above rather than listed here.

### The database read path does not exist yet

`src/lib/data/repo.ts` reads the in-memory seed unconditionally; there is no
Prisma implementation, and `withTenant()` has no call sites outside `logAudit`,
the branding route and the branding resolver. Row-level security is now proven
(`tests/rls.test.ts`) but nothing yet depends on it for member data. Porting the
repository is where the next class of bugs lives:

- **The repository is tenant-blind.** Seed members carry no tenant, so any
  fixture tenant serves the same dataset, and `/api/auth/verify` mints a session
  for `(member, host tenant)` without checking the member belongs to that tenant.
  In fixture mode that is how the demo tenants work; against a real database it
  would let a member of one college sign in on another's host. Look members up by
  `(tenant, email)` and compare tenants at sign-in as part of the port.
- **The schema cannot back the DTOs.** `members` has no `slug`; there are no tables
  for verification claims, notifications, sessions/OTP, comms, news or gallery;
  `job_postings` lacks skills, salary, experience and moderation-note fields;
  `data_requests` has no `due_at`. Reconcile before porting.
- **`displayNow()` is the fixture clock.** Every "overdue" and "due in N days" is
  measured against it. It cannot simply read the real clock — client components
  would hydrate against a different instant — so it needs a server-provided value.
- **Unscoped administrative reads.** `getMembersForAdmin()` (documented as
  unscoped; screens that *show* records use `getMembersForAdminView()`),
  `searchDegreeRegister()`, `getDonations()`, `getAuditLog()`,
  `getDataRequests()`, `getEventRegistrations()`, `getJobApplications()` and
  `getTenants()` take no session and trust the calling page to have guarded.
  `getNotifications(session)` ignores its session.
- **Cross-tenant foreign keys are not composite** on the `0001` tables, so a row's
  `tenant_id` can differ from its parent's and FK checks ignore RLS. Add
  `(id, tenant_id)` uniqueness and composite FKs. The `0002` tables already use
  them and `tests/rls-community.test.ts` proves a cross-college reference is
  refused; retrofitting `0001` is the same change on a larger set of tables.
- **Erasure vs the audit trail.** `consent_records.member_id` cascades on delete,
  and `audit_log.actor_id` has no `ON DELETE` rule. The application role cannot
  delete consent history, so erasure must anonymise the member row rather than
  delete it; decide that before building the erasure workflow.

### The OTP store and the rate limiter are in-process maps

Bounded now, but still per-instance. On more than one instance the single-use
guarantee on an OTP does not hold (instance B has never heard of the code
instance A consumed), the rate-limit budget multiplies by the instance count, and
an attacker who reconnects gets a fresh allowance. Both belong in Redis behind the
same interfaces. `issueOtp` also overwrites an unexpired code, so anyone can
invalidate the code a member has just been emailed by requesting another.

### Sessions cannot be revoked

The cookie is stateless and valid for fourteen days. Signing out deletes it in
that browser; a copied token remains valid until it expires. The mitigations are
real — roles and status are re-read on every request, closed accounts cannot
sign in, and `getSession()` binds the cookie to the tenant resolved from the
host — but there is no way to invalidate one specific token. A `sessions` table
or a per-member token epoch covered by the signature would close it. `/logout`
is a `GET`, so a cross-site navigation can sign someone out; it carries no data.

### Any `*.vercel.app` or `localhost` host collapses to the default tenant

`subdomainFrom()` (`src/lib/host.ts`) treats those as development hosts, and that
holds in production builds too (the e2e suite and Vercel previews are both
production builds). A production deployment also reachable on its `.vercel.app`
URL serves the default college there. Put real traffic on a custom domain.
`subdomainFrom()` also does not check the platform's base domain, so
`diet.anything.example` resolves to `diet`.

### Configuration that fails open

- Fixture mode with no `SESSION_SECRET` signs with a published value (warned
  about in production, not refused, because the permission suite runs against a
  production build in fixture mode). `OTP_ECHO` returns the login code in the API
  response when `IS_FIXTURE && NODE_ENV !== 'production'`. Both would be better as
  an explicit `ALLOW_INSECURE_FIXTURE_MODE` opt-in than as an inference from the
  absence of a database.

### Authorisation decisions that are choices, not bugs — confirm them

- **`on_accept` releases the full contact block to a student**, mobile included,
  once an alumnus accepts a request. `all_members` withholds mobile and
  excludes students. The two disagree about whether a phone number is ever
  released to a student.
- **`alumni_only` releases the whole contact block, mobile included, to every
  alumnus and faculty member**, against the "a phone number is never
  bulk-visible" rule stated for `all_members`.
- **`profile.read.any` is department-scoped.** An HOD reads their own branch's
  member records and no other. Previously unscoped by a documented decision;
  reverse it by removing the capability from `DEPARTMENT_SCOPED`.
- **Reports are readable by the vendor.** `audit.read` opens the aggregate
  NAAC/NIRF reports and their CSV export to `platform_admin` and `finance`.
  Documented as aggregate-only; it is still the college's own position on its own
  numbers.
- **`directory.search.students`** gives HODs, placement officers and faculty the
  alumni cohort of the directory as well as students (via `visibleStatusesFor`),
  and is not department-scoped in `searchDirectory`. The student tier also
  filters and facets on fields it does not display (city, industry, country).
- **Segment sends.** `comms.send.segment` is satisfied by any filter at all
  (`batchFrom: 1990, batchTo: 2100` is one), and news publishing with
  notifications bypasses the cap. The audience should have to be narrower than
  the whole list.
- **The FCRA flag is derived from a self-declared country.** Classify from the
  payment instrument and billing country before the donations module ships.
- **The claim route reveals whether an address is registered** (409
  `already_registered`) and whether a roll number has a claim pending. Documented
  and rate limited; still an enumeration oracle.
- **`GET /api/jobs/[id]/applicants?format=csv`** performs an audited export from
  a `GET`, so a link can trigger it with an attacker-chosen reason.

### Smaller items

- `fixtureWrite()` runs after `logAudit()`, so in database mode a mutation writes a
  real audit row and then answers 501 for an action that did not happen.
- Forms that call `fetch` directly toast success on `persisted: false`; they
  should go through `lib/client/api.ts`.
- `degree-register/search` pages the whole register without auditing each query.
- No request-body size limit on the public auth routes.
- Matcher: the examinations register names are matched as ASCII only (a
  non-Latin or accented name yields no tokens), and `name_normalised` in SQL keeps
  honorifics that the TypeScript normaliser strips.
- No SBOM, no dependency audit in CI, no documented `SESSION_SECRET` rotation, no
  backup/restore procedure, no incident-response runbook. `npm audit` was run
  during the hardening pass: the critical Next.js advisories are cleared at
  15.5.27; the remaining findings are Next's bundled PostCSS (fixed only by
  Next 16, a major upgrade) and Prisma's CLI-side `deepmerge-ts`.
- `noUncheckedIndexedAccess` is off; turning it on is a large, mechanical change
  that would find real unchecked array reads.
