/**
 * The showcase's few repeated class strings, so every section reads as one
 * page. Token classes only: the house pack decides what they look like.
 */

/** Mono, uppercase, tracked: the ifBash eyebrow. */
export const EYEBROW = 'font-mono text-xs font-medium uppercase tracking-[0.14em] text-brand-fg';

/** A quieter mono label: step owners, option tags, column heads. */
export const LABEL = 'font-mono text-xs uppercase tracking-[0.14em] text-secondary';

/** A section's h2. */
export const H2 = 'font-display text-display-md font-bold text-primary';

/** The number a stat or step is made of: display face, tabular, tight. */
export const NUMERAL = 'font-display font-bold leading-none tabular text-accent-fg';

/** A section: hairline above, air that stays clear of the sticky header when linked to. */
export const SECTION = 'scroll-mt-16 border-t border-line py-9 lg:py-10';

/** A bordered object on the page: a bento cell. Raised, hairline, no radius of its own. */
export const CELL = 'border border-line bg-surface-raised p-5 lg:p-6';

/** The product nav. Anchors on the landing page, absolute so they work from any public page. */
export const SHOWCASE_NAV: Array<{ label: string; href: string }> = [
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'For your college', href: '/#for-your-college' },
  { label: 'Privacy', href: '/#privacy' },
  { label: 'Pricing', href: '/#pricing' },
];

/** The sections of the landing page in reading order, for the side rail. */
export const SHOWCASE_SECTIONS: Array<{ id: string; label: string }> = [
  { id: 'for-your-college', label: 'Two cohorts' },
  { id: 'white-label', label: 'White label' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'how-it-works', label: 'Go live' },
  { id: 'readiness', label: 'Status' },
  { id: 'deployment', label: 'Hosting' },
  { id: 'pricing', label: 'Pricing' },
];
