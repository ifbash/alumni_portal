#!/usr/bin/env tsx
/**
 * Accessibility audit.
 *
 *   npx tsx scripts/mint-all.ts /tmp/cookies.env
 *   npx tsx scripts/a11y-audit.ts --cookies /tmp/cookies.env
 *
 * Fetches every route the portal renders — the static ones enumerated from
 * `src/app`, the dynamic ones discovered by crawling links out of the static
 * ones — parses the returned HTML and checks eleven rules drawn from
 * `docs/DESIGN-SYSTEM.md` §8.
 *
 * Marketing and auth routes are fetched signed out, because that is how a
 * visitor sees them. Everything else is fetched as the `college_admin` demo
 * account, which is the viewer that reaches the most screens.
 *
 * The HTML is settled before any rule runs — every route in this app sits
 * under a `loading.tsx`, so the bytes on the wire are a shell plus streamed
 * Suspense payloads, and the page a user actually gets only exists after
 * React's own completion scripts have run. See `settle()`; without it this
 * script reports an empty portal in confident detail.
 *
 * Why a parser and not regex: six of the eleven rules are questions about
 * nesting — is this input inside a `<label>`, does this `<table>` have a
 * `<caption>`, does this `<button>`'s subtree contain any text that is not
 * `aria-hidden`. Regex answers those wrong in exactly the cases that matter.
 * `node-html-parser` is a devDependency for this reason. The three rules that
 * are genuinely flat (`lang` on `<html>`, positive `tabindex`, empty `aria-*`
 * values) still go through the parser, because once it is loaded there is no
 * reason to hand-roll a second, worse tokeniser beside it.
 *
 * Flags:
 *   --base <url>       default http://diet.localhost:3300
 *   --cookies <path>   shell file written by scripts/mint-all.ts
 *   --json <path>      write the full finding list as JSON
 *   --cache <dir>      reuse HTML already fetched into <dir>; fetch and save
 *                      anything missing. Delete the directory to re-measure.
 *   --cache-only       audit whatever is already in --cache and fetch nothing;
 *                      for iterating on a rule without another crawl
 *   --routes           print the route list and exit
 *   --only <substr>    audit only routes containing <substr>
 */

import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parse, type HTMLElement, type Node } from 'node-html-parser';

// ---------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const has = (name: string) => process.argv.includes(`--${name}`);

const BASE = flag('base') ?? process.env.A11Y_BASE ?? 'http://diet.localhost:3300';
const ONLY = flag('only');
const APP_DIR = join(process.cwd(), 'src', 'app');

/**
 * The tenant is resolved from the Host header, so the logical base carries a
 * subdomain — but Node's resolver does not synthesise `*.localhost` the way
 * curl and browsers do, and every request comes back ENOTFOUND. Dial the
 * loopback address and send the subdomain as a header instead.
 */
const BASE_URL = new URL(BASE);
const LOOPBACK = /(^|\.)localhost$/.test(BASE_URL.hostname) && BASE_URL.hostname !== 'localhost';
const DIAL = LOOPBACK ? `${BASE_URL.protocol}//127.0.0.1:${BASE_URL.port || '80'}` : BASE;
const HOST_HEADER = LOOPBACK ? BASE_URL.host : undefined;

// ---------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------

/** Read `NAME='value'` lines out of the file mint-all.ts writes. */
function loadCookies(path: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (path) {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = /^([A-Z_]+)='(.*)'$/.exec(line.trim());
      if (m) out[m[1]] = m[2];
    }
  }
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('SESSION_') && process.env[k] && !out[k]) out[k] = process.env[k]!;
  }
  return out;
}

const COOKIES = loadCookies(flag('cookies'));

// ---------------------------------------------------------------
// Route enumeration
// ---------------------------------------------------------------

/** Route groups — `(marketing)` — do not appear in the URL. */
const isGroup = (s: string) => s.startsWith('(') && s.endsWith(')');
const isDynamic = (s: string) => s.startsWith('[');

interface Route {
  path: string;
  /** Fetched without a session — the marketing and auth surfaces. */
  anonymous: boolean;
  /** How this route entered the list. */
  origin: 'static' | 'crawl';
}

/**
 * `college_admin` is the viewer for everything, with one exception: the
 * `/platform` console is gated on `tenant.provision`, which only
 * `platform_admin` holds, so an admin session there is a `307` and four
 * screens go unaudited. Those four are fetched as the platform admin.
 */
function sessionFor(route: { path: string; anonymous: boolean }): string | undefined {
  if (route.anonymous) return undefined;
  return route.path === '/platform' || route.path.startsWith('/platform/')
    ? COOKIES.SESSION_PLATFORM
    : COOKIES.SESSION_ADMIN;
}

/**
 * Query strings for screens that render nothing without one.
 *
 * `/verify` reads the address out of `?email=` and `redirect()`s to `/login`
 * without it — which, after the shell has flushed, arrives as an errored
 * Suspense boundary and no page markup at all. Auditing the bare path
 * measures a redirect; auditing it with a parameter measures the OTP form,
 * which is six labelled inputs and the most a11y-dense screen in the auth
 * flow. The path stays clean in the report; only the request carries this.
 */
const ROUTE_QUERY: Record<string, string> = {
  '/verify': '?email=admin%40diet.ac.in',
};

/**
 * Instances for dynamic routes the crawl cannot reach.
 *
 * Not a convenience: these five screens have **no inbound link** anywhere a
 * college admin can see. `/admin/jobs` renders its queue without linking to
 * `/admin/jobs/[id]`; `/admin/comms` and `/admin/degree-register` do the same;
 * `/jobs/[id]/applicants` and `/events/[slug]/ticket` are likewise only
 * reachable by typing the URL. A link crawl is therefore structurally unable
 * to find them, and leaving them out would have quietly excluded five screens
 * from every rule below. The ids are fixture ids, verified to render.
 */
const ROUTE_SEEDS: string[] = [
  '/admin/comms/audit-9',
  '/admin/degree-register/deg-0',
  '/admin/jobs/job-0',
  '/jobs/job-0/applicants',
  '/events/alumni-meet-2026/ticket',
];

function enumerateStaticRoutes(): Route[] {
  const routes: Route[] = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (!statSync(full).isDirectory()) continue;
      if (entry === 'api' && dir === APP_DIR) continue;
      walk(full);
    }

    const files = readdirSync(dir);
    if (!files.includes('page.tsx')) return;

    const segments = relative(APP_DIR, dir).split(sep).filter(Boolean);
    // A dynamic segment cannot be fetched without a real id; the crawl
    // supplies those instances instead of this function guessing them.
    if (segments.some(isDynamic)) return;

    const groups = segments.filter(isGroup);
    const path = '/' + segments.filter((s) => !isGroup(s)).join('/');
    routes.push({
      path: path === '/' ? '/' : path.replace(/\/$/, ''),
      anonymous: groups.includes('(marketing)') || groups.includes('(auth)'),
      origin: 'static',
    });
  }

  walk(APP_DIR);
  return routes.sort((a, b) => a.path.localeCompare(b.path));
}

/** Route templates that exist on disk but need an id the crawl must find. */
function dynamicTemplates(): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (!statSync(full).isDirectory()) continue;
      if (entry === 'api' && dir === APP_DIR) continue;
      walk(full);
    }
    if (!readdirSync(dir).includes('page.tsx')) return;
    const segments = relative(APP_DIR, dir).split(sep).filter(Boolean);
    if (!segments.some(isDynamic)) return;
    out.push('/' + segments.filter((s) => !isGroup(s)).join('/'));
  }
  walk(APP_DIR);
  return out.sort();
}

/** Does a concrete path match a `[param]` template? */
function matchesTemplate(path: string, template: string): boolean {
  const p = path.split('/').filter(Boolean);
  const t = template.split('/').filter(Boolean);
  if (p.length !== t.length) return false;
  return t.every((seg, i) => (isDynamic(seg) ? true : seg === p[i]));
}

// ---------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------

/** Never follow these out of a crawl: they end the session or aren't HTML. */
const SKIP = [/^\/api\//, /^\/logout$/, /^\/_next\//, /\.(png|jpe?g|svg|ico|css|js|webp|pdf|csv)$/i];

interface Fetched {
  status: number;
  html: string;
  /** A gated page answers 200 with the Next error digest in the body. */
  gated: boolean;
  /** Suspense boundaries with no HTML behind them. Non-zero means unauditable. */
  pending: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One page, with retries.
 *
 * The dev server compiling seventy-eight routes on demand is memory-hungry
 * enough to be restarted mid-run — the first full pass here died at route 12
 * with ECONNRESET followed by forty ECONNREFUSEDs. Losing the remaining
 * forty-five routes to somebody else's restart is not a measurement; wait
 * for the port to come back and carry on.
 */
async function get(path: string, cookie?: string, attempt = 1): Promise<Fetched | null> {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  if (HOST_HEADER) headers.host = HOST_HEADER;

  try {
    const res = await fetch(`${DIAL}${path}${ROUTE_QUERY[path] ?? ''}`, { headers, redirect: 'manual' });
    const html = res.headers.get('content-type')?.includes('text/html') ? await res.text() : '';

    // A dev server recompiling a module somebody is mid-edit on answers 500
    // for a few seconds, and one that has just had `.next` cleared under it
    // answers 404 until its route manifest is rebuilt. Both are properties
    // of the harness, not of the page, and treating either as real loses the
    // route from the measurement. A 404 that survives four attempts is
    // reported as a 404, not swallowed.
    if ((res.status >= 500 || res.status === 404) && attempt < 4) {
      console.error(`  ${path}: ${res.status}, retrying in ${attempt * 10}s (attempt ${attempt + 1})`);
      await sleep(attempt * 10_000);
      return get(path, cookie, attempt + 1);
    }

    // A response whose stream ended with a Suspense boundary still pending —
    // or whose boundary errored server-side — is a skeleton, not a page.
    // `/admin/news/new` and `/verify` both came back that way and measured as
    // "0 <h1>" on screens that have one. Refetch rather than record a defect
    // that belongs to the loaded dev server; if it never settles, the caller
    // reports the route as unaudited instead of inventing a finding.
    // A feature-gated page reaches this state legitimately: `notFound()`
    // lands after the shell has flushed, so the boundary errors and the
    // digest goes in the body. That is the documented behaviour in
    // docs/STATUS-CODES.md §5.2, not a lost response — do not refetch it.
    const gated = html.includes('NEXT_HTTP_ERROR_FALLBACK');
    const pending = res.status === 200 && html && !gated ? settle(html).pending : 0;
    if (pending > 0 && attempt < 4) {
      console.error(`  ${path}: ${pending} boundary(s) never rendered, refetching (attempt ${attempt + 1})`);
      await sleep(attempt * 5_000);
      return get(path, cookie, attempt + 1);
    }

    return { status: res.status, html, gated, pending };
  } catch (err) {
    const code = (err as { cause?: { code?: string } }).cause?.code ?? '?';
    if (attempt >= 6) {
      console.error(`  ${path}: ${(err as Error).message} (${code}) — gave up after ${attempt} attempts`);
      return null;
    }
    console.error(`  ${path}: ${code}, retrying in ${attempt * 10}s (attempt ${attempt + 1})`);
    await sleep(attempt * 10_000);
    return get(path, cookie, attempt + 1);
  }
}

/**
 * Optional on-disk cache of the fetched HTML.
 *
 * A dev server compiling 78 routes on demand takes minutes, and iterating on
 * a rule should not cost another pass over the whole portal. `--cache <dir>`
 * saves each response; delete the directory (or omit the flag) to re-fetch,
 * which is what the after-run does.
 */
const CACHE = flag('cache');
const cacheFile = (path: string) =>
  CACHE ? join(CACHE, `${path.replace(/[^\w]+/g, '_') || 'root'}.html`) : undefined;

function readCache(path: string): Fetched | null {
  const file = cacheFile(path);
  if (!file) return null;
  try {
    const html = readFileSync(file, 'utf8');
    // A cached capture that ended mid-stream is worse than no cache: it
    // reads as a page with no heading and no content, and it would keep
    // reading that way on every subsequent run. Treat it as a miss.
    if (settle(html).pending > 0) return null;
    return { status: 200, html, gated: html.includes('NEXT_HTTP_ERROR_FALLBACK'), pending: 0 };
  } catch {
    return null;
  }
}

function writeCache(path: string, res: Fetched) {
  const file = cacheFile(path);
  if (!file || res.status !== 200 || !res.html) return;
  try {
    mkdirSync(CACHE!, { recursive: true });
    writeFileSync(file, res.html, 'utf8');
  } catch {
    /* a cache miss is not a failure */
  }
}

/** Normalise an href to a same-origin path, or null if it is not one. */
function toPath(href: string | undefined, from: string): string | null {
  if (!href) return null;
  if (/^(https?:|mailto:|tel:|#|javascript:|data:)/i.test(href)) {
    if (!href.startsWith(BASE)) return null;
    href = href.slice(BASE.length) || '/';
  }
  if (!href.startsWith('/')) {
    // A relative href — resolve against the current directory.
    try {
      href = new URL(href, `${BASE}${from}`).pathname;
    } catch {
      return null;
    }
  }
  const path = href.split('#')[0].split('?')[0];
  if (!path.startsWith('/')) return null;
  if (SKIP.some((re) => re.test(path))) return null;
  return path === '' ? '/' : path.replace(/(.)\/$/, '$1');
}

// ---------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------

const ELEMENT = 1;
const TEXT = 3;

const isElement = (n: Node): n is HTMLElement => n.nodeType === ELEMENT;
const tag = (el: HTMLElement) => (el.rawTagName ?? '').toLowerCase();

function attr(el: HTMLElement, name: string): string | undefined {
  const v = el.getAttribute(name);
  return v === undefined || v === null ? undefined : v;
}

/** Hidden from the accessibility tree — its text is not a name. */
function ariaHidden(el: HTMLElement): boolean {
  return attr(el, 'aria-hidden') === 'true' || attr(el, 'hidden') !== undefined;
}

/**
 * The text an assistive technology would read out of a subtree.
 *
 * `sr-only` text counts — it is visually hidden, not hidden from the tree,
 * and the kit uses it deliberately (see the `(required)` marker in `Field`).
 * `aria-hidden` subtrees do not count, which is the whole reason this walks
 * the tree instead of reading `.text`.
 */
function accessibleText(node: Node, depth = 0): string {
  if (depth > 40) return '';
  if (node.nodeType === TEXT) return (node as unknown as { text: string }).text ?? '';
  if (!isElement(node)) return '';

  const name = tag(node);
  if (name === 'script' || name === 'style' || name === 'template') return '';
  if (depth > 0 && ariaHidden(node)) return '';

  // An svg contributes its own name, never its path data.
  if (name === 'svg') return svgName(node);

  // An image inside a control contributes its alt text.
  if (name === 'img') return attr(node, 'alt') ?? '';

  const label = attr(node, 'aria-label');
  if (depth > 0 && label && label.trim()) return label;

  return node.childNodes.map((c) => accessibleText(c, depth + 1)).join(' ');
}

/** An svg is named by aria-label, or by a `<title>` child, or not at all. */
function svgName(el: HTMLElement): string {
  const label = attr(el, 'aria-label');
  if (label && label.trim()) return label;
  const titled = el.querySelector('title');
  return titled ? titled.text.trim() : '';
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Does `aria-labelledby` point at something that actually exists and speaks? */
function labelledByText(el: HTMLElement, root: HTMLElement): string {
  const ids = (attr(el, 'aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
  if (!ids.length) return '';
  return clean(
    ids
      .map((id) => {
        const target = root.querySelector(`#${CSS_ESCAPE(id)}`);
        return target ? clean(accessibleText(target)) : '';
      })
      .join(' '),
  );
}

/** Minimal id escaping — fixture ids are tame, but slugs can carry dots. */
const CSS_ESCAPE = (s: string) => s.replace(/([^\w-])/g, '\\$1');

function ancestors(el: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  let node = el.parentNode as HTMLElement | null;
  while (node && isElement(node)) {
    out.push(node);
    node = node.parentNode as HTMLElement | null;
  }
  return out;
}

// ---------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------

/**
 * Apply React's own streaming completion scripts before auditing.
 *
 * This is the single thing that decides whether the audit measures the
 * portal or measures nothing. Every route here sits under a `loading.tsx`
 * Suspense boundary, so the HTML on the wire is a shell plus a pile of
 * `<div hidden id="S:0">…</div>` payloads and the inline scripts that graft
 * them into place. Auditing the raw response finds "0 `<h1>`" on a page
 * whose `<h1>` is right there — the first run of this script did exactly
 * that, on `/about`, which has one.
 *
 * React emits two operations, and this performs both the way the browser
 * would, searching the whole document each time so nested boundaries settle
 * regardless of the order the scripts appear in:
 *
 *   $RC("B:0","S:0")   marker first, content second — a Suspense boundary
 *   $RS("S:2","P:2")   content first, marker second — a segment placeholder
 *
 * A boundary is emitted as
 *
 *   <!--$?--><template id="B:1"></template> …the loading.tsx fallback… <!--/$-->
 *
 * and `$RC` discards everything between the markers before inserting the
 * real content. Skipping that step leaves every skeleton in the document
 * beside the content that replaced it, which is not a cosmetic difference:
 * `(admin)/loading.tsx` and the page under it both contribute headings, so
 * a page with one `<h1>` measures as two, and the audit invents a defect
 * that no user could ever meet. Comments are parsed for this reason alone.
 *
 * A `<template id="B:n">` still standing afterwards is a boundary whose
 * completion script never arrived — the response was captured mid-stream.
 * `looksTruncated()` uses that to refetch rather than to report.
 */
function settle(html: string): { root: HTMLElement; settled: number; pending: number } {
  const root = parse(html, {
    comment: true,
    blockTextElements: { script: false, style: false, noscript: false, pre: true },
  });

  const ops: Array<{ marker: string; content: string }> = [];
  const re = /\$(RC|RS)\("([^"]+)","([^"]+)"\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    ops.push(m[1] === 'RC' ? { marker: m[2], content: m[3] } : { marker: m[3], content: m[2] });
  }

  let settled = 0;
  for (const op of ops) {
    const marker = root.querySelector(`[id="${op.marker}"]`);
    const content = root.querySelector(`[id="${op.content}"]`);
    if (!marker || !content) continue;
    dropFallback(marker);
    marker.replaceWith(...content.childNodes);
    content.remove();
    settled++;
  }

  // Payload containers whose graft never happened, and boundaries still
  // waiting on one. Both are dropped: their place in the settled document
  // is not knowable from the bytes that arrived.
  let pending = 0;
  for (const leftover of root.querySelectorAll('template[id], div[id]')) {
    const id = attr(leftover, 'id') ?? '';
    if (!/^[SPB]:[0-9a-z]+$/.test(id)) continue;
    if (tag(leftover) === 'template') {
      pending++;
      dropFallback(leftover);
    }
    leftover.remove();
  }

  // `<!--$!-->` marks a boundary the server gave up on and handed to the
  // client to render. There is no HTML for that subtree at all, so the page
  // cannot be audited from this response — `/verify` came back this way and
  // measured as "0 <h1>" on a screen whose first element is one. Counting it
  // as pending sends the request back rather than inventing a finding.
  pending += (html.match(/<!--\$!-->/g) ?? []).length;

  return { root, settled, pending };
}

const COMMENT = 8;
const commentText = (n: Node) => ((n as unknown as { rawText?: string }).rawText ?? '').trim();
/** `$`, `$?` and `$!` open a boundary; `/$` closes it. */
const OPENS_BOUNDARY = (n: Node) => n.nodeType === COMMENT && /^\$[?!]?$/.test(commentText(n));
const CLOSES_BOUNDARY = (n: Node) => n.nodeType === COMMENT && commentText(n) === '/$';

/**
 * Remove the fallback markup sitting between a boundary's template and its
 * closing marker — what React does before it grafts the real content in.
 *
 * Does nothing unless the node is preceded by an opening marker, so segment
 * placeholders (`<template id="P:2">`), which carry no fallback, are left
 * alone. Nested boundaries inside the fallback are counted so the scan stops
 * at the *matching* `<!--/$-->` and not the first one it meets.
 */
function dropFallback(marker: HTMLElement) {
  const parent = marker.parentNode as HTMLElement | null;
  if (!parent) return;

  const siblings = parent.childNodes;
  const start = siblings.indexOf(marker);
  if (start < 1 || !OPENS_BOUNDARY(siblings[start - 1])) return;

  const doomed: Node[] = [];
  let depth = 0;
  for (let i = start + 1; i < siblings.length; i++) {
    const node = siblings[i];
    if (OPENS_BOUNDARY(node)) depth++;
    else if (CLOSES_BOUNDARY(node)) {
      if (depth === 0) break;
      depth--;
    }
    doomed.push(node);
  }

  for (const node of doomed) node.remove();
}

/** A short, greppable fingerprint of the offending element. */
function snippet(el: HTMLElement): string {
  const open = el.outerHTML.slice(0, el.outerHTML.indexOf('>') + 1);
  const text = clean(el.text).slice(0, 40);
  return clean(open).slice(0, 200) + (text ? ` …${text}` : '');
}

// ---------------------------------------------------------------
// Rules
// ---------------------------------------------------------------

const RULES = [
  'html-lang',
  'heading-h1',
  'heading-order',
  'img-alt',
  'form-label',
  'control-name',
  'tabindex-positive',
  'table-caption',
  'nav-aria-current',
  'aria-empty',
  'role-img-name',
] as const;

type Rule = (typeof RULES)[number];

interface Finding {
  route: string;
  rule: Rule;
  detail: string;
  snippet: string;
}

interface PageResult {
  findings: Finding[];
  settled: number;
  pending: number;
}

function audit(route: string, html: string): PageResult {
  const { root, settled, pending } = settle(html);
  const found: Finding[] = [];
  const add = (rule: Rule, detail: string, el?: HTMLElement) =>
    found.push({ route, rule, detail, snippet: el ? snippet(el) : '' });

  /** Out of the accessibility tree — nothing inside it is read to anyone. */
  const exposed = (el: HTMLElement) => !ariaHidden(el) && !ancestors(el).some(ariaHidden);

  // --- lang on <html> -------------------------------------------------
  const htmlEl = root.querySelector('html');
  const lang = htmlEl ? attr(htmlEl, 'lang') : undefined;
  if (!lang || !lang.trim()) add('html-lang', '<html> has no lang attribute', htmlEl ?? undefined);

  // --- headings -------------------------------------------------------
  const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6').filter(exposed);

  const h1s = headings.filter((h) => tag(h) === 'h1');
  if (h1s.length !== 1) {
    add(
      'heading-h1',
      `${h1s.length} <h1> on the page` + (h1s.length ? `: ${h1s.map((h) => clean(h.text).slice(0, 40)).join(' | ')}` : ''),
      h1s[1],
    );
  }

  let previous = 0;
  for (const h of headings) {
    const level = Number(tag(h)[1]);
    if (previous === 0) {
      if (level !== 1) {
        add('heading-order', `first heading on the page is <h${level}>, not <h1>: "${clean(h.text).slice(0, 50)}"`, h);
      }
    } else if (level > previous + 1) {
      add('heading-order', `<h${previous}> → <h${level}> skips a level: "${clean(h.text).slice(0, 50)}"`, h);
    }
    previous = level;
  }

  // --- images ---------------------------------------------------------
  for (const img of root.querySelectorAll('img')) {
    if (!exposed(img)) continue;
    if (attr(img, 'alt') === undefined) add('img-alt', 'no alt attribute', img);
  }

  // --- form controls --------------------------------------------------
  const NAMELESS_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image']);
  for (const control of root.querySelectorAll('input, select, textarea')) {
    const type = (attr(control, 'type') ?? 'text').toLowerCase();
    if (tag(control) === 'input' && NAMELESS_TYPES.has(type)) {
      // `submit`/`button`/`reset` are named by their value, `image` by alt.
      if (type === 'hidden') continue;
      const own = type === 'image' ? attr(control, 'alt') : attr(control, 'value');
      if (own && own.trim()) continue;
    }
    if (!exposed(control)) continue;

    const id = attr(control, 'id');
    const hasFor = id ? root.querySelectorAll(`label[for="${id}"]`).length > 0 : false;
    const wrapped = ancestors(control).some((a) => tag(a) === 'label');
    const label = attr(control, 'aria-label');
    const labelled = labelledByText(control, root);
    const title = attr(control, 'title');

    if (!hasFor && !wrapped && !(label && label.trim()) && !labelled && !(title && title.trim())) {
      add('form-label', `<${tag(control)}${type !== 'text' ? ` type="${type}"` : ''}> has no label`, control);
    }
  }

  // --- links and buttons ----------------------------------------------
  for (const control of root.querySelectorAll('a, button')) {
    if (tag(control) === 'a' && attr(control, 'href') === undefined) continue;
    if (!exposed(control)) continue;

    const label = attr(control, 'aria-label');
    const name =
      (label && label.trim()) ||
      labelledByText(control, root) ||
      clean(accessibleText(control)) ||
      (attr(control, 'title') ?? '').trim();

    if (!name) add('control-name', `<${tag(control)}> has no accessible name`, control);
  }

  // --- positive tabindex ----------------------------------------------
  for (const el of root.querySelectorAll('[tabindex]')) {
    const value = Number(attr(el, 'tabindex'));
    if (Number.isFinite(value) && value > 0) add('tabindex-positive', `tabindex="${value}"`, el);
  }

  // --- tables ---------------------------------------------------------
  for (const table of root.querySelectorAll('table')) {
    if (!exposed(table)) continue;
    if (table.querySelector('caption')) continue;
    const own = attr(table, 'aria-label');
    if (own && own.trim()) continue;
    if (labelledByText(table, root)) continue;
    const named = ancestors(table).some((a) => {
      const l = attr(a, 'aria-label');
      return Boolean(l && l.trim());
    });
    if (!named) add('table-caption', 'no <caption>, and no aria-label on the table or its scroll container', table);
  }

  // --- aria-current on the active nav item ------------------------------
  for (const nav of root.querySelectorAll('nav')) {
    if (!exposed(nav)) continue;
    const links = nav.querySelectorAll('a[href]');
    const selfLink = links.find((a) => toPath(attr(a, 'href'), route) === route);
    if (!selfLink) continue;
    const marked = nav.querySelectorAll('[aria-current]').length > 0;
    if (!marked) {
      add(
        'nav-aria-current',
        `nav links to the current page (${route}) but nothing in it carries aria-current`,
        selfLink,
      );
    }
  }

  // --- empty aria-* values ----------------------------------------------
  for (const el of root.querySelectorAll('*')) {
    for (const [key, value] of Object.entries(el.attributes)) {
      if (key.startsWith('aria-') && value === '') {
        add('aria-empty', `${key}="" is an empty value`, el);
      }
    }
  }

  // --- role="img" -------------------------------------------------------
  for (const el of root.querySelectorAll('[role="img"]')) {
    if (!exposed(el)) continue;
    const label = attr(el, 'aria-label');
    const name = (label && label.trim()) || labelledByText(el, root) || (tag(el) === 'svg' ? svgName(el) : '');
    if (!name) add('role-img-name', `role="img" with no accessible name`, el);
  }

  return { findings: found, settled, pending };
}

// ---------------------------------------------------------------
// Run
// ---------------------------------------------------------------

async function main() {
  const staticRoutes = enumerateStaticRoutes();
  const templates = dynamicTemplates();

  if (has('routes')) {
    console.log(`${staticRoutes.length} static routes`);
    for (const r of staticRoutes) console.log(`  ${r.anonymous ? 'anon ' : 'admin'} ${r.path}`);
    console.log(`\n${templates.length} dynamic templates (instances come from the crawl)`);
    for (const t of templates) console.log(`  ${t}`);
    return;
  }

  const admin = COOKIES.SESSION_ADMIN;
  if (!admin) {
    console.error('No SESSION_ADMIN. Run: npx tsx scripts/mint-all.ts /tmp/cookies.env  then pass --cookies.');
    process.exit(2);
  }

  // 1. Fetch every static route, harvesting links as we go.
  const pages = new Map<string, { html: string; anonymous: boolean; origin: Route['origin'] }>();
  const skipped: Array<{ path: string; why: string }> = [];
  const discovered = new Set<string>();

  const queue: Route[] = staticRoutes.filter((r) => !ONLY || r.path.includes(ONLY));

  console.log(`Fetching ${queue.length} static routes from ${BASE}\n`);

  let n = 0;
  for (const route of queue) {
    const started = Date.now();
    const cached = readCache(route.path);
    if (!cached && has('cache-only')) continue;
    const res = cached ?? (await get(route.path, sessionFor(route)));
    if (res && !cached) writeCache(route.path, res);
    process.stdout.write(
      `  [${String(++n).padStart(2)}/${queue.length}] ${route.path.padEnd(32)} ${res ? res.status : 'ERR'}` +
        ` ${cached ? '(cached)' : `${Date.now() - started}ms`}\n`,
    );
    if (!res) {
      skipped.push({ path: route.path, why: 'request failed' });
      continue;
    }
    if (res.status !== 200) {
      skipped.push({ path: route.path, why: `status ${res.status}` });
      continue;
    }
    if (res.gated) {
      skipped.push({ path: route.path, why: 'feature-gated (Next error digest in body)' });
      continue;
    }
    if (res.pending > 0) {
      skipped.push({ path: route.path, why: `${res.pending} Suspense boundary(s) never rendered — not auditable` });
      continue;
    }
    pages.set(route.path, { html: res.html, anonymous: route.anonymous, origin: 'static' });

    // Harvest hrefs so the dynamic templates get real instances. This has
    // to run on the settled document too: every link to a member, a job or
    // an audit entry lives inside a Suspense boundary, so the raw shell
    // yields no instances at all and every dynamic route goes unaudited.
    for (const a of settle(res.html).root.querySelectorAll('a[href]')) {
      const p = toPath(attr(a, 'href'), route.path);
      if (p) discovered.add(p);
    }
  }

  for (const seed of ROUTE_SEEDS) discovered.add(seed);

  // 2. Up to two instances of every dynamic template the crawl turned up.
  //    Two rather than one because a detail page often branches on its data
  //    — a job with applicants against one without — and rather than all of
  //    them because eight hundred member pages are one component rendered
  //    eight hundred times, and auditing them all buys the same finding at
  //    four hours' cost.
  const PER_TEMPLATE = 2;
  const instances: string[] = [];
  for (const template of templates) {
    if (ONLY && !template.includes(ONLY)) continue;
    const hits = [...discovered].filter((p) => !pages.has(p) && matchesTemplate(p, template)).sort();
    if (!hits.length) {
      skipped.push({ path: template, why: 'no instance found by the crawl' });
      continue;
    }
    instances.push(...hits.slice(0, PER_TEMPLATE));
  }

  console.log(`Fetching ${instances.length} dynamic instances\n`);

  let m = 0;
  for (const path of instances) {
    const started = Date.now();
    const cached = readCache(path);
    if (!cached && has('cache-only')) continue;
    const res = cached ?? (await get(path, sessionFor({ path, anonymous: false })));
    if (res && !cached) writeCache(path, res);
    process.stdout.write(
      `  [${String(++m).padStart(2)}/${instances.length}] ${path.padEnd(40)} ${res ? res.status : 'ERR'}` +
        ` ${cached ? '(cached)' : `${Date.now() - started}ms`}\n`,
    );
    if (!res || res.status !== 200 || res.gated || res.pending > 0) {
      skipped.push({
        path,
        why: !res
          ? 'request failed'
          : res.gated
            ? 'feature-gated'
            : res.pending > 0
              ? `${res.pending} Suspense boundary(s) never rendered — not auditable`
              : `status ${res.status}`,
      });
      continue;
    }
    pages.set(path, { html: res.html, anonymous: false, origin: 'crawl' });
  }

  // 3. Audit.
  const findings: Finding[] = [];
  let settledTotal = 0;
  const incomplete: string[] = [];
  for (const [path, page] of [...pages].sort((a, b) => a[0].localeCompare(b[0]))) {
    const result = audit(path, page.html);
    findings.push(...result.findings);
    settledTotal += result.settled;
    if (result.pending) incomplete.push(`${path} (${result.pending})`);
  }

  // 4. Report.
  const width = Math.max(...RULES.map((r) => r.length));
  console.log(`\n${'='.repeat(64)}`);
  console.log(`Audited ${pages.size} pages · ${findings.length} findings`);
  console.log(`${settledTotal} Suspense boundaries settled before the rules ran`);
  if (incomplete.length) {
    console.log(`Boundaries that never completed, dropped: ${incomplete.join(', ')}`);
  }
  console.log('='.repeat(64));

  console.log('\nDefects per rule\n');
  for (const rule of RULES) {
    const hits = findings.filter((f) => f.rule === rule);
    const routes = new Set(hits.map((f) => f.route)).size;
    console.log(
      `  ${rule.padEnd(width)}  ${String(hits.length).padStart(4)}` +
        (hits.length ? `   on ${routes} page${routes === 1 ? '' : 's'}` : ''),
    );
  }

  console.log('\nFindings\n');
  for (const rule of RULES) {
    const hits = findings.filter((f) => f.rule === rule);
    if (!hits.length) continue;
    console.log(`── ${rule} (${hits.length}) ${'─'.repeat(Math.max(0, 50 - rule.length))}`);
    // Group identical snippets: a shell defect repeats on every page and is
    // one fix, not forty.
    const groups = new Map<string, Finding[]>();
    for (const f of hits) {
      const key = `${f.detail}∥${f.snippet}`;
      groups.set(key, [...(groups.get(key) ?? []), f]);
    }
    for (const [, group] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
      const f = group[0];
      const where = group.length === 1 ? f.route : `${group.length}× — ${group.slice(0, 4).map((g) => g.route).join(', ')}${group.length > 4 ? ', …' : ''}`;
      console.log(`   ${f.detail}`);
      if (f.snippet) console.log(`     ${f.snippet}`);
      console.log(`     ${where}\n`);
    }
  }

  if (skipped.length) {
    console.log(`\nNot audited (${skipped.length})\n`);
    for (const s of skipped.sort((a, b) => a.path.localeCompare(b.path))) {
      console.log(`  ${s.path.padEnd(40)} ${s.why}`);
    }
  }

  const jsonPath = flag('json');
  if (jsonPath) {
    writeFileSync(
      jsonPath,
      JSON.stringify({ base: BASE, pages: [...pages.keys()], skipped, findings }, null, 2),
      'utf8',
    );
    console.log(`\nWrote ${findings.length} findings to ${jsonPath}`);
  }

  process.exit(findings.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nAudit failed. Is the dev server up?');
  console.error(err);
  process.exit(2);
});
