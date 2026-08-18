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

const assetRef = z
  .string()
  .min(1)
  .refine(
    (v) => v.startsWith('/') || v.startsWith('https://') || v.startsWith('data:'),
    'Assets must be a site-relative path, an https URL, or a data URI',
  );

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
] as const;

export type OverridableToken = (typeof OVERRIDABLE_TOKENS)[number];

const overrides = z
  .record(z.string(), z.string().max(80))
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
  display: z.string().min(1).default('Fraunces'),
  body: z.string().min(1).default('Inter'),
  mono: z.string().min(1).default('IBM Plex Mono'),
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
        family: z.string(),
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

export const AssetSpec = z.object({
  logoPrimary: assetRef.optional(),
  logoInverse: assetRef.optional(),
  logoMark: assetRef.optional(),
  crest: assetRef.optional(),
  favicon: assetRef.optional(),
  ogImage: assetRef.optional(),
  heroImage: assetRef.optional(),
  /** Rendered behind the sign-in card. Falls back to a generated gradient. */
  authImage: assetRef.optional(),
});

export const CopySpec = z.object({
  portalName: z.string().min(2).max(60),
  institutionName: z.string().min(2).max(120),
  shortName: z.string().min(1).max(24),
  tagline: z.string().max(160).optional(),
  heroHeadline: z.string().max(120).optional(),
  heroSubhead: z.string().max(320).optional(),
  /** Circled by a marker stroke in the hero. Must appear inside heroHeadline. */
  heroEmphasis: z.string().max(60).optional(),
  supportEmail: z.string().email().optional(),
  supportPhone: z.string().max(24).optional(),
  addressLines: z.array(z.string().max(120)).max(5).default([]),
  websiteUrl: z.string().url().optional(),
  /** Footer credit. Kept configurable so a reseller can white-label us too. */
  poweredBy: z.string().max(60).optional(),
  poweredByUrl: z.string().url().optional(),
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
