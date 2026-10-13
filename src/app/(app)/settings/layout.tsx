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
 * underneath it. At lg the sections are a left-hand list beside the
 * content; on phones they are a tab strip that scrolls sideways.
 *
 * The count on "Your data" is the member's own open data requests. A
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
        description="Your account, who can reach you, what you are sent, and your data."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-gutter">
        <SettingsTabs openDataRequests={openDataRequests} />
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </div>
  );
}
