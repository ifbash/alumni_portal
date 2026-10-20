import Link from 'next/link';
import { ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { capitalise } from '@/lib/branding/copy';
import type { CopySpec } from '@/lib/branding/pack';
import { Eyebrow } from './SectionHead';

/**
 * Quick links and the office card (Oxford's "Alumni quick links",
 * Harvard's "Get Help"), on desktop only.
 *
 * On a phone the footer carries the same links a thumb's reach away, so
 * repeating them here would only add height. On desktop they answer the
 * visitor who came with one errand — update an email, fix a misspelt
 * name — without scrolling to the footer to find it.
 *
 * One composed panel that sits directly above the footer: the errands on
 * a sunken ground, the office on a raised one.
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
    <section id="quick-links" aria-labelledby="quick-title" className="hidden py-10 md:py-section lg:block">
      <div className="page-shell">
        <div className="reveal grid overflow-hidden rounded-xl border border-line ring-hairline lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="bg-surface-sunken p-8 xl:p-10">
            <Eyebrow>Errands</Eyebrow>
            <h2 id="quick-title" className="mt-3 font-display text-display-sm font-bold tracking-tight">
              Quick links
            </h2>
            <ul className="mt-6 grid grid-cols-2 gap-x-8">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="group flex min-h-12 items-center justify-between gap-2 border-b border-line text-sm font-medium transition-colors duration-fast ease-brand hover:text-brand-fg"
                  >
                    {l.label}
                    <ArrowUpRight
                      className="size-4 text-muted transition-transform duration-fast ease-brand group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-fg"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3 border-l border-line bg-surface-raised p-8 text-sm xl:p-10">
            <h3 className="font-display text-display-xs font-bold">{capitalise(copy.officeName)}</h3>
            <p className="text-secondary">{copy.institutionName}</p>
            {copy.supportEmail ? (
              <p className="flex items-center gap-2.5">
                <Mail className="size-4 shrink-0 text-muted" aria-hidden="true" />
                <a href={`mailto:${copy.supportEmail}`} className="link min-w-0 break-all">
                  {copy.supportEmail}
                </a>
              </p>
            ) : null}
            {copy.supportPhone ? (
              <p className="flex items-center gap-2.5">
                <Phone className="size-4 shrink-0 text-muted" aria-hidden="true" />
                <a href={`tel:${copy.supportPhone.replace(/\s+/g, '')}`} className="link">
                  {copy.supportPhone}
                </a>
              </p>
            ) : null}
            {address.length ? (
              <address className="flex gap-2.5 not-italic text-secondary">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                <span>
                  {address.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </span>
              </address>
            ) : null}
            <ButtonLink href="/contact" variant="secondary" size="md" className="mt-2 min-h-11">
              All the ways to reach us
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
