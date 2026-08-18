import { AppShell } from '@/components/shell/AppShell';

/**
 * The vendor's own console — provisioning colleges, managing brand packs.
 *
 * Deliberately separate from the college admin console. A platform admin
 * can create a tenant and cannot read a single member row inside one;
 * see the capability grants in `lib/auth/permissions.ts`. Running the
 * infrastructure is not a reason to be able to read an alumnus's phone
 * number.
 */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <AppShell variant="platform">{children}</AppShell>;
}
