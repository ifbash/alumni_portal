import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { Alert, PageHeader } from '@/components/ui';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getOwnProfile } from '@/lib/data/repo';
import { NOTICE_VERSION } from '@/lib/config';
import { profileChecks } from '../profile/completeness';
import { WelcomeWizard } from './WelcomeWizard';

/**
 * First run.
 *
 * The screen a member sees once, immediately after their first successful
 * OTP. Three decisions shape it:
 *
 *  1. **Every step is skippable and says so on the button.** A wall that
 *     demands a mobile number before the directory can be seen is how a
 *     2014 graduate closes the tab and never returns. The portal is more
 *     useful with a filled profile; it is not useless without one.
 *  2. **Each step explains what the field buys the member**, not what the
 *     college wants. "Add your city" is a demand. "Batch meets are
 *     organised city by city, and an unlisted city gets no invitation" is
 *     a reason.
 *  3. **The gaps come from `profileChecks()`**, the same function the
 *     profile page scores against. Two lists of "what is missing" that
 *     drift apart is one list nobody trusts.
 */

export const metadata: Metadata = {
  title: 'Welcome',
};

export default async function WelcomePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Every step of this wizard writes the member's own record. A staff role
  // without that capability has nothing to complete here, and /api/profile
  // would refuse the save regardless — better to say so at the door.
  requireCap(session, 'profile.write.own');

  const profile = getOwnProfile(session);
  if (!profile) notFound();

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;

  const checks = profileChecks(profile);
  const missing = checks.filter((c) => !c.done);

  const firstName = (profile.preferredName ?? profile.fullName).split(' ')[0] ?? profile.fullName;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        eyebrow="First sign-in"
        title={`Welcome, ${firstName}`}
        description={
          profile.isStudent
            ? `Four short steps, and you can skip any of them. They exist so the alumni you write to can tell at a glance who is asking — nothing here is required to use ${pack.copy.shortName}.`
            : `Four short steps, and you can skip any of them. They exist so your batch can find you and so students ask you only what you are willing to be asked. Nothing here is required to use ${pack.copy.shortName}.`
        }
      />

      {missing.length === 0 ? (
        <Alert
          tone="success"
          title="Your profile is already complete"
          icon={<CheckCircle2 className="size-4" />}
        >
          Everything the directory searches on is filled in. Run through the steps anyway if you
          want to change what you are open to, or{' '}
          <Link href="/dashboard" className="link">
            go straight to your dashboard
          </Link>
          .
        </Alert>
      ) : null}

      <WelcomeWizard
        isStudent={profile.isStudent}
        checks={checks}
        noticeVersion={NOTICE_VERSION}
        shortName={pack.copy.shortName}
        // Feature flags decide what the copy may honestly promise. Telling
        // an alumnus that students will send mentorship requests, on a
        // tenant where connections are switched off, is a lie the switch
        // itself cannot deliver on.
        connectionsOn={pack.features.connections}
        mentorshipOn={pack.features.mentorship}
        directoryOn={pack.features.directory}
        values={{
          currentCompany: profile.currentCompany ?? '',
          designation: profile.designation ?? '',
          industry: profile.industry ?? '',
          city: profile.city ?? '',
          state: profile.state ?? '',
          country: profile.country ?? 'IN',
          skills: profile.skills,
          openToMentoring: profile.openToMentoring,
          openToReferrals: profile.openToReferrals,
          openToSpeaking: profile.openToSpeaking,
          visibility: profile.contact?.visibility ?? 'on_accept',
        }}
      />
    </div>
  );
}
