# White-labelling

How a second college becomes a working, differently-branded portal — and what
that costs in engineering time, honestly.

The short version: a JSON file, two lines in a registry, and a DNS record. No
component is touched, no stylesheet is edited, no build is branched. The
design system enforces this from the other end — no screen may contain a
hardcoded colour, radius, font, shadow or duration (see
[DESIGN-SYSTEM.md](DESIGN-SYSTEM.md)), so there is nowhere for a customer's
identity to be baked in.

---

## 1. Onboarding a customer

### Step 1 — write the pack

```bash
npm run brand:new -- \
  --id fidelis \
  --name "St Fidelis College of Engineering" \
  --short "SFCE" \
  --portal "Fidelis Connect" \
  --primary "#5B2B8C" \
  --accent "#C8811E"
```

This writes `brands/fidelis.json`, validates it through the same Zod schema the
app loads with, derives the full token set, and runs the contrast audit. The
`--id` becomes the filename, the registry key and the subdomain, so it is a
lowercase slug of 2–32 characters.

You can also just write the JSON by hand. The scaffold exists so that the
person doing this at 11pm before a demo does not have to remember the shape.

### Step 2 — register it

`src/lib/branding/registry.ts`, two lines:

```ts
import fidelisJson from '../../../brands/fidelis.json';

export const PACKS: Record<string, BrandPack> = {
  // …
  fidelis: load(fidelisJson, 'fidelis'),
};
```

Packs are imported statically rather than read from disk at runtime, so the
bundler includes them and a malformed pack fails at boot, loudly, instead of
at first render for one unlucky customer.

### Step 3 — point a subdomain at it

`fidelis.<your-domain>` → the same deployment. Locally,
<http://fidelis.localhost:3000> works with no configuration at all.

In fixture mode a pack with no tenant row still resolves
(`fixtureTenant()` in `src/lib/tenant.ts` falls back to `PACKS[sub]`), which
means you can preview a prospect's portal before anyone has provisioned
anything. In `db` mode a `tenants` row is required, and an unknown host 404s
rather than quietly serving the first college in the table.

### What is *not* included in those three steps

- **A tenant row and its data.** Departments, the degree register and the
  student roster are separate imports. The loader for them is not built —
  see [BACKLOG.md](../BACKLOG.md).
- **Logos.** A pack with no logo renders the portal name in the display face,
  which is intentional for a new tenant but is not what you show on a
  contract-signing call.
- **A domain certificate.** Wildcard or per-tenant, depending on the host.

---

## 2. The BrandPack schema

`src/lib/branding/pack.ts` is the contract. Everything the UI renders that
could differ between customers is named there and nowhere else. Three rules
hold it together:

1. **Seeds in, tokens out.** A customer supplies colours they can name from
   their own style guide. The 10-stop ramps, hover states, tinted fills and
   text-on-brand pairings are derived. Colleges have a crest and a hex code,
   not a design system; asking for eleven stops gets eleven bad stops.
2. **No free-form CSS.** Overrides accept values for *named* tokens only.
3. **Copy travels with the brand.** Half of "looks like ours" is wording.

Required: `id`, `color.primary`, `copy.portalName`, `copy.institutionName`,
`copy.shortName`. Everything else has a default or a derivation.

### `color`

| Field | Type | Default | What it does · what happens if omitted |
|---|---|---|---|
| `primary` | hex | **required** | The one colour a customer always knows. Drives the entire primary ramp, the button fill, the focus ring, brand text and every tint. |
| `accent` | hex | *falls back to `primary`* | Secondary hue. Optional on purpose — most colleges have one colour, and a second badly-chosen one is worse than none. The fallback yields a monochrome scheme that always reads as deliberate. `northgate.json` ships this way. |
| `surface` | hex | `#ffffff` | Page background. Warm off-whites read as designed; pure `#fff` reads as unstyled. It also seeds the neutral ramp. |
| `surfaceDark` | hex | `#0f1115` | Dark-mode page background. The rest of dark mode is derived from it. |
| `ink` | hex | *derived from `neutral[900]`* | Headings and dark bands. Supply it when a brand guideline pins a specific near-black. |
| `marker` | hex | *falls back to `accent[500]`* | The highlighter colour for the hand-drawn annotation marks. Decoration only — never a fill, never body text. |
| `neutralChroma` | 0–0.05 | `0.012` | How much brand hue bleeds into the greys. `0` gives neutral greys; higher tints borders and muted text toward the brand. A warm bone surface with cold grey borders reads as two unrelated designs stacked on each other. |
| `success` | hex | `#15803d` | Status hue. Ramped and contrast-fitted like the brand. |
| `warning` | hex | `#b45309` | |
| `danger` | hex | `#b42318` | |
| `info` | hex | `#1d4ed8` | |
| `overrides` | token map | `{}` | Light-mode pins. See §4. |
| `darkOverrides` | token map | `{}` | Dark-mode pins, kept separate. See §4. |

Hex values accept 3 or 6 digits, with or without the leading `#`; they are
normalised on parse.

### `type`

| Field | Type | Default | What it does · what happens if omitted |
|---|---|---|---|
| `display` | string | `Fraunces` | Headings. |
| `body` | string | `Inter` | Everything else. |
| `mono` | string | `IBM Plex Mono` | Roll numbers, IDs, amounts in tables. |
| `source` | `google` \| `local` \| `system` | `google` | `google` fetches at runtime; `local` self-hosts from `fontFaces`; `system` uses the fallback stack only. Runtime matters: `next/font` resolves at build time and so cannot serve a typeface a customer picks after deploy. |
| `fontFaces` | array | `[]` | `{ family, src, weight = '400', style = 'normal' }`. **Only read when `source: 'local'`.** Declaring `local` with an empty array silently falls back to system fonts — `brand:check` warns about exactly this. |
| `displayTracking` | string | `-0.02em` | Display headings are usually set tighter than body copy. |
| `scale` | 0.8–1.3 | `1` | Multiplied into every step of the display scale. `northgate` runs `0.96`, `srivarsity` runs `1.02`. |

Each family gets an appropriate fallback stack appended automatically, so a
font that fails to load degrades to a system serif, sans or mono rather than
to Times.

### `shape`

| Field | Values | Default | What it does |
|---|---|---|---|
| `radius` | `none` \| `subtle` \| `rounded` \| `pill` | `subtle` | Four radius steps derived per level, from `0px` throughout to `10/18/26/36px`. |
| `density` | `compact` \| `comfortable` | `comfortable` | `compact` shrinks control heights, gutters, card padding and row heights for data-dense admin work. |
| `borderWidth` | `hairline` \| `standard` | `hairline` | `1px` or `1.5px`. |
| `elevation` | `flat` \| `soft` \| `lifted` | `soft` | `flat` draws rings instead of shadows and suits institutional brands; `lifted` suits consumer-feeling ones. |

`radius: 'pill'` is accepted by the pack schema but **rejected by the database**
— the `tenant_branding.radius` CHECK constraint permits only
`none | subtle | rounded`. It is safe in a pack file and will fail on publish
through the branding admin. That constraint should be widened; it is in the
backlog.

### `assets`

All optional. Each must be a site-relative path (`/brand/…`), an `https://`
URL, or a `data:` URI.

| Field | Used for · what happens if omitted |
|---|---|
| `logoPrimary` | The header logo. Omitted → the portal name renders in the display face. |
| `logoInverse` | The same logo on dark bands and the inverse footer. |
| `logoMark` | Square mark for tight spaces and the mobile header. |
| `crest` | The college crest where the full lockup does not fit. |
| `favicon` | Browser tab icon; wired into `generateMetadata`. Omitted → the app default. |
| `ogImage` | Link previews. Omitted → no image card when the URL is shared. |
| `heroImage` | The public landing page. |
| `authImage` | Rendered behind the sign-in card. Omitted → a generated gradient. |

Brand imagery is served through plain `<img>` rather than `next/image`,
because an optimiser allowlist wide enough to cover every college's own web
host is an allowlist that means nothing (`next.config.ts` says so at the top).

### `copy`

| Field | Limit | Default | Notes |
|---|---|---|---|
| `portalName` | 2–60 | **required** | "DIET Connect", "Vydehi Connect". Appears in the title template as `%s · <portalName>`. |
| `institutionName` | 2–120 | **required** | The legal name, used in footers and notices. |
| `shortName` | 1–24 | **required** | "DIET", "SVU". Used where the full name will not fit. |
| `tagline` | ≤160 | — | Under the logo and as the meta description. Omitted → the description falls back to "Alumni portal for `<institutionName>`". |
| `heroHeadline` | ≤120 | — | The public landing headline. |
| `heroEmphasis` | ≤60 | — | The phrase circled by a marker stroke in the hero. **Must appear verbatim inside `heroHeadline`** or nothing is circled. |
| `heroSubhead` | ≤320 | — | |
| `supportEmail` | valid email | — | Shown on error and empty states so a stuck user has somewhere to go. |
| `supportPhone` | ≤24 | — | |
| `addressLines` | ≤5 lines, ≤120 each | `[]` | Footer address. |
| `websiteUrl` | valid URL | — | Links the logo out to the college's own site. |
| `poweredBy` | ≤60 | — | Vendor credit. Omitted → the credit is not rendered at all. See §7. |
| `poweredByUrl` | valid URL | — | Omitted → the credit renders as plain text rather than a link. |

### `features`

Booleans. Not CSS classes — a false flag removes the navigation item
(`src/lib/navigation.ts`) *and* the route guards on it.

| Flag | Default | Notes |
|---|---|---|
| `directory` | `true` | |
| `connections` | `true` | |
| `events` | `true` | |
| `jobs` | `true` | |
| `mentorship` | `true` | |
| `donations` | **`false`** | Off by default and deliberately. See §6. |
| `gallery` | `true` | |
| `news` | `true` | |
| `whatsapp` | **`false`** | Needs a Business API provider account per tenant. |
| `publicLanding` | `true` | `false` puts the whole portal behind sign-in, which is what a polytechnic with no marketing appetite asks for. `northgate.json` ships this way. |

### `locale`

| Field | Default | Notes |
|---|---|---|
| `locale` | `en-IN` | Also becomes `<html lang>` and the OG locale. |
| `currency` | `INR` | Exactly 3 characters. |
| `timeZone` | `Asia/Kolkata` | |
| `dateFormat` | `dd-MM-yyyy` | Or `MM/dd/yyyy`, `yyyy-MM-dd`. |

### `id` and `version`

`id` is the slug — filename, registry key and subdomain, all the same string.
`version` is an integer that defaults to `1`; it exists so a pack can be
revised without ambiguity when a college sends a second style guide.

---

## 3. The derivation contract

A customer supplies two or three colours. The system produces well over a
hundred CSS custom properties from them — roughly seventy for light, forty for
dark, and forty more that are mode-independent (radii, type scale, density,
shadows, motion).

### Seeds in, ramps out

`generateRamp(seed)` converts the seed to OKLCH, then emits ten stops
(50–900) at fixed target lightnesses with a chroma taper at both ends (pure
tints and shades read as muddy otherwise). Anything outside the sRGB gamut has
its chroma pulled down iteratively until it is representable.

**OKLCH rather than HSL**, because HSL lightness is not perceptually uniform:
the same ramp applied to a navy and to a yellow produces wildly different
perceived contrast. OKLCH keeps the steps even across hues, which is precisely
what lets one algorithm serve any college's colour without a designer looking
at the result.

The neutral ramp is derived from the *surface* rather than being a fixed grey,
carrying the surface's own hue at very low chroma. That is the difference
between "themed" and "recoloured". A near-achromatic surface has an unstable
hue angle, so it is anchored warm.

### The accessible-stop walk

The core of it. Rather than naming a stop and hoping, the tokens that carry
text walk the ramp until a step clears the required ratio against the ground
it will actually sit on:

- `accessibleStop(ramp, surface, 4.5)` for brand and accent text, walking
  darker in light mode and lighter in dark mode.
- `accessibleStop(ramp, surface, 3, …)` for the focus ring — a keyboard user
  who cannot see focus cannot use the portal.
- `pickFill(ramp, [600, 700, 500, 800], labels)` for the primary button: it
  tries candidate stops until a fill and label pairing clears 4.5:1. Naming a
  stop and hoping is what makes a primary button unreadable for one customer in
  twenty, because a saturated mid-tone sits in the dead zone where neither
  white nor black passes.

This is why bad seeds do not produce bad portals. Running the harness
(`npm run check:branding`) over eleven deliberately awkward colours:

| Seed | Brand text resolves to | Button label |
|---|---|---|
| Pale gold `#E3C567` | `#7f6601` | 5.4:1 white on `#7f6601` |
| Neon lime `#B6FF3C` | `#51760e` | 5.32:1 |
| Near-black `#111111` | `#696969` | 5.49:1 |
| Saffron `#E07A2F` | `#9f5011` | 5.79:1 |
| Cyan `#00A8B5` | `#0d7780` | 5.29:1 |

Every one is publishable. The registrar pastes the letterhead yellow and gets a
legible portal, not a support ticket.

### The light/dark split

Dark mode is **derived, never configured**. Asking a college to pick a second
palette produces a second bad palette.

The three ramps stay *absolute* — `--brand-600` is the same colour in both
modes. Only the semantic tokens flip, and the stops used for fills move up the
scale so they read against a dark ground. A stop that changed meaning between
modes would make every component touching a raw stop a two-mode debugging
problem, so components read semantics (`surface-raised`, `text-muted`,
`border`) and the ramps exist for the handful of places a specific step is
designed in.

Serialisation handles the three-state theme correctly: a `prefers-color-scheme`
media query for the OS default, and a `[data-theme="dark"]` attribute for an
explicit user choice, with the attribute winning in both directions.

---

## 4. Why overrides are a named list, not free CSS

`color.overrides` and `color.darkOverrides` accept values for exactly 27 named
tokens — surfaces, text weights, borders, brand and accent foregrounds, the
marker, the focus ring, the three button tokens, the four status colours and
the shadow colour. Anything else is rejected at parse time with the full list
in the message:

```
Only these tokens may be overridden: --surface, --surface-raised, --surface-sunken, …
```

Unbounded theming turns every support ticket into CSS archaeology and makes
the design system unmaintainable across tenants. The whole commercial argument
for this product is that fifty colleges share one codebase; a customer who can
write arbitrary CSS is a customer who has forked it without telling you.

Light and dark overrides are separate lists for a specific reason. Almost every
pinnable token is a light/dark pair: an ink that a brand guideline fixes for
headings on paper is, applied unchanged to a dark ground, ink on ink. Pinning
`overrides` alone used to make dark mode unreadable for exactly the customers
whose guidelines were most specific.

`ifbash.json` is the worked example — six tokens pinned in light mode from
section 3.1 of the brand guidelines, `darkOverrides` left empty so dark mode
derives cleanly.

Two sharp edges to know about:

- Overrides are applied **after** derivation and **before** the audit. That
  ordering is deliberate: a pinned colour is exactly where an inaccessible value
  gets in, so it must be checked, not trusted.
- `--text-on-brand` is in the overridable list but is not emitted by the token
  builder; Tailwind's `text-on-brand` maps to `--button-primary-fg`. Overriding
  it sets a property nothing reads. Harmless, but it will waste someone's
  afternoon.

---

## 5. Errors block publication, warnings do not

After overrides land, `auditTokens()` checks the eleven pairs the UI actually
renders — not raw ramp stops:

| Pair | Required | Severity |
|---|---|---|
| `--text-primary` on `--surface` | 7:1 | **error** |
| `--text-secondary` on `--surface` | 4.5:1 | **error** |
| `--brand-fg` on `--surface` | 4.5:1 | **error** |
| `--brand-soft-fg` on `--brand-soft` | 4.5:1 | **error** |
| `--button-primary-fg` on `--button-primary-bg` | 4.5:1 | **error** |
| `--focus-ring` on `--surface` | 3:1 | **error** |
| `--danger-fg` on `--surface` | 4.5:1 | **error** |
| `--text-on-inverse` on `--surface-inverse` | 4.5:1 | **error** |
| `--text-muted` on `--surface` | 3:1 | warning |
| `--accent-fg` on `--surface` | 4.5:1 | warning |
| `--border-strong` on `--surface` | 1.6:1 | warning |

Checking rendered tokens rather than ramp stops matters. An earlier version
checked stops and produced warnings about steps nothing uses — a border check
against `brand-400` when borders are drawn from `--border-strong` — and
warnings nobody can act on get ignored, including the ones that matter.

**Where the line is drawn, and why.** Body text nobody can read is not a
judgement call; it is a portal that does not work, and it is refused. A
marginal accent, a muted caption at 2.9:1, a hairline that is barely visible —
these are trade-offs a college is entitled to make against its own brand
guidelines, and a vendor who blocks publication over them is a vendor the
registrar routes around. Blocking on everything is the same as blocking on
nothing, because the customer stops reading the report.

In practice, derivation alone almost never produces an error — that is the
point of the accessible-stop walk. Errors come from overrides:

```
publishable: false
2 contrast failures — these colours cannot be published.
  ERROR   --text-primary 2.64:1 needs 7
  ERROR   --text-secondary 1.91:1 needs 4.5
```

Two gates enforce it. `npm run brand:check` audits every file in `brands/` and
exits non-zero on an error — run it in CI, because a customer's colours are
data and data ships without a code review. And the publish endpoint returns
422 on a blocking report rather than saving.

---

## 6. Feature flags as a commercial and legal gate

`features` is where "what has this customer bought" and "what is this customer
legally permitted to do" both live. It is a hard gate in the navigation and in
the route guards, not a CSS class — a hidden link on a live route is not a
gate.

**Donations default to `false` and stay there until the college confirms FCRA
registration.** This is the only flag with a legal rather than a commercial
reason, and it is not a rollout preference. Foreign contributions to an Indian
institution must be segregated at the point of collection or not collected at
all; `donations.source_country` and `donations.is_foreign_contribution` are
columns in the first migration, not a report someone runs later. `brand:check`
prints a warning whenever a pack ships with `donations: true`, precisely so
that turning it on is a decision somebody made rather than a default nobody
noticed.

The commercial flags behave the way you would expect: `whatsapp` needs a
Business API provider account per tenant, `publicLanding: false` puts the whole
portal behind sign-in, and the content modules (`gallery`, `news`) come off for
a customer who does not want to staff them.

Students never see the donations module regardless of the flag —
`hideForStudents` in the navigation is a hard exclusion no capability
overrides. Asking a final-year for money on the portal meant to help them find
work poisons the product.

---

## 7. The branding studio

`/admin/branding`, backed by `src/app/api/admin/branding/route.ts`. Requires
the `tenant.configure` capability, which `college_admin` and `platform_admin`
hold and nobody else does.

| Verb | Behaviour |
|---|---|
| `GET` | The tenant's current pack, the list of available base packs, the contrast report, and the resolved light/dark/base token maps. This is also the export: the response contains exactly the object that goes into `brands/`. |
| `POST ?preview=1` | Validates and returns CSS, the font href, the report and a `publishable` boolean. **Never persists and never blocks** — an administrator has to be able to *see* a failing combination in order to understand the report. |
| `POST` | Validates, refuses with 422 if the report is blocking, upserts `tenant_branding`, writes an audit entry with before/after, and invalidates the branding cache so the change is visible on the next request. |
| `PUT` | Imports a pack JSON: validates it against the full `BrandPack` schema and returns the resolved pack, CSS and report. It does not save — it is the "paste what the designer sent back and see whether it works" path. |

The preview goes through **the same resolver the renderer uses**
(`previewBrand()` → `assemble()` → `buildTokens()`), so what an administrator
sees is byte-for-byte what ships. Any optimisation that would break that
property is not worth its speed.

The form (`src/lib/branding/config.ts`) is deliberately a *subset* of the pack.
A registrar edits primary, accent, two surfaces, six asset URLs, two font
names, radius, density, elevation, the portal name, tagline and support email.
Feature flags, token overrides, `fontFaces` and locale are not reachable from
the browser — a reseller shipping fifty colleges edits JSON; a college
registrar edits the form; neither can reach what the other cannot.

Three honest limitations of the persisted path today:

- The `tenant_branding` table has columns for the pack file's colours, fonts,
  radius, six assets, portal name, tagline and support email. **`density`,
  `elevation`, `institutionName` and `shortName` are accepted by the form and
  applied in the preview, but there are no columns for them, so they are lost
  on save.**
- `radius: 'pill'` passes the form schema and violates the table's CHECK
  constraint.
- Logo upload to S3 is not built. Asset fields accept a URL; there is nothing
  to upload a file to yet.

The form-to-database gap is a schema change, not a redesign — and it only
affects the browser path. Editing `brands/<id>.json` reaches everything.

---

## 8. The vendor credit

`copy.poweredBy` and `copy.poweredByUrl`, rendered by
`src/components/shell/PoweredBy.tsx`. Omit `poweredBy` and the credit does not
render at all.

Configurable rather than hardcoded for two commercial reasons: a reseller
shipping this to ten colleges under their own name needs to replace it, and a
college paying institution-tier fees will eventually ask for it to come off
entirely. Both are one field, so neither is a negotiation about engineering
time.

---

## 9. Worked example: zero to a themed portal

A fictional customer, start to finish. This is the real output of the real
commands.

**1. Scaffold.**

```bash
npm run brand:new -- \
  --id fidelis \
  --name "St Fidelis College of Engineering" \
  --short "SFCE" \
  --portal "Fidelis Connect" \
  --primary "#5B2B8C" \
  --accent "#C8811E"
```

```
Wrote brands/fidelis.json

Derived from #5B2B8C:
  page text     #111111 on #FBFAF8
  brand text    #7b4fae
  button        #ffffff on #7b4fae
  dark button   #0b0b0c on #9366cb

All contrast checks pass.

Two lines left, in src/lib/branding/registry.ts:

  import fidelisJson from '../../../brands/fidelis.json';

  fidelis: load(fidelisJson, 'fidelis'),

Then: point fidelis.<your-domain> at the deployment, or run locally at
http://fidelis.localhost:3000
```

**2. The file it wrote** — `brands/fidelis.json`:

```json
{
  "id": "fidelis",
  "version": 1,
  "color": {
    "primary": "#5B2B8C",
    "accent": "#C8811E",
    "surface": "#FBFAF8",
    "surfaceDark": "#101317",
    "neutralChroma": 0.01,
    "overrides": {},
    "darkOverrides": {}
  },
  "type": {
    "display": "Fraunces",
    "body": "Inter",
    "mono": "IBM Plex Mono",
    "source": "google",
    "displayTracking": "-0.015em",
    "scale": 1
  },
  "shape": {
    "radius": "subtle",
    "density": "comfortable",
    "borderWidth": "hairline",
    "elevation": "soft"
  },
  "assets": {},
  "copy": {
    "portalName": "Fidelis Connect",
    "institutionName": "St Fidelis College of Engineering",
    "shortName": "SFCE",
    "tagline": "",
    "heroHeadline": "Every SFCE graduate, still reachable.",
    "heroEmphasis": "still reachable",
    "heroSubhead": "Find the batch you graduated with, mentor the students coming up behind you, and hear about campus events before they happen.",
    "addressLines": [],
    "poweredBy": "ifBash",
    "poweredByUrl": "https://ifbash.com"
  },
  "features": {
    "directory": true, "connections": true, "events": true, "jobs": true,
    "mentorship": true, "donations": false, "gallery": true, "news": true,
    "whatsapp": false, "publicLanding": true
  },
  "locale": {
    "locale": "en-IN", "currency": "INR",
    "timeZone": "Asia/Kolkata", "dateFormat": "dd-MM-yyyy"
  }
}
```

The generated file also carries a `$comment` array at the top. JSON has no
comment syntax, so `$`-prefixed keys carry the notes and the loader strips
them before validation.

**3. Register and run.**

Add the two lines to `src/lib/branding/registry.ts`, then:

```bash
npm run brand:check      # confirms the pack parses and every pair passes
npm run dev
```

Open <http://fidelis.localhost:3000>. Full portal, purple and amber, in the
college's own words, with all 310 seeded members behind it.

**4. Tune it against the real style guide.**

The college sends its guidelines. Their crest is in vector, their letterhead
grey is pinned at `#4A4A4A`, and they do not want donations until the trust's
FCRA position is settled. Edit `brands/fidelis.json` and nothing else — no
component, no stylesheet, no rebuild of the design system.

The pack file is a complete pack, not a patch, so these keys are merged into
the file the scaffold wrote rather than replacing it:

```json
{
  "color": {
    "primary": "#5B2B8C",
    "accent": "#C8811E",
    "surface": "#FAF7FB",
    "neutralChroma": 0.016,
    "overrides": {
      "--text-secondary": "#4A4A4A"
    }
  },
  "assets": {
    "crest": "/brand/fidelis/crest.svg",
    "logoPrimary": "/brand/fidelis/logo.svg",
    "favicon": "/brand/fidelis/icon-512.png"
  },
  "copy": {
    "tagline": "Mangaluru · Since 1987",
    "supportEmail": "alumni@fidelis.example.ac.in",
    "addressLines": [
      "St Fidelis College of Engineering",
      "Bejai, Mangaluru — 575004",
      "Karnataka, India"
    ]
  }
}
```

`npm run brand:check` confirms `#4A4A4A` clears 4.5:1 on the new surface. If it
had not, the check would exit non-zero and the pack could not be published —
which is the conversation to have with the college's designer before launch,
not after.

**Time cost:** the scaffold and the registry edit are a few minutes. The real
schedule is the college finding its crest in vector and agreeing the hex
values, which in our experience is the longer half.
