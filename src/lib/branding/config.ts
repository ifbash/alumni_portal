import { z } from 'zod';
import { type BrandPackInput, type DeepPartial } from './pack';
import { resolvePack } from './registry';
import { buildTokens, contrastReport, tokensToCss, googleFontsHref } from './tokens';

/**
 * The admin-facing branding form.
 *
 * A brand pack (`pack.ts`) is the full identity and can express things no
 * college will ever type into a form — font-face declarations, feature
 * flags, token overrides. This is the *subset* an administrator edits in
 * the browser and the subset persisted in `tenant_branding`.
 *
 * Keeping the two apart matters: the pack is the contract the design
 * system reads, and the form is one of several ways to write to it. A
 * reseller shipping fifty colleges edits JSON; a college registrar edits
 * this. Neither can reach anything the other cannot.
 */

const hex = z
  .string()
  .regex(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a hex colour')
  .transform((h) => (h.startsWith('#') ? h : `#${h}`));

const url = z.string().url().or(z.string().startsWith('/'));

export const BrandingInput = z.object({
  /** Which pack to build on. Everything below is a delta from it. */
  basePackId: z.string().regex(/^[a-z0-9-]{2,32}$/).nullable().default(null),

  primary: hex,
  accent: hex.optional(),
  surface: hex.default('#ffffff'),
  surfaceDark: hex.default('#0f1115'),

  logoPrimary: url.optional(),
  logoInverse: url.optional(),
  logoMark: url.optional(),
  crest: url.optional(),
  ogImage: url.optional(),
  heroImage: url.optional(),

  fontDisplay: z.string().min(1).default('Fraunces'),
  fontBody: z.string().min(1).default('Inter'),

  portalName: z.string().min(2).max(60),
  institutionName: z.string().min(2).max(120).optional(),
  shortName: z.string().min(1).max(24).optional(),
  tagline: z.string().max(160).optional(),
  supportEmail: z.string().email().optional(),

  radius: z.enum(['none', 'subtle', 'rounded', 'pill']).default('subtle'),
  density: z.enum(['compact', 'comfortable']).default('comfortable'),
  elevation: z.enum(['flat', 'soft', 'lifted']).default('soft'),
});

export type BrandingInput = z.infer<typeof BrandingInput>;

/** Form values → a sparse pack patch. Undefined fields leave the base alone. */
export function toPackPatch(input: BrandingInput): DeepPartial<BrandPackInput> {
  return {
    color: {
      primary: input.primary,
      accent: input.accent,
      surface: input.surface,
      surfaceDark: input.surfaceDark,
    },
    type: { display: input.fontDisplay, body: input.fontBody },
    shape: { radius: input.radius, density: input.density, elevation: input.elevation },
    assets: {
      logoPrimary: input.logoPrimary,
      logoInverse: input.logoInverse,
      logoMark: input.logoMark,
      crest: input.crest,
      ogImage: input.ogImage,
      heroImage: input.heroImage,
    },
    copy: {
      portalName: input.portalName,
      institutionName: input.institutionName,
      shortName: input.shortName,
      tagline: input.tagline,
      supportEmail: input.supportEmail,
    },
  };
}

/**
 * Validate a submitted form without saving it.
 *
 * Errors block publication; warnings do not. The distinction is
 * deliberate — a college that picks a pale gold for its accent should be
 * told the muted text is marginal, but should not be stopped from
 * shipping over it. Body text that nobody can read is a different
 * category and is refused outright.
 */
export function validateBranding(input: unknown) {
  const parsed = BrandingInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      fieldErrors: parsed.error.flatten().fieldErrors,
      report: null,
      css: null,
    };
  }

  const pack = resolvePack({ packId: parsed.data.basePackId, preview: toPackPatch(parsed.data) });
  const tokens = buildTokens(pack);

  return {
    ok: !tokens.blocking,
    fieldErrors: {},
    report: contrastReport(pack),
    css: tokensToCss(tokens),
    fontHref: googleFontsHref(pack),
    pack,
  };
}

/** Seed values for a tenant that has configured nothing yet. */
export const FALLBACK: BrandingInput = BrandingInput.parse({
  basePackId: null,
  primary: '#1f3864',
  surface: '#ffffff',
  portalName: 'Alumni Portal',
});

export { contrastReport };
