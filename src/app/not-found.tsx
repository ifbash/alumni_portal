import type { Metadata } from 'next';
import { Compass, Home, LogIn, Users } from 'lucide-react';
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
 * The address did not resolve.
 *
 * Deliberately does not distinguish "no such page" from "not a page you
 * may open". The portal has surfaces a member cannot reach — the
 * verification queue, the audit log, another college's tenant — and a 404
 * that turned into a 403 for the right URL would let anyone map the admin
 * area by trying addresses.
 *
 * It still has to be useful, so it names the ordinary causes. On a portal
 * shared over WhatsApp, a truncated link is the most common one by a
 * distance.
 */
export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-page items-center px-4 py-section sm:px-8">
      <div className="mx-auto w-full max-w-prose space-y-6 animate-fade-up">
        <EmptyState
          icon={<Compass className="size-5" />}
          title="That page is not here"
          description="The address did not match anything in the portal — or it is a page this account cannot open. Both answer the same way, on purpose."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/dashboard">
                <Home className="size-4" />
                Go to the portal
              </ButtonLink>
              <ButtonLink href="/directory" variant="secondary">
                <Users className="size-4" />
                Search the directory
              </ButtonLink>
            </div>
          }
        />

        <Card>
          <CardBody className="space-y-3">
            <div className="space-y-1">
              <CardTitle as="h2">The usual reasons</CardTitle>
              <CardDescription>In roughly the order they happen.</CardDescription>
            </div>

            <ul className="space-y-2 text-sm text-secondary">
              <li>
                <span className="font-medium text-primary">The link was cut short.</span> WhatsApp
                and SMS both truncate long addresses. Ask whoever sent it to share it again from the
                page itself.
              </li>
              <li>
                <span className="font-medium text-primary">You are signed out.</span> Almost nothing
                in this portal is public — the directory is never anonymous — so a session that has
                expired turns most links into this page.
              </li>
              <li>
                <span className="font-medium text-primary">It is a staff-side page.</span>{' '}
                Verification, the degree register and the audit log are restricted to the people who
                work on them.
              </li>
              <li>
                <span className="font-medium text-primary">The record has gone.</span> A member can
                ask for their profile to be removed, and the portal honours it the same day.
              </li>
            </ul>

            <p className="flex items-center gap-2 pt-1 text-sm text-secondary">
              <LogIn className="size-4 shrink-0" aria-hidden="true" />
              <span>
                Not signed in?{' '}
                <ButtonLink href="/login" variant="link">
                  Sign in with your email
                </ButtonLink>{' '}
                and try the link again.
              </span>
            </p>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
