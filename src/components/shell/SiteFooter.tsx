import Link from 'next/link';
import { ChevronDown, Mail, MapPin, Phone, ServerCog } from 'lucide-react';
import { Crest } from '@/components/brand/Crest';
import { Logo } from '@/components/brand/Logo';
import { PoweredBy } from './PoweredBy';
import { hasGetInvolved } from './SiteHeader';
import { rollNumber } from '@/lib/branding/copy';
import { yearIn } from '@/lib/format';
import type { BrandPack } from '@/lib/branding/pack';

/**
 * Public footer, on the college band.
 *
 * Carries the two things a college portal is judged on by anyone who
 * looks closely: a real postal address for the institution, and a
 * straight answer about where the data lives. Both are stated here rather
 * than buried three clicks into the privacy notice, because "where is our
 * alumni data stored" is the first question the management asks and the
 * last thing most portals answer.
 *
 * It sits on the band so the page ends in the college's colour, the way
 * it began. The vendor credit is the last, smallest line on it.
 *
 * On the band, text uses band-* tokens only (see `.band-surface`).
 *
 * Below `md` the three link groups fold into native disclosures. Most of
 * their links repeat the sticky header and the phone menu, and stacked as
 * 44px rows they made the footer a quarter of a phone page. The identity
 * block, the residency line and the bottom row stay open. The groups are
 * rendered twice — disclosures for phones, columns from `md` — and the
 * copy that does not apply is `display: none`, so neither a screen reader
 * nor a keyboard meets both.
 */

// font-body: the base layer sets h2 in the display face, and a 12px uppercase serif reads as a mistake.
const HEADING = 'font-body text-xs font-semibold uppercase tracking-wider text-band-accent';
const LINK =
  'inline-flex min-h-11 items-center text-sm text-band-muted hover:text-band-fg hover:underline underline-offset-4';

export function SiteFooter({ pack }: { pack: BrandPack }) {
  const { copy, features, locale } = pack;
  const year = yearIn(locale.timeZone);
  const office = copy.officeName;
  const roll = rollNumber(copy);
  // The first address line is usually the institution's name, already shown just above.
  const address = copy.addressLines.filter((line) => line !== copy.institutionName);

  const alumni: Array<{ label: string; href: string }> = [
    { label: 'Register', href: '/claim' },
    { label: 'Sign in', href: '/login' },
    { label: 'Update your details', href: '/profile/edit' },
    ...(features.events && features.publicLanding ? [{ label: 'Events', href: '/campus-events' }] : []),
    ...(hasGetInvolved(features) ? [{ label: 'Get involved', href: '/#get-involved' }] : []),
    { label: 'About the portal', href: '/about' },
  ];

  const help: Array<{ label: string; href: string }> = [
    { label: `Contact the ${office}`, href: '/contact' },
    { label: `Find your ${roll.mid}`, href: '/claim#roll-number-help' },
    { label: 'Trouble signing in', href: '/contact#cannot-sign-in' },
    { label: 'Correct your record', href: '/contact#corrections' },
  ];

  const data: Array<{ label: string; href: string }> = [
    { label: 'Privacy notice', href: '/privacy' },
    { label: 'Terms of use', href: '/terms' },
    { label: 'Your rights over your data', href: '/privacy#your-rights' },
    { label: 'Grievance officer', href: '/privacy#grievance' },
  ];

  const contactItems = (
    <>
      {copy.supportEmail ? (
        <li className="flex items-center gap-2 text-band-muted">
          <Mail className="size-4 shrink-0" aria-hidden="true" />
          <a href={`mailto:${copy.supportEmail}`} className={`${LINK} min-w-0 break-all`}>
            {copy.supportEmail}
          </a>
        </li>
      ) : null}
      {copy.supportPhone ? (
        <li className="flex items-center gap-2 text-band-muted">
          <Phone className="size-4 shrink-0" aria-hidden="true" />
          <a href={`tel:${copy.supportPhone.replace(/\s+/g, '')}`} className={LINK}>
            {copy.supportPhone}
          </a>
        </li>
      ) : null}
    </>
  );

  const residency = (
    <p className="flex gap-2 text-xs text-band-muted">
      <ServerCog className="size-4 shrink-0" aria-hidden="true" />
      <span>
        Member data is stored and processed in India (Mumbai region). Nothing is transferred outside
        the country.
      </span>
    </p>
  );

  const groups: Array<{
    id: string;
    title: string;
    links: Array<{ label: string; href: string }>;
    extra?: React.ReactNode;
  }> = [
    { id: 'alumni', title: 'Alumni', links: alumni },
    { id: 'help', title: 'Get help', links: help, extra: contactItems },
    { id: 'data', title: 'Your data', links: data },
  ];

  return (
    <footer className="band-surface mt-auto">
      <div className="page-shell py-12">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          {/* Identity */}
          <div className="col-span-2 space-y-4 lg:col-span-1">
            <div className="flex items-center gap-3">
              <Crest pack={pack} size={48} />
              <Logo pack={pack} variant="band" height={28} />
            </div>

            {copy.institutionName !== copy.portalName ? (
              <p className="text-sm font-semibold">{copy.institutionName}</p>
            ) : null}

            {copy.affiliationLine ? <p className="text-sm text-band-muted">{copy.affiliationLine}</p> : null}

            {address.length ? (
              <address className="flex gap-2.5 text-sm not-italic text-band-muted">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  {address.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </span>
              </address>
            ) : null}
          </div>

          {/* Phones: one disclosure per group. */}
          <div className="col-span-2 -mt-2 border-t border-band-rule md:hidden">
            {groups.map((g) => (
              <details key={g.id} className="group border-b border-band-rule">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                  <span className={HEADING}>{g.title}</span>
                  <ChevronDown
                    className="size-4 shrink-0 text-band-muted transition-transform duration-fast ease-brand group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <nav aria-label={g.title} className="pb-3">
                  <ul>
                    {g.links.map((l) => (
                      <li key={l.href}>
                        <Link href={l.href} className={LINK}>
                          {l.label}
                        </Link>
                      </li>
                    ))}
                    {g.extra}
                  </ul>
                </nav>
              </details>
            ))}
            <div className="pt-5">{residency}</div>
          </div>

          {/* From md: the same groups as open columns. */}
          <nav aria-labelledby="footer-alumni" className="hidden md:block">
            <h2 id="footer-alumni" className={HEADING}>
              Alumni
            </h2>
            <ul className="mt-2">
              {alumni.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={LINK}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-help" className="hidden md:block">
            <h2 id="footer-help" className={HEADING}>
              Get help
            </h2>
            <ul className="mt-2">
              {help.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={LINK}>
                    {l.label}
                  </Link>
                </li>
              ))}
              {contactItems}
            </ul>
          </nav>

          <nav aria-labelledby="footer-data" className="col-span-2 hidden md:block lg:col-span-1">
            <h2 id="footer-data" className={HEADING}>
              Your data
            </h2>
            <ul className="mt-2 grid grid-cols-2 gap-x-6 lg:grid-cols-1">
              {data.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={LINK}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-3">{residency}</div>
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-band-rule pt-6 sm:flex-row sm:items-center sm:justify-between md:mt-10">
          <p className="text-xs text-band-muted">
            © {year} {copy.institutionName}. Portal run by the {office}.
          </p>
          <PoweredBy pack={pack} tone="band" />
        </div>
      </div>
    </footer>
  );
}
