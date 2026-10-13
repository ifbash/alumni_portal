import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { KeyRound, LogOut, ShieldAlert } from 'lucide-react';
import { ButtonLink, Card, CardBody, CardTitle, Disclosure } from '@/components/ui';
import { getSession } from '@/lib/auth/session';
import { requireSession } from '@/lib/auth/guard';
import { getOwnProfile } from '@/lib/data/repo';
import { getTenantBrand } from '@/lib/tenant';
import { SESSION_COOKIE, OTP_TTL_SECONDS, OTP_MAX_ATTEMPTS } from '@/lib/config';
import { formatDateTime } from '@/lib/format';
import { vendorLabel } from '@/lib/branding/copy';

/**
 * Security.
 *
 * The page's only job is to be accurate. A security screen that describes
 * protections the product does not have is worse than none, because it is
 * the one page a cautious member will quote back at the college later.
 *
 * So there is no per-device session list, and the page does not draw a
 * device list with places on it. The session is a self-contained signed
 * cookie; the server keeps no record of the ones it has issued, so there
 * is nothing to enumerate and nothing to revoke one at a time. What does
 * work, suspending the account, is what the page points at. How the
 * cookie and the code are protected is kept in one disclosure for anyone
 * who asks.
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
  const office = pack?.copy.officeName ?? 'alumni cell';
  const shortName = pack?.copy.shortName ?? 'the college';
  const vendor = pack ? vendorLabel(pack.copy) : 'the portal provider';

  const issued = await issuedAt();
  const expires = issued ? new Date(issued.getTime() + SESSION_DAYS * 86400000) : null;

  const otpMinutes = Math.round(OTP_TTL_SECONDS / 60);
  const email = profile.contact?.email ?? null;

  return (
    <div className="grid grid-cols-1 items-start gap-gutter xl:grid-cols-2">
      {/* ---- 1. This device -------------------------------------------- */}

      <Card>
        <CardBody className="space-y-4">
          <CardTitle as="h2">This device</CardTitle>
          <dl className="divide-y divide-line border-y border-line text-sm">
            <Row label="Signed in as">
              <span className="font-medium">{profile.fullName}</span>
              {email ? <span className="block break-all text-secondary">{email}</span> : null}
            </Row>
            <Row label="Since">
              {issued ? formatDateTime(issued, timing) : <span className="text-secondary">Not known</span>}
            </Row>
            <Row label="Expires">
              {expires ? (
                <>
                  {formatDateTime(expires, timing)}
                  <span className="block text-xs text-secondary">
                    {SESSION_DAYS} days after you signed in, however much you use it.
                  </span>
                </>
              ) : (
                <span className="text-secondary">Not known</span>
              )}
            </Row>
          </dl>
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/logout" prefetch={false} variant="secondary" className="min-h-11">
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </ButtonLink>
            <p className="text-xs text-secondary">Signs out this browser only.</p>
          </div>
        </CardBody>
      </Card>

      {/* ---- 2 and 4. How you sign in, and the code --------------------- */}

      <div className="space-y-gutter">
        <Card>
          <CardBody className="space-y-2">
            <CardTitle as="h2" className="text-md">
              How you sign in
            </CardTitle>
            <p className="text-sm text-secondary">
              With a one-time code sent to {email ? <span className="font-medium text-primary">{email}</span> : 'your email'}.
              There is no password, and your mobile number cannot be used to sign in.
            </p>
          </CardBody>
        </Card>

        <Card className="border-l-4 border-l-warning">
          <CardBody className="flex gap-3">
            <KeyRound className="mt-0.5 size-5 shrink-0 text-warning-fg" aria-hidden="true" />
            <div className="space-y-1">
              <CardTitle as="h2" className="text-md">
                Never share your code
              </CardTitle>
              <p className="text-sm text-secondary">
                Nobody from {shortName} or {vendor} will ever ask for it. Type it only into the
                sign-in page you opened yourself.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ---- 3. If something looks wrong --------------------------------- */}

      <Card className="xl:col-span-2">
        <CardBody className="space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 shrink-0 text-muted" aria-hidden="true" />
            <CardTitle as="h2">If something looks wrong</CardTitle>
          </div>
          <ol className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
            <Step n={1} title="Secure your email">
              Every sign-in code goes there. Change its password and check it forwards nothing.
            </Step>
            <Step n={2} title={`Tell the ${office}`}>
              Ask them to suspend your account. It stops working on every device at once.
              {supportEmail || supportPhone ? (
                <span className="mt-1 block">
                  {supportEmail ? (
                    <a href={`mailto:${supportEmail}`} className="link break-all">
                      {supportEmail}
                    </a>
                  ) : null}
                  {supportEmail && supportPhone ? ' · ' : null}
                  {supportPhone ? (
                    <a href={`tel:${supportPhone.replace(/\s/g, '')}`} className="link">
                      {supportPhone}
                    </a>
                  ) : null}
                </span>
              ) : null}
            </Step>
            <Step n={3} title="Ask what staff did">
              Ask for the record of staff actions on your account through{' '}
              <Link href="/settings/data" className="link">
                your data
              </Link>
              .
            </Step>
          </ol>
        </CardBody>
      </Card>

      {/* ---- Technical details --------------------------------------------- */}

      <Disclosure id="technical" summary="Technical details for your IT team" className="xl:col-span-2">
        <dl className="divide-y divide-line">
          <Tech label="Session">
            A signed cookie holding a member id, a college id and the time it was issued. HttpOnly,
            SameSite Lax, and Secure in production. Signed with HMAC-SHA256 and compared in constant
            time. It lasts {SESSION_DAYS} days and is not renewed by activity.
          </Tech>
          <Tech label="Roles">
            Not stored in the cookie. They are read from your record on every request, so a role
            removed by the college stops working on your next page load.
          </Tech>
          <Tech label="Sign-in code">
            Valid for {otpMinutes} minutes and used once. {OTP_MAX_ATTEMPTS} wrong attempts end it,
            and a new request replaces the old code. Only a keyed hash of it is kept.
          </Tech>
          <Tech label="Rate limits">By email address and by network address.</Tech>
          <Tech label="Other devices">
            The server keeps no list of sessions, so there is no device list with places to show and
            no way to sign out one device from another. Each device stays signed in until its own
            cookie expires or you sign out there. Suspending the account stops every device at once.
          </Tech>
        </dl>
      </Disclosure>
    </div>
  );
}

// ---------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-secondary">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Tech({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
      <dt className="font-medium text-primary">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
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
        <span className="block font-medium text-primary">{title}</span>
        <span className="block text-secondary">{children}</span>
      </span>
    </li>
  );
}
