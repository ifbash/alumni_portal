import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * `__dirname`, not `import.meta.url`.
 *
 * Playwright transpiles the config, the setup and every spec to CommonJS
 * before it loads them, and `import.meta` is a syntax error there. Only
 * `fixtures/collect.ts` may use ESM syntax, because only it is run
 * directly by `tsx`.
 */
const HERE = __dirname;
const STATE = resolve(HERE, '.state', 'fixtures.json');
const COLLECT = resolve(HERE, 'fixtures', 'collect.ts');

/** Regenerate rather than reuse anything older than this. */
const MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Produce `e2e/.state/fixtures.json` before anything runs.
 *
 * The collector is spawned as a separate `tsx` process on purpose.
 * Importing it here would load the entire fixture dataset into the
 * Playwright process, and `scripts/mint-all.ts` carries the warning that
 * doing that repeatedly next to a running dev server is enough memory
 * pressure to get the dev server OOM-killed — which then looks exactly
 * like the app crashing under the suite. One process, once, cached for
 * ten minutes.
 *
 * The cookies inside expire fourteen days out, so staleness is not about
 * signatures; it is about the seed changing under a suite that has
 * already decided which slug to probe.
 */
export default function globalSetup(): void {
  const fresh =
    existsSync(STATE) && Date.now() - statSync(STATE).mtimeMs < MAX_AGE_MS && !process.env.E2E_REFRESH_FIXTURES;

  if (!fresh) {
    /**
     * `node <tsx-cli> <collect>`, not `npx tsx`.
     *
     * `execFileSync` on Windows refuses to spawn `npx.cmd` — Node 20.12+
     * rejects `.cmd` and `.bat` without `shell: true` (the CVE-2024-27980
     * fix), and it fails with a bare `EINVAL` that says nothing about why.
     * Turning the shell on instead would put a path with a space in it
     * through `cmd.exe` quoting, which is its own afternoon. Resolving
     * tsx's own entry point and handing it to the Node binary already
     * running Playwright avoids both, and works identically on every OS.
     */
    const tsxCli = require.resolve('tsx/cli');
    execFileSync(process.execPath, [tsxCli, COLLECT], {
      cwd: resolve(HERE, '..'),
      stdio: ['ignore', 'inherit', 'inherit'],
      env: process.env,
    });
  }

  if (!existsSync(STATE)) {
    throw new Error(
      `The permission suite has no fixtures. \`npx tsx ${COLLECT}\` produced nothing.\n` +
        'Without it every probe would be aimed at a slug that does not exist, and a 404 ' +
        'would read as a refusal in the matrix.',
    );
  }

  const state = JSON.parse(readFileSync(STATE, 'utf8')) as { sessions: Record<string, unknown> };
  const roles = Object.keys(state.sessions).length;
  if (roles !== 9) {
    throw new Error(
      `Expected nine demo role cookies, collected ${roles}. ` +
        'The suite asserts the whole role table; running it against a subset would report ' +
        'a green matrix with holes in it.',
    );
  }
}
