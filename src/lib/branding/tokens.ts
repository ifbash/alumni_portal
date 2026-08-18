import {
  generateRamp,
  deriveNeutralRamp,
  contrastRatio,
  bestOn,
  mixHex,
  withAlpha,
  accessibleStop,
  validateContrast,
  STOPS,
  type Stop,
  type ContrastIssue,
} from './color';
import type { BrandPack } from './pack';

/**
 * Pack → CSS custom properties.
 *
 * Everything the UI can render reads a token from this file. No component
 * hardcodes a colour, a radius, a duration or a font, which is what makes
 * a new customer a JSON file rather than a branch.
 *
 * The same function runs on save (to validate and persist) and on render
 * (from cache), so what an admin previews is exactly what ships. That
 * property is worth more than any optimisation that would break it.
 */

export interface TokenSet {
  light: Record<string, string>;
  dark: Record<string, string>;
  /** Mode-independent: type, shape, motion, spacing. */
  base: Record<string, string>;
  issues: ContrastIssue[];
  /** True when an issue is severe enough to refuse publication. */
  blocking: boolean;
}

const RADIUS: Record<BrandPack['shape']['radius'], { sm: string; md: string; lg: string; xl: string }> = {
  none: { sm: '0px', md: '0px', lg: '0px', xl: '0px' },
  subtle: { sm: '4px', md: '8px', lg: '12px', xl: '18px' },
  rounded: { sm: '8px', md: '14px', lg: '20px', xl: '28px' },
  pill: { sm: '10px', md: '18px', lg: '26px', xl: '36px' },
};

const DENSITY: Record<BrandPack['shape']['density'], Record<string, string>> = {
  compact: {
    '--control-h-sm': '28px',
    '--control-h': '34px',
    '--control-h-lg': '40px',
    '--gutter': '16px',
    '--section-y': '40px',
    '--card-p': '16px',
    '--row-h': '40px',
  },
  comfortable: {
    '--control-h-sm': '32px',
    '--control-h': '40px',
    '--control-h-lg': '48px',
    '--gutter': '24px',
    '--section-y': '72px',
    '--card-p': '20px',
    '--row-h': '52px',
  },
};

const ELEVATION: Record<BrandPack['shape']['elevation'], { sm: string; md: string; lg: string }> = {
  flat: {
    sm: '0 0 0 1px var(--border)',
    md: '0 0 0 1px var(--border)',
    lg: '0 0 0 1px var(--border-strong)',
  },
  soft: {
    sm: '0 1px 2px var(--shadow-color)',
    md: '0 2px 8px -2px var(--shadow-color), 0 1px 3px var(--shadow-color)',
    lg: '0 12px 32px -8px var(--shadow-color), 0 4px 12px -4px var(--shadow-color)',
  },
  lifted: {
    sm: '0 2px 4px var(--shadow-color)',
    md: '0 6px 16px -4px var(--shadow-color), 0 2px 6px var(--shadow-color)',
    lg: '0 24px 56px -12px var(--shadow-color), 0 8px 20px -6px var(--shadow-color)',
  },
};

/**
 * Fluid display scale. `clamp` rather than breakpoints because the portal
 * is read on a ₹8,000 Android phone at least as often as on a laptop, and
 * a heading that only steps at 768px is oversized for the whole range
 * below it.
 */
function typeScale(scale: number): Record<string, string> {
  const s = (rem: number) => `${(rem * scale).toFixed(3)}rem`;
  const fluid = (min: number, max: number) =>
    `clamp(${s(min)}, ${(min * scale).toFixed(2)}rem + ${(((max - min) * scale) / 0.24).toFixed(2)}vw, ${s(max)})`;

  return {
    '--text-xs': s(0.75),
    '--text-sm': s(0.875),
    '--text-base': s(1),
    '--text-md': s(1.0625),
    '--text-lg': s(1.125),
    '--text-xl': s(1.25),
    '--display-xs': fluid(1.35, 1.6),
    '--display-sm': fluid(1.6, 1.95),
    '--display-md': fluid(1.95, 2.75),
    '--display-lg': fluid(2.3, 3.4),
    '--display-xl': fluid(2.6, 4.25),
  };
}

export function buildTokens(pack: BrandPack): TokenSet {
  const c = pack.color;

  const brand = generateRamp(c.primary);
  const accent = generateRamp(c.accent ?? c.primary);
  const neutral = deriveNeutralRamp(c.surface, c.neutralChroma);
  const neutralDark = deriveNeutralRamp(c.surfaceDark, c.neutralChroma);

  const surface = c.surface;
  const surfaceDark = c.surfaceDark;
  const ink = c.ink ?? neutral[900];
  const paper = neutral[50];

  // ---------------------------------------------------------------
  // Light
  // ---------------------------------------------------------------

  const light: Record<string, string> = {};

  for (const s of STOPS) {
    light[`--brand-${s}`] = brand[s as Stop];
    light[`--accent-${s}`] = accent[s as Stop];
    light[`--neutral-${s}`] = neutral[s as Stop];
  }

  light['--surface'] = surface;
  light['--surface-raised'] = contrastRatio(surface, '#ffffff') > 1.06 ? '#ffffff' : neutral[50];
  light['--surface-sunken'] = mixHex(surface, brand[900], 0.04);
  light['--surface-inverse'] = ink;

  light['--text-primary'] = bestOn(surface, [ink, neutral[900], '#111111', '#ffffff']);
  light['--text-secondary'] = accessibleStop(neutral, surface, 4.5).hex;
  light['--text-muted'] = accessibleStop(neutral, surface, 3.2).hex;
  light['--text-on-inverse'] = bestOn(ink, [paper, '#ffffff', ink]);

  light['--border'] = mixHex(surface, ink, 0.11);
  light['--border-strong'] = mixHex(surface, ink, 0.24);

  // Brand-coloured *text* is the token most likely to fail for a pale or
  // a very light brand colour, so it walks the ramp rather than assuming
  // stop 600 works.
  //
  // It walks against the harder of `--surface` and `--surface-raised`,
  // because those are two different grounds and this one token lands on
  // both: a sentence on the page, and the same sentence inside a card.
  // Measuring only the page shipped `--brand-fg` at 4.19:1 on cards in
  // dark mode — passing where it was checked, failing where it was used.
  const brandGround = worseGround(surface, light['--surface-raised']!, brand, 'darker');
  light['--brand-fg'] = accessibleStop(brand, brandGround, 4.5).hex;
  light['--brand-soft'] = mixHex(surface, brand[500], 0.1);
  light['--brand-soft-fg'] = accessibleStop(brand, mixHex(surface, brand[500], 0.1), 4.5).hex;

  const accentGround = worseGround(surface, light['--surface-raised']!, accent, 'darker');
  light['--accent-fg'] = accessibleStop(accent, accentGround, 4.5).hex;
  light['--accent-soft'] = mixHex(surface, accent[500], 0.1);
  light['--accent-soft-fg'] = accessibleStop(accent, mixHex(surface, accent[500], 0.1), 4.5).hex;

  const btn = pickFill(brand, [600, 700, 500, 800], [paper, '#ffffff', ink, '#111111']);
  light['--button-primary-bg'] = btn.fill;
  light['--button-primary-hover'] = brand[btn.stop === 600 ? 700 : 800] ?? brand[700];
  light['--button-primary-fg'] = btn.label;

  light['--focus-ring'] = accessibleStop(brand, surface, 3, 'darker').hex;
  light['--shadow-color'] = withAlpha(ink, 0.1);
  light['--overlay'] = withAlpha(ink, 0.55);
  light['--marker'] = c.marker ?? accent[500];

  applyStatus(light, surface, c, ink, paper);

  // ---------------------------------------------------------------
  // Dark
  // ---------------------------------------------------------------
  //
  // Derived, never configured. Asking a college to pick a second palette
  // produces a second bad palette; inverting the ramp keeps both modes
  // coherent for free. The stops used for fills move *up* the scale so
  // they read against a dark ground.

  // The three ramps stay *absolute*: `--brand-600` is the same colour in
  // both modes. Only the semantic tokens below flip. A stop that changed
  // meaning between modes would make every component that touched a raw
  // stop a two-mode debugging problem, so components read semantics
  // (`surface-raised`, `text-muted`, `border`) and the ramps exist for
  // the handful of places a specific step is designed in.

  const dark: Record<string, string> = {};

  const inkText = bestOn(surfaceDark, ['#f4f4f5', neutralDark[100], '#111111']);

  dark['--surface'] = surfaceDark;
  dark['--surface-raised'] = mixHex(surfaceDark, '#ffffff', 0.05);
  dark['--surface-sunken'] = mixHex(surfaceDark, '#000000', 0.35);
  dark['--surface-inverse'] = mixHex(surfaceDark, '#ffffff', 0.92);

  dark['--text-primary'] = inkText;
  dark['--text-secondary'] = mixHex(surfaceDark, inkText, 0.72);
  dark['--text-muted'] = mixHex(surfaceDark, inkText, 0.5);
  dark['--text-on-inverse'] = surfaceDark;

  dark['--border'] = mixHex(surfaceDark, '#ffffff', 0.13);
  dark['--border-strong'] = mixHex(surfaceDark, '#ffffff', 0.28);

  // Same two grounds as in light mode, and the raised surface is the
  // harder one here too — it is the surface mixed 5% toward white.
  const brandGroundDark = worseGround(surfaceDark, dark['--surface-raised']!, brand, 'lighter');
  dark['--brand-fg'] = accessibleStop(brand, brandGroundDark, 4.5, 'lighter').hex;
  dark['--brand-soft'] = mixHex(surfaceDark, brand[400], 0.16);
  dark['--brand-soft-fg'] = accessibleStop(brand, mixHex(surfaceDark, brand[400], 0.16), 4.5, 'lighter').hex;

  const accentGroundDark = worseGround(surfaceDark, dark['--surface-raised']!, accent, 'lighter');
  dark['--accent-fg'] = accessibleStop(accent, accentGroundDark, 4.5, 'lighter').hex;
  dark['--accent-soft'] = mixHex(surfaceDark, accent[400], 0.16);
  dark['--accent-soft-fg'] = accessibleStop(accent, mixHex(surfaceDark, accent[400], 0.16), 4.5, 'lighter').hex;

  const btnDark = pickFill(brand, [500, 400, 600, 300], ['#ffffff', '#0b0b0c', surfaceDark, ink]);
  dark['--button-primary-bg'] = btnDark.fill;
  dark['--button-primary-hover'] = brand[btnDark.stop === 500 ? 400 : 300] ?? brand[400];
  dark['--button-primary-fg'] = btnDark.label;

  dark['--focus-ring'] = accessibleStop(brand, surfaceDark, 3, 'lighter').hex;
  dark['--shadow-color'] = 'rgb(0 0 0 / 0.5)';
  dark['--overlay'] = 'rgb(0 0 0 / 0.7)';
  dark['--marker'] = c.marker ?? accent[400];

  applyStatus(dark, surfaceDark, c, '#000000', '#ffffff', 'dark');

  // ---------------------------------------------------------------
  // Mode-independent
  // ---------------------------------------------------------------

  const r = RADIUS[pack.shape.radius];
  const e = ELEVATION[pack.shape.elevation];

  const base: Record<string, string> = {
    '--radius-sm': r.sm,
    '--radius': r.md,
    '--radius-lg': r.lg,
    '--radius-xl': r.xl,
    '--radius-full': '9999px',
    '--border-width': pack.shape.borderWidth === 'hairline' ? '1px' : '1.5px',

    '--font-display': fontStack(pack.type.display, 'display'),
    '--font-body': fontStack(pack.type.body, 'body'),
    '--font-mono': fontStack(pack.type.mono, 'mono'),
    '--tracking-display': pack.type.displayTracking,
    ...typeScale(pack.type.scale),

    ...DENSITY[pack.shape.density],
    '--page-max': '1200px',
    '--prose-max': '68ch',

    '--shadow-sm': e.sm,
    '--shadow-md': e.md,
    '--shadow-lg': e.lg,
    '--shadow-glow': '0 0 0 1px var(--brand-soft), 0 8px 28px -8px var(--brand-500)',

    '--ease': 'cubic-bezier(0.32, 0.72, 0, 1)',
    '--dur-fast': '120ms',
    '--dur': '200ms',
    '--dur-slow': '380ms',
  };

  // Customer overrides land last so they beat every derivation. This is
  // the escape hatch for the one colour a brand guideline pins exactly —
  // and the most likely source of an inaccessible token, which is why
  // `auditTokens` runs *after* this rather than before.
  Object.assign(light, c.overrides);
  Object.assign(dark, c.darkOverrides);

  // Only the tokens the UI actually renders are audited. Checking raw
  // ramp stops instead produced warnings about steps nothing uses — a
  // border check against `brand-400` when borders are drawn from
  // `--border-strong` — and warnings nobody can act on get ignored,
  // including the ones that matter.
  const issues = [...auditTokens(light, 'light'), ...auditTokens(dark, 'dark')];

  return {
    light,
    dark,
    base,
    issues,
    blocking: issues.some((i) => i.severity === 'error'),
  };
}

/**
 * Choose a fill whose label is legible on it.
 *
 * Naming a stop and hoping is what makes a primary button unreadable for
 * one customer in twenty — a saturated mid-tone sits in the dead zone
 * where neither white nor black clears 4.5:1. Walking candidate stops
 * until the pairing passes costs nothing and removes the failure mode.
 */
function pickFill(
  ramp: Record<Stop, string>,
  candidates: Stop[],
  labels: string[],
): { stop: Stop; fill: string; label: string } {
  let best = { stop: candidates[0]!, fill: ramp[candidates[0]!], label: labels[0]!, ratio: 0 };

  for (const stop of candidates) {
    const fill = ramp[stop];
    const label = bestOn(fill, labels);
    const ratio = contrastRatio(fill, label);
    if (ratio >= 4.5) return { stop, fill, label };
    if (ratio > best.ratio) best = { stop, fill, label, ratio };
  }

  return { stop: best.stop, fill: best.fill, label: best.label };
}

function applyStatus(
  out: Record<string, string>,
  surface: string,
  c: BrandPack['color'],
  ink: string,
  paper: string,
  mode: 'light' | 'dark' = 'light',
): void {
  const dir = mode === 'light' ? 'darker' : 'lighter';

  for (const name of ['success', 'warning', 'danger', 'info'] as const) {
    const seed = c[name];
    const ramp = generateRamp(seed);
    const fill = mode === 'light' ? ramp[600] : ramp[500];

    // Derived before the foreground, because the foreground has to clear
    // this ground as well as the page.
    const soft = mixHex(surface, ramp[mode === 'light' ? 500 : 400], mode === 'light' ? 0.12 : 0.18);

    /**
     * `--{status}-fg` is used on two different grounds — plain `--surface`
     * in body copy, and `--{status}-soft` inside an Alert or a Badge —
     * and `soft` is the harder of the two, because it is a tint of the
     * surface *toward the status hue*, so it always sits closer to the
     * text than the surface does.
     *
     * Deriving against the surface alone shipped a foreground that read
     * fine as a sentence and dropped to 4.21:1 light / 3.79:1 dark the
     * moment the same token was put inside its own tinted panel — under
     * AA in both modes, on all four packs. Walking the ramp against the
     * worse ground fixes both uses at once, and costs a step or two of
     * darkness on the ground that was already fine.
     */
    const fg = accessibleStop(ramp, worseGround(surface, soft, ramp, dir), 4.5, dir).hex;

    out[`--${name}`] = fill;
    out[`--${name}-fg`] = fg;
    out[`--${name}-soft`] = soft;
    out[`--${name}-on`] = bestOn(fill, [paper, '#ffffff', ink, '#111111']);
  }
}

/**
 * Of two grounds the same foreground will sit on, the one that will
 * demand the darker (or lighter) step.
 *
 * Measured rather than assumed: which ground is harder depends on the
 * hue and on the mode, and picking by intuition gets it backwards for
 * warning in dark mode.
 */
function worseGround(
  a: string,
  b: string,
  ramp: Record<Stop, string>,
  dir: 'darker' | 'lighter',
): string {
  const stopA = accessibleStop(ramp, a, 4.5, dir);
  const stopB = accessibleStop(ramp, b, 4.5, dir);
  // A later stop in the walk direction means that ground was harder.
  const order = dir === 'darker' ? [...STOPS] : [...STOPS].reverse();
  return order.indexOf(stopA.stop) >= order.indexOf(stopB.stop) ? a : b;
}

/**
 * Post-derivation audit.
 *
 * `validateContrast` checks the raw ramp; this checks the tokens the UI
 * actually renders, including anything a customer pinned via `overrides`.
 * A pinned colour is exactly where an inaccessible value gets in.
 */
function auditTokens(t: Record<string, string>, mode: 'light' | 'dark'): ContrastIssue[] {
  const issues: ContrastIssue[] = [];
  const surface = t['--surface']!;

  const checks: Array<[string, string, string, number, 'error' | 'warning']> = [
    ['--text-primary', t['--text-primary']!, surface, 7, 'error'],
    ['--text-secondary', t['--text-secondary']!, surface, 4.5, 'error'],
    ['--text-muted', t['--text-muted']!, surface, 3, 'warning'],
    ['--brand-fg', t['--brand-fg']!, surface, 4.5, 'error'],
    ['--brand-soft-fg', t['--brand-soft-fg']!, t['--brand-soft']!, 4.5, 'error'],
    ['--accent-fg', t['--accent-fg']!, surface, 4.5, 'warning'],
    ['--button-primary-fg', t['--button-primary-fg']!, t['--button-primary-bg']!, 4.5, 'error'],
    ['--focus-ring', t['--focus-ring']!, surface, 3, 'error'],
    ['--border-strong', t['--border-strong']!, surface, 1.6, 'warning'],
    ['--danger-fg', t['--danger-fg']!, surface, 4.5, 'error'],
    ['--text-on-inverse', t['--text-on-inverse']!, t['--surface-inverse']!, 4.5, 'error'],
  ];

  for (const [token, fg, bg, required, severity] of checks) {
    if (!fg || !bg || fg.startsWith('rgb')) continue;
    const ratio = contrastRatio(fg, bg);
    if (ratio < required) {
      issues.push({
        token: `${token}${mode === 'dark' ? ' (dark)' : ''}`,
        against: bg,
        ratio: Number(ratio.toFixed(2)),
        required,
        severity,
      });
    }
  }

  return issues;
}

function fontStack(family: string, role: 'display' | 'body' | 'mono'): string {
  const fallback =
    role === 'mono'
      ? 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace'
      : role === 'display'
        ? 'ui-sans-serif, system-ui, Georgia, serif'
        : 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
  return `"${family}", ${fallback}`;
}

/**
 * Serialise to a `<style>` body, emitted server-side into the head.
 *
 * Inline rather than a stylesheet request: a fetch would give one frame of
 * default branding, which on a white-label portal reads as a broken site
 * rather than as loading.
 *
 * Dark mode is applied both by media query (respects the OS) and by an
 * explicit `data-theme` attribute (respects the user's toggle), with the
 * attribute winning in both directions.
 */
export function tokensToCss(tokens: TokenSet): string {
  const decl = (t: Record<string, string>) =>
    Object.entries(t)
      .map(([k, v]) => `${k}:${v}`)
      .join(';');

  const d = decl(tokens.dark);

  return [
    `:root{${decl(tokens.base)};${decl(tokens.light)}}`,
    `@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){${d}}}`,
    `[data-theme="dark"]{${d}}`,
  ].join('');
}

/** `@font-face` rules for a pack that self-hosts its typefaces. */
export function fontFaceCss(pack: BrandPack): string {
  if (pack.type.source !== 'local') return '';
  return pack.type.fontFaces
    .map(
      (f) =>
        `@font-face{font-family:"${f.family}";src:url("${f.src}") format("${format(f.src)}");` +
        `font-weight:${f.weight};font-style:${f.style};font-display:swap}`,
    )
    .join('');
}

function format(src: string): string {
  if (src.endsWith('.woff2')) return 'woff2';
  if (src.endsWith('.woff')) return 'woff';
  if (src.endsWith('.otf')) return 'opentype';
  return 'truetype';
}

/**
 * Runtime font loading for packs that use Google Fonts. Build-time
 * (`next/font`) cannot serve a typeface chosen after deploy, which is the
 * whole point of a configurable brand.
 */
export function googleFontsHref(pack: BrandPack): string | null {
  if (pack.type.source !== 'google') return null;
  const families = [...new Set([pack.type.display, pack.type.body, pack.type.mono])]
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

export function contrastReport(pack: BrandPack) {
  const { issues, blocking } = buildTokens(pack);
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  return {
    passes: !blocking,
    errors,
    warnings,
    summary: blocking
      ? `${errors.length} contrast failure${errors.length === 1 ? '' : 's'} — these colours cannot be published.`
      : warnings.length
        ? `Publishable, with ${warnings.length} warning${warnings.length === 1 ? '' : 's'} worth reviewing.`
        : 'All contrast checks pass.',
  };
}
