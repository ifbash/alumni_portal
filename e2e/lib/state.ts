import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { StateFile } from './state-types';

/** `__dirname` — Playwright loads this as CommonJS. See e2e/global-setup.ts. */
const PATH = resolve(__dirname, '..', '.state', 'fixtures.json');

let cached: StateFile | null = null;

/**
 * The fixtures `global-setup.ts` produced. Read once per worker.
 *
 * Deliberately synchronous and deliberately not a Playwright fixture:
 * the route table is evaluated at module scope so that `test.describe`
 * can generate one test per cell, and a `test.beforeAll` would run far
 * too late to name them.
 */
export function state(): StateFile {
  if (!cached) {
    try {
      cached = JSON.parse(readFileSync(PATH, 'utf8')) as StateFile;
    } catch (err) {
      throw new Error(
        `Could not read ${PATH}: ${String(err)}\n` +
          'Run `npx tsx e2e/fixtures/collect.ts` (global-setup normally does this).',
      );
    }
  }
  return cached;
}

/** The cookie header for a demo role, or nothing at all for `anon`. */
export function cookieFor(caller: string): Record<string, string> {
  if (caller === 'anon') return {};
  const s = state().sessions[caller];
  if (!s) throw new Error(`No minted session for "${caller}". Known: ${Object.keys(state().sessions).join(', ')}`);
  return { cookie: s.cookie };
}

export function memberIdOf(caller: string): string {
  const s = state().sessions[caller];
  if (!s) throw new Error(`No minted session for "${caller}".`);
  return s.memberId;
}
