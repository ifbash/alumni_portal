import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CalendarDays,
  CalendarRange,
  FileSearch,
  GraduationCap,
  Handshake,
  MapPin,
  ScrollText,
  ShieldCheck,
  Ticket,
  Users,
} from 'lucide-react';
import { getTenantBrand } from '@/lib/tenant';
import { getDegreeRegisterStats, getEvents, getTenants, getDepartments } from '@/lib/data/repo';
import { Badge, ButtonLink, Card, CardBody, EmptyState, Section, Stat } from '@/components/ui';
import { ProportionBar } from '@/components/charts';
import { GridBackdrop, MarginNote } from '@/components/brand/Marks';
import { formatDateRange, formatNumber, formatPercent, formatCurrency } from '@/lib/format';

/**
 * The landing page.
 *
 * This is the door for two audiences at once: a 2016 graduate who was
 * forwarded a link on WhatsApp, and a principal deciding whether to buy
 * the thing. Both are served by the same discipline — every number on
 * this page is read from the repository at request time, and every claim
 * made is one the portal can actually show. There is no testimonial, no
 * invented "10,000 alumni", and no module advertised that the tenant's
 * brand pack has switched off.
 *
 * All copy that differs between colleges comes from `brand.pack.copy`.
 * Reskinning this page for the next customer is a JSON file.
 */

export async function generateMetadata(): Promise<Metadata> {
  const resolved = await getTenantBrand();
  const pack = resolved?.brand.pack;
  if (!pack) return { title: 'Alumni Portal' };

  return {
    title: { absolute: `${pack.copy.portalName} — ${pack.copy.institutionName}` },
    description:
      pack.copy.heroSubhead ??
      pack.copy.tagline ??
      `The alumni network of ${pack.copy.institutionName}.`,
  };
}

/**
 * Wraps the emphasised phrase in the marker stroke.
 *
 * The pack promises `heroEmphasis` appears inside `heroHeadline`; if a
 * customer edits one and not the other, the headline still renders in
 * full and simply loses its mark. A missing highlight is invisible, a
 * thrown error is a blank homepage.
 */
function Headline({ headline, emphasis }: { headline: string; emphasis?: string }) {
  const at = emphasis ? headline.indexOf(emphasis) : -1;
  if (!emphasis || at < 0) return <>{headline}</>;

  return (
    <>
      {headline.slice(0, at)}
      <span className="marker-underline">{emphasis}</span>
      {headline.slice(at + emphasis.length)}
    </>
  );
}

export default async function LandingPage() {
  const { tenant, brand } = (await getTenantBrand())!;
  const pack = brand.pack;
  const { copy, features, locale } = pack;

  // A college that has not bought the public surface has no landing page,
  // and the door is the sign-in screen instead.
  if (!features.publicLanding) redirect('/login');

  // Public-safe reads only. `getStats()` needs a session and applies a
  // viewer projection; nothing here touches a member row.
  const register = getDegreeRegisterStats();
  const summary = getTenants().find((t) => t.id === tenant.id) ?? null;
  const departments = getDepartments();
  const upcoming = features.events ? getEvents(null, { when: 'upcoming' }) : [];

  const years = register.byYear.map((r) => r.year);
  const firstBatch = years.length ? Math.min(...years) : null;
  const lastBatch = years.length ? Math.max(...years) : null;

  const fmt = { locale: locale.locale, currency: locale.currency, timeZone: locale.timeZone };

  const headline = copy.heroHeadline ?? `The ${copy.shortName} alumni network, in one place.`;
  const subhead =
    copy.heroSubhead ??
    copy.tagline ??
    `Find the batch you graduated with, mentor the students coming up behind you, and hear about campus events before they happen.`;

  return (
    <>
      {/* ---------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <GridBackdrop />

        <div className="page-shell relative grid gap-12 py-16 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:py-section">
          <div className="animate-fade-up space-y-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-fg">
              {copy.institutionName}
            </p>

            <h1 className="font-display text-display-lg font-bold">
              <Headline headline={headline} emphasis={copy.heroEmphasis} />
            </h1>

            <p className="max-w-prose text-md text-secondary">{subhead}</p>

            <div className="flex flex-wrap items-center gap-3">
              <ButtonLink href="/login" size="lg">
                Sign in with your email
                <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="/claim" variant="secondary" size="lg">
                I have never signed in
              </ButtonLink>
            </div>

            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-secondary">
              <li className="flex items-center gap-2">
                <ShieldCheck className="size-4 shrink-0 text-brand-fg" aria-hidden="true" />
                No password to remember — a six-digit code by email
              </li>
              <li className="flex items-center gap-2">
                <BadgeCheck className="size-4 shrink-0 text-brand-fg" aria-hidden="true" />
                Every profile checked against college records
              </li>
            </ul>
          </div>

          {/* The differentiator, stated as data rather than as a promise. */}
          <Card className="animate-fade-up">
            <CardBody className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="font-display text-lg font-semibold">The degree register</h2>
                  <p className="text-sm text-secondary">
                    Loaded from the examinations branch. It is the evidence every approval is made
                    against.
                  </p>
                </div>
                <ScrollText className="size-5 shrink-0 text-muted" aria-hidden="true" />
              </div>

              <p className="font-display text-display-sm font-bold tabular">
                {formatNumber(register.total, fmt)}
                <span className="ml-2 align-middle text-sm font-medium text-secondary">
                  graduate records
                </span>
              </p>

              <ProportionBar
                label="Degree register, claimed versus unclaimed"
                segments={[
                  { label: 'Profile claimed', value: register.claimed, tone: 'brand' },
                  { label: 'Not claimed yet', value: register.unclaimed, tone: 'neutral' },
                ]}
              />

              <p className="text-sm text-secondary">
                {formatPercent(register.coverage, 0)} of graduates have claimed their profile so far.
                If yours is one of the {formatNumber(register.unclaimed, fmt)} that has not,{' '}
                <Link href="/claim" className="link">
                  start with your roll number
                </Link>
                .
              </p>
            </CardBody>
          </Card>
        </div>
      </section>

      {/* ---------------------------------------------------- Live numbers */}
      <section className="page-shell py-12" aria-labelledby="numbers-heading">
        <h2 id="numbers-heading" className="sr-only">
          The network in numbers
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Alumni on the portal"
            value={formatNumber(summary?.alumniCount ?? register.claimed, fmt)}
            hint="Each one matched to a degree record"
            icon={<GraduationCap className="size-5" />}
          />
          <Stat
            label="Final-year students"
            value={formatNumber(summary?.studentCount ?? 0, fmt)}
            hint="Invited by the placement cell, not self-registered"
            icon={<Users className="size-5" />}
          />
          <Stat
            label="Batches covered"
            value={formatNumber(register.byYear.length, fmt)}
            hint={firstBatch && lastBatch ? `${firstBatch} to ${lastBatch}` : 'From the register'}
            icon={<CalendarRange className="size-5" />}
          />
          <Stat
            label="Branches"
            value={formatNumber(departments.length, fmt)}
            hint={departments.map((d) => d.code).join(' · ')}
            icon={<Briefcase className="size-5" />}
          />
        </div>
      </section>

      {/* -------------------------------------------------- Two audiences */}
      <section className="border-y border-line bg-surface-sunken py-section" aria-labelledby="cohorts-heading">
        <div className="page-shell space-y-8">
          <div className="max-w-prose space-y-3">
            <h2 id="cohorts-heading" className="font-display text-display-sm font-bold">
              One portal, two very different jobs
            </h2>
            <p className="text-md text-secondary">
              What an alumnus needs from this and what a final-year student needs from it are not the
              same thing, and pretending otherwise is how alumni networks go quiet. The two sides are
              built separately.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardBody className="space-y-5">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand-soft-fg">
                    <GraduationCap className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-semibold">If you graduated from here</h3>
                    <p className="text-sm text-secondary">
                      {firstBatch ? `Batch of ${firstBatch} onwards` : 'Any batch'}
                    </p>
                  </div>
                </div>

                <ul className="space-y-4">
                  {features.directory ? (
                    <Benefit icon={<Users className="size-4" />} title="Find your batch again">
                      Search by branch, batch, company or city. Profiles carry where someone works and
                      what they work on — never a phone number you did not ask for.
                    </Benefit>
                  ) : null}
                  {features.connections ? (
                    <Benefit icon={<Handshake className="size-4" />} title="Answer only when you want to">
                      Students reach you through a request you can decline. Your email and mobile are
                      released only if you have set them to be — role alone is never enough.
                    </Benefit>
                  ) : null}
                  {features.jobs ? (
                    <Benefit icon={<Briefcase className="size-4" />} title="Post a role you are hiring for">
                      Openings and internships go to the placement cell for a look before they appear
                      to students, so the board stays worth reading.
                    </Benefit>
                  ) : null}
                  {features.events ? (
                    <Benefit icon={<CalendarDays className="size-4" />} title="Come back to campus">
                      The annual meet, department panels and batch reunions, with a real registration
                      list instead of a WhatsApp headcount.
                    </Benefit>
                  ) : null}
                </ul>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-5">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent-soft-fg">
                    <Users className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-semibold">If you are in your final year</h3>
                    <p className="text-sm text-secondary">Added by the placement cell, not by signing up</p>
                  </div>
                </div>

                <ul className="space-y-4">
                  {features.directory ? (
                    <Benefit icon={<MapPin className="size-4" />} title="See where the batches ahead went">
                      Company, role and city for every verified alumnus. Contact details are not part
                      of what a student account can read, at any point.
                    </Benefit>
                  ) : null}
                  {features.mentorship ? (
                    <Benefit icon={<Handshake className="size-4" />} title="Ask for a mentor or a referral">
                      Five open requests at a time. The cap is the reason alumni still reply in month
                      six — an unlimited inbox is an ignored inbox.
                    </Benefit>
                  ) : null}
                  {features.jobs ? (
                    <Benefit icon={<Briefcase className="size-4" />} title="Apply to what alumni post">
                      Roles and internships from people who sat in the same classrooms, moderated
                      before they reach you.
                    </Benefit>
                  ) : null}
                  {features.events ? (
                    <Benefit icon={<Ticket className="size-4" />} title="Sit in on the sessions">
                      Interview preparation, system design, service versus product — run by alumni,
                      open to students who register.
                    </Benefit>
                  ) : null}
                </ul>
              </CardBody>
            </Card>
          </div>

          <MarginNote className="max-w-prose">
            Two things this portal will never do: show a student an alumnus&apos;s contact details, or
            put a donation page in front of a final-year. Both are enforced in the database, not in
            the interface — a forgotten condition in a query cannot leak past them.
          </MarginNote>
        </div>
      </section>

      {/* ------------------------------------------------ How verification works */}
      <section className="page-shell py-section" aria-labelledby="verify-heading">
        <div className="max-w-prose space-y-3">
          <h2 id="verify-heading" className="font-display text-display-sm font-bold">
            How we know you are who you say you are
          </h2>
          <p className="text-md text-secondary">
            Anyone can type a name into a form. The portal only accepts one that lines up with the
            college&apos;s own examination records.
          </p>
        </div>

        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          <Step
            n={1}
            icon={<ScrollText className="size-5" aria-hidden="true" />}
            title="You give us four things"
          >
            Roll number, your name exactly as printed on the degree certificate, branch, and year of
            passing. Email and mobile so we can reach you about the result.
          </Step>
          <Step
            n={2}
            icon={<FileSearch className="size-5" aria-hidden="true" />}
            title="We match it against the register"
          >
            {formatNumber(register.total, fmt)} records, loaded from the examinations branch. The
            matcher scores name, roll number, branch and year, and tolerates the spelling drift
            between a certificate and how you write your own name.
          </Step>
          <Step
            n={3}
            icon={<BadgeCheck className="size-5" aria-hidden="true" />}
            title="A person decides the close calls"
          >
            A clean match is approved straight away. Anything ambiguous — two graduates with the same
            name in the same branch and year, which happens more than you would think — goes to the
            alumni cell with both records side by side.
          </Step>
        </ol>
      </section>

      {/* ------------------------------------------------------------ Events */}
      {features.events ? (
        <section className="border-y border-line bg-surface-sunken py-section" aria-labelledby="events-heading">
          <div className="page-shell">
            <Section
              title={<span id="events-heading">Coming up on campus</span>}
              description="Open to alumni and, where marked, to final-year students. Registration is inside the portal."
              actions={
                <ButtonLink href="/login" variant="secondary" size="sm">
                  Sign in to register
                </ButtonLink>
              }
            >
              {upcoming.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays className="size-5" aria-hidden="true" />}
                  title="Nothing scheduled publicly right now"
                  description="The alumni cell publishes the annual meet and department sessions here once dates are fixed. Members are emailed as soon as one goes up."
                  action={
                    <ButtonLink href="/login" size="sm">
                      Sign in
                    </ButtonLink>
                  }
                />
              ) : (
                <ul className="grid gap-4 md:grid-cols-3">
                  {upcoming.slice(0, 3).map((e) => {
                    const seatsLeft = e.capacity === null ? null : e.capacity - e.registeredCount;
                    const full = seatsLeft !== null && seatsLeft <= 0;

                    return (
                      <li key={e.id}>
                        {/* Not `interactive`: there is nothing to click until
                            you are signed in, and a hover lift that leads
                            nowhere is a promise the card cannot keep. */}
                        <Card className="h-full">
                          <CardBody className="flex h-full flex-col gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              {e.departmentCode ? (
                                <Badge tone="brand">{e.departmentCode}</Badge>
                              ) : (
                                <Badge tone="neutral">All branches</Badge>
                              )}
                              {e.studentEligible ? <Badge tone="accent">Students welcome</Badge> : null}
                              {full ? (
                                <Badge tone="warning" dot>
                                  Waitlist
                                </Badge>
                              ) : null}
                            </div>

                            <h3 className="font-display text-lg font-semibold">{e.title}</h3>

                            <p className="flex items-start gap-2 text-sm text-secondary">
                              <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                              <span>{formatDateRange(e.startsAt, e.endsAt, fmt)}</span>
                            </p>

                            {e.venue ? (
                              <p className="flex items-start gap-2 text-sm text-secondary">
                                <MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                                <span>{e.venue}</span>
                              </p>
                            ) : null}

                            <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-xs text-muted">
                              <span className="tabular">
                                {formatNumber(e.registeredCount, fmt)} registered
                                {e.capacity !== null ? ` of ${formatNumber(e.capacity, fmt)}` : ''}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{e.ticketPrice > 0 ? formatCurrency(e.ticketPrice, fmt) : 'Free'}</span>
                            </p>
                          </CardBody>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
          </div>
        </section>
      ) : null}

      {/* -------------------------------------------------------- Closing CTA */}
      <section className="bg-surface-inverse py-section text-on-inverse">
        <div className="page-shell grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-center">
          <div className="space-y-3">
            <h2 className="font-display text-display-sm font-bold text-on-inverse">
              Your roll number is enough to start.
            </h2>
            <p className="max-w-prose text-md text-on-inverse">
              If the college has your email already, sign in and a six-digit code arrives in a few
              seconds. If it does not — and for most batches before 2018 it does not — claim your
              profile and the alumni cell will match you against the register.
            </p>
            {copy.supportEmail ? (
              <p className="text-sm text-on-inverse">
                Something not lining up? Write to{' '}
                <a href={`mailto:${copy.supportEmail}`} className="underline underline-offset-4">
                  {copy.supportEmail}
                </a>{' '}
                with your roll number and year of passing.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3 lg:justify-end">
            <ButtonLink href="/login" size="lg">
              Sign in
              <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="/claim" variant="secondary" size="lg">
              Claim your profile
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------
// Local pieces
// ---------------------------------------------------------------

function Benefit({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-surface-sunken text-brand-fg" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 space-y-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-secondary">{children}</p>
      </div>
    </li>
  );
}

function Step({
  n,
  icon,
  title,
  children,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Card className="h-full">
        <CardBody className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft font-display text-sm font-bold text-brand-soft-fg tabular">
              {n}
            </span>
            <span className="text-muted">{icon}</span>
          </div>
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <p className="text-sm text-secondary">{children}</p>
        </CardBody>
      </Card>
    </li>
  );
}
