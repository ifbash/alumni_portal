import Link from 'next/link';
import { Mail, MapPin, Phone, ServerCog } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { PoweredBy } from './PoweredBy';
import type { BrandPack } from '@/lib/branding/pack';

/**
 * Public footer.
 *
 * Carries the two things a college portal is judged on by anyone who
 * looks closely: a real postal address for the institution, and a
 * straight answer about where the data lives. Both are stated here rather
 * than buried three clicks into the privacy notice, because "where is our
 * alumni data stored" is the first question the management asks and the
 * last thing most portals answer.
 */
export function SiteFooter({ pack }: { pack: BrandPack }) {
  const year = new Date().getFullYear();
  const { copy, features } = pack;

  return (
    <footer className="mt-auto border-t border-line bg-surface-sunken">
      <div className="page-shell py-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div className="space-y-4">
            <Logo pack={pack} height={28} />

            {copy.tagline ? <p className="text-sm text-secondary">{copy.tagline}</p> : null}

            {copy.addressLines.length ? (
              <address className="flex gap-2.5 text-sm not-italic text-secondary">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                <span>
                  {copy.addressLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </span>
              </address>
            ) : null}
          </div>

          <nav aria-labelledby="footer-portal">
            <h2 id="footer-portal" className="text-xs font-semibold uppercase tracking-wider text-muted">
              Portal
            </h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              <li>
                <Link href="/login" className="link-quiet text-secondary">
                  Sign in
                </Link>
              </li>
              <li>
                <Link href="/claim" className="link-quiet text-secondary">
                  Claim your profile
                </Link>
              </li>
              <li>
                <Link href="/about" className="link-quiet text-secondary">
                  About the portal
                </Link>
              </li>
              {features.events ? (
                <li>
                  <Link href="/events" className="link-quiet text-secondary">
                    Events
                  </Link>
                </li>
              ) : null}
            </ul>
          </nav>

          <nav aria-labelledby="footer-legal">
            <h2 id="footer-legal" className="text-xs font-semibold uppercase tracking-wider text-muted">
              Legal
            </h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              <li>
                <Link href="/privacy" className="link-quiet text-secondary">
                  Privacy notice
                </Link>
              </li>
              <li>
                <Link href="/terms" className="link-quiet text-secondary">
                  Terms of use
                </Link>
              </li>
              <li>
                <Link href="/privacy#your-rights" className="link-quiet text-secondary">
                  Your rights over your data
                </Link>
              </li>
              <li>
                <Link href="/privacy#grievance" className="link-quiet text-secondary">
                  Grievance officer
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Alumni cell</h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              {copy.supportEmail ? (
                <li className="flex items-start gap-2.5">
                  <Mail className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                  <a href={`mailto:${copy.supportEmail}`} className="link-quiet break-all text-secondary">
                    {copy.supportEmail}
                  </a>
                </li>
              ) : null}
              {copy.supportPhone ? (
                <li className="flex items-start gap-2.5">
                  <Phone className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                  <a href={`tel:${copy.supportPhone.replace(/\s+/g, '')}`} className="link-quiet text-secondary">
                    {copy.supportPhone}
                  </a>
                </li>
              ) : null}
              {copy.websiteUrl ? (
                <li>
                  <a
                    href={copy.websiteUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="link-quiet text-secondary"
                  >
                    College website
                  </a>
                </li>
              ) : null}
            </ul>

            <p className="mt-4 flex items-start gap-2.5 text-xs text-muted">
              <ServerCog className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                Member data is stored and processed in India (Mumbai region). Nothing is transferred
                outside the country.
              </span>
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">
            © {year} {copy.institutionName}. Portal operated by the alumni cell.
          </p>
          <PoweredBy pack={pack} />
        </div>
      </div>
    </footer>
  );
}
