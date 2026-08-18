import type { Session } from './auth/guard';
import { can } from './auth/guard';
import type { BrandPack, Feature } from './branding/pack';

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
  feature?: Feature;
  /** Hard exclusions that no capability can override. See CLAUDE.md. */
  hideForStudents?: boolean;
  badge?: 'connections' | 'verification' | 'notifications';
  description?: string;
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
    label: 'Portal',
    items: [
      { label: 'Home', href: '/dashboard', icon: 'home' },
      { label: 'Directory', href: '/directory', icon: 'users', feature: 'directory', capability: 'directory.search.alumni', description: 'Find alumni by branch, batch, company or city' },
      { label: 'Connections', href: '/connections', icon: 'handshake', feature: 'connections', capability: 'connection.send', badge: 'connections' },
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
    label: 'You',
    items: [
      { label: 'My profile', href: '/profile', icon: 'user' },
      { label: 'Notifications', href: '/notifications', icon: 'bell', badge: 'notifications' },
      { label: 'Settings', href: '/settings', icon: 'settings' },
    ],
  },
];

const ADMIN_NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/admin', icon: 'chart' },
      { label: 'Members', href: '/admin/members', icon: 'users', capability: 'profile.read.any' },
    ],
  },
  {
    label: 'Identity',
    items: [
      { label: 'Verification queue', href: '/admin/verification', icon: 'file-check', capability: 'verification.review.department', badge: 'verification' },
      { label: 'Degree register', href: '/admin/degree-register', icon: 'scroll', capability: 'verification.review.any' },
      { label: 'Imports', href: '/admin/imports', icon: 'upload', capability: 'verification.review.any' },
      { label: 'Roles', href: '/admin/roles', icon: 'shield', capability: 'role.manage' },
      { label: 'Annual rollover', href: '/admin/rollover', icon: 'refresh', capability: 'rollover.execute' },
    ],
  },
  {
    label: 'Engagement',
    items: [
      { label: 'Events', href: '/admin/events', icon: 'calendar', capability: 'event.create.department', feature: 'events' },
      { label: 'Jobs', href: '/admin/jobs', icon: 'briefcase', capability: 'job.moderate', feature: 'jobs' },
      { label: 'Communications', href: '/admin/comms', icon: 'megaphone', capability: 'comms.send.department' },
      { label: 'Gallery', href: '/admin/gallery', icon: 'image', capability: 'event.create.any', feature: 'gallery' },
      { label: 'News', href: '/admin/news', icon: 'newspaper', capability: 'comms.send.segment', feature: 'news' },
      { label: 'Giving', href: '/admin/giving', icon: 'heart', capability: 'donation.report', feature: 'donations' },
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
      { label: 'Tenants', href: '/platform', icon: 'building', capability: 'tenant.provision' },
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
        return true;
      }),
    }))
    .filter((g) => g.items.length > 0);
}

export function memberNav(session: Session, pack: BrandPack): NavGroup[] {
  return visible(MEMBER_NAV, session, pack);
}

export function adminNav(session: Session, pack: BrandPack): NavGroup[] {
  return visible(ADMIN_NAV, session, pack);
}

export function platformNav(session: Session, pack: BrandPack): NavGroup[] {
  return visible(PLATFORM_NAV, session, pack);
}

/** True when the viewer has any staff-side surface at all. */
export function hasAdminAccess(session: Session, pack: BrandPack): boolean {
  return adminNav(session, pack).length > 0;
}

export function hasPlatformAccess(session: Session): boolean {
  return can(session, 'tenant.provision');
}

/** The label a role wears in the UI. Order matters — the first wins. */
export const ROLE_LABELS: Record<string, string> = {
  platform_admin: 'Platform admin',
  college_admin: 'College admin',
  alumni_cell_operator: 'Alumni cell',
  placement_officer: 'Placement officer',
  hod: 'Head of department',
  finance: 'Finance',
  faculty: 'Faculty',
  alumni: 'Alumnus',
  student: 'Student',
};

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
