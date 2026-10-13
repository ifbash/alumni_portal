import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getOwnProfile } from '@/lib/data/repo';
import type { MemberSummary } from '@/lib/data/types';
import { Breadcrumbs, PageHeader } from '@/components/ui';
import { jobReviewLine } from '@/lib/branding/copy';
import { viewerBatchYear, viewerBranch } from '@/lib/identity';
import { JobForm } from './JobForm';

export const metadata: Metadata = {
  title: 'Post a role',
  description: 'Share an opening with final-year students. Checked by the placement cell before it is listed.',
};

export default async function NewJobPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const { brand } = (await getTenantBrand())!;
  if (!brand.pack.features.jobs) notFound();

  // Alumni, faculty and the placement officer hold `job.post`. Students
  // hold `job.apply` and nothing else — the guard, not the hidden link, is
  // what stops them here.
  requireCap(session, 'job.post');

  const me = getOwnProfile(session);
  const pack = brand.pack;
  const shortName = pack.copy.shortName;

  // The preview's poster, built field by field from what a posting shows
  // (name, photo, branch, batch) and nothing else. The own-profile record
  // carries contact details and more; none of it crosses to the client.
  // A batch shows only for a holder of the alumni role.
  const poster: MemberSummary = {
    id: session.memberId,
    slug: me?.slug ?? '',
    fullName: me?.fullName ?? 'You',
    photoUrl: me?.photoUrl ?? null,
    batchYear: viewerBatchYear(session),
    departmentCode: viewerBranch(session),
    departmentName: null,
    currentCompany: null,
    designation: null,
    industry: null,
    city: null,
    state: null,
    country: null,
    skills: [],
    openToMentoring: false,
    openToReferrals: false,
    openToSpeaking: false,
    status: session.status,
    isStudent: false,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Jobs', href: '/jobs' },
              { label: 'Post a role' },
            ]}
          />
        }
        eyebrow="Jobs"
        title="Post a role"
        description={`${shortName} final-year students see it once the placement cell has checked it.`}
      />

      <JobForm
        defaultCompany={me?.currentCompany ?? ''}
        poster={poster}
        shortName={shortName}
        locale={pack.locale}
        reviewLine={jobReviewLine(pack.copy)}
      />
    </div>
  );
}
