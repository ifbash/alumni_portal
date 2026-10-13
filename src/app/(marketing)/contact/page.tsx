import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Building2,
  ExternalLink,
  Globe,
  Handshake,
  Info,
  KeyRound,
  Mail,
  Phone,
  ShieldAlert,
  SquarePen,
} from 'lucide-react';
import { getTenantBrand } from '@/lib/tenant';
import { mailto } from '@/lib/mailto';
import { rollNumber } from '@/lib/branding/copy';
import { Alert, ButtonLink, Card, CardBody, Section, Separator } from '@/components/ui';
import { cn } from '@/lib/cn';

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
 * Every address, number, place and promised time is read from
 * `brand.pack.copy`. Nothing here is DIET's by default: a pack with no
 * `supportPhone` does not render that row, and a pack with no
 * `supportTurnaround` or `reviewTurnaround` is promised no time at all,
 * rather than one typed into a component that the college never made.
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
    title: `Contact the ${pack.copy.officeName}`,
    description: `How to reach the ${pack.copy.officeName} of ${pack.copy.institutionName} — sign-in problems, corrections to your record, and offers to mentor, speak or hire.`,
  };
}

export default async function ContactPage() {
  const resolved = await getTenantBrand();
  if (!resolved) notFound();

  const { copy } = resolved.brand.pack;
  const email = copy.supportEmail ?? null;
  const office = copy.officeName;
  const cell = `${copy.shortName} ${office}`;
  const roll = rollNumber(copy);

  const signInHref = email
    ? mailto(email, `Cannot sign in — ${copy.shortName} alumni portal`, [
        `${roll.label}:`,
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
        `${roll.label}:`,
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
      <section aria-labelledby="contact-title" className="band-surface">
        <div className="page-shell py-12 lg:py-16">
          <div className="max-w-prose space-y-3">
            <p className="text-sm font-semibold text-band-accent">{copy.institutionName}</p>
            <h1 id="contact-title" className="font-display text-display-md font-bold text-band-fg">
              Contact the {office}
            </h1>
            <p className="text-md text-band-muted">
              Trouble signing in, a record that needs correcting, or an offer to help: each has its own
              route below, so your message reaches the right person first time.
            </p>
          </div>
        </div>
      </section>

      <div className="page-shell grid gap-12 py-12 md:py-section lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-16">
        <div className="min-w-0 space-y-12 md:space-y-14">
          {!email ? (
            <Alert tone="warning" title="No email address is configured for this portal yet">
              <p>
                Until the college supplies one, use the postal address below. Nothing on this page will
                silently send your message somewhere else.
              </p>
            </Alert>
          ) : null}

          {/* ------------------------------------------------ Three routes in */}
          <Section
            title="What do you need?"
            description={`Pick the one that matches. Each opens your mail app with the details the ${office} would otherwise have to ask you for.`}
          >
            <div className="space-y-4">
              {/* 1 — cannot sign in. The id is linked from the auth frame, the
                  sign-in page and the footer; scroll-mt clears the sticky header. */}
              <Card id="cannot-sign-in" className="scroll-mt-20">
                <CardBody className="space-y-3">
                  <RouteHeading icon={<KeyRound className="size-5" aria-hidden="true" />}>
                    I cannot sign in
                  </RouteHeading>

                  <p className="text-sm text-secondary">
                    Sign-in sends a six-digit code to the email address the college holds for you. If
                    the college does not have your address yet, the first step is{' '}
                    <Link className="link" href="/claim">
                      registering with your {roll.mid}
                    </Link>
                    , not this page.
                  </p>

                  <p className="text-sm text-secondary">
                    Already registered and still cannot get in? Write to the {office} with your{' '}
                    <strong className="font-semibold text-primary">{roll.mid}</strong> and{' '}
                    <strong className="font-semibold text-primary">year of passing</strong>. A name alone
                    is not enough: the same name in the same branch and year is more common than you
                    would think.
                    {copy.supportTurnaround
                      ? ` Sign-in problems are usually answered within ${copy.supportTurnaround}.`
                      : ''}
                  </p>

                  <Alert tone="warning" title="Do not register a second time">
                    <p>
                      A second registration does not get you in faster. It creates a duplicate the{' '}
                      {office} has to merge by hand before either can go ahead.
                    </p>
                  </Alert>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {signInHref ? (
                      <ButtonLink href={signInHref} className="min-h-11">
                        <Mail className="size-4" aria-hidden="true" />
                        Write about a sign-in problem
                      </ButtonLink>
                    ) : null}
                    <ButtonLink
                      href="/claim"
                      variant={signInHref ? 'secondary' : 'primary'}
                      className="min-h-11"
                    >
                      Register with your {roll.mid}
                    </ButtonLink>
                  </div>
                </CardBody>
              </Card>

              {/* 2 — details are wrong */}
              <Card id="corrections" className="scroll-mt-20">
                <CardBody className="space-y-3">
                  <RouteHeading icon={<SquarePen className="size-5" aria-hidden="true" />}>
                    My details are wrong
                  </RouteHeading>

                  <p className="text-sm text-secondary">
                    Where the correction goes depends on which record is wrong.
                  </p>

                  <dl className="divide-y divide-line rounded-lg border border-line bg-surface px-card">
                    <Row label="Your profile">
                      Photo, employer, designation, city, skills, bio, and whether you are open to
                      mentoring. Yours to edit —{' '}
                      <Link href="/login" className="link">
                        sign in
                      </Link>{' '}
                      and change it. Nobody needs to approve it.
                    </Row>
                    <Row label="Email or mobile">
                      Changed in your settings once you verify the new one. The old address stops
                      receiving sign-in codes as soon as the new one is confirmed.
                    </Row>
                    <Row label={`Name, ${roll.mid}, branch, year of passing`}>
                      These come from the college&apos;s records, and the portal will not overwrite
                      them on request. Raise a formal correction under{' '}
                      <Link href="/settings/data" className="link">
                        Settings → Your data
                      </Link>
                      , which records what you asked for and when.
                    </Row>
                  </dl>

                  <Alert
                    tone="neutral"
                    title="A wrong entry in the college's records is not a portal problem"
                    icon={<Info className="size-4 text-brand-fg" />}
                  >
                    <p>
                      Those records are the examinations branch&apos;s, and a spelling there is the
                      spelling on your certificate. If the record itself is wrong — a surname changed
                      after marriage, a transliteration the certificate got wrong, a supplementary year
                      against the wrong batch — only the examinations branch can correct it. The{' '}
                      {office} will forward the request; send a scan of the certificate with it.
                    </p>
                  </Alert>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {correctionHref ? (
                      <ButtonLink href={correctionHref} className="min-h-11">
                        <Mail className="size-4" aria-hidden="true" />
                        Write about a wrong record
                      </ButtonLink>
                    ) : null}
                    <ButtonLink href="/privacy#your-rights" variant="secondary" className="min-h-11">
                      Your rights over your data
                    </ButtonLink>
                  </div>
                </CardBody>
              </Card>

              {/* 3 — want to help */}
              <Card id="help" className="scroll-mt-20">
                <CardBody className="space-y-3">
                  <RouteHeading
                    icon={<Handshake className="size-5" aria-hidden="true" />}
                    tint="bg-accent-soft text-accent-soft-fg"
                  >
                    I want to help
                  </RouteHeading>

                  <ul className="space-y-3">
                    <Offer title="Mentor a student">
                      Final-year students can send you a request, and you can decline any of them.
                      There is a limit on how many they can have open at once. Turn mentoring on from
                      your profile after signing in.
                    </Offer>
                    <Offer title="Speak at a department session">
                      Sessions can be on campus or online. An hour online counts — you do not have to
                      come to campus to be useful.
                    </Offer>
                    <Offer title="Hire or refer">
                      Post the opening yourself once you are signed in. The placement cell reviews it
                      before students see it.
                    </Offer>
                  </ul>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {helpHref ? (
                      <ButtonLink href={helpHref} className="min-h-11">
                        <Mail className="size-4" aria-hidden="true" />
                        Offer to help
                      </ButtonLink>
                    ) : null}
                    <ButtonLink
                      href="/login"
                      variant={helpHref ? 'secondary' : 'primary'}
                      className="min-h-11"
                    >
                      Sign in and set it on your profile
                    </ButtonLink>
                  </div>
                </CardBody>
              </Card>
            </div>
          </Section>

          <Separator />

          {/* --------------------------------------------- What happens next */}
          <Section
            title="What happens after you write"
            description={`Who handles each of these, and what the ${office} can and cannot decide.`}
          >
            <dl className="divide-y divide-line rounded-lg border border-line bg-surface-raised px-card">
              <Row label="Sign-in problem">
                {copy.supportTurnaround ? `Usually answered within ${copy.supportTurnaround}. ` : ''}
                The fix is normally adding or correcting the email address held against your{' '}
                {roll.mid}.
              </Row>
              <Row label="A registration being checked">
                Your details are compared with the college&apos;s records, then the {office} confirms
                the match{copy.reviewTurnaround ? `, usually within ${copy.reviewTurnaround}` : ''}.
                Anything unclear is looked at by a person, with both records side by side.
              </Row>
              <Row label="Profile correction">Immediate — you make it yourself.</Row>
              <Row label="Correction to the college's records">
                It goes to the examinations branch, and the {office} cannot commit to a date on their
                behalf.
              </Row>
              <Row label="Data export, deletion or a formal correction">
                Acknowledged immediately and answered within thirty days, as the{' '}
                <Link href="/privacy#your-rights" className="link">
                  privacy notice
                </Link>{' '}
                sets out. Raise these in the portal rather than by email, so the request is recorded
                properly.
              </Row>
              <Row label="Offer to mentor, speak or hire">
                The {office} passes it to the branch that can use it. If you do not hear back, write
                again.
              </Row>
            </dl>

            <Alert tone="neutral" title="Do not send documents you were not asked for">
              <p>
                To settle who you are, the {office} needs your degree certificate or consolidated memo —
                nothing else. Do not send Aadhaar, PAN, bank details or a photograph of any of them. No
                one from this portal will ever ask you for a payment to verify your account.
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
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      </dd>
                    </div>
                  </div>
                ) : null}
              </dl>

              <p className="border-t border-line pt-4 text-xs text-secondary">
                There is no contact form on this page. An address that reaches a person is the version
                that works today, and you keep a copy of what you sent.
              </p>
            </CardBody>
          </Card>

          {/* The DPDP notice has to name where a complaint goes and that
              contact has to be reachable without an account. This mirrors
              section 10 of the privacy notice, which names the same office. */}
          <Card>
            <CardBody className="space-y-3">
              <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand-soft-fg">
                <ShieldAlert className="size-5" aria-hidden="true" />
              </span>
              <h2 className="font-display text-lg font-semibold">Grievance officer</h2>
              <p className="text-sm text-secondary">
                Complaints about how {copy.institutionName} handles your personal data — a request
                refused, answered badly or ignored — go to the grievance officer at the {office}. If you
                are still not satisfied after that, you may complain to the Data Protection Board of
                India.
              </p>
              {email ? (
                <p className="text-sm">
                  <span className="block text-secondary">Grievance officer, {office}</span>
                  <a href={`mailto:${email}`} className="link break-all font-medium">
                    {email}
                  </a>
                </p>
              ) : null}
              <p className="text-sm text-secondary">
                The full notice is the{' '}
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

function RouteHeading({
  icon,
  tint = 'bg-brand-soft text-brand-soft-fg',
  children,
}: {
  icon: React.ReactNode;
  tint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg', tint)}>{icon}</span>
      <h3 className="font-display text-lg font-semibold">{children}</h3>
    </div>
  );
}

/**
 * A label and its explanation. Side by side from `sm`; stacked below it,
 * where a 10rem label column left the explanation 120px wide and broke it
 * one to three words to a line.
 */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-3 text-sm sm:grid sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:gap-4">
      <dt className="font-medium text-primary">{label}</dt>
      <dd className="mt-1 min-w-0 text-secondary sm:mt-0">{children}</dd>
    </div>
  );
}

function Offer({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-lg border border-line bg-surface p-4">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-secondary">{children}</p>
    </li>
  );
}
