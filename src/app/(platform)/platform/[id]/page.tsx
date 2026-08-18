import { notFound, redirect } from 'next/navigation';
import {
  BadgeCheck,
  Building2,
  Database,
  EyeOff,
  Globe,
  GraduationCap,
  Landmark,
  Lock,
  Palette,
  Server,
  Users,
} from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenants } from '@/lib/data/repo';
import { getPack, HOUSE_PACK_ID, DEMO_PACK_IDS } from '@/lib/branding/registry';
import { readableTextOn } from '@/lib/branding/color';
import type { Feature } from '@/lib/branding/pack';
import { formatDate, formatNumber, formatPercent, formatRelative } from '@/lib/format';
import { ProportionBar } from '@/components/charts';
import {
  Alert,
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
  EmptyState,
  PageHeader,
  Section,
  Stat,
} from '@/components/ui';

/**
 * One tenant, as the vendor sees it.
 *
 * Configuration, branding, feature flags and health — all of it derived
 * from the tenant row and its brand pack. Not one figure on this page
 * comes from a member record, because `platform_admin` holds no
 * capability that would return one.
 */

export const metadata = { title: 'Tenant' };

const PLATFORM_DOMAIN = 'alumni.ifbash.com';

const STATUS_TONE = { active: 'success', provisioning: 'info', suspended: 'danger' } as const;
const STATUS_LABEL = {
  active: 'Active',
  provisioning: 'Provisioning',
  suspended: 'Suspended',
} as const;
const PLAN_LABEL = { trial: 'Trial', standard: 'Standard', institution: 'Institution' } as const;
const PLAN_NOTE = {
  trial: 'Ninety days, full feature set, no commitment. Converts or lapses.',
  standard: 'Per-year licence. Directory, connections, events and jobs.',
  institution: 'Per-year licence with the whole surface, including giving and comms.',
} as const;

const RADIUS_LABEL = {
  none: 'square corners',
  subtle: 'subtle corners',
  rounded: 'rounded corners',
  pill: 'pill corners',
} as const;

const FEATURES: Array<{ key: Feature; label: string; note: string }> = [
  { key: 'directory', label: 'Directory', note: 'Search alumni by branch, batch, company, city. Never anonymous.' },
  { key: 'connections', label: 'Connections', note: 'The student-to-alumni valve, with per-cohort quotas.' },
  { key: 'events', label: 'Events', note: 'Reunions and department sessions, with check-in.' },
  { key: 'jobs', label: 'Jobs', note: 'Alumni post roles; the placement cell moderates.' },
  { key: 'mentorship', label: 'Mentorship', note: 'Availability flags and structured mentoring requests.' },
  { key: 'donations', label: 'Giving', note: 'Blocked until FCRA registration is confirmed in writing.' },
  { key: 'gallery', label: 'Gallery', note: 'Photo sets attached to events and batches.' },
  { key: 'news', label: 'News', note: 'Announcements on the portal home and the public landing page.' },
  { key: 'whatsapp', label: 'WhatsApp', note: 'Business API templates. Email open rates on alumni lists are poor.' },
  { key: 'publicLanding', label: 'Public landing', note: 'A signed-out marketing page on the tenant subdomain.' },
];

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  requireCap(session, 'tenant.provision');

  const { id } = await params;
  const tenant = getTenants().find((t) => t.id === id);
  if (!tenant) notFound();

  const pack = getPack(tenant.packId);
  const isDemoPack = pack ? (DEMO_PACK_IDS as readonly string[]).includes(pack.id) : false;
  const isHousePack = pack?.id === HOUSE_PACK_ID;

  const cov = tenant.memberCount ? tenant.verifiedCount / tenant.memberCount : null;
  const unverified = Math.max(0, tenant.memberCount - tenant.verifiedCount);
  const host = `${tenant.subdomain}.${PLATFORM_DOMAIN}`;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Colleges', href: '/platform' },
              { label: tenant.shortName },
            ]}
          />
        }
        eyebrow={`${PLAN_LABEL[tenant.plan]} plan`}
        title={tenant.name}
        description={`Provisioned ${formatRelative(tenant.createdAt)} on ${host}. Everything below is tenant configuration and aggregate counts — this console has no read path into the college's member data.`}
        actions={
          <>
            <Badge tone={STATUS_TONE[tenant.status]} dot>
              {STATUS_LABEL[tenant.status]}
            </Badge>
            <ButtonLink variant="secondary" href="/platform/brands">
              <Palette className="size-4" aria-hidden="true" />
              Brand packs
            </ButtonLink>
          </>
        }
      />

      {tenant.status === 'provisioning' ? (
        <Alert
          tone="info"
          title="This tenant is still provisioning"
          icon={<Server className="size-4" />}
        >
          <p>
            The tenant row, its RLS scope and the branding record exist. The degree register has
            not been loaded and the first <code className="font-mono text-xs">college_admin</code>{' '}
            invite has not been accepted, so there are no members to count yet. Nothing on this
            page is missing — it has simply not happened.
          </p>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Members"
          value={tenant.memberCount ? formatNumber(tenant.memberCount) : '—'}
          icon={<Users className="size-4" />}
          hint={tenant.memberCount ? 'students and alumni in one table' : 'no members yet'}
        />
        <Stat
          label="Alumni"
          value={tenant.alumniCount ? formatNumber(tenant.alumniCount) : '—'}
          icon={<GraduationCap className="size-4" />}
          hint={tenant.established ? `graduating batches since ${tenant.established + 4}` : 'across all batches'}
        />
        <Stat
          label="Final-year students"
          value={tenant.studentCount ? formatNumber(tenant.studentCount) : '—'}
          icon={<Users className="size-4" />}
          hint="flipped to alumni by the annual rollover"
        />
        <Stat
          label="Register coverage"
          value={cov === null ? '—' : formatPercent(cov)}
          icon={<BadgeCheck className="size-4" />}
          hint={
            cov === null
              ? 'no degree register loaded'
              : `${formatNumber(tenant.verifiedCount)} matched to a degree record`
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="min-w-0 space-y-1">
              <CardTitle as="h2">Configuration</CardTitle>
              <CardDescription>
                What the tenant row holds, and where its data physically sits.
              </CardDescription>
            </div>
            <Building2 className="size-5 shrink-0 text-muted" aria-hidden="true" />
          </CardHeader>
          <CardBody>
            <dl className="divide-y divide-line">
              <DetailRow label="Tenant id">
                <span className="font-mono text-xs">{tenant.id}</span>
              </DetailRow>
              <DetailRow label="Portal address">
                <span className="font-mono text-xs">{host}</span>
              </DetailRow>
              <DetailRow label="Short name">{tenant.shortName}</DetailRow>
              <DetailRow label="Established">
                {tenant.established ? <span className="tabular">{tenant.established}</span> : 'Not recorded'}
              </DetailRow>
              <DetailRow label="Plan">
                <span className="space-y-1">
                  <span className="block">{PLAN_LABEL[tenant.plan]}</span>
                  <span className="block text-xs font-normal text-muted">{PLAN_NOTE[tenant.plan]}</span>
                </span>
              </DetailRow>
              <DetailRow label="Lifecycle state">
                <Badge tone={STATUS_TONE[tenant.status]} dot>
                  {STATUS_LABEL[tenant.status]}
                </Badge>
              </DetailRow>
              <DetailRow label="Provisioned">
                <span className="tabular">{formatDate(tenant.createdAt)}</span>{' '}
                <span className="text-xs font-normal text-muted">
                  ({formatRelative(tenant.createdAt)})
                </span>
              </DetailRow>
              <DetailRow label="Data residency">
                <span className="flex flex-wrap items-center gap-2">
                  <Globe className="size-3.5 text-muted" aria-hidden="true" />
                  <span className="font-mono text-xs">ap-south-1</span>
                  <span className="text-xs font-normal text-muted">Mumbai — Postgres and S3</span>
                </span>
              </DetailRow>
              <DetailRow label="Isolation">
                <span className="space-y-1">
                  <code className="block break-all font-mono text-xs">
                    SET LOCAL app.tenant_id = &lsquo;{tenant.id}&rsquo;;
                  </code>
                  <span className="block text-xs font-normal text-muted">
                    Set once per request. Every row-level security policy in the schema keys off it.
                  </span>
                </span>
              </DetailRow>
              <DetailRow label="FCRA">
                {tenant.fcraRegistered ? (
                  <Badge tone="success">
                    <Landmark className="size-3" aria-hidden="true" />
                    Registered
                  </Badge>
                ) : (
                  <span className="space-y-1">
                    <Badge tone="neutral">Not confirmed</Badge>
                    <span className="block text-xs font-normal text-muted">
                      Giving stays off. Foreign contributions must be segregated at collection or
                      not collected at all.
                    </span>
                  </span>
                )}
              </DetailRow>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="min-w-0 space-y-1">
              <CardTitle as="h2">Brand pack in use</CardTitle>
              <CardDescription>
                Seeds in, tokens out. The college supplies colours it can name; the ramps, hovers
                and text pairings are derived.
              </CardDescription>
            </div>
            <Palette className="size-5 shrink-0 text-muted" aria-hidden="true" />
          </CardHeader>

          {pack ? (
            <>
              <CardBody className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="grid h-16 w-24 shrink-0 place-items-center rounded-lg border border-line font-mono text-xs font-semibold shadow-sm"
                    style={{
                      backgroundColor: pack.color.primary,
                      color: readableTextOn(pack.color.primary),
                    }}
                    aria-hidden="true"
                  >
                    {pack.color.primary.toUpperCase()}
                  </span>
                  {pack.color.accent ? (
                    <span
                      className="grid h-16 w-16 shrink-0 place-items-center rounded-lg border border-line font-mono text-[10px] font-semibold shadow-sm"
                      style={{
                        backgroundColor: pack.color.accent,
                        color: readableTextOn(pack.color.accent),
                      }}
                      aria-hidden="true"
                    >
                      {pack.color.accent.toUpperCase()}
                    </span>
                  ) : null}
                  <div className="min-w-0 space-y-1">
                    <p className="font-display text-lg font-semibold">{pack.copy.portalName}</p>
                    <p className="text-sm text-secondary">
                      Primary {pack.color.primary.toUpperCase()}
                      {pack.color.accent ? `, accent ${pack.color.accent.toUpperCase()}` : ', no second hue — monochrome by choice'}
                    </p>
                    <p className="sr-only">
                      Primary colour {pack.color.primary}
                      {pack.color.accent ? `, accent colour ${pack.color.accent}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge tone="brand">
                    <span className="font-mono">brands/{pack.id}.json</span>
                  </Badge>
                  <Badge tone="outline">version {pack.version}</Badge>
                  {isHousePack ? <Badge tone="accent">House pack</Badge> : null}
                  {isDemoPack ? <Badge tone="warning">Demonstration pack</Badge> : null}
                </div>

                <dl className="divide-y divide-line">
                  <DetailRow label="Institution">{pack.copy.institutionName}</DetailRow>
                  <DetailRow label="Tagline">
                    {pack.copy.tagline ?? <span className="text-muted">None set</span>}
                  </DetailRow>
                  <DetailRow label="Typography">
                    {pack.type.display} display · {pack.type.body} body · {pack.type.mono} mono
                    <span className="block text-xs font-normal text-muted">
                      loaded from {pack.type.source}, scale {pack.type.scale}
                    </span>
                  </DetailRow>
                  <DetailRow label="Shape">
                    {RADIUS_LABEL[pack.shape.radius]} · {pack.shape.density} density ·{' '}
                    {pack.shape.elevation} elevation
                  </DetailRow>
                  <DetailRow label="Locale">
                    <span className="font-mono text-xs">{pack.locale.locale}</span> ·{' '}
                    {pack.locale.currency} · {pack.locale.timeZone}
                  </DetailRow>
                  <DetailRow label="Crest">
                    {pack.assets.crest || pack.assets.logoPrimary ? (
                      <span className="font-mono text-xs">
                        {pack.assets.crest ?? pack.assets.logoPrimary}
                      </span>
                    ) : (
                      <span className="text-muted">
                        Not supplied — the logo falls back to the portal name in the display face
                      </span>
                    )}
                  </DetailRow>
                </dl>
              </CardBody>
              <CardFooter>
                <p className="text-xs text-muted">
                  Changing any of this is an edit to{' '}
                  <span className="font-mono">brands/{pack.id}.json</span> or a row in{' '}
                  <span className="font-mono">tenant_branding</span>. No component, no stylesheet,
                  no rebuild.
                </p>
              </CardFooter>
            </>
          ) : (
            <CardBody>
              <EmptyState
                icon={<Palette className="size-5" />}
                title="No brand pack assigned"
                description="The portal renders with the neutral default pack — plain, legible, and obviously unbranded. Assign a pack before the first demo; an unstyled portal reads as an outage."
                action={
                  <ButtonLink variant="secondary" href="/platform/brands">
                    Browse brand packs
                  </ButtonLink>
                }
              />
            </CardBody>
          )}
        </Card>
      </div>

      <Section
        title="Feature flags"
        description="What this college has bought, and what it has not yet cleared legally. These are hard gates in the navigation and in every route guard, not CSS classes."
      >
        <Card>
          <CardBody>
            <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
              {FEATURES.map((f) => {
                const on = pack ? pack.features[f.key] : false;
                const fcraBlocked = f.key === 'donations' && !tenant.fcraRegistered;
                return (
                  <li key={f.key} className="flex gap-3">
                    <span className="mt-0.5 shrink-0" aria-hidden="true">
                      {on ? (
                        <BadgeCheck className="size-4 text-success-fg" />
                      ) : fcraBlocked ? (
                        <Lock className="size-4 text-warning-fg" />
                      ) : (
                        <EyeOff className="size-4 text-muted" />
                      )}
                    </span>
                    <div className="min-w-0 space-y-0.5">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {f.label}
                        {on ? (
                          <Badge tone="success">On</Badge>
                        ) : fcraBlocked ? (
                          <Badge tone="warning">Blocked</Badge>
                        ) : (
                          <Badge tone="neutral">Off</Badge>
                        )}
                      </p>
                      <p className="text-xs text-secondary">{f.note}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardBody>
          <CardFooter>
            <p className="text-xs text-muted">
              {tenant.fcraRegistered
                ? 'FCRA registration is confirmed for this trust, so giving can be switched on once the college asks for it.'
                : 'Giving cannot be switched on for this tenant until the college confirms the trust’s FCRA registration status in writing.'}
            </p>
          </CardFooter>
        </Card>
      </Section>

      <Section
        title="Operational health"
        description="Counts, ratios and dates. There is no row-level view behind any of these numbers."
      >
        {tenant.memberCount === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title="No members to report on yet"
            description="Health figures appear once the degree register is loaded and the first invites go out. A tenant two days old with an empty members table is provisioning working correctly, not a fault."
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="min-w-0 space-y-1">
                  <CardTitle as="h3">Cohort split</CardTitle>
                  <CardDescription>
                    One table holds both. The annual rollover flips status; it never migrates rows.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardBody>
                <ProportionBar
                  label={`Cohort split for ${tenant.shortName}`}
                  segments={[
                    { label: 'Alumni', value: tenant.alumniCount, tone: 'brand' },
                    { label: 'Final-year students', value: tenant.studentCount, tone: 'accent' },
                  ]}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <div className="min-w-0 space-y-1">
                  <CardTitle as="h3">Verification</CardTitle>
                  <CardDescription>
                    A member is verified when their self-registration matches a row in the college&rsquo;s
                    own degree register.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                <ProportionBar
                  label={`Verification status for ${tenant.shortName}`}
                  segments={[
                    { label: 'Matched to a degree record', value: tenant.verifiedCount, tone: 'success' },
                    { label: 'Awaiting review', value: unverified, tone: 'warning' },
                  ]}
                />
                {unverified > 0 ? (
                  <p className="text-xs text-secondary">
                    {formatNumber(unverified)}{' '}
                    {unverified === 1 ? 'registration is' : 'registrations are'} waiting on the
                    college&rsquo;s own reviewers. Nobody at ifBash can approve them — verification is a{' '}
                    <code className="font-mono">verification.review</code> capability, and this
                    console does not hold it.
                  </p>
                ) : (
                  <p className="text-xs text-secondary">
                    Every member is matched to a degree record. Coverage this clean usually means
                    the register was loaded before the invites went out, which is the order that
                    works.
                  </p>
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </Section>

      <Card>
        <CardHeader>
          <div className="min-w-0 space-y-1">
            <CardTitle as="h2">What this page deliberately does not have</CardTitle>
            <CardDescription>
              The absence is the feature. A vendor console that can open a member record is a
              vendor console that will, eventually, be asked to.
            </CardDescription>
          </div>
          <Database className="size-5 shrink-0 text-muted" aria-hidden="true" />
        </CardHeader>
        <CardBody>
          <dl className="grid gap-5 md:grid-cols-3">
            <div className="space-y-1.5">
              <dt className="text-sm font-semibold">No member list</dt>
              <dd className="text-sm text-secondary">
                There is no link from any count on this page to the people behind it.{' '}
                <code className="font-mono text-xs">platform_admin</code> does not hold{' '}
                <code className="font-mono text-xs">profile.read.any</code> or{' '}
                <code className="font-mono text-xs">directory.search.alumni</code>, so the repository
                has no function that would answer the request.
              </dd>
            </div>
            <div className="space-y-1.5">
              <dt className="text-sm font-semibold">No contact release</dt>
              <dd className="text-sm text-secondary">
                Contact details live in their own table and are released only when the viewer is
                entitled <em>and</em> the owner has consented. A vendor role satisfies neither gate,
                so support access is a screen-share with the college, not a back door.
              </dd>
            </div>
            <div className="space-y-1.5">
              <dt className="text-sm font-semibold">No export</dt>
              <dd className="text-sm text-secondary">
                Bulk contact export is <code className="font-mono text-xs">college_admin</code> only
                and is audit-logged with actor, scope and stated reason. Not operator, not placement
                officer, not the people who run the servers.
              </dd>
            </div>
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}
