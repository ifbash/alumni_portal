import * as React from 'react';
import type { Metadata } from 'next';
import { PACKS } from '@/lib/branding/registry';
import type { BrandPack } from '@/lib/branding/pack';
import { Hero } from './Hero';
import { Audiences, Deployment, FinalCta, GoLive, Pricing, Readiness, Trust, WhiteLabel } from './Sections';
import { DEMO_COLLEGE_ID, showcaseLinks } from './links';

export function showcaseMetadata(pack: BrandPack): Metadata {
  const name = pack.copy.institutionName;
  return {
    title: { absolute: `${name} — alumni portal for Indian engineering colleges` },
    description:
      'A white-labelled alumni portal for final-year students and alumni, verified against the college’s degree register, in the college’s own name and colours.',
  };
}

/**
 * The house tenant's landing page: ifBash selling the portal to colleges.
 *
 * Rendered only for the house pack (`HOUSE_PACK_ID`); every college keeps
 * its own landing page. It reads no member data and no session. Its only
 * inputs are the brand packs in the registry and the request's host, from
 * which the demo college's address is built.
 */
export async function Showcase({ pack }: { pack: BrandPack }) {
  const links = await showcaseLinks(pack);
  const audited = Object.values(PACKS);

  return (
    <>
      <Hero pack={pack} links={links} />
      <Audiences />
      <WhiteLabel example={PACKS[DEMO_COLLEGE_ID]} audited={audited} />
      <Trust />
      <GoLive />
      <Readiness links={links} />
      <Deployment />
      <Pricing email={pack.copy.supportEmail} />
      <FinalCta links={links} />
    </>
  );
}
