import { z } from 'zod';

/**
 * A brand pack is the whole visual identity of one customer, in one
 * object.
 *
 * This is the product's white-label seam. Selling the portal to a second
 * college must not mean touching a component, a stylesheet, or a build —
 * it means adding a JSON file to `brands/` (or a row in `tenant_branding`)
 * and pointing a subdomain at it. Everything the UI renders that could
 * differ between customers is named here and nowhere else.
 *
 * Three rules keep it that way:
 *
 *  1. **Seeds in, tokens out.** A customer supplies colours they can name
 *     from their own style guide — a primary, an accent, a page colour.
 *     The 10-stop ramps, hover states, tinted fills and text-on-brand
 *     pairings are derived (see `tokens.ts`). Colleges have a crest and a
 *     hex code, not a design system; asking for eleven stops gets eleven
 *     bad stops.
 *  2. **No free-form CSS.** `overrides` accepts values for *named* tokens
 *     only. Unbounded theming turns every support ticket into CSS
 *     archaeology and makes the design system unmaintainable across
 *     tenants.
 *  3. **Copy travels with the brand.** Portal name, tagline, the words on
 *     the empty states — a demo for a new customer should be reskinnable
 *     in an afternoon, and half of "looks like ours" is wording.
 */

// ---------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------

const hex = z
  .string()
  .regex(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a hex colour like #B23A2B')
  .transform((h) => (h.startsWith('#') ? h : `#${h}`));

/**
 * Anything that ends up inside a CSS `url("...")` or an HTML attribute must
 * not be able to close the quote, the parenthesis or the element around it.
 * Real asset paths and base64 data URIs contain none of these.
 */
const NO_BREAKOUT_CHARS = /["'()\\<>\s;{}]/;

/** A site-relative path ("/x", never "//host/x") or an https URL. */
export function isSafeUrl(v: string): boolean {
  if (NO_BREAKOUT_CHARS.test(v)) return false;
  return v.startsWith('https://') || (v.startsWith('/') && !v.startsWith('//'));
}

const assetRef = z
  .string()
  .min(1)
  .refine(
    (v) => !NO_BREAKOUT_CHARS.test(v) && (isSafeUrl(v) || v.startsWith('data:')),
    'Assets must be a site-relative path, an https URL, or a data URI, with no quotes, brackets or spaces',
  );

/**
 * A typeface name as it appears in a stylesheet and a Google Fonts query.
 * Letters, digits, spaces, dots, underscores and hyphens: every real font
 * family, and nothing that can close a string or a rule.
 */
export const fontFamilyName = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,59}$/, 'A font name may contain only letters, digits, spaces, dots, underscores and hyphens');

/**
 * The right-hand side of a colour override: hex, rgb(), hsl(), oklch(),
 * var(). No `;`, braces, quotes, backslashes or angle brackets - the
 * characters needed to leave the declaration and write a rule of one's own.
 */
export const cssColourValue = z
  .string()
  .max(80)
  .regex(/^[#A-Za-z0-9(),.%/\s-]+$/, 'An override must be a colour value such as #9E2A4B or oklch(0.5 0.1 20)');

/** CSS `object-position` for a photograph: which part of it survives the crop. */
const focusPoint = z.string().regex(/^\d{1,3}% \d{1,3}%$/, 'Use "x% y%", for example "50% 35%"');

/**
 * A direct video file, never a page that embeds one. `frame-src` stays
 * `'none'`, and a YouTube link would need it opened for every tenant.
 */
const videoRef = z
  .string()
  .min(1)
  .refine((v) => v.startsWith('/') || v.startsWith('https://'), 'A hero video must be a site-relative path or an https URL')
  .refine(
    (v) => /\.(mp4|webm)(\?[^#]*)?$/i.test(v),
    'A hero video must be a direct .mp4 or .webm file. YouTube, Vimeo and other embed links are not supported.',
  );

/**
 * One photograph for the landing page's campus band. Alt text is
 * required: these carry content (what the campus looks like), so they are
 * never decorative.
 */
export const CampusPhoto = z.object({
  src: assetRef,
  alt: z.string().trim().min(1, 'Every campus photo needs alt text describing what it shows').max(160),
  caption: z.string().trim().max(120).optional(),
  focus: focusPoint.optional(),

  // Where a photo may appear after sign-in. Tag a photo only when the tag
  // is true of what it shows: a photo tagged `batchYear: 2015` heads the
  // 2015 batch page, so it has to be of that batch. An untagged photo is
  // only ever dealt to the college-level bands (home, giving, profile),
  // and a tagged one leaves that pool. See `src/lib/branding/media.ts`.

  /** Signed-in bands this photo is chosen for, first match wins. Tag a photo only when the tag is true of what it shows. */
  use: z.array(z.enum(['home', 'giving', 'profile'])).max(3).optional(),
  /** The graduating batch this photo shows. Tag a photo only when the tag is true of what it shows. */
  batchYear: z.number().int().min(1950).max(2100).optional(),
  /** The branch (department code) this photo shows. Tag a photo only when the tag is true of what it shows. */
  departmentCode: z.string().trim().min(1).max(12).optional(),
});

/** Token names an override is allowed to set. Anything else is rejected. */
export const OVERRIDABLE_TOKENS = [
  '--surface',
  '--surface-raised',
  '--surface-sunken',
  '--surface-inverse',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--text-on-brand',
  '--text-on-inverse',
  '--border',
  '--border-strong',
  '--brand-fg',
  '--brand-soft',
  '--brand-soft-fg',
  '--accent-fg',
  '--accent-soft',
  '--accent-soft-fg',
  '--marker',
  '--focus-ring',
  '--button-primary-bg',
  '--button-primary-hover',
  '--button-primary-fg',
  '--success',
  '--warning',
  '--danger',
  '--info',
  '--shadow-color',
  /** The college band. Hex only; any other value is ignored with a warning. */
  '--band',
] as const;

export type OverridableToken = (typeof OVERRIDABLE_TOKENS)[number];

const overrides = z
  .record(z.string(), cssColourValue)
  .refine(
    (o) => Object.keys(o).every((k) => (OVERRIDABLE_TOKENS as readonly string[]).includes(k)),
    { message: `Only these tokens may be overridden: ${OVERRIDABLE_TOKENS.join(', ')}` },
  )
  .default({});

// ---------------------------------------------------------------
// Sections
// ---------------------------------------------------------------

export const ColorSpec = z.object({
  /** The one colour a customer always knows. Drives the whole primary ramp. */
  primary: hex,
  /**
   * Secondary hue. Optional on purpose — most colleges have one colour,
   * and a second badly-chosen one is worse than none. Falls back to the
   * primary, which yields a monochrome scheme that always reads as
   * deliberate.
   */
  accent: hex.optional(),
  /** Page background. Warm off-whites read as designed; #fff reads as unstyled. */
  surface: hex.default('#ffffff'),
  /** Dark-mode page background. The rest of dark mode is derived from it. */
  surfaceDark: hex.default('#0f1115'),
  /** Ink used for headings and dark bands. Derived from the neutral ramp if unset. */
  ink: hex.optional(),
  /**
   * Highlighter colour for hand-drawn annotation marks. Decorative only —
   * never a fill, never body text (see the hand-drawn layer in
   * `components/brand/Marks.tsx`).
   */
  marker: hex.optional(),
  /**
   * How much of the brand hue bleeds into greys. 0 gives neutral greys,
   * higher values tint borders and muted text toward the brand.
   */
  neutralChroma: z.number().min(0).max(0.05).default(0.012),

  success: hex.default('#15803d'),
  warning: hex.default('#b45309'),
  danger: hex.default('#b42318'),
  info: hex.default('#1d4ed8'),

  overrides,
  /**
   * Overrides for dark mode only.
   *
   * Kept separate because almost every pinnable token is a light/dark
   * pair: an ink that a brand guideline fixes for headings on paper is,
   * applied unchanged to a dark ground, ink on ink. Pinning `overrides`
   * alone used to make dark mode unreadable for exactly the customers
   * whose guidelines were most specific.
   */
  darkOverrides: overrides,
});

export const TypeSpec = z.object({
  display: fontFamilyName.default('Fraunces'),
  body: fontFamilyName.default('Inter'),
  mono: fontFamilyName.default('IBM Plex Mono'),
  /**
   * `local` self-hosts from `/public/fonts` (declared in `fontFaces`);
   * `google` fetches at runtime. Runtime matters: `next/font` resolves at
   * build time and so cannot serve a typeface a customer picks after
   * deploy.
   */
  source: z.enum(['google', 'local', 'system']).default('google'),
  /** Only read when `source: 'local'`. */
  fontFaces: z
    .array(
      z.object({
        family: fontFamilyName,
        src: assetRef,
        weight: z.string().default('400'),
        style: z.enum(['normal', 'italic']).default('normal'),
      }),
    )
    .default([]),
  /** Display headings are usually set tighter than body copy. */
  displayTracking: z.string().default('-0.02em'),
  /** Multiplied into every step of the display scale. */
  scale: z.number().min(0.8).max(1.3).default(1),
});

export const ShapeSpec = z.object({
  radius: z.enum(['none', 'subtle', 'rounded', 'pill']).default('subtle'),
  /** `compact` shrinks control heights and gutters for data-dense admin work. */
  density: z.enum(['compact', 'comfortable']).default('comfortable'),
  borderWidth: z.enum(['hairline', 'standard']).default('hairline'),
  /** `flat` suits institutional brands; `lifted` suits consumer-feeling ones. */
  elevation: z.enum(['flat', 'soft', 'lifted']).default('soft'),
});

/**
 * Every media slot renders nothing when it is absent: no empty frame, no
 * "photo coming soon", no stand-in art. A college with no photographs yet
 * gets the solid college band, which is designed, not a gap.
 */
export const AssetSpec = z
  .object({
    logoPrimary: assetRef.optional(),
    logoInverse: assetRef.optional(),
    logoMark: assetRef.optional(),
    crest: assetRef.optional(),
    favicon: assetRef.optional(),
    ogImage: assetRef.optional(),
    /** Landing hero photograph. Landscape, 2400×1350 or larger, WebP/AVIF/JPEG under 350 KB. */
    heroImage: assetRef.optional(),
    /** One sentence on what the hero photograph shows. Absent means decorative (`alt=""`). */
    heroImageAlt: z.string().trim().min(1).max(160).optional(),
    /** `object-position` for heroImage and heroVideo. */
    heroFocus: focusPoint.default('50% 50%'),
    /**
     * Muted desktop loop (.mp4/.webm, 10–20 s, ≤ 6 MB). Never loaded below
     * 1024px, with reduced motion, or with Save-Data. heroImage is its poster.
     */
    heroVideo: videoRef.optional(),
    /** The landing page's "Around the campus" band. Empty means the section is omitted. */
    campusPhotos: z.array(CampusPhoto).max(8, 'At most eight campus photos').default([]),
    /** Desktop sign-in panel photograph. Falls back to heroImage, then to the solid college band. */
    authImage: assetRef.optional(),
    /** `object-position` for the sign-in panel photograph. */
    authFocus: focusPoint.default('50% 50%'),
  })
  .superRefine((a, ctx) => {
    if (a.heroVideo && !a.heroImage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['heroVideo'],
        message:
          'heroVideo needs heroImage: it is the poster, the phone fallback, and what reduced-motion and Save-Data visitors see.',
      });
    }
  });

export const CopySpec = z.object({
  portalName: z.string().min(2).max(60),
  institutionName: z.string().min(2).max(120),
  shortName: z.string().min(1).max(24),
  tagline: z.string().max(160).optional(),
  heroHeadline: z.string().max(120).optional(),
  heroSubhead: z.string().max(320).optional(),
  /**
   * Set in the band's accent colour in the hero (underlined in it over a
   * photo). Must appear inside heroHeadline.
   */
  heroEmphasis: z.string().max(60).optional(),
  supportEmail: z.string().email().optional(),
  supportPhone: z.string().max(24).optional(),
  addressLines: z.array(z.string().max(120)).max(5).default([]),
  websiteUrl: z.string().url().refine((v) => v.startsWith('https://') || v.startsWith('http://'), 'Use an http(s) address').optional(),
  /** Footer credit. Kept configurable so a reseller can white-label us too. */
  poweredBy: z.string().max(60).optional(),
  poweredByUrl: z.string().url().refine((v) => v.startsWith('https://') || v.startsWith('http://'), 'Use an http(s) address').optional(),

  /** The office that runs the portal. Used mid-sentence, as in "Contact the {officeName}". */
  officeName: z.string().trim().min(2).max(60).default('alumni cell'),
  /** The college's own affiliation wording, shown in the footer and the sign-in panel. Absent means not shown. */
  affiliationLine: z.string().trim().max(160).optional(),
  /** What the college calls the number on its certificates ("Roll number", "USN", "Hall ticket number"). */
  rollNumberLabel: z.string().trim().min(2).max(40).default('Roll number'),
  /** The printed format, confirmed by the examinations branch. Absent means no example anywhere. */
  rollNumberExample: z.string().trim().min(4).max(24).optional(),
  /** Documents the number is printed on, most likely first. */
  rollNumberSources: z
    .array(z.string().trim().min(2).max(60))
    .min(2)
    .max(6)
    .default(['Degree certificate', 'Marks memos', 'Provisional certificate', 'Hall tickets']),
  /** How long a manual review takes, for example "three working days". Absent means no promise is made. */
  reviewTurnaround: z.string().trim().min(3).max(40).optional(),
  /**
   * How long the office takes to answer a sign-in problem, for example "one
   * working day". Absent means /contact states no time for it.
   */
  supportTurnaround: z.string().trim().min(3).max(40).optional(),
  /** The line prefilled into a WhatsApp share. */
  shareText: z.string().trim().max(200).optional(),
  /** College-authored notices for the landing page. Never generated from member rows. */
  announcements: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(90),
        body: z.string().trim().max(200).optional(),
        date: z.string().date().optional(),
        until: z.string().date().optional(),
        href: z
          .string()
          .max(300)
          .refine(isSafeUrl, 'Site-relative path or https URL')
          .optional(),
        linkLabel: z.string().trim().max(40).optional(),
      }),
    )
    .max(3)
    .default([]),
  /** A message from the college (usually the Principal), text only. Renders nothing when absent. */
  collegeMessage: z
    .object({
      heading: z.string().trim().max(80).optional(),
      body: z.string().trim().min(40).max(900),
      name: z.string().trim().min(2).max(80),
      role: z.string().trim().min(2).max(80),
    })
    .optional(),

  // ---- Signed-in copy ------------------------------------------------

  /** The greeting on the signed-in home, before the member's first name. */
  greeting: z.string().trim().min(2).max(24).default('Namaste'),
  /**
   * Who a staff role publishes news as ("Placement cell"). Absent keys
   * fall back to generic desk names; see `deskFor()` in `copy.ts`.
   */
  newsDesks: z
    .object({
      college_admin: z.string().trim().min(2).max(60).optional(),
      alumni_cell_operator: z.string().trim().min(2).max(60).optional(),
      placement_officer: z.string().trim().min(2).max(60).optional(),
    })
    .default({}),
  /**
   * How long the placement cell takes to review a job posting, for example
   * "two working days". Absent means no promise is made anywhere.
   */
  jobReviewTurnaround: z.string().trim().min(3).max(40).optional(),
  /**
   * The trust's own member-facing words about donation receipts. Absent
   * means no receipt or tax claim appears anywhere a member reads.
   */
  donationReceiptNote: z.string().trim().min(3).max(120).optional(),
  /** What the trust calls its receipt, for example "80G receipt". Absent means "Receipt". */
  receiptLabel: z.string().trim().min(2).max(40).optional(),
});

/**
 * Features a customer has or has not bought — and, more often, has not yet
 * cleared legally. Donations stay dark until FCRA registration is
 * confirmed, so this is a hard gate in the navigation and in the route
 * guards, not a CSS class.
 */
export const FeatureSpec = z.object({
  directory: z.boolean().default(true),
  connections: z.boolean().default(true),
  events: z.boolean().default(true),
  jobs: z.boolean().default(true),
  mentorship: z.boolean().default(true),
  donations: z.boolean().default(false),
  gallery: z.boolean().default(true),
  news: z.boolean().default(true),
  whatsapp: z.boolean().default(false),
  publicLanding: z.boolean().default(true),
});

export const LocaleSpec = z.object({
  locale: z.string().default('en-IN'),
  currency: z.string().length(3).default('INR'),
  timeZone: z.string().default('Asia/Kolkata'),
  dateFormat: z.enum(['dd-MM-yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd']).default('dd-MM-yyyy'),
});

// ---------------------------------------------------------------
// The pack
// ---------------------------------------------------------------

export const BrandPack = z.object({
  /** Slug. Matches the filename in `brands/` and the tenant subdomain. */
  id: z.string().regex(/^[a-z0-9-]{2,32}$/, 'Lowercase slug, 2-32 chars'),
  version: z.number().int().min(1).default(1),
  color: ColorSpec,
  type: TypeSpec.default({}),
  shape: ShapeSpec.default({}),
  assets: AssetSpec.default({}),
  copy: CopySpec,
  features: FeatureSpec.default({}),
  locale: LocaleSpec.default({}),
});

export type BrandPack = z.infer<typeof BrandPack>;
export type BrandPackInput = z.input<typeof BrandPack>;
export type ColorSpec = z.infer<typeof ColorSpec>;
export type TypeSpec = z.infer<typeof TypeSpec>;
export type ShapeSpec = z.infer<typeof ShapeSpec>;
export type AssetSpec = z.infer<typeof AssetSpec>;
export type CopySpec = z.infer<typeof CopySpec>;
export type FeatureSpec = z.infer<typeof FeatureSpec>;
export type LocaleSpec = z.infer<typeof LocaleSpec>;
export type Feature = keyof FeatureSpec;

/**
 * Last-resort pack. Rendering unstyled HTML because a tenant row is
 * missing looks like an outage; rendering a plain, neutral portal looks
 * like a portal.
 */
export const DEFAULT_PACK: BrandPack = BrandPack.parse({
  id: 'default',
  color: { primary: '#1f3864', surface: '#ffffff' },
  copy: {
    portalName: 'Alumni Portal',
    institutionName: 'Alumni Portal',
    shortName: 'Alumni',
  },
});

/**
 * Deep merge of a partial pack over a base, section by section.
 *
 * The precedence chain is: DEFAULT_PACK → the file in `brands/` → the
 * `tenant_branding` row → an unsaved admin preview. Each layer only has
 * to state what it changes, so a college that wants nothing but a
 * different primary colour supplies exactly that.
 */
export function mergePack(base: BrandPack, patch: DeepPartial<BrandPackInput>): BrandPack {
  return BrandPack.parse({
    ...base,
    ...strip(patch),
    color: {
      ...base.color,
      ...strip(patch.color),
      overrides: { ...base.color.overrides, ...(patch.color?.overrides ?? {}) },
      darkOverrides: { ...base.color.darkOverrides, ...(patch.color?.darkOverrides ?? {}) },
    },
    type: { ...base.type, ...strip(patch.type) },
    shape: { ...base.shape, ...strip(patch.shape) },
    assets: { ...base.assets, ...strip(patch.assets) },
    copy: { ...base.copy, ...strip(patch.copy) },
    features: { ...base.features, ...strip(patch.features) },
    locale: { ...base.locale, ...strip(patch.locale) },
  });
}

/** Drop undefined keys so a sparse patch does not blank out the base. */
function strip<T extends object | undefined>(o: T): Partial<NonNullable<T>> {
  if (!o) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined && k !== 'overrides' && k !== 'darkOverrides') out[k] = v;
  }
  return out as Partial<NonNullable<T>>;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object | undefined ? DeepPartial<NonNullable<T[K]>> : T[K];
};

export function isFeatureOn(pack: BrandPack, feature: Feature): boolean {
  return pack.features[feature] === true;
}
