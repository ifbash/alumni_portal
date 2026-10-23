import { redirect, notFound } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDegreeRegisterStats, getDepartments } from '@/lib/data/repo';
import { getGroups } from '@/lib/data/groups';
import { PageHeader, Breadcrumbs, Alert } from '@/components/ui';
import { formatTimeZoneLabel } from '@/lib/format';
import { siteOrigin } from '@/lib/share';
import { EventForm } from './EventForm';

export const metadata = { title: 'New event · Staff console' };

export default async function NewEventPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { brand } = resolved;
  if (!brand.pack.features.events) notFound();

  const wide = can(session, 'event.create.any');
  const scoped = can(session, 'event.create.department');
  if (!wide && !scoped) requireCap(session, 'event.create.department');

  const departments = getDepartments();
  const myDepartment = session.roles.find((r) => r.role === 'hod')?.departmentId ?? session.departmentId;
  const mine = departments.find((d) => d.code === myDepartment) ?? null;

  /**
   * The branch a viewer may pick is decided here, on the server, and the
   * form is given nothing else to offer. An HOD does not see the other six
   * branches greyed out with a message explaining why — the option is not
   * in the list, because a scope you can see and not use is an invitation
   * to file a ticket asking for it.
   */
  const options = wide
    ? [{ value: '', label: 'All branches — a college-wide event' }, ...departments.map((d) => ({
        value: d.code,
        label: `${d.code} — ${d.name}`,
      }))]
    : mine
      ? [{ value: mine.code, label: `${mine.code} — ${mine.name}` }]
      : [];

  const pack = brand.pack;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Staff console', href: '/admin' },
              { label: 'Events', href: '/admin/events' },
              { label: 'New event' },
            ]}
          />
        }
        eyebrow="Events"
        title="New event"
        description="Save a draft while the details settle. Publishing opens registration straight away."
      />

      {options.length === 0 ? (
        <Alert tone="warning" title="Your account has no branch yet">
          <p>Events you create are for your branch. Ask the college admin to set your department.</p>
        </Alert>
      ) : (
        <EventForm
          options={options}
          locked={!wide}
          scopeNote={wide ? 'College-wide or one branch.' : `Your events are for ${mine?.code ?? 'your branch'}.`}
          share={{ copy: pack.copy, locale: pack.locale }}
          origin={await siteOrigin()}
          timeZoneLabel={formatTimeZoneLabel(pack.locale.timeZone, pack.locale.locale)}
          canInvite={
            can(session, 'comms.send.all') || can(session, 'comms.send.segment') || can(session, 'comms.send.department')
          }
          canAlbum={pack.features.gallery && wide}
          groups={pack.features.groups ? getGroups(session).map((g) => ({ slug: g.slug, name: g.name })) : []}
          years={getDegreeRegisterStats().byYear.map((y) => y.year).sort((a, b) => b - a)}
        />
      )}
    </div>
  );
}
