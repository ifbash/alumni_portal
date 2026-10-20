import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FileUp, ShieldCheck } from 'lucide-react';

import { Breadcrumbs, ButtonLink, CopyButton, EmptyState, PageHeader, Section, SummaryLine } from '@/components/ui';
import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { capitalise } from '@/lib/branding/copy';
import { getAuditLog, getDegreeRegisterStats, getDepartments, searchDegreeRegister } from '@/lib/data/repo';
import { displayNow, formatDate, formatNumber, yearIn } from '@/lib/format';
import {
  RegisterFilesGrid,
  missingRegisterFiles,
  registerRequestText,
  registerYears,
} from '../_shared/RegisterFilesGrid';

export const metadata = { title: 'Imports · Staff console' };

/**
 * Which register files the college has, and which it is still owed.
 *
 * The question this page answers is asked every time a registration
 * arrives with no register row behind it — "has the 2021 ECE file ever
 * been loaded?" — and the answer decides whether the applicant or the
 * college is at fault. So the grid comes first. Import history is read
 * from the audit log, where every committed file is recorded, and only
 * for a viewer who may read that log.
 */
export default async function ImportsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  requireCap(session, 'verification.review.any');

  const resolved = await getTenantBrand();
  if (!resolved) redirect('/login');
  const pack = resolved.brand.pack;

  const stats = getDegreeRegisterStats();
  const codes = getDepartments().map((d) => d.code);
  const sourceFiles = searchDegreeRegister('', { perPage: 100000 }).items.map((r) => r.sourceFile);
  const throughYear = yearIn(pack.locale.timeZone, displayNow());
  const missing = missingRegisterFiles({ sourceFiles, branches: codes, throughYear });
  const years = registerYears(sourceFiles, throughYear);
  const fileCount = new Set(sourceFiles.filter(Boolean)).size;

  // Committed files, newest first, from the audit log: both the seeded
  // action name and the one the import endpoint writes.
  const canReadAudit = can(session, 'audit.read');
  const history = canReadAudit
    ? [...getAuditLog({ action: 'degree_register.import', limit: 50 }), ...getAuditLog({ action: 'register.import', limit: 50 })]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 8)
    : [];
  const fmt = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };

  const request = registerRequestText({
    shortName: pack.copy.shortName,
    office: capitalise(pack.copy.officeName),
    rollLabel: pack.copy.rollNumberLabel,
    missing,
    exampleYear: missing[0]?.year ?? throughYear,
    exampleBranch: missing[0]?.branch ?? codes[0] ?? 'BRANCH',
  });

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: 'Staff console', href: '/admin' }, { label: 'Imports' }]} />}
        eyebrow="People and records"
        title="Imports"
        description="Which degree register files are loaded, by batch and branch."
        actions={
          <ButtonLink href="/admin/degree-register/upload">
            <FileUp className="size-4" aria-hidden="true" />
            Load a register file
          </ButtonLink>
        }
      />

      <SummaryLine
        items={[
          { value: stats.total, label: 'rows loaded' },
          { value: fileCount, label: fileCount === 1 ? 'file' : 'files' },
          { value: missing.length, label: missing.length === 1 ? 'file still to come' : 'files still to come', tone: 'attention' },
        ]}
      />

      <Section
        title="Register files"
        description={`${formatNumber(stats.total)} rows, ${years[0] ?? throughYear}–${throughYear}.`}
      >
        <div className="space-y-4">
          {missing.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,currentColor_26%,transparent)] bg-warning-soft px-4 py-3 text-warning-fg">
              <p className="text-sm font-medium">
                {missing.length} {missing.length === 1 ? 'file is' : 'files are'} missing. Registrations from those
                batches cannot be matched until they arrive.
              </p>
              <CopyButton text={request} label="Copy request for missing files" copiedLabel="Request copied" />
            </div>
          ) : (
            <p className="text-sm text-secondary">
              Every batch from {years[0] ?? throughYear} to {throughYear} has a file for every branch.
            </p>
          )}
          <RegisterFilesGrid sourceFiles={sourceFiles} branches={codes} throughYear={throughYear} linkable />
        </div>
      </Section>

      <Section title="Import history">
        {history.length > 0 ? (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface-raised">
            {history.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/admin/audit/${e.id}`}
                  className="flex min-h-11 flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-2.5 text-sm transition-colors duration-fast ease-brand hover:bg-surface-sunken"
                >
                  <span className="flex min-w-0 items-baseline gap-3">
                    <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 self-start rounded-full bg-success" />
                    <span className="min-w-0 font-medium text-primary">{e.reason ?? 'A register file'}</span>
                  </span>
                  <span className="pl-5 text-secondary sm:pl-0">
                    {e.actorName} · <span className="tabular">{formatDate(e.createdAt, fmt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            variant="inline"
            title={
              canReadAudit
                ? 'No register file has been committed yet.'
                : 'Each committed file is recorded in the audit log, which the college admin keeps.'
            }
          />
        )}
      </Section>

      <p className="flex items-start gap-2 text-sm text-secondary">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
        Imports carry no contact data: a register file holds roll numbers, names, branches, programmes and years.
      </p>
    </div>
  );
}
