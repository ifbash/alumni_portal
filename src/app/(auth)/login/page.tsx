import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { safeNextParam } from '@/lib/auth/route-policy';
import { getTenantBrand } from '@/lib/tenant';
import { getDemoAccounts } from '@/lib/data/repo';
import { IS_FIXTURE, OTP_TTL_SECONDS } from '@/lib/config';
import { inSentence } from '@/lib/branding/copy';
import { AuthHeader } from '../_components/AuthHeader';
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
  // The same allowlist the middleware applies when it builds this URL. A bare
  // "starts with one slash" test lets `/\evil.example` through, which a browser
  // reads as `//evil.example` - an open redirect after a real sign-in.
  const next = (rawNext && safeNextParam(rawNext)) || undefined;

  const initialEmail = typeof sp.email === 'string' ? sp.email : '';

  // Only the three display fields cross into the client bundle. The
  // account's roles and member id stay on the server.
  const demoAccounts: DemoAccountView[] = IS_FIXTURE
    ? getDemoAccounts().map((a) => ({ email: a.email, label: a.label, description: a.description }))
    : [];

  return (
    <div className="stagger mx-auto w-full max-w-md space-y-8">
      <AuthHeader title="Sign in">
        <p>
          Welcome back. We will email you a six-digit code — there is no password to remember.
        </p>
      </AuthHeader>

      <LoginForm
        demoAccounts={demoAccounts}
        next={next}
        initialEmail={initialEmail}
        rollMid={inSentence(copy.rollNumberLabel)}
        officeName={copy.officeName}
        otpMinutes={Math.round(OTP_TTL_SECONDS / 60)}
      />
    </div>
  );
}
