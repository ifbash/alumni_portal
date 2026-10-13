import fs from 'node:fs';
import path from 'node:path';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Briefcase,
  CalendarDays,
  Check,
  FileLock2,
  HandHeart,
  Image as ImageIcon,
  Landmark,
  MessageCircle,
  Newspaper,
  Palette,
  Search,
  Server,
  UserPlus,
  Users,
  Globe,
} from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDegreeRegisterStats, getDepartments, getTenants } from '@/lib/data/repo';
import { NOTICE_VERSION, OTP_MAX_ATTEMPTS, OTP_TTL_SECONDS } from '@/lib/config';
import {
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  DetailRow,
  Disclosure,
  MediaFrame,
  PageHeader,
  Progress,
  Section,
} from '@/components/ui';
import { displayNow, formatDate, formatNumber } from '@/lib/format';
import { capitalise, joinList, vendorLabel } from '@/lib/branding/copy';
import type { BrandPack, Feature } from '@/lib/branding/pack';

export const metadata = { title: 'College profile · Staff console' };

/**
 * What each module does for members, said for its current state. A note
 * written for "on" is wrong the moment the module is off, so each has both.
 */
function moduleCopy(pack: BrandPack): Record<Feature, { label: string; icon: ReactNode; on: string; off: string }> {
  const office = pack.copy.officeName;
  return {
    directory: {
      label: 'Directory',
      icon: <Search className="size-4" />,
      on: 'Signed-in members find each other by name, batch and branch. Never open to visitors.',
      off: 'Members cannot search for each other.',
    },
    connections: {
      label: 'Requests',
      icon: <UserPlus className="size-4" />,
      on: 'Students and alumni can ask each other for help, within a limit on open requests.',
      off: 'Members cannot send each other requests.',
    },
    events: {
      label: 'Events',
      icon: <CalendarDays className="size-4" />,
      on: 'Members see events and register for them.',
      off: 'No events are shown to members.',
    },
    jobs: {
      label: 'Jobs',
      icon: <Briefcase className="size-4" />,
      on: 'Alumni post openings, and the placement cell approves each one before it is shown.',
      off: 'No job board is shown to members.',
    },
    mentorship: {
      label: 'Mentorship',
      icon: <Users className="size-4" />,
      on: 'Alumni can say they are open to mentoring, and students can find them.',
      off: 'Mentoring is not offered on the portal.',
    },
    donations: {
      label: 'Giving',
      icon: <HandHeart className="size-4" />,
      on: 'Campaigns and the giving form are visible to alumni. Students never see them.',
      off: 'Switched on once FCRA status is confirmed. Campaigns and the giving form become visible to alumni.',
    },
    gallery: {
      label: 'Gallery',
      icon: <ImageIcon className="size-4" />,
      on: `Event photos, put up by the ${office}.`,
      off: 'No photo albums are shown to members.',
    },
    news: {
      label: 'News',
      icon: <Newspaper className="size-4" />,
      on: 'College notices and stories on the member home.',
      off: 'No news is shown to members.',
    },
    whatsapp: {
      label: 'WhatsApp messages',
      icon: <MessageCircle className="size-4" />,
      on: 'Messages to members can go out on WhatsApp.',
      off: "Needs the college's approved WhatsApp Business number.",
    },
    publicLanding: {
      label: 'Public page',
      icon: <Globe className="size-4" />,
      on: 'A public page introduces the portal to visitors. It shows no member data.',
      off: 'Visitors go straight to sign-in.',
    },
  };
}


/**
 * A pack path, or null when it names a file that is not there. Only paths
 * under /public are checked (a remote URL is taken as given); a slot whose
 * file is missing is something to ask for, not something to tick.
 */
function reachable(src: string | null | undefined): string | null {
  if (!src) return null;
  if (!src.startsWith('/')) return src;
  const publicDir = path.join(process.cwd(), 'public');
  const file = path.resolve(publicDir, (src.split('?')[0] ?? src).replace(/^\/+/, ''));
  if (!file.startsWith(publicDir + path.sep)) return null;
  return fs.existsSync(file) ? src : null;
}

/** The eight things a college supplies for its identity, and what to ask for when one is missing. */
function brandAssets(pack: BrandPack): Array<{ key: string; label: string; supplied: boolean; ask: string }> {
  const a = pack.assets;
  return [
    { key: 'crest', label: 'Crest', supplied: Boolean(reachable(a.crest)), ask: 'the crest in vector (SVG)' },
    { key: 'logoPrimary', label: 'Logo', supplied: Boolean(reachable(a.logoPrimary)), ask: 'the logo for light backgrounds' },
    { key: 'logoInverse', label: 'Reversed logo', supplied: Boolean(reachable(a.logoInverse)), ask: 'the logo for dark backgrounds' },
    { key: 'logoMark', label: 'Logo mark', supplied: Boolean(reachable(a.logoMark)), ask: 'a square mark for small spaces' },
    { key: 'ogImage', label: 'Share card', supplied: Boolean(reachable(a.ogImage)), ask: 'a 1200×630 share card' },
    { key: 'heroImage', label: 'Landing photo', supplied: Boolean(reachable(a.heroImage)), ask: 'a wide campus photo for the landing page' },
    { key: 'authImage', label: 'Sign-in photo', supplied: Boolean(reachable(a.authImage)), ask: 'a photo for the sign-in page' },
    { key: 'campusPhotos', label: 'Campus photos', supplied: a.campusPhotos.some((p) => reachable(p.src)), ask: 'a few campus photos with captions' },
  ];
}

/**
 * The college profile.
 *
 * Read-only: everything here comes from the brand pack, the tenant record
 * and the repo, and is changed in Branding (identity) or by the vendor
 * (modules, legal status). The order is the order a college admin checks
 * it: who we are, what we are legally cleared for, how the college is
 * structured, what members can use, and — collapsed — the facts an IT team
 * or auditor asks for.
 *
 * The vendor holds `tenant.configure` and reads this page, so it carries
 * no member data: counts at most.
 */
export default async function AdminSettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  requireCap(session, 'tenant.configure');

  const resolved = await getTenantBrand();
  if (!resolved) redirect('/login');
  const { tenant, brand } = resolved;
  const pack = brand.pack;

  const summary = getTenants().find((t) => t.id === tenant.id) ?? null;
  const departments = getDepartments();
  const register = getDegreeRegisterStats();

  const fmt = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };

  // Indian academic sessions start in June/July. Derived from the portal's
  // clock rather than stored, so nobody has to roll a config value over.
  const now = displayNow();
  const nowParts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: fmt.timeZone })
    .format(now)
    .split('-');
  const year = Number(nowParts[0]);
  const month = Number(nowParts[1]);
  const sessionStart = month >= 6 ? year : year - 1;
  const academicYear = `${sessionStart}–${String(sessionStart + 1).slice(2)}`;

  const canRollover = can(session, 'rollover.execute');
  const canDataRequests = can(session, 'data_request.manage');
  const donationsOn = pack.features.donations;
  const fcra = tenant.fcraRegistered;

  const assets = brandAssets(pack);
  const supplied = assets.filter((x) => x.supplied).length;
  const missing = assets.filter((x) => !x.supplied);
  const modules = moduleCopy(pack);
  const logo = pack.assets.logoPrimary ?? pack.assets.logoMark ?? null;
  const photo = pack.assets.campusPhotos[0] ?? null;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Governance"
        title="College profile"
        description={`What the portal holds about ${pack.copy.shortName}: identity, legal status, structure and modules.`}
        actions={
          <ButtonLink href="/admin/branding" variant="secondary">
            <Palette className="size-4" aria-hidden="true" />
            Edit in Branding
          </ButtonLink>
        }
      />

      {/* ---- 1. Profile --------------------------------------------- */}
      <Section title="Profile">
        <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card>
            <CardBody>
              <dl className="divide-y divide-line">
                <DetailRow label="Institution">{pack.copy.institutionName}</DetailRow>
                <DetailRow label="Short name">{pack.copy.shortName}</DetailRow>
                <DetailRow label="Portal name">{pack.copy.portalName}</DetailRow>
                <DetailRow label="Address">
                  {pack.copy.addressLines.length ? (
                    <span className="block space-y-0.5 font-normal">
                      {pack.copy.addressLines.map((l) => (
                        <span key={l} className="block">
                          {l}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="font-normal text-secondary">Not supplied yet</span>
                  )}
                </DetailRow>
                <DetailRow label="Email">
                  {pack.copy.supportEmail ? (
                    <a href={`mailto:${pack.copy.supportEmail}`} className="link">
                      {pack.copy.supportEmail}
                    </a>
                  ) : (
                    <span className="font-normal text-secondary">Not supplied yet</span>
                  )}
                </DetailRow>
                <DetailRow label="Phone">
                  {pack.copy.supportPhone ?? <span className="font-normal text-secondary">Not supplied yet</span>}
                </DetailRow>
                <DetailRow label="Website">
                  {pack.copy.websiteUrl ? (
                    <a href={pack.copy.websiteUrl} className="link break-all" target="_blank" rel="noreferrer">
                      {pack.copy.websiteUrl.replace(/^https?:\/\//, '')}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    <span className="font-normal text-secondary">Not supplied yet</span>
                  )}
                </DetailRow>
                <DetailRow label="Office">{capitalise(pack.copy.officeName)}</DetailRow>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader variant="stack">
              <CardTitle as="h3">
                Brand assets: {supplied} of {assets.length} supplied
              </CardTitle>
              <Progress
                value={supplied}
                max={assets.length}
                tone={supplied === assets.length ? 'success' : 'brand'}
                label={`Brand assets: ${supplied} of ${assets.length} supplied`}
                className="mt-2"
              />
            </CardHeader>
            <CardBody className="space-y-4">
              {pack.assets.crest || logo || photo ? (
                <div className="grid grid-cols-3 gap-3">
                  {pack.assets.crest ? (
                    <MediaFrame
                      aspect="1/1"
                      caption="Crest"
                      fallback={
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={pack.assets.crest} alt="" className="absolute inset-0 size-full object-contain p-3" />
                      }
                    />
                  ) : null}
                  {logo ? (
                    <MediaFrame
                      aspect="1/1"
                      caption="Logo"
                      fallback={
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logo} alt="" className="absolute inset-0 size-full object-contain p-3" />
                      }
                    />
                  ) : null}
                  {photo ? (
                    <MediaFrame src={photo.src} alt={photo.alt} focus={photo.focus} aspect="1/1" caption="Campus photo" />
                  ) : null}
                </div>
              ) : null}

              {missing.length ? (
                <ul className="divide-y divide-line rounded border border-line bg-surface text-sm">
                  {missing.map((m) => (
                    <li key={m.key} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="font-medium">{m.label}</span>
                      <span className="text-secondary">not supplied yet</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-2 text-sm text-success-fg">
                  <Check className="size-4" aria-hidden="true" />
                  Every identity asset is supplied.
                </p>
              )}

              {missing.length ? (
                <p className="text-sm text-secondary">
                  <span className="font-medium text-primary">Ask the college for </span>
                  {joinList(missing.slice(0, 4).map((m) => m.ask))}
                  {missing.length > 4 ? ', and the rest listed above' : ''}.
                </p>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </Section>

      {/* ---- 2. Compliance ------------------------------------------ */}
      <Section title="Compliance">
        <div className="grid grid-cols-1 gap-gutter lg:grid-cols-2">
          <Card id="fcra" className="scroll-mt-24">
            <CardHeader variant="stack">
              <div className="flex w-full items-start justify-between gap-3">
                <CardTitle as="h3" className="flex items-center gap-2">
                  <Landmark className="size-4 text-secondary" aria-hidden="true" />
                  FCRA registration
                </CardTitle>
                <Badge tone={fcra ? 'success' : 'warning'} dot className="shrink-0 whitespace-nowrap">
                  {fcra ? 'Confirmed' : 'Not confirmed'}
                </Badge>
              </div>
              <CardDescription>Whether the college trust may accept money from outside India.</CardDescription>
            </CardHeader>
            <CardBody>
              <dl className="divide-y divide-line">
                <DetailRow label="What it blocks">
                  <span className="font-normal">
                    {fcra
                      ? donationsOn
                        ? 'Nothing. Foreign gifts are still kept in their own ledger.'
                        : 'Nothing legally; giving is switched off for members.'
                      : 'Giving stays hidden from members, and foreign gifts already on record are held.'}
                  </span>
                </DetailRow>
                <DetailRow label="Giving for members">{donationsOn ? 'On' : 'Off'}</DetailRow>
                <DetailRow label="Registration number">
                  <span className="font-normal text-secondary">{fcra ? 'Not recorded in the portal' : 'Not on file yet'}</span>
                </DetailRow>
                <DetailRow label="FCRA bank account">
                  <span className="font-normal text-secondary">{fcra ? 'Not recorded in the portal' : 'Not on file yet'}</span>
                </DetailRow>
                {!fcra ? (
                  <DetailRow label="Who to ask">
                    <span className="font-normal">
                      The trust office, for the registration certificate and the designated account at SBI, New Delhi
                      Main Branch.
                    </span>
                  </DetailRow>
                ) : null}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader variant="stack">
              <CardTitle as="h3" className="flex items-center gap-2">
                <FileLock2 className="size-4 text-secondary" aria-hidden="true" />
                Personal data
              </CardTitle>
              <CardDescription>What members agreed to, and where their data lives.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
              <dl className="divide-y divide-line">
                <DetailRow label="Privacy notice">
                  Version <span className="tabular">{NOTICE_VERSION}</span>
                </DetailRow>
                <DetailRow label="Data requests">
                  <span className="font-normal">Answered within 30 days of receipt</span>
                </DetailRow>
                <DetailRow label="Stored">
                  <span className="font-normal">In India. Nothing is transferred abroad.</span>
                </DetailRow>
              </dl>
              {canDataRequests || can(session, 'audit.read') ? (
                <div className="flex flex-wrap gap-2">
                  {canDataRequests ? (
                    <ButtonLink href="/admin/data-requests" variant="secondary" size="sm">
                      Data requests
                    </ButtonLink>
                  ) : null}
                  {can(session, 'audit.read') ? (
                    <ButtonLink href="/admin/audit" variant="secondary" size="sm">
                      Audit log
                    </ButtonLink>
                  ) : null}
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </Section>

      {/* ---- 3. Academic structure ---------------------------------- */}
      <Section title="Academic structure">
        <Card>
          <CardBody className="space-y-5">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-secondary">Current session</dt>
                <dd className="mt-1 font-display text-lg font-semibold tabular">{academicYear}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-secondary">Degree register</dt>
                <dd className="mt-1 text-sm">
                  <span className="font-semibold tabular">{formatNumber(register.total)}</span> graduates,{' '}
                  <span className="tabular">{formatNumber(register.claimed)}</span> on the portal
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-secondary">Annual rollover</dt>
                <dd className="mt-1 text-sm">
                  Final-year students become alumni only when it is run by hand, after a dry run.
                  {canRollover ? (
                    <>
                      {' '}
                      <Link href="/admin/rollover" className="link">
                        Open the rollover preview
                      </Link>
                    </>
                  ) : null}
                </dd>
              </div>
            </dl>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">
                {departments.length} {departments.length === 1 ? 'branch' : 'branches'}
              </h4>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {departments.map((d) => (
                  <li key={d.id} className="flex min-w-0 items-baseline gap-2 rounded border border-line bg-surface px-3 py-2 text-sm">
                    <span className="shrink-0 font-semibold">{d.code}</span>
                    <span className="min-w-0 truncate text-secondary" title={d.name}>
                      {d.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

          </CardBody>
        </Card>
      </Section>

      {/* ---- 4. Modules ---------------------------------------------- */}
      <Section title="Modules" description={`Switched on or off for ${pack.copy.shortName} by ${vendorLabel(pack.copy)}.`}>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(Object.keys(modules) as Feature[]).map((key) => {
            const m = modules[key];
            const on = pack.features[key];
            return (
              <li key={key} className="min-w-0">
                <Card className="h-full">
                  <CardBody className="space-y-1.5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="flex items-center gap-2 font-semibold">
                        <span className={on ? 'text-brand-fg' : 'text-secondary'} aria-hidden="true">
                          {m.icon}
                        </span>
                        {m.label}
                      </p>
                      <Badge tone={on ? 'success' : 'neutral'} dot className="shrink-0">
                        {on ? 'On' : 'Off'}
                      </Badge>
                    </div>
                    <p className="text-sm text-secondary">{on ? m.on : m.off}</p>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* ---- 5. For the IT team ------------------------------------- */}
      <Disclosure
        summary={
          <span className="flex items-center gap-2">
            <Server className="size-4 shrink-0 text-brand-fg" aria-hidden="true" />
            Technical details for your IT team
          </span>
        }
      >
        <dl className="grid grid-cols-1 gap-x-10 lg:grid-cols-2 [&>div]:border-b [&>div]:border-line">
          <DetailRow label="Tenant ID">
            <span className="font-mono text-xs">{tenant.id}</span>
          </DetailRow>
          <DetailRow label="Subdomain">
            <span className="font-mono text-xs">{tenant.subdomain}</span>
          </DetailRow>
          <DetailRow label="Brand pack">
            <span className="font-mono text-xs">brands/{tenant.packId ?? 'default'}.json</span>
          </DetailRow>
          <DetailRow label="Plan and status">
            {summary ? `${capitalise(summary.plan)} · ${summary.status}` : 'Standard · active'}
          </DetailRow>
          <DetailRow label="Live since">{summary ? formatDate(summary.createdAt, fmt) : '—'}</DetailRow>
          <DetailRow label="Records held">
            <span className="tabular">
              {formatNumber(summary?.memberCount ?? 0)} members · {formatNumber(register.total)} register rows
            </span>
          </DetailRow>
          <DetailRow label="Database">PostgreSQL, ap-south-1 (Mumbai), backups in the same region</DetailRow>
          <DetailRow label="File storage">Object storage, ap-south-1 (Mumbai), no cross-region copies</DetailRow>
          <DetailRow label="Isolation">
            Row-level security on every table, keyed on <span className="font-mono text-xs">app.tenant_id</span>
          </DetailRow>
          <DetailRow label="Sign-in">
            Email one-time code, {Math.round(OTP_TTL_SECONDS / 60)} minutes, single use, {OTP_MAX_ATTEMPTS} attempts.
            No passwords.
          </DetailRow>
          <DetailRow label="Session cookie">
            <span className="font-mono text-xs">HttpOnly · SameSite=Lax</span>, roles re-read on every request
          </DetailRow>
          <DetailRow label="Consent">Append-only, with the notice version on every entry</DetailRow>
          <DetailRow label="Analytics">None. No advertising pixel or session recorder.</DetailRow>
        </dl>
      </Disclosure>
    </div>
  );
}
