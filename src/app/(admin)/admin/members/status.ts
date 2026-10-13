import type { MemberStatus } from '@/lib/data/types';

/**
 * Status vocabulary, shared by the member list and the member record.
 *
 * One `members` table holds students and alumni alike; the status enum is
 * what separates them, and `rollover_batch()` flips it once a year. Every
 * status in the enum is offered even where the seeded data has none — an
 * admin looking for lapsed accounts should find an empty result that says
 * so, not a missing option that looks like a bug.
 *
 * Colour is for exceptions. The two ordinary states read as passive
 * (outline) or done (success); waiting reads as warning; refused as
 * danger. No state uses the info tone, which is not used after sign-in.
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
    note: 'In the degree register, with no account against the row.',
  },
  invited: {
    label: 'Invited',
    tone: 'brand',
    note: 'Invited, and has not signed in yet.',
  },
  pending: {
    label: 'Awaiting verification',
    tone: 'warning',
    note: 'Registered and waiting for a decision. Can see only their own profile.',
  },
  active_student: {
    label: 'Final year',
    tone: 'outline',
    note: 'A current student. Does not see the giving module.',
  },
  active_alumni: {
    label: 'Alumni',
    tone: 'success',
    note: 'Verified against the degree register.',
  },
  rejected: {
    label: 'Rejected',
    tone: 'danger',
    note: 'Registration refused. They can register again with the right details.',
  },
  lapsed: {
    label: 'Lapsed',
    tone: 'neutral',
    note: 'The account is no longer in use.',
  },
  deceased: {
    label: 'Deceased',
    tone: 'neutral',
    note: 'Kept for the college record and left out of every message.',
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
