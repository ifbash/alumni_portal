import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

import { expect, test } from '@playwright/test';

import { ROUTES } from './lib/routes';
import { state } from './lib/state';

/**
 * The table must cover the app.
 *
 * Everything else in this suite asserts that the routes in
 * `e2e/lib/routes.ts` behave. This asserts that the routes in
 * `e2e/lib/routes.ts` *are* the routes in `src/app` — which is the part
 * that rots silently. A permission net with a hole in it reports green
 * and means nothing, and the hole is always the same shape: somebody adds
 * a screen, nobody adds a row, and the screen is never probed by anybody.
 *
 * So the file system is walked and every `page.tsx` and every method
 * exported by every `route.ts` has to be matched by at least one row.
 * Adding a route without a row fails here, by name, with the line to add.
 */

const APP = resolve(__dirname, '..', 'src', 'app');

/** Files that are a route in Next's sense but not an HTTP surface worth probing. */
const NOT_A_SURFACE = new Set(['manifest.ts', 'robots.ts', 'sitemap.ts', 'opengraph-image.tsx']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/**
 * `src/app/(admin)/admin/members/[id]/page.tsx` → `/admin/members/:id`.
 * Route groups vanish; dynamic segments become wildcards.
 */
function urlPattern(file: string): string {
  const rel = relative(APP, file).split(sep);
  rel.pop(); // page.tsx / route.ts
  const segments = rel
    .filter((s) => !(s.startsWith('(') && s.endsWith(')')))
    .map((s) => (s.startsWith('[') ? ':param' : s));
  return `/${segments.join('/')}`.replace(/\/+$/, '') || '/';
}

function toRegex(pattern: string): RegExp {
  const source = pattern
    .split('/')
    .map((s) => (s === ':param' ? '[^/]+' : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${source}$`);
}

const METHOD_RE = /export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE)\b/g;

interface Surface {
  pattern: string;
  method: string;
  file: string;
}

const surfaces: Surface[] = [];
for (const file of walk(APP)) {
  const name = file.split(sep).pop()!;
  if (NOT_A_SURFACE.has(name)) continue;

  if (name === 'page.tsx') {
    surfaces.push({ pattern: urlPattern(file), method: 'GET', file: relative(APP, file) });
  } else if (name === 'route.ts') {
    const src = readFileSync(file, 'utf8');
    const methods = [...src.matchAll(METHOD_RE)].map((m) => m[1]!);
    for (const method of new Set(methods)) {
      surfaces.push({ pattern: urlPattern(file), method, file: relative(APP, file) });
    }
  }
}

/** The URLs the table actually probes, with their verbs, query stripped. */
const covered = ROUTES.map((r) => ({
  method: r.method,
  url: r.path(state().ids).split('?')[0]!,
  holds: r.holds,
}));

test.describe('route coverage', () => {
  test('the app has no route the permission table has never heard of', () => {
    const uncovered = surfaces.filter((s) => {
      const re = toRegex(s.pattern);
      return !covered.some((c) => c.method === s.method && re.test(c.url));
    });

    expect(
      uncovered.map((s) => `${s.method} ${s.pattern}   (src/app/${s.file})`),
      [
        '',
        'A ROUTE EXISTS THAT NO PERMISSION TEST HAS EVER OPENED.',
        '',
        uncovered.map((s) => `    ${s.method} ${s.pattern}   ← src/app/${s.file}`).join('\n'),
        '',
        '  Nothing has leaked yet — but nothing is watching this route either, and the whole point',
        '  of this suite is that a refactor cannot quietly widen access. A screen nobody probes is',
        '  a screen where the guard can be deleted in a rename and no test will say a word.',
        '',
        '  Fix: add one line to e2e/lib/routes.ts. For a page inside the staff console that is',
        '',
        "      consolePage('/admin/whatever', 'what it holds, in words', ['admin']),",
        '',
        '  and for an API route',
        '',
        "      api('POST', '/api/whatever', 'what it does', { default: FORBIDDEN, admin: ADMITTED_THEN_INVALID }),",
        '',
        '  Measure the real statuses first (`curl` with a cookie from scripts/mint-all.ts) and write',
        '  down what you saw, not what you expected — the note at the top of routes.ts explains why.',
        '',
      ].join('\n'),
    ).toEqual([]);
  });

  test('the table has no row pointing at a route that no longer exists', () => {
    const patterns = surfaces.map((s) => ({ ...s, re: toRegex(s.pattern) }));

    const orphans = covered.filter((c) => !patterns.some((p) => p.method === c.method && p.re.test(c.url)));

    expect(
      orphans.map((c) => `${c.method} ${c.url}`),
      [
        '',
        'THE PERMISSION TABLE IS PROBING SOMETHING THAT IS NOT A ROUTE.',
        '',
        orphans.map((c) => `    ${c.method} ${c.url}   — "${c.holds}"`).join('\n'),
        '',
        '  Either the route was deleted and the row should go with it, or a path was mistyped —',
        '  in which case the row has been asserting a 404 against nothing at all and passing.',
        '',
        '  The one deliberate exception is the negative-control row for a URL that must not exist;',
        '  if that is what this is, it is listed here on purpose and the assertion needs the same',
        '  exception written into it rather than being deleted.',
        '',
      ].join('\n'),
    ).toEqual(['GET /nope-not-a-route']);
  });
});
