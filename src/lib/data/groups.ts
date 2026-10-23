import { can, type Session } from '../auth/guard';
import { findMemberById, projectMemberSummary } from './repo';
import { GROUPS, GROUP_MEMBERSHIPS, type GroupMembershipRecord, type GroupRecord } from './seed-community';
import type { GroupItem, GroupKind, GroupMemberItem } from './types';

/**
 * Chapters and interest groups.
 *
 * Three rules that shape every function here:
 *
 *  - **Students see interest groups, not chapters.** A chapter is alumni in
 *    one place; a chapter a final-year can walk into is an alumni roster a
 *    final-year can read, which is the directory's student tier by another
 *    door. They are not addressable by a student at all, the same way an
 *    alumni-only event is not.
 *  - **A roster is for the group.** Anyone allowed to see a group sees its
 *    name, its description, how many are in it and who leads it. Who else is
 *    in it is for members and for the staff who run groups.
 *  - **Members are summaries.** Every person comes back as a
 *    `MemberSummary` narrowed to the viewer's tier, never a stored copy.
 */

const isStudent = (session: Session | null) => session?.roles.some((r) => r.role === 'student') ?? false;

/** Whether this viewer may know a group exists. */
function visibleTo(group: GroupRecord, session: Session | null): boolean {
  if (!session) return false;
  if (group.archived && !can(session, 'group.manage')) return false;
  if (group.kind === 'chapter' && isStudent(session)) return false;
  return true;
}

function membershipOf(session: Session | null, groupId: string): GroupMembershipRecord | undefined {
  if (!session) return undefined;
  return GROUP_MEMBERSHIPS.find((r) => r.groupId === groupId && r.memberId === session.memberId);
}

function shape(group: GroupRecord, session: Session): GroupItem {
  const rows = GROUP_MEMBERSHIPS.filter((r) => r.groupId === group.id);
  const mine = membershipOf(session, group.id);
  const leads = rows
    .filter((r) => r.role === 'lead' && r.state === 'active')
    .map((r) => findMemberById(r.memberId))
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
    .map((m) => projectMemberSummary(m, session));

  return {
    id: group.id,
    slug: group.slug,
    name: group.name,
    kind: group.kind,
    description: group.description,
    city: group.city,
    country: group.country,
    joinPolicy: group.joinPolicy,
    memberCount: rows.filter((r) => r.state === 'active').length,
    archived: group.archived,
    createdAt: group.createdAt,
    viewer: { state: mine?.state ?? null, role: mine?.role ?? null },
    leads,
  };
}

export function getGroups(
  session: Session | null,
  opts: { kind?: GroupKind; mine?: boolean; q?: string } = {},
): GroupItem[] {
  if (!session) return [];
  const q = opts.q?.trim().toLowerCase();

  return GROUPS.filter((g) => visibleTo(g, session))
    .filter((g) => !opts.kind || g.kind === opts.kind)
    .filter((g) => !opts.mine || membershipOf(session, g.id)?.state === 'active')
    .filter((g) => !q || `${g.name} ${g.description} ${g.city ?? ''}`.toLowerCase().includes(q))
    .map((g) => shape(g, session))
    .sort((a, b) => b.memberCount - a.memberCount || a.name.localeCompare(b.name));
}

export function getGroupBySlug(session: Session | null, slug: string): GroupItem | null {
  if (!session) return null;
  const group = GROUPS.find((g) => g.slug === slug);
  if (!group || !visibleTo(group, session)) return null;
  return shape(group, session);
}

/** The groups the viewer is an active member of, for the feed's "post in" picker. */
export function getMyGroups(session: Session): GroupItem[] {
  return getGroups(session, { mine: true });
}

/** Whether the viewer may run this group: lead of it, or staff who manage groups. */
export function canRunGroup(session: Session | null, slug: string): boolean {
  if (!session) return false;
  if (can(session, 'group.manage')) return true;
  const group = GROUPS.find((g) => g.slug === slug);
  if (!group) return false;
  const mine = membershipOf(session, group.id);
  return mine?.state === 'active' && mine.role === 'lead';
}

/** Whether the viewer may read the roster: in the group, or running groups. */
export function canSeeRoster(session: Session | null, slug: string): boolean {
  if (!session) return false;
  if (can(session, 'group.manage')) return true;
  const group = GROUPS.find((g) => g.slug === slug);
  return Boolean(group && membershipOf(session, group.id)?.state === 'active');
}

/**
 * Who is in a group, for the people entitled to see it. An empty list is the
 * answer to anyone else, not a hint that the group is empty: callers ask
 * `canSeeRoster` to tell the two apart.
 */
export function getGroupMembers(session: Session, slug: string): GroupMemberItem[] {
  const group = GROUPS.find((g) => g.slug === slug);
  if (!group || !visibleTo(group, session) || !canSeeRoster(session, slug)) return [];

  return GROUP_MEMBERSHIPS.filter((r) => r.groupId === group.id && r.state === 'active')
    .map((r) => ({ record: r, member: findMemberById(r.memberId) }))
    .filter((x): x is { record: GroupMembershipRecord; member: NonNullable<typeof x.member> } => Boolean(x.member))
    .map((x) => ({
      member: projectMemberSummary(x.member, session),
      role: x.record.role,
      state: x.record.state,
      joinedAt: x.record.joinedAt,
    }))
    .sort((a, b) => (a.role === b.role ? a.member.fullName.localeCompare(b.member.fullName) : a.role === 'lead' ? -1 : 1));
}

/** Join requests waiting on a lead. Leads and group managers only. */
export function getGroupRequests(session: Session, slug: string): GroupMemberItem[] {
  const group = GROUPS.find((g) => g.slug === slug);
  if (!group || !canRunGroup(session, slug)) return [];

  return GROUP_MEMBERSHIPS.filter((r) => r.groupId === group.id && r.state === 'requested')
    .map((r) => ({ record: r, member: findMemberById(r.memberId) }))
    .filter((x): x is { record: GroupMembershipRecord; member: NonNullable<typeof x.member> } => Boolean(x.member))
    .map((x) => ({
      member: projectMemberSummary(x.member, session),
      role: x.record.role,
      state: x.record.state,
      joinedAt: x.record.joinedAt,
    }));
}

/** Requests across every group the viewer runs, for the staff and lead task lists. */
export function countGroupRequests(session: Session): number {
  return GROUPS.filter((g) => visibleTo(g, session) && canRunGroup(session, g.slug)).reduce(
    (n, g) => n + GROUP_MEMBERSHIPS.filter((r) => r.groupId === g.id && r.state === 'requested').length,
    0,
  );
}

/** Whether a viewer may join, and if not, the sentence that says why. */
export function joinVerdict(session: Session, group: GroupItem): { ok: true; becomes: 'active' | 'requested' } | { ok: false; reason: string } {
  if (group.archived) return { ok: false, reason: 'This group is closed.' };
  if (group.kind === 'chapter' && isStudent(session)) {
    return { ok: false, reason: 'Chapters are for alumni. Interest groups are open to students.' };
  }
  if (group.viewer.state === 'active') return { ok: false, reason: 'You are already in this group.' };
  if (group.viewer.state === 'requested') return { ok: false, reason: 'Your request is waiting on a lead.' };
  return { ok: true, becomes: group.joinPolicy === 'approval' ? 'requested' : 'active' };
}

/** Whether an address is taken, archived groups included, so a new group cannot shadow an old one. */
export function groupSlugTaken(slug: string): boolean {
  return GROUPS.some((g) => g.slug === slug);
}
