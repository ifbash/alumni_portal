# "Stunning" visual pass, 20 Oct 2026

Two rounds of parallel visual work over every screen. Visual layer only: no
guard, projection, audit, validation or API payload was changed. Reference for
the language: `docs/DESIGN-SYSTEM.md` section 12 and "New in the Oct 2026 pass".

## What was done

**Shared layer.** `src/app/globals.css` "ATMOSPHERE LAYER": `.aurora`,
`.grain`, `.glass`, `.ring-hairline`, `.lift`, `.eyebrow`, `.marquee`,
`.display-outline`, `.reveal`, `.reveal-scale`, `.stagger`. Token-only.
Signature device is the "batch ribbon" (years of passing as outlined numerals).

**Round 1.** Public landing, about, contact, events, header, footer (no-photo
hero for DIET, photo hero for Tamarind Grove); sign-in, registration, verify,
pending; the ifBash house landing rebuilt from the brand kit
(`src/components/showcase/*`, `Sections.tsx` deleted); app shell, UI kit,
`PageBand`, charts, role homes, welcome; directory, events, news, gallery,
profile header, staff "Today" with `CoverageHeatmap`.

**Round 2.** Jobs, giving, mentorship, connections, notifications; settings,
profile edit/preview, event detail and ticket, news article, album and
lightbox, batch and branch pages; staff verification (match meter, shortcuts
A/R/D/J/K that ignore text fields), members table, degree register and upload
wizard, roles matrix, rollover, data requests clock, audit diff; staff events
door desk, job review desk, comms preview, reports; the platform console
(four screens, house brand); error, 404, loading skeleton and the WhatsApp
share card (`opengraph-image.tsx`, contrast-checked on all four packs).

**One test edited.** `e2e/public-landing.spec.ts` "tap outside" now clicks the
year-picker heading, not the fixed point (200,700), which landed on a year link
after the hero changed.

## Verification state when this was written

| Check | Round 1 | Round 2 |
|---|---|---|
| `tsc --noEmit` | clean | clean |
| `npm run lint` | clean | clean |
| `vitest run` | 519/519 | 519/519 |
| `brand:check` | 0 errors | 0 errors |
| `next build` | ok | compiled successfully |
| Playwright full sweep (prod build) | 238 passed, 2 skipped (OTP spec skips on prod by design) | **NOT RUN.** See below. |

The round-2 sweep failed only because the production server could not start:
running `npm run dev` rewrote `.next`, removing `BUILD_ID`. Dev and build share
`.next`; never run both at once.

## Continue from here (in this order)

1. Stop any dev server. `npm run build && npm start -- --port 3401`, then
   `E2E_REFRESH_FIXTURES=1 E2E_BASE_URL=http://localhost:3401 npx playwright test`.
   Expect 238 passed, 2 skipped. Fix anything real. Then, on a dev server
   (`E2E_BASE_URL=http://localhost:3300 npx playwright test otp-signin`),
   run the OTP spec, which needs `OTP_ECHO`.
2. Look at what no one has seen: `/admin/giving` and `/admin/settings` (both
   timed out under load during round 2, so unchanged and unseen); gallery,
   news and event pages with real photos (fixtures have none); `CompletenessRing`
   final version; rollover danger panel, dry-run preview and the member
   History timeline (need clicks); northgate and dark mode on most round-2
   pages; 390px pass on mentorship, connections, jobs board.
3. **Decision for the owner:** the platform console no longer shows any member
   counts (the agent read "the vendor cannot read customer data" strictly;
   DIET's counts came from `SEED.members.length`). The "First members" set-up
   step became a locked college-side stage. Say if counts should come back as
   aggregates. SECURITY.md section on vendor aggregate reports already
   accepts aggregate-only reads.
4. Known rough edges: DIET phone landing is 3,588 px against the 3,600 px e2e
   ceiling (no headroom, do not add content to it); ifBash desktop page is
   about 6,100 px; the ticket has no QR code by design (nothing scans);
   platform portfolio is cards only (add a list toggle at scale); platform pack
   tile verdict line and blocked-pack alert in provisioning step 2 never seen
   rendered; the platform "peach" fill is not used (ifbash pack has no peach
   token); `(marketing)/LoadingShape.tsx` assumes `usePathname()` returns the
   destination inside a loading fallback (untested on a client navigation);
   auth keyframes `auth-shake` and `auth-slide-in` live in
   `(auth)/layout.tsx` and could move to `globals.css`.
5. Dev server memory: it climbed to about 4 GB and went slow with six agents
   shooting at once. Restart it between heavy steps; run one heavy step at a
   time on this machine.
