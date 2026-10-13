import { ShowcaseHeader } from '@/components/showcase/ShowcaseHeader';
import { ShowcaseFooter } from '@/components/showcase/ShowcaseFooter';
import { showcaseLinks } from '@/components/showcase/links';
import type { BrandPack } from '@/lib/branding/pack';

/**
 * The public frame on the house tenant.
 *
 * The house pack's public pages are ifBash's own product site, not a
 * college's, so they get the product header and footer instead of the
 * college chrome (institution strip, Register and Sign in, the band
 * footer). The pages inside are unchanged: the privacy notice and terms
 * stay public and reachable from the footer.
 */
export async function ShowcaseChrome({ pack, children }: { pack: BrandPack; children: React.ReactNode }) {
  const links = await showcaseLinks(pack);

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <ShowcaseHeader pack={pack} links={links} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <ShowcaseFooter pack={pack} links={links} />
    </div>
  );
}
