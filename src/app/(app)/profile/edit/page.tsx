import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Breadcrumbs, PageHeader } from '@/components/ui';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getOwnProfile } from '@/lib/data/repo';
import { getTenantBrand } from '@/lib/tenant';
import { ProfileForm, type ProfileFormValues } from './ProfileForm';

/**
 * Edit your own profile.
 *
 * Guarded on `profile.write.own` rather than on ownership alone: a
 * finance or platform account can sign in and read its record, but has no
 * grant to edit member data anywhere, including on itself. The form is a
 * client leaf; everything it needs is resolved here on the server and
 * handed down, because a client component cannot be trusted with — or
 * even reach — the repository.
 */

export const metadata: Metadata = {
  title: 'Edit profile',
};

export default async function ProfileEditPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  requireCap(session, 'profile.write.own');

  const profile = getOwnProfile(session);
  if (!profile) notFound();

  const resolved = await getTenantBrand();
  const supportEmail = resolved?.brand.pack.copy.supportEmail ?? null;

  const values: ProfileFormValues = {
    fullName: profile.fullName,
    preferredName: profile.preferredName ?? '',
    photoUrl: profile.photoUrl ?? '',
    bio: profile.bio ?? '',
    designation: profile.designation ?? '',
    currentCompany: profile.currentCompany ?? '',
    industry: profile.industry ?? '',
    city: profile.city ?? '',
    state: profile.state ?? '',
    country: profile.country ?? 'IN',
    skills: profile.skills,
    openToMentoring: profile.openToMentoring,
    openToReferrals: profile.openToReferrals,
    openToSpeaking: profile.openToSpeaking,
    mobile: profile.contact?.mobile ?? '',
    linkedin: profile.contact?.linkedin ?? '',
    github: profile.contact?.github ?? '',
    portfolio: profile.contact?.portfolio ?? '',
    employment: profile.employment,
    education: profile.education,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'My profile', href: '/profile' },
              { label: 'Edit' },
            ]}
          />
        }
        title="Edit your profile"
        description="Changes appear in the directory as soon as you save. Your contact details are stored separately and are not published by adding them here."
      />

      <ProfileForm
        values={values}
        identity={{
          rollNumber: profile.rollNumber ?? null,
          programme: profile.programme,
          departmentName: profile.departmentName,
          departmentCode: profile.departmentCode,
          batchYear: profile.batchYear,
          admissionYear: profile.admissionYear,
          email: profile.contact?.email ?? null,
          verifiedAt: profile.verifiedAt,
          isStudent: profile.isStudent,
        }}
        supportEmail={supportEmail}
      />
    </div>
  );
}
