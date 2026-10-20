# Design system — the contract

Read this before writing any screen. Everything here already exists and
typechecks; none of it is aspirational.

The single rule everything else follows from: **no screen may contain a
hardcoded colour, radius, font, shadow or duration.** Every value resolves
through the tenant's design tokens. That property is what makes a new
customer a JSON file in `brands/` instead of a branch, and it is the thing
being sold.

---

## 1. Imports

```ts
import { Button, Card, CardBody, Badge, /* … */ } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDate, formatCurrency, memberLine } from '@/lib/format';
```

Never import from `@/components/ui/primitives` or any file deeper than the
barrel. Icons come from `lucide-react` directly.

---

## 2. Colour

Two families. Reach for **semantic** first; a screen built entirely from
semantics is correct in both themes with no further thought.

| Semantic (mode-aware — prefer these) | Meaning |
|---|---|
| `bg-surface` | page ground |
| `bg-surface-raised` | cards, panels, bars |
| `bg-surface-sunken` | inset wells, table headers, hover fills |
| `bg-surface-inverse` / `text-on-inverse` | dark bands |
| `text-primary` `text-secondary` `text-muted` | body copy, three weights |
| `border-line` `border-line-strong` | hairlines, emphasised edges |
| `text-brand-fg` | brand-coloured **text** (contrast-checked) |
| `bg-brand-soft` / `text-brand-soft-fg` | tinted brand fill + its text |
| `bg-accent-soft` / `text-accent-soft-fg` | same, accent hue |
| `bg-success` `bg-warning` `bg-danger` `bg-info` | status fills |
| `text-success-fg` … | status **text** on the page ground |
| `bg-success-soft` … | status tint |
| `text-success-on` … | text on a status fill |
| `text-marker` | the highlighter amber — decoration only |
| `band-surface` class / `bg-band` · `text-band-fg` · `text-band-muted` · `text-band-accent` · `border-band-rule` | the college's colour band. It is the same in light and dark (a darker ramp step in dark only when the seed matches the dark page). It is for identity surfaces only: the public header strip, landing hero, the hero of each public interior page (About, Contact, Events), footer, and sign-in panel and strip. `.band-exit` marks a light island inside it. |
| `bg-scrim` / `.scrim-hero` | the only way text may sit on a photograph. Over a photo, use `text-band-fg` only. |
| `bg-chart-bar` · `bg-chart-highlight` · `bg-chart-track` | chart marks. Bars clear 3:1 on `--surface-raised` in both modes (brand:check audits both as errors); the highlight is the accent at chart strength, never the same colour as the bars; the track is `--border-strong`. |

`text-muted` (about 3.5:1) is for icons, placeholders and decorative
separators. Never for informational text.

**On the band** (`.band-surface`), text uses only `text-band-fg`,
`text-band-muted` or `text-band-accent`. Never `.link`, `.link-quiet`,
`text-primary`, `text-secondary` or `surface-inverse`. Headings need an
explicit `text-band-fg`, because the base layer paints h1–h4 in
`--text-primary`. `.band-surface` also redraws the focus ring in the
band's foreground; `.band-exit` restores the page's.

| Absolute ramps (same colour in both modes) |
|---|
| `bg-brand-50` … `bg-brand-900`, `accent-*`, `neutral-*` |

Use a ramp stop only where a specific step is designed in, and check it
against both grounds.

**Primary buttons** use the derived pair `--button-primary-bg` /
`--button-primary-fg`; `<Button variant="primary">` already does. In light
mode the fill is the college's seed colour itself whenever a light label
reads on it (so the button matches the band beside it); in dark mode it is
a mid-tone ramp stop with a white label. `--surface-raised` is the page
lifted toward white, never a neutral-ramp stop, and `--focus-ring` clears
3:1 on both `--surface` and `--surface-raised` (brand:check audits both).

**Public interior pages** (About, Contact, Events) open on the band:
`<section class="band-surface"><div class="page-shell py-12 lg:py-16"><div
class="max-w-prose space-y-3">` with the institution name in
`text-sm font-semibold text-band-accent`, the h1 in `text-band-fg`, and one
or two sentences in `text-md text-band-muted`. Never put `max-w-prose` on
the `page-shell` itself: it overrides the shell's width and centres the
text off the page grid.

**Never** use Tailwind's `/opacity` modifier on a token colour
(`bg-brand-soft/40` produces invalid CSS — the palette is CSS custom
properties Tailwind cannot decompose into channels). Where a translucent
tone is genuinely needed:
`border-[color-mix(in_srgb,currentColor_26%,transparent)]`.

## 3. Type

`font-display` (headings) · `font-body` (default) · `font-mono` (roll
numbers, IDs, amounts in tables).

Sizes: `text-xs sm base md lg xl`, then
`text-display-xs sm md lg xl` for headings. Display sizes are fluid
clamps, spread linearly from a 360px phone to 1200px (display-lg is about
37px at 390 and 54px at 1200) — do not add responsive size variants to
them.

`tabular` on any number that sits in a column.

**Never pass `text-display-*` and a text colour through `cn()` together.**
tailwind-merge does not know the custom display sizes and reads
`text-display-xs` as a colour, so `cn('text-display-xs', 'text-warning-fg')`
silently drops the size. Join those two with a plain template string (the
kit's `Stat` and `PageBand` do).

## 4. Shape, space, motion

`rounded-sm|DEFAULT|lg|xl|full` · `shadow-sm|DEFAULT|lg|glow` ·
`p-card` `gap-gutter` `py-section` `h-control` `h-control-sm` `h-control-lg`
`max-w-page` `max-w-prose`.

Transitions: `transition-colors duration-fast ease-brand`. Animations:
`animate-fade-up`, `animate-fade-in`, `animate-scale-in`,
`animate-slide-down`.

---

## 5. Components

**From `@/components/ui`** — all server components unless noted:

`Button` (`variant`: primary|secondary|ghost|danger|inverse|link|band|band-outline;
`size`: sm|md|lg|icon|icon-sm; `loading`) · `ButtonLink` (same props, is a
`next/link`) · `Spinner`. `band` and `band-outline` are only for use
inside `.band-surface`.

`Card` `CardHeader` (`variant`: split|stack) `CardTitle` `CardDescription`
`CardBody` `CardFooter`

`Badge` (`tone`: neutral|brand|accent|success|warning|danger|info|outline;
`dot`; the neutral tone carries a `border-line` hairline so it never reads
as a black hole in dark mode) · `Avatar` (`name` required, `src`, `size`:
xs|sm|md|lg|xl, `shape`: circle|square — square for company monograms;
initials skip honorifics, the tint is brand or accent by a hash of the
name) · `Alert` (`tone`, `title`, `icon`) · `EmptyState` (`icon` `title`
`description` `action` `variant`: panel|inline) · `Skeleton` · `Progress` ·
`Separator` (`label` draws a captioned rule) · `Stat` (`label` `value`
`hint` `icon` `trend` `href` `tone`: default|attention|positive) ·
`DetailRow` (dt/dd pair — wrap in `<dl>`) · `Kbd`

`MediaFrame` (`src` `alt` `focus` `aspect`: 21/9|2/1|16/9|3/2|4/3|1/1
`fallback` `caption` `overlay` `loading` `rounded`) · `CoverArt` (`motif`
`label` `tone`: brand|accent `icon`) · `DateTile` (`iso` `locale`
`timeZone` `size`: sm|md|lg) · `NeedsYou` (`items: TaskItem[]` `heading`
`caughtUp`) · `SummaryLine` (`items: {value, label, href?, tone?, zero?}[]`)
· `StickyActionBar` (`label`) · `HowThisWorks` (`summary` `id`) ·
`TrustChip` (`icon` `detail`) · `ChipNav` (`items` `ariaLabel`)

On public pages, a standing note uses `Alert tone="neutral"` with an
`<Info className="size-4 text-brand-fg" />` icon, not `tone="info"`: the
info tone sets the whole body in a fixed blue that belongs to no college.

`Field` (owns label + hint + error + aria wiring — **every** input goes in
one) · `Input` (`leading` `trailing` `sizeVariant` `invalid`) · `Textarea`
· `Select` · `Checkbox` · `Radio` · `Switch` · `Fieldset` · `FormActions`
(`sticky` pins the row above the phone tab bar) ·
`describedBy(id, {hint, error})`. A disabled control reads as a fact:
sunken ground, secondary text, plain hairline, in both modes.

`PageHeader` (`title` `description` `actions` `breadcrumbs` `eyebrow`
`meta`) · `Breadcrumbs` · `Tabs` (link-based, `items: {label, href, count,
active}`; a count shows only above 0) · `SegmentedNav` · `ChipNav` ·
`Pagination` (`buildHref` must preserve the query string) · `Section`

`TableWrap` `Table` `THead` `TBody` `TR` `TH` `TD` `TableEmpty`
`DefinitionCard` (the mobile alternative to a table)

**Client components** (`'use client'` — a page using these stays a server
component; only the leaf is client):
`Dialog` `ConfirmDialog` (`requireTyped` for irreversible actions) `Sheet`
`Menu`/`MenuItem`/`MenuSeparator`/`MenuLabel` `Popover` `Disclosure`
(`id`, so a link can target it) `Tooltip` `ThemeToggle` (`size`: sm|lg;
`lg` gives 44px segments) · `ShareActions` (`url` `whatsappHref` `title`
`size` `band`) · `CopyButton` (`text` `label` `copiedLabel` `variant`
`size`) · `DropZone` (`id` `label` `accept` `hint` `onFile` `disabled`
`disabledReason`) · `useToast()` from `@/components/ui`

**Charts** — `@/components/charts`: `Sparkline` `BarList` (label and value
on one line, a 6px `--chart-bar` beneath; rows may take an `href`)
`ColumnChart` (`highlight`: one label or several; `showValues` defaults to
15 columns or fewer; columns may take an `href`) `DonutChart`
`ProportionBar`. All server-rendered, all token-coloured, all with a real
label (`role="img"`, or a labelled group of links when columns link).
Below a largest value of 3, use a sentence and chips, not a chart.

**Brand** — `@/components/brand/Logo`: `<Logo pack={pack} />`,
`<LogoMark pack={pack} />`; `<Logo variant="band" />` on the band (the
reversed logo only, else the wordmark in `text-band-fg`).
`@/components/brand/Crest`: `<Crest pack={pack} size={48} />`, the crest
on a light disc, for band surfaces only; renders nothing without a crest.
`@/components/brand/Marks`: `CircleMark`
`Scribble` `SquiggleArrow` `MarginNote` `GridBackdrop`. **At most two
hand-drawn marks per viewport**, always annotating something that matters.
No marks and no grid texture on the band.

`@/components/brand/PageBand`: `PageBand` (the hub header on the band;
see §11) and `BandChip` (`icon` `href`).

**Members** — `@/components/members/MemberCard`: `MemberCard` (`variant`:
card|row, `note`, `action`, `isViewer`, `showAvailability`) and `MemberRow`
(`href` overrides the directory link, `linkProfile`).
`@/components/members/ContactBlock`: `ContactBlock` (plus
`ownerFirstName`, `releasedBecause`: connection|visibility|role|owner,
`viewerIsStudent`, `shortName`). It renders what it is handed; every
sentence in it is true of `releaseContact()`.

**Content cards** — `@/components/content`: `EventSummary` (`variant`:
card|row|compact, `status`, `action`, `showThumbnail`) with `SeatBadge`
(`audience`: member|organiser), `StoryCard` (`variant`: lead|card|row,
`eyebrow`, `motif`), `AlbumCard` (`coverSrc`, `credit`, `variant`:
hero|large|tile, `state`, `action`), `JobSummary` (`variant`: card|row,
`showPoster`, `footer`, `action`). Isomorphic: usable in a client
preview.

**Shell** — `@/components/shell/AppShell`: `<AppShell variant="member" |
"admin" | "platform">`. Route-group layouts use it; pages never do.
`@/components/shell/PoweredBy`: `<PoweredBy pack={pack} tone="default" |
"band" />` — small and last; `tone="band"` on the band footer.

**Copy helpers** — `@/lib/branding/copy`: `capitalise`, `inSentence`
(mid-sentence case that leaves "USN" alone), `joinList`,
`rollNumber(copy)`, `greetingFor`, `deskFor(copy, role)`, `vendorLabel`,
`jobReviewLine` (null means promise nothing), `receiptLabel`. Never
hand-lowercase a pack label.

**Signed-in libraries** — `@/lib/identity` (`initialsOf`, `firstNameOf`,
`identityLine`, `viewerBatchYear`, `viewerBranch`, `ROLE_LABELS`) ·
`@/lib/format` (`displayNow`, `formatTimeZoneLabel`, `daysUntil`,
`dayBucket`) · `@/lib/clock` (`SEED_NOW`) · `@/lib/share-text` ·
`@/lib/availability-copy` · `@/lib/visibility-copy` ·
`@/lib/notifications-view` · `@/lib/staff-tasks` (server) ·
`@/lib/event-status` (`seatStatus`, `isFresherFriendly`, `isOnlineVenue`)
· `@/lib/maps` (`directionsUrl`) · `@/lib/branding/media`
(`pickBandPhoto`, `authPhoto`, `photoForBatch`, `photoForBranch`) ·
`@/lib/branding/scope` (`scopedTokensCss`) · `@/lib/branding/tokens`
(`densityCss`) · `@/lib/navigation` (`canOpen`, `hasStaffConsole`,
`mobileTabs`, `isVendorOnlySession`, `NavItem.anyOf`, `NavItem.tag`).

---

## 5b. Media slots

Photographs and video are pack data (`assets`), never files a component
names. **An absent slot renders nothing**: no empty frame, no "photo coming
soon", no stand-in art. The fallback column is what renders instead, and
it is designed, not a gap.

| Slot | Where it renders | Fallback |
|---|---|---|
| heroImage | Landing hero: a 2:1 strip above the band on phones; full-bleed behind a `scrim-hero` at lg | Solid band |
| heroVideo | lg+ only, over heroImage; gated by motion, Save-Data and 2g; pause control required | The image |
| campusPhotos | Landing "Around the campus" band, captions below the photo | Section omitted |
| authImage (falls back to heroImage) | Desktop sign-in panel, text in a scrim caption card | Solid band |
| crest | Hero, auth panel and strip, footer | Nothing |

Text never sits directly on a photograph: only on `bg-scrim` or
`.scrim-hero`, in `text-band-fg`. Captions go below the photo, not on it.
`heroFocus`, `authFocus` and a campus photo's `focus` are the
`object-position` for the crop. `heroImageAlt` absent means the hero photo
is decorative (`alt=""`); campus photos always carry alt text.

---

## 6. Data

Everything reads through `@/lib/data/repo`. Never import `seed.ts` from a
page.

```ts
import { getSession } from '@/lib/auth/session';
import { require as requireCap, can } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { searchDirectory, getMemberBySlug, getStats /* … */ } from '@/lib/data/repo';
```

Repo functions that return member data take a `Session` and apply
projection and contact-release rules internally. A page cannot ask for
more than its viewer is entitled to.

`getTenantBrand()` → `{ tenant, brand }`; `brand.pack` is the `BrandPack`
(copy, features, assets, locale).

---

## 6b. Writing back — the client helper

Every interactive control posts through one helper. Do not write a bare
`fetch()`; do not invent a second error taxonomy.

```ts
import { api, outcomeToast } from '@/lib/client/api';

const outcome = await api.post('/api/admin/news', payload);
const t = outcomeToast(outcome, 'Story published');
if (t) toast.show(t);
if (outcome.status === 'ok') router.refresh();
```

`outcome.status` is one of `ok` `invalid` `denied` `conflict`
`rate_limited` `missing` `offline` `error`. Two of those carry the weight,
and getting either wrong is a defect on every screen at once:

- **`denied` is not an error.** A 403 from the capability guard is the
  product working. It has to reach the user as a sentence about
  permission — "something went wrong" invites them to keep trying
  something they will never be allowed to do.
- **`ok` with `persisted: false` is not a success.** Fixture mode
  validates, authorises, rate-limits and audits, then stores nothing.
  A green tick over that is a lie the user discovers on the next page
  load. `outcomeToast` returns an informational toast for this case; if
  you build your own feedback, keep the distinction.

Map `outcome.fieldErrors` onto the relevant `Field`'s `error` prop, so a
422 lands on the field that caused it rather than only in a toast.

Optimistic UI is fine. A failed request must visibly roll it back.

Pass an `AbortSignal` for anything that fires while typing — the branding
preview does — and note that an aborted request resolves as `offline` with
the message `Cancelled.`, which should not raise a toast.

Behaviour is pinned in `tests/client-api.test.ts`.

---

## 7. Authorisation

Every page under `(app)`, `(admin)` and `(platform)` **guards itself**,
even though the navigation already hides what a viewer cannot reach.
Hiding a link is presentation; it is not authorisation.

```ts
const session = await getSession();
if (!session) redirect('/login');
requireCap(session, 'verification.review.department');   // throws 403
```

Feature gates: `if (!brand.pack.features.donations) notFound();`

**Rules that must not be relaxed** (from `CLAUDE.md`):

- Students never see alumni contact details.
- Contact release needs both gates: viewer entitled **and** owner
  consented. `releaseContact()` in the repo does this; do not reimplement.
- Bulk contact export is `college_admin` only, audit-logged with a reason.
- No role reads private message bodies.
- The directory is never anonymous.
- Students never see the donations module.
- CGPA and placement status are placement-side only.
- Donations carry `source_country` and `is_foreign_contribution` from day
  one; the donations UI stays behind `features.donations`.

---

## 8. Accessibility — not optional

- One `<h1>` per page, via `PageHeader`. Headings descend without skips.
- Every input inside a `Field`. Every icon-only control gets an
  `aria-label`.
- Interactive elements are `<button>` or `<a>`. Never a `div` with
  `onClick`.
- Colour is never the only carrier of meaning — pair every status colour
  with text or an icon.
- Tables get a `caption` prop on `TableWrap`; wide tables scroll inside
  their own container, never widening the page.
- Loading states use `Skeleton` in the real layout's shape, not a spinner
  in an empty box.

---

## 9. Writing

The voice is direct, specific, and honest — the register of a competent
colleague, not a marketing page.

- Say what happened and what to do: "You have 5 requests waiting for a
  reply. Wait for one to be answered before sending another." Not
  "Limit exceeded."
- Empty states explain *why* it is empty and what would fill it.
- Never claim an outcome the product cannot show.
- Indian English, `en-IN` number grouping, ₹ in lakhs and crores for
  anything above a lakh (`formatCompactINR`).

---

## 10. Page skeleton

```tsx
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;              // Next 15: both are promises
  const { brand } = (await getTenantBrand())!;
  const data = getSomething(session, params);

  return (
    <div className="space-y-6">
      <PageHeader title="…" description="…" actions={<ButtonLink href="…">…</ButtonLink>} />
      {/* … */}
    </div>
  );
}
```

`params` and `searchParams` are **promises** in Next 15 — always `await`.

Add `export const metadata = { title: '…' }` to every page; the layout
template appends the portal name.

---

## 11. Signed-in patterns

Everything under `(app)`, `(admin)` and `(platform)`. It extends the public
pages and never contradicts them. After sign-in the portal is the
college's own alumni office: the college shows in the sidebar's identity
block, one band header per hub, and the moments that matter (a welcome, a
ticket, an approval, a thank-you). Work screens stay plain, dense and
fast. Every screen is designed on `diet` first — no crest, no logo, no
photos — and a crest or photo is an addition to a layout that already
works, never a hole a placeholder fills.

### Shell

- **Sidebar** (lg+): the identity block is the only band — crest (null
  today), `<Logo variant="band">`, and a second line: the institution
  name, "Staff console" or "Platform". Group headings in `text-secondary`;
  count pills never at 0; `NavItem.tag` after the label.
- **Top bar**: the command palette trigger is the one search. Theme
  moves to the account menu and the phone drawer. No bell for a
  vendor-only session.
- **Account menu**: the identity line (`identityLine()`), never a bare
  role. "Staff console" only when `hasStaffConsole()`.
- **Phones**: a bottom tab bar for members (`mobileTabs()`: four
  destinations plus More; never for the vendor). The root carries
  `.has-tabbar`, which sets `--shell-tabbar-h`; `StickyActionBar` and
  `FormActions sticky` sit above it.
- **Vendor-only sessions** (every role is `platform_admin`): member nav
  is My profile and Settings. No tab bar, no bell. Refusals belong to
  the route policy, never to the shell.
- **Staff console**: breadcrumbs start "Staff console" → `/admin`; the
  home is "Today". At lg+ it applies the compact density
  (`densityCss('compact', '.console-density', 1024)`); phones keep 44px
  targets.
- **Platform**: the whole document wears the house pack. The shell emits
  `<style id="house-brand">` with `tokensToCss(buildTokens(housePack()))`
  as the first child of the root, after the tenant's head style, so it
  wins for toasts and every overlay portal too. College previews inside
  platform pages use `scopedTokensCss` on a wrapper.
- **Demo data**: a subtle top-bar badge in fixture mode. Screens never
  narrate "not connected in this build"; `persisted: false` stays an
  informational `outcomeToast`.

### Headers and media

- `PageBand` (standard) heads /dashboard, /welcome, /giving and the batch
  and branch pages; compact heads /directory, /jobs, /mentorship and
  /admin. Everything else is `PageHeader`: eyebrow = the section as the
  sidebar names it, one-sentence description (120 characters or fewer),
  `meta` for a scope chip or `TrustChip`, at most one primary action.
- Photos come only from `@/lib/branding/media`. Home, giving and profile
  bands share the untagged campus photos (dealt 0, 1, 2) after anything
  the college tagged with `use`; home falls back to the hero. A batch page
  shows only a photo tagged with that `batchYear`, a branch page only one
  tagged with that `departmentCode`. Compact bands never show a photo.
  Tag a photo only when the tag is true of what it shows.
- Event surfaces use the event's own `coverImage`, never a campus photo.
  Albums: `coverImage`, then the first photo with a URL, then `CoverArt`.
  Obituaries: a supplied portrait or nothing — never art.
- `MediaFrame` puts text on a photo only through `overlay` (scrim,
  `text-band-fg`). `CoverArt` is one real datum on a soft tint, hidden
  from assistive tech. `DateTile` is the public date tile.
- No stock or fabricated imagery, no "not uploaded", no pixel sizes. No
  video after sign-in.

### Stat → action

- Never render a tile, stat or tab count of 0.
- Things that need the viewer are `TaskItem`s in `NeedsYou`: count, what
  it is, the age of the oldest, one verb. `staffTasks(session, pack)` is
  the one source for staff queue counts; every read sits behind its own
  capability. Work done outside the portal ("gifts without a receipt
  number") uses "See the list".
- List pages open with a `SummaryLine`; each figure links to its view.
- `Stat` rows survive on finance and reporting screens only, each with an
  `href`, `tone="attention"` when it needs action. Figures below 3 are
  words or chips. Quotas say what is available ("5 requests available").

### Empty states, explanation, trust

- One sentence on why the space is empty and what fills it, plus at most
  one action. `EmptyState variant="panel"` only when the empty list is
  the page's main content; otherwise `inline`. No dashed boxes.
- At most one `HowThisWorks` per screen, 120 words or fewer. A one-line
  promise is a `TrustChip`. No policy essays, no info-blue intro alerts,
  no pitch copy aimed at a buyer.

### Sharing

WhatsApp first: `whatsappShareUrl(text, url)` built on the server, then
Copy link, then the Web Share sheet — `ShareActions`, with words from
`@/lib/share-text`. Links for people not yet registered point at public
pages (a batch share at `/claim?year={year}`, a general invite at `/`);
links for members point at the signed-in page. Staff "Copy for WhatsApp"
is a `CopyButton` with the text plus the member URL; no Business API call.

### Copy

1. No identifier renders: capability ids, table and column names, enums,
   file names, "ap-south-1" (say "stored in India"), "tenant" (say
   "college"). Machine names only inside a "Technical details" disclosure
   on staff and platform screens.
2. One sentence per description. Speak to the viewer's role.
3. Never claim what the product cannot do: waitlists, desk scanning,
   notifying by WhatsApp or email, reply channels, donor walls, bounce
   tracking, audited contact release, receipt issuing, payment settling,
   invented statistics.
4. No tenant facts in components (names, places, numbers, programme
   names, email domains, establishment years, intakes, tax registrations,
   vendor names). Use pack copy or data, or drop the claim. A donation
   receipt is "Receipt", or `receiptLabel(copy)`. **Carve-out:** legal
   retention statements stay reachable and say "donation records and tax
   receipts".
5. No contractions. Indian English, en-IN grouping, ₹ lakh and crore only
   from ₹1,00,000 (`formatCompactINR`). The time zone reads "IST"
   (`formatTimeZoneLabel`). Labels are verbs: "Review 13 registrations".
6. Dates and times come from `displayNow()` and the tenant time zone.
   Never read the clock during render.

### Status colours

| Tone | Means |
|---|---|
| success | done, met, confirmed; full (organiser view) |
| warning | needs attention soon, scarce, waiting too long |
| danger | error, overdue, refused, legal block |
| brand | normal work in progress, the viewer's own |
| accent | special audience or origin ("Alumni only", "Contributed") |
| neutral / outline | passive ("Draft", "Closed", "Final year") |
| info | not used for decoration, intros or states after sign-in |

Coverage: below 20% danger-soft, 20–35% warning-soft, 35% and above
success-soft, always with the percentage. Colour never carries meaning
alone.

### Charts

Bars use `bg-chart-bar`; the highlighted bar(s) `bg-chart-highlight`,
also named in text. Both clear 3:1 on a card in both modes. `BarList`:
label and value on one line, a 6px bar beneath. `ColumnChart`: values
visible at 15 columns or fewer. No donut for a single proportion on a work
screen: a sentence plus `ProportionBar`.

### Density

`shape.density` is the college's choice for member screens. The staff
console overrides it to compact at lg+ with `densityCss`; phones keep the
comfortable density and 44px targets everywhere.

### Phones and accessibility

No horizontal page scroll: every grid has a one-column base, children get
`min-w-0`, wide tables go in `TableWrap` or `DefinitionCard`s. The primary
action is in the first viewport or a `StickyActionBar`. Chip rows and tabs
scroll with `.scroll-fade-x` rather than wrap. Every standalone link or
control is `min-h-11`. One `h1` per page; every `<aside>` has an
`aria-label`; icon-only controls are labelled. `[data-print-hide]` and
`.print-only` control print.

---

## 12. Atmosphere layer (Oct 2026)

Depth, light and motion for identity surfaces. Defined once in
`src/app/globals.css` ("ATMOSPHERE LAYER"); every value resolves through
tokens, so a new college inherits it for free.

| Class | Use | Rules |
|---|---|---|
| `.aurora` | Absolutely-positioned child of a `.band-surface` (hero, page band, sidebar identity block, auth panel). | Mixes `--band-accent` / `--band-fg` at 24% or less; it is the only texture allowed on the band besides `.grain`. Re-measure contrast before putting it under small text. Transform-only drift; off under reduced motion. |
| `.grain` | Paper tooth on a band or gradient surface. | Neutral noise at 16% soft-light; hides banding. |
| `.ring-hairline` | Raised cards that should catch light on the top edge. | Needs a radius on the element (`inherit`). |
| `.glass` | Frosted bars and cards over imagery or the aurora. | Text uses page tokens, never band tokens. |
| `.lift` | A card that is a link. | Hover-capable pointers only; transform and shadow, no layout shift. |
| `.eyebrow` | The numbered-section label ("01 Events"). | One per section; the number is decoration. |
| `.marquee` + `.marquee-track` | Endless row (batch ribbon). | Render the list twice, second copy `aria-hidden`; stops under reduced motion. |
| `.display-outline` | Giant outlined numerals or words. | `aria-hidden`, decoration only, never carries meaning. |
| `.reveal`, `.reveal-scale` | Scroll-driven entrance for below-the-fold blocks. | Progressive: browsers without `animation-timeline` and reduced-motion users simply see the content. Never above the fold. |
| `.stagger` | Load-in for above-the-fold groups; set `--i` per child. | Fade-up, 70ms steps. |

Animate `transform` and `opacity` only. The "no marks and no grid texture
on the band" rule in section 2 stands; aurora and grain are the approved
band texture.

### New in the Oct 2026 pass

`EventDateBlock` (`@/components/content`) is the large calendar-leaf date
used by event leads. `CoverageHeatmap` (`admin/_shared/RegisterFilesGrid`)
shows coverage by batch on staff Today; the percentage is always text, the
tint is `danger-soft` / `warning-soft` / `success-soft`. `CoverageChips`
stays for the degree-register page. Public pages compose from
`marketing/PageHero`, `SectionHead` (CSS-counter numbering, so an absent
section leaves no gap) and `BatchMarquee`. Auth screens share
`(auth)/_components/AuthPanel`.
