import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Eye } from 'lucide-react';
import Link from 'next/link';
import { Avatar, Breadcrumbs, ButtonLink, PageHeader } from '@/components/ui';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getOwnProfile } from '@/lib/data/repo';
import { getTenantBrand } from '@/lib/tenant';
import { isVendorOnlySession } from '@/lib/navigation';
import { CONNECTION_LIMITS } from '@/lib/config';
import { completenessScore, profileChecks } from '../completeness';
import { CompletenessRing } from '../CompletenessRing';
import { ProfileForm, type ProfileFormCollege, type ProfileFormValues } from './ProfileForm';

/**
 * Edit your own profile.
 *
 * Guarded on `profile.write.own` rather than on ownership alone: a
 * finance or platform account can sign in and read its record, but has no
 * grant to edit member data anywhere, including on itself. The form is a
 * client leaf; everything it needs is resolved here on the server and
 * handed down field by field. Contact details go to the owner's own form
 * only; nothing placement-side is passed.
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
  const pack = resolved?.brand.pack;
  const supportEmail = pack?.copy.supportEmail ?? null;

  const roles = new Set(profile.roles.map((r) => r.role));
  const college: ProfileFormCollege = {
    shortName: pack?.copy.shortName ?? 'college',
    officeName: pack?.copy.officeName ?? 'alumni cell',
    rollNumberLabel: pack?.copy.rollNumberLabel ?? 'Roll number',
    whatsapp: Boolean(pack?.features.whatsapp),
    audience: (roles.has('faculty') || roles.has('hod')) && !roles.has('alumni') ? 'faculty' : 'alumni',
    openLimit: CONNECTION_LIMITS.studentOpenRequests,
  };
  const previewable = Boolean(pack?.features.directory) && !isVendorOnlySession(session);

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

  const checks = profileChecks(profile);
  const score = completenessScore(checks);
  const missing = checks.filter((c) => !c.done);

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
        eyebrow="My profile"
        title="Edit your profile"
        description="Your name and college record are fixed. Everything else here is yours to change."
        actions={
          previewable ? (
            <ButtonLink href="/profile/preview" variant="secondary" className="min-h-11">
              <Eye className="size-4" aria-hidden="true" />
              What others see
            </ButtonLink>
          ) : null
        }
      />

      {/* Who is being edited, and how finished the record is. Each missing
          item jumps to the field that fills it. */}
      <div className="ring-hairline relative flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-line bg-surface-raised p-4 shadow-sm">
        <CompletenessRing score={score}>
          <Avatar name={profile.fullName} src={profile.photoUrl} size="xl" />
        </CompletenessRing>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="font-display text-lg font-semibold">{profile.fullName}</p>
          {missing.length ? (
            <>
              <p className="text-sm text-secondary">
                {missing.length === 1 ? 'One thing left to finish:' : `${missing.length} things left to finish:`}
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {missing.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={c.href}
                      className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-3 text-sm font-medium text-brand-fg transition-colors duration-fast ease-brand hover:border-line-strong sm:min-h-8"
                    >
                      {c.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-secondary">Your profile is complete.</p>
          )}
        </div>
      </div>

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
        college={college}
      />
    </div>
  );
}
