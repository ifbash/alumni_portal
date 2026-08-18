import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getTenantBrand } from '@/lib/tenant';
import {
  memberNav,
  adminNav,
  platformNav,
  hasAdminAccess,
  hasPlatformAccess,
  primaryRole,
  type NavGroup,
} from '@/lib/navigation';
import {
  getConnections,
  getNotifications,
  getVerificationClaims,
  findMemberById,
  getDepartments,
  getStats,
} from '@/lib/data/repo';
import { PaletteMount } from '@/components/directory/PaletteMount';
import { can } from '@/lib/auth/guard';
import { Logo } from '@/components/brand/Logo';
import { SidebarNav } from './SidebarNav';
import { TopBar } from './TopBar';
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

  const badges: Record<string, number> = {
    connections: getConnections(session, 'received').filter((c) => c.state === 'pending').length,
  };
  if (can(session, 'verification.review.department')) {
    badges.verification = getVerificationClaims(session, { status: 'queued' }).length;
  }

  const notifications = getNotifications(session);
  const adminHref = variant === 'member' && hasAdminAccess(session, pack) ? '/admin' : null;

  const homeHref = variant === 'member' ? '/dashboard' : variant === 'admin' ? '/admin' : '/platform';

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Desktop sidebar. Hidden below lg, where TopBar owns navigation. */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface-raised lg:flex">
        <div className="flex h-14 items-center border-b border-line px-5">
          <Link href={homeHref} className="link-quiet">
            <Logo pack={pack} height={26} />
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-5">
          <SidebarNav groups={groups} badges={badges} />

          {variant !== 'member' ? (
            <div className="mt-6 border-t border-line pt-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded px-3 py-2 text-sm font-medium text-secondary hover:bg-surface-sunken hover:text-primary"
              >
                ← Back to the portal
              </Link>
            </div>
          ) : null}
        </div>

        <div className="border-t border-line px-5 py-4">
          <PoweredBy pack={pack} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          groups={groups}
          badges={badges}
          notifications={notifications}
          user={{
            name: member?.fullName ?? 'Member',
            role: primaryRole(session),
            photoUrl: member?.photoUrl ?? null,
          }}
          adminHref={adminHref}
          logo={<Logo pack={pack} height={24} />}
          showSearch={variant === 'member' && pack.features.directory}
        />

        <main id="main" className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-page">{children}</div>
        </main>

        {/*
          Ctrl/⌘-K. Everything it can reach was filtered by the capability
          matrix here, on the server — the client component receives a list
          and never asks what the viewer may see.
        */}
        {pack.features.directory && can(session, 'directory.search.alumni') ? (
          <PaletteMount
            groups={groups}
            departments={getDepartments().map((d) => ({ code: d.code, name: d.name }))}
            batches={getStats(session).batchDistribution}
          />
        ) : null}
      </div>
    </div>
  );
}
