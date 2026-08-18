import { createHash } from 'node:crypto';

/**
 * The theme-boot script, and its CSP hash.
 *
 * This runs before first paint and applies a stored theme preference to
 * the document element. It has to be inline and blocking: a user who
 * chose dark and then sees a light frame on every navigation reads that
 * as a bug, not as a preference being applied.
 *
 * It is allowed through the Content-Security-Policy by **hash**, not by
 * nonce, and that choice is load-bearing.
 *
 * A nonce is regenerated per request, so the server renders
 * `nonce="abc"` and React — which deliberately does not serialise the
 * nonce attribute to the client — hydrates against `nonce=""`. That is a
 * genuine hydration mismatch, it logs an error on every page load, and
 * React explicitly will not patch it up.
 *
 * A hash has none of that problem. The script is a fixed string, so its
 * digest is fixed too: compute it once, list it in `script-src`, and the
 * attribute never appears in the markup at all. Nonces remain in the CSP
 * for Next.js's own bootstrap scripts, which are generated per request
 * and genuinely need one.
 *
 * If you edit `THEME_BOOT`, the hash changes with it automatically —
 * that is the whole reason it is derived here rather than pasted into
 * the middleware as a literal.
 */
export const THEME_BOOT =
  `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`;

/** `'sha256-…'`, ready to drop into a `script-src` list. */
export const THEME_BOOT_CSP_HASH = `'sha256-${createHash('sha256').update(THEME_BOOT).digest('base64')}'`;
