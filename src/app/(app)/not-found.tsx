import type { Metadata } from 'next';
import Link from 'next/link';
import { Compass } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getTenantBrand } from '@/lib/tenant';
import { isVendorOnlySession, memberNav, type NavGroup } from '@/lib/navigation';
import { ButtonLink, Card, CardBody, CardDescription, CardTitle } from '@/components/ui';
import { NotFoundPanel } from './_components/NotFoundPanel';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

/**
 * Not found, inside the portal.
 *
 * The reader is signed in, so "you may be signed out" is not one of the
 * explanations. The list of somewhere else to go is `memberNav`, the same
 * capability- and feature-filtered tree the sidebar draws from, so it can
 * never offer a student the donations module.
 *
 * It does not distinguish "no such page" from "not a page you may open".
 * A 404 that turns into a 403 for the right address lets anyone map the
 * staff console by guessing.
 */
export default async function AppNotFound() {
  const session = await getSession();
  const resolved = await getTenantBrand();

  const groups: NavGroup[] =
    session && resolved ? memberNav(session, resolved.brand.pack) : [];
  const vendorOnly = session ? isVendorOnlySession(session) : false;

  return (
    <div className="space-y-6">
      <NotFoundPanel
        eyebrow="Page not found"
        icon={<Compass />}
        title="That page is not here"
        description="The link may be old or cut short, or the page is not open to your account."
        action={
          vendorOnly ? (
            <ButtonLink href="/platform" className="min-h-11">
              Back to the platform
            </ButtonLink>
          ) : (
            <ButtonLink href="/dashboard" className="min-h-11">
              Back to home
            </ButtonLink>
          )
        }
      />

      {groups.length > 0 ? (
        <Card>
          <CardBody className="space-y-5">
            <div className="space-y-1">
              <CardTitle as="h2">Where you can go</CardTitle>
              <CardDescription>
                Everything your account opens, as the sidebar lists it. If someone sent you the
                link, ask them to share it again from the page itself.
              </CardDescription>
            </div>

            {groups.map((group) => (
              <div key={group.label} className="space-y-2 border-t border-line pt-4 first:border-0 first:pt-0">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary">
                  {group.label}
                </h3>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {group.items.map((item) => (
                    <li key={item.href} className="min-w-0">
                      <Link
                        href={item.href}
                        className="flex min-h-11 flex-col justify-center rounded border border-line px-3.5 py-2.5 transition-colors duration-fast ease-brand hover:border-line-strong hover:bg-surface-sunken"
                      >
                        <span className="block text-sm font-medium">{item.label}</span>
                        {item.description ? (
                          <span className="block text-xs text-secondary">{item.description}</span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
