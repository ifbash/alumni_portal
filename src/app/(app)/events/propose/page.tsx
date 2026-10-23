import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDegreeRegisterStats } from '@/lib/data/repo';
import { getMyGroups } from '@/lib/data/groups';
import { displayNow, formatTimeZoneLabel } from '@/lib/format';
import { EVENT_KIND_VALUES } from '@/lib/community';
import { PROPOSAL_LEAD_DAYS } from '@/lib/schemas/events';
import { Breadcrumbs, PageHeader } from '@/components/ui';
import type { EventKind } from '@/lib/data/types';
import { ProposeForm } from './ProposeForm';

export const metadata: Metadata = { title: 'Propose an event' };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Put an event forward.
 *
 * Alumni and faculty can propose a reunion, a chapter meetup, a webinar or a
 * workshop. The alumni cell reads it and approves or declines; until then it
 * is visible only to the proposer and the people who run events. The page
 * says that before the form, not after it, because the question a member
 * has is "will this go live the moment I press the button".
 */
export default async function ProposeEventPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const pack = resolved.brand.pack;
  if (!pack.features.events) notFound();

  requireCap(session, 'event.propose');

  const params = await searchParams;
  const rawKind = one(params.kind)?.toLowerCase() ?? '';
  const initialKind = (EVENT_KIND_VALUES as readonly string[]).includes(rawKind) ? (rawKind as EventKind) : null;
  const rawBatch = Number(one(params.batch));

  const myGroups = pack.features.groups ? getMyGroups(session) : [];
  const rawGroup = one(params.group) ?? '';
  const initialGroup = myGroups.some((g) => g.slug === rawGroup) ? rawGroup : null;

  const years = getDegreeRegisterStats().byYear.map((y) => y.year).sort((a, b) => b - a);
  const initialBatch = years.includes(rawBatch) ? rawBatch : null;

  // The earliest date the form offers, in the college's own time zone.
  const earliest = new Intl.DateTimeFormat('en-CA', { timeZone: pack.locale.timeZone }).format(
    new Date(displayNow().getTime() + PROPOSAL_LEAD_DAYS * 86_400_000),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: 'Events', href: '/events' }, { label: 'Propose an event' }]} />}
        eyebrow="Events"
        title="Propose an event"
        description={`The ${pack.copy.officeName} reads every proposal and tells you what it decides.`}
      />

      <ProposeForm
        groups={myGroups.map((g) => ({ slug: g.slug, name: g.name }))}
        initialGroup={initialGroup}
        years={years}
        initialKind={initialKind}
        initialBatch={initialBatch}
        earliest={earliest}
        leadDays={PROPOSAL_LEAD_DAYS}
        timeZoneLabel={formatTimeZoneLabel(pack.locale.timeZone, pack.locale.locale)}
        officeName={pack.copy.officeName}
      />
    </div>
  );
}
