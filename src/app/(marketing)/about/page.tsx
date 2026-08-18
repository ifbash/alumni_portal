import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Building2,
  CalendarDays,
  Check,
  Clock,
  Mail,
  ScrollText,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { getTenantBrand } from '@/lib/tenant';
import { getDepartments, getDegreeRegisterStats, getTenants } from '@/lib/data/repo';
import { ROLE_LABELS } from '@/lib/navigation';
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  DefinitionCard,
  Section,
  Separator,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { formatNumber } from '@/lib/format';

export const metadata: Metadata = {
  title: 'About the portal',
  description:
    'Who runs this alumni portal, which branches it covers, what is live today and what is not.',
};

/**
 * About.
 *
 * The page a cautious registrar reads before forwarding the link to eight
 * thousand people. It answers the three questions that actually get asked
 * — who operates this, where did my name come from, and what can other
 * people see — and it says plainly what is not built yet. A portal that
 * over-claims on its own about page loses the room on the first bug.
 */
export default async function AboutPage() {
  const { tenant, brand } = (await getTenantBrand())!;
  const pack = brand.pack;
  const { copy, features, locale } = pack;

  const departments = getDepartments();
  const register = getDegreeRegisterStats();
  const summary = getTenants().find((t) => t.id === tenant.id) ?? null;
  const fmt = { locale: locale.locale, currency: locale.currency, timeZone: locale.timeZone };

  const established = summary?.established ?? null;

  const live: Array<{ label: string; note: string; on: boolean }> = [
    {
      label: 'Verified alumni directory',
      note: 'Search by branch, batch, company, city or skill. Contact details stay behind a consent check.',
      on: features.directory,
    },
    {
      label: 'Mentorship and referral requests',
      note: 'Rate-limited on the student side so alumni keep replying.',
      on: features.connections && features.mentorship,
    },
    {
      label: 'Events and registration',
      note: 'The annual meet, department panels, batch reunions, with a check-in list.',
      on: features.events,
    },
    {
      label: 'Job and internship board',
      note: 'Posted by alumni, moderated by the placement cell before students see it.',
      on: features.jobs,
    },
    {
      label: 'Giving and campaigns',
      note: 'Held back until the trust confirms its FCRA registration status. Foreign contributions have to be segregated at the point of collection or not collected at all.',
      on: features.donations,
    },
    {
      label: 'WhatsApp notifications',
      note: 'Email reaches a fraction of an Indian alumni list. This is the channel that works, and it is next.',
      on: features.whatsapp,
    },
  ];

  return (
    <>
      <section className="border-b border-line bg-surface-sunken py-16">
        <div className="page-shell max-w-prose space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-fg">
            {copy.institutionName}
          </p>
          <h1 className="font-display text-display-md font-bold">About {copy.portalName}</h1>
          <p className="text-md text-secondary">
            {copy.portalName} is run by the alumni cell of {copy.institutionName}
            {established ? `, established ${established}` : ''}. It is the college&apos;s own
            portal — not a third-party network the college rents space on — and every record in it
            is checked against the examination branch&apos;s degree register.
          </p>
        </div>
      </section>

      <div className="page-shell space-y-16 py-section">
        {/* ------------------------------------------------ Where your name came from */}
        <Section
          title="Where your name came from"
          description="Nobody scraped anything. There are exactly two ways a person ends up in here."
        >
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardBody className="space-y-3">
                <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand-soft-fg">
                  <ScrollText className="size-5" aria-hidden="true" />
                </span>
                <h3 className="font-display text-lg font-semibold">You graduated from here</h3>
                <p className="text-sm text-secondary">
                  The examinations branch supplied the degree register — roll number, name, branch and
                  year of passing for every graduate. That file currently holds{' '}
                  <strong className="font-semibold text-primary tabular">
                    {formatNumber(register.total, fmt)}
                  </strong>{' '}
                  records. A register row is not an account: it sits unclaimed until you sign up and
                  the two are matched.
                </p>
                <p className="text-sm text-secondary">
                  {formatNumber(register.unclaimed, fmt)} records are still unclaimed.
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
                  Final-year students are added by the placement cell from the current enrolment
                  list, and invited by email. Students cannot self-register — that is what keeps the
                  student cohort from being a way in for anyone else.
                </p>
                <p className="text-sm text-secondary">
                  On the day your batch graduates, the same record becomes an alumni record. Nothing
                  is migrated, nothing is retyped, and you keep your profile.
                </p>
              </CardBody>
            </Card>
          </div>
        </Section>

        <Separator />

        {/* ------------------------------------------------------------ Branches */}
        <Section
          title="Branches covered"
          description="Every B.Tech programme the college has run. Intake is the sanctioned figure, not the number of people on the portal."
        >
          <div className="hidden sm:block">
            <TableWrap caption="Branches, year established and sanctioned intake">
              <Table>
                <THead>
                  <TR>
                    <TH>Branch</TH>
                    <TH>Code</TH>
                    <TH align="right">Established</TH>
                    <TH align="right">Sanctioned intake</TH>
                  </TR>
                </THead>
                <TBody>
                  {departments.map((d) => (
                    <TR key={d.id}>
                      <TD className="font-medium">{d.name}</TD>
                      <TD>
                        <span className="font-mono text-xs text-secondary">{d.code}</span>
                      </TD>
                      <TD numeric>{d.established ?? '—'}</TD>
                      <TD numeric>{d.intake ? formatNumber(d.intake, fmt) : '—'}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          </div>

          <div className="space-y-3 sm:hidden">
            {departments.map((d) => (
              <DefinitionCard
                key={d.id}
                title={d.name}
                subtitle={d.code}
                rows={[
                  { label: 'Established', value: d.established ?? '—' },
                  { label: 'Sanctioned intake', value: d.intake ? formatNumber(d.intake, fmt) : '—' },
                ]}
              />
            ))}
          </div>
        </Section>

        <Separator />

        {/* --------------------------------------------------------------- Roles */}
        <Section
          title="Who can see what"
          description="Access is a set of capabilities attached to a role, not a job title someone typed into a settings screen. There are nine roles."
        >
          <div className="flex flex-wrap gap-2">
            {Object.values(ROLE_LABELS).map((label) => (
              <Badge key={label} tone="outline">
                {label}
              </Badge>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardBody className="space-y-2">
                <h3 className="font-display text-base font-semibold">Students see less</h3>
                <p className="text-sm text-secondary">
                  A student account can read an alumnus&apos;s branch, batch, company, role and city.
                  It cannot read an email address, a mobile number or a donation page — not through
                  the directory, not through search, not through an export.
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="space-y-2">
                <h3 className="font-display text-base font-semibold">Staff are scoped</h3>
                <p className="text-sm text-secondary">
                  A head of department reviews verification claims for their own branch and no other.
                  The placement cell sees CGPA and placement status; alumni never do, because alumni
                  post jobs here.
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="space-y-2">
                <h3 className="font-display text-base font-semibold">Exports are logged</h3>
                <p className="text-sm text-secondary">
                  A bulk export of contact details can only be run by a college administrator, and it
                  writes who ran it, what it covered and why into an audit log that administrators
                  cannot edit.
                </p>
              </CardBody>
            </Card>
          </div>

          <p className="text-sm text-secondary">
            The full picture, in the language the law uses, is in the{' '}
            <Link href="/privacy" className="link">
              privacy notice
            </Link>
            .
          </p>
        </Section>

        <Separator />

        {/* ------------------------------------------------ Live today / not yet */}
        <Section
          title="What is live today"
          description="Written honestly, because you will find out anyway."
        >
          <ul className="grid gap-3 sm:grid-cols-2">
            {live.map((item) => (
              <li key={item.label}>
                <div className="flex h-full gap-3 rounded-lg border border-line bg-surface-raised p-4">
                  <span
                    className={
                      item.on
                        ? 'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-success-soft text-success-fg'
                        : 'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-surface-sunken text-muted'
                    }
                    aria-hidden="true"
                  >
                    {item.on ? <Check className="size-3.5" /> : <Clock className="size-3.5" />}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold">
                      {item.label}{' '}
                      <span className={item.on ? 'text-success-fg' : 'text-muted'}>
                        {item.on ? '· live' : '· not yet'}
                      </span>
                    </p>
                    <p className="text-sm text-secondary">{item.note}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <Alert tone="info" title="Where the data lives" icon={<ShieldCheck className="size-4" />}>
            <p>
              The database and file storage sit in the Mumbai region. No member data is transferred
              outside India, which keeps cross-border transfer under the Digital Personal Data
              Protection Act entirely out of scope.
            </p>
          </Alert>
        </Section>

        <Separator />

        {/* ------------------------------------------------------------- Contact */}
        <Section title="Reaching the alumni cell">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card>
              <CardBody className="space-y-4">
                <div className="flex flex-wrap gap-x-8 gap-y-4">
                  {copy.supportEmail ? (
                    <p className="flex items-start gap-2.5 text-sm">
                      <Mail className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                      <span>
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
                        <span className="block text-secondary">Office</span>
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
                  If your name, roll number or year of passing does not match the register — a
                  changed surname, a transfer, a supplementary year — write to the alumni cell with a
                  scan of your degree certificate and they will correct the record rather than reject
                  the claim.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-3">
                <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand-soft-fg">
                  <CalendarDays className="size-5" aria-hidden="true" />
                </span>
                <h3 className="font-display text-lg font-semibold">Ready to start?</h3>
                <p className="text-sm text-secondary">
                  Sign in if the college already has your email. Otherwise claim your profile with
                  your roll number.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <ButtonLink href="/login" size="sm">
                    Sign in
                  </ButtonLink>
                  <ButtonLink href="/claim" variant="secondary" size="sm">
                    Claim your profile
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
