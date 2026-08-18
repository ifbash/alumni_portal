import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Test runner config.
 *
 * `node`, not `jsdom`: every suite here exercises authorisation,
 * projection and colour derivation — pure functions with no DOM. Booting
 * jsdom for them would add seconds to the one set of tests that must stay
 * fast enough that nobody is tempted to skip it before a merge.
 *
 * `tests/**\/*.test.ts` only, so the two `*.manual.ts` harnesses (which
 * print a report and are run by hand via `npm run check:*`) stay out of
 * the automated run.
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});
