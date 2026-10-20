import type { Metadata } from 'next';
import Link from 'next/link';
import { Compass, Home, Users } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { StatusPanel } from '@/components/status/StatusPanel';

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
    <main id="main" className="mx-auto flex min-h-dvh max-w-page items-center px-4 py-10 sm:px-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <StatusPanel
          icon={<Compass aria-hidden="true" />}
          eyebrow="Page not found"
          title="That page is not here"
          glyph="404"
          actions={
            <>
              <ButtonLink href="/dashboard" variant="band" size="lg">
                <Home className="size-4" aria-hidden="true" />
                Go to the portal
              </ButtonLink>
              <ButtonLink href="/directory" variant="band-outline" size="lg">
                <Users className="size-4" aria-hidden="true" />
                Search the directory
              </ButtonLink>
            </>
          }
        >
          <p>
            The address did not match anything in the portal, or it is a page this account cannot
            open. Both look the same, on purpose.
          </p>
        </StatusPanel>

        <section aria-labelledby="usual-reasons" className="px-1">
          <h2 id="usual-reasons" className="eyebrow text-brand-fg">
            The usual reasons
          </h2>
          <ul className="mt-3 space-y-2.5 text-sm text-secondary">
            <li>
              <span className="font-medium text-primary">The link was cut short.</span> WhatsApp and
              SMS both shorten long addresses. Ask whoever sent it to share it again from the page
              itself.
            </li>
            <li>
              <span className="font-medium text-primary">You are signed out.</span> Almost nothing
              here is public, so a session that has expired turns most links into this page.{' '}
              <Link href="/login" className="link">
                Sign in with your email address
              </Link>{' '}
              and try the link again.
            </li>
            <li>
              <span className="font-medium text-primary">It is a staff page.</span> Verification,
              the degree register and the audit log are open only to the people who work on them.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
