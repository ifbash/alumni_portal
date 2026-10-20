import { getTenantBrand } from '@/lib/tenant';
import { MarketingLoadingShape } from './LoadingShape';

/**
 * The public surface, in outline.
 *
 * It matters more here than anywhere else in the portal: this is the first
 * thing an alumnus sees after tapping a WhatsApp link on a phone with two
 * bars of signal, and the tenant's fonts are still being fetched. A
 * spinner in an empty box would be the college's first impression, and a
 * skeleton of the wrong shape would jump when the real page landed.
 *
 * So the shape follows the page: the landing page's aurora hero with its
 * year picker and the events bento, or the shorter band the interior pages
 * share. The drawing is in `LoadingShape.tsx`. This file only supplies
 * what a client component cannot read, whether the college has a hero
 * photograph or a crest, because both change the hero's layout.
 *
 * The header and footer are drawn by the group's layout and are already on
 * screen by the time this shows, so neither is drawn here.
 */
export default async function MarketingLoading() {
  const pack = (await getTenantBrand())?.brand.pack;

  return (
    <MarketingLoadingShape
      photo={Boolean(pack?.assets.heroImage)}
      crest={Boolean(pack?.assets.crest)}
    />
  );
}
