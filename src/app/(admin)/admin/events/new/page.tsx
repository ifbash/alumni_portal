import { redirect, notFound } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDepartments } from '@/lib/data/repo';
import { PageHeader, Breadcrumbs, Alert } from '@/components/ui';
import { EventForm } from './EventForm';

export const metadata = { title: 'New event' };

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

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Admin', href: '/admin' },
              { label: 'Events', href: '/admin/events' },
              { label: 'New event' },
            ]}
          />
        }
        eyebrow="Engagement"
        title="New event"
        description="Save it as a draft while the details settle. Publishing opens registration to the audience you choose, immediately and without a second confirmation from anyone else."
      />

      {options.length === 0 ? (
        <Alert tone="danger" title="No branch is in your scope">
          <p>
            You hold <code className="font-mono text-xs">event.create.department</code> but your account is not
            attached to a branch, so there is nothing you could scope an event to. Ask the college admin to set your
            department on the roles screen.
          </p>
        </Alert>
      ) : (
        <EventForm
          options={options}
          locked={!wide}
          scopeNote={
            wide
              ? 'You hold event.create.any, so a college-wide event and any single branch are both available.'
              : `You hold event.create.department for ${mine?.code ?? 'your branch'}. Every event you create is scoped to it.`
          }
          portalName={brand.pack.copy.portalName}
        />
      )}
    </div>
  );
}
