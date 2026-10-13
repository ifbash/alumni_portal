# Redesign, September 2026

What changed on 27–29 Sept 2026, how it was checked, and what is still open.
Nothing here is committed; review the working tree first.

## What changed

**The product speaks as the college, not as the software.** Every screen was
rebuilt around the person using it (alumni, final-year students, faculty and
staff, and colleges evaluating the portal) with the college's own name,
colours, crest, photos and video carried through `brands/<id>.json`.
Onboarding a college is still data only: no component holds a colour or a
tenant fact.

- **Public pages** (landing, sign-in, registration, about, contact, events,
  pending). Media-first: a hero image or video, campus photos and a sign-in
  photo when the pack supplies them, and a complete, deliberate page when it
  does not (DIET today). The DIET landing on a phone went from 7,111 px to
  3,152 px. "Claim your profile" is now "Alumni registration"; roll number
  stays mandatory, with help on where to find it.
- **All 71 signed-in screens.**
  - A new shell: the college band, one search (Ctrl K), an account menu, and a
    phone tab bar.
  - Role-aware homes for alumni, students and faculty, the directory, events,
    news, gallery, jobs, mentorship, profile and settings.
  - A staff console built around queues ("Today").
  - The platform console, which now wears the ifBash brand.
  - Across all of them: zero-count dashboards, mechanism essays, capability ids
    in copy and hardcoded tenant strings were removed.
- **Brand pack** (`src/lib/branding/pack.ts`). New media fields
  (`heroImage` now rendered, `heroVideo`, `campusPhotos`, `authImage`, focus
  points) and copy fields (`officeName`, `affiliationLine`,
  `rollNumberSources`, `reviewTurnaround`, `announcements`, `collegeMessage`,
  `shareText`, …), all optional. The college band and scrim tokens are derived
  and contrast-checked by `npm run brand:check`. The CSP allows `media-src
  'self' https:` for hero videos.
- **House brand.** `brands/ifbash.json` follows the September 2026 ifBash kit.
  On the house tenant (`ifbash.` / `demo.`) `/` is now a product showcase for
  colleges: live previews of three colleges rendered from their real packs,
  claims checked against the code, and a "Coming next" list.
- **Demo college.** `srivarsity` is now **Tamarind Grove University**
  (fictional). "Sri Vydehi University, Whitefield" was too close to a real
  institution. It carries six screened Unsplash/Pexels photos, credited in
  `public/brand/srivarsity/CREDITS.md`.
- **Sales deck.** `sales/`: one generic deck, 16 slides, as HTML (brand-kit
  engine) and PowerPoint. See `sales/README.md`.

## Security fixes (all pinned by tests)

1. **The vendor read member data.** A `platform_admin`-only session got 200
   with member names on /jobs, /news (including an obituary), /gallery tags,
   a profile's `<title>`, and `GET /api/jobs`. It is now refused at the route
   gate: 307 to /platform for pages and 403 for APIs (`refuseVendorOnly` rows in
   `src/lib/auth/route-policy.ts`).
2. **A college admin could grant or revoke `platform_admin`**, which is
   escalation from a tenant to the vendor. Both are now 422 `vendor_role`
   (`src/lib/auth/role-grants.ts`, `api/admin/roles`).
3. **Provisioning a college wrote its audit entry**, including the new admin's
   email, into whichever tenant the vendor happened to be browsing. The entry
   is now written in the new college's scope.
4. **`/directory/[slug]` metadata named the member** to roles the page refuses
   (finance). It now carries the same gate as the page.
5. **Event registration used the wall clock** while the pages use the fixture
   clock. After 24 Sept the page offered registration and the API refused it.
   Both now read `displayNow()`.
6. **The landing page showed public event registration counts.** Both public
   pages now go through `getPublicEvents()` (no counts, no alumni-only events).
7. **`cn()` (tailwind-merge) silently dropped `text-display-*` heading sizes**
   placed next to colour tokens.

## Verification (final state)

- `npx tsc --noEmit`: clean, e2e included. Three e2e specs with syntax errors
  that predate this work were repaired.
- `npx vitest run`: 455 passed (270 before).
- `npm run brand:check`: 0 errors.
- Full Playwright suite against the dev server: 237 of 241, then all re-run
  green. Three failures were the dev server restarting under load; the fourth
  was the clock bug in item 5 above.

To see it: `npm run dev`, then http://diet.localhost:3000 (the real college,
no media yet), http://srivarsity.localhost:3000 (the demo college with photos)
and http://ifbash.localhost:3000 (the showcase). The sign-in page lists the
nine demo accounts.

## Decisions only the owner can make

1. **Students and contact details.** A final-year student whose request is
   accepted by an alumnus with "on accept" visibility receives that alumnus's
   email and mobile (`projection.ts`, pinned by `projection.test.ts`).
   CLAUDE.md says students never see alumni contact details. Unchanged; slide
   10 of the deck describes the current behaviour.
2. Finance-only staff can read /jobs, /news and /gallery. Is that intended?
3. Pending members with no roles reach member pages on a session-only check,
   and /welcome has no route-policy row.
4. **Where the backend runs.** It is undecided: ifBash-hosted, or the front
   end handed to the college. The load-bearing decisions in CLAUDE.md assume
   ifBash hosts. If colleges run their own backend, the permission rules must
   ship as an API contract.
5. **DIET copy to confirm with the college:** the headline "Welcome back to
   DIET.", the office name ("alumni cell"), any affiliation line, and a review
   turnaround (none is promised until it is set). "Since 2009" was removed
   pending confirmation.
6. **The vendor has no audit scope of its own.** Its demo account is a
   relabelled DIET alumnus (`seed.ts`, `promote(alumni[10])`), so its own
   profile shows that alumnus's roll number and mobile. A platform-level
   audit sink and a synthetic vendor record would fix both. Separately,
   refused escalation attempts are not audited.
7. **A drone clip of a campus** (Pexels, licensed) was held back because the
   campus is recognisable. It is not in the repo.
8. **The pricing figures in the deck** are blanks for the owner to fill.

## Known follow-ups (not done)

- **The demo data is DIET-shaped and partly incoherent.**
  - Demo sign-in emails are `@diet.ac.in` on every tenant.
  - Tamarind Grove profiles list DIET as their college.
  - Staff are seeded as recent graduates.
  - Some names are mismatched or duplicated, and some emails are malformed.
  - Batch 2026 still shows as final year.

  This needs tenant-parameterised fixtures in `seed.ts`.
- **Kit.**
  - The `Menu` trigger in `ui/overlay.tsx` is a `display: contents` button,
    which keyboard users cannot reach. The account menu works around it;
    other menus do not.
  - `MenuLabel` uses `text-muted` for text.
  - Some controls are 40 px on phones: inputs, breadcrumbs and member-row
    links.
  - `Sheet` forces its own title row.
  - The build reported 66 kit notes; the notable ones are above.
- **Branding Studio** does not expose the new media and copy fields, and
  `BrandingInput` does not accept them yet (the JSON pack does).
- **Tenant strings inside API code:**
  - `@diet.ac.in` in the rollover route;
  - "JNTU roll number" in the register import;
  - 80G and Razorpay wording.
- **The privacy page** (`/privacy`) still has the old hero. Its wording is
  versioned, so a visual refresh needs care.
- **The demo pack has `whatsapp: true`**, so the composer describes WhatsApp
  sending, which is not built. Switch it off in `brands/srivarsity.json` or
  avoid that card in live demos.
- **Not built:**
  - WhatsApp Business API;
  - email delivery and bounce webhooks;
  - S3 upload;
  - Razorpay;
  - edit and unpublish endpoints for events and news;
  - cover-image fields on the admin content APIs.
