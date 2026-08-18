import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { requireSession } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { StudentHome } from './StudentHome';
import { MemberHome } from './MemberHome';
import { StaffStrip } from './StaffStrip';

/**
 * The portal home.
 *
 * A final-year student and a 2017 graduate open the same URL and should
 * not get the same page with two cards swapped out. They arrive for
 * opposite reasons — one is looking for help, the other is deciding
 * whether to give any — so the route branches on the cohort and renders
 * one of two genuinely different screens.
 *
 * Staff capabilities are additive on top: an HOD who is also an alumnus
 * gets the alumni home *and* a strip into the console, because that is
 * what they are.
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

  return (
    <div className="space-y-8">
      <StaffStrip session={session} pack={pack} />
      {isStudent ? (
        <StudentHome session={session} pack={pack} />
      ) : (
        <MemberHome session={session} pack={pack} />
      )}
    </div>
  );
}
