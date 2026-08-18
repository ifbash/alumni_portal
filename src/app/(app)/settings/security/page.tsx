import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import {
  Clock,
  Cookie,
  KeyRound,
  Laptop,
  Lock,
  LogOut,
  Mail,
  MonitorSmartphone,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  DetailRow,
  Section,
} from '@/components/ui';
import { getSession } from '@/lib/auth/session';
import { requireSession } from '@/lib/auth/guard';
import { getOwnProfile } from '@/lib/data/repo';
import { getTenantBrand } from '@/lib/tenant';
import { ROLE_LABELS } from '@/lib/navigation';
import { SESSION_COOKIE, OTP_TTL_SECONDS, OTP_MAX_ATTEMPTS } from '@/lib/config';
import { formatDateTime } from '@/lib/format';

/**
 * Security.
 *
 * The page's only job is to be accurate. A security screen that describes
 * protections the product does not have is worse than no security screen,
 * because it is the one page a cautious member will quote back at the
 * college later.
 *
 * So: there is no per-device session list, and this page says so and
 * explains why rather than rendering a plausible-looking table of
 * "Chrome on Windows · Vijayawada". The session is a self-contained signed
 * cookie; the server keeps no record of the ones it has issued, which is
 * exactly why there is nothing to enumerate and nothing to revoke one at a
 * time. What *does* work — suspending the account, which strips every
 * capability on the next request on every device — is stated in its place.
 */

export const metadata: Metadata = {
  title: 'Security',
};

/**
 * Mirrors `MAX_AGE` in `src/lib/auth/session.ts`, which does not export it.
 * Duplicated rather than guessed at; if the cookie lifetime changes there,
 * this number is wrong and the honest fix is to export it from the module
 * that owns it.
 */
const SESSION_DAYS = 14;

/**
 * The issue time carried by the current cookie.
 *
 * Read *after* `getSession()` has returned a session, which means the HMAC
 * over this payload has already been verified — this is decoding a claim
 * the server has authenticated, not trusting cookie text. `getSession()`
 * drops `issuedAt` on its way to the `Session` shape, so it is recovered
 * here rather than reimplementing any part of the signing.
 */
async function issuedAt(): Promise<Date | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const body = token?.split('.')[0];
  if (!body) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as { issuedAt?: unknown };
    if (typeof payload.issuedAt !== 'number') return null;
    const d = new Date(payload.issuedAt);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export default async function SecuritySettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  requireSession(session);

  const profile = getOwnProfile(session);
  if (!profile) notFound();

  const resolved = await getTenantBrand();
  const pack = resolved?.brand.pack;
  const timing = pack ? { locale: pack.locale.locale, timeZone: pack.locale.timeZone } : {};
  const supportEmail = pack?.copy.supportEmail ?? null;
  const supportPhone = pack?.copy.supportPhone ?? null;

  const issued = await issuedAt();
  const expires = issued ? new Date(issued.getTime() + SESSION_DAYS * 86400000) : null;

  const otpMinutes = Math.round(OTP_TTL_SECONDS / 60);

  return (
    <>
      {/* ---- This session ------------------------------------------------ */}

      <Section
        title="This session"
        description="One browser on one device. Everything below describes the cookie sitting in the browser you are reading this in."
      >
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle as="h3" className="text-md">
                Signed in as {profile.fullName}
              </CardTitle>
              <CardDescription>
                Started when you entered a one-time code. It ends when you sign out, or {SESSION_DAYS}{' '}
                days after it started — whichever comes first.
              </CardDescription>
            </div>
            <Laptop className="size-5 shrink-0 text-muted" aria-hidden="true" />
          </CardHeader>

          <CardBody className="space-y-4">
            <dl className="divide-y divide-line">
              <DetailRow label="Account">
                <span className="font-mono">{profile.contact?.email ?? '—'}</span>
              </DetailRow>
              <DetailRow label="Signed in">
                {issued ? (
                  formatDateTime(issued, timing)
                ) : (
                  <span className="text-muted">
                    Not readable — the cookie is present but its issue time could not be decoded.
                  </span>
                )}
              </DetailRow>
              <DetailRow label="Expires">
                {expires ? (
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span>{formatDateTime(expires, timing)}</span>
                    <span className="text-xs text-muted">
                      {SESSION_DAYS} days from sign-in. It is not extended by using the portal.
                    </span>
                  </span>
                ) : (
                  <span className="text-muted">Unknown</span>
                )}
              </DetailRow>
              <DetailRow label="Roles in force">
                <span className="flex flex-wrap items-center gap-1.5">
                  {profile.roles.map((r) => (
                    <Badge key={`${r.role}-${r.departmentCode ?? 'all'}`} tone="brand">
                      {ROLE_LABELS[r.role] ?? r.role}
                      {r.departmentCode ? ` · ${r.departmentCode}` : ''}
                    </Badge>
                  ))}
                </span>
              </DetailRow>
            </dl>

            <Alert tone="neutral" title="Your roles are re-read on every request" icon={<Clock className="size-4" />}>
              They are not stored in the cookie. If the college grants or removes a role, the change
              takes effect on your next page load rather than whenever your cookie happens to
              expire — which is also why a revoked role cannot be kept alive by staying signed in.
            </Alert>

            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <ButtonLink href="/logout" variant="secondary" size="sm">
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </ButtonLink>
              <p className="text-xs text-muted">
                Clears the cookie in this browser and sends you to the public page. Other devices are
                unaffected — see below.
              </p>
            </div>
          </CardBody>
        </Card>
      </Section>

      {/* ---- Credential -------------------------------------------------- */}

      <Section
        title="Your credential"
        description="There is one, it arrives by email, and it works once."
      >
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle as="h3" className="text-md">
                Email one-time code
              </CardTitle>
              <CardDescription>
                No password exists on this portal for anybody, at any role. There is nothing to
                reuse from another site, nothing to leak in a breach, and nothing an attacker can
                phish out of you that is still valid a minute later.
              </CardDescription>
            </div>
            <KeyRound className="size-5 shrink-0 text-muted" aria-hidden="true" />
          </CardHeader>

          <CardBody className="space-y-4">
            <dl className="divide-y divide-line">
              <DetailRow label="Code lifetime">
                {otpMinutes} minutes from the moment it is sent
              </DetailRow>
              <DetailRow label="Reuse">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span>Single use</span>
                  <span className="text-xs text-muted">
                    The code is deleted the instant it is accepted. A code that still works after
                    you have signed in is a code that works for whoever else read the message.
                  </span>
                </span>
              </DetailRow>
              <DetailRow label="Wrong guesses">
                {OTP_MAX_ATTEMPTS} attempts, then that code is dead and a fresh one must be
                requested
              </DetailRow>
              <DetailRow label="Asking again">
                A new code replaces the previous one. Only the newest code in your inbox works.
              </DetailRow>
              <DetailRow label="Storage">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span>Hashed</span>
                  <span className="text-xs text-muted">
                    The portal keeps a keyed hash of the code, never the digits, and compares in
                    constant time.
                  </span>
                </span>
              </DetailRow>
              <DetailRow label="Rate limiting">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span>By email address and by network address</span>
                  <span className="text-xs text-muted">
                    By email alone, one attacker walks the whole member list from a single machine.
                    By address alone, a shared college lab locks out an entire batch at once.
                  </span>
                </span>
              </DetailRow>
            </dl>

            <Alert tone="info" title="Your mobile number is not a way in" icon={<Lock className="size-4" />}>
              It is captured for account recovery
              {pack?.features.whatsapp ? ' and for WhatsApp reminders' : ''}, and it is never a
              sign-in credential. Nobody who has your phone can sign in as you with it, and a SIM
              swap does not reach this account.{' '}
              <Link href="/settings" className="link">
                Manage your number
              </Link>
              .
            </Alert>

            <p className="text-xs text-muted">
              Because the code goes to your email, your email account is the real key to this
              portal. Whatever protection that account has is the protection this one has.
            </p>
          </CardBody>
        </Card>
      </Section>

      {/* ---- The cookie -------------------------------------------------- */}

      <Section
        title="What the session cookie holds"
        description="Worth reading once. It is short, and it explains most of what this page can and cannot offer you."
      >
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle as="h3" className="text-md">
                A member id, a college id, and the time it was issued
              </CardTitle>
              <CardDescription>
                That is the whole payload. It carries nothing secret, which is why it is signed
                rather than encrypted — the signature stops somebody editing the member id to
                another person&rsquo;s, and there is nothing inside worth hiding from the browser
                that holds it.
              </CardDescription>
            </div>
            <Cookie className="size-5 shrink-0 text-muted" aria-hidden="true" />
          </CardHeader>

          <CardBody className="space-y-4">
            <dl className="divide-y divide-line">
              <DetailRow label="HttpOnly">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span>On</span>
                  <span className="text-xs text-muted">
                    JavaScript on the page cannot read it. A token readable by script is a token
                    that leaves with the first cross-site scripting bug.
                  </span>
                </span>
              </DetailRow>
              <DetailRow label="SameSite">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono">Lax</span>
                  <span className="text-xs text-muted">
                    Another site cannot make your browser perform an action here while you happen to
                    be signed in.
                  </span>
                </span>
              </DetailRow>
              <DetailRow label="Secure">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span>On in production</span>
                  <span className="text-xs text-muted">
                    Sent over HTTPS only, so it cannot be read off college Wi-Fi.
                  </span>
                </span>
              </DetailRow>
              <DetailRow label="Roles and permissions">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span>Not in the cookie</span>
                  <span className="text-xs text-muted">
                    Resolved from your member record on every single request.
                  </span>
                </span>
              </DetailRow>
              <DetailRow label="Signature">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span>HMAC-SHA256, compared in constant time</span>
                  <span className="text-xs text-muted">
                    A length-sensitive comparison on a signature is a timing oracle, and forging a
                    session is the whole game.
                  </span>
                </span>
              </DetailRow>
              <DetailRow label="Lifetime">{SESSION_DAYS} days, not renewed by activity</DetailRow>
            </dl>
          </CardBody>
        </Card>
      </Section>

      {/* ---- The gap ----------------------------------------------------- */}

      <Section
        title="Signed-in devices"
        description="This is the one thing on this page the portal does not do, and it is better said plainly than dressed up."
      >
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle as="h3" className="text-md">
                There is no device list, and there is no way to sign out one device from another
              </CardTitle>
              <CardDescription>
                Not hidden behind a role, not coming in a later release you are waiting on — it does
                not exist today.
              </CardDescription>
            </div>
            <MonitorSmartphone className="size-5 shrink-0 text-muted" aria-hidden="true" />
          </CardHeader>

          <CardBody className="space-y-4">
            <p className="max-w-prose text-sm text-secondary">
              The reason is the design above. The session is a self-contained signed cookie: the
              server can check that one is genuine without keeping any record that it was issued.
              That makes sign-in fast and stateless, and it means there is no list of your sessions
              anywhere to show you — and equally nothing to switch off one at a time. Any screen
              here claiming &ldquo;Chrome on Windows, Vijayawada, active now&rdquo; would be reading
              a table that does not exist.
            </p>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">What follows from that, in practice</h4>
              <ul className="space-y-2.5 text-sm">
                <Consequence icon={<LogOut className="size-4" />} title="Signing out is per device">
                  It deletes the cookie in the browser you are using. A session you left open in the
                  college lab stays open until it expires or somebody signs out there.
                </Consequence>
                <Consequence
                  icon={<Clock className="size-4" />}
                  title="A lost device stays signed in until its own cookie expires"
                >
                  Up to {SESSION_DAYS} days from the moment that session started. Every device
                  carries its own clock:{' '}
                  {expires
                    ? `this one runs out on ${formatDateTime(expires, timing)}, and a session started on another device runs out ${SESSION_DAYS} days after it began.`
                    : `each runs out ${SESSION_DAYS} days after it began.`}
                </Consequence>
                <Consequence
                  icon={<ShieldCheck className="size-4" />}
                  title="Suspending the account does work, everywhere, immediately"
                >
                  Your status and roles are read from the member record on every request. If the
                  alumni cell moves the account out of active status, the cookie still decodes but
                  it stops authorising anything — on every device, on the next page load. That is
                  the lever to reach for, and it is the one this page can honestly point you at.
                </Consequence>
              </ul>
            </div>

            <p className="border-t border-line pt-4 text-xs text-muted">
              Closing the gap properly means a server-side session record — one row per sign-in with
              its own id in the cookie — so each device can be named, dated and revoked on its own.
              That is a change to how sessions are stored, not a screen someone forgot to build, and
              until it is made this page will keep saying so.
            </p>
          </CardBody>
        </Card>
      </Section>

      {/* ---- If something is wrong --------------------------------------- */}

      <Section title="If you think someone else has your account">
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle as="h3" className="text-md">
                Three things, in this order
              </CardTitle>
              <CardDescription>
                There is no password to change, so the usual first step does not apply here.
              </CardDescription>
            </div>
            <ShieldAlert className="size-5 shrink-0 text-warning-fg" aria-hidden="true" />
          </CardHeader>

          <CardBody className="space-y-4">
            <ol className="space-y-3 text-sm">
              <Step n={1} title="Secure your email account first">
                Every sign-in code goes there. Until that inbox is safe, nothing done on this portal
                will hold — and check whether a forwarding rule has been added to it.
              </Step>
              <Step n={2} title="Tell the alumni cell">
                Ask them to suspend the account. It takes effect on the next request from every
                device.{' '}
                {supportEmail ? (
                  <a href={`mailto:${supportEmail}`} className="link">
                    {supportEmail}
                  </a>
                ) : (
                  'Use the contact details on your account page.'
                )}
                {supportPhone ? (
                  <>
                    {' · '}
                    <a href={`tel:${supportPhone.replace(/\s/g, '')}`} className="link">
                      {supportPhone}
                    </a>
                  </>
                ) : null}
              </Step>
              <Step n={3} title="Ask for the access log on your record">
                Every staff action on your record is written to the audit log with who did it, when
                and why. You are entitled to a copy of what it says about you — request it through{' '}
                <Link href="/settings/data" className="link">
                  your data requests
                </Link>
                , which starts the 30-day statutory clock.
              </Step>
            </ol>

            <Alert tone="neutral" title="What the portal will never ask you for" icon={<Mail className="size-4" />}>
              Nobody from the college or from ifBash will ever ask you to read out a sign-in code, and
              no genuine message from this portal asks you to forward one. A code is only ever typed
              into the sign-in screen by the person who requested it.
            </Alert>
          </CardBody>
        </Card>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------

function Consequence({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 shrink-0 text-brand-fg" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="block text-xs text-secondary">{children}</span>
      </span>
    </li>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-surface-sunken text-xs font-semibold tabular text-secondary"
        aria-hidden="true"
      >
        {n}
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="block text-xs text-secondary">{children}</span>
      </span>
    </li>
  );
}
