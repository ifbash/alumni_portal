import type { Metadata } from 'next';
import Link from 'next/link';
import { Compass, Home, LogIn } from 'lucide-react';
import { getTenantBrand } from '@/lib/tenant';
import { ButtonLink } from '@/components/ui';
import { StatusPanel } from '@/components/status/StatusPanel';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

/**
 * Not found, on the public site.
 *
 * Almost nothing on this portal is public, so the most likely truth is
 * that the address was a signed-in page and the reader has no session.
 * That is worth saying outright rather than leaving them to guess: the
 * directory is never anonymous, by design, and a visitor who does not know
 * that reads a 404 as a broken site.
 *
 * The public pages are listed by name, because a visitor who has landed
 * here needs somewhere to go that works. Campus events appears only for a
 * college that has the module on, so the list never links to a page that
 * would itself be a 404. The privacy notice and the terms stay in it: they
 * have to be reachable without an account for the consent on the
 * registration form to mean anything.
 *
 * It sits in the marketing layout's `<main>`, under the site header, so it
 * runs edge to edge like the other public heroes.
 */
export default async function MarketingNotFound() {
  const resolved = await getTenantBrand();
  const pack = resolved?.brand.pack;
  const collegeName = pack?.copy.shortName ?? 'the college';
  const supportEmail = pack?.copy.supportEmail ?? null;

  const pages = [
    {
      href: '/',
      label: 'Home',
      description: 'What the portal is and who it is for',
    },
    {
      href: '/about',
      label: 'About the network',
      description: 'How verification and the register work',
    },
    ...(pack?.features.events && pack.features.publicLanding
      ? [
          {
            href: '/campus-events',
            label: 'Campus events',
            description: 'Dates and venues, open to everyone',
          },
        ]
      : []),
    {
      href: '/contact',
      label: 'Contact',
      description: 'Who to write to, and how to fix a record',
    },
    {
      href: '/privacy',
      label: 'Privacy notice',
      description: 'What is collected, why, and for how long',
    },
    {
      href: '/terms',
      label: 'Terms of use',
      description: 'The rules every account agrees to',
    },
  ];

  return (
    <>
      <StatusPanel
        variant="bleed"
        icon={<Compass aria-hidden="true" />}
        eyebrow="Page not found"
        title="That address is not a page here"
        glyph="404"
        actions={
          <>
            <ButtonLink href="/" variant="band" size="lg">
              <Home className="size-4" aria-hidden="true" />
              Go to the home page
            </ButtonLink>
            <ButtonLink href="/login" variant="band-outline" size="lg">
              <LogIn className="size-4" aria-hidden="true" />
              Sign in
            </ButtonLink>
          </>
        }
      >
        <p>
          The link may have been cut short when it was shared, or it may be a page inside the
          portal, where nearly everything needs a sign-in. If it exists, signing in with the email
          address {collegeName} holds for you will open it.
        </p>
      </StatusPanel>

      <div className="page-shell space-y-8 py-10 lg:py-14">
        <section aria-labelledby="public-pages">
          <h2 id="public-pages" className="eyebrow text-brand-fg">
            Pages anyone can open
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map((page) => (
              <li key={page.href}>
                <Link
                  href={page.href}
                  className="lift ring-hairline block h-full min-h-14 rounded-lg border border-line bg-surface-raised px-4 py-3"
                >
                  <span className="block text-sm font-semibold">{page.label}</span>
                  <span className="mt-0.5 block text-xs text-secondary">{page.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="max-w-prose space-y-2 text-sm text-secondary">
          <p>
            There is no public profile page to have landed on. The alumni directory is never
            anonymous, so the network cannot be scraped by recruiters.
          </p>
          {supportEmail ? (
            <p>
              Sent this link by {collegeName} and it should work?{' '}
              <a href={`mailto:${supportEmail}`} className="link">
                Write to {supportEmail}
              </a>{' '}
              with the address you tried.
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
