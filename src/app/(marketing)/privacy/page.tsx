import type { Metadata } from 'next';
import Link from 'next/link';
import { Database, Eye, Globe2, ScrollText, ShieldCheck, Trash2 } from 'lucide-react';
import { getTenantBrand } from '@/lib/tenant';
import { NOTICE_VERSION } from '@/lib/config';
import {
  Alert,
  Badge,
  Card,
  CardBody,
  DefinitionCard,
  DetailRow,
  Separator,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Privacy notice',
  description:
    'What this alumni portal collects, why, who can see it, how long it is kept, and how to exercise your rights under the Digital Personal Data Protection Act, 2023.',
};

/**
 * Privacy notice.
 *
 * Written to be read, and written to be the notice that the consent
 * checkbox on `/claim` actually refers to — which is why it carries the
 * same version string the consent record stores. A consent whose notice
 * text cannot be reconstructed later is not consent that survives being
 * questioned.
 *
 * Public on purpose. It is linked from a checkbox someone ticks before
 * they have an account.
 */

const SECTIONS = [
  { id: 'who', label: 'Who is responsible' },
  { id: 'what', label: 'What is collected' },
  { id: 'why', label: 'Why, and on what basis' },
  { id: 'who-sees', label: 'Who can see what' },
  { id: 'sharing', label: 'Who else it reaches' },
  { id: 'residency', label: 'Where it is stored' },
  { id: 'retention', label: 'How long it is kept' },
  { id: 'your-rights', label: 'Your rights' },
  { id: 'cookies', label: 'Cookies' },
  { id: 'grievance', label: 'Grievance officer' },
];

export default async function PrivacyPage() {
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
          <h1 className="font-display text-display-md font-bold">Privacy notice</h1>
          <p className="text-md text-secondary">
            This notice explains what {copy.portalName} collects about you, why, who inside the
            college can see it, and what you can make us do about it. It is written under the
            Digital Personal Data Protection Act, 2023 and the rules made under it.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Badge tone="brand">Version {NOTICE_VERSION}</Badge>
            <span className="text-sm text-secondary">
              In effect from {formatDate(NOTICE_VERSION, fmt)}
            </span>
          </div>
        </div>
      </section>

      <div className="page-shell grid gap-12 py-section lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] lg:gap-16">
        <article className="min-w-0 space-y-14">
          {/* ------------------------------------------------------------ who */}
          <section id="who" className="scroll-mt-20 space-y-4">
            <h2 className="font-display text-xl font-semibold">1. Who is responsible for your data</h2>
            <p className="max-w-prose text-secondary">
              {copy.institutionName} is the Data Fiduciary for everything in this portal. It decides
              what is collected and why. The alumni cell operates the portal day to day on the
              college&apos;s behalf.
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
            {copy.supportEmail ? (
              <p className="text-sm text-secondary">
                Written queries about this notice:{' '}
                <a href={`mailto:${copy.supportEmail}`} className="link">
                  {copy.supportEmail}
                </a>
              </p>
            ) : null}
          </section>

          <Separator />

          {/* ----------------------------------------------------------- what */}
          <section id="what" className="scroll-mt-20 space-y-4">
            <h2 className="font-display text-xl font-semibold">2. What is collected</h2>
            <p className="max-w-prose text-secondary">
              Only what the portal needs to establish that you are a graduate or a student of this
              college, and to let you use what you signed up for. Nothing is bought from a data
              broker and nothing is scraped from another network.
            </p>

            <div className="hidden sm:block">
              <TableWrap caption="Categories of personal data, examples, and where each comes from">
                <Table>
                  <THead>
                    <TR>
                      <TH>Category</TH>
                      <TH>What it includes</TH>
                      <TH>Where it comes from</TH>
                      <TH>Required?</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {DATA_CATEGORIES.map((row) => (
                      <TR key={row.category}>
                        <TD className="font-medium">{row.category}</TD>
                        <TD className="text-secondary">{row.includes}</TD>
                        <TD className="text-secondary">{row.source}</TD>
                        <TD>
                          <Badge tone={row.required ? 'neutral' : 'outline'}>
                            {row.required ? 'Required' : 'Optional'}
                          </Badge>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            </div>

            <div className="space-y-3 sm:hidden">
              {DATA_CATEGORIES.map((row) => (
                <DefinitionCard
                  key={row.category}
                  title={row.category}
                  subtitle={row.required ? 'Required' : 'Optional'}
                  rows={[
                    { label: 'Includes', value: row.includes },
                    { label: 'Source', value: row.source },
                  ]}
                />
              ))}
            </div>

            <Alert tone="neutral" title="What is deliberately not collected">
              <p>
                No caste, religion, health or biometric data. No location tracking. No advertising
                identifiers. Private messages between members are stored so the recipient can read
                them, and no role in the portal — including a college administrator — has the ability
                to read their contents.
              </p>
            </Alert>
          </section>

          <Separator />

          {/* ------------------------------------------------------------ why */}
          <section id="why" className="scroll-mt-20 space-y-4">
            <h2 className="font-display text-xl font-semibold">3. Why it is processed, and on what basis</h2>

            <dl className="divide-y divide-line rounded-lg border border-line bg-surface-raised px-card">
              <DetailRow label="Verifying you">
                Matching what you submit against the college&apos;s degree register, so that an
                account belongs to the graduate it claims to belong to.{' '}
                <span className="text-secondary">
                  Basis: your voluntary provision of the data for this specific purpose, and the
                  college&apos;s own record-keeping as an examining institution.
                </span>
              </DetailRow>
              <DetailRow label="Listing you in the directory">
                Making your name, branch, batch, employer, role and city visible to other verified
                members.{' '}
                <span className="text-secondary">
                  Basis: your consent, recorded against this notice version. Withdrawable at any
                  time, after which your listing is removed.
                </span>
              </DetailRow>
              <DetailRow label="Releasing your contact details">
                Showing your email or mobile to a specific member.{' '}
                <span className="text-secondary">
                  Basis: your consent, expressed through the visibility setting on your profile.
                  Default is the most restrictive setting.
                </span>
              </DetailRow>
              <DetailRow label="Reaching you">
                Sign-in codes, event details you registered for, replies to your requests, and — if
                you opt in — announcements from the alumni cell.{' '}
                <span className="text-secondary">
                  Basis: consent for announcements; necessary service messages for the rest.
                </span>
              </DetailRow>
              {features.events ? (
                <DetailRow label="Events and payments">
                  Registration lists, guest counts, check-in, and ticket payments taken through a
                  payment gateway.{' '}
                  <span className="text-secondary">
                    Basis: performance of what you asked for; tax records kept as the law requires.
                  </span>
                </DetailRow>
              ) : null}
              <DetailRow label="Keeping the portal safe">
                Rate limits, sign-in attempt records and an audit log of administrative actions.{' '}
                <span className="text-secondary">
                  Basis: the college&apos;s legitimate use in preventing misuse of its own systems.
                </span>
              </DetailRow>
            </dl>

            <p className="max-w-prose text-sm text-secondary">
              Where the basis is consent, refusing it costs you that feature and nothing else. You
              cannot be refused a verified account for declining to be listed in the directory.
            </p>
          </section>

          <Separator />

          {/* ------------------------------------------------------- who sees */}
          <section id="who-sees" className="scroll-mt-20 space-y-4">
            <h2 className="font-display text-xl font-semibold">4. Who inside the college can see what</h2>
            <p className="max-w-prose text-secondary">
              Access is granted to roles, and every role is a fixed set of capabilities. Holding a
              senior title does not widen it. These are the actual rules the portal enforces, not a
              description of an intention.
            </p>

            <div className="hidden sm:block">
              <TableWrap caption="What each role can and cannot see">
                <Table>
                  <THead>
                    <TR>
                      <TH>Role</TH>
                      <TH>Can see</TH>
                      <TH>Cannot see</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {ROLE_VISIBILITY.map((row) => (
                      <TR key={row.role}>
                        <TD className="whitespace-nowrap font-medium">{row.role}</TD>
                        <TD className="text-secondary">{row.sees}</TD>
                        <TD className="text-secondary">{row.never}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            </div>

            <div className="space-y-3 sm:hidden">
              {ROLE_VISIBILITY.map((row) => (
                <DefinitionCard
                  key={row.role}
                  title={row.role}
                  rows={[
                    { label: 'Can see', value: row.sees },
                    { label: 'Cannot see', value: row.never },
                  ]}
                />
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardBody className="space-y-2">
                  <span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand-soft-fg">
                    <Eye className="size-4" aria-hidden="true" />
                  </span>
                  <h3 className="font-display text-base font-semibold">Two gates on every contact detail</h3>
                  <p className="text-sm text-secondary">
                    Your email or mobile is shown to another member only when both are true: their
                    role entitles them to it, <em>and</em> your own visibility setting permits it.
                    Neither one alone is enough. That is purpose limitation, and it is the rule most
                    portals skip.
                  </p>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="space-y-2">
                  <span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand-soft-fg">
                    <ScrollText className="size-4" aria-hidden="true" />
                  </span>
                  <h3 className="font-display text-base font-semibold">Bulk export is one role and a written reason</h3>
                  <p className="text-sm text-secondary">
                    Only a college administrator can export contact details in bulk. Every export
                    records who ran it, what it covered and the stated reason, in a log that cannot
                    be edited from inside the portal.
                  </p>
                </CardBody>
              </Card>
            </div>
          </section>

          <Separator />

          {/* -------------------------------------------------------- sharing */}
          <section id="sharing" className="scroll-mt-20 space-y-4">
            <h2 className="font-display text-xl font-semibold">5. Who else your data reaches</h2>
            <p className="max-w-prose text-secondary">
              A small number of processors, each under contract, each doing one job and nothing else.
              None of them is permitted to use your data for their own purposes.
            </p>
            <ul className="space-y-3">
              <ProcessorItem name="Cloud hosting and file storage" job="Runs the database and stores profile photos. Mumbai region only." />
              <ProcessorItem name="Email delivery" job="Sends sign-in codes and notifications. Receives your email address and the message." />
              {features.events ? (
                <ProcessorItem name="Payment gateway" job="Processes event ticket payments. Receives your name, email and the amount. The portal never stores card or UPI credentials." />
              ) : null}
              {features.whatsapp ? (
                <ProcessorItem name="WhatsApp Business API provider" job="Delivers notifications to the mobile number you verified, if you opted in." />
              ) : null}
            </ul>
            <p className="max-w-prose text-sm text-secondary">
              Your data is never sold, never rented, and never shared with recruiters, coaching
              institutes or other colleges.
            </p>
          </section>

          <Separator />

          {/* ------------------------------------------------------ residency */}
          <section id="residency" className="scroll-mt-20 space-y-4">
            <h2 className="font-display text-xl font-semibold">6. Where your data is stored</h2>
            <Alert tone="success" title="India only" icon={<Globe2 className="size-4" />}>
              <p>
                The database, backups and uploaded files are held in the Mumbai region
                (<span className="font-mono text-xs">ap-south-1</span>). No personal data is
                transferred outside India, so cross-border transfer restrictions under the Act do not
                come into play at all.
              </p>
            </Alert>
            <p className="max-w-prose text-sm text-secondary">
              If that ever changes, this notice changes first, with a new version number, and you are
              told before it takes effect.
            </p>
          </section>

          <Separator />

          {/* ------------------------------------------------------ retention */}
          <section id="retention" className="scroll-mt-20 space-y-4">
            <h2 className="font-display text-xl font-semibold">7. How long it is kept</h2>
            <dl className="divide-y divide-line rounded-lg border border-line bg-surface-raised px-card">
              <DetailRow label="Your profile">
                For as long as your account is active. If you delete your account, the profile and
                its contact details go with it.
              </DetailRow>
              <DetailRow label="Degree register rows">
                Kept permanently. This is the college&apos;s academic record of its own graduates and
                exists whether or not you ever use the portal. Deleting your account does not delete
                the fact that you graduated.
              </DetailRow>
              <DetailRow label="Sign-in codes">
                Ten minutes, then destroyed. A code is single-use.
              </DetailRow>
              <DetailRow label="Consent records">
                Kept for the life of the account and six years after, with the notice version you
                agreed to. This is the evidence of what you were shown.
              </DetailRow>
              <DetailRow label="Audit log">
                Six years. It records administrative actions, not your browsing.
              </DetailRow>
              <DetailRow label="Payment and receipt records">
                Eight years, as required by tax law. These are financial records and cannot be
                deleted on request.
              </DetailRow>
            </dl>
          </section>

          <Separator />

          {/* --------------------------------------------------------- rights */}
          <section id="your-rights" className="scroll-mt-20 space-y-4">
            <h2 className="font-display text-xl font-semibold">8. Your rights, and how to use them</h2>
            <p className="max-w-prose text-secondary">
              Every one of these is a button in the portal, not a form you post to an office. Sign in
              and open{' '}
              <Link href="/settings/privacy" className="link">
                Settings → Privacy and your data
              </Link>
              .
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <RightCard
                icon={<Database className="size-4" aria-hidden="true" />}
                title="Get a copy of everything"
                body="A machine-readable export of your profile, contact details, connections, event registrations and consent history. Delivered to your registered email."
              />
              <RightCard
                icon={<ShieldCheck className="size-4" aria-hidden="true" />}
                title="Correct what is wrong"
                body="Most fields you can edit yourself. Name, roll number and year of passing are checked against the degree register, so a correction there goes to the alumni cell with your certificate as evidence."
              />
              <RightCard
                icon={<Trash2 className="size-4" aria-hidden="true" />}
                title="Erase your account"
                body="Removes your profile, contact details and directory listing. The degree register row and financial records remain, because the law requires them to."
              />
              <RightCard
                icon={<Eye className="size-4" aria-hidden="true" />}
                title="Withdraw consent"
                body="Turn off the directory listing, contact release or announcements at any time, without giving a reason and without losing your account."
              />
            </div>

            <p className="max-w-prose text-secondary">
              You may also <strong className="font-semibold text-primary">nominate</strong> another
              person to exercise these rights on your behalf if you die or become incapable of doing
              so yourself, as the Act permits. That nomination is made in the same settings screen.
            </p>

            <Alert tone="info" title="How long a request takes">
              <p>
                Requests are acknowledged immediately and answered within thirty days. Anything that
                needs a document check — a name correction against the degree register, for example —
                is told to you with the reason and the expected date, not left silent.
              </p>
            </Alert>
          </section>

          <Separator />

          {/* -------------------------------------------------------- cookies */}
          <section id="cookies" className="scroll-mt-20 space-y-4">
            <h2 className="font-display text-xl font-semibold">9. Cookies</h2>
            <p className="max-w-prose text-secondary">
              Two, both strictly necessary, neither used to track you across other sites. There is no
              analytics tag, no advertising pixel and no consent banner, because there is nothing
              here that needs one.
            </p>
            <dl className="divide-y divide-line rounded-lg border border-line bg-surface-raised px-card">
              <DetailRow label="Session cookie">
                Holds a signed reference to your member record so you stay signed in. HTTP-only, so
                no script can read it. Fourteen days.
              </DetailRow>
              <DetailRow label="Theme cookie">
                Remembers whether you chose the light or dark appearance. Contains nothing else.
              </DetailRow>
            </dl>
          </section>

          <Separator />

          {/* ------------------------------------------------------ grievance */}
          <section id="grievance" className="scroll-mt-20 space-y-4">
            <h2 className="font-display text-xl font-semibold">10. Complaints</h2>
            <p className="max-w-prose text-secondary">
              If a request is refused, answered badly, or ignored, take it to the grievance officer
              at the alumni cell first — they are required to respond. If you are still not
              satisfied, you can complain to the Data Protection Board of India.
            </p>
            {copy.supportEmail ? (
              <Card>
                <CardBody className="space-y-1">
                  <p className="text-sm text-secondary">Grievance officer, alumni cell</p>
                  <a href={`mailto:${copy.supportEmail}`} className="link text-md font-medium">
                    {copy.supportEmail}
                  </a>
                  {copy.supportPhone ? (
                    <p className="text-sm text-secondary">{copy.supportPhone}</p>
                  ) : null}
                </CardBody>
              </Card>
            ) : null}

            <p className="max-w-prose text-sm text-secondary">
              Under eighteen? This portal is for graduates and final-year students, all of whom are
              adults. If you believe an account here belongs to a child, tell the alumni cell and it
              will be closed.
            </p>
          </section>

          <Separator />

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold">Changes to this notice</h2>
            <p className="max-w-prose text-secondary">
              Every version of this notice carries a version string, and every consent you give is
              stored against the version you were shown. If the notice changes in a way that widens
              what is done with your data, you are asked again — a silent update is not consent.
            </p>
            <p className="text-sm text-muted">
              Current version <span className="font-mono">{NOTICE_VERSION}</span>, in effect from{' '}
              {formatDate(NOTICE_VERSION, fmt)}.
            </p>
          </section>
        </article>

        {/* On this page. Below lg it sits above the article, where a phone
            reader will actually use it. */}
        <nav aria-label="On this page" className="order-first lg:order-none">
          <div className="lg:sticky lg:top-20">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">On this page</p>
            <ol className="mt-3 space-y-1.5 text-sm">
              {SECTIONS.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="link-quiet text-secondary">
                    <span className="mr-2 font-mono text-xs text-muted tabular">{i + 1}</span>
                    {s.label}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>
      </div>
    </>
  );
}

// ---------------------------------------------------------------
// Content tables
// ---------------------------------------------------------------

const DATA_CATEGORIES: Array<{
  category: string;
  includes: string;
  source: string;
  required: boolean;
}> = [
  {
    category: 'Identity',
    includes: 'Name, roll number, branch, year of passing, programme',
    source: 'The college degree register, and what you type when you claim your profile',
    required: true,
  },
  {
    category: 'Contact',
    includes: 'Email address, mobile number',
    source: 'You. Email is your sign-in credential; mobile is used for recovery and WhatsApp',
    required: true,
  },
  {
    category: 'Profile',
    includes: 'Photo, short bio, employer, designation, city, skills, availability to mentor',
    source: 'You, at any time. Every field can be left blank',
    required: false,
  },
  {
    category: 'Employment and education history',
    includes: 'Companies, roles, dates, further degrees',
    source: 'You',
    required: false,
  },
  {
    category: 'Activity',
    includes: 'Connection requests you send and receive, event registrations, job posts and applications',
    source: 'Generated as you use the portal',
    required: true,
  },
  {
    category: 'Academic (students only)',
    includes: 'CGPA, placement status',
    source: 'The placement cell. Never visible to alumni or to other students',
    required: true,
  },
  {
    category: 'Technical',
    includes: 'Sign-in timestamps, IP address on administrative actions, rate-limit counters',
    source: 'Generated automatically, kept to stop misuse',
    required: true,
  },
];

const ROLE_VISIBILITY: Array<{ role: string; sees: string; never: string }> = [
  {
    role: 'Student',
    sees: 'Alumni names, branch, batch, employer, designation, city and skills',
    never: 'Any alumni email or mobile number; the giving pages; other students’ academic data',
  },
  {
    role: 'Alumnus',
    sees: 'The full directory, plus contact details of members whose visibility setting permits it',
    never: 'Any student’s CGPA or placement status; contact details of members who have not consented',
  },
  {
    role: 'Faculty',
    sees: 'The alumni directory and students in their own department',
    never: 'Bulk exports; verification decisions outside their remit',
  },
  {
    role: 'Head of department',
    sees: 'Verification claims and engagement figures for their own branch only',
    never: 'Any other branch; contact exports; message contents',
  },
  {
    role: 'Placement officer',
    sees: 'Student records including CGPA and placement status; job posts awaiting moderation',
    never: 'Alumni contact exports; verification decisions',
  },
  {
    role: 'Alumni cell operator',
    sees: 'Verification claims across branches, event registrations, member records',
    never: 'Bulk contact export — deliberately withheld from this role',
  },
  {
    role: 'Finance',
    sees: 'Donation and payment reconciliation, receipts',
    never: 'The member directory at all',
  },
  {
    role: 'College administrator',
    sees: 'Everything above, plus bulk contact export and role management',
    never: 'The contents of private messages between members',
  },
  {
    role: 'Platform administrator (vendor)',
    sees: 'Tenant configuration, branding and system health',
    never: 'Member records, contact details or messages — the role holds no capability to read them',
  },
];

// ---------------------------------------------------------------
// Local pieces
// ---------------------------------------------------------------

function ProcessorItem({ name, job }: { name: string; job: string }) {
  return (
    <li className="flex gap-3 rounded-lg border border-line bg-surface-raised p-4">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-surface-sunken text-muted" aria-hidden="true">
        <Database className="size-3.5" />
      </span>
      <div className="min-w-0 space-y-1">
        <p className="font-semibold">{name}</p>
        <p className="text-sm text-secondary">{job}</p>
      </div>
    </li>
  );
}

function RightCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        <span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand-soft-fg">
          {icon}
        </span>
        <h3 className="font-display text-base font-semibold">{title}</h3>
        <p className="text-sm text-secondary">{body}</p>
      </CardBody>
    </Card>
  );
}
