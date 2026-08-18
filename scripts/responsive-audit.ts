#!/usr/bin/env tsx
/**
 * Responsive audit.
 *
 * The design system claims "mobile first". This measures the claim instead
 * of restating it, in two halves that fail in different ways:
 *
 *   STATIC   — every .tsx under src/app and src/components, read as source,
 *              scanned for the six class-level patterns that break a 360px
 *              viewport. Catches intent: what the author wrote.
 *
 *   RENDERED — a representative set of routes fetched from a running dev
 *              server, with the emitted HTML walked as a real ancestor tree.
 *              Catches consequence: what actually reaches the phone, after
 *              every component in the chain has had its say.
 *
 * The two halves disagree usefully. A page can look clean in source and
 * still emit a 900px table because the wrapper it trusted was rendered by
 * something else; a `min-w-[720px]` in source is a *correct* pattern when
 * an `overflow-x-auto` ancestor exists, and a page-breaking one when it
 * does not. Only the rendered pass can tell those apart, which is why the
 * table rule is scored there and merely noted here.
 *
 *   npx tsx scripts/responsive-audit.ts                 # static only
 *   npx tsx scripts/responsive-audit.ts --render        # both halves
 *   npx tsx scripts/responsive-audit.ts --render --base http://localhost:3400
 *   npx tsx scripts/responsive-audit.ts --json          # machine-readable
 *
 * Session cookies for the rendered half come from the environment, minted
 * once by scripts/mint-all.ts:
 *
 *   npx tsx scripts/mint-all.ts /tmp/cookies.env && . /tmp/cookies.env
 *
 * Exit code is 1 when any HIGH finding survives, so this can gate CI.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/* ------------------------------------------------------------------ */
/* The viewport being audited                                          */
/* ------------------------------------------------------------------ */

/**
 * 360px is the measurement target, not an arbitrary round number. It is
 * the modal Android viewport width on the Indian handsets this portal is
 * actually used on, and — per CLAUDE.md — WhatsApp is the real comms
 * channel, so most first touches on any page arrive from a phone.
 *
 * Minus the AppShell's own `px-4` on both sides, a page has 328px of
 * usable width. Anything that demands more forces the document to scroll
 * sideways, which is the failure this audit exists to find.
 */
const VIEWPORT = 360;
const SHELL_PADDING_X = 16; // AppShell <main> px-4
const USABLE = VIEWPORT - SHELL_PADDING_X * 2; // 328px

/** Tailwind spacing scale → px, for the padding rule. */
const SPACING_PX: Record<string, number> = {
  '0': 0, '0.5': 2, '1': 4, '1.5': 6, '2': 8, '2.5': 10, '3': 12, '3.5': 14,
  '4': 16, '5': 20, '6': 24, '7': 28, '8': 32, '9': 36, '10': 40, '11': 44,
  '12': 48, '14': 56, '16': 64, '20': 80, '24': 96,
};

const RESPONSIVE = ['sm:', 'md:', 'lg:', 'xl:', '2xl:'] as const;

/* ------------------------------------------------------------------ */
/* Finding model                                                       */
/* ------------------------------------------------------------------ */

type Severity = 'HIGH' | 'MED' | 'INFO';

type RuleId =
  | 'fixed-grid'
  | 'fixed-width'
  | 'bare-table'
  | 'wide-table'
  | 'unwrapped-flex'
  | 'nowrap-content'
  | 'desktop-padding'
  | 'rendered-overflow'
  | 'rendered-table'
  | 'rendered-nowrap'
  | 'rendered-unbreakable'
  | 'rendered-desktop-first';

interface Finding {
  rule: RuleId;
  severity: Severity;
  file: string;
  line: number;
  snippet: string;
  /** What breaks at 360px. A finding that cannot answer this is not a finding. */
  breaks: string;
}

const findings: Finding[] = [];

/**
 * Routes the rendered half could not score. Printed with the summary so a
 * clean report always states what it did *not* cover — coverage and
 * correctness are different claims and the report must not conflate them.
 */
const notMeasured: string[] = [];

function report(f: Finding) {
  findings.push(f);
}

/* ------------------------------------------------------------------ */
/* Source walking                                                      */
/* ------------------------------------------------------------------ */

const ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/** file-relative, POSIX-ish, for stable reporting on Windows. */
const rel = (f: string) => relative(ROOT, f).split(sep).join('/');

const lineOf = (src: string, index: number) => src.slice(0, index).split('\n').length;

/**
 * Every class-bearing string literal in a file, with its offset.
 *
 * Deliberately loose: it picks up `className="…"`, `className={cn('…', …)}`,
 * variant maps (`{ sm: 'h-8 px-3' }`) and template literals alike, because
 * a defect hidden in a lookup table breaks the same viewport as one written
 * inline. The cost is that a non-class string containing the word "grid"
 * could in principle match — every rule below therefore keys on a real
 * Tailwind token shape, not on a substring.
 */
/**
 * Blank out comment bodies, preserving offsets so line numbers stay true.
 *
 * Without this the audit reads its own documentation as evidence: the
 * header of `admin/audit/loading.tsx` explains that the table sits in its
 * own container "at `min-w-[62rem]` rather than widening the page", and
 * the scanner dutifully reported that sentence as a 992px defect.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
}

function classStrings(srcRaw: string): Array<{ value: string; index: number }> {
  const src = stripComments(srcRaw);
  const out: Array<{ value: string; index: number }> = [];
  const re = /(['"`])((?:[^'"`\\\n]|\\.)*?)\1/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const value = m[2];
    if (!value.trim()) continue;
    // Must look like a class list: whitespace-separated Tailwind-ish tokens.
    if (!/^[\w\s:/[\]().,%#+_-]+$/.test(value)) continue;
    if (!/(^|\s)(grid|flex|w-|min-w-|px-|whitespace-|text-nowrap|grid-cols-|gap-|p-)/.test(value)) continue;
    out.push({ value, index: m.index + 1 });
  }
  return out;
}

const tokensOf = (value: string) => value.split(/\s+/).filter(Boolean);

/** Strip a Tailwind variant chain: `dark:lg:hover:grid-cols-3` → `grid-cols-3`. */
function bare(token: string): { base: string; variants: string[] } {
  const parts = token.split(':');
  return { base: parts[parts.length - 1], variants: parts.slice(0, -1) };
}

const hasResponsiveVariant = (variants: string[]) =>
  variants.some((v) => RESPONSIVE.some((r) => r.slice(0, -1) === v));

/* ------------------------------------------------------------------ */
/* STATIC RULE 1 — fixed column count with no responsive escape        */
/* ------------------------------------------------------------------ */

/**
 * `grid-cols-3` with no `sm:` prefix is the mobile value, whether or not a
 * `lg:grid-cols-4` sits beside it. Mobile-first means the *base* is the
 * phone: three columns inside 328px is 109px per column before the gap.
 */
function ruleFixedGrid(file: string, src: string) {
  for (const { value, index } of classStrings(src)) {
    for (const token of tokensOf(value)) {
      const { base, variants } = bare(token);
      const m = /^grid-cols-(\d+)$/.exec(base);
      if (!m) continue;
      if (hasResponsiveVariant(variants)) continue; // already an escape hatch
      const cols = Number(m[1]);
      if (cols < 3) continue; // two columns of ~160px is legible

      const perColumn = Math.floor(USABLE / cols);

      // A grid of single-character inputs is bounded by construction: the
      // OTP entry is six boxes because the code is six digits, and at
      // 360px each box is 48px — wider than the 44px touch target and far
      // wider than one monospace digit. The premise of this rule is
      // "content that needs more width than the column has", and content
      // capped at one character never does. Measured, not assumed.
      const subtree = src.slice(index, Math.min(src.length, index + 2500));
      if (/maxLength=\{1\}/.test(subtree) && perColumn >= 44) continue;
      report({
        rule: 'fixed-grid',
        severity: cols >= 4 ? 'HIGH' : 'MED',
        file: rel(file),
        line: lineOf(src, index),
        snippet: token,
        breaks: `${cols} columns at 360px → ${perColumn}px each before gaps; content clips or the grid overflows the shell`,
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/* STATIC RULE 2 — fixed pixel widths above the usable width           */
/* ------------------------------------------------------------------ */

/**
 * `min-w-[720px]` is the *correct* way to force a wide table to scroll —
 * but only when an `overflow-x-auto` ancestor exists to absorb it. Source
 * cannot see the ancestor reliably (the wrapper is usually a component),
 * so this rule reports the width and defers the verdict to the rendered
 * pass, which walks the real tree.
 */
/**
 * `min-w-[62rem]` is 992px and `min-w-[68rem]` is 1088px. Reading only the
 * `px` unit would have scored this codebase as having no fixed widths at
 * all while four admin tables demanded three times the viewport — the unit
 * an author happens to prefer is not a property of the layout.
 */
const WIDTH_UNITS: Record<string, number> = { px: 1, rem: 16, em: 16, ch: 8, pt: 4 / 3 };

/**
 * Is this offset lexically inside a horizontal scroll container?
 *
 * A source-level approximation of the ancestor walk the rendered pass does
 * properly: look back a bounded window for an opening `TableWrap` or
 * `overflow-x-*` with no closing `</TableWrap>` in between. Good enough to
 * stop the audit reporting the sanctioned pattern as a defect, and where
 * it is wrong the rendered pass has the last word.
 */
function insideScroller(src: string, index: number): boolean {
  const window = src.slice(Math.max(0, index - 1200), index);
  const lastOpen = Math.max(window.lastIndexOf('<TableWrap'), window.lastIndexOf('overflow-x-auto'), window.lastIndexOf('overflow-x-scroll'));
  if (lastOpen === -1) return false;
  return window.lastIndexOf('</TableWrap>') < lastOpen;
}

function ruleFixedWidth(file: string, src: string) {
  for (const { value, index } of classStrings(src)) {
    for (const token of tokensOf(value)) {
      const { base, variants } = bare(token);
      const m = /^(min-w|w|max-w)-\[([\d.]+)(px|rem|em|ch|pt)\]$/.exec(base);
      if (!m) continue;
      const [, kind, numRaw, unit] = m;
      const px = Math.round(Number(numRaw) * WIDTH_UNITS[unit]);
      if (kind === 'max-w') continue; // a max cannot force overflow
      if (px <= USABLE) continue;
      if (hasResponsiveVariant(variants)) continue; // has an escape at some breakpoint

      // A min-width inside a scroll container is the sanctioned pattern.
      const absorbed = insideScroller(src, index);

      report({
        rule: 'fixed-width',
        severity: absorbed ? 'INFO' : kind === 'w' ? 'HIGH' : 'MED',
        file: rel(file),
        line: lineOf(src, index),
        snippet: token,
        breaks: absorbed
          ? `${px}px inside an overflow-x scroller — sanctioned; scrolls itself, not the page`
          : `${px}px demanded inside ${USABLE}px of usable width → the document scrolls sideways at 360px`,
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/* STATIC RULE 3 — a table with neither a scroller nor a card fallback */
/* ------------------------------------------------------------------ */

/**
 * §8: "wide tables scroll inside their own container, never widening the
 * page", and `DefinitionCard` is the documented sub-`sm` alternative. The
 * defect is a `<Table>`/`<table>` with no `TableWrap` ancestor *in the same
 * file* — a table that is a direct child of the page grows the document.
 *
 * Depth is tracked rather than "does the file mention TableWrap anywhere",
 * because a page with six wrapped tables and one bare one is exactly the
 * case worth catching.
 */
function ruleBareTable(file: string, src: string) {
  // The kit's own table.tsx *defines* the primitive TableWrap wraps. A
  // `<table>` there is the thing under audit, not an instance of it.
  if (rel(file).endsWith('src/components/ui/table.tsx')) return;

  const re = /<(\/?)(TableWrap|Table|table)\b/g;
  let depth = 0;
  let m: RegExpExecArray | null;
  const fileHasFallback = /DefinitionCard/.test(src);

  while ((m = re.exec(src))) {
    const [, closing, tag] = m;
    if (tag === 'TableWrap') {
      if (closing) depth = Math.max(0, depth - 1);
      else depth += 1;
      continue;
    }
    if (closing) continue;
    if (depth > 0) {
      ruleWideTable(file, src, m.index);
      continue;
    }

    report({
      rule: 'bare-table',
      severity: fileHasFallback ? 'MED' : 'HIGH',
      file: rel(file),
      line: lineOf(src, m.index),
      snippet: `<${tag}> with no TableWrap ancestor`,
      breaks: fileHasFallback
        ? 'table has no scroll container; the DefinitionCard fallback elsewhere in the file does not cover this one'
        : 'columns push the table past 328px and the whole document scrolls sideways, moving every other control out of reach',
    });
  }
}

/* ------------------------------------------------------------------ */
/* STATIC RULE 3b — a wide wrapped table with no card fallback         */
/* ------------------------------------------------------------------ */

/**
 * Wrapping satisfies the letter of §8 — the table scrolls itself and the
 * page stays put. It does not satisfy the intent for a *wide* table: the
 * `DefinitionCard` docstring is explicit that "below `sm`, a six-column
 * admin table is unreadable no matter how it scrolls", and prescribes
 * `TableWrap` inside `hidden sm:block` beside a `sm:hidden` card list.
 *
 * So the threshold is the one the kit itself names: six columns. Below it,
 * a wrapped table is fine; at or above it, a wrapped table with no card
 * fallback in the file is a real narrow-viewport defect even though
 * nothing overflows the document.
 */
function ruleWideTable(file: string, src: string, tableIndex: number) {
  const close = src.indexOf('</Table>', tableIndex);
  const body = src.slice(tableIndex, close === -1 ? src.length : close);
  // Column count = <TH> in the first header row only.
  const headMatch = /<THead[\s\S]*?<\/THead>/.exec(body);
  const head = headMatch ? headMatch[0] : '';
  const cols = (head.match(/<TH\b/g) ?? []).length;
  if (cols < 6) return;
  if (/DefinitionCard/.test(src)) return;

  report({
    rule: 'wide-table',
    severity: 'MED',
    file: rel(file),
    line: lineOf(src, tableIndex),
    snippet: `<Table> with ${cols} columns, wrapped but no DefinitionCard fallback`,
    breaks: `${cols} columns inside 328px: the table scrolls itself (page is safe) but a reader must pan sideways to relate a row's first cell to its last`,
  });
}

/* ------------------------------------------------------------------ */
/* STATIC RULE 4 — flex rows with many children and no wrap            */
/* ------------------------------------------------------------------ */

/**
 * A horizontal flex row with four or five children and no `flex-wrap`
 * either squashes every child below its content width or overflows. The
 * child count is obtained by scanning forward from the opening tag and
 * counting JSX elements at depth 1 — approximate around ternaries and map
 * expressions, which is why the threshold is deliberately high (4+) and
 * the severity is MED.
 */
/**
 * End of an opening tag, respecting `{…}` expression containers.
 *
 * `indexOf('>')` is wrong on JSX: `items={COHORTS.map((c) => ({…}))}` puts
 * a `>` from an arrow function inside the tag, so a naive scan decided
 * `<SegmentedNav … />` was not self-closing and then counted its sibling
 * markup as ten children.
 */
function tagEnd(src: string, from: number): { end: number; selfClosing: boolean } {
  let braces = 0;
  let quote: string | null = null;
  for (let j = from; j < src.length; j++) {
    const c = src[j];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') braces += 1;
    else if (c === '}') braces -= 1;
    else if (c === '>' && braces === 0) return { end: j, selfClosing: src[j - 1] === '/' };
  }
  return { end: -1, selfClosing: false };
}

/**
 * Direct JSX children of an element.
 *
 * A `{…}` expression container counts as **one** child no matter what is
 * inside it. That is deliberate: the common shape is a ternary rendering
 * one of three icons, which is one child at runtime, not three. Counting
 * the branches separately reported a two-child status row as a four-child
 * row that needed wrapping.
 */
function countDirectChildren(src: string, openTagEnd: number, tagName: string): number {
  let i = openTagEnd;
  let depth = 0;
  let children = 0;
  const limit = Math.min(src.length, openTagEnd + 8000);

  while (i < limit) {
    const nextBrace = src.indexOf('{', i);
    const lt = src.indexOf('<', i);
    if (lt === -1 && nextBrace === -1) break;

    // An expression container at this level: one child, contents skipped.
    if (depth === 0 && nextBrace !== -1 && (lt === -1 || nextBrace < lt)) {
      let b = 1;
      let j = nextBrace + 1;
      while (j < limit && b > 0) {
        if (src[j] === '{') b += 1;
        else if (src[j] === '}') b -= 1;
        j += 1;
      }
      children += 1;
      i = j;
      continue;
    }
    if (lt === -1) break;

    if (src[lt + 1] === '/') {
      const close = /^<\/([A-Za-z][\w.]*)\s*>/.exec(src.slice(lt, lt + 60));
      if (close) {
        if (depth === 0 && close[1] === tagName) return children;
        depth = Math.max(0, depth - 1);
        i = lt + close[0].length;
        continue;
      }
      i = lt + 1;
      continue;
    }

    const open = /^<([A-Za-z][\w.]*)/.exec(src.slice(lt, lt + 60));
    if (!open) {
      i = lt + 1;
      continue;
    }
    const { end, selfClosing } = tagEnd(src, lt + open[0].length);
    if (end === -1) break;
    if (depth === 0) children += 1;
    if (!selfClosing) depth += 1;
    i = end + 1;
  }
  return children;
}

/**
 * `[^<>]*` and not `[^>]*` between the tag name and `className`.
 *
 * With `[^>]*`, a component whose *prop* holds JSX —
 * `<Radio label={<span className="flex items-center gap-2">…} />` — matches
 * the outer tag name against the inner span's classes, because the outer
 * tag's own `>` comes after the nested one. That produced a confident
 * "10 children, no flex-wrap" against a `<Radio>` that has no children at
 * all. Forbidding `<` keeps the attribute bound to the tag it belongs to.
 */
const TAG_WITH_CLASS = /<([A-Za-z][\w.]*)([^<>]*className=(?:"([^"]*)"|\{[^<>}]*?'([^']*)'))/g;

function ruleUnwrappedFlex(file: string, src: string) {
  const re = new RegExp(TAG_WITH_CLASS.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const tagName = m[1];
    const cls = m[3] ?? m[4] ?? '';
    const toks = tokensOf(cls);
    const hasFlexRow =
      toks.includes('flex') &&
      !toks.some((t) => bare(t).base.startsWith('flex-col')) &&
      !toks.some((t) => bare(t).base === 'grid');
    if (!hasFlexRow) continue;
    if (toks.some((t) => bare(t).base === 'flex-wrap')) continue;
    if (toks.some((t) => bare(t).base.startsWith('overflow-x'))) continue;
    // A row inside a horizontal scroller is meant to stay on one line —
    // that is how the loading skeletons mirror the table they stand in
    // for. Wrapping those would make the skeleton the wrong shape.
    if (insideScroller(src, m.index)) continue;

    const { end: openEnd, selfClosing } = tagEnd(src, m.index + 1);
    if (openEnd === -1 || selfClosing) continue; // no children to squeeze

    const n = countDirectChildren(src, openEnd + 1, tagName);
    if (n < 4) continue;

    report({
      rule: 'unwrapped-flex',
      severity: n >= 6 ? 'MED' : 'INFO',
      file: rel(file),
      line: lineOf(src, m.index),
      snippet: `<${tagName} className="${cls.slice(0, 70)}"> — ${n} children, no flex-wrap`,
      breaks: `${n} items on one line inside 328px; each is squeezed below its content width or the row overflows`,
    });
  }
}

/* ------------------------------------------------------------------ */
/* STATIC RULE 5 — nowrap on content that can be long                  */
/* ------------------------------------------------------------------ */

/**
 * `whitespace-nowrap` is right for a column header, a date, a badge or a
 * roll number — all bounded. It is wrong for a name, a company, a city or
 * a job title, which in this dataset run to forty-plus characters and will
 * push a row past the viewport rather than wrapping.
 *
 * `truncate` implies nowrap but also caps the width, so it is not flagged.
 */
const LONG_FIELDS =
  /\b(fullName|memberName|displayName|\bname\b|company|employer|organisation|organization|city|location|jobTitle|designation|title|subject|headline|email|institution|college|description)\b/i;

function ruleNowrapContent(file: string, src: string) {
  const re = new RegExp(TAG_WITH_CLASS.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const tagName = m[1];
    const cls = m[3] ?? m[4] ?? '';
    const toks = tokensOf(cls);
    const nowrap = toks.some((t) => {
      const b = bare(t).base;
      return b === 'whitespace-nowrap' || b === 'text-nowrap';
    });
    if (!nowrap) continue;
    if (toks.some((t) => bare(t).base === 'truncate')) continue; // bounded
    if (tagName === 'TH' || tagName === 'th') continue; // headers are short by contract

    const openEnd = src.indexOf('>', m.index);
    if (openEnd === -1) continue;

    // Only this element's own body. A fixed-size lookahead window runs
    // past `</TD>` into the next cell, which is how `whitespace-nowrap`
    // on a bounded roll-number column got reported as nowrap on the
    // `fullName` in the cell after it.
    const closeAt = src.indexOf(`</${tagName}>`, openEnd);
    const body = src.slice(openEnd, closeAt === -1 ? Math.min(src.length, openEnd + 320) : closeAt);
    if (!LONG_FIELDS.test(body)) continue;

    const field = LONG_FIELDS.exec(body)?.[0] ?? 'content';
    report({
      rule: 'nowrap-content',
      severity: 'MED',
      file: rel(file),
      line: lineOf(src, m.index),
      snippet: `<${tagName}> nowrap around \`${field}\``,
      breaks: `\`${field}\` runs long in this dataset and cannot wrap; the row grows past 328px instead of going to two lines`,
    });
  }
}

/* ------------------------------------------------------------------ */
/* STATIC RULE 6 — desktop horizontal padding with no mobile baseline  */
/* ------------------------------------------------------------------ */

/**
 * The shell's baseline is `px-4 … lg:px-8`. A page that sets `px-8` with no
 * prefix spends 64px of a 360px viewport on whitespace *on top of* the
 * shell's 32px, leaving 264px of content. Correct is `px-4 lg:px-8`.
 */
function ruleDesktopPadding(file: string, src: string) {
  for (const { value, index } of classStrings(src)) {
    const toks = tokensOf(value);
    for (const token of toks) {
      const { base, variants } = bare(token);
      const m = /^(px|p)-(\d+(?:\.\d+)?)$/.exec(base);
      if (!m) continue;
      if (hasResponsiveVariant(variants)) continue;
      const px = SPACING_PX[m[2]];
      if (px === undefined || px < 24) continue; // px-6 and up

      // A responsive companion for the same property means the base is the
      // mobile value and this is fine.
      const kind = m[1];
      const hasCompanion = toks.some((t) => {
        const o = bare(t);
        return hasResponsiveVariant(o.variants) && new RegExp(`^${kind}-`).test(o.base);
      });
      if (hasCompanion) continue;

      report({
        rule: 'desktop-padding',
        severity: px >= 32 ? 'MED' : 'INFO',
        file: rel(file),
        line: lineOf(src, index),
        snippet: token,
        breaks: `${px * 2}px of horizontal padding at 360px on top of the shell's 32px → ${USABLE - px * 2}px left for content`,
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/* RENDERED HALF                                                       */
/* ------------------------------------------------------------------ */

/**
 * Routes chosen to cover every distinct layout shape in the app, not every
 * route. One example of each shape is enough to prove the shape, and the
 * dev server is slow enough that thirty routes would discourage re-running.
 */
const ROUTES: Array<{ path: string; role: string; shape: string }> = [
  { path: '/', role: 'ANON', shape: 'landing' },
  { path: '/login', role: 'ANON', shape: 'auth' },
  { path: '/dashboard', role: 'STUDENT', shape: 'dashboard / stat grid' },
  { path: '/directory', role: 'ALUMNI', shape: 'directory grid + filters' },
  { path: '/directory/branch/CSE', role: 'ALUMNI', shape: 'filtered collection' },
  { path: '/jobs', role: 'ALUMNI', shape: 'list of cards' },
  { path: '/jobs/new', role: 'ALUMNI', shape: 'form' },
  { path: '/settings/privacy', role: 'ALUMNI', shape: 'settings + table' },
  { path: '/admin/members', role: 'ADMIN', shape: 'admin table (widest)' },
  { path: '/admin/audit', role: 'ADMIN', shape: 'admin table + detail' },
  { path: '/admin/verification', role: 'ADMIN', shape: 'queue' },
  { path: '/admin/degree-register', role: 'ADMIN', shape: 'admin table + upload' },
  { path: '/admin/degree-register/upload', role: 'ADMIN', shape: 'wizard' },
  { path: '/admin/branding', role: 'ADMIN', shape: 'branding studio' },
  { path: '/admin/reports/coverage', role: 'ADMIN', shape: 'report / charts' },
  { path: '/platform', role: 'PLATFORM', shape: 'platform console' },
];

interface Elem {
  tag: string;
  cls: string;
  parent: number;
  /** offset just past this element's opening tag */
  start: number;
  /** offset of its closing tag, or start for void elements */
  end: number;
}

/**
 * Flat element list with parent pointers, built by a single pass over the
 * markup. Enough to answer "does this table have an overflow-x ancestor"
 * and "how wide is the text inside this nowrap span", which is the whole
 * point; not a DOM.
 *
 * Verified against `/admin/members`: 2622 opening tags parsed out of 2622
 * present in the byte stream, so nothing is being skipped silently.
 */
function parseTree(html: string): Elem[] {
  const elems: Elem[] = [];
  const stack: number[] = [];
  const VOID = new Set(['br', 'img', 'input', 'hr', 'meta', 'link', 'source', 'path', 'circle', 'rect', 'line', 'use', 'stop', 'polyline', 'polygon', 'area', 'col', 'embed', 'track', 'wbr']);
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(html))) {
    const [full, closing, tagRaw, attrs] = m;
    const tag = tagRaw.toLowerCase();
    if (closing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (elems[stack[i]].tag === tag) {
          elems[stack[i]].end = m.index;
          stack.length = i;
          break;
        }
      }
      continue;
    }
    const cls = /class="([^"]*)"/.exec(attrs)?.[1] ?? '';
    const idx = elems.length;
    const after = m.index + full.length;
    elems.push({ tag, cls, parent: stack.length ? stack[stack.length - 1] : -1, start: after, end: after });
    if (!VOID.has(tag) && !full.endsWith('/>')) stack.push(idx);
  }
  return elems;
}

const textOf = (html: string, e: Elem) =>
  html
    .slice(e.start, e.end)
    .replace(/<[^>]*>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/* --- width arithmetic over emitted classes ------------------------- */

/** Hard width a class list demands, in px, or 0 for "content decides". */
function declaredWidth(cls: string): number {
  let px = 0;
  for (const t of cls.split(/\s+/)) {
    if (t.includes(':')) continue; // a variant is not the base/mobile value
    let m = /^(?:min-)?w-\[([\d.]+)(px|rem|em|ch|pt)\]$/.exec(t);
    if (m) px = Math.max(px, Math.round(Number(m[1]) * WIDTH_UNITS[m[2]]));
    m = /^(?:min-)?w-(\d+(?:\.\d+)?)$/.exec(t);
    if (m && SPACING_PX[m[1]] !== undefined) px = Math.max(px, SPACING_PX[m[1]]);
  }
  return px;
}

/** Horizontal padding this class list adds to its subtree, in px. */
function paddingX(cls: string): number {
  let px = 0;
  for (const t of cls.split(/\s+/)) {
    if (t.includes(':')) continue;
    const m = /^(p|px|pl|pr)-(\d+(?:\.\d+)?)$/.exec(t);
    if (!m) continue;
    const v = SPACING_PX[m[2]];
    if (v === undefined) continue;
    px += m[1] === 'pl' || m[1] === 'pr' ? v : v * 2;
  }
  return px;
}

function hasAncestor(elems: Elem[], i: number, pred: (e: Elem) => boolean): boolean {
  let p = elems[i].parent;
  let guard = 0;
  while (p >= 0 && guard++ < 200) {
    if (pred(elems[p])) return true;
    p = elems[p].parent;
  }
  return false;
}

const isScroller = (e: Elem) =>
  /(^|\s)(overflow-x-auto|overflow-x-scroll|overflow-auto|overflow-scroll)(\s|$)/.test(e.cls);


/**
 * Score one rendered page.
 *
 * Shared by the curated route list and the crawl so both apply exactly the
 * same rules — a crawl that measured something subtly different from the
 * curated list would be worse than no crawl at all.
 */
interface PageScore {
  elems: number;
  widest: number;
  widestWhere: string;
  mobileFirst: number;
  desktopFirst: number;
  added: number;
}

/** ~px per character for the default body face at text-sm. */
const CH_PX = 7.2;

function auditPage(routePath: string, html: string): PageScore {
  const elems = parseTree(html);
  const before = findings.length;

  /* --- every table must sit inside a scroll container --------------- */
  elems.forEach((e, i) => {
    if (e.tag !== 'table') return;
    if (hasAncestor(elems, i, isScroller)) return;
    report({
      rule: 'rendered-table',
      severity: 'HIGH',
      file: routePath,
      line: 0,
      snippet: `<table class="${e.cls.slice(0, 60)}">`,
      breaks: 'no overflow-x ancestor in the emitted tree; the table widens the document at 360px',
    });
  });

  /* --- the minimum width this document demands ----------------------
     For every element declaring a hard width, add the horizontal padding
     of each ancestor up to the nearest scroll container. If no scroll
     container intervenes, that sum is a lower bound on how wide the
     document must be — anything above 360 means the page itself scrolls
     sideways on a phone. This is the number the audit exists to produce;
     every other rule is a hint about where it came from.               */
  let widest = 0;
  let widestWhere = '';
  elems.forEach((e) => {
    const own = declaredWidth(e.cls);
    if (!own) return;
    if (isScroller(e)) return;
    let total = own + paddingX(e.cls);
    let p = e.parent;
    let guard = 0;
    let absorbed = false;
    while (p >= 0 && guard++ < 200) {
      if (isScroller(elems[p])) {
        absorbed = true;
        break;
      }
      total += paddingX(elems[p].cls);
      p = elems[p].parent;
    }
    if (absorbed) return;
    if (total > widest) {
      widest = total;
      widestWhere = `<${e.tag} class="${e.cls.slice(0, 70)}">`;
    }
    if (total <= VIEWPORT) return;
    report({
      rule: 'rendered-overflow',
      severity: 'HIGH',
      file: routePath,
      line: 0,
      snippet: `<${e.tag} class="${e.cls.slice(0, 70)}">`,
      breaks: `demands ${total}px with no scrolling ancestor → the document scrolls sideways at 360px`,
    });
  });

  /* --- nowrap text measured, not guessed ----------------------------
     A `whitespace-nowrap` span is only a defect if what is inside it is
     actually long. The rendered pass reads the real fixture text, so it
     reports on measured content rather than on the name of a variable. */
  elems.forEach((e, i) => {
    if (!/(^|\s)(whitespace-nowrap|text-nowrap)(\s|$)/.test(e.cls)) return;
    if (/(^|\s)truncate(\s|$)/.test(e.cls)) return;
    if (e.tag === 'th') return;
    const text = textOf(html, e);
    if (!text) return;
    const estimate = Math.round(text.length * CH_PX);
    if (estimate <= USABLE) return;
    if (hasAncestor(elems, i, isScroller)) return;
    report({
      rule: 'rendered-nowrap',
      severity: 'MED',
      file: routePath,
      line: 0,
      snippet: `<${e.tag}> "${text.slice(0, 48)}${text.length > 48 ? '…' : ''}" (${text.length} chars)`,
      breaks: `~${estimate}px of unwrappable text inside ${USABLE}px, with no scroll container to absorb it`,
    });
  });

  /* --- unbreakable tokens -------------------------------------------
     A 60-character URL, a long email address or a base64 id has no break
     opportunity. Normal wrapping will not split it, so the containing
     block takes a min-content width equal to the whole token and the
     document grows. `break-all` / `break-words` are the fix, and an
     ancestor carrying either is treated as covering the leaf.          */
  const breakable = (cls: string) =>
    /(^|\s)(break-all|break-words|truncate|hyphens-auto)(\s|$)/.test(cls);

  elems.forEach((e, i) => {
    if (e.tag === 'script' || e.tag === 'style' || e.tag === 'pre' || e.tag === 'code') return;
    // Leaf-ish only. A container's text belongs to its children, and
    // attributing it upward would report the same token a dozen times.
    if (html.slice(e.start, e.end).includes('<')) return;
    const text = textOf(html, e);
    if (!text) return;
    const longest = text.split(/\s+/).reduce((a, b) => (b.length > a.length ? b : a), '');
    const estimate = Math.round(longest.length * CH_PX);
    if (estimate <= USABLE) return;
    if (isScroller(e) || hasAncestor(elems, i, isScroller)) return;
    if (breakable(e.cls)) return;
    let p = e.parent;
    let guard = 0;
    let covered = false;
    while (p >= 0 && guard++ < 12) {
      if (breakable(elems[p].cls)) {
        covered = true;
        break;
      }
      p = elems[p].parent;
    }
    if (covered) return;
    report({
      rule: 'rendered-unbreakable',
      severity: 'MED',
      file: routePath,
      line: 0,
      snippet: `<${e.tag}> "${longest.slice(0, 60)}${longest.length > 60 ? '…' : ''}" (${longest.length} chars, no break opportunity)`,
      breaks: `~${estimate}px single token with no break-all/break-words and no scroll container → forces its block past ${USABLE}px`,
    });
  });

  /* --- mobile-first ordering of the emitted classes ------------------
     Mobile-first means the *unprefixed* value is the phone value. Two
     ways to violate it: a base of three or more columns that no
     breakpoint ever relaxes, and Tailwind's `max-*` variants, which are
     desktop-first by construction. An implicit single-column base with
     `sm:`/`lg:` overrides is the correct shape and is counted as such. */
  let desktopFirst = 0;
  let mobileFirst = 0;
  for (const e of elems) {
    if (!e.cls) continue;
    const toks = e.cls.split(/\s+/).filter(Boolean);
    for (const t of toks) {
      if (!/^max-(sm|md|lg|xl|2xl):/.test(t)) continue;
      desktopFirst += 1;
      report({
        rule: 'rendered-desktop-first',
        severity: 'MED',
        file: routePath,
        line: 0,
        snippet: t,
        breaks: 'max-* variant overrides a desktop base for narrow screens — inverted from the mobile-first contract',
      });
    }

    const gc = toks.filter((t) => /grid-cols-/.test(t));
    if (!gc.length) continue;
    const baseCols = gc.find((t) => !t.includes(':'));
    const scaled = gc.some((t) => RESPONSIVE.some((r) => t.startsWith(r)));
    const n = baseCols ? Number(/grid-cols-(\d+)$/.exec(baseCols)?.[1] ?? '1') : 1;
    if (n >= 3 && !scaled) {
      desktopFirst += 1;
      report({
        rule: 'rendered-desktop-first',
        severity: 'MED',
        file: routePath,
        line: 0,
        snippet: `<${e.tag} class="${e.cls.slice(0, 70)}">`,
        breaks: `${n} columns as the unprefixed base, never relaxed at any breakpoint → ${Math.floor(USABLE / n)}px per column at 360px`,
      });
    } else {
      mobileFirst += 1;
    }
  }

  return {
    elems: elems.length,
    widest,
    widestWhere,
    mobileFirst,
    desktopFirst,
    added: findings.length - before,
  };
}

/* ------------------------------------------------------------------ */
/* Fetching                                                            */
/* ------------------------------------------------------------------ */

const COOKIES = (): Record<string, string | undefined> => ({
  ANON: undefined,
  STUDENT: process.env.SESSION_STUDENT,
  ALUMNI: process.env.SESSION_ALUMNI,
  ADMIN: process.env.SESSION_ADMIN,
  PLATFORM: process.env.SESSION_PLATFORM,
  HOD: process.env.SESSION_HOD,
  TPO: process.env.SESSION_TPO,
  FINANCE: process.env.SESSION_FINANCE,
  OPERATOR: process.env.SESSION_OPERATOR,
  FACULTY: process.env.SESSION_FACULTY,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch with retries.
 *
 * The dev server compiles routes on demand and is memory-hungry enough to
 * be restarted by the OS partway through a long crawl — which showed up
 * first as a crawl that simply stopped after seven pages and reported
 * "clean" for everything it never visited. A silent `continue` on a
 * network error turns an outage into a false all-clear, so failures are
 * retried and then printed.
 */
async function get(base: string, path: string, cookie?: string, tries = 3) {
  let lastErr = '';
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(base + path, { headers: cookie ? { cookie } : {}, redirect: 'manual' });
      return { status: res.status, html: res.status < 300 ? await res.text() : '', err: '' };
    } catch (err) {
      lastErr = (err as Error).message;
      await sleep(1500 * (i + 1)); // let a restarting dev server come back
    }
  }
  return { status: 0, html: '', err: lastErr };
}

/**
 * Did this 200 actually contain the page we asked for?
 *
 * Two ways it does not, and both would otherwise be scored as a clean
 * pass because an error page is small and trivially responsive:
 *
 *  - `docs/STATUS-CODES.md` §5.2: a tenant feature gate calls `notFound()`
 *    after the shell has flushed, so the response is **200** with
 *    `NEXT_HTTP_ERROR_FALLBACK;404` sitting in the body. Measuring that
 *    and reporting "clean" is measuring the not-found page.
 *  - The dev server answers 404 on the first request to a route it has
 *    just compiled and 200 on the second. Observed repeatedly here.
 *
 * A page that cannot be measured must say so. Silence that looks like
 * success is the one output an audit must never produce.
 */
function isNotRealPage(html: string): string | null {
  if (html.includes('NEXT_HTTP_ERROR_FALLBACK')) return 'notFound() after flush (200 body, see STATUS-CODES.md §5.2)';
  if (/<title>[^<]*Page not found/i.test(html)) return 'not-found page body';
  return null;
}

function line(status: number, path: string, s: PageScore) {
  const flag = s.added ? `${s.added} finding${s.added === 1 ? '' : 's'}` : 'clean';
  console.log(
    `  ${String(status).padEnd(4)} ${path.padEnd(40)} ${String(s.elems).padStart(5)} el  ` +
      `min ${String(s.widest).padStart(4)}px  mf:${String(s.mobileFirst).padStart(3)} df:${String(s.desktopFirst).padStart(2)}  ${flag}`,
  );
  if (s.widest > VIEWPORT) console.log(`         widest: ${s.widestWhere}`);
}

async function renderedPass(base: string) {
  const cookies = COOKIES();
  console.log(
    `\n${'='.repeat(78)}\nRENDERED — ${base}, ${ROUTES.length} curated routes, viewport ${VIEWPORT}px\n${'='.repeat(78)}`,
  );

  for (const route of ROUTES) {
    const cookie = cookies[route.role];
    if (route.role !== 'ANON' && !cookie) {
      console.log(`  SKIP ${route.path.padEnd(40)} no SESSION_${route.role} in env`);
      continue;
    }
    const r = await get(base, route.path, cookie);
    if (r.status === 0) {
      console.log(`  ERR  ${route.path.padEnd(40)} ${r.err} — NOT MEASURED`);
      continue;
    }
    if (r.status >= 300) {
      console.log(`  ${String(r.status).padEnd(4)} ${route.path.padEnd(40)} (${route.shape}) — NOT MEASURED`);
      notMeasured.push(`${route.path} (${r.status})`);
      continue;
    }
    const bogus = isNotRealPage(r.html);
    if (bogus) {
      console.log(`  200  ${route.path.padEnd(40)} NOT MEASURED — ${bogus}`);
      notMeasured.push(`${route.path} (${bogus})`);
      continue;
    }
    line(r.status, route.path, auditPage(route.path, r.html));
  }
}

/**
 * Breadth-first crawl of same-origin links, per role.
 *
 * The curated list proves each *layout shape* once. The crawl proves those
 * shapes hold on the real dynamic routes — a member detail page for an
 * alumnus with a forty-character employer, an audit entry with a long diff
 * — which is where narrow-viewport defects actually live and which a
 * hand-written route list will always under-sample.
 */
async function crawlPass(base: string, limit: number) {
  const cookies = COOKIES();
  const seeds: Array<[string, string]> = [
    ['ANON', '/'],
    ['STUDENT', '/dashboard'],
    ['ALUMNI', '/dashboard'],
    ['ADMIN', '/admin'],
    ['PLATFORM', '/platform'],
  ];

  console.log(
    `\n${'='.repeat(78)}\nCRAWL — up to ${limit} pages per role, same-origin links only\n${'='.repeat(78)}`,
  );

  for (const [role, seed] of seeds) {
    const cookie = cookies[role];
    if (role !== 'ANON' && !cookie) continue;
    const seen = new Set<string>();
    const queue = [seed];
    let n = 0;
    let failures = 0;
    console.log(`\n  --- ${role} ---`);

    while (queue.length && n < limit) {
      const path = queue.shift()!;
      if (seen.has(path)) continue;
      seen.add(path);

      const r = await get(base, path, cookie);
      if (r.status === 0) {
        console.log(`  ERR  ${path.padEnd(40)} ${r.err} — server unreachable after retries`);
        failures += 1;
        if (failures >= 3) {
          console.log(`  ABORT ${role} crawl: server not responding. Findings below cover only what was reached.`);
          break;
        }
        continue;
      }
      if (r.status >= 300 || !r.html) {
        notMeasured.push(`${path} [${role}] (${r.status})`);
        continue;
      }
      const bogus = isNotRealPage(r.html);
      if (bogus) {
        console.log(`  200  ${path.padEnd(40)} NOT MEASURED — ${bogus}`);
        notMeasured.push(`${path} [${role}] (${bogus})`);
        continue;
      }
      n += 1;
      line(r.status, path, auditPage(`${path} [${role}]`, r.html));

      for (const m of r.html.matchAll(/href="(\/[^"#?]*)"/g)) {
        const href = m[1].replace(/\/$/, '') || '/';
        if (seen.has(href) || queue.includes(href)) continue;
        // Non-HTML endpoints have no layout to audit.
        if (/^\/(api|_next|favicon)/.test(href)) continue;
        if (/\.(webmanifest|json|xml|txt|ico|png|svg|jpg|webp|css|js)$/.test(href)) continue;
        queue.push(href);
      }
      await sleep(120); // keep the dev server off its memory cliff
    }
  }
}

/* ------------------------------------------------------------------ */
/* Reporting                                                           */
/* ------------------------------------------------------------------ */

const RULE_LABEL: Record<RuleId, string> = {
  'fixed-grid': 'Fixed column count, no responsive escape',
  'fixed-width': 'Fixed pixel width above the usable width',
  'bare-table': 'Table with no TableWrap scroll container',
  'wide-table': 'Wide table wrapped but with no DefinitionCard fallback',
  'unwrapped-flex': 'Flex row, many children, no flex-wrap',
  'nowrap-content': 'nowrap on content that runs long',
  'desktop-padding': 'Desktop horizontal padding as the mobile base',
  'rendered-overflow': 'RENDERED: fixed width with no scrolling ancestor',
  'rendered-table': 'RENDERED: table with no overflow-x ancestor',
  'rendered-nowrap': 'RENDERED: measured nowrap text wider than the viewport',
  'rendered-unbreakable': 'RENDERED: unbreakable token wider than the viewport',
  'rendered-desktop-first': 'RENDERED: desktop-first class ordering',
};

const SEV_ORDER: Severity[] = ['HIGH', 'MED', 'INFO'];

function printReport() {
  console.log(`\n${'='.repeat(78)}\nSUMMARY — target viewport ${VIEWPORT}px (${USABLE}px usable inside the shell)\n${'='.repeat(78)}`);

  const byRule = new Map<RuleId, Finding[]>();
  for (const f of findings) {
    if (!byRule.has(f.rule)) byRule.set(f.rule, []);
    byRule.get(f.rule)!.push(f);
  }

  const order = Object.keys(RULE_LABEL) as RuleId[];
  for (const rule of order) {
    const list = byRule.get(rule);
    if (!list?.length) {
      console.log(`\n0   ${RULE_LABEL[rule]}`);
      continue;
    }
    const counts = SEV_ORDER.map((s) => `${s} ${list.filter((f) => f.severity === s).length}`).join('  ');
    console.log(`\n${String(list.length).padEnd(4)}${RULE_LABEL[rule]}   [${counts}]`);

    // The crawl visits the same shell on every page, so one defect in a
    // shared component surfaces once per route. Collapse on the identity
    // of the defect, and say how many routes it reached.
    const uniq = new Map<string, { f: Finding; hits: number; where: Set<string> }>();
    for (const f of list) {
      const key = `${f.severity}|${f.snippet}|${f.line ? f.file : ''}`;
      const seen = uniq.get(key);
      if (seen) {
        seen.hits += 1;
        seen.where.add(f.file);
      } else {
        uniq.set(key, { f, hits: 1, where: new Set([f.file]) });
      }
    }

    const rows = [...uniq.values()].sort(
      (a, b) => SEV_ORDER.indexOf(a.f.severity) - SEV_ORDER.indexOf(b.f.severity) || b.hits - a.hits,
    );
    const SHOW = 12;
    for (const { f, hits, where } of rows.slice(0, SHOW)) {
      const loc = f.line ? `${f.file}:${f.line}` : [...where][0];
      const spread = hits > 1 ? `  (×${hits} across ${where.size} route${where.size === 1 ? '' : 's'})` : '';
      console.log(`     ${f.severity.padEnd(5)} ${loc}${spread}`);
      console.log(`           ${f.snippet}`);
      console.log(`           → ${f.breaks}`);
    }
    if (rows.length > SHOW) console.log(`     … and ${rows.length - SHOW} more distinct occurrences`);
  }

  const high = findings.filter((f) => f.severity === 'HIGH').length;
  const med = findings.filter((f) => f.severity === 'MED').length;
  const info = findings.filter((f) => f.severity === 'INFO').length;
  if (notMeasured.length) {
    console.log(`\n${notMeasured.length} route(s) NOT MEASURED — a clean result below does not cover these:`);
    for (const r of notMeasured) console.log(`     ${r}`);
  }

  console.log(`\n${'-'.repeat(78)}`);
  console.log(`TOTAL  ${findings.length}   HIGH ${high}   MED ${med}   INFO ${info}`);
  console.log(`${'-'.repeat(78)}\n`);
  return high;
}

/* ------------------------------------------------------------------ */

async function main() {
  const argv = process.argv.slice(2);
  const wantRender = argv.includes('--render');
  const wantJson = argv.includes('--json');
  const baseIdx = argv.indexOf('--base');
  const base = baseIdx >= 0 ? argv[baseIdx + 1] : 'http://localhost:3300';
  const crawlIdx = argv.indexOf('--crawl');
  const crawlLimit = crawlIdx >= 0 ? Number(argv[crawlIdx + 1] || 25) : 0;

  const files = [...walk(join(ROOT, 'src', 'app')), ...walk(join(ROOT, 'src', 'components'))];

  console.log(`${'='.repeat(78)}\nSTATIC — ${files.length} .tsx files under src/app and src/components\n${'='.repeat(78)}`);

  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    ruleFixedGrid(file, src);
    ruleFixedWidth(file, src);
    ruleBareTable(file, src);
    ruleUnwrappedFlex(file, src);
    ruleNowrapContent(file, src);
    ruleDesktopPadding(file, src);
  }

  if (wantRender) await renderedPass(base);
  if (crawlLimit > 0) await crawlPass(base, crawlLimit);

  if (wantJson) {
    console.log(JSON.stringify(findings, null, 2));
    return;
  }

  const high = printReport();
  process.exitCode = high > 0 ? 1 : 0;
}

void main();
