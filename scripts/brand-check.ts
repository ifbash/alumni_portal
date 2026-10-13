#!/usr/bin/env tsx
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BrandPack } from '../src/lib/branding/pack';
import { buildTokens, contrastReport } from '../src/lib/branding/tokens';
import { contrastRatio } from '../src/lib/branding/color';

/**
 * Audit every shipped brand pack.
 *
 * Run in CI. A customer's colours are data, and data ships without a code
 * review — which means the only thing standing between a registrar
 * pasting their letterhead yellow and an unreadable portal is this
 * check failing the build.
 *
 * Errors exit non-zero. Warnings are printed and tolerated: a marginal
 * accent is a judgement call, body text nobody can read is not.
 */

const BRANDS_DIR = join(process.cwd(), 'brands');

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

/** Pairs the UI actually renders. Checking anything else invents work. */
const PAIRS: Array<{ fg: string; bg: string; required: number; what: string }> = [
  { fg: '--text-primary', bg: '--surface', required: 7, what: 'body text on the page' },
  { fg: '--text-secondary', bg: '--surface', required: 4.5, what: 'secondary copy' },
  { fg: '--text-muted', bg: '--surface', required: 3, what: 'hints and captions' },
  { fg: '--brand-fg', bg: '--surface', required: 4.5, what: 'brand-coloured text' },
  // The same token inside a card. Cards are where most brand-coloured text
  // actually lives, and `--surface-raised` is a different ground from
  // `--surface` — checking only the latter passed a token that failed at
  // 4.19:1 in dark mode everywhere it was really used.
  { fg: '--brand-fg', bg: '--surface-raised', required: 4.5, what: 'brand-coloured text inside a card' },
  { fg: '--accent-fg', bg: '--surface-raised', required: 4.5, what: 'accent text inside a card' },
  { fg: '--text-secondary', bg: '--surface-raised', required: 4.5, what: 'secondary copy inside a card' },
  { fg: '--brand-soft-fg', bg: '--brand-soft', required: 4.5, what: 'text on a brand tint' },
  { fg: '--button-primary-fg', bg: '--button-primary-bg', required: 4.5, what: 'primary button label' },
  { fg: '--focus-ring', bg: '--surface', required: 3, what: 'keyboard focus ring' },
  // The ring is drawn on the header bar, cards, chips and inputs far more
  // often than on the bare page. Auditing only `--surface` passed a dark
  // ring at 2.83:1 on every raised control. buildTokens audits this pair as
  // an error too, so a failure here also blocks publication.
  { fg: '--focus-ring', bg: '--surface-raised', required: 3, what: 'focus ring on a raised surface' },
  { fg: '--danger-fg', bg: '--surface', required: 4.5, what: 'error text' },
  { fg: '--success-on', bg: '--success', required: 4.5, what: 'text on a success fill' },

  // Status text on its own tinted panel — an Alert or a Badge. This is a
  // *different* ground from the page surface and a harder one, because the
  // tint moves toward the text's own hue. Missing these four rows is how
  // `--success-fg` shipped at 4.21:1 light and 3.79:1 dark on every pack
  // while reading as passing: the token was measured against the surface
  // and rendered on the tint.
  { fg: '--success-fg', bg: '--success-soft', required: 4.5, what: 'success text inside its own panel' },
  { fg: '--warning-fg', bg: '--warning-soft', required: 4.5, what: 'warning text inside its own panel' },
  { fg: '--danger-fg', bg: '--danger-soft', required: 4.5, what: 'error text inside its own panel' },
  { fg: '--info-fg', bg: '--info-soft', required: 4.5, what: 'info text inside its own panel' },
  { fg: '--text-on-inverse', bg: '--surface-inverse', required: 4.5, what: 'text on dark bands' },

  // The college band: header strip, landing hero, footer, sign-in panel.
  // Band text is held to AAA like body copy — it is the first thing on
  // the page. The scrim composite (band text over a white photo pixel) is
  // not a token pair, so buildTokens audits it and it lands in the report.
  { fg: '--band-fg', bg: '--band', required: 7, what: 'text on the college band' },
  { fg: '--band-muted', bg: '--band', required: 4.5, what: 'secondary text on the band' },
  { fg: '--band-accent', bg: '--band', required: 4.5, what: 'accent text on the band' },

  // Chart bars are graphical objects on a card (WCAG 1.4.11). buildTokens
  // audits both as errors, so a failure here also blocks publication.
  { fg: '--chart-bar', bg: '--surface-raised', required: 3, what: 'chart bars on a card' },
  { fg: '--chart-bar-highlight', bg: '--surface-raised', required: 3, what: 'highlighted chart bars' },
];

const PUBLIC_DIR = join(process.cwd(), 'public');
const KB = 1024;
const IMAGE_BUDGET = 350 * KB;
const VIDEO_BUDGET = 8 * KB * KB;

/** A site-relative asset's file under public/, or null for a URL or data URI. */
function localFile(ref: string | undefined): string | null {
  if (!ref || !ref.startsWith('/')) return null;
  return join(PUBLIC_DIR, (ref.split(/[?#]/)[0] ?? ref).replace(/^\/+/, ''));
}

const size = (bytes: number) =>
  bytes >= KB * KB ? `${(bytes / KB / KB).toFixed(1)} MB` : `${Math.round(bytes / KB)} KB`;

let errors = 0;
let warnings = 0;

const files = readdirSync(BRANDS_DIR).filter((f) => f.endsWith('.json'));

if (files.length === 0) {
  console.error('No brand packs found in brands/.');
  process.exit(1);
}

for (const file of files) {
  const raw = JSON.parse(readFileSync(join(BRANDS_DIR, file), 'utf8'));
  const parsed = BrandPack.safeParse(stripNotes(raw));

  console.log(`\n${'─'.repeat(64)}\n${file}`);

  if (!parsed.success) {
    console.error('  INVALID — will crash the app at boot:');
    for (const issue of parsed.error.issues) {
      console.error(`    ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    errors++;
    continue;
  }

  const pack = parsed.data;
  const tokens = buildTokens(pack);
  const report = contrastReport(pack);

  console.log(`  ${pack.copy.portalName} — ${pack.copy.institutionName}`);
  console.log(`  seed ${pack.color.primary}${pack.color.accent ? ` / ${pack.color.accent}` : ''} on ${pack.color.surface}`);
  console.log(`  type ${pack.type.display} / ${pack.type.body} (${pack.type.source})`);

  const on = Object.entries(pack.features).filter(([, v]) => v).map(([k]) => k);
  console.log(`  features ${on.join(', ') || 'none'}`);

  for (const mode of ['light', 'dark'] as const) {
    const set = mode === 'light' ? tokens.light : tokens.dark;
    const surface = set['--surface'] ?? tokens.light['--surface']!;

    console.log(`\n  ${mode}  (surface ${surface})`);

    for (const pair of PAIRS) {
      // Dark inherits every token it does not restate, so fall back to
      // light rather than reporting a false miss.
      const fg = set[pair.fg] ?? tokens.light[pair.fg];
      const bg = set[pair.bg] ?? tokens.light[pair.bg];
      if (!fg || !bg || fg.startsWith('rgb') || bg.startsWith('rgb')) continue;

      const ratio = contrastRatio(fg, bg);
      const pass = ratio >= pair.required;
      const mark = pass ? '·' : ratio >= pair.required - 0.6 ? '!' : '✗';

      if (!pass) {
        console.log(`    ${mark} ${pair.what.padEnd(28)} ${ratio.toFixed(2)}:1  needs ${pair.required}  (${fg} on ${bg})`);
      }
    }
  }

  console.log(`\n  ${report.summary}`);
  errors += report.errors.length;
  warnings += report.warnings.length;

  // ── Content ──────────────────────────────────────────────────────
  // The hero copy is also the WhatsApp preview and the first screen on a
  // 390px phone, and both cut it off without saying so.
  const copy = pack.copy;
  if (copy.heroSubhead && copy.heroSubhead.length > 140) {
    console.log(
      `  ! heroSubhead is ${copy.heroSubhead.length} characters (over 140) — cut off in WhatsApp previews and runs past four lines on a phone.`,
    );
    warnings++;
  }
  if (copy.heroHeadline && copy.heroHeadline.length > 60) {
    console.log(`  ! heroHeadline is ${copy.heroHeadline.length} characters (over 60) — it crowds the hero on a phone.`);
    warnings++;
  }
  if (copy.heroEmphasis && !(copy.heroHeadline ?? '').includes(copy.heroEmphasis)) {
    console.log(`  ! heroEmphasis "${copy.heroEmphasis}" does not appear in heroHeadline, so nothing is emphasised.`);
    warnings++;
  }

  // ── Media ────────────────────────────────────────────────────────
  // Every slot renders nothing when absent, so a missing key is fine. A key
  // that points at a file that is not there is not: it is a broken image
  // on the first screen of the landing page.
  const a = pack.assets;
  if (a.heroImage && !a.heroImageAlt) {
    console.log('  · heroImage has no heroImageAlt — treated as decorative (alt="").');
  }

  const required: Array<[string, string | undefined]> = [
    ['logoPrimary', a.logoPrimary],
    ['logoInverse', a.logoInverse],
    ['logoMark', a.logoMark],
    ['crest', a.crest],
    ['heroImage', a.heroImage],
    ['heroVideo', a.heroVideo],
    ['authImage', a.authImage],
    ...a.campusPhotos.map((p, i): [string, string] => [`campusPhotos[${i}]`, p.src]),
  ];
  const photos = new Set<string>(['heroImage', 'authImage', ...a.campusPhotos.map((_, i) => `campusPhotos[${i}]`)]);

  for (const [slot, ref] of required) {
    const file = localFile(ref);
    if (!file) continue;
    if (!existsSync(file)) {
      console.log(`  ✗ ${slot} ${ref} does not exist under public/.`);
      errors++;
      continue;
    }
    const bytes = statSync(file).size;
    if (photos.has(slot) && bytes > IMAGE_BUDGET) {
      console.log(`  ! ${slot} ${ref} is ${size(bytes)} (over 350 KB) — it is downloaded on phones, often as the largest paint.`);
      warnings++;
    }
    if (slot === 'heroVideo' && bytes > VIDEO_BUDGET) {
      console.log(`  ! heroVideo ${ref} is ${size(bytes)} (over 8 MB). Aim for under 6 MB.`);
      warnings++;
    }
  }

  // Reported, not counted: neither is on a page's first screen, and a
  // missing ogImage falls back to the generated card (app/opengraph-image.tsx).
  const faviconFile = localFile(a.favicon);
  if (faviconFile && !existsSync(faviconFile)) {
    console.log(`  · favicon ${a.favicon} is not under public/ — browsers will show no tab icon.`);
  }
  const ogFile = localFile(a.ogImage);
  if (ogFile && !existsSync(ogFile)) {
    console.log(`  · ogImage ${a.ogImage} is not under public/ — the generated share card is used instead.`);
  }

  if (pack.type.source === 'local' && pack.type.fontFaces.length === 0) {
    console.log('  ! type.source is "local" but no fontFaces are declared — the pack will fall back to system fonts.');
    warnings++;
  }

  if (!pack.assets.logoPrimary && !pack.assets.crest && !pack.assets.logoMark) {
    console.log('  · no logo supplied — the portal name renders in the display face. Intentional for a new tenant.');
  }

  if (pack.features.donations) {
    console.log('  ! donations is ON. Confirm FCRA registration before this ships — foreign');
    console.log('    contributions must be segregated at the point of collection.');
    warnings++;
  }
}

console.log(`\n${'─'.repeat(64)}`);
console.log(`${files.length} pack(s) · ${errors} error(s) · ${warnings} warning(s)`);

if (errors > 0) {
  console.error('\nBuild refused. A pack with contrast errors or missing asset files cannot be published.');
  process.exit(1);
}
