#!/usr/bin/env tsx
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { BrandPack } from '../src/lib/branding/pack';
import { buildTokens } from '../src/lib/branding/tokens';
import { contrastRatio } from '../src/lib/branding/color';

/**
 * Dark-mode misuse audit.
 *
 * `brand:check` proves the *tokens* are contrast-safe in both modes. It
 * cannot see whether a component reached for the right one. This does.
 *
 * The distinction it exists to police:
 *
 *  - **Semantic tokens** (`bg-surface-raised`, `text-muted`, `border-line`)
 *    are re-emitted under `[data-theme="dark"]`. They flip.
 *  - **Ramp stops** (`bg-brand-600`, `text-neutral-800`) are written into
 *    `tokens.light` only and never restated in the dark block — see
 *    `buildTokens()`. They are absolute, identical in both modes.
 *
 * So `text-neutral-800` on the ambient page ground is near-black ink on a
 * near-black surface the moment the toggle is flipped. Nothing in the token
 * engine can catch that, because each value is individually fine.
 *
 * Rather than assume which stops are dangerous, this measures. Every colour
 * class is resolved to the real hex emitted by every shipped pack and scored
 * against that pack's ground in *both* modes, so a finding carries the ratio
 * that produced it.
 *
 * Categories:
 *
 *   ramp-as-foreground   absolute ink on the flipping ambient ground
 *   ramp-as-background   absolute fill under flipping ink, or against a
 *                        flipping ground
 *   ramp-as-border       absolute edge against a flipping ground
 *   semantic-pair        two tokens that both flip and still resolve to
 *                        the same colour (text-primary on bg-surface-inverse)
 *   pair-below-aa        a pair that clears 3:1 but misses WCAG AA, and
 *                        which no row in brand-check.ts covers
 *   token-opacity        /NN on a custom-property colour — invalid CSS
 *   dark-variant         a dark: class, i.e. a second switch
 *   hardcoded-colour     a literal that reaches CSS
 *   hex-in-copy          a literal that does not (hint text, JSON sample)
 *   raw-overlay          white/black used for a shadow or scrim
 *   backstop-only        a raw regex sweep saw something the class parser
 *                        did not tokenise — an extraction blind spot
 *
 *   npx tsx scripts/darkmode-audit.ts            # static report
 *   npx tsx scripts/darkmode-audit.ts --json     # machine-readable
 *   npx tsx scripts/darkmode-audit.ts --all      # include LOW + verified pairs
 *
 * ── Runtime pass ──────────────────────────────────────────────────────
 *
 * Static analysis reaches only as far as a single class attribute. Almost
 * every real screen sets the ground on a parent and the ink on a child,
 * so the pairing that matters is never in one string. The runtime pass
 * closes that: it drives a real browser at a real dev server, forces the
 * theme both ways, and reads `getComputedStyle` off every element that
 * paints — the same numbers the eye would get.
 *
 *   npx tsx scripts/mint-all.ts /tmp/cookies.env
 *   npx tsx scripts/darkmode-audit.ts --selftest --base http://localhost:3300
 *   npx tsx scripts/darkmode-audit.ts --runtime  --base http://localhost:3300 \
 *       --cookies /tmp/cookies.env
 *
 * Run `--selftest` first. It injects four elements with known answers and
 * checks the probe gets all four right, because a probe that silently
 * returns nothing is indistinguishable from a clean app.
 *
 * Each route is then loaded twice, light and dark, and the two readings
 * are diffed. That is the point: a pairing that fails in both modes is a
 * contrast bug somebody else owns, and only a pairing that passes in
 * light and fails in dark is a *dark-mode* defect. The pass also compares
 * the page ground between modes, which is the only check that catches a
 * screen the theme never reached at all.
 *
 * `--no-warm --anon-only` runs a second tenant (`ifbash.localhost:PORT`):
 * Chromium resolves `.localhost` subdomains, Node's DNS does not, and the
 * minted cookies belong to `ten-diet` alone.
 *
 * What the runtime pass does *not* see: overlays that are closed by
 * default (Dialog, Sheet, Menu, Popover, Tooltip, Toast) and :hover /
 * :focus states. Those are the static pass's job, and the one HIGH
 * finding in this repo lives in exactly that blind spot — a status dot
 * inside a notification dropdown nobody opened.
 *
 * Exit code is non-zero when any HIGH finding survives.
 */

const ROOT = process.cwd();
const SCAN_DIRS = ['src/app', 'src/components'];
const EXTS = ['.tsx', '.ts'];

const ARGV = process.argv.slice(2);
const ARGS = new Set(ARGV);
const AS_JSON = ARGS.has('--json');
const SHOW_ALL = ARGS.has('--all');
const RUNTIME = ARGS.has('--runtime');

function flag(name: string, fallback: string): string {
  const i = ARGV.indexOf(name);
  return i >= 0 && ARGV[i + 1] ? ARGV[i + 1]! : fallback;
}

/** Contrast below this reads as "the same colour" for text purposes. */
const INVISIBLE = 3.0;
/** WCAG AA for body copy. Large text (§ below) is allowed 3:1. */
const AA_TEXT = 4.5;
/** A border this close to its ground has effectively vanished. */
const BORDER_GONE = 1.25;

type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

interface Finding {
  category: string;
  severity: Severity;
  file: string;
  line: number;
  token: string;
  detail: string;
}

const findings: Finding[] = [];
const stats = {
  files: 0,
  classStrings: 0,
  classTokens: 0,
  colourTokens: 0,
  rampUses: 0,
  semanticUses: 0,
  pairsChecked: 0,
};

// ---------------------------------------------------------------------
// Real token values, per pack, per mode
// ---------------------------------------------------------------------

interface PackTokens {
  name: string;
  light: Record<string, string>;
  dark: Record<string, string>;
}

function stripNotes(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNotes);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!k.startsWith('$')) out[k] = stripNotes(v);
    }
    return out;
  }
  return value;
}

function loadPacks(): PackTokens[] {
  const dir = join(ROOT, 'brands');
  const out: PackTokens[] = [];

  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const parsed = BrandPack.safeParse(stripNotes(JSON.parse(readFileSync(join(dir, file), 'utf8'))));
    if (!parsed.success) {
      console.error(`skipped ${file}: does not parse as a BrandPack`);
      continue;
    }

    const t = buildTokens(parsed.data);

    // Dark inherits every token it does not restate — that is exactly what
    // makes ramps absolute. Flatten so a lookup never returns undefined.
    const dark = { ...t.light, ...t.dark };

    // Assert the premise rather than trusting the comment in tokens.ts. If
    // a ramp stop ever starts flipping, this script's reasoning is wrong
    // and it must say so instead of reporting a clean run.
    for (const k of Object.keys(t.light)) {
      if (/^--(brand|accent|neutral)-\d{2,3}$/.test(k) && t.dark[k] && t.dark[k] !== t.light[k]) {
        console.error(
          `PREMISE BROKEN: ${k} differs between modes in ${file} ` +
            `(${t.light[k]} vs ${t.dark[k]}). Ramps are supposed to be absolute.`,
        );
      }
    }

    out.push({ name: file.replace(/\.json$/, ''), light: t.light, dark });
  }

  return out;
}

const PACKS = loadPacks();

// ---------------------------------------------------------------------
// Tailwind class → CSS custom property
// ---------------------------------------------------------------------

/**
 * Mirrors `tailwind.config.ts`. A class the config cannot resolve returns
 * null and is left alone — this audit never guesses.
 */
function classToVar(prop: string, name: string): string | null {
  const isText = prop === 'text' || prop === 'placeholder' || prop === 'caret' || prop === 'decoration';

  // `ringColor.extend` and `outlineColor.extend` override `colors` for
  // these two properties only: `ring-brand` is the focus ring, not stop
  // 600. Getting this backwards would report the wrong hex in a finding.
  if ((prop === 'ring' || prop === 'outline') && (name === 'brand' || name === 'DEFAULT')) {
    return '--focus-ring';
  }

  // `textColor.extend` entries win for text-* only.
  if (isText) {
    const textOnly: Record<string, string> = {
      primary: '--text-primary',
      secondary: '--text-secondary',
      muted: '--text-muted',
      'on-brand': '--button-primary-fg',
      'on-inverse': '--text-on-inverse',
    };
    if (textOnly[name]) return textOnly[name]!;
  }

  // colors.*
  const ramp = /^(brand|accent|neutral)-(\d{2,3})$/.exec(name);
  if (ramp) return `--${ramp[1]}-${ramp[2]}`;

  const table: Record<string, string> = {
    brand: '--brand-600',
    'brand-fg': '--brand-fg',
    'brand-soft': '--brand-soft',
    'brand-soft-fg': '--brand-soft-fg',
    accent: '--accent-600',
    'accent-fg': '--accent-fg',
    'accent-soft': '--accent-soft',
    'accent-soft-fg': '--accent-soft-fg',
    surface: '--surface',
    'surface-raised': '--surface-raised',
    'surface-sunken': '--surface-sunken',
    'surface-inverse': '--surface-inverse',
    line: '--border',
    'line-strong': '--border-strong',
    marker: '--marker',
  };
  if (table[name]) return table[name]!;

  const status = /^(success|warning|danger|info)(?:-(fg|soft|on))?$/.exec(name);
  if (status) return status[2] ? `--${status[1]}-${status[2]}` : `--${status[1]}`;

  return null;
}

/** Resolve a class to `{light, dark}` hex, worst-case across packs handled by caller. */
function resolveClass(prop: string, name: string, pack: PackTokens): { light: string; dark: string } | null {
  const v = classToVar(prop, name);
  if (!v) return null;
  const l = pack.light[v];
  const d = pack.dark[v];
  if (!l || !d || l.startsWith('rgb') || d.startsWith('rgb')) return null;
  return { light: l, dark: d };
}

function worstRatio(
  a: { prop: string; name: string },
  b: { prop: string; name: string },
): { light: number; dark: number; sample: string } | null {
  let light = Infinity;
  let dark = Infinity;
  let sample = '';
  for (const p of PACKS) {
    const ra = resolveClass(a.prop, a.name, p);
    const rb = resolveClass(b.prop, b.name, p);
    if (!ra || !rb) continue;
    const cl = contrastRatio(ra.light, rb.light);
    const cd = contrastRatio(ra.dark, rb.dark);
    if (cl < light || cd < dark) sample = `${p.name}: ${ra.light}/${rb.light} light, ${ra.dark}/${rb.dark} dark`;
    light = Math.min(light, cl);
    dark = Math.min(dark, cd);
  }
  if (light === Infinity) return null;
  return { light, dark, sample };
}

/** Contrast of a class against a named ground token, worst case across packs. */
function againstGround(
  a: { prop: string; name: string },
  groundVar: string,
): { light: number; dark: number } | null {
  let light = Infinity;
  let dark = Infinity;
  for (const p of PACKS) {
    const ra = resolveClass(a.prop, a.name, p);
    const gl = p.light[groundVar];
    const gd = p.dark[groundVar];
    if (!ra || !gl || !gd) continue;
    light = Math.min(light, contrastRatio(ra.light, gl));
    dark = Math.min(dark, contrastRatio(ra.dark, gd));
  }
  if (light === Infinity) return null;
  return { light, dark };
}

// ---------------------------------------------------------------------
// Class-string extraction
// ---------------------------------------------------------------------

const COLOUR_PROPS = [
  'bg', 'text', 'border', 'ring', 'fill', 'stroke', 'from', 'via', 'to',
  'divide', 'outline', 'decoration', 'placeholder', 'accent', 'caret', 'shadow',
];

const FG_PROPS = new Set(['text', 'fill', 'stroke', 'decoration', 'placeholder', 'caret']);
const BG_PROPS = new Set(['bg', 'from', 'via', 'to']);
const EDGE_PROPS = new Set(['border', 'divide', 'outline', 'ring']);

const TOKEN_FAMILIES = new Set([
  'brand', 'accent', 'neutral', 'surface', 'line', 'marker',
  'success', 'warning', 'danger', 'info', 'primary', 'secondary', 'muted', 'on',
]);

/** Tailwind's stock palettes. `neutral` is absent — this repo redefines it. */
const TW_PALETTES = new Set([
  'slate', 'gray', 'zinc', 'stone', 'red', 'orange', 'amber', 'yellow',
  'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo',
  'violet', 'purple', 'fuchsia', 'pink', 'rose',
]);

function splitOutside(input: string, delim: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of input) {
    if (ch === '[' || ch === '(') depth++;
    else if (ch === ']' || ch === ')') depth--;
    if (ch === delim && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts;
}

interface ClassToken {
  raw: string;
  variants: string[];
  prop: string | null;
  name: string;
  core: string;
  opacity: string | null;
}

function parseClassToken(raw: string): ClassToken {
  const segs = splitOutside(raw, ':');
  const last = segs.pop()!;
  const slash = splitOutside(last, '/');
  const core = slash[0]!;
  let prop: string | null = null;
  let name = core;
  for (const p of COLOUR_PROPS) {
    if (core.startsWith(p + '-')) {
      prop = p;
      name = core.slice(p.length + 1);
      break;
    }
  }
  return { raw, variants: segs, prop, name, core, opacity: slash.length > 1 ? slash.slice(1).join('/') : null };
}

/**
 * Is this string literal a Tailwind class list?
 *
 * Shape-validated rather than context-matched: an apostrophe inside JSX
 * prose ("don't") desynchronises any quote-pairing scanner, and the
 * garbage it produces ("text-danger-fg\">{reason}</p>") is exactly what a
 * shape test rejects. Every whitespace-separated word must look like a
 * utility once bracketed arbitrary values are masked out.
 */
function asClassList(literal: string): string[] | null {
  if (literal.length > 2000 || !literal.trim()) return null;

  // Mask `[...]` arbitrary values — they may legally contain `>`, `&`, `#`.
  const masked = literal.replace(/\[[^\]]*\]/g, '[]');
  if (/[<>{};"'`\\@?]/.test(masked)) return null;

  const words = masked.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  // Utility syntax is lowercase; `-mt-1`, `w-1/2`, `p-1.5`, `2xl:`, `!` all fit.
  const shape = /^!?-?[a-z0-9]+(?:[a-z0-9.\/-]|\[\])*(?::!?-?[a-z0-9]+(?:[a-z0-9.\/-]|\[\])*)*$/;
  for (const w of words) if (!shape.test(w)) return null;

  // Restore the real text so bracket contents are reported accurately.
  const realWords = literal.split(/\s+/).filter(Boolean);
  if (realWords.length !== words.length) return null;
  return realWords;
}

// ---------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------

function add(f: Finding) {
  findings.push(f);
}

const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '?');

/** Is this a colour value that is the same in both modes? */
function isAbsolute(t: ClassToken): boolean {
  if (/^(brand|accent|neutral)-\d{2,3}$/.test(t.name)) return true;
  if (t.name === 'white' || t.name === 'black' || t.name === 'transparent') return true;
  if (t.name.startsWith('[')) return true;
  if (TW_PALETTES.has(t.name.split('-')[0]!)) return true;
  return false;
}

/**
 * `bg-brand-700 text-neutral-50` is a designed pair: both halves absolute,
 * so it renders identically in both modes and is not a dark-mode bug.
 * `text-neutral-800` alone is not — its ground is the ambient surface,
 * which flips underneath it.
 */
function pinsCounterpart(tokens: ClassToken[], want: 'fg' | 'bg'): boolean {
  const props = want === 'fg' ? FG_PROPS : BG_PROPS;
  return tokens.some((t) => {
    if (!t.prop || !props.has(t.prop)) return false;
    if (isAbsolute(t)) return true;
    // Tokens that only make sense against a specific ground.
    return ['on-inverse', 'on-brand', 'surface-inverse'].includes(t.name) || t.name.endsWith('-on');
  });
}

/**
 * The semantic grounds painted *near* a mark, as CSS custom properties.
 *
 * A ramp fill has to be measured against the thing behind it, and that is
 * almost never set in the same class attribute. `TopBar.tsx` is the case
 * that forced this: the unread dot is `bg-brand-600` (line 139) and the
 * row it sits inside is `bg-brand-soft` (line 135). Against `--surface`
 * alone the dot measures fine in both modes; against the row it is
 * actually on it drops to 2.5:1 in dark.
 *
 * Scoped to a window rather than the whole file, because whole-file was
 * measurably wrong: it paired `ProportionBar`'s accent segment (line 288)
 * with `BarList`'s accent fill (line 115), two unrelated components, and
 * reported a defect that cannot happen. A mark and its ground live in the
 * same JSX subtree, so they live close together.
 */
const GROUND_WINDOW = 40;
let fileGrounds: Array<{ v: string; line: number }> = [];

/**
 * What can legitimately be *behind* a mark. Deliberately not "every
 * background token": `--danger` and `--warning` are solid status fills —
 * marks in their own right — and treating them as candidate grounds made
 * the first version of this check report a chart segment as invisible
 * against a warning badge somewhere else on the page. Grounds are page,
 * panel, well, inverse band, and the soft tints.
 */
const GROUND_VARS = new Set([
  '--surface', '--surface-raised', '--surface-sunken', '--surface-inverse',
  '--brand-soft', '--accent-soft',
  '--success-soft', '--warning-soft', '--danger-soft', '--info-soft',
]);

function collectGrounds(words: string[], line: number): void {
  for (const w of words) {
    const t = parseClassToken(w);
    if (!t.prop || !BG_PROPS.has(t.prop)) continue;
    const v = classToVar(t.prop, t.name);
    if (v && GROUND_VARS.has(v)) fileGrounds.push({ v, line });
  }
}

/**
 * Candidate grounds for a mark on `line`, each tagged with how it was
 * arrived at. `observed` means the code paints it within the window;
 * `assumed` means every screen has a page and cards and this mark could
 * be on either. The distinction is carried into the finding, because a
 * measurement against an observed ground is evidence and a measurement
 * against an assumed one is a question.
 */
function groundsNear(line: number): Array<{ v: string; how: 'observed' | 'assumed' }> {
  const near = new Set(
    fileGrounds.filter((g) => Math.abs(g.line - line) <= GROUND_WINDOW).map((g) => g.v),
  );
  const out: Array<{ v: string; how: 'observed' | 'assumed' }> = [...near].map((v) => ({
    v,
    how: 'observed' as const,
  }));
  for (const v of ['--surface', '--surface-raised']) {
    if (!near.has(v)) out.push({ v, how: 'assumed' });
  }
  return out;
}

function auditClassString(file: string, line: number, words: string[]) {
  stats.classStrings++;
  stats.classTokens += words.length;
  const tokens = words.map(parseClassToken);

  for (const t of tokens) {
    if (t.variants.includes('dark')) {
      add({
        category: 'dark-variant',
        severity: 'HIGH',
        file,
        line,
        token: t.raw,
        detail:
          'The system flips via tokens under [data-theme="dark"]. A dark: variant ' +
          'is a second, independent switch that will disagree with the toggle.',
      });
    }

    if (!t.prop) continue;

    const family = t.name.split('-')[0]!;

    // `bg`/`text`/`border` also prefix sizes and widths (`text-xs`,
    // `border-2`, `bg-none`). Only count the ones that carry a colour, so
    // the coverage number in the report means what it says.
    if (
      classToVar(t.prop, t.name) ||
      TW_PALETTES.has(family) ||
      t.name === 'white' ||
      t.name === 'black' ||
      (t.name.startsWith('[') && /#|rgb|hsl|color-mix|var\(--/.test(t.name))
    ) {
      stats.colourTokens++;
    }

    // ---- token /opacity ---------------------------------------------
    if (t.opacity !== null && classToVar(t.prop, t.name)) {
      add({
        category: 'token-opacity',
        severity: 'HIGH',
        file,
        line,
        token: t.raw,
        detail:
          `${t.prop}-${t.name} resolves to a CSS custom property. Tailwind cannot ` +
          `decompose it into channels, so /${t.opacity} emits an invalid colour value.`,
      });
    }

    // ---- stock palette / literal white-black -------------------------
    if (TW_PALETTES.has(family)) {
      add({
        category: 'hardcoded-colour',
        severity: 'HIGH',
        file,
        line,
        token: t.raw,
        detail: `Tailwind stock palette "${family}" — absolute, unbranded, outside the token set.`,
      });
      continue;
    }

    if (t.name === 'white' || t.name === 'black') {
      const overlayish = t.opacity !== null || t.prop === 'shadow' || t.prop === 'ring';
      add({
        category: overlayish ? 'raw-overlay' : 'hardcoded-colour',
        severity: overlayish ? 'MEDIUM' : 'HIGH',
        file,
        line,
        token: t.raw,
        detail: overlayish
          ? 'Overlay or shadow drawn from literal white/black rather than --overlay / --shadow-color.'
          : `${t.prop}-${t.name} is absolute; it does not flip with the theme.`,
      });
      continue;
    }

    if (t.name.startsWith('[')) {
      const inner = t.name.slice(1, -1);
      if (/^#[0-9a-fA-F]{3,8}$/.test(inner) || /^(rgb|hsl)a?\(/.test(inner)) {
        add({
          category: 'hardcoded-colour',
          severity: 'HIGH',
          file,
          line,
          token: t.raw,
          detail: `Arbitrary literal colour "${inner}" — absolute in both modes.`,
        });
      }
      continue;
    }

    // ---- ramp stop where a semantic belongs ---------------------------
    const rampMatch = /^(brand|accent|neutral)-(\d{2,3})$/.exec(t.name);
    if (rampMatch) {
      stats.rampUses++;
      const stop = `${rampMatch[1]}-${rampMatch[2]}`;
      const where = t.variants.length ? ` (under ${t.variants.join(':')}:)` : '';

      if (FG_PROPS.has(t.prop)) {
        if (pinsCounterpart(tokens, 'bg')) {
          if (SHOW_ALL) {
            add({ category: 'ramp-pair', severity: 'LOW', file, line, token: t.raw,
                  detail: 'Absolute ink on an absolute ground — mode-independent by construction.' });
          }
          continue;
        }
        const s = againstGround({ prop: t.prop, name: t.name }, '--surface');
        const r = againstGround({ prop: t.prop, name: t.name }, '--surface-raised');
        if (!s || !r) continue;
        const wl = Math.min(s.light, r.light);
        const wd = Math.min(s.dark, r.dark);
        const bad = wl < INVISIBLE || wd < INVISIBLE;
        add({
          category: 'ramp-as-foreground',
          severity: bad ? 'HIGH' : 'LOW',
          file,
          line,
          token: t.raw,
          detail: bad
            ? `${stop} is absolute${where}. Against the ambient ground it measures ` +
              `${fmt(wl)}:1 light / ${fmt(wd)}:1 dark (worst of ${PACKS.length} packs) — ` +
              (wd < INVISIBLE && wl >= INVISIBLE ? 'unreadable in dark mode.'
                : wl < INVISIBLE && wd >= INVISIBLE ? 'unreadable in light mode.'
                : 'unreadable in both.')
            : `${stop} clears both grounds (${fmt(wl)}:1 light / ${fmt(wd)}:1 dark), but it is ` +
              'absolute where a semantic text token would flip.',
        });
        continue;
      }

      if (BG_PROPS.has(t.prop)) {
        if (pinsCounterpart(tokens, 'fg')) {
          if (SHOW_ALL) {
            add({ category: 'ramp-pair', severity: 'LOW', file, line, token: t.raw,
                  detail: 'Absolute ground with an absolute label — mode-independent by construction.' });
          }
          continue;
        }
        // Two separate questions, because a fill can fail either way:
        // does it still hold the ink the theme puts on it, and does it
        // still read as a fill against the ground the theme puts behind
        // it? A bar or a status dot has no text and only the second
        // question applies, so both numbers are reported and neither is
        // asserted as the failure.
        const holds = againstGround({ prop: t.prop, name: t.name }, '--text-primary');
        if (!holds) continue;

        const grounds = groundsNear(line)
          .map((g) => ({ ...g, m: againstGround({ prop: t.prop!, name: t.name }, g.v) }))
          .filter((x): x is typeof x & { m: { light: number; dark: number } } => Boolean(x.m))
          .sort((a, b) => Math.min(a.m.light, a.m.dark) - Math.min(b.m.light, b.m.dark));

        const worst = grounds[0];
        if (!worst) continue;

        const which = (m: { light: number; dark: number }, limit: number) =>
          m.dark < limit && m.light >= limit ? 'dark only'
            : m.light < limit && m.dark >= limit ? 'light only'
            : m.light < limit ? 'both modes' : 'neither';

        // A mark that carries meaning needs 3:1 against its own ground
        // (WCAG 1.4.11). Losing that in one mode only is the signature of
        // an absolute step chosen against a single ground — and only an
        // *observed* ground makes that a confirmed defect rather than a
        // question to answer by looking at the screen.
        const markFails = worst.m.light < INVISIBLE || worst.m.dark < INVISIBLE;
        const oneSided = (worst.m.light >= INVISIBLE) !== (worst.m.dark >= INVISIBLE);
        const confirmed = worst.how === 'observed';

        add({
          category: 'ramp-as-background',
          severity: markFails && oneSided ? (confirmed ? 'HIGH' : 'MEDIUM') : markFails ? 'MEDIUM' : 'LOW',
          file,
          line,
          token: t.raw,
          detail:
            `${stop} is absolute${where} while every ground around it flips. ` +
            `Worst candidate ground ${worst.v} (${worst.how}${
              worst.how === 'observed' ? ` — painted within ${GROUND_WINDOW} lines` : ' — every screen has one'
            }): ${fmt(worst.m.light)}:1 light / ${fmt(worst.m.dark)}:1 dark ` +
            `(mark drops under 3:1: ${which(worst.m, INVISIBLE)}). ` +
            `Against --text-primary ${fmt(holds.light)}:1 / ${fmt(holds.dark)}:1 ` +
            `(ink collapses: ${which(holds, INVISIBLE)}). ` +
            (markFails && oneSided
              ? confirmed
                ? 'The step was chosen against one ground and only works there.'
                : 'Confirm which ground this actually sits on before acting.'
              : markFails
                ? 'Under the 3:1 non-text minimum in both modes equally.'
                : 'Survives every candidate ground; a semantic token would still say what it means.'),
        });
        continue;
      }

      if (EDGE_PROPS.has(t.prop)) {
        const s = againstGround({ prop: t.prop, name: t.name }, '--surface');
        if (!s) continue;
        const gone = s.light < BORDER_GONE || s.dark < BORDER_GONE;
        add({
          category: 'ramp-as-border',
          severity: gone ? 'MEDIUM' : 'LOW',
          file,
          line,
          token: t.raw,
          detail: gone
            ? `${stop} against the page ground is ${fmt(s.light)}:1 light / ${fmt(s.dark)}:1 dark — ` +
              'the edge disappears in one mode. border-line / border-line-strong flip.'
            : `${stop} is absolute; border-line flips. (${fmt(s.light)}:1 / ${fmt(s.dark)}:1)`,
        });
        continue;
      }
      continue;
    }

    if (TOKEN_FAMILIES.has(family) || classToVar(t.prop, t.name)) stats.semanticUses++;
  }

  // ---- semantic pair: two flipping tokens that land on the same colour --
  //
  // Both halves being mode-aware is not sufficient. `text-primary` and
  // `--surface-inverse` are both derived from ink, so they collide in
  // light mode *and* in dark mode. Only measurement catches that.
  const base = tokens.filter((t) => t.variants.length === 0 && t.prop);
  const fg = base.find((t) => FG_PROPS.has(t.prop!) && classToVar(t.prop!, t.name));
  const bg = base.find((t) => BG_PROPS.has(t.prop!) && classToVar(t.prop!, t.name));

  if (fg && bg && !(isAbsolute(fg) && isAbsolute(bg))) {
    const r = worstRatio({ prop: fg.prop!, name: fg.name }, { prop: bg.prop!, name: bg.name });
    if (r) {
      stats.pairsChecked++;
      const bad = r.light < INVISIBLE || r.dark < INVISIBLE;
      if (bad) {
        add({
          category: 'semantic-pair',
          severity: 'HIGH',
          file,
          line,
          token: `${fg.raw} on ${bg.raw}`,
          detail:
            `Measured ${fmt(r.light)}:1 light / ${fmt(r.dark)}:1 dark across ${PACKS.length} packs — ` +
            (r.dark < INVISIBLE && r.light >= INVISIBLE ? 'foreground and background collapse in dark mode. '
              : r.light < INVISIBLE && r.dark >= INVISIBLE ? 'foreground and background collapse in light mode. '
              : 'foreground and background collapse in both modes. ') +
            `worst pack — ${r.sample}`,
        });
      } else if (
        // `--text-muted` is specified at 3:1, not 4.5 — it is the hint and
        // caption weight, and both `auditTokens()` and the PAIRS table in
        // brand-check.ts require exactly 3 of it. Holding it to AA body
        // copy would bury 20 real findings under a rule the design system
        // never made.
        classToVar(fg.prop!, fg.name) !== '--text-muted' &&
        (r.dark < AA_TEXT || r.light < AA_TEXT)
      ) {
        // Not a collapse, so not a dark-mode bug — but a token pair the
        // engine never checks. `brand:check` validates `--brand-soft-fg`
        // against `--brand-soft`; it has no equivalent row for the four
        // status hues, so `text-success-fg` on `bg-success-soft` is
        // audited against the page ground it is not sitting on.
        add({
          category: 'pair-below-aa',
          severity: 'MEDIUM',
          file,
          line,
          token: `${fg.raw} on ${bg.raw}`,
          detail:
            `${fmt(r.light)}:1 light / ${fmt(r.dark)}:1 dark (worst of ${PACKS.length} packs) — under ` +
            `${AA_TEXT}:1 in ${r.dark < AA_TEXT && r.light < AA_TEXT ? 'both modes' : r.dark < AA_TEXT ? 'dark' : 'light'}. ` +
            `Token-engine gap, not component misuse: no PAIRS row in scripts/brand-check.ts covers it. ` +
            `worst pack — ${r.sample}`,
        });
      } else if (SHOW_ALL) {
        add({ category: 'semantic-pair', severity: 'LOW', file, line, token: `${fg.raw} on ${bg.raw}`,
              detail: `${fmt(r.light)}:1 light / ${fmt(r.dark)}:1 dark — verified.` });
      }
    }
  }
}

// ---------------------------------------------------------------------
// Free-text scans — things that never appear inside a className
// ---------------------------------------------------------------------

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z])/g;

/**
 * A literal only matters when it reaches CSS. These four routes are the
 * ways it can, and each is matched on its own — a hex sitting in a hint
 * string, a placeholder, or a JSON sample rendered in a `<pre>` is text a
 * human reads, not a colour an element paints, and flagging it buries the
 * findings that are real.
 */
const REACHES_CSS: Array<{ what: string; re: RegExp; value: (m: RegExpMatchArray) => string }> = [
  {
    what: 'inline style property',
    re: /\b(color|background|backgroundColor|borderColor|borderTopColor|borderBottomColor|borderInlineColor|fill|stroke|boxShadow|outlineColor|caretColor|textDecorationColor|accentColor)\s*:\s*(['"`])([^'"`]*)\2/g,
    value: (m) => `${m[1]}: '${m[3]}'`,
  },
  {
    what: 'inline style shorthand',
    re: /\b(border|borderTop|borderBottom|borderLeft|borderRight|outline|background)\s*:\s*(['"`])([^'"`]*(?:#[0-9a-fA-F]{3,8}|\brgba?\(|\bhsla?\(|\bwhite\b|\bblack\b)[^'"`]*)\2/g,
    value: (m) => `${m[1]}: '${m[3]}'`,
  },
  {
    what: 'SVG presentation attribute',
    re: /\b(fill|stroke|stopColor|floodColor|lightingColor)\s*=\s*(["'])(#[0-9a-fA-F]{3,8}|white|black|red|blue|green|gray|grey)\2/g,
    value: (m) => `${m[1]}="${m[3]}"`,
  },
  {
    what: 'CSS custom property declaration',
    re: /(--[a-z][a-z0-9-]*)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))/g,
    value: (m) => `${m[1]}: ${m[2]}`,
  },
];

const CSS_SAFE = /var\(--|^(none|transparent|currentColor|inherit|unset|initial)$/;

/** A line that is entirely a comment carries no colour. */
function isComment(line: string): boolean {
  const s = line.trim();
  return s.startsWith('//') || s.startsWith('*') || s.startsWith('/*');
}

function auditFreeText(file: string, source: string) {
  source.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    if (isComment(raw)) return;
    const code = raw.replace(/\/\/.*$/, '');

    let reached = false;

    for (const route of REACHES_CSS) {
      for (const m of code.matchAll(route.re)) {
        const v = route.value(m);
        if (CSS_SAFE.test(v)) continue;
        if (!/#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|\b(white|black|red|blue|green|gray|grey|silver)\b/.test(v)) continue;
        reached = true;
        add({
          category: 'hardcoded-colour',
          severity: 'HIGH',
          file,
          line,
          token: v,
          detail: `Literal colour reaching CSS via ${route.what} — absolute in both modes, invisible to white-labelling.`,
        });
      }
    }

    // Everything else that merely *looks* like a colour. Counted, listed
    // under --all, and never mixed in with the real findings.
    if (!reached) {
      for (const m of code.matchAll(HEX)) {
        add({
          category: 'hex-in-copy',
          severity: 'LOW',
          file,
          line,
          token: m[0],
          detail: 'Hex literal that does not reach CSS on this line (hint copy, placeholder, JSON sample, or colour maths). Read once, then ignore.',
        });
      }
    }
  });
}

// ---------------------------------------------------------------------
// Backstop: a raw sweep, so an extraction miss cannot fake a clean run
// ---------------------------------------------------------------------

const BACKSTOP: Array<{ name: string; re: RegExp }> = [
  { name: 'ramp stop', re: /\b(?:bg|text|border|ring|fill|stroke|from|via|to|divide|outline|decoration|placeholder|accent|caret|shadow)-(?:brand|accent|neutral)-(?:50|100|200|300|400|500|600|700|800|900)\b/g },
  { name: 'dark: variant', re: /(?:^|["'`\s:])dark:[a-z0-9[\]/_-]+/g },
  { name: 'stock palette', re: /\b(?:bg|text|border|ring|fill|stroke|from|via|to|divide|outline|decoration|placeholder|accent|caret|shadow)-(?:slate|gray|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g },
  { name: 'white/black class', re: /\b(?:bg|text|border|ring|fill|stroke|from|via|to|divide|outline|decoration|placeholder|caret|shadow)-(?:white|black)(?:\/\d+)?\b/g },
  { name: 'opacity modifier', re: /\b(?:bg|text|border|ring|fill|stroke|from|via|to|divide|outline|decoration|placeholder|caret|shadow)-[a-z][a-z0-9-]*\/\d{1,3}\b/g },
];

const backstopHits = new Map<string, string[]>();

// ---------------------------------------------------------------------
// Walk
// ---------------------------------------------------------------------

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue;
      walk(full, out);
    } else if (EXTS.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

/**
 * Blank out comments, preserving newlines so line numbers survive.
 *
 * This is not cosmetic. `TopBar.tsx` documents, in a comment, that
 * `bg-surface-raised/95` is exactly what it refuses to use — and a parser
 * that reads comments reports the explanation as the defect. Both the
 * class scan and the free-text scan run on the stripped source so the two
 * mechanisms cannot disagree about what counts as code.
 *
 * Block comments are masked wherever they appear; line comments only when
 * the `//` starts the line, because stripping mid-line would eat the
 * `className` on `<a href="https://…" className="…">`.
 */
function stripComments(source: string): string {
  const blanked = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return blanked
    .split('\n')
    .map((l) => (/^\s*\/\//.test(l) ? l.replace(/[^\n]/g, ' ') : l))
    .join('\n');
}

/**
 * Quoted runs that pass the class-list shape test. The shape test, not the
 * quoting, is what makes this reliable — see `asClassList`.
 */
function* classStrings(source: string): Generator<{ words: string[]; line: number }> {
  const re = /(["'`])([^"'`\n]*)\1/g;
  for (const m of source.matchAll(re)) {
    const words = asClassList(m[2]!);
    if (!words) continue;
    yield { words, line: source.slice(0, m.index).split('\n').length };
  }
  // Template literals may span lines and interpolate; mask `${…}` and retry.
  const tpl = /`([^`]*)`/g;
  for (const m of source.matchAll(tpl)) {
    if (!m[1]!.includes('${')) continue;
    for (const chunk of m[1]!.split(/\$\{[^}]*\}/)) {
      const words = asClassList(chunk);
      if (!words) continue;
      yield { words, line: source.slice(0, m.index).split('\n').length };
    }
  }
}

const files: string[] = [];
for (const d of SCAN_DIRS) {
  try {
    walk(join(ROOT, d), files);
  } catch {
    /* absent */
  }
}

const seenTokens = new Set<string>();

for (const abs of files) {
  const rel = relative(ROOT, abs).split(sep).join('/');
  const source = stripComments(readFileSync(abs, 'utf8'));
  stats.files++;

  // Two passes over the same file: gather the grounds it paints, then
  // judge its marks against them. One pass cannot do it — the ground is
  // routinely declared after the mark that sits on it.
  fileGrounds = [];
  for (const { words, line } of classStrings(source)) collectGrounds(words, line);

  for (const { words, line } of classStrings(source)) {
    auditClassString(rel, line, words);
    for (const w of words) seenTokens.add(`${rel}|${w}`);
  }
  auditFreeText(rel, source);

  source.split(/\r?\n/).forEach((l, i) => {
    if (isComment(l)) return;
    for (const b of BACKSTOP) {
      for (const m of l.matchAll(b.re)) {
        const hit = m[0].trim();
        if (!backstopHits.has(b.name)) backstopHits.set(b.name, []);
        backstopHits.get(b.name)!.push(`${rel}:${i + 1}  ${hit}`);
        // Anything the raw sweep sees but the parser never tokenised is an
        // extraction blind spot, and must not be silently dropped.
        if (![...seenTokens].some((s) => s.startsWith(rel + '|') && s.endsWith('|' + hit))) {
          const already = findings.some((f) => f.file === rel && f.line === i + 1 && f.token.includes(hit));
          if (!already) {
            add({ category: 'backstop-only', severity: 'MEDIUM', file: rel, line: i + 1, token: hit,
                  detail: `Raw sweep matched "${b.name}" on a line the class parser did not tokenise — inspect by hand.` });
          }
        }
      }
    }
  });
}

// ---------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------

const ORDER: Severity[] = ['HIGH', 'MEDIUM', 'LOW'];
const ownedElsewhere = (f: string) => /^src\/components\/(ui|shell|charts|members)\//.test(f);

/**
 * Files where a literal colour is the correct answer, each with the reason
 * it is correct. Listed rather than silenced: an exemption nobody can see
 * is indistinguishable from a bug nobody has found, and the next reader
 * needs to know the call was made deliberately.
 */
const EXEMPT: Array<{ file: string; category: string; reason: string }> = [
  {
    file: 'src/app/global-error.tsx',
    category: 'hardcoded-colour',
    reason:
      'Root-layout error boundary. It renders when tenant resolution or token generation is what threw, ' +
      'so var(--surface) is undefined by definition and the tokens cannot be used. Stated in the file header.',
  },
  {
    file: 'src/app/layout.tsx',
    category: 'hardcoded-colour',
    reason:
      'The no-tenant "Portal not found" branch, which by definition has no resolved pack. Measured as ' +
      'light-only with no dark counterpart — the floor in globals.css declares no dark block — so it ' +
      'cannot collapse when the theme flips. Reasoned in the file itself.',
  },
  {
    file: 'src/app/opengraph-image.tsx',
    category: 'hex-in-copy',
    reason:
      'ImageResponse raster. A share card has no theme, no CSS custom properties and no viewer preference; ' +
      'the literals are the black/white poles of a shading decision computed from the pack at request time.',
  },
];

function exemptionFor(f: Finding) {
  return EXEMPT.find((e) => e.file === f.file && e.category === f.category);
}

const exempted = findings.filter((f) => exemptionFor(f));
const live = findings.filter((f) => !exemptionFor(f));
const visible = SHOW_ALL ? live : live.filter((f) => f.severity !== 'LOW');

if (AS_JSON) {
  // Every finding, each tagged with whether an exemption applies, so a
  // consumer can filter rather than having to guess what was withheld.
  console.log(
    JSON.stringify(
      {
        stats,
        packs: PACKS.map((p) => p.name),
        findings: findings.map((f) => ({ ...f, exemptReason: exemptionFor(f)?.reason ?? null })),
      },
      null,
      2,
    ),
  );
} else {
  console.log('═'.repeat(78));
  console.log('DARK MODE AUDIT — component-level token misuse');
  console.log('═'.repeat(78));
  console.log(`packs resolved: ${PACKS.map((p) => p.name).join(', ')}`);
  console.log(
    `scanned ${stats.files} files · ${stats.classStrings} class strings · ` +
      `${stats.classTokens} utilities · ${stats.colourTokens} colour utilities`,
  );
  console.log(
    `ramp-stop uses: ${stats.rampUses} · semantic uses: ${stats.semanticUses} · ` +
      `fg/bg pairs measured: ${stats.pairsChecked}`,
  );

  console.log('\nRAW BACKSTOP SWEEP (independent of the class parser)');
  for (const b of BACKSTOP) {
    const hits = backstopHits.get(b.name) ?? [];
    console.log(`  ${b.name.padEnd(20)} ${String(hits.length).padStart(4)}`);
    for (const h of hits) console.log(`      ${h}`);
  }

  const byCat = new Map<string, Finding[]>();
  for (const f of live) {
    if (!byCat.has(f.category)) byCat.set(f.category, []);
    byCat.get(f.category)!.push(f);
  }

  console.log('\nCOUNTS BY CATEGORY (all severities, exemptions removed)');
  const cats = [...byCat.entries()].sort((a, b) => b[1].length - a[1].length);
  if (cats.length === 0) console.log('  (none)');
  for (const [cat, list] of cats) {
    const n = (s: Severity) => list.filter((f) => f.severity === s).length;
    const mine = list.filter((f) => !ownedElsewhere(f.file)).length;
    console.log(
      `  ${cat.padEnd(22)} ${String(list.length).padStart(4)}   ` +
        `HIGH ${n('HIGH')}  MED ${n('MEDIUM')}  LOW ${n('LOW')}   (${mine} in fixable scope)`,
    );
  }

  if (exempted.length) {
    console.log('\nEXEMPT — deliberate, with the reason it is deliberate');
    for (const e of EXEMPT) {
      const n = exempted.filter((f) => f.file === e.file && f.category === e.category).length;
      if (!n) continue;
      console.log(`  ${e.file}  (${n} ${e.category})`);
      console.log(`      ${e.reason}`);
    }
  }

  for (const sev of ORDER) {
    const list = visible.filter((f) => f.severity === sev);
    if (list.length === 0) continue;
    console.log(`\n${'─'.repeat(78)}\n${sev} — ${list.length}\n${'─'.repeat(78)}`);
    list.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
    for (const f of list) {
      console.log(`\n${f.file}:${f.line}${ownedElsewhere(f.file) ? '   [report-only — shared component]' : ''}`);
      console.log(`  ${f.category}  ·  ${f.token}`);
      console.log(`  ${f.detail}`);
    }
  }

  const high = live.filter((f) => f.severity === 'HIGH').length;
  console.log(`\n${'═'.repeat(78)}`);
  console.log(
    `${live.length} live finding(s): ${high} HIGH, ` +
      `${live.filter((f) => f.severity === 'MEDIUM').length} MEDIUM, ` +
      `${live.filter((f) => f.severity === 'LOW').length} LOW` +
      `   ·   ${exempted.length} exempt` +
      (SHOW_ALL ? '' : '   (LOW hidden — rerun with --all)'),
  );
  if (high === 0) console.log('No high-severity dark-mode defects.');
}

// =====================================================================
// Runtime pass — a real browser, both themes, every element that paints
// =====================================================================

/**
 * The routes worth loading, one per shape of screen rather than one per
 * URL. Every route group, every console, both member cohorts, the
 * table-heavy screens, the chart-heavy screens, the form-heavy screens,
 * and the states that only render when something is wrong.
 */
const ROUTES: Array<{ path: string; role: string }> = [
  // Public / auth — no session at all.
  { path: '/', role: 'ANON' },
  { path: '/login', role: 'ANON' },
  { path: '/about', role: 'ANON' },
  { path: '/contact', role: 'ANON' },
  { path: '/privacy', role: 'ANON' },
  { path: '/terms', role: 'ANON' },
  { path: '/campus-events', role: 'ANON' },
  { path: '/claim', role: 'ANON' },
  { path: '/verify', role: 'ANON' },

  // Member surface, both cohorts — these are different screens.
  { path: '/dashboard', role: 'STUDENT' },
  { path: '/dashboard', role: 'ALUMNI' },
  { path: '/directory', role: 'ALUMNI' },
  { path: '/directory?q=a&branch=CSE', role: 'ALUMNI' },
  { path: '/connections', role: 'ALUMNI' },
  { path: '/mentorship', role: 'STUDENT' },
  { path: '/events', role: 'ALUMNI' },
  { path: '/jobs', role: 'STUDENT' },
  { path: '/jobs/new', role: 'ALUMNI' },
  { path: '/news', role: 'ALUMNI' },
  { path: '/gallery', role: 'ALUMNI' },
  { path: '/giving', role: 'ALUMNI' },
  { path: '/notifications', role: 'ALUMNI' },
  { path: '/profile', role: 'ALUMNI' },
  { path: '/profile/edit', role: 'ALUMNI' },
  { path: '/profile/preview', role: 'ALUMNI' },
  { path: '/settings', role: 'ALUMNI' },
  { path: '/settings/privacy', role: 'ALUMNI' },
  { path: '/settings/notifications', role: 'ALUMNI' },
  { path: '/settings/security', role: 'ALUMNI' },
  { path: '/settings/data', role: 'ALUMNI' },
  { path: '/welcome', role: 'STUDENT' },
  { path: '/pending', role: 'STUDENT' },

  // Admin console — tables, queues, charts, uploads, forms.
  { path: '/admin', role: 'ADMIN' },
  { path: '/admin/members', role: 'ADMIN' },
  { path: '/admin/verification', role: 'ADMIN' },
  { path: '/admin/degree-register', role: 'ADMIN' },
  { path: '/admin/degree-register/upload', role: 'ADMIN' },
  { path: '/admin/reports', role: 'ADMIN' },
  { path: '/admin/reports/coverage', role: 'ADMIN' },
  { path: '/admin/audit', role: 'ADMIN' },
  { path: '/admin/roles', role: 'ADMIN' },
  { path: '/admin/branding', role: 'ADMIN' },
  { path: '/admin/settings', role: 'ADMIN' },
  { path: '/admin/rollover', role: 'ADMIN' },
  { path: '/admin/imports', role: 'ADMIN' },
  { path: '/admin/data-requests', role: 'ADMIN' },
  { path: '/admin/comms', role: 'ADMIN' },
  { path: '/admin/comms/new', role: 'ADMIN' },
  { path: '/admin/events', role: 'ADMIN' },
  { path: '/admin/events/new', role: 'ADMIN' },
  { path: '/admin/news/new', role: 'ADMIN' },
  { path: '/admin/gallery', role: 'ADMIN' },
  { path: '/admin/jobs', role: 'ADMIN' },
  { path: '/admin/giving', role: 'FINANCE' },

  // Non-admin staff, because their consoles render different subsets.
  { path: '/admin', role: 'HOD' },
  { path: '/admin/verification', role: 'HOD' },
  { path: '/admin', role: 'TPO' },
  { path: '/admin', role: 'OPERATOR' },

  // Platform console.
  { path: '/platform', role: 'PLATFORM' },
  { path: '/platform/brands', role: 'PLATFORM' },
  { path: '/platform/new', role: 'PLATFORM' },

  // A route that does not exist, so the 404 screen is measured too.
  { path: '/nope-not-a-route', role: 'ALUMNI' },
];

interface RuntimeIssue {
  route: string;
  role: string;
  selector: string;
  text: string;
  fg: string;
  bg: string;
  ratio: number;
  kind: 'text' | 'border' | 'fill';
  /** Text only: the WCAG threshold that applies at this size and weight. */
  needs?: number;
}

/**
 * Runs inside the page. Returns every element that paints text (or an
 * edge, or a fill) together with its resolved foreground, its *effective*
 * background — composited down the ancestor chain until it is opaque —
 * and their contrast.
 *
 * Known limitation, checked rather than assumed: a `background-image`
 * gradient does not appear in `background-color`, so an element grounded
 * on a gradient would be measured against whatever is behind the
 * gradient. `grep -rn 'bg-gradient\|linear-gradient'` over `src/app` and
 * `src/components` returns three hits — the OG raster, `GridBackdrop`'s
 * hairline grid, and the marker underline in `LivePreview` — and none of
 * them is a text ground. If that changes, this probe stops being exact.
 */
const PROBE = `(() => {
  const parse = (c) => {
    const m = c && c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(',').map((s) => parseFloat(s.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

  // The page ground, as the compositor sees it.
  const root = parse(getComputedStyle(document.documentElement).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
  const bodyBg = parse(getComputedStyle(document.body).backgroundColor);
  const ground = bodyBg && bodyBg.a > 0 ? over(bodyBg, root) : root;

  const effectiveBg = (el) => {
    let acc = null;
    let node = el;
    while (node && node !== document.documentElement) {
      const s = getComputedStyle(node);
      const c = parse(s.backgroundColor);
      if (c && c.a > 0) {
        acc = acc ? over(acc, c) : c;
        if (acc.a >= 0.999) return acc;
      }
      node = node.parentElement;
    }
    return acc ? over(acc, ground) : ground;
  };

  const sel = (el) => {
    const parts = [];
    let n = el;
    for (let i = 0; n && i < 3; i++) {
      let p = n.tagName.toLowerCase();
      if (n.id) p += '#' + n.id;
      else if (n.className && typeof n.className === 'string') {
        const cls = n.className.trim().split(/\\s+/).slice(0, 4).join('.');
        if (cls) p += '.' + cls;
      }
      parts.unshift(p);
      n = n.parentElement;
    }
    return parts.join(' > ');
  };

  const out = [];
  const seen = new Set();

  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;

    // Own text only: an ancestor's colour is measured on the ancestor.
    let own = '';
    for (const n of el.childNodes) if (n.nodeType === 3) own += n.textContent;
    own = own.trim();

    if (own) {
      const fg = parse(s.color);
      if (fg && fg.a > 0.05) {
        const bg = effectiveBg(el);
        const resolved = fg.a < 1 ? over(fg, bg) : fg;
        const cr = ratio(resolved, bg);
        // WCAG's large-text allowance, applied from what the browser
        // actually computed rather than from the class name: 24px, or
        // 18.66px at 700+. Everything else is body copy at 4.5.
        const px = parseFloat(s.fontSize) || 16;
        const wt = parseInt(s.fontWeight, 10) || 400;
        const needs = px >= 24 || (px >= 18.66 && wt >= 700) ? 3 : 4.5;
        const key = 'T|' + hex(resolved) + '|' + hex(bg) + '|' + sel(el);
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ kind: 'text', selector: sel(el), text: own.slice(0, 60), fg: hex(resolved), bg: hex(bg), ratio: cr, needs: needs });
        }
      }
    }

    // An edge that has vanished into its ground is the same defect class.
    const bw = ['borderTopWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderRightWidth']
      .map((k) => parseFloat(s[k]) || 0);
    if (Math.max.apply(null, bw) > 0) {
      const bc = parse(s.borderTopColor);
      if (bc && bc.a > 0.05) {
        const outer = el.parentElement ? effectiveBg(el.parentElement) : ground;
        const resolved = bc.a < 1 ? over(bc, outer) : bc;
        const cr = ratio(resolved, outer);
        const key = 'B|' + hex(resolved) + '|' + hex(outer) + '|' + sel(el);
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ kind: 'border', selector: sel(el), text: '', fg: hex(resolved), bg: hex(outer), ratio: cr });
        }
      }
    }

    // A painted mark that carries meaning by colour *alone* — a status
    // dot, a chart bar, a progress fill. Nothing above sees these: they
    // have no text to colour and no border to lose.
    //
    // "Alone" is doing real work. The first version of this check flagged
    // five swatches on the branding screens, and all five turned out to
    // be delineated already: the colour fields and preset dots carry
    // border-line-strong, and the ramp strip prints each stop's hex on
    // top of it. A fill whose element is outlined by a token that flips,
    // or which contains its own text, is still perceivable at any
    // contrast, so it is not a mark and does not belong in this reading.
    const ownBg = parse(s.backgroundColor);
    const bordered = Math.max.apply(null, bw) > 0 && (() => {
      const bc = parse(s.borderTopColor);
      if (!bc || bc.a < 0.05 || !ownBg) return false;
      return ratio(bc, ownBg) > 1.2;
    })();
    const anyText = (el.textContent || '').trim().length > 0;

    if (ownBg && ownBg.a > 0.05 && !own && !bordered && !anyText) {
      const outer = el.parentElement ? effectiveBg(el.parentElement) : ground;
      const resolved = ownBg.a < 1 ? over(ownBg, outer) : ownBg;
      const cr = ratio(resolved, outer);
      const key = 'F|' + hex(resolved) + '|' + hex(outer) + '|' + sel(el);
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ kind: 'fill', selector: sel(el), text: '', fg: hex(resolved), bg: hex(outer), ratio: cr });
      }
    }
  }

  return {
    theme: document.documentElement.getAttribute('data-theme'),
    bodyBg: hex(ground),
    bodyFg: getComputedStyle(document.body).color,
    count: out.length,
    items: out,
  };
})()`;

/**
 * Prove the instrument before trusting it.
 *
 * A probe that silently returns nothing looks exactly like a clean app,
 * and "no findings" is the result this audit is most likely to reach — so
 * the probe has to be shown to fire. This loads a real page in dark mode
 * and injects four elements with known answers:
 *
 *   1. a ramp foreground on the ambient ground  — must be caught
 *   2. a semantic pair that is correct          — must NOT be caught
 *   3. a fill that vanishes into its parent     — must be caught
 *   4. an element whose ground is set two levels up — must be caught,
 *      which is the part a single-element reading would miss
 *
 *   npx tsx scripts/darkmode-audit.ts --selftest --base http://localhost:3300
 */
async function selfTest(base: string): Promise<boolean> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  await ctx.addInitScript(`try{localStorage.setItem('theme','dark')}catch(e){}`);
  const page = await ctx.newPage();
  await page.goto(base + '/login', { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(800);

  await page.evaluate(`(() => {
    const host = document.createElement('div');
    host.id = 'dm-selftest';
    host.style.background = 'var(--surface)';
    host.innerHTML =
      '<p id="st-ramp" style="color:var(--neutral-800)">ramp ink on ambient ground</p>' +
      '<p id="st-ok" style="color:var(--text-primary)">semantic ink on ambient ground</p>' +
      '<span id="st-fill" style="display:block;width:20px;height:20px;background:var(--surface)"></span>' +
      '<div style="background:var(--surface-inverse)"><div><p id="st-nested" style="color:var(--text-primary)">ink two levels above its ground</p></div></div>';
    document.body.appendChild(host);
  })()`);

  const probe = (await page.evaluate(PROBE)) as { theme: string | null; items: RuntimeIssue[] };
  await browser.close();

  const find = (id: string) => probe.items.find((i) => i.selector.includes('#' + id));
  const checks: Array<[string, boolean, string]> = [];

  checks.push(['theme applied', probe.theme === 'dark', `data-theme=${probe.theme}`]);

  const ramp = find('st-ramp');
  checks.push([
    'ramp ink on ambient ground is caught',
    Boolean(ramp && ramp.ratio < INVISIBLE),
    ramp ? `${ramp.fg} on ${ramp.bg} = ${ramp.ratio.toFixed(2)}:1` : 'not measured at all',
  ]);

  const ok = find('st-ok');
  checks.push([
    'correct semantic pair is not caught',
    Boolean(ok && ok.ratio >= INVISIBLE),
    ok ? `${ok.fg} on ${ok.bg} = ${ok.ratio.toFixed(2)}:1` : 'not measured at all',
  ]);

  const fill = find('st-fill');
  checks.push([
    'fill identical to its parent is caught',
    Boolean(fill && fill.kind === 'fill' && fill.ratio < INVISIBLE),
    fill ? `${fill.fg} on ${fill.bg} = ${fill.ratio.toFixed(2)}:1` : 'not measured at all',
  ]);

  // The inherited-ground case. `--text-primary` on `--surface-inverse` is
  // the same colour by construction in both modes, and the ground is two
  // ancestors up — a reading that only looked at the element itself would
  // score it against the page and call it fine.
  const nested = find('st-nested');
  checks.push([
    'ground inherited from two levels up is resolved',
    Boolean(nested && nested.ratio < INVISIBLE),
    nested ? `${nested.fg} on ${nested.bg} = ${nested.ratio.toFixed(2)}:1` : 'not measured at all',
  ]);

  console.log('─'.repeat(78));
  console.log('PROBE SELF-TEST');
  console.log('─'.repeat(78));
  let pass = true;
  for (const [what, good, detail] of checks) {
    console.log(`  ${good ? 'pass' : 'FAIL'}  ${what.padEnd(46)} ${detail}`);
    if (!good) pass = false;
  }
  console.log(pass ? '  instrument verified\n' : '  INSTRUMENT NOT VERIFIED — findings below are not trustworthy\n');
  return pass;
}

/**
 * Settling probe. Counts painted elements and nothing else.
 *
 * The full probe calls `getComputedStyle` several times per element and
 * walks the ancestor chain for each one; running it in a poll loop cost
 * about two and a half minutes per route, which projected to two and a
 * half hours for the sweep. Settling only needs to know whether the page
 * is still growing, so it uses this instead and the full probe runs once.
 */
const COUNT_PROBE = `document.querySelectorAll('body *').length`;

async function runtimePass(): Promise<void> {
  const base = flag('--base', 'http://localhost:3300').replace(/\/$/, '');
  const cookieFile = flag('--cookies', '/tmp/cookies.env');

  const cookies: Record<string, string> = {};
  try {
    for (const line of readFileSync(cookieFile, 'utf8').split(/\r?\n/)) {
      const m = /^(SESSION_[A-Z]+)='([^=]+)=(.*)'$/.exec(line.trim());
      if (m) cookies[m[1]!.replace('SESSION_', '')] = m[3]!;
    }
  } catch {
    console.error(`Could not read ${cookieFile}. Run: npx tsx scripts/mint-all.ts ${cookieFile}`);
    process.exit(2);
  }

  const cookieName = process.env.SESSION_COOKIE_NAME ?? 'alumni_session';
  const { chromium } = await import('playwright');

  // 124 page loads beside two dev servers is enough to get the browser
  // OOM-killed on a laptop, and "Target crashed" mid-sweep loses the
  // whole run. Cap the renderer heap, keep the shared-memory transport
  // off, and be able to bring the browser back rather than aborting.
  const LAUNCH = {
    args: ['--disable-dev-shm-usage', '--js-flags=--max-old-space-size=768', '--disable-gpu'],
  };
  let browser = await chromium.launch(LAUNCH);

  const newContext = async () => {
    try {
      return await browser.newContext({ viewport: { width: 1280, height: 900 } });
    } catch {
      try {
        await browser.close();
      } catch {
        /* already gone */
      }
      process.stdout.write(' [browser relaunched] ');
      browser = await chromium.launch(LAUNCH);
      return browser.newContext({ viewport: { width: 1280, height: 900 } });
    }
  };

  const host = new URL(base).hostname;
  const results: Array<{
    route: string;
    role: string;
    ok: boolean;
    note: string;
    light: Map<string, RuntimeIssue>;
    dark: Map<string, RuntimeIssue>;
    elements: number;
    ground: { light: string; dark: string };
  }> = [];

  console.log('═'.repeat(78));
  console.log(`RUNTIME PASS — ${base}`);
  console.log('═'.repeat(78));

  // Wait for the server to be answering at all.
  //
  // The dev server this runs against is shared, and restarting it is a
  // normal thing for somebody else to be doing (`rm -rf .next` is in the
  // team's own instructions). A pass that treats "connection refused" as
  // "this screen is broken in dark mode" produces a page of fiction, so
  // block until it answers instead.
  // A tenant subdomain (`ifbash.localhost`) resolves in Chromium, which
  // implements the `.localhost` reservation itself, but not in Node's
  // DNS. So the fetch-based warm-up and health check only apply to the
  // default host; a second-tenant pass runs with --no-warm and lets the
  // browser do the resolving.
  const canFetch = !ARGS.has('--no-warm');

  const waitForServer = async (why: string): Promise<boolean> => {
    if (!canFetch) return true;
    for (let i = 0; i < 120; i++) {
      try {
        const r = await fetch(base + '/login', { redirect: 'manual' });
        if (r.status < 500) return true;
      } catch {
        /* not up yet */
      }
      if (i === 0) process.stdout.write(`  waiting for the server (${why})`);
      else if (i % 5 === 0) process.stdout.write('.');
      await new Promise((r) => setTimeout(r, 5000));
    }
    console.log('  gave up.');
    return false;
  };

  if (!(await waitForServer('startup'))) {
    console.error(`No server answering at ${base}. Start one and re-run.`);
    await browser.close();
    process.exit(2);
  }

  // Warm every route before measuring any of them.
  //
  // `next dev` compiles on first request, and a route being compiled
  // answers slowly or 500s. Measured cold, that reads as "this screen is
  // broken in dark mode" when it means "this screen had not been built
  // yet" — an early run of this pass lost six routes to exactly that.
  process.stdout.write(canFetch ? '  warming routes' : '  (warm-up skipped)');
  let warmFailures = 0;
  for (const route of canFetch ? ROUTES : []) {
    const headers: Record<string, string> = {};
    if (route.role !== 'ANON' && cookies[route.role]) {
      headers.cookie = `${cookieName}=${cookies[route.role]}`;
    }
    try {
      const r = await fetch(base + route.path, { headers, redirect: 'manual' });
      process.stdout.write(r.status >= 500 ? '!' : '.');
      if (r.status >= 500) warmFailures++;
    } catch {
      process.stdout.write('x');
      warmFailures++;
      await waitForServer('restarted mid-warm');
    }
  }
  console.log(canFetch ? `  (${ROUTES.length} routes, ${warmFailures} not warm)\n` : '\n');

  // `--anon-only` exists for a second-tenant pass: the minted cookies
  // carry `tenantId: ten-diet`, so they are not a session anywhere else,
  // and sending them would measure a redirect rather than a screen.
  const routes = ARGS.has('--anon-only') ? ROUTES.filter((r) => r.role === 'ANON') : ROUTES;

  for (const route of routes) {
    const modes: Record<'light' | 'dark', Map<string, RuntimeIssue>> = {
      light: new Map(),
      dark: new Map(),
    };
    let elements = 0;
    const ground = { light: '', dark: '' };
    let note = '';
    let ok = true;

    for (const mode of ['light', 'dark'] as const) {
      // `next dev` compiles a route on first request and is shared with
      // whatever else is pointed at the same port, so a cold or contended
      // route answers 500 or refuses the connection once and then works.
      // Retrying is what separates a real defect from server churn; a
      // route that fails all three attempts is reported as unmeasured
      // rather than quietly counted as clean.
      let attempt = 0;
      let settled = false;
      // Refunded attempts, bounded, so a server that flaps forever ends
      // the route rather than the run.
      let refunds = 0;

      while (attempt < 3 && !settled) {
        attempt++;
        const ctx = await newContext();

        // Set the preference the way the app sets it, so THEME_BOOT
        // applies it before first paint rather than after hydration.
        await ctx.addInitScript(`try{localStorage.setItem('theme','${mode}')}catch(e){}`);

        if (route.role !== 'ANON') {
          const value = cookies[route.role];
          if (!value) {
            note = `no cookie for ${route.role}`;
            ok = false;
            await ctx.close();
            break;
          }
          await ctx.addCookies([{ name: cookieName, value, domain: host, path: '/' }]);
        }

        const page = await ctx.newPage();
        try {
          // `networkidle` never settles against `next dev` — the HMR
          // client keeps polling — so wait for the document instead and
          // then give the streamed shell a beat to resolve its Suspense
          // boundaries.
          const resp = await page.goto(base + route.path, { waitUntil: 'domcontentloaded', timeout: 90_000 });
          const status = resp?.status() ?? 0;

          if (status >= 500) {
            if (attempt < 3) {
              await page.waitForTimeout(1500);
              continue;
            }
            note = `HTTP ${status} after ${attempt} attempts`;
            ok = false;
            settled = true;
            continue;
          }

          await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {});

          // `load` is not "the page is here". `src/app/loading.tsx` puts a
          // Suspense boundary directly under the root layout, so the shell
          // — and therefore `load` — completes while the real page is
          // still streaming. Sampling at a fixed delay reads the skeleton
          // on whichever pass happens to be the fast one, and the first
          // run of this probe did exactly that: 14 elements in dark on
          // every route against 33–65 in light, because the light pass was
          // slowed by first-hit compilation and the dark pass was not.
          //
          // So sample until the count stops growing rather than until a
          // clock runs out.
          type Probe = { theme: string | null; bodyBg: string; count: number; items: RuntimeIssue[] };

          // A page that redirects client-side (`/verify` does) tears down
          // the execution context mid-evaluate. That is the page working,
          // not failing, so ride it out and read the destination.
          const evalSafe = async <T,>(script: string): Promise<T | null> => {
            try {
              return (await page.evaluate(script)) as T;
            } catch (e) {
              if (/Execution context was destroyed|navigation/i.test((e as Error).message)) {
                await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {});
                await page.waitForTimeout(400);
                return (await page.evaluate(script).catch(() => null)) as T | null;
              }
              throw e;
            }
          };

          let seenCount = -1;
          for (let settle = 0; settle < 20; settle++) {
            const n = (await evalSafe<number>(COUNT_PROBE)) ?? 0;
            if (n === seenCount && settle >= 1) break;
            seenCount = n;
            await page.waitForTimeout(400);
          }

          const probe = await evalSafe<Probe>(PROBE);
          if (!probe) throw new Error('probe never returned');

          // The whole pass is worthless if the theme did not apply.
          if (mode === 'dark' && probe.theme !== 'dark') {
            note = `theme did not apply (data-theme=${probe.theme})`;
            ok = false;
          }
          if (probe.count === 0) {
            if (attempt < 3) {
              await page.waitForTimeout(1500);
              continue;
            }
            note = 'no elements painted';
            ok = false;
          }

          elements = Math.max(elements, probe.count);
          for (const it of probe.items) {
            modes[mode].set(`${it.kind}|${it.selector}|${it.text}`, {
              ...it,
              route: route.path,
              role: route.role,
            });
          }
          ground[mode] = probe.bodyBg;
          if (mode === 'dark') note = note || `bg ${probe.bodyBg}`;
          settled = true;
        } catch (err) {
          const message = (err as Error).message.split('\n')[0]!;
          // Neither the server going away nor the browser dying is a
          // finding about the route. Recover and spend another attempt.
          if (
            refunds < 5 &&
            /ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_EMPTY_RESPONSE|Target crashed|Target closed|browser has been closed/i.test(
              message,
            )
          ) {
            await ctx.close().catch(() => {});
            if (await waitForServer('restarted mid-route')) {
              refunds++;
              attempt--;
              continue;
            }
          }
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
          note = `load failed: ${message}`;
          ok = false;
          settled = true;
        } finally {
          await ctx.close().catch(() => {});
        }
      }
    }

    results.push({ route: route.path, role: route.role, ok, note, ...modes, elements, ground });
    process.stdout.write(
      `  ${ok ? '·' : '!'} ${route.role.padEnd(9)} ${route.path.padEnd(34)} ` +
        `${String(modes.light.size).padStart(4)} light / ${String(modes.dark.size).padStart(4)} dark  ${note}\n`,
    );
  }

  await browser.close();

  // -------------------------------------------------------------------
  // Diff the two readings
  // -------------------------------------------------------------------

  const darkOnly: Array<RuntimeIssue & { lightRatio: number }> = [];
  const bothModes: RuntimeIssue[] = [];
  const aaDarkOnly: Array<RuntimeIssue & { lightRatio: number }> = [];
  let measured = 0;

  for (const r of results) {
    for (const [key, d] of r.dark) {
      measured++;
      const l = r.light.get(key);
      const lightRatio = l ? l.ratio : NaN;

      // Separately from the collapse test: real rendered text that meets
      // its WCAG threshold in light and misses it in dark. Weaker than a
      // collapse, but it is the rendered counterpart of the static
      // `pair-below-aa` finding and confirms it on actual screens.
      if (d.kind === 'text' && d.needs && l && l.ratio >= d.needs && d.ratio < d.needs) {
        aaDarkOnly.push({ ...d, lightRatio });
      }

      // A fill has no absolute threshold — a card sitting on the page is
      // meant to be a whisper against it, and a status dot is not, and
      // nothing in the DOM distinguishes them. What *is* diagnostic is
      // losing a distinction the light theme had: a mark that cleared
      // 3:1 in light and does not in dark stopped being a mark, and that
      // is a dark-mode defect by construction.
      if (d.kind === 'fill') {
        if (l && l.ratio >= INVISIBLE && d.ratio < INVISIBLE) darkOnly.push({ ...d, lightRatio });
        continue;
      }

      const threshold = d.kind === 'border' ? BORDER_GONE : INVISIBLE;
      if (d.ratio >= threshold) continue;
      if (l && l.ratio < threshold) bothModes.push(d);
      else darkOnly.push({ ...d, lightRatio });
    }
  }

  const failedRoutes = results.filter((r) => !r.ok);

  // The most basic question, asked last because it is the one a
  // contrast sweep cannot answer: did the theme reach this screen at
  // all? A route rendered outside the root layout would carry
  // data-theme="dark" and still paint the default light ground, and
  // every element on it would be internally consistent — invisible to
  // every check above, and obvious the moment the two grounds are
  // compared.
  const themeless = results.filter(
    (r) => r.ok && r.ground.light && r.ground.dark && r.ground.light === r.ground.dark,
  );

  console.log(`\n${'─'.repeat(78)}`);
  console.log(
    `${results.length} routes × 2 themes · ${measured} element readings in dark · ` +
      `${failedRoutes.length} route(s) could not be measured`,
  );
  for (const f of failedRoutes) console.log(`  ! ${f.role} ${f.route} — ${f.note}`);

  console.log(
    `\ntheme actually applied: ${results.filter((r) => r.ok).length - themeless.length}/` +
      `${results.filter((r) => r.ok).length} measured routes changed page ground between modes`,
  );
  for (const t of themeless) {
    console.log(`  ! ${t.role} ${t.route} — ground stayed ${t.ground.light} in both modes`);
  }

  const show = (title: string, list: Array<RuntimeIssue & { lightRatio?: number }>) => {
    console.log(`\n${'─'.repeat(78)}\n${title} — ${list.length}\n${'─'.repeat(78)}`);
    if (!list.length) {
      console.log('  none');
      return;
    }
    // 60 was too low: the diet sweep produced 75 AA regressions and the
    // truncated tail hid a fifth of the evidence for a finding whose
    // whole value is the count.
    for (const i of list.slice(0, 250)) {
      console.log(`\n  ${i.role} ${i.route}`);
      console.log(`    ${i.selector}`);
      if (i.text) console.log(`    text: ${JSON.stringify(i.text)}`);
      console.log(
        `    ${i.kind}: ${i.fg} on ${i.bg} = ${i.ratio.toFixed(2)}:1 dark` +
          (i.lightRatio !== undefined && Number.isFinite(i.lightRatio)
            ? `  (${i.lightRatio.toFixed(2)}:1 light)`
            : '') +
          (i.needs ? `  needs ${i.needs}:1` : ''),
      );
    }
    if (list.length > 250) console.log(`\n  … ${list.length - 250} more`);
  };

  show('DARK-MODE-ONLY COLLAPSES  (fg and bg resolve alike in dark, not in light)', darkOnly);
  show('FAILS IN BOTH MODES  (a contrast bug, not a dark-mode bug)', bothModes);
  show('MEETS WCAG IN LIGHT, MISSES IT IN DARK  (weaker than a collapse)', aaDarkOnly);

  console.log(`\n${'═'.repeat(78)}`);
  console.log(
    `runtime: ${darkOnly.length} dark-only collapse(s), ${bothModes.length} both-mode, ` +
      `${aaDarkOnly.length} AA regression(s), ${themeless.length} route(s) the theme did not reach, ` +
      `${failedRoutes.length} unmeasurable route(s)`,
  );

  if (darkOnly.length || themeless.length || failedRoutes.length) process.exit(1);
}

const staticExit = live.some((f) => f.severity === 'HIGH') ? 1 : 0;

// Not top-level await: this file is transpiled to CJS by tsx.
if (ARGS.has('--selftest')) {
  selfTest(flag('--base', 'http://localhost:3300').replace(/\/$/, '')).then(
    (pass) => process.exit(pass ? 0 : 1),
    (err) => {
      console.error(err);
      process.exit(2);
    },
  );
} else if (RUNTIME) {
  runtimePass().then(
    () => process.exit(staticExit),
    (err) => {
      console.error(err);
      process.exit(2);
    },
  );
} else {
  process.exit(staticExit);
}
