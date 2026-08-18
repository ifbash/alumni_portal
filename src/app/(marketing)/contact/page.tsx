import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Building2,
  ExternalLink,
  Globe,
  Handshake,
  KeyRound,
  Mail,
  Phone,
  ScrollText,
  ShieldAlert,
  SquarePen,
} from 'lucide-react';
import { getTenantBrand } from '@/lib/tenant';
import {
  Alert,
  ButtonLink,
  Card,
  CardBody,
  DetailRow,
  Section,
  Separator,
} from '@/components/ui';

/**
 * Contact.
 *
 * Three problems bring somebody to this page, and they have three
 * different destinations. A single "get in touch" address that receives
 * all three is how a sign-in failure ends up queued behind a request the
 * examinations branch has to answer.
 *
 * Public whatever `features.publicLanding` says. The first route on this
 * page is for a person who *cannot sign in*, and the last section is the
 * grievance contact the DPDP notice is required to publish — both are
 * useless behind an account. `/privacy` stays public for the same reason.
 *
 * Every address, number and line of the postal address is read from
 * `brand.pack.copy`. Nothing here is DIET's by default: a pack with no
 * `supportPhone` (which is every pack today) simply does not render that
 * row rather than falling back to a number typed into a component.
 *
 * There is no form. A form needs somewhere to post, a queue, and somebody
 * given time to watch it; until all three exist, `mailto:` with the
 * subject and the fields already filled in is the honest version — it
 * lands in an inbox a person actually opens, and the sender keeps a copy
 * in their sent items.
 */

export async function generateMetadata(): Promise<Metadata> {
  const resolved = await getTenantBrand();
  const pack = resolved?.brand.pack;
  if (!pack) return { title: 'Contact' };

  return {
    title: 'Contact the alumni cell',
    description: `How to reach the alumni cell of ${pack.copy.institutionName} — sign-in problems, corrections to your record, and offers to mentor, speak or hire.`,
  };
}

/** `mailto:` with the subject and the fields the cell needs already typed. */
function mailto(email: string, subject: string, body: string[]): string {
  const query = new URLSearchParams({ subject, body: body.join('\r\n') });
  // URLSearchParams encodes a space as "+", which mail clients render
  // literally in a subject line. Only %20 is correct in a mailto query.
  return `mailto:${email}?${query.toString().replace(/\+/g, '%20')}`;
}

export default async function ContactPage() {
  const resolved = await getTenantBrand();
  if (!resolved) notFound();

  const { copy } = resolved.brand.pack;
  const email = copy.supportEmail ?? null;
  const cell = `${copy.shortName} alumni cell`;

  const signInHref = email
    ? mailto(email, `Cannot sign in — ${copy.shortName} alumni portal`, [
        'Roll number:',
        'Year of passing:',
        'Branch:',
        'Name exactly as printed on the degree certificate:',
        'Email address I tried:',
        'Mobile number:',
        '',
        'What happened (no code arrived / code rejected / email not recognised):',
        '',
      ])
    : null;

  const correctionHref = email
    ? mailto(email, `Correction to my record — ${copy.shortName} alumni portal`, [
        'Roll number:',
        'Year of passing:',
        '',
        'What the portal says:',
        'What it should say:',
        '',
        'Evidence attached (degree certificate, consolidated memo, gazette):',
        '',
      ])
    : null;

  const helpHref = email
    ? mailto(email, 'Offering to help — mentoring, speaking or hiring', [
        'Name and batch:',
        'Branch:',
        'Where you work now, and what you do there:',
        '',
        'What you can offer (delete what does not apply):',
        '  - Mentoring students from my branch',
        '  - Speaking at a department session, on campus or online',
        '  - Hiring or referring from my company',
        '',
        'Roughly when you are free:',
        '',
      ])
    : null;

  return (
    <>
      <section className="border-b border-line bg-surface-sunken py-16">
        <div className="page-shell max-w-prose space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-fg">
            {copy.institutionName}
          </p>
          <h1 className="font-display text-display-md font-bold">Contact the alumni cell</h1>
          <p className="text-md text-secondary">
            The cell is a small team inside the college with other work to do, so this page sends
            you to the right place rather than to a general inbox. Sign-in problems are usually
            answered within one working day. Anything the examinations branch has to check takes
            longer, and this page says how much longer rather than pretending otherwise.
          </p>
          {!email ? (
            <Alert tone="warning" title="No email address is configured for this portal yet">
              <p>
                Until the college supplies one, use the postal address or the college switchboard
                below. Nothing on this page will silently send your message somewhere else.
              </p>
            </Alert>
          ) : null}
        </div>
      </section>

      <div className="page-shell grid gap-12 py-section lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-16">
        <div className="min-w-0 space-y-14">
          {/* ------------------------------------------------ Three routes in */}
          <Section
            title="What do you need?"
            description="Pick the one that matches. Each opens your mail app with the details the cell will otherwise have to ask you for."
          >
            <div className="space-y-4">
              {/* 1 — cannot sign in */}
              <Card>
                <CardBody className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-soft-fg">
                      <KeyRound className="size-5" aria-hidden="true" />
                    </span>
                    <h3 className="font-display text-lg font-semibold">I cannot sign in</h3>
                  </div>

                  <p className="text-sm text-secondary">
                    Sign-in sends a six-digit code to the email address the college holds for you.
                    For most batches before 2018 the college holds no address at all, so the
                    honest first step is not this page — it is{' '}
                    <Link href="/claim" className="link">
                      claiming your profile
                    </Link>{' '}
                    with your roll number, which is what tells the cell who you are.
                  </p>

                  <p className="text-sm text-secondary">
                    If you have already claimed and it still will not let you in, write to the
                    cell with your <strong className="font-semibold text-primary">roll number</strong>{' '}
                    and <strong className="font-semibold text-primary">year of passing</strong>.
                    Those two together are what they match against the degree register; a name
                    alone is not enough, because the same name in the same branch and year happens
                    more often than you would think.
                  </p>

                  <Alert tone="warning" title="Do not register a second time">
                    <p>
                      A duplicate claim does not get you in faster. It creates a second record the
                      cell then has to merge by hand, and both sit in the queue until they do.
                    </p>
                  </Alert>

                  {signInHref ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <ButtonLink href={signInHref}>
                        <Mail className="size-4" aria-hidden="true" />
                        Write about a sign-in problem
                      </ButtonLink>
                      <ButtonLink href="/claim" variant="secondary">
                        Claim your profile
                      </ButtonLink>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <ButtonLink href="/claim">Claim your profile</ButtonLink>
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* 2 — details are wrong */}
              <Card>
                <CardBody className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-soft-fg">
                      <SquarePen className="size-5" aria-hidden="true" />
                    </span>
                    <h3 className="font-display text-lg font-semibold">My details are wrong</h3>
                  </div>

                  <p className="text-sm text-secondary">
                    Where the correction goes depends on which record is wrong, and the difference
                    matters more than it looks.
                  </p>

                  <dl className="divide-y divide-line rounded-lg border border-line bg-surface px-card">
                    <DetailRow label="Your profile">
                      Photo, employer, designation, city, skills, bio, whether you are open to
                      mentoring. Yours to edit —{' '}
                      <Link href="/login" className="link">
                        sign in
                      </Link>{' '}
                      and change it. Nobody needs to approve it.
                    </DetailRow>
                    <DetailRow label="Email or mobile">
                      Changed in your settings after you verify the new one. The old address stops
                      receiving sign-in codes the moment the new one is confirmed.
                    </DetailRow>
                    <DetailRow label="Name, roll number, branch, year of passing">
                      These are copied from the college&apos;s degree register and the portal will
                      not overwrite them on request. A formal correction request is the route —
                      raise it under{' '}
                      <Link href="/settings/data" className="link">
                        Settings → Your data
                      </Link>
                      , which starts the statutory clock and records what you asked for.
                    </DetailRow>
                  </dl>

                  <Alert
                    tone="info"
                    title="A wrong degree register entry is not a portal problem"
                    icon={<ScrollText className="size-4" />}
                  >
                    <p>
                      The register is the examinations branch&apos;s academic record of its own
                      graduates — a spelling on it is the spelling on your certificate. If the
                      register itself is wrong (a changed surname after marriage, a transliteration
                      the certificate got wrong, a supplementary year recorded against the wrong
                      batch), the correction has to be made by the{' '}
                      <strong className="font-semibold">examinations branch</strong> and then
                      reloaded here. The alumni cell will forward it and chase it, but it cannot
                      decide it, and neither can this portal. Expect weeks rather than days, and
                      send a scan of the certificate with the request.
                    </p>
                  </Alert>

                  {correctionHref ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <ButtonLink href={correctionHref}>
                        <Mail className="size-4" aria-hidden="true" />
                        Write about a wrong record
                      </ButtonLink>
                      <ButtonLink href="/privacy#your-rights" variant="secondary">
                        Your rights over your data
                      </ButtonLink>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <ButtonLink href="/privacy#your-rights" variant="secondary">
                        Your rights over your data
                      </ButtonLink>
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* 3 — want to help */}
              <Card>
                <CardBody className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-soft-fg">
                      <Handshake className="size-5" aria-hidden="true" />
                    </span>
                    <h3 className="font-display text-lg font-semibold">I want to help</h3>
                  </div>

                  <p className="text-sm text-secondary">
                    Three things the college genuinely needs from alumni, in the order it needs
                    them.
                  </p>

                  <ul className="space-y-3">
                    <Offer title="Mentor a student">
                      Final-year students send a request you can decline, and there is a hard cap
                      on how many they may have open at once. That cap is why alumni still answer
                      in month six. Turn mentoring on from your own profile after signing in — you
                      are not signing up to anything open-ended.
                    </Offer>
                    <Offer title="Speak at a department session">
                      Branches run interview-preparation and industry sessions through the year and
                      are short of speakers, not of audience. An hour online counts; you do not
                      have to travel to Ganguru to be useful.
                    </Offer>
                    <Offer title="Hire or refer">
                      Post the opening yourself once you are signed in. The placement cell reviews
                      it before students see it, which is what keeps the board worth reading. A
                      referral for one student is as welcome as a bulk drive.
                    </Offer>
                  </ul>

                  {helpHref ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <ButtonLink href={helpHref}>
                        <Mail className="size-4" aria-hidden="true" />
                        Offer to help
                      </ButtonLink>
                      <ButtonLink href="/login" variant="secondary">
                        Sign in and set it on your profile
                      </ButtonLink>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <ButtonLink href="/login">Sign in and set it on your profile</ButtonLink>
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          </Section>

          <Separator />

          {/* --------------------------------------------- Honest timings */}
          <Section
            title="How long each of these takes"
            description="Measured from when the cell reads it, on college working days. Nothing is read on a Sunday."
          >
            <dl className="divide-y divide-line rounded-lg border border-line bg-surface-raised px-card">
              <DetailRow label="Sign-in problem">
                Usually one working day. The fix is normally adding or correcting the email address
                held against your roll number.
              </DetailRow>
              <DetailRow label="A claim awaiting verification">
                Up to five working days. A clean match against the register is approved
                automatically; anything ambiguous is looked at by a person, with both records side
                by side.
              </DetailRow>
              <DetailRow label="Profile correction">
                Immediate — you make it yourself. Nothing to wait for.
              </DetailRow>
              <DetailRow label="Degree register correction">
                Weeks. It leaves the portal and goes to the examinations branch, and the alumni
                cell cannot commit to a date on their behalf. You are told when it is raised and
                when it comes back.
              </DetailRow>
              <DetailRow label="Data export, deletion or a formal correction">
                Acknowledged immediately, answered within thirty days — the limit the Digital
                Personal Data Protection Act sets, not an internal target. Raise these in the
                portal rather than by email so the clock and the record start properly.
              </DetailRow>
              <DetailRow label="Offer to mentor, speak or hire">
                A week or so, and it goes to the branch rather than staying with the cell. Nothing
                is lost if you do not hear back — write again, the queue is a queue and not a
                judgement.
              </DetailRow>
            </dl>

            <Alert tone="neutral" title="Do not send documents you were not asked for">
              <p>
                To settle who you are, the cell needs your degree certificate or consolidated memo
                — nothing else. Do not send Aadhaar, PAN, bank details or a photograph of any of
                them. Nobody here needs them, and no one from this portal will ever ask you for a
                payment to verify your account.
              </p>
            </Alert>
          </Section>
        </div>

        {/* ------------------------------------------------------- The details */}
        <aside className="space-y-6">
          <Card>
            <CardBody className="space-y-4">
              <h2 className="font-display text-lg font-semibold">{cell}</h2>

              <dl className="space-y-4 text-sm">
                {email ? (
                  <div className="flex items-start gap-2.5">
                    <Mail className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                    <div className="min-w-0">
                      <dt className="text-secondary">Email</dt>
                      <dd>
                        <a href={`mailto:${email}`} className="link break-all font-medium">
                          {email}
                        </a>
                      </dd>
                    </div>
                  </div>
                ) : null}

                {copy.supportPhone ? (
                  <div className="flex items-start gap-2.5">
                    <Phone className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                    <div className="min-w-0">
                      <dt className="text-secondary">Phone</dt>
                      <dd>
                        <a
                          href={`tel:${copy.supportPhone.replace(/\s+/g, '')}`}
                          className="link font-medium"
                        >
                          {copy.supportPhone}
                        </a>
                      </dd>
                    </div>
                  </div>
                ) : null}

                {copy.addressLines.length ? (
                  <div className="flex items-start gap-2.5">
                    <Building2 className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                    <div className="min-w-0">
                      <dt className="text-secondary">Post and in person</dt>
                      <dd>
                        <address className="not-italic font-medium">
                          {copy.addressLines.map((line) => (
                            <span key={line} className="block">
                              {line}
                            </span>
                          ))}
                        </address>
                      </dd>
                    </div>
                  </div>
                ) : null}

                {copy.websiteUrl ? (
                  <div className="flex items-start gap-2.5">
                    <Globe className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                    <div className="min-w-0">
                      <dt className="text-secondary">College website</dt>
                      <dd>
                        <a
                          href={copy.websiteUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="link inline-flex items-center gap-1 break-all font-medium"
                        >
                          {copy.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                        </a>
                      </dd>
                    </div>
                  </div>
                ) : null}
              </dl>

              <p className="border-t border-line pt-4 text-xs text-muted">
                There is no contact form on this page. A form needs a queue and somebody given time
                to watch it; an address that reaches a person is the version that works today, and
                you keep a copy of what you sent.
              </p>
            </CardBody>
          </Card>

          {/* The DPDP notice has to name where a complaint goes and that
              contact has to be reachable without an account. This is the
              same officer named in section 10 of the notice. */}
          <Card>
            <CardBody className="space-y-3">
              <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand-soft-fg">
                <ShieldAlert className="size-5" aria-hidden="true" />
              </span>
              <h2 className="font-display text-lg font-semibold">Grievance officer</h2>
              <p className="text-sm text-secondary">
                Complaints about how {copy.institutionName} handles your personal data — a request
                refused, answered badly or ignored — go to the grievance officer at the alumni
                cell, who is required to respond. If you are still not satisfied after that, you
                may complain to the Data Protection Board of India.
              </p>
              {email ? (
                <p className="text-sm">
                  <span className="block text-secondary">Grievance officer, alumni cell</span>
                  <a href={`mailto:${email}`} className="link break-all font-medium">
                    {email}
                  </a>
                </p>
              ) : null}
              <p className="text-sm text-secondary">
                The full notice — what is collected, why, who can see it and how long it is kept —
                is the{' '}
                <Link href="/privacy" className="link">
                  privacy notice
                </Link>
                , and the complaints section is{' '}
                <Link href="/privacy#grievance" className="link">
                  section 10
                </Link>
                .
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}

// ---------------------------------------------------------------
// Local pieces
// ---------------------------------------------------------------

function Offer({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-lg border border-line bg-surface p-4">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-secondary">{children}</p>
    </li>
  );
}
