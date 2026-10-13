import type { TokenSet } from './tokens';

/**
 * A college's tokens, applied to one element instead of the document.
 *
 * For previews of a college inside another college's (or the vendor's)
 * pages: the platform console showing each college's band, the branding
 * studio's live preview. The same declarations `tokensToCss` emits, with
 * `:root` rewritten to `selector`, so everything inside the wrapper reads
 * that college's palette and everything outside is untouched.
 *
 * Not for a whole shell. Toasts and overlay portals (Dialog, Sheet, Menu,
 * Popover) render outside any wrapper; a console that wears a different
 * pack overrides at the root instead (see the platform shell).
 *
 * `mode`:
 *  - `auto` follows the document exactly as the tenant tokens do: the OS
 *    preference, overridden in both directions by `data-theme`.
 *  - `light` / `dark` force one mode inside the wrapper, whatever the page
 *    is in — a side-by-side light and dark preview.
 */
export function scopedTokensCss(tokens: TokenSet, selector: string, mode: 'auto' | 'light' | 'dark' = 'auto'): string {
  const decl = (t: Record<string, string>) =>
    Object.entries(t)
      .map(([k, v]) => `${k}:${v}`)
      .join(';');

  const base = decl(tokens.base);
  const light = decl(tokens.light);
  const dark = decl(tokens.dark);

  if (mode === 'light') return `${selector}{${base};${light}}`;
  // Dark restates only the semantic tokens; the ramps come from light.
  if (mode === 'dark') return `${selector}{${base};${light};${dark}}`;

  return [
    `${selector}{${base};${light}}`,
    `@media(prefers-color-scheme:dark){:root:not([data-theme="light"]) ${selector}{${dark}}}`,
    `[data-theme="dark"] ${selector}{${dark}}`,
  ].join('');
}
