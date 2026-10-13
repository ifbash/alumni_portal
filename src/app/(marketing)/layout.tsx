import { notFound } from 'next/navigation';
import { getTenantBrand } from '@/lib/tenant';
import { getSession } from '@/lib/auth/session';
import { SiteHeader } from '@/components/shell/SiteHeader';
import { SiteFooter } from '@/components/shell/SiteFooter';
import { HOUSE_PACK_ID } from '@/lib/branding/registry';
import { ShowcaseChrome } from './ShowcaseChrome';

/**
 * The public frame.
 *
 * Everything in this group is reachable without a session — the landing
 * page, the privacy notice and the terms. The privacy notice in
 * particular *must* stay public: it is linked from the consent checkbox
 * on the claim form, and a consent notice you have to sign in to read is
 * not a notice.
 *
 * The session is read only to decide what the header's call to action
 * says. Nothing on these pages is gated on it.
 */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const resolved = await getTenantBrand();
  if (!resolved) notFound();

  const session = await getSession();
  const pack = resolved.brand.pack;

  // The house tenant's public pages are ifBash's product site, not a college's.
  if (pack.id === HOUSE_PACK_ID) return <ShowcaseChrome pack={pack}>{children}</ShowcaseChrome>;

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <SiteHeader pack={pack} signedIn={Boolean(session)} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter pack={pack} />
    </div>
  );
}
