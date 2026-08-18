import { notFound, redirect } from 'next/navigation';

import { getSessionMember } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getNews } from '@/lib/data/content';
import { getDepartments } from '@/lib/data/repo';
import { Breadcrumbs, PageHeader } from '@/components/ui';
import { KIND_META, KIND_ORDER } from '../kinds';
import { NewsForm, type KindOption } from './NewsForm';

export const metadata = { title: 'Write a story' };

/**
 * The desk a story is filed under, derived from the roles the author
 * actually holds.
 *
 * Members read the desk, not the person: "Alumni Cell" and "Office of the
 * Principal" carry weight that an individual name does not, and staff
 * leave. The individual is recorded in the audit log, which is where the
 * question "who wrote that" belongs.
 */
const DESK_BY_ROLE: Array<[string, string]> = [
  ['college_admin', 'Office of the Principal'],
  ['alumni_cell_operator', 'Alumni Cell'],
  ['placement_officer', 'Training & Placement Cell'],
  ['platform_admin', 'Alumni Cell'],
];

export default async function NewNewsPage() {
  const { session, member: actor } = await getSessionMember();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.news) notFound();

  // Same capability as the list — publishing a story is addressing a
  // segment of the membership, and hiding the button is not the guard.
  requireCap(session, 'comms.send.segment');

  const departments = getDepartments();
  const held = new Set(session.roles.map((r) => r.role as string));

  const hodDepartment = session.roles.find((r) => r.role === 'hod')?.departmentId ?? null;
  const desk =
    DESK_BY_ROLE.find(([role]) => held.has(role))?.[1] ??
    (hodDepartment
      ? `${departments.find((d) => d.code === hodDepartment)?.name ?? hodDepartment} Department`
      : 'Alumni Cell');

  const kinds: KindOption[] = KIND_ORDER.map((value) => ({ value, ...KIND_META[value] }));

  const departmentOptions = [
    { value: '', label: 'Every branch — not tied to a department' },
    ...departments.map((d) => ({ value: d.code, label: `${d.code} — ${d.name}` })),
  ];

  // Drafts included: an address is taken the moment it is written down,
  // not the moment it is published, and colliding with a half-written
  // story is exactly as broken as colliding with a live one.
  const takenSlugs = getNews({ includeDrafts: true }).map((n) => n.slug);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Admin', href: '/admin' },
              { label: 'News', href: '/admin/news' },
              { label: 'Write a story' },
            ]}
          />
        }
        eyebrow="Engagement"
        title="Write a story"
        description="Pick the kind first — it decides how the feed presents the story and whether publishing notifies anybody. Save a draft while the facts are still being checked; a draft is invisible to members and sends nothing."
      />

      <NewsForm
        kinds={kinds}
        departmentOptions={departmentOptions}
        takenSlugs={takenSlugs}
        authorDesk={desk}
        actorName={actor?.fullName ?? 'the signed-in editor'}
        portalName={pack.copy.portalName}
        whatsappEnabled={pack.features.whatsapp}
      />
    </div>
  );
}
