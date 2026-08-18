import type { Metadata } from 'next';
import Link from 'next/link';
import { Compass, ScrollText } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { can } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { adminNav, type NavGroup } from '@/lib/navigation';
import {
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardTitle,
  EmptyState,
} from '@/components/ui';

export const metadata: Metadata = {
  title: 'Not found',
  robots: { index: false, follow: false },
};

/**
 * Not found, inside the staff console.
 *
 * The reader here holds at least one staff capability, so the honest
 * causes are different from a member's: a record that has been decided
 * and left the queue, a claim id from a stale tab, a screen that belongs
 * to a capability this account does not hold.
 *
 * The list of somewhere else to go is `adminNav` — the same tree the
 * console sidebar is built from — so an HOD is never offered the audit log
 * and a placement officer is never offered branding. Nothing here is
 * authorisation: every route below still calls `require()` for itself.
 */
export default async function AdminNotFound() {
  const session = await getSession();
  const resolved = await getTenantBrand();

  const groups: NavGroup[] = session && resolved ? adminNav(session, resolved.brand.pack) : [];
  // A link that renders and then 403s is worse than no link at all.
  const canReadAudit = session ? can(session, 'audit.read') : false;

  return (
    <div className="space-y-6">
      {/* The visual heading is the empty state's title; this is the one the
          document outline needs, so the h2s below descend from something. */}
      <h1 className="sr-only">Console screen not found</h1>

      <EmptyState
        icon={<Compass className="size-5" />}
        title="No such console screen"
        description="Either the address does not exist or it needs a capability this account does not hold. The console answers both the same way — a 404 that turns into a 403 for the right URL tells an attacker which URLs are the right ones."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/admin">Console home</ButtonLink>
            <ButtonLink href="/dashboard" variant="secondary">
              Back to the portal
            </ButtonLink>
          </div>
        }
      />

      {groups.length > 0 ? (
        <Card>
          <CardBody className="space-y-5">
            <div className="space-y-1">
              <CardTitle as="h2">What your roles open</CardTitle>
              <CardDescription>
                Derived from your capability grants, not from a hand-kept list. If a screen you
                expect is missing, the grant is missing — ask the college admin rather than the
                address bar.
              </CardDescription>
            </div>

            {groups.map((group) => (
              <div
                key={group.label}
                className="space-y-2 border-t border-line pt-4 first:border-0 first:pt-0"
              >
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
            <CardTitle as="h2">Why a console link goes stale</CardTitle>
            <CardDescription>All four are ordinary, none is a fault.</CardDescription>
          </div>

          <ul className="space-y-2 text-sm text-secondary">
            <li>
              <span className="font-medium text-primary">The claim was already decided.</span> A
              queued verification leaves the queue the moment somebody approves or rejects it, and
              two operators working the same list will hit this.
            </li>
            <li>
              <span className="font-medium text-primary">The record is outside your scope.</span> An
              HOD holds their branch and nothing else, so a claim from another branch is not
              missing — it is not theirs.
            </li>
            <li>
              <span className="font-medium text-primary">The member was deleted.</span> A fulfilled
              DPDP deletion removes the row; the audit entry describing the deletion stays.
            </li>
            <li>
              <span className="font-medium text-primary">The module is switched off.</span> Donations
              stay dark until the college confirms FCRA registration, and its console screens go with
              it.
            </li>
          </ul>

          <p className="flex items-start gap-2 border-t border-line pt-3 text-sm text-secondary">
            <ScrollText className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {canReadAudit ? (
              <span>
                If you are checking whether something was decided,{' '}
                <Link href="/admin/audit" className="link">
                  the audit log
                </Link>{' '}
                is the record — it holds who did what, with a before and after, and it is the one
                surface a deleted record still appears in.
              </span>
            ) : (
              <span>
                If you are checking whether something was decided, ask the college admin to look in
                the audit log. It holds who did what with a before and after, and reading it is a
                separate grant from the work you do here.
              </span>
            )}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
