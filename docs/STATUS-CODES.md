# HTTP status codes

What the portal puts on the status line when it refuses a request, where each
refusal is enforced, and — at the end — the cases that are still wrong, why
they cannot be fixed from the files this work owns, and the specific change
each one needs.

Nothing here is about *what* gets withheld. The guards work; no content leaks
in any of the cases below. This is about whether the status line agrees with
the body, which matters to four readers that never look at the body: shared
caches, crawlers, uptime monitoring, and any HTTP client that branches on
`response.ok` before it parses anything.

---

## 1. The contract

| Caller | Path | Status | Enforced in |
| --- | --- | --- | --- |
| anonymous | public page | `200` | — |
| anonymous | protected page | `307` → `/login?next=…` | middleware |
| anonymous | protected API | `401 {error, code}` | middleware |
| signed in, no console capability | `/admin`, `/platform` | `307` → `/dashboard` | middleware |
| signed in, no capability | protected API | `403 {error, code}` | route handler |
| signed in, capability held | anything | `200` | — |
| signed in, wrong screen inside a console | `/admin/*` | **`200`** ⚠ | page — see §5.1 |
| any | tenant feature is off | **`200`** ⚠ | page — see §5.2 |
| any | route does not exist | `404` | Next |

The two `200`s marked ⚠ are the known-wrong rows. They are wrong on the status
line only: the content is withheld correctly in both.

Every row above was re-measured on 2026-08-18 against a production build
(`next build && next start`) of an untouched copy of the tree, and every row
still holds. The observed codes are in §3.1. The ⚠ row for `/admin/*` is not
an edge: **70 of the 102 (role, screen) pairs that reach the console are
refusals, and all 70 answer `200`** — counted in
`tests/route-policy.test.ts`, "refuses more console screens than it serves".

---

## 2. Why middleware, and why only this much

Guards in this app live inside layouts and pages. `AppShell` calls
`redirect()`; feature-gated pages call `notFound()`; route handlers call
`require(session, capability)`.

For a page, all three run **too late to set a status**. `src/app/layout.tsx`
renders `<html>` from the tenant brand alone, and `src/app/loading.tsx` puts a
Suspense boundary immediately below it. React's shell is therefore complete —
and the response committed at `200` — as soon as the brand resolves, while
every route-group layout and page below it is still awaiting. A `redirect()`
or `notFound()` that lands after the commit can only be delivered inside the
stream, as a client-side navigation. That is why a gated page answers `200`
with `NEXT_HTTP_ERROR_FALLBACK;404` sitting in its body.

The root file is the *outermost* such boundary, not the only one. Route groups
and individual screens add their own below it, and the commit happens at
whichever is highest — so deleting `src/app/loading.tsx` on its own moves
nothing under a group that has one of its own. Measured, per surface, in §4(a)
and §5.4.

Middleware runs before rendering starts, so what it returns *is* the response.
That is the entire reason the gate exists. It is emphatically **not** the
authorisation model — see the header of `src/lib/auth/route-policy.ts` — and
every page and route handler still guards itself.

The gate answers two questions and stops:

1. **Is there a validly signed session cookie on a request to a signed-in
   surface?** HMAC and expiry only. `readSessionMemberId()`.
2. **On the two prefixes that declare a capability requirement, does this
   member hold any capability that admits them to that console at all?**

Question 2 is deliberately coarse. It knows whether somebody belongs in a
console; it does not know, and must not learn, which screen inside it they may
open. A per-screen capability table in `route-policy.ts` would be a second
authorisation model that drifts from the real one silently, and the first
symptom of the drift would be somebody being let in.

### Resolving roles in middleware does not break the cookie design

The design rule is that roles are resolved from storage on every request and
never carried in the session cookie, so that revoking an HOD takes effect on
their next page load rather than whenever their cookie happens to expire.

The gate honours that rule rather than trading it away. It reads the member id
out of the signed cookie — the id is all that has ever been in there — and
resolves the grants from the same storage `getSession()` uses, on the same
request. Same source of truth, same freshness, nothing new trusted from the
cookie. Revocation latency is unchanged.

What it costs is a storage read, so the read is charged only where it buys a
status code:

- `/admin` and `/platform` carry `requiresAnyCapability` and pay for it.
- `/dashboard`, `/directory`, `/settings`, every other member route and every
  `/api` route ask a question the cookie alone answers, and read nothing.
- Static assets never reach the gate at all (the `matcher` excludes them, and
  `isAssetPath()` excludes them a second time).

The module holding member data is loaded through a dynamic `import()` inside
the gate, so a request to `/dashboard` does not evaluate it. Today
`findMemberById()` is an in-memory `Map` lookup in fixture mode — free. **When
the Postgres implementation lands this becomes a real query on every
staff-console navigation**, and that is the moment to add a short-TTL
role cache keyed on member id (or a `roles_version` column bumped by
`role.manage` writes) rather than to delete the gate. Console traffic is a
small fraction of requests and every one of those requests is about to do a
dozen reads inside the page, so the marginal cost is small — but it is not
zero and it should be measured, not assumed.

### Why `/admin` refuses with `307 → /dashboard` rather than `403`

Three reasons, in order of weight:

1. **It is what the app already intends.** `AppShell` redirects a member with
   no console surface to `/dashboard`. This change moves that decision in
   front of the render so it can carry a status; it does not invent a new
   refusal for people to be surprised by.
2. **There is nowhere better to send them.** `forbidden()` exists in Next
   15.5.23 but is gated behind `experimental.authInterrupts` and needs a
   `forbidden.tsx` to render. A middleware-synthesised `403` body would be the
   one unbranded page on a white-label portal.
3. **A dead end is a support ticket.** Somebody following a stale link to
   `/admin/verification` lands on their own dashboard rather than on a wall.

The redirect carries no `next` parameter, unlike the sign-in redirect: signing
in again is not what is missing, and carrying the console path forward would
bounce them straight back.

`/api` is different and keeps `403 {error: 'You do not have permission to do
that', code: 'forbidden'}` — byte-identical to what `AuthzError` →
`toResponse` produces, so a client can never tell a middleware refusal from a
handler's own. No API prefix currently declares a capability, because route
handlers already answer `403` correctly: `fail()` runs before anything is
streamed.

### What counts as "any business in the staff console"

`STAFF_CONSOLE_CAPABILITIES` is **derived**, not typed out:

```ts
CAPABILITIES.filter(cap => !capabilitiesFor(['student','alumni','faculty']).has(cap))
```

Every capability that no ordinary member holds. A hand-written list of the
capabilities the console screens happen to need would be wrong the first
afternoon somebody adds a screen — a finance officer holding only
`donation.reconcile` gets bounced off `/admin` by a gate that has never heard
of them, and the bug reads as "the console is broken for finance" rather than
"somebody forgot a line in route-policy.ts".

Deriving it from `permissions.ts` means a new staff capability admits its
holders automatically. The set currently resolves to 28 capabilities and
partitions the nine roles exactly:

| Refused | Admitted |
| --- | --- |
| `student`, `alumni`, `faculty` | `alumni_cell_operator`, `placement_officer`, `hod`, `finance`, `college_admin`, `platform_admin` |

`/platform` is gated on `tenant.provision` alone, which is `platform_admin`
and nobody else — exactly what `hasPlatformAccess()` tests before `AppShell`
redirects.

`tests/route-policy.test.ts` asserts the partition, asserts that
`holdsAnyCapability()` agrees with `can()` across the entire role ×
capability matrix, and asserts that only `/admin` and `/platform` cost a
lookup. The agreement test is the anti-drift device: a gate more permissive
than the page guard is theatre, and a gate stricter than it is an outage
caused by a status-code fix.

---

## 3. What was measured

Fixture mode, tenant `diet` unless stated, sessions minted with
`scripts/mint-session.ts`. **Before** on a clean dev server; **after**
confirmed on a clean dev server and on two independent production builds
(`next build && next start`).

### The five named cases

| Request | Before | After |
| --- | --- | --- |
| signed out → `/dashboard` | `307` → `/login?next=%2Fdashboard` | `307` → `/login?next=%2Fdashboard` |
| student → `/admin/members` | `200` (admin chrome + refusal card) | **`307` → `/dashboard`** |
| student → `/platform` | `200` | **`307` → `/dashboard`** |
| northgate → `/campus-events` | `200`, `NEXT_HTTP_ERROR_FALLBACK;404` in body | `200`, unchanged — see §5 |
| college admin → `/admin/members` | `200`, member rows | `200`, member rows |

### The console matrix, after

| Role | `/admin` | `/platform` |
| --- | --- | --- |
| student | `307` → `/dashboard` | `307` → `/dashboard` |
| alumni | `307` → `/dashboard` | `307` → `/dashboard` |
| faculty | `307` → `/dashboard` | `307` → `/dashboard` |
| hod (CSE) | `200` | `307` → `/dashboard` |
| placement officer | `200` | `307` → `/dashboard` |
| alumni cell operator | `200` | `307` → `/dashboard` |
| finance | `200` | `307` → `/dashboard` |
| college admin | `200` | `307` → `/dashboard` |
| platform admin | `200` | `200` |

### Nothing else moved

| Request | Before | After |
| --- | --- | --- |
| anonymous → `/api/directory` | `401` | `401` |
| student → `/api/admin/members/export` | `403` | `403` |
| college admin → `/api/directory` | `200` | `200` |
| student → `/dashboard`, `/directory` | `200` | `200` |
| anonymous → `/login`, `/privacy`, `/api/health` | `200` | `200` |
| anonymous → `/nope-not-a-route` | `404` | `404` |

### 3.1 The console re-measurement, 2026-08-18

Everything above was measured when the middleware gate shipped. The per-screen
row was re-opened later; this is what a production build of the unmodified
tree answers today. Sessions from `scripts/mint-all.ts`, tenant `diet`,
`next build && next start` on an isolated copy so a shared dev server could
not colour the result.

| Caller | Path | Observed | Note |
| --- | --- | --- | --- |
| hod | `/admin/roles` | **`200`** ⚠ | needs `role.manage`; no roles content in the body |
| finance | `/admin/roles` | **`200`** ⚠ | same shape |
| alumni cell operator | `/admin/branding` | **`200`** ⚠ | needs `tenant.configure` |
| hod | `/admin/verification` | `200` | entitled — correct |
| hod | `/admin` | `200` | entitled — correct |
| college admin | `/admin/roles` | `200` | entitled, full matrix rendered |
| college admin | `/admin/members` | `200` | entitled |
| student | `/admin/members` | `307` → `/dashboard` | middleware |
| hod | `/platform` | `307` → `/dashboard` | middleware |
| signed out | `/dashboard` | `307` → `/login?next=%2Fdashboard` | middleware |
| student | `/dashboard`, `/directory` | `200` | ordinary member routes |
| alumni | `/dashboard` | `200` | ordinary member route |
| platform admin | `/platform` | `200` | entitled |
| signed out | `/login` | `200` | public |
| signed out | `/nope-not-a-route` | `404` | Next |
| signed out | `/api/directory` | `401` | middleware |
| student | `/api/admin/members/export` | `403` | route handler |

What the `200` bodies actually contain is worth stating precisely, because the
next section corrects a claim about it. On `hod → /admin/roles` the response is
the console shell, and the flight stream carries a serialised
`Error: You do not have permission to do that` thrown at `guard.ts:94`. The
refusal card the reader eventually sees is rendered by
`src/app/(admin)/error.tsx` **on the client**, after the `200` has already
been committed and sent.

The `307` responses carry the full header set — the per-request CSP nonce and
the theme-boot script hash, `cross-origin-opener-policy`, the `next.config.ts`
headers, plus `cache-control: no-store` and `vary: cookie`. A cached "not for
you" served to the operator it *is* for is the same shared-proxy failure as a
cached "you must sign in" served to somebody who has signed in.

### One behaviour change worth flagging

A **faculty** member now gets `307 → /dashboard` on `/admin` where they
previously got `200`. That is the restoration of an intent, not a new rule:
`AppShell` already tries to redirect anybody whose admin nav is empty, and
faculty hold no staff capability. It never fired because the first item in
`ADMIN_NAV` (`Dashboard`, `/admin`) declares no capability, so `adminNav()`
never returns an empty array for anyone — see §6.

---

## 4. The investigation

Four options have been on the table across two rounds of this work. Each was
tested rather than recalled, and (a) and (b) were re-tested in the second round
because the first round's conclusions about them were partly wrong.

### (a) Can the guard be made to run before the shell flushes?

**Yes — but it takes three files, not one, and on its own it makes the console
worse.** Measured by removing `loading.tsx` files one at a time, restarting the
server and clearing `.next` between states, and re-probing. (Restarting is not
ceremony: `next dev` keeps a stale route tree when a file-convention file is
deleted under it, and an unrestarted server reports the old status. Two
measurements below were wrong until the restart was added.)

Three Suspense boundaries stack above a console page, and the shell — and with
it the status line — commits at the **outermost** one:

| State | hod → `/admin/roles` | What the status means |
| --- | --- | --- |
| untouched | `200` | committed before the guard ran |
| minus `src/app/loading.tsx` | `200` | `(admin)/loading.tsx` now commits it |
| …minus `src/app/(admin)/loading.tsx` | `200` | `(admin)/admin/loading.tsx` now commits it |
| …minus `src/app/(admin)/admin/loading.tsx` | **`500`** | nothing flushed first; the `AuthzError` reached the status line |

Only when all three are gone does anything below them reach the status line —
and what reaches it, with the guard unchanged, is a `500`.
Removing `src/app/loading.tsx` alone changes nothing for `/admin/*` — measured,
not assumed — and restoring it alone with the other two gone puts the case
straight back to `200`.

Three things follow.

1. The commit-point theory is exactly right, and it generalises. With the three
   boundaries gone, `notFound()` from a page returns a real `404`
   (northgate → `/campus-events`, measured), `redirect()` returns a real `307`,
   and `forbidden()` returns a real `403`.
2. Moving a guard into a route-group layout only escapes the boundaries *below*
   it. `src/app/(admin)/layout.tsx` sits above `(admin)/loading.tsx` but still
   under `src/app/loading.tsx`.
3. **The previous version of this section was wrong on its third point, and
   the correction matters.** It claimed `/admin/members` stayed at `200` with
   every `loading.tsx` removed because `src/app/(admin)/error.tsx` caught the
   `AuthzError` and rendered, and that "an error boundary that renders is a
   `200` by definition". It does not. With the boundaries gone and **both**
   error boundaries still in place, `hod → /admin/roles` answers **`500`**, and
   on a production build `alumni cell operator → /admin/branding` answers
   **`500`** as well.

   React does not run error boundaries on the server for the shell — when the
   shell throws, the stream is aborted and Next answers `500`. `error.tsx`
   renders on the *client*, from the serialised error in the flight payload,
   which is only possible because a Suspense boundary already flushed a `200`.
   The error boundary is therefore a **consequence** of the early commit, not
   its cause.

That correction is what turns (a) from "cannot help" into "necessary, and
dangerous alone": deleting the boundaries without also changing how the guard
signals converts every per-screen console refusal from `200` into `500`. A
`500` is not an improvement on a `200` here — it is the same lie with a pager
attached. See §5.1.

### (b) Does Next expose a way to set the status from a deeper segment?

`next@15.5.23` really does export `forbidden`, `unauthorized` and
`unstable_rethrow` from `next/navigation` — checked against the installed
package, not from memory.

They do not help on their own. `forbidden()` is:

```js
if (!process.env.__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS) throw new Error('…experimental…')
const DIGEST = HTTP_ERROR_FALLBACK_ERROR_CODE + ';403'
```

— the identical mechanism to `notFound()`, which produces `…;404`. We have
observed that mechanism fail to set a status once the shell has flushed: that
is precisely the `NEXT_HTTP_ERROR_FALLBACK;404` sitting inside northgate's
`200`. `forbidden()` would put `;403` in a `200` body instead. It also
requires `experimental.authInterrupts` in `next.config.ts` and a
`forbidden.tsx`, neither of which is in this change's scope.

`forbidden()` is still the right *eventual* answer for the per-screen case —
but only in combination with the flush fix.

**Re-tested end to end, 2026-08-18.** `forbidden()` was wired up for real in an
isolated copy — `experimental: { authInterrupts: true }`, a
`src/app/(admin)/forbidden.tsx`, and `/admin/roles` calling `forbidden()`
instead of `require()` — and probed in both directions:

| State | hod → `/admin/roles` |
| --- | --- |
| `forbidden()`, boundaries left in place | `200`, with `NEXT_HTTP_ERROR_FALLBACK;403` in the body |
| `forbidden()` + the three boundaries removed | **`403`** |

Both halves are load-bearing and neither works alone, exactly as predicted.

Two things that were *not* predicted, both good news:

- The `403` page renders **inside the console shell** — sidebar, verification
  queue, "Back to the portal", the tenant brand. The worry in §2 about "the one
  unbranded page on a white-label portal" applies to a middleware-synthesised
  body, not to `forbidden.tsx`, which is an ordinary page in the route group.
  So the "there is nowhere better to send them" argument that won for `/admin`
  does **not** carry down to the per-screen case: there is somewhere better,
  and it is a link on a page that still answers `403`.
- One `forbidden.tsx` in `(admin)` is enough for the whole group. Groups that
  never call `forbidden()` need nothing.

### (b′) Two stable-API alternatives, also measured

`authInterrupts` is experimental, and this is a product a college may
self-host and upgrade on its own schedule. Both stable alternatives were
measured in the same harness, with the same flush fix:

| Signal | hod → `/admin/roles` | Renders | Flag |
| --- | --- | --- | --- |
| `forbidden()` | `403` | new `(admin)/forbidden.tsx` | experimental |
| `notFound()` | `404` | existing `(admin)/not-found.tsx` | none |
| `redirect('/admin')` | `307` → `/admin` | console home | none |

`notFound()` is the cheapest honest answer and needs no new file at all —
`src/app/(admin)/not-found.tsx` already exists and its own header already
names this reader ("a screen that belongs to a capability this account does
not hold"). `redirect('/admin')` is the most consistent with §2, which chose
`307` for the console prefix for reasons that apply again one level down.

**The recommendation is still `forbidden()` → `403`.** The API half of this
app already answers `403` for precisely this condition, and §2's rule is that
a client must not be able to tell a page refusal from a handler refusal.
`404` is a deliberate untruth about a screen that exists and that the same
person may hold tomorrow, and it sends "the roles page is gone" to a support
queue. `307` hides the refusal from exactly the four readers this document is
written for.

The experimental flag is a real risk and needs naming: if a Next upgrade drops
`authInterrupts`, `forbidden()` reverts to throwing a plain `Error`, and a
plain `Error` in the shell is a `500` — a silent regression that no unit test
would catch. Pin Next, and land the change with a Playwright assertion on the
literal `403` so the upgrade fails CI rather than production.

### (c) Can middleware make a coarse role decision?

**Yes, and this is what shipped.** Middleware runs on the Node runtime here
(`runtime: 'nodejs'`, already load-bearing for `timingSafeEqual`) and can
import from `src/lib`. The design rule forbids roles *in the cookie*; it does
not forbid resolving them from storage, which is what the app does everywhere
else. Argued in §2, costed in §2, bounded to two prefixes.

### (d) Can the check move into a route-group layout instead?

**No — the layout cannot find out which screen was asked for.**
`src/app/(admin)/layout.tsx` is above `(admin)/loading.tsx`, so a throw from it
escapes two of the three boundaries and would need only `src/app/loading.tsx`
deleted to reach the status line. That half works. The half that does not: a
server layout is not told the path.

Dumping every header visible inside `(admin)/layout.tsx` on a document request
for `/admin/roles` returns exactly this, and nothing else:

    accept, content-security-policy, cookie, cross-origin-opener-policy,
    host, user-agent, x-forwarded-for, x-forwarded-host, x-forwarded-port,
    x-forwarded-proto, x-nonce, x-tenant-subdomain

No `next-url`, no `x-invoke-path`, no pathname in any form — those exist on RSC
navigations, not on the initial document. `usePathname` is client-side and runs
after the response has been sent. So the layout can refuse *the console*, which
middleware already does better and earlier, and can never refuse *a screen*.

Closing that would mean middleware forwarding the pathname as a request header
and a per-screen capability table reading it — the second authorisation model
§2 exists to refuse, rebuilt one segment lower down. The per-screen decision
belongs to the page, which is the only thing that knows which screen it is.

---

## 5. What is still wrong, and the exact change each needs

Every remaining class needs a change in files this work does not own — 5.3 is
one deletion away and 5.1 is six edits away, but neither set fits inside the
files either round of this work was given. They are listed with the specific
edit rather than a direction, so that whoever does own those files can make the
change without re-deriving it.

### 5.1 Per-screen refusals inside a console the viewer *is* admitted to

**Symptom.** An HOD requesting `/admin/roles` — which needs `role.manage`,
which they do not hold — gets `200`. So does an HOD on `/admin/branding`, a
finance officer on `/admin/roles`, and 67 other (role, screen) pairs. Confirmed
on a production build; see §3.1.

**Why middleware cannot fix it.** Answering it needs a per-screen capability
table in `route-policy.ts`, which is a second authorisation model that drifts
from `permissions.ts` silently. The gate is coarse on purpose. `tests/route-policy.test.ts`
now asserts this stays true: "does not answer any of it from the policy table"
fails if a per-screen rule is ever added there.

**Why a route-group layout cannot fix it either.** It is never told which
screen was requested — measured, §4(d).

**The change needed.** Six edits. All six are required; any proper subset
leaves the console in a worse state than it is in now. Verified as a set on a
production build: `hod → /admin/roles` answers `403` and renders a branded
refusal inside the console shell, while every row in §3.1 that should not move
does not move.

| # | File | Edit | In scope for this work |
| --- | --- | --- | --- |
| 1 | `next.config.ts` | add `experimental: { authInterrupts: true }` | no |
| 2 | `src/app/(admin)/forbidden.tsx` | new — the console's `403` page | no |
| 3 | `src/lib/auth/guard.ts` (or a page-side wrapper beside it) | a `requirePage()` that calls `forbidden()` where `require()` throws `AuthzError`; every page under `src/app/(admin)/admin` switches to it | no |
| 4 | `src/app/loading.tsx` | delete | **yes** |
| 5 | `src/app/(admin)/loading.tsx` | delete | no |
| 6 | `src/app/(admin)/admin/loading.tsx` and the per-screen `loading.tsx` under it | delete | no |

Row 3 must stay page-side. `require()` is also what route handlers call, and
`fail()` already turns its `AuthzError` into a correct `403` JSON body before
anything is streamed — that path works and must not be disturbed.

**Why the subsets are worse, not partial.**

- **4 alone** (the only row this work owns) changes nothing at all for
  `/admin/*` — measured `200` before and `200` after — and costs every route
  outside `(app)` and `(marketing)` its streamed skeleton. A cost with no
  benefit.
- **4 + 5 + 6 without 1–3** converts every per-screen refusal from `200` to
  **`500`**, measured. Worse: it pages somebody at 3am for an HOD clicking a
  link they were never entitled to click.
- **1–3 without 4–6** writes `NEXT_HTTP_ERROR_FALLBACK;403` into a `200` body,
  measured. Which is where we already are, one string richer.

That is why this is written down rather than half-done.

**Also worth fixing while there:** the copy in `src/app/(admin)/error.tsx`
currently reads *"this is a read that did not complete, not an authorisation
refusal. A refusal says 403 and names the capability."* That is false today —
authorisation refusals land in exactly that boundary, and nothing says 403.
Rows 1–3 make the sentence true by routing refusals past this boundary
entirely; until they land, the sentence should go.

### 5.2 Tenant feature gates

**Symptom.** `/campus-events` on the `northgate` pack (`publicLanding: false`)
returns `200` with `NEXT_HTTP_ERROR_FALLBACK;404` in the body. `/giving` for a
student on the `diet` pack (`donations: false`) does the same. `/` on
`northgate` returns `200` and a client-side redirect to `/login`.

**Why middleware cannot fix it, and must not try.** The feature flags hang off
the resolved tenant. In fixture mode that is a static lookup, but in DB mode
`getTenant()` reads the `tenants` row — the per-request query this middleware
exists without — and that row's `settings.packId` **may not equal the
subdomain**. Guessing the pack from the `Host` header is therefore a *wrong
answer* in DB mode, not a fail-open: a college with a custom pack id would
have its public events page 404'd by a gate consulting the wrong pack. Gating
the behaviour on `IS_FIXTURE` would make the status right in the demo and
wrong in production, which is the opposite of the point.

**The change needed:** the flush fix in 5.4, and nothing else. These pages
already call `notFound()` in the right place with the right argument. Removing
the Suspense boundaries above them was measured to turn northgate's
`/campus-events` from `200` into `404` with no other edit at all — re-measured
2026-08-18 and still true, and note that the boundaries in question here are
`src/app/loading.tsx` **and** `src/app/(marketing)/loading.tsx`, not the root
file alone.

This class is genuinely cheaper than 5.1: a page that already calls
`notFound()` needs no new signalling, so 5.4 really is the whole fix. That is
not true of 5.1, where 5.4 alone produces `500`s.

### 5.3 A deleted member with a still-valid cookie, on a non-console route

**Symptom.** A cookie whose HMAC verifies but whose member row no longer
exists gets `307 → /login` on `/admin` and `/platform` (the gate resolves the
row, finds nothing, and answers the anonymous way — matching `getSession()`),
`401` on `/api/*` (the handler resolves the session itself), and `200` on
`/dashboard`, where `AppShell`'s `redirect('/login')` lands after the flush.

**Why it is not fixed here.** Closing it in middleware means resolving the
member row on *every* protected route rather than on the two console prefixes
— precisely the per-request storage read §2 declines to pay for a status code.
It is the same class as 5.4 and disappears with the same fix. Verified
end-to-end, not inferred: a forged-but-correctly-signed cookie for
`mem-does-not-exist` produces exactly the codes above.

**It is also the cheapest of the three.** `AppShell` lives in each group's
`layout.tsx`, which sits *above* that group's `loading.tsx`, so the only
boundary in its way is the root file. Measured 2026-08-18: with
`src/app/loading.tsx` deleted and nothing else touched, the same forged cookie
on `/dashboard` answers **`307` → `/login`** instead of `200`, while
`(app)/loading.tsx` stays in place and member routes keep their skeleton. In
the same run `/admin/roles` stayed at `200` (§5.1 needs two more files) and
northgate's `/campus-events` stayed at `200` (§5.2 needs
`(marketing)/loading.tsx` as well).

So one deletion buys 5.3 outright. It should still be taken as part of the 5.4
decision rather than on its own — `(auth)` and `(platform)` have no group
`loading.tsx` to take over, so they lose their skeleton to it, and any guard
that throws an ordinary `Error` in a shell region newly exposed by the
deletion becomes a `500` rather than a `200`.

### 5.4 The flush fix

**The change:** every `loading.tsx` between the root and the guard must not
exist. A `loading.tsx` creates a Suspense boundary below its segment's layout,
and the response commits at the **outermost** such boundary. Deleting only
`src/app/loading.tsx` is not the fix for anything under a route group that has
its own — measured, §4(a).

The per-surface file lists, as they stand today:

| Surface | Must be deleted for that surface to carry a status |
| --- | --- |
| `/admin/*` | `src/app/loading.tsx`, `src/app/(admin)/loading.tsx`, `src/app/(admin)/admin/loading.tsx`, and the eleven per-screen `loading.tsx` files under it |
| `/platform/*` | `src/app/loading.tsx` alone — `(platform)` has no `loading.tsx` |
| `(marketing)` | `src/app/loading.tsx`, `src/app/(marketing)/loading.tsx` |
| `(app)` | `src/app/loading.tsx`, `src/app/(app)/loading.tsx`, and the per-screen files under it |

A per-screen `loading.tsx` re-opens the hole for its own screen only, which is
why the `/admin` list has to be exhaustive: leaving
`admin/members/loading.tsx` in place leaves `/admin/members` answering `200`
while its neighbours answer `403`, and a contract that holds for sixteen
screens and not the seventeenth is not a contract.

**The cost, honestly:** cold navigations lose the streamed skeleton and wait
for the guard instead of showing a frame. Deleting the root file alone is
close to free for `(marketing)` and `(auth)` — the root layout already awaits
`getTenantBrand()` before it can emit `<html>` — and `(app)` and `(admin)`
keep their own group skeletons. Deleting a group's files as well is not free:
`AppShell` resolves navigation, badges and notifications before the first
byte, and this is a portal used over patchy mobile data.

Time-to-first-byte was measured on production builds either side of the change
(fixture mode, warm, five samples each): `college_admin → /admin/members`
came out at 0.10–0.37 s with the boundaries gone against 0.20–0.42 s with them
in place. The ranges overlap and the ordering is the wrong way round, so the
honest reading is **no measurable TTFB penalty in fixture mode** — what is
actually lost is perceptual, a skeleton replaced by a blank beat. In DB mode
`AppShell`'s reads become real queries and this needs re-measuring before the
console files are deleted; do not carry the fixture-mode result forward.

That is a product decision — which pages may go blank for a beat in exchange
for an honest status — not a cleanup, which is why it is written down here
rather than done.

---

## 6. One shared-file bug found on the way

`src/lib/navigation.ts`: the first item of `ADMIN_NAV` is

```ts
{ label: 'Dashboard', href: '/admin', icon: 'chart' }
```

with **no `capability`**. `visible()` therefore keeps it for every active
member, `adminNav()` never returns an empty array, and so
`hasAdminAccess(session, pack)` is `true` for a student — and the
`if (variant === 'admin' && groups.length === 0) redirect('/dashboard')` in
`AppShell` has never fired for anybody.

Two consequences, both observed before this change:

- A student on `/admin/members` was served the **entire console sidebar** —
  verification queue, degree register, roles, audit log, data requests — around
  the refusal card. No member data, but a complete map of the staff console.
- `hasAdminAccess()` is also what decides whether the member top bar shows an
  "Admin" link, so every student and alumnus is being offered one.

The middleware gate now stops the request before any of that renders, so the
leak is closed at the front door. The nav bug is still a bug and should be
fixed at source: `/admin` needs a capability on its nav item, or `visible()`
needs to drop a group whose only surviving items are capability-free. That
file was not in scope for this change.

---

## 7. File map

| File | Role |
| --- | --- |
| `src/lib/auth/route-policy.ts` | The prefix table, the derived console capability set, the coarse decision, the refusal targets. Pure — no Next imports, fully unit-tested. |
| `src/middleware.ts` | Runs the gate, resolves the member for capability-gated prefixes, and applies the tenant header, CSP nonce and security headers to every response including refusals. |
| `tests/route-policy.test.ts` | 52 tests. Prefix matching, `next=` sanitisation, cookie signature, the capability gate's agreement with `can()`, and the size and shape of the §5.1 gap. |
| `src/lib/auth/guard.ts` | `can()` / `require()`. **The authority.** Middleware defers to it; it does not defer to middleware. |
| `src/lib/auth/permissions.ts` | The capability matrix the console set is derived from. |
| `src/app/api/_lib/http.ts` | `fail()` — how route handlers put a status on the line, which has always worked. |
