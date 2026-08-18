import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getTenantBrand } from '@/lib/tenant';
import { getDemoAccounts } from '@/lib/data/repo';
import { IS_FIXTURE } from '@/lib/config';
import { LoginForm, type DemoAccountView } from './LoginForm';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to the alumni portal with a one-time code sent to your email address.',
};

/**
 * Sign-in.
 *
 * Guards itself in the only direction it can: an already-authenticated
 * visitor is sent to the portal rather than shown a second front door.
 *
 * `next` is sanitised here rather than in the client component. An
 * unchecked redirect target is how a sign-in page becomes a phishing
 * relay — only same-site absolute paths survive.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (session) redirect('/dashboard');

  const sp = await searchParams;
  const { brand } = (await getTenantBrand())!;
  const copy = brand.pack.copy;

  const rawNext = typeof sp.next === 'string' ? sp.next : undefined;
  const next = rawNext && /^\/(?!\/)/.test(rawNext) ? rawNext : undefined;

  const initialEmail = typeof sp.email === 'string' ? sp.email : '';

  // Only the three display fields cross into the client bundle. The
  // account's roles and member id stay on the server.
  const demoAccounts: DemoAccountView[] = IS_FIXTURE
    ? getDemoAccounts().map((a) => ({ email: a.email, label: a.label, description: a.description }))
    : [];

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-display-sm font-bold">Sign in</h1>
        <p className="text-secondary">
          {copy.portalName} sends a six-digit code to your email. There is no password to remember,
          and nothing to reset.
        </p>
      </header>

      <LoginForm
        demoAccounts={demoAccounts}
        supportEmail={copy.supportEmail}
        next={next}
        initialEmail={initialEmail}
      />
    </div>
  );
}
