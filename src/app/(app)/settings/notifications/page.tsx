import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { KeyRound, Lock, ShieldCheck, FileCheck2 } from 'lucide-react';
import { Alert, Card, CardBody, CardDescription, CardHeader, CardTitle, Section } from '@/components/ui';
import { getSession } from '@/lib/auth/session';
import { requireSession, can } from '@/lib/auth/guard';
import { getOwnProfile } from '@/lib/data/repo';
import { getTenantBrand } from '@/lib/tenant';
import { NotificationForm, type NotificationPrefs } from './NotificationForm';

/**
 * Notifications.
 *
 * Every switch here is an opt-in the member can withdraw. What cannot be
 * withdrawn is listed separately and named — a one-time sign-in code is
 * not marketing, and burying it in the same list as the newsletter is how
 * a member ends up unable to log in because they turned "email" off.
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

  const prefs: NotificationPrefs = {
    email: {
      connections: true,
      events: true,
      jobs: true,
      newsletter: !isStudent,
      giving: false,
    },
    whatsapp: {
      connections: true,
      events: true,
      jobs: isStudent,
      newsletter: false,
      giving: false,
    },
    digest: 'weekly',
  };

  return (
    <>
      <Section
        title="What the portal sends you"
        description="Two channels, set independently. Email reaches the address you sign in with; WhatsApp reaches the number on your account."
      >
        {!profile.contact?.mobile ? (
          <Alert tone="warning" title="No mobile number on your account">
            WhatsApp messages have nowhere to go until you add one. You can add it on the{' '}
            <Link href="/settings" className="link">
              account tab
            </Link>
            .
          </Alert>
        ) : null}

        <NotificationForm
          initial={prefs}
          whatsappEnabled={Boolean(pack?.features.whatsapp)}
          givingEnabled={givingEnabled}
          collegeName={pack?.copy.shortName ?? 'The college'}
        />
      </Section>

      <Section title="What you cannot switch off">
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle as="h3" className="text-md">
                Four messages are sent regardless
              </CardTitle>
              <CardDescription>
                Each one either lets you into the account or tells you a decision was made about
                you. None of them is a newsletter in disguise.
              </CardDescription>
            </div>
            <Lock className="size-5 shrink-0 text-muted" aria-hidden="true" />
          </CardHeader>

          <CardBody>
            <ul className="space-y-4">
              {MANDATORY.map((m) => (
                <li key={m.title} className="flex gap-3">
                  <span
                    className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-surface-sunken text-muted"
                    aria-hidden="true"
                  >
                    <m.icon className="size-4" />
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold">{m.title}</p>
                    <p className="text-sm text-secondary">{m.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <p className="text-sm text-secondary">
          The portal never sells or rents your address, and no third party sends on the
          college&rsquo;s behalf except the mail and WhatsApp providers that carry the message.
        </p>
      </Section>
    </>
  );
}

const MANDATORY = [
  {
    icon: KeyRound,
    title: 'Your sign-in code',
    body: 'A six-digit code, valid ten minutes, used once. Without it you cannot get in — there is no password to fall back on.',
  },
  {
    icon: ShieldCheck,
    title: 'Verification decisions',
    body: 'When the alumni cell approves or rejects your claim against the degree register, and why.',
  },
  {
    icon: FileCheck2,
    title: 'Data request receipts',
    body: 'An acknowledgement when you ask for an export, a correction or deletion, and the answer when it is done.',
  },
  {
    icon: Lock,
    title: 'Security notices',
    body: 'A role granted to or removed from your account, and any change to the address you sign in with.',
  },
];
