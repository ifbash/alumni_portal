import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { ButtonLink, ThemeToggle } from '@/components/ui';
import type { BrandPack } from '@/lib/branding/pack';

/**
 * Public chrome — the header on the marketing surface.
 *
 * Deliberately has no drawer, no menu button and no client bundle. There
 * are three public pages and a sign-in door; a hamburger that opens a
 * sheet containing four links is machinery for its own sake. Below `md`
 * the secondary links fall away and the door stays, which is the only
 * thing a phone visitor arriving from a WhatsApp forward is here to find.
 *
 * `signedIn` changes the call to action rather than hiding it: an
 * alumnus who is already authenticated and lands on the landing page
 * wants a way back into the portal, not a second sign-in form.
 */
export function SiteHeader({ pack, signedIn = false }: { pack: BrandPack; signedIn?: boolean }) {
  const links: Array<{ label: string; href: string }> = [
    { label: 'About the portal', href: '/about' },
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface-raised">
      <div className="page-shell flex h-14 items-center gap-4">
        <Link href="/" className="link-quiet shrink-0" aria-label={`${pack.copy.portalName} — home`}>
          <Logo pack={pack} height={26} />
        </Link>

        <nav aria-label="About this portal" className="ml-2 hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded px-3 py-1.5 text-sm font-medium text-secondary transition-colors duration-fast ease-brand hover:bg-surface-sunken hover:text-primary"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />

          {signedIn ? (
            <ButtonLink href="/dashboard" size="sm">
              Go to the portal
              <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/claim" variant="secondary" size="sm" className="hidden sm:inline-flex">
                Claim your profile
              </ButtonLink>
              <ButtonLink href="/login" size="sm">
                Sign in
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
