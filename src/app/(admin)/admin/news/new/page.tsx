import { notFound, redirect } from 'next/navigation';

import { getSessionMember } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getNews } from '@/lib/data/content';
import { getDepartments } from '@/lib/data/repo';
import { Breadcrumbs, PageHeader } from '@/components/ui';
import { deskFor, type DeskRole } from '@/lib/branding/copy';
import { siteOrigin } from '@/lib/share';
import { KIND_META, KIND_ORDER, PINNED_CAP } from '../kinds';
import { NewsForm, type KindOption } from './NewsForm';

export const metadata = { title: 'Write a story · Staff console' };

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

  /**
   * The desk a story is filed under. Members read the desk, not the
   * person: the office carries weight an individual name does not, and
   * staff leave. The college names its desks in the brand pack; the
   * individual is recorded in the audit log.
   */
  const deskRole: DeskRole | null = held.has('college_admin')
    ? 'college_admin'
    : held.has('alumni_cell_operator')
      ? 'alumni_cell_operator'
      : held.has('placement_officer')
        ? 'placement_officer'
        : null;
  const hodDepartment = session.roles.find((r) => r.role === 'hod')?.departmentId ?? null;
  const desk = deskRole
    ? deskFor(pack.copy, deskRole)
    : hodDepartment
      ? `${departments.find((d) => d.code === hodDepartment)?.name ?? hodDepartment} department`
      : deskFor(pack.copy, 'alumni_cell_operator');

  const kinds: KindOption[] = KIND_ORDER.map((value) => ({ value, ...KIND_META[value] }));

  const departmentOptions = [
    { value: '', label: 'Every branch' },
    ...departments.map((d) => ({ value: d.code, label: `${d.code} — ${d.name}` })),
  ];

  // Drafts included: an address is taken the moment it is written down,
  // not the moment it is published, and colliding with a half-written
  // story is exactly as broken as colliding with a live one.
  const takenSlugs = getNews({ includeDrafts: true }).map((n) => n.slug);

  // Counted the way the server counts it: published stories only.
  const pinnedCount = getNews().filter((n) => n.pinned).length;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Staff console', href: '/admin' },
              { label: 'News', href: '/admin/news' },
              { label: 'Write a story' },
            ]}
          />
        }
        eyebrow="News"
        title="Write a story"
        description="Pick the kind first: it decides how the feed shows the story and whether anyone is notified."
      />

      <NewsForm
        kinds={kinds}
        departmentOptions={departmentOptions}
        takenSlugs={takenSlugs}
        authorDesk={desk}
        actorName={actor?.fullName ?? null}
        share={{ copy: pack.copy, locale: pack.locale }}
        origin={await siteOrigin()}
        pinnedCount={pinnedCount}
        pinnedCap={PINNED_CAP}
      />
    </div>
  );
}
