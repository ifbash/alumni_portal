# The twelve-minute demo

A walkthrough for a live call with a college. Every route, every account and
every thing to point at is listed. Nothing here needs a database — run
`npm run dev` and open <http://diet.localhost:3000>.

**Run it once before the call.** The seed is deterministic, so what you see in
rehearsal is what you will see on the call, and the numbers in a screenshot are
still true next week. The route list is maintained against
`src/lib/navigation.ts`.

Sign-in is email OTP with no password. In fixture mode the code is written to
the server log and returned in the response, so switching accounts takes about
ten seconds. Keep the terminal visible in a second window.

---

## What you are actually selling

A competitor has a working, DIET-branded portal running today. Their
authorisation layer is genuinely good — server-side enforcement, per-role field
selection — and you should say so if it comes up, because the college has
probably already seen it. Four things they do not have, and each one is a
segment of this demo:

1. **A student cohort in the information architecture.** Their portal is for
   graduates. Half the value of an alumni network is the final-years it feeds.
2. **Verification against the college's own degree register.** Without it,
   every registration is a human decision made against no evidence.
3. **A DPDP posture.** Consent with a notice version, purpose limitation,
   data-subject requests on a statutory clock.
4. **Nine roles instead of one admin.** An alumni cell coordinator and a
   registrar are not the same person, and neither should hold the export.

Everything below is arranged around those four.

---

## 0:00 — Open cold (1 minute)

**Route:** <http://diet.localhost:3000> · signed out

Say: *this is running on a laptop, with no database and no internet.*

Then open, in three tabs:

| URL | What to say |
|---|---|
| <http://diet.localhost:3000> | Navy and gold, "DIET Connect", Ganguru address in the footer |
| <http://srivarsity.localhost:3000> | Maroon, gold, a serif display face, rounded corners, lifted shadows |
| <http://northgate.localhost:3000> | Deep green, square corners, compact rows, no shadows, no public landing page |

**Point at:** they are the same code, the same components and the same data.
The difference is one JSON file each. Say the number out loud: adding a college
is a JSON file, two lines in a registry, and a DNS record.

Do not linger. This is the frame, not the pitch.

---

## 1:00 — The student cohort (2 minutes)

**Sign in as** `student@diet.ac.in` — Harika Nallamothu, final-year CSE, batch
of 2026.

**Route:** `/dashboard`, then `/directory`

**Point at, in order:**

- **The navigation.** Directory, Connections, Events, Jobs. No Giving. The
  donations module is not hidden by CSS for a student — it is not in the
  navigation tree and the route guards on it. Asking a final-year for money on
  the portal meant to help them find work poisons the product.
- **The directory filters.** Branch, batch, company, city, skills, and then the
  three that matter: *open to mentoring*, *open to referrals*, *open to
  speaking*. That last group is why a student is searching at all. Filter to
  mentoring and watch the count drop — those are the alumni who said yes in
  advance, so a student is never cold-mailing a stranger.
- **The cohort filter.** A student can filter alumni. A student cannot filter
  students: `directory.search.students` is not in their grant, so the
  enumeration simply is not available to them.
- **The sparse cards.** Scroll to a 2014 graduate with no company, no city and
  no photo. Say: *this is what most of a real directory looks like in year one,
  and it is what we designed against.* A demo dataset where everyone has a job
  title hides exactly the screens the college will spend its first six months
  looking at.

---

## 3:00 — The moment (2 minutes)

This is the segment that lands. Do not rush it and do not narrate over it.

**Still signed in as the student.** Search the directory for **Vamsi Krishna
Pothineni** — Senior Software Engineer at Amazon, CSE, batch of 2017, open to
mentoring and referrals, contact visibility set to `on_accept`. Click through
from the search result rather than typing a URL: the demo accounts keep the
slug they were generated with, so it will not match the displayed name.

**Point at the contact block.** It is not missing and it is not blank. It shows
a masked email and a masked mobile, a "Not shared" badge, and a sentence:

> Details are released once this member accepts your connection request. That
> is their choice, not a restriction the college applies to you.

Say what that sentence is doing. The data exists. The student is being told
that access is a permissions question, not a data-quality one — which is the
difference between them clicking "request an introduction" and them emailing
the alumni cell to say the directory is broken.

Then say the rule underneath it: **two gates**. The viewer must be entitled
*and* the owner must have consented. Role alone is never sufficient. That is
purpose limitation under the DPDP Act, and it is the thing most
implementations get wrong — they check the role and stop.

**Now sign out and sign in as** `admin@diet.ac.in` — Dr. Padmaja Vemulapalli,
Dean of Alumni Relations.

**Open the same profile.** Same URL, same page.

**Point at:** the contact block is now populated — real email, real mobile,
LinkedIn. And below it, fields the student's page did not have at all: roll
number and verification method. That is not the same page with more CSS. It is
a different projection: the field list is chosen by the viewer's tier
*before* the query, so a field the student is not entitled to never leaves the
server.

**Then go to** `/admin/audit`.

**Point at** the `member.export` row: actor, action, resource, reason — *"NAAC
criterion 5 submission — 1,214 rows, contact fields included"* — and the IP.
Say: bulk contact export is `college_admin` only. Not the operator, not the
placement officer, not the HOD. And it does not happen without a reason
attached, because "who exported the alumni list and why" is the first question
asked after a leak and an empty column is not an answer.

**Do not claim** that viewing one profile writes a log line. It does not, and
whoever is asking will check.

---

## 5:00 — Verification against the degree register (2 minutes 30)

**Sign in as** `alumnicell@diet.ac.in` — Sridevi Kandula, Alumni Cell
Coordinator. This is the person who will actually use the product every day.

**Route:** `/admin/degree-register`

**Point at:** 834 rows loaded from the examinations branch, and roughly a
quarter of them claimed. Say what the other three quarters are: graduates who
have not signed up. That unclaimed number is the metric the alumni cell is
actually trying to move, and it is the first number this product can give them
that a spreadsheet cannot.

**Route:** `/admin/verification`

**Point at a queued claim.** The screen shows the self-registration on one
side and the candidate register rows on the other, each with a confidence score
and the reasons behind it — *roll number exact match*, *name tokens overlap 2
of 3*, *surname order differs*, *year of passing matches*.

Say: an approver is never asked to decide against no evidence. That is the
whole design.

**Find the ambiguous one** — a claim with two candidates, the second scored
around 0.4 with *"same name, different roll number"*. Say: two people, same
name, same branch, same year. In a CSE cohort of 240 that is not rare. When the
top two candidates are within 0.15 of each other, a human decides regardless of
how high the top score is.

**If they want the detail**, run `npm run check:matcher` in the terminal on
screen. Nine hand-written claims, nine decisions:

- married surname change → review
- initials instead of the full name → auto-approve
- transliteration variant (Mohammed / Mohammad, Basheer / Bashir) → resolved
- roll number `01` → rejected at intake, before scoring
- right roll number, wrong person → review

Say the last one plainly: the thresholds are provisional and will be retuned
against the college's real register when it arrives. That harness is how.

---

## 7:30 — Nine roles, not one admin (2 minutes)

Move fast here. Three accounts, one point each.

**`hod.cse@diet.ac.in`** — Dr. Ramesh Chalasani, HOD of CSE.
**Route:** `/admin/verification`.
**Point at:** the queue is shorter. He holds `verification.review.department`
and the CSE scope; an ECE claim is not in his list and would be refused if he
reached it directly. Holding the capability is not enough — the target's
department is checked too. Say: this is the difference between "HOD" as a title
and "HOD of CSE" as a permission.

**`tpo@diet.ac.in`** — Srinivas Gollapudi, Training & Placement Officer.
**Route:** `/directory` with the cohort filter set to students, then
`/admin/jobs`.
**Point at:** he can enumerate students; an alumnus cannot. And every job
posting goes through moderation before it is live — open the rejected one and
read the reason aloud: *"third-party staffing listing, not a direct opening.
Placement cell policy is direct employers only."* Alumni post jobs on this
portal, and the placement cell decides what the students see.

Then say the rule that goes with the role: CGPA and placement status sit behind
their own capability, `directory.view.cgpa`, held by the placement side and
nobody else. Alumni never get it — a searchable CGPA list would be a recruiting
shortcut nobody agreed to give them.

**`finance@diet.ac.in`** — Anjaneyulu Bandaru, Accounts Officer.
**Point at the navigation.** There is no Directory link. Finance reconciles
donations and reads the audit log; it has no member-data capability at all, so
there is nothing to hide. Capabilities are additive — a role that does not need
the directory does not get it by accident.

**If they ask about the vendor:** sign in as `platform@ifbash.com`.
**Route:** `/platform`. Tenant provisioning, brand packs. Point at what is
absent: no directory, no member records, no profile capability. The SaaS
operator is not automatically an insider on the college's data.

---

## 9:30 — The DPDP position (1 minute)

**Sign in as** `admin@diet.ac.in`. **Route:** `/admin/data-requests`

**Point at:** every request carries a due date, thirty days from receipt, shown
as a countdown. A data-subject request cannot quietly age past the statutory
window because the screen will not let it.

Then say the three structural pieces, because this is where the schema is the
argument:

- **Consent is append-only, with the notice version.** `consent_records` stores
  purpose, notice version, grant or refusal, IP and timestamp — one row per
  event, never updated. When the notice changes, the old consent is still on
  file with the version it was given against. That is the defence.
- **Purpose limitation is the two-gate contact release** you already showed
  them at 3:00. It is the same mechanism, not a second policy document.
- **Retention has a financial exception.** A deletion request cannot erase a
  donation receipt; 80G records are retained under a different statute. That is
  designed in rather than discovered during an audit.

**Be straight about the gap.** The queue and the schema are built. The export
and hard-delete endpoints are not — they are the next sprint. Say it in that
order and move on; a customer who catches you overclaiming on compliance stops
believing the rest.

---

## 10:30 — Change one hex (1 minute 30)

Finish here. It is the segment people repeat to their colleagues.

**Route:** `/admin/branding` as `admin@diet.ac.in`

**Change the primary colour** to something obviously different — paste
`#7B1E23` — and watch the preview.

**Point at:** the entire portal moved. Buttons, links, focus rings, tinted
fills, badges, chart colours, the dark-mode palette. Nothing was picked by
hand. The ten-stop ramp is derived in OKLCH from that one value, and the tokens
that carry text walk the ramp until they clear WCAG contrast against the actual
background they will sit on.

**Then paste a bad colour** — a pale gold, `#E3C567`. Point at the brand text:
it does not become pale gold. It resolves to `#7f6601`, because the derivation
walked the ramp to find a step that is legible. Say: the registrar can paste
the letterhead yellow and get a working portal, not a support ticket.

**Then show the refusal.** The contrast report distinguishes errors from
warnings. A marginal accent is a warning and publishes. Body text nobody can
read is an error and does not — the publish endpoint returns a 422 with the
failing pairs and their ratios. If they ask why the line is there: blocking on
everything is the same as blocking on nothing, because the customer stops
reading the report.

**Close with:** every colour on every screen resolves through these tokens.
There is no hardcoded hex anywhere in the application, and `npm run brand:check`
fails the build if a pack ever violates it.

---

## What to say when they ask what is not built

Say it without hedging. Honesty is the brand, and the person asking is usually
the one who will sign.

**"Is this running on a database?"**
Not in this demo. It is running on a fixed in-memory dataset, which is why it
started in ten seconds on a laptop with no internet. The Postgres schema is
written — nineteen tables, row-level security policies, the annual rollover
function — and the query layer that reads from it is the next piece of work.
The interface is already shaped for it: every read function takes a session and
applies the permission rules itself.

**"Can we click through and it saves?"**
No. Everything you have seen is a read. Sending a connection request,
approving a verification claim, RSVPing to an event — those write paths are
built next, against the schema you are looking at. The one exception is
branding, which persists end to end today.

**"How do we get our alumni in?"**
Two imports, and both are on us to build: your degree register from the
examinations branch, and your final-year roster from the placement cell. The
degree register is the longer conversation and it is the thing to start
chasing now — everything about verification depends on it, and nothing else on
this list has a lead time measured in weeks.

**"When can we take donations?"**
When you tell us the trust's FCRA registration status. The module is off by
default and the columns that segregate foreign contributions are in the schema
from day one, because that segregation has to happen at the point of
collection, not in a report at year end. We will not turn it on before you
confirm.

**"What about WhatsApp / email / payments?"**
Not connected. Environment configuration exists for all three; the integrations
are scheduled work. On email specifically: we treat bounce handling as
mandatory rather than optional, because without it a hard-bounced address stays
in your directory forever and the list rots quietly.

**"How do we know the permissions actually hold?"**
Today, by reading the capability matrix — it is one file and it is short enough
to read in a meeting. The regression net is a Playwright suite that asserts,
for each of the nine roles, the expected status on every route and API. That
suite is not written yet, and it is the highest-value test in the backlog
because it is what stops a refactor quietly widening access six months from
now.

**"What have you actually already got?"**
The schema, the isolation model, the capability matrix, the projection layer,
the verification matcher, the branding engine, the design system, and a
complete UI running against realistic data. What is missing is the plumbing
between them and a real database — which is real work, and the least risky part
of the project.
