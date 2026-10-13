import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { IS_FIXTURE } from '@/lib/config';
import { DEFAULT_PACK, type BrandPack } from '@/lib/branding/pack';
import { DEMO_PACK_IDS, getPack, listPacks } from '@/lib/branding/registry';
import { buildTokens, contrastReport, fontFaceCss, googleFontsHref, tokensToCss } from '@/lib/branding/tokens';
import { Breadcrumbs, PageHeader } from '@/components/ui';
import { BrandingStudio } from './BrandingStudio';

export const metadata: Metadata = {
  title: 'Branding · Staff console',
  description: 'The crest, photos, colours and words of this college’s portal.',
};

/**
 * The branding studio.
 *
 * This screen is the product's white-label seam made operable. Everything
 * that could differ between one college and the next is edited here or in
 * the JSON this page exports — no component, no stylesheet, no build.
 *
 * The page itself does the three things a server component should: guard,
 * resolve, and hand a fully-formed starting state to the editor. The
 * initial stylesheet and contrast report are computed here rather than
 * fetched, so the preview is correct on first paint instead of flashing
 * through a default theme.
 */
export default async function BrandingPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // The navigation already hides this from anyone without it. Hiding a
  // link is presentation; this is the authorisation.
  requireCap(session, 'tenant.configure');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();

  const { tenant, brand } = resolved;
  const pack = brand.pack;

  // Templates are the demonstration packs plus this college's own. Never
  // the full registry: that is the vendor's customer list, and one click
  // would load another college's identity into every field.
  const offered = new Set<string>([...DEMO_PACK_IDS, ...(tenant.packId ? [tenant.packId] : [])]);
  const basePacks = listPacks().filter((entry) => offered.has(entry.id));

  // Every template a base can be chosen from, plus the neutral default
  // under the empty key. The editor merges over these locally to assemble
  // the file it exports; the server still validates whatever comes back.
  const packsById: Record<string, BrandPack> = { '': DEFAULT_PACK };
  const fontFacesByPack: Record<string, string> = { '': fontFaceCss(DEFAULT_PACK) };
  for (const entry of basePacks) {
    const basePack = getPack(entry.id);
    if (!basePack) continue;
    packsById[entry.id] = basePack;
    fontFacesByPack[entry.id] = fontFaceCss(basePack);
  }
  // The college's own pack is always the base the editor starts from.
  if (tenant.packId && !packsById[tenant.packId]) {
    packsById[tenant.packId] = pack;
    fontFacesByPack[tenant.packId] = fontFaceCss(pack);
  }

  const tokens = buildTokens(pack);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Staff console', href: '/admin' },
              { label: 'Branding' },
            ]}
          />
        }
        eyebrow="Governance"
        title="Branding"
        description={`How ${tenant.shortName}'s portal looks. Supply the colours you know; the rest is worked out and checked.`}
      />

      <BrandingStudio
        pack={pack}
        basePacks={basePacks}
        packsById={packsById}
        currentPackId={tenant.packId}
        exportId={tenant.subdomain}
        tenantName={tenant.shortName}
        fcraRegistered={tenant.fcraRegistered}
        isFixture={IS_FIXTURE}
        initialCss={tokensToCss(tokens)}
        initialFontHref={googleFontsHref(pack)}
        fontFacesByPack={fontFacesByPack}
        initialReport={contrastReport(pack)}
      />
    </div>
  );
}
