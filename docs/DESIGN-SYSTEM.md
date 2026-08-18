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

| Absolute ramps (same colour in both modes) |
|---|
| `bg-brand-50` … `bg-brand-900`, `accent-*`, `neutral-*` |

Use a ramp stop only where a specific step is designed in, and check it
against both grounds.

**Primary buttons** use the derived pair `--button-primary-bg` /
`--button-primary-fg`; `<Button variant="primary">` already does.

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
clamps — do not add responsive size variants to them.

`tabular` on any number that sits in a column.

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

`Button` (`variant`: primary|secondary|ghost|danger|inverse|link;
`size`: sm|md|lg|icon|icon-sm; `loading`) · `ButtonLink` (same props, is a
`next/link`) · `Spinner`

`Card` `CardHeader` `CardTitle` `CardDescription` `CardBody` `CardFooter`

`Badge` (`tone`: neutral|brand|accent|success|warning|danger|info|outline;
`dot`) · `Avatar` (`name` required, `src`, `size`: xs|sm|md|lg|xl) ·
`Alert` (`tone`, `title`, `icon`) · `EmptyState` (`icon` `title`
`description` `action`) · `Skeleton` · `Progress` · `Separator` (`label`
draws a captioned rule) · `Stat` (`label` `value` `hint` `icon` `trend`) ·
`DetailRow` (dt/dd pair — wrap in `<dl>`) · `Kbd`

`Field` (owns label + hint + error + aria wiring — **every** input goes in
one) · `Input` (`leading` `trailing` `sizeVariant` `invalid`) · `Textarea`
· `Select` · `Checkbox` · `Radio` · `Switch` · `Fieldset` · `FormActions`
· `describedBy(id, {hint, error})`

`PageHeader` (`title` `description` `actions` `breadcrumbs` `eyebrow`) ·
`Breadcrumbs` · `Tabs` (link-based, `items: {label, href, count, active}`)
· `SegmentedNav` · `Pagination` (`buildHref` must preserve the query
string) · `Section`

`TableWrap` `Table` `THead` `TBody` `TR` `TH` `TD` `TableEmpty`
`DefinitionCard` (the mobile alternative to a table)

**Client components** (`'use client'` — a page using these stays a server
component; only the leaf is client):
`Dialog` `ConfirmDialog` (`requireTyped` for irreversible actions) `Sheet`
`Menu`/`MenuItem`/`MenuSeparator`/`MenuLabel` `Popover` `Disclosure`
`Tooltip` `ThemeToggle` · `useToast()` from `@/components/ui`

**Charts** — `@/components/charts`: `Sparkline` `BarList` `ColumnChart`
`DonutChart` `ProportionBar`. All server-rendered SVG, all token-coloured,
all `role="img"` with a real label.

**Brand** — `@/components/brand/Logo`: `<Logo pack={pack} />`,
`<LogoMark pack={pack} />`. `@/components/brand/Marks`: `CircleMark`
`Scribble` `SquiggleArrow` `MarginNote` `GridBackdrop`. **At most two
hand-drawn marks per viewport**, always annotating something that matters.

**Members** — `@/components/members/MemberCard`: `MemberCard` `MemberRow`.
`@/components/members/ContactBlock`: `ContactBlock`.

**Shell** — `@/components/shell/AppShell`: `<AppShell variant="member" |
"admin" | "platform">`. Route-group layouts use it; pages never do.

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
