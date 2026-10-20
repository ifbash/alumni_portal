import { notFound, redirect } from 'next/navigation';
import { ArrowUpRight, Circle, CircleCheck, Globe, Landmark, Lock, LogIn, Palette } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenants } from '@/lib/data/repo';
import { getPack, HOUSE_PACK_ID, DEMO_PACK_IDS } from '@/lib/branding/registry';
import { DEFAULT_PACK, type BrandPack, type Feature } from '@/lib/branding/pack';
import { scopedTokensCss } from '@/lib/branding/scope';
import { buildTokens, googleFontsHref } from '@/lib/branding/tokens';
import { Logo } from '@/components/brand/Logo';
import { BandChip, PageBand } from '@/components/brand/PageBand';
import {
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  DetailRow,
  Disclosure,
  EmptyState,
} from '@/components/ui';

import { brandVerdict } from '../_shared/brand-check';
import { GoLiveTimeline } from '../_shared/GoLiveTimeline';
import { MediaReadiness, mediaSummary, setupSteps } from '../_shared/MediaReadiness';
import { MiniPortal, SeedSwatches } from '../_shared/MiniPortal';
import { LABEL, Meter, SectionHeading, VerdictText } from '../_shared/parts';
import { portalAddress } from '../_shared/portal-address';
import { VendorTrustChip } from '../_shared/VendorTrustChip';

/**
 * One college, as the vendor sees it.
 *
 * Its go-live road, its look and its modules, all from the tenant row and
 * its brand pack. Not one figure comes from a member record, and the
 * member-side steps of go-live are drawn as the college's own: the vendor
 * holds no capability that would say how they are going.
 */

export const metadata = { title: 'College' };

const STATUS = {
  active: { label: 'Live' },
  provisioning: { label: 'Onboarding' },
  suspended: { label: 'Suspended' },
} as const;

const PLAN = {
  trial: { label: 'Trial', note: 'An evaluation licence while the college decides.' },
  standard: { label: 'Standard', note: 'An annual licence for the core alumni network.' },
  institution: { label: 'Institution', note: 'An annual licence for the whole portal.' },
} as const;

const MODULES: Array<{ key: Feature; label: string; note: string }> = [
  { key: 'directory', label: 'Directory', note: 'Alumni find each other by branch, batch, company and city.' },
  { key: 'connections', label: 'Requests', note: 'Final-year students ask alumni for mentoring and referrals.' },
  { key: 'mentorship', label: 'Mentorship', note: 'Alumni say when they are open to mentoring.' },
  { key: 'events', label: 'Events', note: 'Reunions and department sessions, with registration.' },
  { key: 'jobs', label: 'Jobs', note: 'Alumni post roles; the placement cell checks them first.' },
  { key: 'news', label: 'News', note: 'Stories and announcements from the college.' },
  { key: 'gallery', label: 'Gallery', note: 'Photo albums from events and batches.' },
  { key: 'publicLanding', label: 'Public front page', note: 'A signed-out page on the college’s address.' },
  { key: 'whatsapp', label: 'WhatsApp messages', note: 'A WhatsApp channel for staff messages, once the college’s Business account is connected.' },
  { key: 'donations', label: 'Giving', note: 'Campaigns and the giving form, with foreign gifts held apart.' },
];

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  requireCap(session, 'tenant.provision');

  const { id } = await params;
  const tenant = getTenants().find((t) => t.id === id);
  if (!tenant) notFound();

  const pack = getPack(tenant.packId);
  // The hero needs a band; a college with no pack is shown in the neutral one it would get.
  const look: BrandPack = pack ?? DEFAULT_PACK;
  const isTemplate = pack ? pack.id === HOUSE_PACK_ID || (DEMO_PACK_IDS as readonly string[]).includes(pack.id) : false;

  const address = await portalAddress(tenant.subdomain);
  const scope = `pack-${look.id} college-hero`;
  const heroCss = scopedTokensCss(buildTokens(look), `.pack-${look.id}.college-hero`);
  const heroFonts = googleFontsHref(look);

  const steps = setupSteps(tenant, pack);
  const verdict = pack ? brandVerdict(pack) : null;
  const media = mediaSummary(pack);

  const heroPhoto = look.assets.heroImage
    ? { src: look.assets.heroImage, alt: look.assets.heroImageAlt ?? '', focus: look.assets.heroFocus }
    : null;

  return (
    <div className="space-y-8">
      {/* The chip stays on the left: its explanation opens rightwards. */}
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
        <Breadcrumbs items={[{ label: 'Colleges', href: '/platform' }, { label: tenant.shortName }]} />
        <VendorTrustChip />
      </div>

      {/* The hero wears the college's own tokens; the console around it keeps the house's. */}
      <div className={scope}>
        <style dangerouslySetInnerHTML={{ __html: heroCss }} />
        {heroFonts ? <link rel="stylesheet" href={heroFonts} precedence="default" /> : null}
        <PageBand
          pack={look}
          photo={heroPhoto}
          eyebrow={<Logo pack={look} variant="band" height={22} />}
          title={tenant.name}
          lead={look.copy.tagline}
          meta={
            <>
              <BandChip>{STATUS[tenant.status].label}</BandChip>
              <BandChip>{PLAN[tenant.plan].label} plan</BandChip>
              <BandChip icon={<Globe />} href={address.href}>
                <span className="font-mono">{address.host}</span>
              </BandChip>
            </>
          }
          actions={
            <>
              <ButtonLink href={address.href} target="_blank" rel="noreferrer" variant="band" className="min-h-11">
                Open portal
                <ArrowUpRight className="size-4" aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </ButtonLink>
              <ButtonLink
                href={`${address.href}/login`}
                target="_blank"
                rel="noreferrer"
                variant="band-outline"
                className="min-h-11"
              >
                <LogIn className="size-4" aria-hidden="true" />
                Preview sign-in
                <span className="sr-only">(opens in a new tab)</span>
              </ButtonLink>
            </>
          }
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <section id="setup" aria-labelledby="setup-title" className="scroll-mt-20 space-y-5">
          <SectionHeading id="setup-title" eyebrow="Go-live" title="The road to go-live">
            In the order each step usually arrives. The open step says what to ask {tenant.shortName} for.
          </SectionHeading>
          <Card>
            <CardBody>
              <GoLiveTimeline tenant={tenant} pack={pack} steps={steps} />
            </CardBody>
          </Card>
        </section>

        <aside aria-label="At a glance" className="space-y-4 lg:sticky lg:top-20">
          <p className="eyebrow font-mono text-brand-fg">At a glance</p>
          <Card>
            <CardBody className="divide-y divide-line py-0">
              <Glance label="Brand check">
                {verdict ? (
                  <>
                    <VerdictText verdict={verdict} />
                    <p className="mt-1 text-xs text-secondary">{verdict.summary}</p>
                  </>
                ) : (
                  <span className="text-sm text-secondary">No pack to check yet</span>
                )}
              </Glance>
              <Glance label="Media">
                <Meter value={media.present} total={media.total} label={`${media.present} of ${media.total} slots filled`} />
                <a href="#look" className="mt-1 inline-flex min-h-11 items-center text-xs text-brand-fg underline-offset-4 hover:underline sm:min-h-0">
                  See what is in the pack
                </a>
              </Glance>
              <Glance label="Plan">
                <p className="text-sm font-medium text-primary">{PLAN[tenant.plan].label}</p>
                <p className="mt-1 text-xs text-secondary">{PLAN[tenant.plan].note}</p>
              </Glance>
              <Glance label="Giving">
                <p className="flex items-start gap-2 text-sm text-secondary">
                  <Landmark className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                  {tenant.fcraRegistered
                    ? 'The trust’s FCRA registration is confirmed, so giving can be switched on.'
                    : 'Locked until the trust’s FCRA registration status is confirmed in writing.'}
                </p>
              </Glance>
            </CardBody>
          </Card>
        </aside>
      </div>

      <section id="look" aria-labelledby="look-title" className="scroll-mt-20 space-y-5">
        <SectionHeading
          id="look-title"
          eyebrow="Look"
          title={`How ${tenant.shortName} looks`}
          actions={
            pack ? (
              <ButtonLink variant="secondary" href={`/platform/brands#${pack.id}`}>
                <Palette className="size-4" aria-hidden="true" />
                Edit brand pack
              </ButtonLink>
            ) : undefined
          }
        >
          {pack
            ? isTemplate
              ? `A starting template until ${tenant.shortName}’s own pack is written.`
              : 'The college’s own pack, as its sign-in screen renders it.'
            : undefined}
        </SectionHeading>

        {pack ? (
          <>
            <Card>
              <CardBody className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
                <MiniPortal pack={pack} />
                <div className="space-y-4">
                  <p className={LABEL}>Colours</p>
                  <SeedSwatches pack={pack} />
                  <p className="text-xs text-secondary">
                    Headings in {pack.type.display}, text in {pack.type.body}.
                  </p>
                </div>
              </CardBody>
            </Card>
            <MediaReadiness pack={pack} name={tenant.shortName} />
          </>
        ) : (
          <EmptyState
            icon={<Palette className="size-5" />}
            title="No brand pack yet"
            description="The portal shows the neutral default until one is assigned, which reads as unfinished. Pick a starting pack before the first demo."
            action={
              <ButtonLink variant="secondary" href="/platform/brands">
                See brand packs
              </ButtonLink>
            }
          />
        )}
      </section>

      <section aria-labelledby="modules-title" className="space-y-5">
        <SectionHeading id="modules-title" eyebrow="Plan" title={`${PLAN[tenant.plan].label} plan modules`}>
          {PLAN[tenant.plan].note}
        </SectionHeading>
        {pack ? (
          <ul className="grid gap-x-10 border-t border-line sm:grid-cols-2">
            {MODULES.map((m) => {
              const on = pack.features[m.key] === true;
              const locked = m.key === 'donations' && !tenant.fcraRegistered;
              return (
                <li key={m.key} className="flex min-w-0 gap-3 border-b border-line py-3.5">
                  <span className="mt-0.5 shrink-0" aria-hidden="true">
                    {on ? (
                      <CircleCheck className="size-4 text-success-fg" />
                    ) : locked ? (
                      <Lock className="size-4 text-secondary" />
                    ) : (
                      <Circle className="size-4 text-muted" />
                    )}
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-primary">
                      {m.label}
                      <span className={on ? `${LABEL} text-success-fg` : LABEL}>
                        {on ? 'On' : locked ? 'Locked until FCRA is confirmed' : 'Off'}
                      </span>
                    </p>
                    <p className="text-xs text-secondary">{m.note}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-secondary">Modules follow the brand pack, and this college has none yet.</p>
        )}
      </section>

      <Disclosure summary="Technical details" id="technical">
        <dl className="divide-y divide-line">
          <DetailRow label="Tenant id">
            <span className="font-mono text-xs">{tenant.id}</span>
          </DetailRow>
          <DetailRow label="Subdomain">
            <span className="font-mono text-xs">{tenant.subdomain}</span>
          </DetailRow>
          <DetailRow label="Brand pack">
            {pack ? (
              <span className="font-mono text-xs">
                brands/{pack.id}.json · version {pack.version}
              </span>
            ) : (
              'None — renders the default pack'
            )}
          </DetailRow>
          <DetailRow label="Isolation">
            <span className="block space-y-1">
              <code className="block break-all font-mono text-xs">SET LOCAL app.tenant_id = &lsquo;{tenant.id}&rsquo;;</code>
              <span className="block text-xs font-normal text-secondary">
                Set once per request. Every row-level security policy keys off it.
              </span>
            </span>
          </DetailRow>
          <DetailRow label="Data residency">
            <span className="font-mono text-xs">ap-south-1</span>{' '}
            <span className="text-xs font-normal text-secondary">(Mumbai) · Postgres and object storage</span>
          </DetailRow>
          <DetailRow label="Locale">
            <span className="font-mono text-xs">
              {look.locale.locale} · {look.locale.currency} · {look.locale.timeZone}
            </span>
          </DetailRow>
          <DetailRow label="Shape">
            {look.shape.radius} corners · {look.shape.density} density · {look.shape.elevation} elevation
          </DetailRow>
        </dl>
      </Disclosure>
    </div>
  );
}

function Glance({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 py-4">
      <p className={LABEL}>{label}</p>
      <div>{children}</div>
    </div>
  );
}
