import Link from 'next/link';
import { ChevronRight, Mail, Phone } from 'lucide-react';
import { ButtonLink, Card, CardBody } from '@/components/ui';
import { capitalise } from '@/lib/branding/copy';
import type { CopySpec } from '@/lib/branding/pack';

/**
 * Quick links and the office card (Oxford's "Alumni quick links",
 * Harvard's "Get Help"), on desktop only.
 *
 * On a phone the footer carries the same links a thumb's reach away, so
 * repeating them here would only add height. On desktop they answer the
 * visitor who came with one errand — update an email, fix a misspelt
 * name — without scrolling to the footer to find it.
 */
export function QuickLinks({ copy, signedIn, rollMid }: { copy: CopySpec; signedIn: boolean; rollMid: string }) {
  // The first address line is usually the institution's name, already on the card.
  const address = copy.addressLines.filter((line) => line !== copy.institutionName);

  const links: Array<{ label: string; href: string }> = [
    ...(!signedIn ? [{ label: `Find your ${rollMid}`, href: '/claim#roll-number-help' }] : []),
    { label: 'Update your contact details', href: '/profile/edit' },
    { label: 'Correct your name or record', href: '/contact#corrections' },
    ...(!signedIn ? [{ label: 'Help signing in', href: '/contact#cannot-sign-in' }] : []),
    { label: 'Offer to mentor, speak or hire', href: '/contact#help' },
    { label: 'Read the privacy notice', href: '/privacy' },
  ];

  return (
    <section id="quick-links" aria-labelledby="quick-title" className="hidden border-t border-line py-section lg:block">
      <div className="page-shell grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <h2 id="quick-title" className="font-display text-display-xs font-bold">
            Quick links
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-x-6">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="flex min-h-11 items-center justify-between gap-2 border-b border-line text-sm font-medium transition-colors duration-fast ease-brand hover:text-brand-fg"
                >
                  {l.label}
                  <ChevronRight className="size-4 text-muted" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <Card>
          <CardBody className="space-y-2 text-sm">
            <h3 className="font-display text-lg font-semibold">{capitalise(copy.officeName)}</h3>
            <p className="text-secondary">{copy.institutionName}</p>
            {copy.supportEmail ? (
              <p className="flex items-center gap-2">
                <Mail className="size-4 shrink-0 text-muted" aria-hidden="true" />
                <a href={`mailto:${copy.supportEmail}`} className="link min-w-0 break-all">
                  {copy.supportEmail}
                </a>
              </p>
            ) : null}
            {copy.supportPhone ? (
              <p className="flex items-center gap-2">
                <Phone className="size-4 shrink-0 text-muted" aria-hidden="true" />
                <a href={`tel:${copy.supportPhone.replace(/\s+/g, '')}`} className="link">
                  {copy.supportPhone}
                </a>
              </p>
            ) : null}
            {address.length ? (
              <address className="not-italic text-secondary">
                {address.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            ) : null}
            <ButtonLink href="/contact" variant="secondary" size="md" className="mt-2 min-h-11">
              All the ways to reach us
            </ButtonLink>
          </CardBody>
        </Card>
      </div>
    </section>
  );
}
