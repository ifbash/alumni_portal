import type { ComponentProps } from 'react';
import { Award, BellOff, Landmark, Megaphone, Newspaper, type LucideIcon } from 'lucide-react';
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
  /** What belongs under this kind, in one line. */
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
    blurb: 'Registration opening, a change of process, a deadline.',
    notifies: true,
    restrained: false,
  },
  achievement: {
    label: 'Achievement',
    tone: 'brand',
    blurb: 'A graduate’s appointment or award. Name the batch and branch.',
    notifies: true,
    restrained: false,
  },
  milestone: {
    label: 'Milestone',
    tone: 'accent',
    blurb: 'Something the network built or funded, with the figures.',
    notifies: true,
    restrained: false,
  },
  press: {
    label: 'In the press',
    tone: 'outline',
    blurb: 'Coverage elsewhere. Say which publication and when.',
    notifies: true,
    restrained: false,
  },
  obituary: {
    label: 'In memoriam',
    tone: 'neutral',
    blurb: 'A notice of a death. Published quietly, never pushed.',
    notifies: false,
    restrained: true,
  },
};

/** One icon per kind. The obituary's says what matters about it: nobody is notified. */
export const KIND_ICON: Record<NewsKind, LucideIcon> = {
  announcement: Megaphone,
  achievement: Award,
  milestone: Landmark,
  press: Newspaper,
  obituary: BellOff,
};

/**
 * How many published stories the feed holds pinned at once. The same
 * number `POST /api/admin/news` enforces (its `MAX_PINNED`), which is not
 * exported from the route, so it is mirrored here.
 */
export const PINNED_CAP = 3;
