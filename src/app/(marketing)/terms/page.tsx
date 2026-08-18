import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, Ban, Check, Scale } from 'lucide-react';
import { getTenantBrand } from '@/lib/tenant';
import { CONNECTION_LIMITS, NOTICE_VERSION } from '@/lib/config';
import { Alert, Badge, Card, CardBody, DetailRow, Separator } from '@/components/ui';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Terms of use',
  description:
    'The rules for using the alumni portal: who may hold an account, what may not be done with the directory, how job posts and events work, and who is responsible for what.',
};

/**
 * Terms of use.
 *
 * Short, specific, and about this product rather than a template. The
 * clauses that matter here are the ones about the directory: an alumni
 * network dies the day its members find their contact details in a
 * recruiter's spreadsheet, so the acceptable-use section is written to be
 * enforceable and is not buried at clause 14.
 */
export default async function TermsPage() {
  const { brand } = (await getTenantBrand())!;
  const { copy, features, locale } = brand.pack;
  const fmt = { locale: locale.locale, timeZone: locale.timeZone };

  return (
    <>
      <section className="border-b border-line bg-surface-sunken py-16">
        <div className="page-shell max-w-prose space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-fg">
            {copy.institutionName}
          </p>
          <h1 className="font-display text-display-md font-bold">Terms of use</h1>
          <p className="text-md text-secondary">
            These terms apply to everyone who signs in to {copy.portalName} — alumni, final-year
            students, faculty and staff. Using the portal means accepting them.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Badge tone="brand">Version {NOTICE_VERSION}</Badge>
            <span className="text-sm text-secondary">
              In effect from {formatDate(NOTICE_VERSION, fmt)}
            </span>
          </div>
        </div>
      </section>

      <div className="page-shell max-w-prose space-y-12 py-section">
        <Card>
          <CardBody className="space-y-4">
            <h2 className="font-display text-lg font-semibold">The short version</h2>
            <ul className="space-y-2.5 text-sm">
              {[
                'One account per person, tied to your own email. Sign-in codes are yours alone.',
                'The directory is for staying in touch and helping students. It is not a recruitment database, and taking it in bulk ends your account.',
                'What you post — a job, a bio, a message — is yours and is your responsibility.',
                'The college checks that people are who they say they are. It does not vouch for employers, salaries or anything posted by a member.',
              ].map((line) => (
                <li key={line} className="flex gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-success-fg" aria-hidden="true" />
                  <span className="text-secondary">{line}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">
              The summary is not the agreement. The clauses below are.
            </p>
          </CardBody>
        </Card>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">1. Who may hold an account</h2>
          <p className="text-secondary">
            Accounts are for graduates of {copy.institutionName} whose records appear in the
            college&apos;s degree register, for students currently enrolled in a final year and
            invited by the placement cell, and for faculty and staff given a role by the college.
            Nobody else may create or use an account.
          </p>
          <p className="text-secondary">
            You must be eighteen or older. Accounts are personal — you may not share yours, and you
            may not hold more than one.
          </p>
        </section>

        <Separator />

        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">2. Signing in</h2>
          <p className="text-secondary">
            The portal has no password. You sign in with a six-digit code sent to your registered
            email address. That code is a credential: do not forward it, read it out, or enter it on
            any page you did not open yourself. It expires in ten minutes and works once.
          </p>
          <p className="text-secondary">
            If you lose access to your registered email, or think somebody else has used your
            account, tell the alumni cell
            {copy.supportEmail ? (
              <>
                {' '}
                at{' '}
                <a href={`mailto:${copy.supportEmail}`} className="link">
                  {copy.supportEmail}
                </a>
              </>
            ) : null}{' '}
            straight away.
          </p>
        </section>

        <Separator />

        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">3. Verification</h2>
          <p className="text-secondary">
            A claim to be a graduate is checked against the degree register supplied by the
            examinations branch. Clear matches are approved automatically; anything ambiguous is
            reviewed by a person, who may ask for a scan of your degree certificate.
          </p>
          <p className="text-secondary">
            The college may refuse a claim, or revoke an account already approved, if the details
            given were false or belong to someone else. Impersonating another graduate is not a
            terms violation to be argued about — the account is closed.
          </p>
        </section>

        <Separator />

        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold">4. What you may not do with the directory</h2>
          <p className="text-secondary">
            This clause is the reason the directory can exist at all. Every item below ends the
            account that does it, without a warning.
          </p>

          <ul className="space-y-3">
            {[
              {
                title: 'No bulk collection',
                body: 'Do not copy, scrape, crawl or systematically download member records, by hand or by script. Do not use automated tools against the portal.',
              },
              {
                title: 'No recruitment or marketing use',
                body: 'A contact detail released to you was released for the conversation you asked for. Using it for cold recruitment, insurance sales, coaching-class marketing or a mailing list is prohibited.',
              },
              {
                title: 'No mass messaging',
                body: `Connection requests are capped — ${CONNECTION_LIMITS.studentOpenRequests} open at a time for students and ${CONNECTION_LIMITS.alumniOpenRequests} for alumni. Do not work around the cap with second accounts.`,
              },
              {
                title: 'No onward sharing',
                body: 'Do not pass member details to a third party, another alumni group, or a competing network — including by exporting them to a personal spreadsheet.',
              },
            ].map((item) => (
              <li key={item.title} className="flex gap-3 rounded-lg border border-line bg-surface-raised p-4">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-danger-soft text-danger-fg" aria-hidden="true">
                  <Ban className="size-3.5" />
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-secondary">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <Separator />

        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">5. What you post</h2>
          <p className="text-secondary">
            Your profile, job posts and messages remain yours. By posting them you allow the college
            to display them inside the portal to the members entitled to see them — and nowhere
            else. Nothing you post here is published on the open internet.
          </p>
          <p className="text-secondary">
            Job and internship posts are reviewed by the placement cell before students see them.
            The college may decline or remove a post that is misleading, asks for a payment from
            applicants, or is not a genuine opening. Removing a post is not a judgement about you.
          </p>
          <p className="text-secondary">
            Do not post anything unlawful, defamatory, or that you do not have the right to share —
            including someone else&apos;s personal details.
          </p>
        </section>

        <Separator />

        {features.events ? (
          <>
            <section className="space-y-3">
              <h2 className="font-display text-xl font-semibold">6. Events and payments</h2>
              <p className="text-secondary">
                Registering for an event is a commitment to attend and, where there is a ticket, to
                pay for it. Payments are taken through a payment gateway; the portal never sees or
                stores your card or UPI credentials.
              </p>
              <dl className="divide-y divide-line rounded-lg border border-line bg-surface-raised px-card">
                <DetailRow label="Cancellations">
                  Cancel at least seven days before the event for a full refund. Inside seven days
                  the alumni cell has committed to catering and venue numbers, so refunds are at
                  their discretion.
                </DetailRow>
                <DetailRow label="If the college cancels">
                  Every registration is refunded in full, to the account it was paid from.
                </DetailRow>
                <DetailRow label="Guests">
                  Guest counts are part of the headcount the college pays for. Bringing more people
                  than you registered may mean they cannot be admitted.
                </DetailRow>
              </dl>
            </section>
            <Separator />
          </>
        ) : null}

        {features.donations ? (
          <>
            <section className="space-y-3">
              <h2 className="font-display text-xl font-semibold">Giving</h2>
              <p className="text-secondary">
                Contributions are voluntary and are applied to the campaign you chose. Donations from
                outside India are recorded separately as required by the Foreign Contribution
                (Regulation) Act and are only accepted where the trust holds the necessary
                registration. Receipts are issued to the email on your account.
              </p>
            </section>
            <Separator />
          </>
        ) : null}

        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">
            {features.events ? '7' : '6'}. What the college is and is not responsible for
          </h2>
          <Alert tone="warning" title="Read this before acting on anything posted here" icon={<AlertTriangle className="size-4" />}>
            <p>
              The college verifies that a member is a genuine graduate or student. It does not
              verify employers, job offers, salaries, or the accuracy of anything a member writes on
              their own profile. Do your own checks before accepting an offer, paying anyone, or
              travelling for an interview. The college is not a party to any arrangement you make
              with another member.
            </p>
          </Alert>
          <p className="text-secondary">
            The portal is provided as it stands. The college will keep it running and secure with
            reasonable care, but does not guarantee uninterrupted availability, and may take it down
            for maintenance. Nothing here limits liability that cannot be limited under Indian law.
          </p>
        </section>

        <Separator />

        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">
            {features.events ? '8' : '7'}. Suspension and closure
          </h2>
          <p className="text-secondary">
            The college may suspend or close an account that breaches these terms, misuses member
            data, or is used to harass another member. Where the reason allows it, you are told what
            happened and given a chance to respond.
          </p>
          <p className="text-secondary">
            You can close your own account at any time from{' '}
            <Link href="/settings/privacy" className="link">
              Settings → Privacy and your data
            </Link>
            . What survives closure, and why, is set out in the{' '}
            <Link href="/privacy#retention" className="link">
              privacy notice
            </Link>
            .
          </p>
        </section>

        <Separator />

        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">
            {features.events ? '9' : '8'}. Changes, and the law that applies
          </h2>
          <p className="text-secondary">
            These terms carry a version string. If they change materially you are told inside the
            portal before the new version takes effect, and continuing to use the portal after that
            date means accepting it.
          </p>
          <p className="flex gap-2.5 text-secondary">
            <Scale className="mt-1 size-4 shrink-0 text-muted" aria-hidden="true" />
            <span>
              These terms are governed by the laws of India. The courts having jurisdiction over the
              district in which the college is situated have exclusive jurisdiction over any dispute
              arising from them.
            </span>
          </p>
          {copy.addressLines.length ? (
            <address className="not-italic text-sm text-secondary">
              {copy.addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          ) : null}
        </section>
      </div>
    </>
  );
}
