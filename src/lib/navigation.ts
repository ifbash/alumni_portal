import type { Session } from './auth/guard';
import { can } from './auth/guard';
import type { Capability } from './auth/permissions';
import { isVendorOnly } from './auth/route-policy';
import type { BrandPack, Feature } from './branding/pack';
import { ROLE_LABELS } from './identity';

/**
 * Navigation is derived from capabilities, never hand-maintained per role.
 *
 * A link that renders but 403s on click is worse than no link: it teaches
 * users that half the portal is broken. Every item declares the
 * capability it needs and the feature flag it belongs to, and the menu is
 * the filtered result. Adding a role means editing the capability matrix
 * in `auth/permissions.ts` — the navigation follows automatically.
 *
 * The reverse is not true and must not be: hiding a link is presentation,
 * not authorisation. Every route still guards itself server-side.
 */

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
  /** Omitted means "any signed-in member". */
  capability?: Parameters<typeof can>[1];
  /**
   * Visible when the viewer holds any one of these. Mirrors a page whose
   * own guard accepts several capabilities (the verification queue takes
   * `.any` or `.department`), so the link shows for exactly the people the
   * page admits. Display only: the page still guards itself.
   */
  anyOf?: Capability[];
  feature?: Feature;
  /** Hard exclusions that no capability can override. See CLAUDE.md. */
  hideForStudents?: boolean;
  badge?: 'connections' | 'verification' | 'notifications';
  description?: string;
  /** A short qualifier rendered after the label, e.g. "Members off". */
  tag?: string;
}

export type IconName =
  | 'home' | 'users' | 'handshake' | 'calendar' | 'briefcase' | 'heart'
  | 'user' | 'settings' | 'shield' | 'upload' | 'megaphone' | 'palette'
  | 'scroll' | 'building' | 'graduation' | 'refresh' | 'file-check' | 'chart'
  | 'newspaper' | 'image' | 'bell' | 'clipboard';

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const MEMBER_NAV: NavGroup[] = [
  {
    // Relabelled per college in `memberNav`: "{shortName} community".
    label: 'Portal',
    items: [
      { label: 'Home', href: '/dashboard', icon: 'home' },
      {
        label: 'Directory',
        href: '/directory',
        icon: 'users',
        feature: 'directory',
        // The same two capabilities `directory/page.tsx` admits: faculty
        // and HODs who search students only still have a directory.
        anyOf: ['directory.search.alumni', 'directory.search.students'],
        description: 'Find alumni by branch, batch, company or city',
      },
      { label: 'Requests', href: '/connections', icon: 'handshake', feature: 'connections', capability: 'connection.send', badge: 'connections' },
      { label: 'Mentorship', href: '/mentorship', icon: 'graduation', feature: 'mentorship', capability: 'connection.send', description: 'Alumni who have agreed to be asked' },
      { label: 'Events', href: '/events', icon: 'calendar', feature: 'events', capability: 'event.register' },
      { label: 'Jobs', href: '/jobs', icon: 'briefcase', feature: 'jobs' },
      { label: 'News', href: '/news', icon: 'newspaper', feature: 'news' },
      { label: 'Gallery', href: '/gallery', icon: 'image', feature: 'gallery' },
      {
        label: 'Giving',
        href: '/giving',
        icon: 'heart',
        feature: 'donations',
        capability: 'donation.give',
        // Students never see the donations module. Not a preference —
        // asking a final-year for money on the portal that is meant to
        // help them find work poisons the whole product.
        hideForStudents: true,
      },
    ],
  },
  {
    label: 'Your account',
    items: [
      { label: 'My profile', href: '/profile', icon: 'user' },
      { label: 'Notifications', href: '/notifications', icon: 'bell', badge: 'notifications' },
      { label: 'Settings', href: '/settings', icon: 'settings' },
    ],
  },
];

/**
 * What a vendor-only session (every role is `platform_admin`) may open in
 * the member shell: its own record and its own settings. Mirrors the
 * route policy, which refuses the vendor every other member surface
 * (route-policy.ts, `refuseVendorOnly`). The policy is the gate; this
 * only stops the menu offering doors that redirect.
 */
const VENDOR_MEMBER_HREFS = new Set(['/profile', '/settings']);

const ADMIN_NAV: NavGroup[] = [
  {
    label: 'Today',
    items: [
      { label: 'Today', href: '/admin', icon: 'chart' },
      { label: 'Members', href: '/admin/members', icon: 'users', capability: 'profile.read.any' },
    ],
  },
  {
    label: 'People and records',
    items: [
      {
        label: 'Verification queue',
        href: '/admin/verification',
        icon: 'file-check',
        // `verification/page.tsx` admits either; the operator and the
        // college admin hold `.any` and never saw this link before.
        anyOf: ['verification.review.any', 'verification.review.department'],
        badge: 'verification',
      },
      { label: 'Degree register', href: '/admin/degree-register', icon: 'scroll', capability: 'verification.review.any' },
      { label: 'Imports', href: '/admin/imports', icon: 'upload', capability: 'verification.review.any' },
      { label: 'Roles', href: '/admin/roles', icon: 'shield', capability: 'role.manage' },
      { label: 'Annual rollover', href: '/admin/rollover', icon: 'refresh', capability: 'rollover.execute' },
    ],
  },
  {
    label: 'Engagement',
    items: [
      {
        label: 'Events',
        href: '/admin/events',
        icon: 'calendar',
        // Mirrors `events/page.tsx`: college-wide or department organisers.
        anyOf: ['event.create.any', 'event.create.department'],
        feature: 'events',
      },
      { label: 'Jobs', href: '/admin/jobs', icon: 'briefcase', capability: 'job.moderate', feature: 'jobs' },
      {
        label: 'Messages',
        href: '/admin/comms',
        icon: 'megaphone',
        // Mirrors `comms/page.tsx`: any tier of sending.
        anyOf: ['comms.send.all', 'comms.send.segment', 'comms.send.department'],
      },
      { label: 'Gallery', href: '/admin/gallery', icon: 'image', capability: 'event.create.any', feature: 'gallery' },
      { label: 'News', href: '/admin/news', icon: 'newspaper', capability: 'comms.send.segment', feature: 'news' },
      // No feature flag: the console page guards only `donation.report`
      // (`giving/page.tsx`), because finance reconciles the ledger whether
      // or not members can give today. `adminNav` tags it "Members off"
      // when the member-facing module is switched off.
      { label: 'Giving', href: '/admin/giving', icon: 'heart', capability: 'donation.report' },
    ],
  },
  {
    label: 'Reporting',
    items: [
      {
        label: 'Accreditation',
        href: '/admin/reports',
        icon: 'clipboard',
        capability: 'audit.read',
        description: 'NAAC criterion 5, NIRF graduation outcomes',
      },
    ],
  },
  {
    label: 'Governance',
    items: [
      { label: 'Audit log', href: '/admin/audit', icon: 'scroll', capability: 'audit.read' },
      { label: 'Data requests', href: '/admin/data-requests', icon: 'file-check', capability: 'data_request.manage' },
      { label: 'Branding', href: '/admin/branding', icon: 'palette', capability: 'tenant.configure' },
      { label: 'Settings', href: '/admin/settings', icon: 'settings', capability: 'tenant.configure' },
    ],
  },
];

const PLATFORM_NAV: NavGroup[] = [
  {
    label: 'Platform',
    items: [
      { label: 'Colleges', href: '/platform', icon: 'building', capability: 'tenant.provision' },
      { label: 'Brand packs', href: '/platform/brands', icon: 'palette', capability: 'tenant.provision' },
    ],
  },
];

function visible(groups: NavGroup[], session: Session, pack: BrandPack): NavGroup[] {
  const isStudent = session.roles.some((r) => r.role === 'student');

  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        if (item.hideForStudents && isStudent) return false;
        if (item.feature && !pack.features[item.feature]) return false;
        if (item.capability && !can(session, item.capability)) return false;
        if (item.anyOf && !item.anyOf.some((c) => can(session, c))) return false;
        return true;
      }),
    }))
    .filter((g) => g.items.length > 0);
}

/** True when every role the session holds is `platform_admin`: the vendor, and nobody else. */
export function isVendorOnlySession(session: Session): boolean {
  return isVendorOnly({ status: session.status, roles: session.roles.map((r) => r.role) });
}

export function memberNav(session: Session, pack: BrandPack): NavGroup[] {
  if (isVendorOnlySession(session)) {
    return visible(MEMBER_NAV, session, pack)
      .map((g) => ({ ...g, items: g.items.filter((i) => VENDOR_MEMBER_HREFS.has(i.href)) }))
      .filter((g) => g.items.length > 0);
  }

  const community = MEMBER_NAV[0]!.label;
  return visible(MEMBER_NAV, session, pack).map((g) =>
    g.label === community ? { ...g, label: `${pack.copy.shortName} community` } : g,
  );
}

export function adminNav(session: Session, pack: BrandPack): NavGroup[] {
  const donationsOff = !pack.features.donations;
  return visible(ADMIN_NAV, session, pack).map((g) => ({
    ...g,
    items: g.items.map((i) => (i.href === '/admin/giving' && donationsOff ? { ...i, tag: 'Members off' } : i)),
  }));
}

export function platformNav(session: Session, pack: BrandPack): NavGroup[] {
  return visible(PLATFORM_NAV, session, pack);
}

/**
 * Whether any navigation tree would offer this viewer a link to `href`.
 *
 * Display only, never a guard, never a gate for a data read. It answers
 * "should this page show a link there", so a page does not offer a door
 * the menu would not. Whether the viewer may *read* anything is still the
 * capability check next to the read, and whether they may open the page
 * is still the page's own guard.
 */
export function canOpen(session: Session, pack: BrandPack, href: string): boolean {
  return [memberNav(session, pack), adminNav(session, pack), platformNav(session, pack)].some((tree) =>
    tree.some((g) => g.items.some((i) => i.href === href)),
  );
}

/** True when the viewer has any staff-side surface at all. */
export function hasAdminAccess(session: Session, pack: BrandPack): boolean {
  return adminNav(session, pack).length > 0;
}

/**
 * True when the staff console holds anything for this viewer beyond its
 * own front page. `hasAdminAccess` is true for every session, because the
 * console's "Today" item needs no capability; this is the question the
 * account menu actually asks before offering "Staff console".
 */
export function hasStaffConsole(session: Session, pack: BrandPack): boolean {
  return adminNav(session, pack).some((g) => g.items.some((i) => i.href !== '/admin'));
}

export function hasPlatformAccess(session: Session): boolean {
  return can(session, 'tenant.provision');
}

const STUDENT_TABS = ['/dashboard', '/mentorship', '/connections', '/jobs'];
const MEMBER_TABS = ['/dashboard', '/directory', '/connections', '/events'];

/**
 * The four destinations of the phone tab bar (the fifth slot is "More").
 *
 * Students get Home, Mentorship, Requests and Jobs; everyone else Home,
 * Directory, Requests and Events. A preferred tab the viewer's nav does
 * not have is replaced by the next item of their nav, in nav order, so
 * the bar never offers a door the sidebar would not. Vendor-only sessions
 * get no tab bar at all.
 */
export function mobileTabs(groups: NavGroup[], session: Session): string[] {
  if (isVendorOnlySession(session)) return [];

  const isStudent = session.roles.some((r) => r.role === 'student');
  const all = groups.flatMap((g) => g.items.map((i) => i.href));
  const present = new Set(all);

  const tabs = (isStudent ? STUDENT_TABS : MEMBER_TABS).filter((h) => present.has(h));
  for (const href of all) {
    if (tabs.length >= 4) break;
    if (!tabs.includes(href)) tabs.push(href);
  }
  return tabs.slice(0, 4);
}

export { ROLE_LABELS };

const ROLE_PRIORITY = [
  'platform_admin', 'college_admin', 'alumni_cell_operator', 'placement_officer',
  'hod', 'finance', 'faculty', 'alumni', 'student',
];

/** The single role to show next to a name, when there is only room for one. */
export function primaryRole(session: Session): string {
  const held = new Set(session.roles.map((r) => r.role as string));
  const top = ROLE_PRIORITY.find((r) => held.has(r));
  return top ? (ROLE_LABELS[top] ?? top) : 'Member';
}
