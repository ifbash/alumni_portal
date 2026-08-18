import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { getSession } from '@/lib/auth/session';
import { requireSession } from '@/lib/auth/guard';
import { getDataRequests } from '@/lib/data/repo';
import { SettingsTabs } from './SettingsTabs';

/**
 * Settings frame.
 *
 * The `<h1>` lives here, once, and each section contributes `<h2>`s
 * underneath it — a tab bar that changes the heading level of the page it
 * sits above produces a document outline no screen reader can follow.
 *
 * The count on "Your data" is the member's own open DPDP requests. A
 * statutory clock the member cannot see running is a clock nobody
 * chases.
 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  requireSession(session);

  const openDataRequests = getDataRequests().filter(
    (r) => r.memberId === session.memberId && r.state !== 'fulfilled' && r.state !== 'refused',
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Your sign-in, who can reach you, what the portal sends you, and the data the college holds about you."
      />

      <SettingsTabs openDataRequests={openDataRequests} />

      <div className="max-w-3xl space-y-6">{children}</div>
    </div>
  );
}
