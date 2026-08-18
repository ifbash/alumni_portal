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
tenant-scoped table has a `tenant_isolation` policy reading `app.tenant_id`,
set per transaction by `withTenant()` with `SET LOCAL`.

The application already filters by tenant. That is one layer, and one layer of
tenant isolation is not a layer of tenant isolation — the failure being
defended against is a single missing `WHERE` clause in code written eighteen
months from now by somebody who has not read this document.

`SET LOCAL` inside an interactive transaction rather than a plain `SET` is
required: with a connection pool, a plain `SET` persists on the connection and
leaks the tenant context into whichever request picks it up next, which is the
worst version of this bug because it is intermittent and load-dependent.

`withTenant()` rejects any tenant id that is not a 36-character UUID before
building the statement, because `SET LOCAL` takes no bind parameter and the
value is interpolated.

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

**The writer never throws.** A failed audit write must not roll back the
operation it describes — but it logs loudly to `console.error`, because silence
here is how an audit trail turns out to have been empty for six months.

**`reason` is required by convention for anything touching bulk contact data.**
"Who exported the alumni list and why" is the first question after a leak, and
an empty column is not an answer. It is a convention rather than a constraint,
which is a gap — see §7.

The `X-Forwarded-For` header is a list; only the first entry is the client
address and everything after it is a proxy we control, so the writer takes the
first element rather than storing the whole chain.

Only one call site exists today: the branding publish endpoint. Every mutation
added from here is expected to call it, and a code review that lets one through
without it has missed the point of the file.

---

## 4. Session handling

`src/lib/auth/session.ts`.

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

`robots: { index: false, follow: false }` is emitted for every page. Nothing is
indexed until a college explicitly opts in to a public marketing surface. The
directory sits behind authentication; a crawler that reaches it means something
is already wrong.

`next/image` remote patterns are limited to `**.amazonaws.com`. Tenant-supplied
brand imagery deliberately bypasses the optimiser via plain `<img>`, because an
allowlist wide enough to cover every college's own web host is an allowlist
that means nothing.

---

## 7. Known gaps

What a security reviewer would raise today. Ordered by how much it would cost
to be wrong about.

### Row-level security has never been proven to work

Three separate reasons it cannot be assumed:

1. **`FORCE ROW LEVEL SECURITY` is not set, and there is no dedicated
   application role.** Postgres exempts a table's owner from RLS policies.
   Prisma connects with a single `DATABASE_URL`, which in a default setup is
   the owner — in which case every policy in the migration is inert and tenant
   isolation is provided entirely by application code. Fix: create a non-owner
   role for the application, `GRANT` it the necessary privileges, and
   `ALTER TABLE … FORCE ROW LEVEL SECURITY` on every policied table.
2. **The policies use `current_setting('app.tenant_id')` in its one-argument
   form.** With the setting absent, that raises `unrecognized configuration
   parameter` rather than returning NULL, so the documented failure mode
   ("policies evaluate false and queries return nothing") is not what actually
   happens — the query errors. That is arguably a *safer* failure, but it is
   not the documented one, and code that catches broadly could turn it into a
   silent empty result. `current_setting('app.tenant_id', true)` is the form
   that matches the comment.
3. **There is no integration test.** The test that matters — two tenants, one
   table, confirm `withTenant(A)` cannot read B's rows and that a missing
   context yields nothing rather than everything — has not been written. It is
   the single most important test in this codebase and it does not exist.

Additionally, `withTenant()` has **no call sites**. The isolation mechanism is
written and unused.

### The initial migration does not apply to a live Postgres

Two statements fail:

- `member_contacts.email`, `member_contacts.alt_email` and
  `tenant_branding.support_email` are declared `citext`, but only `pgcrypto`
  and `pg_trgm` are created. `CREATE EXTENSION IF NOT EXISTS citext` is missing.
- `chk_reconciler_not_creator` on `donations` is a `CHECK` containing a
  subquery, which PostgreSQL does not permit under any circumstances, `NOT
  VALID` included. The separation-of-duties rule it expresses is correct and
  needs to move to a trigger or to application logic.

Both are one-line fixes. Their existence is proof that the schema has not been
run end to end, which is the honest thing to say about the whole database path.

### `tenants` has no RLS policy

Eighteen of nineteen tables are policied. `tenants` is not, and the omission is
deliberate — you must resolve a tenant before you can have a tenant context.
But `CLAUDE.md` claims "RLS on all", and that is one table optimistic. Anything
holding a raw connection can enumerate the customer list.

### The OTP store and the rate limiter are in-process maps

Both are `Map`s in module scope. On more than one instance:

- the single-use guarantee on an OTP does not hold, because instance B has
  never heard of the code instance A just consumed;
- the rate limiter's budget multiplies by the instance count, and an attacker
  who reconnects gets a fresh allowance.

Both are documented in the source as deliberately wrong for production and both
belong in Redis behind the same interface. Neither has a call site yet, so
today the exposure is zero — but the moment the auth routes land, this becomes
the first thing to fix.

### Nothing enforces authentication on the auth primitives

`issueOtp`, `verifyOtp`, `rateLimit` and `withTenant` have **no callers**.
There are no auth route handlers. The session, OTP and isolation code is
written, reviewed and unexercised. Do not read §4 and §5 as a description of a
running system.

### Two configuration hazards that fail open

- **`SESSION_SECRET` falls back to the literal string
  `fixture-mode-development-secret`** when `IS_FIXTURE` is true. The guard
  (`if (!SECRET && !IS_FIXTURE) throw`) protects the normal path, but a
  deployment that sets `DATA_MODE=fixture` — or simply forgets `DATABASE_URL` —
  signs real sessions with a value published in this repository.
- **`OTP_ECHO` returns the login code in the API response** when
  `IS_FIXTURE && NODE_ENV !== 'production'`. Two conditions both have to be
  wrong, but "forgot `DATABASE_URL`" and "did not set `NODE_ENV`" are the two
  most common deployment mistakes there are.

Both would be better as an explicit, loud `ALLOW_INSECURE_FIXTURE_MODE` opt-in
than as an inference from the absence of a database.

### Any `*.vercel.app` host collapses to the default tenant

`subdomainFrom()` in `src/lib/tenant.ts` treats `.vercel.app` as a development
host alongside `localhost`, and development hosts fall back to
`DEFAULT_TENANT`. A deployment reached on its `.vercel.app` URL therefore
serves the default tenant regardless of the subdomain in the address — every
college resolves to the same one. Fine for previews, actively dangerous if a
production deployment is ever reachable that way. It needs a custom domain, or
that branch needs to be gated on `NODE_ENV`.

### The repository's authorisation property has holes

Every function returning *member* data takes a `Session` and applies projection
internally. Several administrative reads do not:
`searchDegreeRegister()`, `getDegreeRegisterStats()`, `getEventRegistrations()`,
`getJobApplications()`, `getDonations()`, `getAuditLog()`, `getDataRequests()`,
`getTenants()` and `getMembersForAdmin()` take no session and trust the calling
page to have guarded. `getMembersForAdmin()` returns full contact records for
every member.

That is a defensible split — the page guards, and the design contract says so —
but it is the one place where "a page cannot ask for more than its viewer is
entitled to" is not literally true, and it is where a mistake would be worst.
The Playwright role matrix is what would catch a page that forgot.

`getNotifications(session)` ignores its session argument entirely and returns
the same list to everyone. Fixture-only today, and a hole to close before it
reads real rows.

### `directory.view.cgpa` is granted but unreachable

`tierFor()` promotes a viewer to the `privileged` tier on
`directory.view.contact`, and `cgpa`, `placementStatus` and `rollNumber` are
only in the `privileged` field list. The placement officer holds
`directory.view.cgpa` and **not** `directory.view.contact`, so they resolve to
the `member` tier and the projection never emits the fields their capability
names:

```
placement_officer (+faculty)   tier=member      view.cgpa=true
college_admin                  tier=privileged  view.cgpa=true
```

This fails safe — nothing leaks — but it means the capability matrix and the
projection disagree, and the role whose entire job is student academic data
cannot see it. The projection needs a `cgpa`-specific field set keyed off
`directory.view.cgpa` rather than one privileged tier keyed off contact access.
Whichever way it is fixed, it must not widen the tier: alumni post jobs here.

### `/admin/data-requests` is gated on `tenant.configure`

`platform_admin` holds `tenant.configure`, so the vendor account can open the
DPDP request queue — which lists member names. That contradicts the stated
position that the platform admin cannot read member data. The queue needs its
own capability.

### No CSRF defence beyond `SameSite=Lax`

`SameSite=Lax` blocks cookies on cross-site POST, which covers the common case.
There is no `Origin` or `Sec-Fetch-Site` check, and no token. Before the
mutation endpoints land, add an origin check — it is cheap, and `Lax` is a
browser default, not a control the application owns.

### No Content-Security-Policy, no HSTS

Neither header is set. CSP is not free here: the root layout uses two
`dangerouslySetInnerHTML` blocks — the tenant's brand CSS and the pre-paint
theme script — and both would need a nonce or a hash under a strict policy. It
is worth doing, and it is worth knowing it is not a one-line change.

### The audit trail is not tamper-evident

Rows are appended and never verified. There is no hash chain, no append-only
enforcement at the database level, and if the application role holds `DELETE`
on `audit_log` then anyone who can reach the connection can rewrite history.
For a system whose compliance argument rests on the audit trail, that is worth
closing: revoke `DELETE` and `UPDATE` from the application role at minimum.

### `reason` on a bulk export is a convention, not a constraint

`AuditArgs.reason` is optional in the type and nullable in the table. The rule
that a bulk contact export must carry a reason is enforced by nobody. When the
export endpoint is written, the reason should be a required parameter on that
endpoint and non-null in a partial index or check on the relevant actions.

### Session tokens cannot be revoked

The cookie is stateless and valid for fourteen days. Signing out deletes it in
that browser; a copied token remains valid until it expires. The mitigations
are real — roles and status are re-read on every request, so deactivating a
member cuts access immediately — but there is no way to invalidate a specific
token. A `sessions` table, or a per-member token epoch that the signature
covers, would close it.

`getSession()` also takes `tenantId` from the cookie payload without checking
it against the tenant resolved from the request host. Cookies are host-scoped
so the practical exposure is low, but a two-line assertion would remove the
class entirely.

### No dependency, secret or backup policy is documented

No SBOM, no dependency audit in CI, no documented key rotation for
`SESSION_SECRET`, no backup and restore procedure, and no incident response
runbook. For a system holding the personal data of every graduate of a college
since 2013, these are not optional documents — they are just not written yet.
