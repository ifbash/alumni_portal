import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, Mail, ScrollText, Users } from 'lucide-react';
import { getTenantBrand } from '@/lib/tenant';
import { getDepartments } from '@/lib/data/repo';
import { registerIsFactual } from '@/lib/data/public-events';
import { capitalise, rollNumber } from '@/lib/branding/copy';
import { ButtonLink, Card, CardBody, Section } from '@/components/ui';

export const metadata: Metadata = {
  title: 'About the portal',
  description: 'Who runs this alumni portal, where your name came from, and who can see your details.',
};

/**
 * About.
 *
 * Written for a graduate deciding whether to register, not for a registrar
 * evaluating a vendor. It answers the three questions alumni actually ask
 * — who runs this, how did my name get here, and who can see my details —
 * and stops.
 *
 * What it deliberately does not carry:
 *
 *  - **Any count built from the register or from members.** How many
 *    records are "still unclaimed" is registration coverage by another
 *    name, and a public page never states it.
 *  - **Facts about the college the college has not given.** A year of
 *    establishment and per-branch sanctioned intake are awaited from DIET;
 *    fixture values printed here would read as the college's own. The
 *    branch list is shown only when the register is the college's own
 *    (`registerIsFactual`).
 *  - **Product internals.** Role lists, capabilities, what is "not built
 *    yet", and the college's legal registration status belong to the
 *    people who run the portal, not on its public About page.
 */
export default async function AboutPage() {
  const { brand } = (await getTenantBrand())!;
  const pack = brand.pack;
  const { copy } = pack;
  const office = copy.officeName;
  const roll = rollNumber(copy);

  const departments = registerIsFactual(pack.id) ? getDepartments() : [];

  return (
    <>
      <section aria-labelledby="about-title" className="band-surface">
        <div className="page-shell py-12 lg:py-16">
          <div className="max-w-prose space-y-3">
            <p className="text-sm font-semibold text-band-accent">{copy.institutionName}</p>
            <h1 id="about-title" className="font-display text-display-md font-bold text-band-fg">
              About {copy.portalName}
            </h1>
            <p className="text-md text-band-muted">
              {copy.portalName} is the alumni network of {copy.institutionName}, run by the
              college&apos;s {office}. Graduates are checked against the college&apos;s records
              before their account opens.
            </p>
          </div>
        </div>
      </section>

      <div className="page-shell space-y-12 py-12 md:space-y-16 md:py-section">
        {/* ------------------------------------------------ Where your name came from */}
        <Section title="Where your name came from" description="There are two ways a person ends up here.">
          <div className="grid gap-4 md:grid-cols-2 md:gap-6">
            <Card>
              <CardBody className="space-y-3">
                <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand-soft-fg">
                  <ScrollText className="size-5" aria-hidden="true" />
                </span>
                <h3 className="font-display text-lg font-semibold">You graduated from here</h3>
                <p className="text-sm text-secondary">
                  You register with your {roll.mid}, name, branch and year of passing, and the college
                  checks them against its record of graduates from the examinations branch. Until that
                  match is made there is no account, and nothing about you appears in the directory.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-3">
                <span className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent-soft-fg">
                  <Users className="size-5" aria-hidden="true" />
                </span>
                <h3 className="font-display text-lg font-semibold">You are in your final year</h3>
                <p className="text-sm text-secondary">
                  The placement cell adds final-year students and invites them by email, so students do
                  not register themselves. When your batch graduates, your account moves across to
                  alumni. Nothing is retyped, and you keep your profile.
                </p>
              </CardBody>
            </Card>
          </div>
        </Section>

        {/* ------------------------------------------------------------ Branches */}
        {departments.length ? (
          <Section title="Branches on the register" description="Graduates of these branches can register.">
            <ul className="grid gap-x-8 sm:grid-cols-2">
              {departments.map((d) => (
                <li
                  key={d.id}
                  className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-sm"
                >
                  <span className="font-medium">{d.name}</span>
                  <span className="shrink-0 font-mono text-xs text-secondary">{d.code}</span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {/* ------------------------------------------------ Who sees your details */}
        <Section
          title="Who sees your details"
          description="What someone can see depends on who they are, and on your own settings."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardBody className="space-y-2">
                <h3 className="font-display text-base font-semibold">Students see less</h3>
                <p className="text-sm text-secondary">
                  A final-year student can see an alumnus&apos;s branch, batch, company, role and city
                  — never an email address or a mobile number.
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="space-y-2">
                <h3 className="font-display text-base font-semibold">You decide on contact details</h3>
                <p className="text-sm text-secondary">
                  Other alumni see your email address or mobile number only if your visibility setting
                  allows it. You can change it at any time.
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="space-y-2">
                <h3 className="font-display text-base font-semibold">Exports are recorded</h3>
                <p className="text-sm text-secondary">
                  Only a college administrator can export contact details, and every export records who
                  ran it, what it covered and why.
                </p>
              </CardBody>
            </Card>
          </div>

          <p className="text-sm text-secondary">
            The full picture is in the{' '}
            <Link href="/privacy" className="link">
              privacy notice
            </Link>
            .
          </p>
        </Section>

        {/* ------------------------------------------------------------- Contact */}
        <Section title={`Reaching the ${office}`}>
          <div className="grid gap-4 md:gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card>
              <CardBody className="space-y-4">
                <div className="flex flex-wrap gap-x-8 gap-y-4">
                  {copy.supportEmail ? (
                    <p className="flex items-start gap-2.5 text-sm">
                      <Mail className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-secondary">Email</span>
                        <a href={`mailto:${copy.supportEmail}`} className="link break-all">
                          {copy.supportEmail}
                        </a>
                      </span>
                    </p>
                  ) : null}

                  {copy.addressLines.length ? (
                    <p className="flex items-start gap-2.5 text-sm">
                      <Building2 className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                      <span>
                        <span className="block text-secondary">{capitalise(office)}</span>
                        {copy.addressLines.map((line) => (
                          <span key={line} className="block font-medium">
                            {line}
                          </span>
                        ))}
                      </span>
                    </p>
                  ) : null}
                </div>

                <p className="text-sm text-secondary">
                  If your name, {roll.mid} or year of passing does not match the college&apos;s records —
                  a changed surname, a transfer, a supplementary year — write to the {office} with a scan
                  of your degree certificate. They correct the record rather than turn you away.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-3">
                <h3 className="font-display text-lg font-semibold">Ready to start?</h3>
                <p className="text-sm text-secondary">
                  Sign in if the college already has your email address. Otherwise, register with your{' '}
                  {roll.mid}.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <ButtonLink href="/login" className="min-h-11">
                    Sign in
                  </ButtonLink>
                  <ButtonLink href="/claim" variant="secondary" className="min-h-11">
                    Register
                  </ButtonLink>
                </div>
              </CardBody>
            </Card>
          </div>
        </Section>
      </div>
    </>
  );
}
