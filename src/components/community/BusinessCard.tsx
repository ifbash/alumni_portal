import * as React from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';

import { Badge, Card, CardBody } from '@/components/ui';
import { memberLine } from '@/lib/format';
import { BUSINESS_STATE_LABELS, excerpt } from '@/lib/community';
import type { BusinessItem } from '@/lib/data/types';

/**
 * One business in the directory.
 *
 * Says what it does and where, and who runs it. It never shows contact
 * details: those are on the listing's own page, behind the two-gate rule,
 * and a card in a list is the wrong place to scrape.
 */

const STATUS_TONE = {
  live: 'success',
  pending_moderation: 'warning',
  rejected: 'danger',
  closed: 'neutral',
} as const;

export function BusinessCard({
  business,
  showStatus = false,
  action,
}: {
  business: BusinessItem;
  /** The owner's own list and the moderators' queue show where a listing stands. */
  showStatus?: boolean;
  action?: React.ReactNode;
}) {
  const place = memberLine([business.city, business.country && business.country !== 'IN' ? business.country : business.region]);
  const offers = [...business.products, ...business.services].slice(0, 3);
  const owner = memberLine([business.owner.fullName, business.owner.batchYear ? `Batch of ${business.owner.batchYear}` : null]);

  return (
    <Card className="lift relative flex h-full flex-col has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-[var(--focus-ring)]">
      <CardBody className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="outline">{business.industry}</Badge>
          {showStatus ? <Badge tone={STATUS_TONE[business.status]}>{BUSINESS_STATE_LABELS[business.status]}</Badge> : null}
        </div>

        <h3 className="font-display text-lg font-semibold leading-snug">
          <Link href={`/businesses/${business.slug}`} className="link-quiet after:absolute after:inset-0 after:rounded-lg">
            {business.name}
          </Link>
        </h3>

        <p className="line-clamp-3 text-sm text-secondary">{excerpt(business.description, 190)}</p>

        {offers.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="What it offers">
            {offers.map((o) => (
              <li key={o} className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs text-secondary">
                {o}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto space-y-1 text-sm text-secondary">
          {place ? (
            <p className="flex items-center gap-2">
              <MapPin className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
              {place}
            </p>
          ) : null}
          <p className="line-clamp-1">Run by {owner}</p>
        </div>
      </CardBody>
      {action ? <div className="relative z-10 border-t border-line px-5 py-3.5 [&>*]:w-full sm:[&>*]:w-auto">{action}</div> : null}
    </Card>
  );
}
