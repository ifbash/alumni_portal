import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getTenantBrand } from '@/lib/tenant';
import {
  memberNav,
  adminNav,
  platformNav,
  hasPlatformAccess,
  hasStaffConsole,
  isVendorOnlySession,
  mobileTabs,
  type NavGroup,
  type NavItem,
} from '@/lib/navigation';
import {
  getConnections,
  getNotifications,
  getVerificationClaims,
  getDataRequests,
  findMemberById,
  getDepartments,
  getEvents,
  getStats,
} from '@/lib/data/repo';
import { PaletteMount } from '@/components/directory/PaletteMount';
import { dueStatus } from '@/app/(admin)/admin/data-requests/dpdp';
import { can } from '@/lib/auth/guard';
import { identityLine, viewerBatchYear, viewerBranch } from '@/lib/identity';
import { formatRelative } from '@/lib/format';
import { getHouseBrand } from '@/lib/branding/resolve';
import { densityCss } from '@/lib/branding/tokens';
import { Logo } from '@/components/brand/Logo';
import { Crest } from '@/components/brand/Crest';
import { SidebarNav } from './SidebarNav';
import { ShellIdentity, TopBar } from './TopBar';
import { MobileTabBar, type MobileTab } from './MobileTabBar';
import { DemoRibbon } from './DemoRibbon';
import { PoweredBy } from './PoweredBy';

/**
 * The signed-in frame.
 *
 * Resolves the session, the tenant's brand and the viewer's navigation on
 * the server, then renders the chrome around whatever the page returns.
 * Pages never build their own header, sidebar or footer, so a change to
 * the shell is one file rather than forty.
 *
 * `variant` picks which navigation tree is shown. It does not grant
 * anything: the admin nav is empty for a member, and every admin route
 * guards itself again server-side.
 *
 * The college appears here in one place: the band at the top of the
 * sidebar (and of the phone drawer). Everything else in the frame is plain
 * work surface. The platform variant is the vendor's own tool, so it wears
 * the house pack instead, for the whole document.
 */
export async function AppShell({
  children,
  variant = 'member',
}: {
  children: React.ReactNode;
  variant?: 'member' | 'admin' | 'platform';
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) redirect('/login');

  const { brand } = resolved;
  const pack = brand.pack;
  const member = findMemberById(session.memberId);

  const groups: NavGroup[] =
    variant === 'admin'
      ? adminNav(session, pack)
      : variant === 'platform'
        ? platformNav(session, pack)
        : memberNav(session, pack);

  // A staff member who lands on /admin with no admin capabilities gets
  // sent back rather than shown an empty console.
  if (variant === 'admin' && groups.length === 0) redirect('/dashboard');
  if (variant === 'platform' && !hasPlatformAccess(session)) redirect('/dashboard');

  // Every role is `platform_admin`: the vendor, and nobody else. The route
  // policy decides which member pages it may open (its own profile and
  // settings); the shell only stops offering doors that would bounce.
  const vendorOnly = isVendorOnlySession(session);
  const platformAccess = hasPlatformAccess(session);

  // The platform console is the vendor's own tool and wears the house
  // brand. Tenant resolution does not change: the house tokens are emitted
  // after the tenant's head style, with the same selectors, so they win for
  // the whole document, overlay portals and toasts included.
  const house = variant === 'platform' ? await getHouseBrand() : null;
  const identityPack = house?.pack ?? pack;

  const homeHref =
    variant === 'admin'
      ? '/admin'
      : variant === 'platform'
        ? '/platform'
        : vendorOnly
          ? platformAccess
            ? '/platform'
            : '/profile'
          : '/dashboard';

  const notifications = vendorOnly ? [] : getNotifications(session);
  const unread = notifications.filter((n) => !n.readAt).length;

  const badges: Record<string, number> = {
    connections: vendorOnly
      ? 0
      : getConnections(session, 'received').filter((c) => c.state === 'pending').length,
    notifications: unread,
  };
  // Behind the same capabilities the queue page admits. The read itself
  // returns every claim to a viewer holding neither, so the gate is here.
  if (can(session, 'verification.review.any') || can(session, 'verification.review.department')) {
    badges.verification = getVerificationClaims(session, { status: 'queued' }).length;
  }
  // Overdue statutory requests, behind the queue's own capability. Keyed by
  // href: the pill says "overdue", in the danger tone, so it is seen even
  // when the Governance group is scrolled out of a short laptop screen.
  if (variant === 'admin' && can(session, 'data_request.manage')) {
    badges['overdue:/admin/data-requests'] = getDataRequests().filter((r) => dueStatus(r).overdue).length;
  }

  const departments = getDepartments();
  const branch = viewerBranch(session);

  // In the staff console a person is introduced by the job they are doing
  // there: the Dean reads "Dean, Alumni Relations", not her own batch, and
  // an operator's department is her grant's, never the branch she
  // graduated from. In the member portal the same person is an alumna.
  const staffRoles = session.roles.filter((r) => r.role !== 'alumni' && r.role !== 'student');
  const identityRoles = variant !== 'member' && staffRoles.length > 0 ? staffRoles : session.roles;
  const identityBranch = viewerBranch({ roles: identityRoles, departmentId: session.departmentId });
  const identity = identityLine({
    roles: identityRoles,
    departmentCode: identityBranch,
    departmentName: departments.find((d) => d.code === identityBranch)?.name ?? null,
    batchYear: viewerBatchYear({ roles: identityRoles, batchYear: session.batchYear }),
    designation: member?.designation ?? null,
    isStudent: variant === 'member' && (member?.isStudent ?? false),
  });

  const directoryOn = pack.features.directory;
  // The palette's own mount gate (below). The trigger shows exactly where
  // the palette exists, so nobody is offered a search they cannot run.
  const paletteMounted = pack.features.directory && can(session, 'directory.search.alumni');
  const showSearch = variant !== 'platform' && paletteMounted;

  const locale = pack.locale.locale;
  const timeZone = pack.locale.timeZone;

  const upcoming =
    paletteMounted && pack.features.events && can(session, 'event.register')
      ? getEvents(session, { when: 'upcoming' })[0] ?? null
      : null;
  const nextEvent = upcoming
    ? {
        title: upcoming.title,
        slug: upcoming.slug,
        startsAt: upcoming.startsAt,
        // Formatted here, in the college's time zone, so the server and the
        // browser render the same words.
        when: new Intl.DateTimeFormat(locale, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          timeZone,
        }).format(new Date(upcoming.startsAt)),
      }
    : null;

  const line2 =
    variant === 'member'
      ? pack.copy.institutionName
      : variant === 'admin'
        ? 'Staff console'
        : 'Platform';
  const tone = variant === 'member' ? 'member' : 'console';
  const homeLabel = `${identityPack.copy.portalName}, home`;

  // Phone tab bar: members only, never the vendor.
  const showTabBar = variant === 'member' && !vendorOnly;
  const tabs: MobileTab[] = showTabBar
    ? mobileTabs(groups, session)
        .map((href) => groups.flatMap((g) => g.items).find((i) => i.href === href))
        .filter((i): i is NavItem => Boolean(i))
        .map((i) => ({
          href: i.href,
          label: i.label,
          icon: i.icon,
          dot: i.badge ? (badges[i.badge] ?? 0) > 0 : false,
          count: i.badge ? (badges[i.badge] ?? 0) : 0,
        }))
    : [];

  const poweredBy = <PoweredBy pack={identityPack} />;

  // Sidebar foot: one way out, then the vendor credit.
  const foot =
    variant === 'member' ? (
      pack.copy.websiteUrl ? (
        <a
          href={pack.copy.websiteUrl}
          target="_blank"
          rel="noreferrer noopener"
          className={FOOT_LINK}
        >
          <ExternalLink className="size-4 shrink-0 text-muted" aria-hidden="true" />
          <span>{pack.copy.shortName} website</span>
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ) : null
    ) : variant === 'admin' ? (
      <Link href={vendorOnly ? '/platform' : '/dashboard'} className={FOOT_LINK}>
        <ArrowLeft className="size-4 shrink-0 text-muted" aria-hidden="true" />
        {vendorOnly ? 'Back to the platform' : 'Back to the portal'}
      </Link>
    ) : !vendorOnly ? (
      <Link href="/dashboard" className={FOOT_LINK}>
        <ArrowLeft className="size-4 shrink-0 text-muted" aria-hidden="true" />
        Back to the portal
      </Link>
    ) : null;

  return (
    <div className={showTabBar ? 'has-tabbar flex min-h-dvh flex-col lg:flex-row' : 'flex min-h-dvh flex-col lg:flex-row'}>
      {house ? (
        <>
          <style id="house-brand" dangerouslySetInnerHTML={{ __html: house.css }} />
          {house.fontHref ? <link rel="stylesheet" href={house.fontHref} /> : null}
        </>
      ) : null}
      {variant === 'admin' ? (
        // Dense desk work at lg+; phones keep the comfortable 44px targets.
        <style dangerouslySetInnerHTML={{ __html: densityCss('compact', '.console-density', 1024) }} />
      ) : null}

      {/* Desktop sidebar. Hidden below lg, where the drawer owns navigation. */}
      <aside
        aria-label="Sidebar"
        data-print-hide=""
        className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface-raised lg:flex"
      >
        <div className="band-surface px-5 py-4">
          <ShellIdentity
            href={homeHref}
            label={homeLabel}
            crest={<Crest pack={identityPack} size={36} />}
            logo={<Logo pack={identityPack} variant="band" height={22} />}
            line2={line2}
            tone={tone}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-3 pt-5">
          <SidebarNav groups={groups} badges={badges} compact={variant === 'admin'} />
          {/* A fade at the foot of the list says it scrolls. It sits in the
              list's own bottom padding, so at the end it covers nothing. */}
          <div
            aria-hidden="true"
            className="pointer-events-none sticky bottom-0 -mx-3 h-6 bg-gradient-to-t from-[var(--surface-raised)] to-transparent"
          />
        </div>

        <div className="space-y-2 border-t border-line px-5 py-4">
          {foot}
          {poweredBy}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          groups={groups}
          badges={badges}
          notifications={notifications.map((n) => ({
            ...n,
            ago: formatRelative(n.createdAt, { locale, timeZone }),
          }))}
          user={{
            name: member?.fullName ?? 'Member',
            identity,
            photoUrl: member?.photoUrl ?? null,
          }}
          brand={{
            homeHref,
            homeLabel,
            line2,
            tone,
            logo: <Logo pack={identityPack} height={22} />,
            bandLogo: <Logo pack={identityPack} variant="band" height={22} />,
            crestSmall: <Crest pack={identityPack} size={28} />,
            crestLarge: <Crest pack={identityPack} size={40} />,
            poweredBy,
          }}
          showSearch={showSearch}
          showBell={!vendorOnly}
          links={{
            preview: directoryOn && !vendorOnly,
            notifications: !vendorOnly,
            console: variant === 'member' && hasStaffConsole(session, pack),
            portal: variant !== 'member' && !vendorOnly,
            platform: variant !== 'platform' && platformAccess,
          }}
          demo={<DemoRibbon />}
        />

        <main
          id="main"
          className={
            showTabBar
              ? 'flex-1 px-4 pb-[calc(var(--shell-tabbar-h)+1.5rem)] pt-6 lg:px-8 lg:pb-8 lg:pt-8'
              : 'flex-1 px-4 py-6 lg:px-8 lg:py-8'
          }
        >
          <div className={variant === 'admin' ? 'console-density mx-auto w-full max-w-page' : 'mx-auto w-full max-w-page'}>
            {children}
          </div>
        </main>

        {showTabBar && tabs.length > 0 ? <MobileTabBar tabs={tabs} /> : null}

        {/*
          Ctrl/⌘-K. Everything it can reach was filtered by the capability
          matrix here, on the server — the client component receives a list
          and never asks what the viewer may see.
        */}
        {pack.features.directory && can(session, 'directory.search.alumni') ? (
          <PaletteMount
            groups={groups}
            departments={departments.map((d) => ({ code: d.code, name: d.name }))}
            batches={getStats(session).batchDistribution}
            viewer={{ batchYear: viewerBatchYear(session), departmentCode: branch }}
            nextEvent={nextEvent}
          />
        ) : null}
      </div>
    </div>
  );
}

const FOOT_LINK =
  '-mx-2 flex min-h-11 items-center gap-2 rounded px-2 text-sm font-medium text-secondary transition-colors duration-fast ease-brand hover:bg-surface-sunken hover:text-primary';
