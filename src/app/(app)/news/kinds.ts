import type { ComponentProps, ComponentType } from 'react';
import { Megaphone, Milestone, Newspaper, Trophy } from 'lucide-react';
import type { Badge } from '@/components/ui';
import type { NewsKind } from '@/lib/data/content';

/**
 * What each kind of story looks like, in one place.
 *
 * Kind is the only structure the feed has — there are no sections, no
 * editions and no tags — so it has to carry real signal. A reader
 * scanning the list should be able to tell "the college is telling me
 * something" from "a graduate did well" without reading a word of the
 * summary.
 *
 * `restrained` is the exception that matters. An obituary is not a
 * content type to be decorated: no coloured badge, no icon, no hover
 * lift, no "read more" arrow, no place in anybody's related-stories
 * list. A death notice styled like an achievement is the kind of mistake
 * a college never lives down, and the only reliable way to prevent it is
 * to make the restraint a property of the data rather than something a
 * screen has to remember.
 */

export type BadgeTone = NonNullable<ComponentProps<typeof Badge>['tone']>;

export interface KindMeta {
  /** Singular — what sits on the badge beside one story. */
  label: string;
  /** Plural — what sits on the filter tab. */
  tab: string;
  tone: BadgeTone;
  /** Null for a kind that is deliberately not iconographed. */
  icon: ComponentType<{ className?: string }> | null;
  restrained: boolean;
  /** One line describing what belongs under this kind. */
  blurb: string;
  /** Shown when this filter has nothing in it. */
  empty: string;
}

export const KIND_ORDER: NewsKind[] = [
  'announcement',
  'achievement',
  'milestone',
  'press',
  'obituary',
];

export const KIND_META: Record<NewsKind, KindMeta> = {
  announcement: {
    label: 'Announcement',
    tab: 'Announcements',
    tone: 'brand',
    icon: Megaphone,
    restrained: false,
    blurb: 'Notices from the alumni cell, the placement cell and the principal’s office.',
    empty:
      'Announcements are how the college tells the network something — a meet opening for registration, a change to how the portal works. There are none on the page right now.',
  },
  achievement: {
    label: 'Achievement',
    tab: 'Achievements',
    tone: 'success',
    icon: Trophy,
    restrained: false,
    blurb: 'A graduate’s appointment, award or recognition.',
    empty:
      'Achievements are written up when a graduate tells the alumni cell, or when somebody from their batch does. If you know of one, the cell would rather hear it twice than not at all.',
  },
  milestone: {
    label: 'Milestone',
    tab: 'Milestones',
    tone: 'accent',
    icon: Milestone,
    restrained: false,
    blurb: 'What the network built — a funded lab, a scholarship, a chapter opening.',
    empty:
      'Milestones are the things graduates paid for or built together: a lab, a scholarship, a city chapter. Nothing has been recorded here yet.',
  },
  press: {
    label: 'In the press',
    tab: 'Press',
    tone: 'info',
    icon: Newspaper,
    restrained: false,
    blurb: 'Coverage of the college or its graduates in an outside publication.',
    empty:
      'Press cuttings are added when the college or a graduate appears in an outside publication. Nothing has been filed under this yet.',
  },
  obituary: {
    label: 'In memoriam',
    tab: 'In memoriam',
    // Neutral is the point. There is no tone in the palette that should be
    // used to make a death notice stand out in a list.
    tone: 'neutral',
    icon: null,
    restrained: true,
    blurb: 'A notice for a member of the college community who has died.',
    empty: 'There are no notices on this page.',
  },
};

export function isNewsKind(value: string | undefined | null): value is NewsKind {
  return typeof value === 'string' && value in KIND_META;
}

/** The feed URL for a kind — every filter is a link somebody can paste. */
export function newsHref(kind: NewsKind | null): string {
  return kind ? `/news?kind=${kind}` : '/news';
}
