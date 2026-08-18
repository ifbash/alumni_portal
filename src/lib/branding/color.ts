/**
 * Colour derivation and contrast validation.
 *
 * A tenant supplies two or three seed colours. Everything else — the
 * 50..900 ramp, hover states, tinted surfaces, text-on-brand — is
 * derived. Colleges supply a crest and a hex code, not a design system,
 * and asking them for eleven stops produces eleven bad stops.
 *
 * Ramps are generated in OKLCH rather than HSL: HSL lightness is not
 * perceptually uniform, so an HSL ramp on a saturated blue and the same
 * ramp on a yellow produce wildly different perceived contrast. OKLCH
 * keeps the steps even across hues, which is what makes one algorithm
 * work for any college's colour.
 */

export type RGB = { r: number; g: number; b: number }; // 0..255
export type OKLCH = { l: number; c: number; h: number }; // l 0..1, c 0..0.4, h deg

// ---------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------

export function parseHex(hex: string): RGB {
  const s = hex.trim().replace(/^#/, '');
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Invalid hex colour: ${hex}`);
  }
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }: RGB): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

// ---------------------------------------------------------------
// sRGB <-> OKLab <-> OKLCH
// ---------------------------------------------------------------

const srgbToLinear = (v: number): number => {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
};

const linearToSrgb = (v: number): number => {
  const x = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return x * 255;
};

export function rgbToOklch(rgb: RGB): OKLCH {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);

  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const C = Math.sqrt(a * a + bb * bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;

  return { l: L, c: C, h: H };
}

export function oklchToRgb({ l, c, h }: OKLCH): RGB {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const L = l_ * l_ * l_;
  const M = m_ * m_ * m_;
  const S = s_ * s_ * s_;

  return {
    r: linearToSrgb(4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S),
    g: linearToSrgb(-1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S),
    b: linearToSrgb(-0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S),
  };
}

/** Pull chroma down until the colour is representable in sRGB. */
function clampToGamut(o: OKLCH): RGB {
  let c = o.c;
  for (let i = 0; i < 24; i++) {
    const rgb = oklchToRgb({ ...o, c });
    const inGamut =
      rgb.r >= -0.5 && rgb.r <= 255.5 &&
      rgb.g >= -0.5 && rgb.g <= 255.5 &&
      rgb.b >= -0.5 && rgb.b <= 255.5;
    if (inGamut) return rgb;
    c *= 0.92;
  }
  return oklchToRgb({ ...o, c: 0 });
}

// ---------------------------------------------------------------
// Ramp generation
// ---------------------------------------------------------------

export const STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export type Stop = (typeof STOPS)[number];

/** Target lightness per stop. Tuned so 500 sits near a typical brand colour. */
const TARGET_L: Record<Stop, number> = {
  50: 0.97, 100: 0.93, 200: 0.86, 300: 0.77, 400: 0.68,
  500: 0.60, 600: 0.52, 700: 0.44, 800: 0.35, 900: 0.25,
};

/** Chroma tapers at both ends — pure tints and shades read as muddy otherwise. */
const CHROMA_SCALE: Record<Stop, number> = {
  50: 0.18, 100: 0.34, 200: 0.56, 300: 0.78, 400: 0.94,
  500: 1.0, 600: 0.97, 700: 0.90, 800: 0.78, 900: 0.62,
};

export function generateRamp(seedHex: string): Record<Stop, string> {
  const seed = rgbToOklch(parseHex(seedHex));
  const out = {} as Record<Stop, string>;
  for (const stop of STOPS) {
    out[stop] = toHex(
      clampToGamut({
        l: TARGET_L[stop],
        c: seed.c * CHROMA_SCALE[stop],
        h: seed.h,
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------
// WCAG contrast
// ---------------------------------------------------------------

function relativeLuminance({ r, g, b }: RGB): number {
  const f = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(aHex: string, bHex: string): number {
  const la = relativeLuminance(parseHex(aHex));
  const lb = relativeLuminance(parseHex(bHex));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Pick whichever of white/near-black is legible on the given background. */
export function readableTextOn(bgHex: string): '#ffffff' | '#111111' {
  return contrastRatio(bgHex, '#ffffff') >= contrastRatio(bgHex, '#111111')
    ? '#ffffff'
    : '#111111';
}

/**
 * Neutral ramp derived from the surface colour rather than a fixed grey.
 *
 * A warm bone surface (#F8F5F1) with cold grey borders reads as two
 * unrelated designs stacked on top of each other. Carrying the surface's
 * own hue through the neutrals at very low chroma is the difference
 * between "themed" and "recoloured".
 */
export function deriveNeutralRamp(surfaceHex: string, chroma = 0.012): Record<Stop, string> {
  const s = rgbToOklch(parseHex(surfaceHex));
  // A near-achromatic surface has an unstable hue angle; anchor it warm.
  const hue = s.c < 0.004 ? 40 : s.h;
  const out = {} as Record<Stop, string>;
  for (const stop of STOPS) {
    out[stop] = toHex(
      clampToGamut({
        l: NEUTRAL_L[stop],
        c: chroma * NEUTRAL_C_SCALE[stop],
        h: hue,
      }),
    );
  }
  return out;
}

const NEUTRAL_L: Record<Stop, number> = {
  50: 0.985, 100: 0.955, 200: 0.905, 300: 0.83, 400: 0.72,
  500: 0.62, 600: 0.52, 700: 0.42, 800: 0.31, 900: 0.19,
};

const NEUTRAL_C_SCALE: Record<Stop, number> = {
  50: 0.9, 100: 1.1, 200: 1.2, 300: 1.2, 400: 1.1,
  500: 1.0, 600: 1.0, 700: 1.1, 800: 1.2, 900: 1.3,
};

/** Linear blend of two hex colours in sRGB. `t` 0 → a, 1 → b. */
export function mixHex(aHex: string, bHex: string, t: number): string {
  const a = parseHex(aHex);
  const b = parseHex(bHex);
  const k = Math.max(0, Math.min(1, t));
  return toHex({
    r: a.r + (b.r - a.r) * k,
    g: a.g + (b.g - a.g) * k,
    b: a.b + (b.b - a.b) * k,
  });
}

/** `#rrggbb` → `rgb(r g b / alpha)`, for scrims and glows. */
export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)} / ${alpha})`;
}

/**
 * Pick the most legible candidate for text on a background.
 *
 * `readableTextOn` only ever answers white or near-black. On a branded
 * product the answer is usually the brand's own paper or ink, which keeps
 * a button label in-palette instead of introducing a fourth grey.
 */
export function bestOn(bgHex: string, candidates: string[]): string {
  let best = candidates[0] ?? '#ffffff';
  let bestRatio = -1;
  for (const c of candidates) {
    const r = contrastRatio(bgHex, c);
    if (r > bestRatio) {
      bestRatio = r;
      best = c;
    }
  }
  return best;
}

/**
 * Walk a ramp until a stop clears the required contrast against `surface`.
 *
 * Used for text-on-tint tokens: a college picks a pale yellow, and the
 * "brand coloured text" token has to resolve to something readable rather
 * than to whichever stop the design happened to name.
 */
export function accessibleStop(
  ramp: Record<Stop, string>,
  surface: string,
  required = 4.5,
  direction: 'darker' | 'lighter' = 'darker',
): { stop: Stop; hex: string; ratio: number } {
  const order = direction === 'darker' ? [...STOPS] : [...STOPS].reverse();
  let fallback = { stop: order[order.length - 1]!, hex: ramp[order[order.length - 1]!], ratio: 0 };
  for (const stop of order) {
    const ratio = contrastRatio(ramp[stop], surface);
    if (ratio >= required) return { stop, hex: ramp[stop], ratio };
    if (ratio > fallback.ratio) fallback = { stop, hex: ramp[stop], ratio };
  }
  return fallback;
}

export interface ContrastIssue {
  token: string;
  against: string;
  ratio: number;
  required: number;
  severity: 'error' | 'warning';
}

/**
 * Run at save time in the branding admin, not at render time. A college
 * that picks a pale gold gets told immediately, rather than shipping a
 * portal nobody can read.
 *
 * `mode` matters: dark mode uses the *light* end of the ramp for text and
 * fills. Checking stop 800 against a dark surface would always fail and
 * tell you nothing, because nothing renders stop 800 there.
 */
export function validateContrast(
  ramp: Record<Stop, string>,
  surface: string,
  mode: 'light' | 'dark' = 'light',
): ContrastIssue[] {
  const issues: ContrastIssue[] = [];

  // Stops actually used for text, per mode.
  const textStops: Stop[] = mode === 'light' ? [600, 700, 800, 900] : [100, 200, 300];
  const fillStop: Stop = mode === 'light' ? 600 : 400;
  const borderStop: Stop = mode === 'light' ? 400 : 600;

  for (const stop of textStops) {
    const ratio = contrastRatio(ramp[stop], surface);
    if (ratio < 4.5) {
      const critical = mode === 'light' ? stop >= 700 : stop <= 200;
      issues.push({
        token: `brand-${stop}`,
        against: 'surface',
        ratio: Number(ratio.toFixed(2)),
        required: 4.5,
        severity: critical ? 'error' : 'warning',
      });
    }
  }

  // Primary button: label must be legible on the fill.
  const btn = ramp[fillStop];
  const label = readableTextOn(btn);
  const btnRatio = contrastRatio(btn, label);
  if (btnRatio < 4.5) {
    issues.push({
      token: 'button-primary',
      against: 'label',
      ratio: Number(btnRatio.toFixed(2)),
      required: 4.5,
      severity: 'error',
    });
  }

  // Non-text UI that carries meaning (focus rings, active borders) needs
  // 3:1 per WCAG 1.4.11. Decorative hairlines are exempt.
  const border = contrastRatio(ramp[borderStop], surface);
  if (border < 3) {
    issues.push({
      token: `brand-${borderStop}`,
      against: 'surface',
      ratio: Number(border.toFixed(2)),
      required: 3,
      severity: 'warning',
    });
  }

  // Focus ring must be visible or keyboard navigation is unusable.
  const ringStop: Stop = mode === 'light' ? 600 : 300;
  const ring = contrastRatio(ramp[ringStop], surface);
  if (ring < 3) {
    issues.push({
      token: 'focus-ring',
      against: 'surface',
      ratio: Number(ring.toFixed(2)),
      required: 3,
      severity: 'error',
    });
  }

  return issues;
}
