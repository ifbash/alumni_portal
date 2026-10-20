import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { safeNextParam } from '@/lib/auth/route-policy';
import { getTenantBrand } from '@/lib/tenant';
import { IS_FIXTURE, OTP_MAX_ATTEMPTS, OTP_TTL_SECONDS } from '@/lib/config';
import { AuthHeader } from '../_components/AuthHeader';
import { OtpForm } from './OtpForm';

export const metadata: Metadata = {
  title: 'Enter your code',
  description: 'Enter the six-digit sign-in code sent to your email address.',
};

/**
 * Code entry.
 *
 * The email arrives as a query parameter rather than in a cookie or a
 * server-held step, because people close the tab, open the mail app and
 * come back through the link. The address alone reveals nothing and
 * proves nothing — the code is what authenticates.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (session) redirect('/dashboard');

  const sp = await searchParams;
  const email = typeof sp.email === 'string' ? sp.email.trim() : '';
  if (!email) redirect('/login');

  const rawNext = typeof sp.next === 'string' ? sp.next : undefined;
  // The same allowlist the middleware applies when it builds this URL. A bare
  // "starts with one slash" test lets `/\evil.example` through, which a browser
  // reads as `//evil.example` - an open redirect after a real sign-in.
  const next = (rawNext && safeNextParam(rawNext)) || undefined;

  const { brand } = (await getTenantBrand())!;
  const copy = brand.pack.copy;

  return (
    <div className="stagger space-y-6">
      <AuthHeader icon={<Mail className="size-5" />} title="Check your email" className="pb-2">
        <p>
          A six-digit code is on its way to{' '}
          <span className="break-all font-medium text-primary">{email}</span>. Enter it below and you
          are in.
        </p>
        <p className="text-sm">
          Wrong address?{' '}
          <Link href={`/login?email=${encodeURIComponent(email)}`} className="link">
            Use a different one
          </Link>
          .
        </p>
      </AuthHeader>

      <OtpForm
        email={email}
        next={next}
        ttlSeconds={OTP_TTL_SECONDS}
        maxAttempts={OTP_MAX_ATTEMPTS}
        isFixture={IS_FIXTURE}
        supportEmail={copy.supportEmail}
      />
    </div>
  );
}
