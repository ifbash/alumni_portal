import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { FileCheck2, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { Disclosure } from '@/components/ui';
import { getSession } from '@/lib/auth/session';
import { requireSession, can } from '@/lib/auth/guard';
import { getOwnProfile } from '@/lib/data/repo';
import { getTenantBrand } from '@/lib/tenant';
import { OTP_TTL_SECONDS } from '@/lib/config';
import { NotificationForm, type NotificationPrefs } from './NotificationForm';

/**
 * Notification preferences.
 *
 * Every switch is an opt-in the member can withdraw. What cannot be
 * withdrawn is named separately — a one-time sign-in code is not
 * marketing, and burying it in the same list as the newsletter is how a
 * member ends up unable to sign in because they turned "email" off. The
 * page describes preferences; it never says that anything has been sent.
 */

export const metadata: Metadata = {
  title: 'Notification settings',
};

export default async function NotificationSettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  requireSession(session);

  const profile = getOwnProfile(session);
  if (!profile) notFound();

  const resolved = await getTenantBrand();
  const pack = resolved?.brand.pack;

  const isStudent = profile.isStudent;
  // Students never see the donations module, so they are never offered
  // fundraising email either.
  const givingEnabled = Boolean(pack?.features.donations) && !isStudent && can(session, 'donation.give');

  const whatsappEnabled = Boolean(pack?.features.whatsapp);
  const editable = can(session, 'profile.write.own');
  const office = pack?.copy.officeName ?? 'alumni cell';

  const prefs: NotificationPrefs = {
    email: {
      connections: true,
      events: true,
      jobs: true,
      newsletter: !isStudent,
      giving: false,
    },
    // Nothing can be chosen on a channel the college has not set up.
    whatsapp: whatsappEnabled
      ? { connections: true, events: true, jobs: isStudent, newsletter: false, giving: false }
      : { connections: false, events: false, jobs: false, newsletter: false, giving: false },
    digest: 'weekly',
  };

  const otpMinutes = Math.round(OTP_TTL_SECONDS / 60);

  const mandatory = [
    {
      icon: KeyRound,
      title: 'Your sign-in code',
      body: `A code that works once, for ${otpMinutes} minutes. There is no password to fall back on.`,
    },
    {
      icon: ShieldCheck,
      title: 'Verification decisions',
      body: `When the ${office} approves or declines your registration.`,
    },
    {
      icon: FileCheck2,
      title: 'Data request receipts',
      body: 'When you ask for a copy, a correction or deletion, and when it is answered.',
    },
    {
      icon: Lock,
      title: 'Security notices',
      body: 'A role added to or removed from your account, or a change to your sign-in email.',
    },
  ];

  return (
    <>
      {editable ? (
        <NotificationForm
          initial={prefs}
          whatsappEnabled={whatsappEnabled}
          givingEnabled={givingEnabled}
          collegeName={pack?.copy.shortName ?? 'your college'}
          hasMobile={Boolean(profile.contact?.mobile)}
        />
      ) : (
        <div className="space-y-1">
          <h2 className="font-display text-xl font-semibold">Message preferences</h2>
          <p className="text-sm text-secondary">
            Your account has no member topics to choose from, only the messages below.
          </p>
        </div>
      )}

      <section aria-labelledby="always-sent" className="space-y-3">
        <h2 id="always-sent" className="sr-only">
          Messages with no switch
        </h2>
        <p className="text-sm text-secondary">
          Sign-in codes, verification decisions, data request receipts and security notices are not a
          preference, so there is no switch for them.
        </p>
        <Disclosure id="always-sent-detail" summary="What each of these is" defaultOpen={!editable}>
          <ul className="space-y-4">
            {mandatory.map((m) => (
              <li key={m.title} className="flex gap-3">
                <span
                  className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-surface-sunken text-secondary"
                  aria-hidden="true"
                >
                  <m.icon className="size-4" />
                </span>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-semibold text-primary">{m.title}</p>
                  <p className="text-sm text-secondary">{m.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Disclosure>
      </section>
    </>
  );
}
