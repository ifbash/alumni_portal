import type { Metadata } from 'next';
import Link from 'next/link';
import { Compass } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getTenantBrand } from '@/lib/tenant';
import { adminNav, isVendorOnlySession, type NavGroup } from '@/lib/navigation';
import { ButtonLink, Card, CardBody, CardDescription, CardTitle, EmptyState } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Not found · Staff console',
  robots: { index: false, follow: false },
};

/**
 * Not found, inside the staff console.
 *
 * The honest causes here are a record that has been decided and left its
 * queue, a stale tab, or a page that needs a role this account does not
 * hold. The console answers all three the same way, so nobody can map it
 * by guessing addresses.
 *
 * The list of somewhere else to go is `adminNav`, the same tree the
 * console sidebar is built from. Nothing here is authorisation: every
 * route still guards itself.
 */
export default async function AdminNotFound() {
  const session = await getSession();
  const resolved = await getTenantBrand();

  const groups: NavGroup[] = session && resolved ? adminNav(session, resolved.brand.pack) : [];
  const vendorOnly = session ? isVendorOnlySession(session) : false;

  return (
    <div className="space-y-6">
      {/* The visual heading is the empty state's title; this is the one the
          document outline needs, so the h2 below descends from something. */}
      <h1 className="sr-only">Page not found</h1>

      <EmptyState
        icon={<Compass className="size-5" />}
        title="That page is not here"
        description="The record may have moved on, the link may be old, or the page needs a role your account does not hold."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/admin">Staff console</ButtonLink>
            {vendorOnly ? (
              <ButtonLink href="/platform" variant="secondary">
                Back to the platform
              </ButtonLink>
            ) : (
              <ButtonLink href="/dashboard" variant="secondary">
                Back to the portal
              </ButtonLink>
            )}
          </div>
        }
      />

      {groups.length > 0 ? (
        <Card>
          <CardBody className="space-y-5">
            <div className="space-y-1">
              <CardTitle as="h2">What your account opens</CardTitle>
              <CardDescription>
                The same list as the sidebar. If a page you need is missing, ask a college admin
                for the role.
              </CardDescription>
            </div>

            {groups.map((group) => (
              <div
                key={group.label}
                className="space-y-2 border-t border-line pt-4 first:border-0 first:pt-0"
              >
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
                        <span className="block text-sm font-medium">
                          {item.label}
                          {item.tag ? (
                            <span className="ml-1.5 text-xs font-normal text-secondary">{item.tag}</span>
                          ) : null}
                        </span>
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
