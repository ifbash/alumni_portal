import type { Metadata } from 'next';
import Link from 'next/link';
import { Compass, LogIn, ShieldCheck } from 'lucide-react';
import { getTenantBrand } from '@/lib/tenant';
import {
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardTitle,
  EmptyState,
} from '@/components/ui';

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
 * The public pages are listed by name because there are only four of them,
 * and two of those — the privacy notice and the terms — have to stay
 * reachable without an account for the consent on the registration form to
 * mean anything.
 */
export default async function MarketingNotFound() {
  const resolved = await getTenantBrand();
  const copy = resolved?.brand.pack.copy;
  const collegeName = copy?.shortName ?? 'the college';
  const supportEmail = copy?.supportEmail ?? null;

  return (
    <div className="page-shell max-w-prose space-y-6 py-section">
      {/* The visual heading is the empty state's title; this is the one the
          document outline needs, so the h2 below descends from something. */}
      <h1 className="sr-only">Page not found</h1>

      <EmptyState
        icon={<Compass className="size-5" />}
        title="That address is not a page here"
        description={`It may never have been one, or it may be a page inside the portal — where nearly everything sits behind a sign-in. Signing in with the email address ${collegeName} holds for you will open it if it exists.`}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/login">
              <LogIn className="size-4" aria-hidden="true" />
              Sign in
            </ButtonLink>
            <ButtonLink href="/" variant="secondary">
              Home
            </ButtonLink>
          </div>
        }
      />

      <Card>
        <CardBody className="space-y-4">
          <div className="space-y-1">
            <CardTitle as="h2">The pages that are public</CardTitle>
            <CardDescription>
              Four, and no more than four. Everything else needs an account.
            </CardDescription>
          </div>

          <ul className="grid gap-2 sm:grid-cols-2">
            {PUBLIC_PAGES.map((page) => (
              <li key={page.href}>
                <Link
                  href={page.href}
                  className="block rounded border border-line px-3.5 py-2.5 transition-colors duration-fast ease-brand hover:border-line-strong hover:bg-surface-sunken"
                >
                  <span className="block text-sm font-medium">{page.label}</span>
                  <span className="block text-xs text-secondary">{page.description}</span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="flex items-start gap-2 border-t border-line pt-4 text-sm text-secondary">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              The alumni directory is never anonymous — there is no public profile page to have
              landed on. That is a deliberate choice, not a missing feature: it is what stops the
              network being scraped by recruiters.
            </span>
          </p>

          {supportEmail ? (
            <p className="text-sm text-secondary">
              Sent this link by {collegeName} and it should work?{' '}
              <a href={`mailto:${supportEmail}`} className="link">
                Write to {supportEmail}
              </a>{' '}
              with the address you tried.
            </p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}

const PUBLIC_PAGES = [
  { href: '/', label: 'Home', description: 'What the portal is and who it is for' },
  { href: '/about', label: 'About the network', description: 'How verification and the register work' },
  { href: '/privacy', label: 'Privacy notice', description: 'What is collected, why, and for how long' },
  { href: '/terms', label: 'Terms of use', description: 'The rules every account agrees to' },
];
