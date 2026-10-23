# Community modules

Groups and chapters, a community feed, richer events with reunions and member
proposals, a business directory, a showcase of prominent alumni, invitations, a
help desk, and pages the college edits itself.

All eight are **off by default** in a brand pack and switched on per college.
DIET has all of them on. A route for a module a college has not taken is a
`404`, not a `403`: nothing is being withheld, the thing is not there.

Out of scope by decision: native apps, an executive-hiring concierge, a partner
job feed, and member-to-member messaging. Connection requests remain the only
way one member reaches another.

## What is here

| Module | Member surface | Staff surface | Flag | Capabilities |
|---|---|---|---|---|
| Groups and chapters | `/groups`, `/groups/[slug]` | `/admin/groups` | `groups` | `group.manage`; a group's leads run their own |
| Community feed | `/community`, noticeboard in each group | `/admin/community` | `feed` | `post.create`; `post.moderate` |
| Events (webinars, reunions, proposals) | `/events`, `/events/propose`, batch page | `/admin/events` (proposals queue) | `events` | `event.propose`; `event.create.any` |
| Business directory | `/businesses` | `/admin/businesses` | `businesses` | `business.list`; `business.moderate` |
| Showcase | `/showcase` | `/admin/showcase` | `showcase` | `showcase.submit`; `showcase.manage` |
| Invitations | `/invite` | none, by design | `invites` | any active member |
| Help desk and feedback | `/help`, the feedback button | `/admin/helpdesk` | `helpdesk` | any signed-in member; `helpdesk.manage` |
| Pages | `/p/[slug]`, public footer | `/admin/pages` | `pages` | `page.manage` |

Who holds what. Alumni: `post.create`, `event.propose`, `business.list`,
`showcase.submit`. Faculty: `post.create`, `event.propose`. The alumni cell and
the college admin: the six staff capabilities (`group.manage`, `post.moderate`,
`business.moderate`, `showcase.manage`, `helpdesk.manage`, `page.manage`).
**`platform_admin` holds none of them**, and `tests/vendor-boundary.test.ts`
pins that.

## The rules, and where each one lives

A rule that lives only in a handler is one forgotten call from being a leak, so
each of these is enforced in the read layer (every page and route goes through
it) and, where the database can say it, also as a constraint. The last column is
the test that fails if it is broken.

| Rule | Enforced in | Proved by |
|---|---|---|
| **Students never see a chapter.** A chapter is alumni in one place; a student who can walk into one can read an alumni roster, which is the directory's student tier by another door. They see interest groups only, and a chapter is a `404` to them, not a refusal. | `lib/data/groups.ts` `visibleTo`, `joinVerdict` | `community.test.ts` (groups); `community-leaks.spec.ts` |
| **A group's post is for the group.** Outside it the post does not exist: not in the feed, not by id, not in a tag count. | `lib/data/feed.ts` `visibleTo` | `community.test.ts` (feed) |
| **A hidden post is for moderators and its author.** The author sees that it was hidden and why. Reporters are anonymous: moderators get the reasons, never who wrote them, and authors get neither. | `feed.ts` `shape` | `community.test.ts` (hidden post) |
| **Business contact needs both gates.** The viewer is not a student *and* the owner chose to share. A role alone is never enough. | `lib/data/businesses.ts` `releasesBusinessContact`; DB `chk_business_contact_only_if_shared` | `community.test.ts`; `rls-community.test.ts`; `community-leaks.spec.ts` |
| **Only live listings are public.** Pending and refused ones are for the owner and the moderators. A listing that is not yours does not exist. | `businesses.ts` `visibleTo`; owner routes | `community.test.ts`; `community.routes.test.ts` |
| **Nothing about a person is published without a basis.** A member's agreement on record, or for a non-member a public source. Checked when an entry is saved, again when it is approved, and by the database. | `schemas/showcase.ts`; `showcase.ts` `publicationProblem`; DB `chk_showcase_published_needs_consent_or_source` | `community.routes.test.ts`; `rls-community.test.ts` |
| **A proposal is never published.** There is no request field that makes it so; approval is a separate staff action that flips publication and review state together. | `api/events/propose`; DB `events_unreviewed_unpublished` | `community.routes.test.ts`; `rls-community.test.ts` |
| **A join link is shown only to people who are registered, and to organisers.** Never in a list. | `lib/data/repo.ts` `shapeEvent` | `community.test.ts` (join link) |
| **An invitation is somebody's name and address, supplied by a third party who agreed to nothing.** The list is the inviter's own, ten a week. The reply is identical whether or not an address belongs to a member. The addresses are not copied into the audit log. | `lib/data/invites.ts`; `api/invitations` | `community.routes.test.ts` |
| **A ticket is a member describing their own account.** Readable by its author and by `helpdesk.manage`. To anyone else, staff included on the member door, it does not exist. Staff replies go through their own route, which records who. The audit log holds a length, never the text. Messages are append-only. | `lib/data/helpdesk.ts`; the two helpdesk routes; grants in `0002` | `community.routes.test.ts`; `rls-community.test.ts`; `community-leaks.spec.ts` |
| **A page is public, members-only, or a draft, and the three answers are indistinguishable from "no such page"** to someone who may not read it, so a page's existence is not an oracle. Markdown is a small subset rendered from an AST: no raw HTML, `javascript:` links dropped. | `lib/data/pages.ts`; `lib/content/markdown.ts`; DB `chk_cms_footer_is_public` | `community.test.ts`; `markdown.test.ts` (30 cases) |
| **The vendor holds none of this.** Refused at the route gate for every member and API surface here; `/p` is public by design. | `route-policy.ts` `refuseVendorOnly` | `route-policy.test.ts`; `vendor-boundary*.test.ts`; the e2e matrix |

The database half is migration `0002_community`. Its foreign keys to members
and groups are **composite** `(id, tenant_id)`, so a row in one college cannot
point at a member or group of another whatever the application does (a foreign
key check does not go through row-level security). The application role is
granted no `DELETE` on groups, posts, businesses, showcase entries or tickets,
and only `SELECT`/`INSERT` on ticket messages.

## Decisions that are the college's

These are defaults, chosen to be safe, and each is a one-line change.

- **Staff can attest a member's consent to be featured.** The curation form
  takes `consentConfirmed`, and the audit entry records who attested. The
  stricter alternative is to require the member to confirm in the portal before
  an entry about them can be published. A college that is nervous about DPDP
  purpose limitation may prefer it.
- **Chapters are for alumni only.** If a college wants students in the
  chapter of the city they will move to, that is a decision about the student
  tier, not about this module.
- **Reunion anniversaries** are 5, 10, 15, 20, 25, 30, 40 and 50 years
  (`MILESTONES` in `lib/community.ts`).
- **Limits.** Ten invitations a week; five event proposals a day with seven
  days' notice; three business listings a day, five at a time; ten posts a day, two
  links per post.
- **Who decides.** The alumni cell and the college admin. An HOD, who holds
  only the department grant, does not decide proposals or listings.

## Fixture mode

Everything renders in fixture mode and every write validates, guards, rate
limits and audits, then returns `persisted: false`, like the rest of the portal.
The seed (`lib/data/seed-community.ts`) is deterministic and draws nothing from
the shared generator, so adding or changing it never shifts the jobs and
connections generated after it.

The cast is documented where it is built: the demo alumnus leads
`hyderabad-chapter` and `startups-and-founders` (by approval, with two requests
waiting); the demo student is in two interest groups and no chapter; `post-13` is
hidden after two reports and `post-14` is live with one; one listing is pending
and one refused; three showcase entries are awaiting review, one declined.

A story is attached to a person by **what it claims** (`pickAlumnus`), not by
array index, and uses no pronoun: a name says nothing about how someone is
referred to. `community.test.ts` pins both.

## Not built

- **Comments and replies on posts.** The feed has posts, likes and reports.
- **Notifications.** A decision on a proposal, listing or showcase entry, a join
  request, or a ticket reply is visible on the member's own screens and nowhere
  else. WhatsApp and email are where members actually are
  (`CLAUDE.md`, decision 4); wiring these to the queue is the next step.
- **Sending an invitation.** The row is recorded and capped; the message waits
  on the email provider.
- **Persistence behind the writes**, as everywhere (`BACKLOG.md`, Sprint 3).
- **Image upload** for businesses and showcase entries (S3).
- **Staff tables on a phone.** At 390px a console table scrolls horizontally
  inside its card; the page itself does not overflow. Fine for a console, worth
  revisiting if staff work from phones.

## Checking it

    npx vitest run tests/community.test.ts tests/community.routes.test.ts \
                   tests/rls-community.test.ts tests/markdown.test.ts
    # production build, then the permission suite against it
    npm run build && npm start -- --port 3401
    E2E_BASE_URL=http://localhost:3401 npx playwright test

`community-leaks.spec.ts` is worth reading before changing any page here. For
these pages the status proves little (a refusal is delivered inside a `200`,
see `STATUS-CODES.md` §5.1 and §5.2), so it asserts on the **body**: a caller
who must not see a piece of text does not receive it, and a caller who must see
it does, so a page that is broken for everyone cannot pass as well guarded.
