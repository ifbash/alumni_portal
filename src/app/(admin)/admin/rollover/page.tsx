import { redirect } from 'next/navigation';
import { CalendarCheck2, History } from 'lucide-react';

import { Breadcrumbs, PageHeader, Section, TrustChip } from '@/components/ui';
import { Crest } from '@/components/brand/Crest';
import { getSession, getSessionMember } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { canOpen } from '@/lib/navigation';
import { getAuditLog, getDepartments, getMembersForAdmin, searchDegreeRegister } from '@/lib/data/repo';
import { formatDate } from '@/lib/format';
import { RolloverRunner, type BatchPreview } from './RolloverRunner';

export const metadata = { title: 'Annual rollover · Staff console' };

export default async function RolloverPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  requireCap(session, 'rollover.execute');

  const { member } = await getSessionMember();
  const resolved = await getTenantBrand();
  if (!resolved) redirect('/login');
  const pack = resolved.brand.pack;
  const fmt = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };
  const departments = getDepartments();

  const students = getMembersForAdmin({ status: 'active_student', perPage: 5000 }).items;

  // Roll numbers the examinations branch has actually supplied. A student
  // whose roll is not in the register still rolls over — they are simply
  // marked as verified by the rollover rather than by the register, and
  // re-linked once the batch file lands.
  const registerRolls = new Set(
    searchDegreeRegister('', { perPage: 100000 }).items.map((r) => r.rollNumber.toUpperCase()),
  );

  const years = [...new Set(students.map((s) => s.batchYear).filter((y): y is number => y !== null))].sort();

  // Counts only: no names, rolls or addresses leave the server for the runner.
  const batches: BatchPreview[] = years.map((year) => {
    const cohort = students.filter((s) => s.batchYear === year);

    const byDept = new Map<string, number>();
    for (const s of cohort) {
      const code = s.departmentCode ?? 'Unrecorded';
      byDept.set(code, (byDept.get(code) ?? 0) + 1);
    }

    return {
      year,
      total: cohort.length,
      departments: [...byDept.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([code, count]) => ({
          code,
          name: departments.find((d) => d.code === code)?.name ?? 'Branch not recorded',
          count,
        })),
      withRegisterRow: cohort.filter((s) => s.rollNumber && registerRolls.has(s.rollNumber.toUpperCase())).length,
    };
  });

  // Past runs come from the audit log, and only for somebody who can read it.
  const canAudit = can(session, 'audit.read');
  const history = canAudit ? getAuditLog({ action: 'rollover.execute' }) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: 'Staff console', href: '/admin' }, { label: 'Annual rollover' }]} />}
        eyebrow="People and records"
        title="Annual rollover"
        description="Moves a graduating batch from final year to alumni, once their results are out."
        meta={<TrustChip icon={<CalendarCheck2 />}>Never runs on its own</TrustChip>}
      />

      <div className="max-w-3xl">
        <RolloverRunner
          batches={batches}
          actorName={member?.fullName ?? 'you'}
          crest={<Crest pack={pack} size={48} />}
          donations={pack.features.donations}
          links={{
            upload: canOpen(session, pack, '/admin/degree-register'),
            comms: canOpen(session, pack, '/admin/comms'),
            news: canOpen(session, pack, '/admin/news'),
            audit: canAudit,
          }}
        />
      </div>

      <Section title="Past rollovers">
        {history === null ? (
          <p className="text-sm text-secondary">Past runs are in the audit log, which the college admin can open.</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-secondary">No rollover has been run on this portal yet.</p>
        ) : (
          <ul className="max-w-3xl divide-y divide-line rounded-lg border border-line bg-surface-raised">
            {history.map((h) => (
              <li key={h.id} className="flex items-start gap-3 px-4 py-3">
                <History className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{h.reason ?? 'Batch rolled over'}</p>
                  <p className="text-xs text-secondary">
                    {h.actorName ? `${h.actorName} · ` : ''}
                    {formatDate(h.createdAt, fmt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
