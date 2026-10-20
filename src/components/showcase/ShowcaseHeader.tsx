import * as React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { ButtonLink, ThemeToggle } from '@/components/ui';
import type { BrandPack } from '@/lib/branding/pack';
import { ShowcaseMenu } from './ShowcaseMenu';
import { SHOWCASE_NAV } from './styles';
import type { ShowcaseLinks } from './links';

/**
 * The product site's header: the ifBash logo, four anchors and the two
 * calls to action. One tier, on the page's own paper, because this is the
 * vendor's site rather than a college's: there is no institution strip to
 * carry, and the one dark field on the page is the hero beneath it.
 */
export function ShowcaseHeader({ pack, links }: { pack: BrandPack; links: ShowcaseLinks }) {
  return (
    <header className="glass sticky top-0 z-40 border-x-0 border-t-0">
      <div className="page-shell flex h-16 items-center gap-4">
        <Link href="/" aria-label={`${pack.copy.institutionName} — home`} className="inline-flex min-h-11 shrink-0 items-center">
          <Logo pack={pack} height={28} />
        </Link>

        <nav aria-label="Product" className="ml-6 hidden items-center gap-1 lg:flex">
          {SHOWCASE_NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-secondary transition-colors duration-fast ease-brand hover:text-primary"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle className="mr-2 hidden lg:inline-flex" />
          {links.demoCollege ? (
            <ButtonLink href={links.demoCollege} variant="secondary" className="hidden min-h-11 md:inline-flex">
              See a demo college
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </ButtonLink>
          ) : null}
          {links.requestDemo ? (
            <ButtonLink href={links.requestDemo} className="min-h-11">
              Request a demo
            </ButtonLink>
          ) : null}
          <ShowcaseMenu items={SHOWCASE_NAV} demoHref={links.demoCollege} className="lg:hidden" />
        </div>
      </div>
      {/* Reading progress, drawn by the scroll timeline (see ShowcaseStyles). Decoration only. */}
      <div aria-hidden="true" className="sc-progress absolute inset-x-0 bottom-[-1px] h-0.5 bg-brand-fg" />
    </header>
  );
}
