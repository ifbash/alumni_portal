import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { BadgeCheck, LogOut, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import {
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardTitle,
  HowThisWorks,
} from '@/components/ui';
import { Crest } from '@/components/brand/Crest';
import { getSession } from '@/lib/auth/session';
import { requireSession, can } from '@/lib/auth/guard';
import { getOwnProfile } from '@/lib/data/repo';
import { getTenantBrand } from '@/lib/tenant';
import { ROLE_LABELS } from '@/lib/navigation';
import { formatDate, memberLine } from '@/lib/format';
import { capitalise } from '@/lib/branding/copy';
import { MobileForm } from './MobileForm';

/**
 * Account.
 *
 * One card that answers what a member arrives with: which address signs
 * me in, which number is on file, is my account verified, and what roles
 * do I hold. Beside it, the office that runs the portal, on the college's
 * band, with the ways to reach it.
 */

export const metadata: Metadata = {
  title: 'Account settings',
};

export default async function AccountSettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  requireSession(session);

  const profile = getOwnProfile(session);
  if (!profile) notFound();

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const pack = resolved.brand.pack;
  const copy = pack.copy;
  const timing = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };
  const office = copy.officeName;

  const editable = can(session, 'profile.write.own');

  // The batch and roll number are alumni and student identity. A staff
  // account seeded from an alumni row is not introduced by them.
  const holdsAlumni = profile.roles.some((r) => r.role === 'alumni');
  const verifiedLine = profile.verifiedAt
    ? memberLine([
        profile.isStudent || holdsAlumni ? profile.departmentCode : null,
        profile.isStudent ? 'Final year' : holdsAlumni ? profile.batchYear : null,
        profile.isStudent || holdsAlumni ? profile.rollNumber : null,
        formatDate(profile.verifiedAt, timing),
      ])
    : null;

  // The band already names the institution; the address starts after it.
  const address = copy.addressLines.filter((line) => line.trim() !== copy.institutionName.trim());

  const phoneDigits = copy.supportPhone?.replace(/[^\d]/g, '') ?? '';
  const whatsappHref =
    pack.features.whatsapp && phoneDigits ? `https://wa.me/${phoneDigits}` : null;

  return (
    <div className="grid grid-cols-1 items-start gap-gutter xl:grid-cols-[minmax(0,1fr)_20rem]">
      {/* ---- The account ------------------------------------------------ */}

      <Card>
        <CardBody className="space-y-5">
          <CardTitle as="h2">Your account</CardTitle>

          <dl className="divide-y divide-line border-y border-line">
            <AccountRow label="Sign-in email">
              <p className="break-all font-medium">{profile.contact?.email ?? '—'}</p>
              <p className="text-xs text-secondary">
                To change it, write to{' '}
                {copy.supportEmail ? (
                  <a href={`mailto:${copy.supportEmail}`} className="link">
                    {copy.supportEmail}
                  </a>
                ) : (
                  `the ${office}`
                )}{' '}
                from this address.
              </p>
            </AccountRow>

            <AccountRow label="Mobile">
              {editable ? (
                <MobileForm
                  initial={profile.contact?.mobile ?? ''}
                  hint={
                    pack.features.whatsapp
                      ? 'For account recovery and WhatsApp. Never used to sign in.'
                      : 'For account recovery. Never used to sign in.'
                  }
                />
              ) : (
                <>
                  <p className="font-medium">{profile.contact?.mobile ?? 'Not added'}</p>
                  <p className="text-xs text-secondary">The {office} can change it for you.</p>
                </>
              )}
            </AccountRow>

            <AccountRow label="Verification">
              {verifiedLine ? (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge tone="success">
                    <BadgeCheck className="size-3.5" aria-hidden="true" />
                    Verified
                  </Badge>
                  <span className="text-secondary">{verifiedLine}</span>
                </p>
              ) : (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge tone="warning" dot>
                    Waiting
                  </Badge>
                  <span className="text-secondary">The {office} is checking your registration.</span>
                </p>
              )}
            </AccountRow>

            <AccountRow label="Roles">
              <ul className="flex flex-wrap gap-1.5">
                {profile.roles.map((r) => (
                  <li key={`${r.role}-${r.departmentCode ?? 'all'}`}>
                    <Badge tone="neutral">
                      {memberLine([ROLE_LABELS[r.role] ?? r.role, r.departmentCode])}
                    </Badge>
                  </li>
                ))}
              </ul>
            </AccountRow>
          </dl>

          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/logout" prefetch={false} variant="secondary" className="min-h-11">
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </ButtonLink>
            <p className="text-xs text-secondary">Signs out this browser only.</p>
          </div>

          <HowThisWorks summary="About roles">
            <p>
              Roles are granted by the college and are never chosen by you. A role scoped to a
              branch applies to that branch only. If you hold a role you no longer need, tell the{' '}
              {office} so it can be removed.
            </p>
          </HowThisWorks>
        </CardBody>
      </Card>

      {/* ---- The office ------------------------------------------------- */}

      <Card className="overflow-hidden">
        <div className="band-surface flex items-center gap-3 px-card py-4">
          <Crest pack={pack} size={40} />
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-band-fg">{capitalise(office)}</h2>
            <p className="text-xs text-band-muted">{copy.institutionName}</p>
          </div>
        </div>

        <div className="band-exit space-y-3 p-card text-sm">
          {copy.supportEmail || copy.supportPhone || whatsappHref ? (
            <ul className="space-y-1">
              {copy.supportEmail ? (
                <li>
                  <a
                    href={`mailto:${copy.supportEmail}`}
                    className="link inline-flex min-h-11 items-center gap-2 break-all"
                  >
                    <Mail className="size-4 shrink-0 text-muted" aria-hidden="true" />
                    {copy.supportEmail}
                  </a>
                </li>
              ) : null}
              {copy.supportPhone ? (
                <li>
                  <a
                    href={`tel:${copy.supportPhone.replace(/\s/g, '')}`}
                    className="link inline-flex min-h-11 items-center gap-2"
                  >
                    <Phone className="size-4 shrink-0 text-muted" aria-hidden="true" />
                    {copy.supportPhone}
                  </a>
                </li>
              ) : null}
              {whatsappHref ? (
                <li>
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="link inline-flex min-h-11 items-center gap-2"
                  >
                    <MessageCircle className="size-4 shrink-0 text-muted" aria-hidden="true" />
                    WhatsApp the {office}
                    <span className="sr-only">(opens WhatsApp)</span>
                  </a>
                </li>
              ) : null}
            </ul>
          ) : null}

          {address.length ? (
            <address className="flex gap-2 not-italic text-secondary">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
              <span>
                {address.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </span>
            </address>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

/** Label over value on phones, side by side from sm. */
function AccountRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1.5 py-4 text-sm sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-secondary sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 space-y-1">{children}</dd>
    </div>
  );
}
