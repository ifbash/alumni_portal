import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { requireSession } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { StudentHome } from './StudentHome';
import { MemberHome } from './MemberHome';
import { PendingHome } from './PendingHome';
import { CommunityStrip } from '@/components/community/CommunityStrip';

/**
 * The portal home.
 *
 * A final-year student and a 2017 graduate open the same URL and should
 * not get the same page with two cards swapped out. They arrive for
 * opposite reasons — one is looking for help, the other is deciding
 * whether to give any — so the route branches on the cohort and renders
 * one of genuinely different screens:
 *
 *  - no roles yet (a registration still being checked): `PendingHome`,
 *    which shows no member data at all;
 *  - a final-year student: `StudentHome`;
 *  - everyone else, alumni, faculty and staff: `MemberHome`, whose blocks
 *    are each gated on a capability. Staff queues arrive through
 *    `staffTasks()` in its "Needs you" list, so an HOD who is also an
 *    alumnus gets the alumni home and their queue in one place.
 */

export const metadata: Metadata = {
  title: 'Home',
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  // Authorisation, not decoration: the shell hides links, this refuses.
  requireSession(session);

  const resolved = await getTenantBrand();
  if (!resolved) redirect('/login');

  const pack = resolved.brand.pack;
  const isStudent = session.roles.some((r) => r.role === 'student');

  if (session.roles.length === 0) return <PendingHome session={session} pack={pack} />;
  // The home for the cohort, then a short strip of what is happening in the
  // community. The strip draws nothing when the college has the modules off
  // or has nothing to show, so it never leaves an empty box.
  return (
    <>
      {isStudent ? <StudentHome session={session} pack={pack} /> : <MemberHome session={session} pack={pack} />}
      <CommunityStrip session={session} pack={pack} />
    </>
  );
}
