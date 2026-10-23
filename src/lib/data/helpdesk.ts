import { can, type Session } from '../auth/guard';
import { findMemberById } from './repo';
import { TICKETS, type TicketRecord } from './seed-community';
import type { TicketItem, TicketState } from './types';

/**
 * The help desk.
 *
 * A ticket is a member describing their own account, so it is the most
 * private thing in the community modules. It is readable by the member who
 * wrote it and by the people who answer tickets (`helpdesk.manage`: the
 * alumni cell and the college admin) and by nobody else. In particular not
 * by the vendor, which holds no `helpdesk.manage` and is turned away from
 * the routes as well.
 */

function shape(t: TicketRecord): TicketItem {
  const names = new Map<string, string>();
  const nameOf = (id: string) => {
    if (!names.has(id)) names.set(id, findMemberById(id)?.fullName ?? 'A member');
    return names.get(id)!;
  };

  return {
    id: t.id,
    reference: t.reference,
    kind: t.kind,
    category: t.category,
    subject: t.subject,
    pagePath: t.pagePath,
    state: t.state,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    memberId: t.memberId,
    memberName: nameOf(t.memberId),
    messages: t.messages.map((m) => ({
      id: m.id,
      authorName: nameOf(m.authorId),
      fromStaff: m.fromStaff,
      body: m.body,
      createdAt: m.createdAt,
    })),
  };
}

export function getMyTickets(session: Session): TicketItem[] {
  return TICKETS.filter((t) => t.memberId === session.memberId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(shape);
}

/** One ticket, for its author or for staff who answer tickets. */
export function getTicketForViewer(session: Session, id: string): TicketItem | null {
  const t = TICKETS.find((x) => x.id === id || x.reference === id);
  if (!t) return null;
  if (t.memberId !== session.memberId && !can(session, 'helpdesk.manage')) return null;
  return shape(t);
}

export interface TicketQueueQuery {
  state?: TicketState | 'all';
  kind?: TicketItem['kind'];
  q?: string;
}

/** The staff queue. Empty for anyone without `helpdesk.manage`. */
export function getTicketQueue(session: Session, query: TicketQueueQuery = {}): TicketItem[] {
  if (!can(session, 'helpdesk.manage')) return [];
  const state = query.state ?? 'open';
  const needle = query.q?.trim().toLowerCase();

  return TICKETS.filter((t) => state === 'all' || t.state === state)
    .filter((t) => !query.kind || t.kind === query.kind)
    .map(shape)
    .filter((t) => !needle || `${t.reference} ${t.subject} ${t.memberName}`.toLowerCase().includes(needle))
    .sort((a, b) => (state === 'open' ? a.createdAt.localeCompare(b.createdAt) : b.updatedAt.localeCompare(a.updatedAt)));
}

export function countOpenTickets(session: Session): { open: number; oldestAt: string | null } {
  if (!can(session, 'helpdesk.manage')) return { open: 0, oldestAt: null };
  const open = TICKETS.filter((t) => t.state === 'open').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { open: open.length, oldestAt: open[0]?.createdAt ?? null };
}

/** The next reference a new ticket would carry. Fixture-mode only; the database numbers its own. */
export function nextTicketReference(): string {
  const highest = TICKETS.reduce((n, t) => Math.max(n, Number(t.reference.replace(/\D/g, '')) || 0), 1000);
  return `HD-${highest + 1}`;
}
