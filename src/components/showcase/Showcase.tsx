import * as React from 'react';
import type { Metadata } from 'next';
import { PACKS } from '@/lib/branding/registry';
import { yearIn } from '@/lib/format';
import type { BrandPack } from '@/lib/branding/pack';
import { Hero } from './Hero';
import { Cohorts } from './Cohorts';
import { WhiteLabel } from './WhiteLabel';
import { Privacy } from './Privacy';
import { Deployment, GoLive, Readiness } from './Journey';
import { FinalCta, Pricing } from './Closing';
import { SectionRail } from './SectionRail';
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
 *
 * One idea per screen, in this order: the three live colleges, the two
 * cohorts, white label by JSON, privacy as code, how a college goes live,
 * what is built and what is not, where it runs, what it costs.
 */
export async function Showcase({ pack }: { pack: BrandPack }) {
  const links = await showcaseLinks(pack);
  const audited = Object.values(PACKS);

  return (
    <>
      <Hero pack={pack} links={links} />
      <SectionRail />
      <Cohorts />
      <WhiteLabel example={PACKS[DEMO_COLLEGE_ID]} audited={audited} />
      <Privacy />
      <GoLive />
      <Readiness links={links} />
      <Deployment />
      <Pricing email={pack.copy.supportEmail} />
      <FinalCta links={links} year={yearIn(pack.locale.timeZone)} />
    </>
  );
}
