import * as React from 'react';
import Link from 'next/link';

import { Avatar, Badge, Card, CardBody } from '@/components/ui';
import { memberLine } from '@/lib/format';
import { SHOWCASE_STATE_LABELS, excerpt, showcaseCategoryLabel, showcaseKindLabel } from '@/lib/community';
import type { ShowcaseEntry } from '@/lib/data/types';

/**
 * One entry in the showcase.
 *
 * Leads with the person and what they did, in that order: this is a wall of
 * people, and the headline is the reason to stop on one. The card never
 * shows contact details (a showcase entry has none), and a person who is on
 * the portal links to their directory profile, where the contact rules apply.
 */

const STATE_TONE = { published: 'success', pending_moderation: 'warning', rejected: 'danger' } as const;

export function ShowcaseCard({
  entry,
  size = 'card',
  showState = false,
}: {
  entry: ShowcaseEntry;
  size?: 'card' | 'lead';
  /** The member's own submissions and the curators' lists show where an entry stands. */
  showState?: boolean;
}) {
  const lead = size === 'lead';
  const line = memberLine([
    entry.batchYear ? `Batch of ${entry.batchYear}` : null,
    entry.departmentCode,
  ]);

  return (
    <Card className="lift relative flex h-full flex-col has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-[var(--focus-ring)]">
      <CardBody className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{showcaseCategoryLabel(entry.category)}</Badge>
          {entry.kind !== 'prominent' ? <Badge tone="outline">{showcaseKindLabel(entry.kind)}</Badge> : null}
          {entry.featured ? <Badge tone="brand">Featured</Badge> : null}
          {showState && entry.state !== 'published' ? <Badge tone={STATE_TONE[entry.state]}>{SHOWCASE_STATE_LABELS[entry.state]}</Badge> : null}
        </div>

        <div className="flex items-start gap-3">
          <Avatar name={entry.displayName} src={entry.member?.photoUrl ?? undefined} size={lead ? 'lg' : 'md'} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{entry.displayName}</p>
            {line ? <p className="truncate text-sm text-secondary">{line}</p> : null}
          </div>
        </div>

        <h3 className={lead ? 'font-display text-xl font-semibold leading-snug' : 'font-display text-lg font-semibold leading-snug'}>
          <Link href={`/showcase/${entry.slug}`} className="link-quiet after:absolute after:inset-0 after:rounded-lg">
            {entry.headline}
          </Link>
        </h3>

        <p className={lead ? 'text-md text-secondary' : 'line-clamp-3 text-sm text-secondary'}>{excerpt(entry.summary, lead ? 260 : 170)}</p>
      </CardBody>
    </Card>
  );
}
