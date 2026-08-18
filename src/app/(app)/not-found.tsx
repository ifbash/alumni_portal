import type { Metadata } from 'next';
import Link from 'next/link';
import { Compass, LifeBuoy } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getTenantBrand } from '@/lib/tenant';
import { memberNav, type NavGroup } from '@/lib/navigation';
import {
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardTitle,
  EmptyState,
} from '@/components/ui';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

/**
 * Not found, inside the portal.
 *
 * Two things separate this from the root 404. The reader is signed in, so
 * "you may be signed out" is not one of the explanations — saying it would
 * send them to re-authenticate for no reason. And the list of somewhere
 * else to go is not hand-written: it is `memberNav`, the same
 * capability- and feature-filtered tree the sidebar draws from, so it can
 * never offer a student the donations module or a college without events
 * an events link.
 *
 * Like the root 404 it does not distinguish "no such page" from "not a
 * page you may open". A 404 that turns into a 403 for the right URL lets
 * anyone map the staff console by guessing addresses.
 */
export default async function AppNotFound() {
  const session = await getSession();
  const resolved = await getTenantBrand();

  const groups: NavGroup[] =
    session && resolved ? memberNav(session, resolved.brand.pack) : [];

  return (
    <div className="space-y-6">
      {/* The visual heading is the empty state's title; this is the one the
          document outline needs, so the h2s below descend from something. */}
      <h1 className="sr-only">Page not found</h1>

      <EmptyState
        icon={<Compass className="size-5" />}
        title="That page is not here"
        description="The address did not match anything in the portal — or it is a page this account cannot open. Both answer the same way, on purpose, so that nobody can map the staff console by guessing addresses."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/dashboard">Back to the portal</ButtonLink>
            <ButtonLink href="/notifications" variant="secondary">
              What you have missed
            </ButtonLink>
          </div>
        }
      />

      {groups.length > 0 ? (
        <Card>
          <CardBody className="space-y-5">
            <div className="space-y-1">
              <CardTitle as="h2">Everything your account can open</CardTitle>
              <CardDescription>
                This is the whole of your portal — the same list the sidebar shows, built from what
                your roles allow and what your college has switched on.
              </CardDescription>
            </div>

            {groups.map((group) => (
              <div key={group.label} className="space-y-2 border-t border-line pt-4 first:border-0 first:pt-0">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {group.label}
                </h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="block rounded border border-line px-3.5 py-2.5 transition-colors duration-fast ease-brand hover:border-line-strong hover:bg-surface-sunken"
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

      <Card>
        <CardBody className="space-y-3">
          <div className="space-y-1">
            <CardTitle as="h2">Why a link stops working</CardTitle>
            <CardDescription>In roughly the order it happens here.</CardDescription>
          </div>

          <ul className="space-y-2 text-sm text-secondary">
            <li>
              <span className="font-medium text-primary">The link was cut short.</span> WhatsApp and
              SMS both truncate long addresses. Ask whoever sent it to share it again using the
              share control on the page itself.
            </li>
            <li>
              <span className="font-medium text-primary">The record was removed.</span> A member can
              ask for their profile to be deleted, and the college honours it. Their old directory
              link becomes this page the same day.
            </li>
            <li>
              <span className="font-medium text-primary">The event or job closed.</span> Past events
              and expired postings drop out of the portal rather than sitting there looking open.
            </li>
            <li>
              <span className="font-medium text-primary">It belongs to the staff console.</span> The
              verification queue, the degree register and the audit log are restricted to the people
              who work on them.
            </li>
          </ul>

          <p className="flex items-start gap-2 border-t border-line pt-3 text-sm text-secondary">
            <LifeBuoy className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              If you were sent this link by the college and it should work, tell the alumni cell
              which page it was meant to be — they can check whether the record is still there.
            </span>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
