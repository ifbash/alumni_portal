import { notFound, redirect } from 'next/navigation';
import {
  ArrowUpRight,
  BadgeCheck,
  Circle,
  CircleCheck,
  CircleDashed,
  GraduationCap,
  Globe,
  Landmark,
  Lock,
  LogIn,
  Palette,
  Users,
} from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenants } from '@/lib/data/repo';
import { getPack, HOUSE_PACK_ID, DEMO_PACK_IDS, housePack } from '@/lib/branding/registry';
import { DEFAULT_PACK, type BrandPack, type Feature } from '@/lib/branding/pack';
import { scopedTokensCss } from '@/lib/branding/scope';
import { buildTokens, googleFontsHref } from '@/lib/branding/tokens';
import { vendorLabel } from '@/lib/branding/copy';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';
import { Logo } from '@/components/brand/Logo';
import { BandChip, PageBand } from '@/components/brand/PageBand';
import {
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  DetailRow,
  Disclosure,
  EmptyState,
  Progress,
  Section,
  Stat,
} from '@/components/ui';

import { MediaReadiness, COLLEGE_ASKS, setupSteps, type SetupStep } from '../_shared/MediaReadiness';
import { MiniPortal, SeedSwatches } from '../_shared/MiniPortal';
import { portalAddress } from '../_shared/portal-address';
import { VendorTrustChip } from '../_shared/VendorTrustChip';

/**
 * One college, as the vendor sees it.
 *
 * Its set-up, its look and aggregate counts, all from the tenant row and
 * its brand pack. Not one figure comes from a member record, and no count
 * links to the people behind it: `platform_admin` holds no capability that
 * would return one.
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

function coverageTone(fraction: number): 'danger' | 'warning' | 'success' {
  return fraction < 0.2 ? 'danger' : fraction < 0.35 ? 'warning' : 'success';
}

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
  const vendor = vendorLabel(housePack().copy);
  const scope = `pack-${look.id} college-hero`;
  const heroCss = scopedTokensCss(buildTokens(look), `.pack-${look.id}.college-hero`);
  const heroFonts = googleFontsHref(look);

  const steps = setupSteps(tenant, pack);
  const done = steps.filter((s) => s.done).length;
  const complete = done === steps.length;

  const cov = tenant.memberCount ? tenant.verifiedCount / tenant.memberCount : null;
  const waiting = Math.max(0, tenant.memberCount - tenant.verifiedCount);

  const heroPhoto = look.assets.heroImage
    ? { src: look.assets.heroImage, alt: look.assets.heroImageAlt ?? '', focus: look.assets.heroFocus }
    : null;

  const checklist = (
    <SetupChecklist tenant={tenant} pack={pack} steps={steps} done={done} complete={complete} />
  );

  return (
    <div className="space-y-6">
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

      {tenant.memberCount > 0 ? (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          {checklist}
          <section aria-labelledby="members-title" className="space-y-4">
            <h2 id="members-title" className="font-display text-xl font-semibold">
              Members
            </h2>
            {/* Counts only. None of these opens a list of people. */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <Stat label="Members" value={formatNumber(tenant.memberCount)} icon={<Users className="size-4" />} />
              {tenant.alumniCount ? (
                <Stat label="Alumni" value={formatNumber(tenant.alumniCount)} icon={<GraduationCap className="size-4" />} />
              ) : null}
              {tenant.studentCount ? (
                <Stat label="Final-year" value={formatNumber(tenant.studentCount)} icon={<Users className="size-4" />} />
              ) : null}
              {cov !== null ? (
                <Stat label="Verified" value={formatPercent(cov)} icon={<BadgeCheck className="size-4" />} />
              ) : null}
            </div>
            {cov !== null ? (
              <Card>
                <CardBody className="space-y-2.5">
                  <p className="text-sm font-medium text-primary">
                    {formatNumber(tenant.verifiedCount)} of {formatNumber(tenant.memberCount)} matched to the degree register
                  </p>
                  <Progress
                    value={tenant.verifiedCount}
                    max={tenant.memberCount}
                    tone={coverageTone(cov)}
                    label={`${formatPercent(cov)} of ${tenant.shortName} members verified`}
                  />
                  <p className="text-sm text-secondary">
                    {waiting > 0
                      ? `${formatNumber(waiting)} waiting on the college’s reviewers. Only the college can approve them; nobody at ${vendor} can.`
                      : 'Every member is matched to the degree register.'}
                  </p>
                </CardBody>
              </Card>
            ) : null}
          </section>
        </div>
      ) : (
        checklist
      )}

      <Section
        id="look"
        title={`How ${tenant.shortName} looks`}
        description={
          pack
            ? isTemplate
              ? `A starting template until ${tenant.shortName}’s own pack is written.`
              : 'The college’s own pack, as its sign-in screen renders it.'
            : undefined
        }
        actions={
          pack ? (
            <ButtonLink variant="secondary" href={`/platform/brands#${pack.id}`}>
              <Palette className="size-4" aria-hidden="true" />
              Edit brand pack
            </ButtonLink>
          ) : undefined
        }
      >
        {pack ? (
          <>
            <Card>
              <CardBody className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
                <MiniPortal pack={pack} />
                <div className="space-y-4">
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
      </Section>

      <Card>
        <CardHeader>
          <div className="min-w-0 space-y-1">
            <CardTitle as="h2">{PLAN[tenant.plan].label} plan</CardTitle>
            <CardDescription>{PLAN[tenant.plan].note}</CardDescription>
          </div>
        </CardHeader>
        <CardBody>
          {pack ? (
            <ul className="grid grid-cols-2 gap-x-6 gap-y-4 xl:grid-cols-3">
              {MODULES.map((m) => {
                const on = pack.features[m.key] === true;
                const locked = m.key === 'donations' && !tenant.fcraRegistered;
                return (
                  <li key={m.key} className="flex min-w-0 gap-3">
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
                      <p className="text-sm font-medium text-primary">
                        {m.label}
                        <span className={on ? 'ml-2 text-xs font-semibold text-success-fg' : 'ml-2 text-xs text-secondary'}>
                          {on ? 'On' : locked ? 'Locked until FCRA is confirmed' : 'Off'}
                        </span>
                      </p>
                      <p className="hidden text-xs text-secondary sm:block">{m.note}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-secondary">Modules follow the brand pack, and this college has none yet.</p>
          )}
        </CardBody>
      </Card>

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

// ---------------------------------------------------------------
// Set-up checklist
// ---------------------------------------------------------------

function SetupChecklist({
  tenant,
  pack,
  steps,
  done,
  complete,
}: {
  tenant: { createdAt: string; memberCount: number; verifiedCount: number; fcraRegistered: boolean; shortName: string };
  pack: BrandPack | null;
  steps: SetupStep[];
  done: number;
  complete: boolean;
}) {
  const detail = (s: SetupStep): string | null => {
    if (!s.done) return s.ask;
    switch (s.key) {
      case 'created':
        return formatDate(tenant.createdAt);
      case 'pack':
        return pack ? `${pack.copy.portalName} pack` : null;
      case 'mark':
        return pack?.assets.crest ? 'Crest in the pack' : 'Logo in the pack';
      case 'photos': {
        const a = pack?.assets;
        const n = (a?.heroImage ? 1 : 0) + (a?.authImage ? 1 : 0) + (a?.campusPhotos.length ?? 0);
        return `${n} ${n === 1 ? 'photo' : 'photos'} in the pack`;
      }
      case 'members':
        return `${formatNumber(tenant.memberCount)} so far`;
    }
  };

  // Members matched to the register mean the register is in: asking for it
  // beside "310 of 310 matched" would contradict the figure above.
  const untracked = [
    ...(tenant.verifiedCount > 0 ? [] : [COLLEGE_ASKS.register]),
    COLLEGE_ASKS.adminAccepted,
    COLLEGE_ASKS.previousExport,
  ];

  const list = (
    <div className="space-y-5">
      <ol className="space-y-3">
        {steps.map((s) => (
          <li key={s.key} className="flex gap-3">
            {s.done ? (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-success-fg" aria-hidden="true" />
            ) : (
              <Circle className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-primary">
                {s.label}
                <span className="sr-only">{s.done ? ', done' : ', still open'}</span>
              </p>
              {detail(s) ? <p className="text-xs text-secondary">{detail(s)}</p> : null}
            </div>
          </li>
        ))}
      </ol>

      <div className="space-y-3 border-t border-line pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-secondary">Not tracked yet</p>
        <ul className="space-y-3">
          {untracked.map((u) => (
            <li key={u.title} className="flex gap-3">
              <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary">{u.title}</p>
                <p className="text-xs text-secondary">{u.ask}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  const giving = (
    <p className="flex items-start gap-2 text-sm text-secondary">
      <Landmark className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
      {tenant.fcraRegistered
        ? 'Giving: the trust’s FCRA registration is confirmed, so giving can be switched on.'
        : 'Giving: locked until the trust’s FCRA registration status is confirmed in writing.'}
    </p>
  );

  if (complete) {
    return (
      <section id="setup" aria-label="Setup checklist" className="scroll-mt-20 space-y-3">
        <Disclosure
          summary={
            <span className="flex items-center gap-2">
              <CircleCheck className="size-4 text-success-fg" aria-hidden="true" />
              Setup complete · {done} of {steps.length}
            </span>
          }
        >
          {list}
        </Disclosure>
        {giving}
      </section>
    );
  }

  return (
    <Card id="setup" className="scroll-mt-20">
      <CardHeader>
        <div className="min-w-0 space-y-1">
          <CardTitle as="h2">Setup checklist</CardTitle>
          <CardDescription>In the order each usually arrives. Open items say what to ask {tenant.shortName} for.</CardDescription>
        </div>
        <Badge tone="brand" className="shrink-0 whitespace-nowrap">
          {done} of {steps.length} done
        </Badge>
      </CardHeader>
      <CardBody className="space-y-4">
        <Progress value={done} max={steps.length} label="Setup progress" />
        {list}
      </CardBody>
      <CardFooter>{giving}</CardFooter>
    </Card>
  );
}
