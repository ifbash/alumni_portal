import { AppShell } from '@/components/shell/AppShell';

/**
 * The member portal frame. Every route in this group is behind auth —
 * `AppShell` redirects to /login when there is no session, so no page in
 * here needs to repeat the check for *authentication*. Each still guards
 * its own *authorisation*.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell variant="member">{children}</AppShell>;
}
