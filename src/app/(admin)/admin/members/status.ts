import type { MemberStatus } from '@/lib/data/types';

/**
 * Status vocabulary, shared by the member list and the member record.
 *
 * One `members` table holds students and alumni alike; the status enum is
 * what separates them, and `rollover_batch()` flips it once a year. Every
 * status in the enum is offered even where the seeded data has none — an
 * admin looking for lapsed accounts should find an empty result that says
 * so, not a missing option that looks like a bug.
 */

export type StatusTone =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'outline';

export const STATUS_META: Record<MemberStatus, { label: string; tone: StatusTone; note: string }> = {
  unclaimed: {
    label: 'Unclaimed',
    tone: 'outline',
    note: 'In the degree register, no account against the row.',
  },
  invited: {
    label: 'Invited',
    tone: 'info',
    note: 'An invitation has gone out and has not been acted on.',
  },
  pending: {
    label: 'Awaiting verification',
    tone: 'warning',
    note: 'Registered and waiting on a decision. Can read their own profile and nothing else.',
  },
  active_student: {
    label: 'Final year',
    tone: 'info',
    note: 'Current student. Never sees alumni contact details or the giving module.',
  },
  active_alumni: {
    label: 'Alumni',
    tone: 'success',
    note: 'Verified against the degree register. Full member access.',
  },
  rejected: {
    label: 'Rejected',
    tone: 'danger',
    note: 'No matching register row. The person can appeal with a mark sheet.',
  },
  lapsed: {
    label: 'Lapsed',
    tone: 'neutral',
    note: 'Email has hard-bounced or the account has been dormant for two years.',
  },
  deceased: {
    label: 'Deceased',
    tone: 'neutral',
    note: 'Retained for institutional record. Excluded from every communication segment.',
  },
};

export const STATUS_ORDER: MemberStatus[] = [
  'active_alumni',
  'active_student',
  'pending',
  'invited',
  'unclaimed',
  'lapsed',
  'rejected',
  'deceased',
];
