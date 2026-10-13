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

/** A section: hairline above, generous air, clear of the sticky header when linked to. */
export const SECTION = 'scroll-mt-16 border-t border-line py-16 lg:py-24';

/** The product nav. Anchors on the landing page, absolute so they work from any public page. */
export const SHOWCASE_NAV: Array<{ label: string; href: string }> = [
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'For your college', href: '/#for-your-college' },
  { label: 'Privacy', href: '/#privacy' },
  { label: 'Pricing', href: '/#pricing' },
];
