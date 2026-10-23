import * as React from 'react';
import Link from 'next/link';
import { MapPin, Users } from 'lucide-react';

import { Badge, Card, CardBody } from '@/components/ui';
import { memberLine } from '@/lib/format';
import { excerpt } from '@/lib/community';
import type { GroupItem } from '@/lib/data/types';

/**
 * One group on the groups list.
 *
 * The whole card is a link to the group; the join control sits above it
 * (`relative z-10`) so pressing it does not navigate. Leads are named,
 * because "who looks after this" is what a person deciding whether to join
 * a chapter wants to know, and they are `MemberSummary` values already
 * narrowed to the viewer's tier.
 */

function where(group: GroupItem): string | null {
  if (group.kind !== 'chapter') return null;
  const place = memberLine([group.city, group.country && group.country !== 'IN' ? group.country : null]);
  return place || (group.country ?? null);
}

export function GroupCard({ group, action }: { group: GroupItem; action?: React.ReactNode }) {
  const place = where(group);
  const leads = group.leads.slice(0, 2).map((l) => l.fullName);

  return (
    <Card className="lift relative flex h-full flex-col has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-[var(--focus-ring)]">
      <CardBody className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={group.kind === 'chapter' ? 'brand' : 'accent'}>{group.kind === 'chapter' ? 'Chapter' : 'Interest group'}</Badge>
          {group.viewer.state === 'active' ? (
            <Badge tone="success" dot>
              {group.viewer.role === 'lead' ? 'You lead it' : 'Joined'}
            </Badge>
          ) : group.viewer.state === 'requested' ? (
            <Badge tone="neutral">Requested</Badge>
          ) : null}
          {group.archived ? <Badge tone="neutral">Archived</Badge> : null}
        </div>

        <h3 className="font-display text-lg font-semibold leading-snug">
          <Link href={`/groups/${group.slug}`} className="link-quiet after:absolute after:inset-0 after:rounded-lg">
            {group.name}
          </Link>
        </h3>

        {group.description ? <p className="line-clamp-3 text-sm text-secondary">{excerpt(group.description, 170)}</p> : null}

        <dl className="mt-auto space-y-1 text-sm text-secondary">
          <div className="flex items-center gap-2">
            <dt className="shrink-0 text-muted">
              <Users className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Members</span>
            </dt>
            <dd className="tabular">
              {group.memberCount.toLocaleString('en-IN')} {group.memberCount === 1 ? 'member' : 'members'}
            </dd>
          </div>
          {place ? (
            <div className="flex items-center gap-2">
              <dt className="shrink-0 text-muted">
                <MapPin className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Where</span>
              </dt>
              <dd>{place}</dd>
            </div>
          ) : null}
          {leads.length > 0 ? (
            <div>
              <dt className="sr-only">Led by</dt>
              <dd className="line-clamp-1">Led by {leads.join(' and ')}</dd>
            </div>
          ) : null}
        </dl>
      </CardBody>
      {action ? <div className="relative z-10 border-t border-line px-5 py-3.5 [&>*]:w-full sm:[&>*]:w-auto">{action}</div> : null}
    </Card>
  );
}
