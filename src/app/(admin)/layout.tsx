import { AppShell } from '@/components/shell/AppShell';

/**
 * The staff console frame.
 *
 * `AppShell` sends a member with no admin capabilities back to the
 * portal, so the console is never rendered empty. That is a convenience,
 * not the security boundary — every route below still calls
 * `require(session, …)` for the specific capability it needs.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell variant="admin">{children}</AppShell>;
}
