import { describe, expect, it } from 'vitest';
import { can, type Session } from '@/lib/auth/guard';
import type { Capability } from '@/lib/auth/permissions';
import { mergePack } from '@/lib/branding/pack';
import { PACKS } from '@/lib/branding/registry';
import { findMemberById } from '@/lib/data/repo';
import { SEED } from '@/lib/data/seed';
import {
  adminNav,
  canOpen,
  hasAdminAccess,
  hasStaffConsole,
  isVendorOnlySession,
  memberNav,
  mobileTabs,
  platformNav,
  type NavGroup,
} from '@/lib/navigation';

/**
 * The navigation, for all nine demo accounts.
 *
 * Navigation is display: every route guards itself. What these pin is
 * that the menu offers exactly the doors the pages behind them admit — a
 * link that 403s teaches people the portal is broken, and a queue nobody
 * can find does not get worked.
 */

const diet = PACKS.diet!;

function sessionFor(email: string): Session {
  const account = SEED.demoAccounts.find((a) => a.email === email);
  if (!account) throw new Error(`No demo account for ${email}`);
  const member = findMemberById(account.memberId)!;
  return {
    memberId: member.id,
    tenantId: 'ten-diet',
    status: member.status,
    roles: member.roles.map((r) => ({ role: r.role, departmentId: r.departmentCode })),
    departmentId: member.departmentCode,
    batchYear: member.batchYear,
  };
}

const EMAIL = {
  student: 'student@diet.ac.in',
  alumni: 'alumni@example.com',
  faculty: 'faculty.ece@diet.ac.in',
  hod: 'hod.cse@diet.ac.in',
  tpo: 'tpo@diet.ac.in',
  operator: 'alumnicell@diet.ac.in',
  finance: 'finance@diet.ac.in',
  admin: 'admin@diet.ac.in',
  platform: 'platform@ifbash.com',
} as const;

type Who = keyof typeof EMAIL;
const ALL = Object.keys(EMAIL) as Who[];
const s = (who: Who) => sessionFor(EMAIL[who]);

const hrefs = (groups: NavGroup[]) => groups.flatMap((g) => g.items.map((i) => i.href));
const item = (groups: NavGroup[], href: string) => groups.flatMap((g) => g.items).find((i) => i.href === href);

describe('any-of items', () => {
  const cases: Array<{ tree: 'member' | 'admin'; href: string; anyOf: Capability[] }> = [
    { tree: 'member', href: '/directory', anyOf: ['directory.search.alumni', 'directory.search.students'] },
    { tree: 'admin', href: '/admin/verification', anyOf: ['verification.review.any', 'verification.review.department'] },
    { tree: 'admin', href: '/admin/events', anyOf: ['event.create.any', 'event.create.department'] },
    { tree: 'admin', href: '/admin/comms', anyOf: ['comms.send.all', 'comms.send.segment', 'comms.send.department'] },
  ];

  it.each(ALL)('are visible to %s exactly when a listed capability is held', (who) => {
    const session = s(who);
    for (const c of cases) {
      const tree = c.tree === 'member' ? memberNav(session, diet) : adminNav(session, diet);
      const held = c.anyOf.some((cap) => can(session, cap));
      expect(hrefs(tree).includes(c.href), `${who} · ${c.href}`).toBe(held);
    }
  });

  it('show the operator and the college admin Verification, Events and Messages', () => {
    for (const who of ['operator', 'admin'] as const) {
      const nav = hrefs(adminNav(s(who), diet));
      expect(nav, who).toEqual(expect.arrayContaining(['/admin/verification', '/admin/events', '/admin/comms']));
    }
  });

  it('show the placement officer Messages but not Verification', () => {
    const nav = hrefs(adminNav(s('tpo'), diet));
    expect(nav).toContain('/admin/comms');
    expect(nav).not.toContain('/admin/verification');
  });

  it('show the HOD the verification queue their department scope admits', () => {
    expect(hrefs(adminNav(s('hod'), diet))).toContain('/admin/verification');
  });
});

describe('students', () => {
  it('never see Giving, even on a college that has switched donations on', () => {
    const givingOn = mergePack(diet, { features: { donations: true } });
    for (const pack of [diet, givingOn]) {
      expect(hrefs(memberNav(s('student'), pack))).not.toContain('/giving');
      expect(hrefs(adminNav(s('student'), pack))).not.toContain('/admin/giving');
    }
    // The control: an alumnus does see it once the college turns it on.
    expect(hrefs(memberNav(s('alumni'), givingOn))).toContain('/giving');
  });

  it('get a tab bar that includes Requests', () => {
    const session = s('student');
    const tabs = mobileTabs(memberNav(session, diet), session);
    expect(tabs).toContain('/connections');
    expect(tabs).toHaveLength(4);
    expect(tabs[0]).toBe('/dashboard');
  });
});

describe('the vendor', () => {
  it('is recognised as a vendor-only session, and nobody else is', () => {
    for (const who of ALL) expect(isVendorOnlySession(s(who)), who).toBe(who === 'platform');
  });

  it('is offered only its own profile and settings in the member shell', () => {
    const nav = memberNav(s('platform'), diet);
    expect(hrefs(nav)).toEqual(['/profile', '/settings']);
    expect(nav.flatMap((g) => g.items).map((i) => i.label)).toEqual(['My profile', 'Settings']);
  });

  it('gets no phone tab bar', () => {
    const session = s('platform');
    expect(mobileTabs(memberNav(session, diet), session)).toEqual([]);
  });

  it('manages colleges, never "tenants"', () => {
    expect(item(platformNav(s('platform'), diet), '/platform')?.label).toBe('Colleges');
  });
});

describe('console access', () => {
  it('leaves hasAdminAccess as it was: true for every demo account', () => {
    // The console's front page needs no capability, so this has always been
    // true for everyone; the middleware is the real gate. It must not move.
    for (const who of ALL) expect(hasAdminAccess(s(who), diet), who).toBe(true);
  });

  it('offers the staff console only to people it has something for', () => {
    const expected: Record<Who, boolean> = {
      student: false,
      alumni: false,
      faculty: false,
      hod: true,
      tpo: true,
      operator: true,
      finance: true,
      admin: true,
      platform: true,
    };
    for (const who of ALL) expect(hasStaffConsole(s(who), diet), who).toBe(expected[who]);
  });

  it('lets finance open the console Giving page while member giving is off, tagged as such', () => {
    expect(diet.features.donations).toBe(false);
    expect(canOpen(s('finance'), diet, '/admin/giving')).toBe(true);
    expect(item(adminNav(s('finance'), diet), '/admin/giving')?.tag).toBe('Members off');

    const givingOn = mergePack(diet, { features: { donations: true } });
    expect(item(adminNav(s('finance'), givingOn), '/admin/giving')?.tag).toBeUndefined();
  });

  it('never offers a door the trees do not', () => {
    expect(canOpen(s('student'), diet, '/admin/giving')).toBe(false);
    expect(canOpen(s('platform'), diet, '/directory')).toBe(false);
    expect(canOpen(s('alumni'), diet, '/directory')).toBe(true);
  });
});

describe('names', () => {
  it('say the college, Requests, Your account, Today and Messages', () => {
    const member = memberNav(s('alumni'), diet);
    expect(member[0]!.label).toBe(`${diet.copy.shortName} community`);
    expect(member.map((g) => g.label)).toContain('Your account');
    expect(item(member, '/connections')?.label).toBe('Requests');

    const admin = adminNav(s('admin'), diet);
    expect(admin[0]!.label).toBe('Today');
    expect(item(admin, '/admin')?.label).toBe('Today');
    expect(admin.map((g) => g.label)).toContain('People and records');
    expect(item(admin, '/admin/comms')?.label).toBe('Messages');
  });
});
