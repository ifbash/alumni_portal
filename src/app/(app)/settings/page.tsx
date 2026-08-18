import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { BadgeCheck, KeyRound, LogOut, Mail, ShieldCheck, Smartphone } from 'lucide-react';
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
import { requireSession, can } from '@/lib/auth/guard';
import { getOwnProfile } from '@/lib/data/repo';
import { getTenantBrand } from '@/lib/tenant';
import { ROLE_LABELS } from '@/lib/navigation';
import { formatDate, memberLine } from '@/lib/format';
import { MobileForm } from './MobileForm';

/**
 * Account.
 *
 * Answers the three questions a member actually arrives with: how do I
 * sign in, is my account verified, and what am I allowed to do here. The
 * last one is worth stating plainly — a member who does not know they
 * hold an HOD grant cannot notice when they should not.
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
  const pack = resolved?.brand.pack;
  const supportEmail = pack?.copy.supportEmail ?? null;
  const supportPhone = pack?.copy.supportPhone ?? null;

  const editable = can(session, 'profile.write.own');

  return (
    <>
      {/* ---- Sign-in --------------------------------------------------- */}

      <Section title="Signing in">
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle as="h3" className="text-md">
                Email is your credential
              </CardTitle>
              <CardDescription>
                There is no password on this portal. You ask for a code, it arrives by email, and it
                works once.
              </CardDescription>
            </div>
            <Mail className="size-5 shrink-0 text-muted" aria-hidden="true" />
          </CardHeader>

          <CardBody className="space-y-4">
            <dl className="divide-y divide-line">
              <DetailRow label="Sign-in email">
                <span className="font-mono">{profile.contact?.email ?? '—'}</span>
              </DetailRow>
              <DetailRow label="Method">
                <span className="inline-flex items-center gap-2">
                  <KeyRound className="size-4 text-muted" aria-hidden="true" />
                  One-time code, valid for 10 minutes
                </span>
              </DetailRow>
            </dl>

            <Alert tone="neutral" title="Changing your email is not self-service">
              The address on the account is the evidence that links you to a row in the degree
              register. Moving it is done by the alumni cell, from the address you use today, and it
              is written to the audit log.{' '}
              {supportEmail ? (
                <a href={`mailto:${supportEmail}`} className="link">
                  Write to {supportEmail}
                </a>
              ) : (
                'Ask the alumni cell.'
              )}
            </Alert>

            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <ButtonLink href="/logout" variant="secondary" size="sm">
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </ButtonLink>
              <p className="text-xs text-muted">
                Signing out clears the session cookie on this device only.
              </p>
            </div>
          </CardBody>
        </Card>
      </Section>

      {/* ---- Mobile ---------------------------------------------------- */}

      <Section title="Mobile number">
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle as="h3" className="text-md">
                Recovery and WhatsApp
              </CardTitle>
              <CardDescription>
                Captured for account recovery and, once the college finishes WhatsApp Business
                verification, for event reminders. It is never a way to sign in.
              </CardDescription>
            </div>
            <Smartphone className="size-5 shrink-0 text-muted" aria-hidden="true" />
          </CardHeader>

          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {profile.contact?.mobile ? (
                <>
                  <Badge tone="success" dot>
                    On file
                  </Badge>
                  <span className="font-mono text-sm">{profile.contact.mobile}</span>
                </>
              ) : (
                <Badge tone="warning" dot>
                  Not added
                </Badge>
              )}
            </div>

            {editable ? (
              <MobileForm initial={profile.contact?.mobile ?? ''} />
            ) : (
              <p className="text-sm text-secondary">
                Your role cannot edit member records, including its own. Ask the alumni cell to
                change this.
              </p>
            )}

            {!pack?.features.whatsapp ? (
              <p className="border-t border-line pt-3 text-xs text-muted">
                WhatsApp is not connected for {pack?.copy.shortName ?? 'this college'} yet, so
                nothing is sent to this number today apart from recovery messages.
              </p>
            ) : null}
          </CardBody>
        </Card>
      </Section>

      {/* ---- Verification ---------------------------------------------- */}

      <Section title="Verification">
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle as="h3" className="text-md">
                How the college knows you are you
              </CardTitle>
              <CardDescription>
                Membership is a match against the examinations branch&rsquo;s degree register — not
                a form somebody approved on a hunch.
              </CardDescription>
            </div>
            {profile.verifiedAt ? (
              <Badge tone="success">
                <BadgeCheck className="size-3.5" aria-hidden="true" />
                Verified
              </Badge>
            ) : (
              <Badge tone="warning" dot>
                In the queue
              </Badge>
            )}
          </CardHeader>

          <CardBody>
            {profile.verifiedAt ? (
              <dl className="divide-y divide-line">
                <DetailRow label="Matched on">
                  <span className="font-mono">{profile.rollNumber ?? '—'}</span>
                </DetailRow>
                <DetailRow label="Method">
                  {VERIFICATION_METHOD[profile.verificationMethod ?? ''] ??
                    profile.verificationMethod ??
                    'Reviewed by the alumni cell'}
                </DetailRow>
                <DetailRow label="Decided">{formatDate(profile.verifiedAt)}</DetailRow>
                <DetailRow label="Record">
                  {memberLine([
                    profile.programme,
                    profile.departmentName,
                    profile.batchYear ? `batch of ${profile.batchYear}` : null,
                  ])}
                </DetailRow>
              </dl>
            ) : (
              <Alert tone="warning" title="Your claim is waiting on a person">
                The alumni cell reviews claims that the matcher could not settle automatically —
                usually a name spelled differently in the register than on your certificate. Until
                it clears you can sign in and edit your profile, but not the directory.
              </Alert>
            )}
          </CardBody>
        </Card>
      </Section>

      {/* ---- Roles ------------------------------------------------------ */}

      <Section title="What your account can do">
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle as="h3" className="text-md">
                Roles you hold
              </CardTitle>
              <CardDescription>
                Roles are granted by the college, never self-assigned. Every grant and revocation is
                written to the audit log with who did it.
              </CardDescription>
            </div>
            <ShieldCheck className="size-5 shrink-0 text-muted" aria-hidden="true" />
          </CardHeader>

          <CardBody className="space-y-3">
            <ul className="space-y-2">
              {profile.roles.map((r) => (
                <li
                  key={`${r.role}-${r.departmentCode ?? 'all'}`}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3.5 py-2.5"
                >
                  <Badge tone="brand">{ROLE_LABELS[r.role] ?? r.role}</Badge>
                  <span className="text-sm text-secondary">
                    {r.departmentCode
                      ? `Scoped to ${r.departmentCode}. Outside that branch this role grants nothing.`
                      : 'Applies across the whole college.'}
                  </span>
                </li>
              ))}
            </ul>

            <p className="text-xs text-muted">
              If a role here is one you no longer perform, tell the alumni cell. A grant that
              outlives the job it was for is the most common way a portal leaks.
            </p>
          </CardBody>
        </Card>
      </Section>

      {/* ---- Help ------------------------------------------------------- */}

      <Section title="Getting help">
        <Card>
          <CardBody className="space-y-2 text-sm">
            <p className="text-secondary">
              The alumni cell answers on working days. Include your roll number — it is the fastest
              way to find your record.
            </p>
            <dl className="space-y-1">
              {supportEmail ? (
                <div className="flex gap-2">
                  <dt className="text-muted">Email</dt>
                  <dd>
                    <a href={`mailto:${supportEmail}`} className="link">
                      {supportEmail}
                    </a>
                  </dd>
                </div>
              ) : null}
              {supportPhone ? (
                <div className="flex gap-2">
                  <dt className="text-muted">Phone</dt>
                  <dd>
                    <a href={`tel:${supportPhone.replace(/\s/g, '')}`} className="link">
                      {supportPhone}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
            <p className="text-secondary">
              For anything about the data held on you —{' '}
              <Link href="/settings/data" className="link">
                a copy, a correction or deletion
              </Link>{' '}
              — use the request form rather than email. It starts the statutory clock.
            </p>
          </CardBody>
        </Card>
      </Section>
    </>
  );
}

const VERIFICATION_METHOD: Record<string, string> = {
  auto_roll_match: 'Roll number and name matched the register automatically',
  admin_manual: 'Reviewed and approved by the alumni cell',
  bulk_import: 'Loaded in a bulk import from college records',
  placement_cell_import: 'Loaded from the placement cell roll list',
};
