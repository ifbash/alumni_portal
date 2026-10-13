import type { Metadata } from 'next';
import { AppShell } from '@/components/shell/AppShell';
import { housePack } from '@/lib/branding/registry';

/**
 * The vendor's own console — provisioning colleges, managing brand packs.
 *
 * Deliberately separate from the college admin console. A platform admin
 * can create a college and cannot read a single member row inside one;
 * see the capability grants in `lib/auth/permissions.ts`. Running the
 * infrastructure is not a reason to be able to read an alumnus's phone
 * number.
 *
 * It is the vendor's tool, so it wears the house brand: the shell swaps
 * the tokens for the whole document, and the title and favicon follow
 * here. Which college the request resolved to does not change.
 */
export function generateMetadata(): Metadata {
  const house = housePack();
  const name = `${house.copy.shortName} platform`;

  return {
    title: { template: `%s · ${name}`, default: name },
    applicationName: name,
    icons: house.assets.favicon ? { icon: house.assets.favicon, apple: house.assets.favicon } : undefined,
    robots: { index: false, follow: false },
  };
}

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <AppShell variant="platform">{children}</AppShell>;
}
