import Link from 'next/link';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { NavLink } from '@/components/marketing/NavLink';
import { MobileNav } from '@/components/marketing/MobileNav';
import { ButtonLink, ThemeToggle } from '@/components/ui';
import type { BrandPack, FeatureSpec } from '@/lib/branding/pack';

/**
 * Public chrome — the header on the marketing surface.
 *
 * Two tiers, the way a university's own site frames its alumni office
 * (Harvard, Oxford): a thin strip in the college's colour carrying the
 * full institution name and a way back to the college's own site, then a
 * plain white bar with the portal's nav and the two doors, Register and
 * Sign in.
 *
 * Returned as two siblings, not one wrapper, so only the bar is sticky:
 * the strip scrolls away, and the marketing layout needs no change.
 *
 * `signedIn` changes the call to action rather than hiding it: an
 * alumnus who is already authenticated and lands on the landing page
 * wants a way back into the portal, not a second sign-in form.
 */

/**
 * Whether the landing page's "Get involved" section can have a row.
 * The header, the mobile menu and the footer all link to it, and none of
 * them may point at a section that is not there.
 */
export function hasGetInvolved(f: FeatureSpec): boolean {
  return f.publicLanding && (f.directory || (f.mentorship && f.connections) || f.jobs || f.events || f.donations);
}

/** The feature-gated public nav rows, shared by the desktop nav, the mobile menu and the footer. */
export function gatedPublicLinks(f: FeatureSpec): Array<{ label: string; href: string }> {
  return [
    ...(f.events && f.publicLanding ? [{ label: 'Events', href: '/campus-events' }] : []),
    ...(hasGetInvolved(f) ? [{ label: 'Get involved', href: '/#get-involved' }] : []),
  ];
}

export function SiteHeader({ pack, signedIn = false }: { pack: BrandPack; signedIn?: boolean }) {
  const { copy, features } = pack;
  const office = copy.officeName;
  const gated = gatedPublicLinks(features);

  const stripLink =
    'inline-flex min-h-11 items-center gap-1.5 text-band-muted hover:text-band-fg hover:underline underline-offset-4';

  return (
    <>
      {/*
        Tier 1: the institution strip. Not sticky. A labelled region, so the
        college's name is inside a landmark like everything else on the page
        (the bar below is the page's one banner).
      */}
      <div className="band-surface hidden md:block" role="region" aria-labelledby="site-institution">
        <div className="page-shell flex h-11 items-center justify-between gap-6 text-sm">
          <p id="site-institution" className="min-w-0 truncate font-medium" title={copy.institutionName}>
            {copy.institutionName}
            {copy.affiliationLine ? (
              <span className="hidden text-band-muted lg:inline"> · {copy.affiliationLine}</span>
            ) : null}
          </p>

          <nav aria-label={copy.shortName} className="flex shrink-0 items-center gap-6">
            {copy.websiteUrl ? (
              <a href={copy.websiteUrl} target="_blank" rel="noreferrer noopener" className={stripLink}>
                {copy.shortName} website
                <ExternalLink className="size-3.5" aria-hidden="true" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : null}
            <Link href="/contact" className={stripLink}>
              Contact the {office}
            </Link>
          </nav>
        </div>
      </div>

      {/* Tier 2: the bar. */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface-raised">
        <div className="page-shell flex h-14 items-center gap-4 lg:h-16">
          <Link href="/" aria-label={`${copy.portalName} — home`} className="shrink-0">
            <Logo pack={pack} height={28} />
          </Link>

          <nav aria-label="Main" className="ml-4 hidden items-center gap-1 lg:flex">
            {gated.map((l) => (
              <NavLink key={l.href} href={l.href}>
                {l.label}
              </NavLink>
            ))}
            <NavLink href="/about">About</NavLink>
            <NavLink href="/contact">Contact</NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle className="hidden md:inline-flex" />

            {signedIn ? (
              <ButtonLink href="/dashboard" size="md" className="min-h-11">
                Go to the portal
                <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/claim" variant="secondary" size="md" className="hidden min-h-11 sm:inline-flex">
                  Register
                </ButtonLink>
                <ButtonLink href="/login" size="md" className="min-h-11">
                  Sign in
                </ButtonLink>
              </>
            )}

            <MobileNav
              items={gated}
              signedIn={signedIn}
              websiteUrl={copy.websiteUrl}
              shortName={copy.shortName}
              office={office}
              className="lg:hidden"
            />
          </div>
        </div>
      </header>
    </>
  );
}
