import * as React from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { yearIn } from '@/lib/format';
import type { BrandPack } from '@/lib/branding/pack';
import { LABEL, SHOWCASE_NAV } from './styles';
import type { ShowcaseLinks } from './links';

/**
 * The product site's footer. Light, under a hairline: the page's one dark
 * field is the hero at the top.
 *
 * Everything about the company comes from the house pack's copy. An
 * address renders only if the pack carries one; nothing is invented here.
 */
const LINK =
  'inline-flex min-h-11 items-center text-base lg:min-h-9 text-secondary underline-offset-4 transition-colors duration-fast ease-brand hover:text-primary hover:underline';

function displayUrl(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function ShowcaseFooter({ pack, links }: { pack: BrandPack; links: ShowcaseLinks }) {
  const { copy, locale } = pack;
  const year = yearIn(locale.timeZone);

  const groups: Array<{ id: string; title: string; items: Array<{ label: string; href: string; external?: boolean }> }> = [
    {
      id: 'product',
      title: 'Product',
      items: [
        ...SHOWCASE_NAV,
        ...(links.demoCollege ? [{ label: 'See a demo college', href: links.demoCollege, external: true }] : []),
      ],
    },
    {
      id: 'contact',
      title: 'Contact',
      items: [
        ...(copy.supportEmail ? [{ label: copy.supportEmail, href: `mailto:${copy.supportEmail}`, external: true }] : []),
        ...(copy.supportPhone
          ? [{ label: copy.supportPhone, href: `tel:${copy.supportPhone.replace(/\s+/g, '')}`, external: true }]
          : []),
        ...(copy.websiteUrl ? [{ label: displayUrl(copy.websiteUrl), href: copy.websiteUrl, external: true }] : []),
      ],
    },
    {
      id: 'portal',
      title: 'The portal',
      items: [
        { label: 'Member privacy notice', href: '/privacy' },
        { label: 'Terms of use', href: '/terms' },
        { label: 'Customer sign-in', href: '/login' },
      ],
    },
  ];

  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="page-shell py-10 lg:py-12">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
          <div className="col-span-2 space-y-4 sm:col-span-3 lg:col-span-1">
            <Logo pack={pack} height={28} />
            <p className="max-w-xs text-base text-secondary">Alumni portal for Indian engineering colleges.</p>
            {copy.addressLines.length ? (
              <address className="flex gap-2.5 text-base not-italic text-secondary">
                <MapPin className="mt-1 size-4 shrink-0" aria-hidden="true" />
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

          {groups
            .filter((g) => g.items.length)
            .map((g) => (
              <nav key={g.id} aria-labelledby={`footer-${g.id}`}>
                <h2 id={`footer-${g.id}`} className={LABEL}>
                  {g.title}
                </h2>
                <ul className="mt-2">
                  {g.items.map((item) => (
                    <li key={item.href}>
                      {item.external || item.href.includes('#') ? (
                        <a href={item.href} className={`${LINK} [overflow-wrap:anywhere]`}>
                          {item.label}
                        </a>
                      ) : (
                        <Link href={item.href} className={LINK}>
                          {item.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-secondary">
            © {year} {copy.institutionName}
          </p>
          <p className="text-sm text-secondary">Every college&rsquo;s portal carries its own name. This one carries ours.</p>
        </div>
      </div>
    </footer>
  );
}
