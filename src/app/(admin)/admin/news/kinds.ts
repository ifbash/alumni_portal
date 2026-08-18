import type { ComponentProps } from 'react';
import type { Badge } from '@/components/ui';
import type { NewsKind } from '@/lib/data/content';

/**
 * The five kinds, as the desk sees them.
 *
 * `notifies` is the load-bearing field and the reason this table exists
 * on the staff side at all: publishing a story tells members about it,
 * except for an obituary, which is published to the news page and never
 * pushed. That is an editorial rule the college has to be able to point
 * at, not a checkbox somebody can tick at 11pm, so it is stated here,
 * shown in the composer, and repeated on the confirmation.
 */

export type BadgeTone = NonNullable<ComponentProps<typeof Badge>['tone']>;

export interface AdminKindMeta {
  label: string;
  tone: BadgeTone;
  /** What belongs under this kind, in the composer's own words. */
  blurb: string;
  /** Whether publishing sends anything to anybody. */
  notifies: boolean;
  restrained: boolean;
}

export const KIND_ORDER: NewsKind[] = [
  'announcement',
  'achievement',
  'milestone',
  'press',
  'obituary',
];

export const KIND_META: Record<NewsKind, AdminKindMeta> = {
  announcement: {
    label: 'Announcement',
    tone: 'brand',
    blurb: 'The college telling the network something — registration opening, a change of process, a deadline.',
    notifies: true,
    restrained: false,
  },
  achievement: {
    label: 'Achievement',
    tone: 'success',
    blurb: 'A graduate’s appointment, award or recognition. Name the batch and the branch; that is what makes it findable.',
    notifies: true,
    restrained: false,
  },
  milestone: {
    label: 'Milestone',
    tone: 'accent',
    blurb: 'Something the network built or funded. Put the money and the count in the summary — vague gratitude raises nothing.',
    notifies: true,
    restrained: false,
  },
  press: {
    label: 'In the press',
    tone: 'info',
    blurb: 'Coverage in an outside publication. Say which one and when, so the claim can be checked.',
    notifies: true,
    restrained: false,
  },
  obituary: {
    label: 'In memoriam',
    tone: 'neutral',
    blurb: 'A notice for a member of the college community who has died. Published quietly, never pushed.',
    notifies: false,
    restrained: true,
  },
};
