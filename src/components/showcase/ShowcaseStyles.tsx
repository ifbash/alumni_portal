import * as React from 'react';

/**
 * The product site's own CSS: the few rules that have no Tailwind spelling
 * (keyframes, a media-scoped 3-D tilt, scroll-driven progress). It is a
 * style element, not globals.css, because the house tenant owns it and no
 * college page should ever carry it. Everything resolves through tokens.
 *
 * Motion is transform and opacity only, and every loop stops under
 * reduced motion (the global rule already zeroes durations; the explicit
 * `animation: none` keeps a half-way float from being frozen on screen).
 */

/**
 * In dark mode the house band derives to a washed-out mauve, lighter than
 * anything else on the page, because the house primary sits too close to
 * the dark paper. The brand kit's dark UI is a raised panel under a plum
 * rule, so the one dark field remaps its band to those two tokens in dark
 * mode. Token to token, no colour: every band-* pairing still clears AA on
 * it (band-fg 15.6:1, band-muted 12.6:1, band-accent 10.4:1 on the house
 * pack). The same three conditions as the token CSS: light by default,
 * dark by the OS unless the visitor chose light, dark when chosen.
 */
const FIELD = '--band:var(--surface-raised);--band-rule:var(--border);border-bottom:1px solid var(--border)';

const CSS = [
  `@media(prefers-color-scheme:dark){:root:not([data-theme="light"]) .sc-field{${FIELD}}}`,
  `[data-theme="dark"] .sc-field{${FIELD}}`,

  // Reading progress: a hairline under the header that fills as the page scrolls.
  '.sc-progress{transform:scaleX(0);transform-origin:0 50%}',
  '@keyframes sc-progress{to{transform:scaleX(1)}}',
  '@supports(animation-timeline:scroll()){@media(prefers-reduced-motion:no-preference){' +
    '.sc-progress{animation:sc-progress linear both;animation-timeline:scroll(root block)}}}',

  // The hero's three browser windows: staggered rise, slow float, tilt that settles on hover.
  '@keyframes sc-rise{from{opacity:0;transform:translate3d(0,2.5rem,0)}to{opacity:1;transform:none}}',
  '@keyframes sc-float{from{transform:translate3d(0,-.4rem,0)}to{transform:translate3d(0,.5rem,0)}}',
  '.sc-rise{animation:sc-rise 700ms var(--ease) both;animation-delay:calc(var(--i,0)*140ms + 240ms)}',
  '.sc-float{animation:sc-float 7s ease-in-out infinite alternate}',
  // A raised window on the dark field: a soft cast, plus a hairline rim in the band's own foreground.
  '.sc-window{box-shadow:0 2.5rem 4rem -1.5rem color-mix(in srgb,var(--surface-inverse) 85%,transparent),' +
    '0 0 0 1px color-mix(in srgb,var(--band-fg) 16%,transparent)}',
  '@media(min-width:1024px){' +
    '.sc-stage{perspective:1800px}' +
    '.sc-dev{transition:transform var(--dur-slow) var(--ease);will-change:transform}' +
    '.sc-dev-l{transform:translateY(2.75rem) rotateY(9deg) rotateZ(-1.2deg)}' +
    '.sc-dev-m{transform:scale(1.04)}' +
    '.sc-dev-r{transform:translateY(3.75rem) rotateY(-9deg) rotateZ(1.2deg)}' +
    '}',
  '@media(min-width:1024px) and (hover:hover){.sc-dev:hover{transform:translateY(-.5rem) scale(1.04)}}',
  '@media(prefers-reduced-motion:reduce){.sc-float,.sc-rise{animation:none}.sc-dev{transition:none}}',
].join('');

export function ShowcaseStyles() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}
