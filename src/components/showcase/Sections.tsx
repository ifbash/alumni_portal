import * as React from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  Building2,
  Check,
  CircleDashed,
  EyeOff,
  FileSearch,
  GraduationCap,
  KeyRound,
  Lock,
  MapPin,
  Presentation,
  RefreshCw,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { CircleMark } from '@/components/brand/Marks';
import { cn } from '@/lib/cn';
import type { BrandPack } from '@/lib/branding/pack';
import { PackExcerpt } from './PackExcerpt';
import { EYEBROW, H2, LABEL, SECTION } from './styles';
import { demoMailto, type ShowcaseLinks } from './links';

/**
 * The product site's body, below the hero.
 *
 * Every sentence here is something the repository does today, or is
 * labelled "Coming next". That is not modesty: the people reading this
 * page are the ones who will sign the purchase order and then field the
 * complaints, and a claim they find to be untrue on the demo call costs
 * more than the feature was worth.
 */

function SectionHead({
  id,
  eyebrow,
  title,
  children,
  className,
}: {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('max-w-3xl', className)}>
      <p className={EYEBROW}>{eyebrow}</p>
      {/* Not `cn`: tailwind-merge reads `text-display-md` as a colour and drops it beside `text-primary`. */}
      <h2 id={id} className={`${H2} mt-4`}>
        {title}
      </h2>
      {children ? <div className="mt-5 space-y-3 text-lg text-secondary">{children}</div> : null}
    </div>
  );
}

/** A square, hairline tag in mono. Square because the house pack is. */
function Tag({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'accent' }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center border px-1.5 font-mono text-xs uppercase leading-5 tracking-[0.12em]',
        tone === 'accent' ? 'border-accent-fg text-accent-fg' : 'border-line-strong text-secondary',
      )}
    >
      {children}
    </span>
  );
}

/**
 * A card in a 3- or 4-column row. The title is one tier across the page's
 * card grids (the 2-column blocks use `text-display-xs`), and on a laptop
 * each card is a subgrid over its row's tracks, so when one title wraps
 * every card's body in that row still starts on the same line.
 */
const CARD_TITLE = 'font-display text-xl font-bold text-primary';
const SUBGRID_CARD = 'border-t border-line-strong pt-6 lg:row-span-3 lg:grid lg:grid-rows-subgrid';
const SUBGRID_CARD_4 = 'border-t border-line-strong pt-6 lg:row-span-4 lg:grid lg:grid-rows-subgrid';

// ---------------------------------------------------------------
// Who it is for
// ---------------------------------------------------------------

const AUDIENCES: Array<{ icon: React.ElementType; title: string; points: React.ReactNode[] }> = [
  {
    icon: GraduationCap,
    title: 'Alumni',
    points: [
      'Find batchmates by batch, branch, company or city, after signing in.',
      'Decide who sees your email and phone, and switch mentoring, referrals and speaking on or off.',
      'Post jobs for your college’s students and register for reunions and events.',
    ],
  },
  {
    icon: BookOpenCheck,
    title: 'Final-year students',
    points: [
      'Search alumni by branch, batch and company, and ask for mentorship or a referral, five open requests at a time.',
      'Apply to jobs alumni post. After graduation the same account becomes an alumni account.',
      // The roll-list import that creates these accounts is not built yet; the tag says so.
      <>
        Accounts come from the placement cell&rsquo;s final-year roll list, not an open sign-up form.{' '}
        <Tag>Import coming next</Tag>
      </>,
    ],
  },
  {
    icon: Presentation,
    title: 'Faculty and HODs',
    points: [
      'HODs review registrations from their own department, and only theirs.',
      'HODs create department events and see how their department’s students and alumni are connecting.',
      'Faculty search both cohorts. CGPA stays with the placement cell.',
    ],
  },
  {
    icon: Building2,
    title: 'Alumni cell and placement cell',
    points: [
      'Work a verification queue that shows the degree-register record beside every close call.',
      'Run events with seats, ticket prices and check-in at the door; publish news and photo galleries.',
      'The placement cell approves every job before students see it.',
    ],
  },
];

export function Audiences() {
  return (
    <section aria-labelledby="for-your-college-title" id="for-your-college" className={SECTION}>
      <div className="page-shell">
        <SectionHead id="for-your-college-title" eyebrow="Who it is for" title="Built for the two cohorts a college actually has.">
          <p>
            Most alumni portals only know about graduates. This one starts with the final-year batch, so the
            students who used it in their last year are still on it after convocation.
          </p>
        </SectionHead>

        {/* One row of cards on a laptop; each card is a subgrid, so a title that wraps moves its whole row. */}
        <ul className="mt-12 grid gap-x-8 gap-y-10 md:grid-cols-2 lg:mt-16 lg:grid-cols-4 lg:gap-y-0">
          {AUDIENCES.map(({ icon: Icon, title, points }) => (
            <li key={title} className={SUBGRID_CARD}>
              <Icon className="size-6 text-brand-fg" aria-hidden="true" />
              <h3 className={cn(CARD_TITLE, 'mt-4')}>{title}</h3>
              <ul className="mt-4 space-y-3">
                {points.map((point, i) => (
                  <li key={i} className="flex gap-3 text-base text-secondary">
                    <span aria-hidden="true" className="mt-[0.7em] h-px w-3 shrink-0 bg-line-strong" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <p className="mt-12 max-w-3xl text-base text-secondary">
          <span className="font-semibold text-primary">Nine roles, one permission table.</span> Two cohorts, six
          college roles and one for ifBash. Roles are a set, not a slot: an alumnus who now teaches and heads a
          department holds all three, and gets exactly the union of what each allows.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------
// Your college, not ours
// ---------------------------------------------------------------

const WHITE_LABEL: Array<{ title: string; body: React.ReactNode }> = [
  {
    title: 'One file per college',
    body: 'Name, colours, typefaces, crest or logo, photographs, wording and modules. Adding a college is that file, one line in a registry and a subdomain. No screen, component or stylesheet is touched.',
  },
  {
    title: 'Your colours in, a full design system out',
    body: 'You give us the colours from your own style guide. Hover states, tinted fills, dark mode and every text-on-background pairing are derived from them.',
  },
  {
    title: 'A contrast check that blocks bad colours',
    body: (
      <>
        <code className="font-mono text-sm text-primary">npm run brand:check</code> audits every pack. A pack whose
        text would be hard to read cannot be published.
      </>
    ),
  },
  {
    title: 'Photographs and a hero video',
    body: 'A campus photograph behind the landing page, a short silent loop on desktop, a campus gallery. A college with no photographs yet gets a solid band in its own colour: designed, not empty.',
  },
  {
    title: 'Modules switched on and off',
    body: 'Jobs, events, mentorship, news, gallery and giving are switches in the same file. Giving stays off until your FCRA status is confirmed.',
  },
];

/**
 * The excerpted pack's own campus photographs, straight from its
 * `assets.campusPhotos`, with the alt text and captions the file gives
 * them. Renders nothing for a pack that has none.
 */
function CampusStrip({ pack }: { pack: BrandPack }) {
  const photos = pack.assets.campusPhotos;
  if (!photos.length) return null;

  return (
    <figure className="m-0 mt-8">
      <figcaption className="font-mono text-xs text-secondary">
        <span className="text-brand-fg">assets.campusPhotos</span> → &ldquo;Around the campus&rdquo; on{' '}
        {pack.copy.portalName}&rsquo;s landing page
      </figcaption>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos.map((photo) => (
          <li key={photo.src}>
            {/* Brand imagery bypasses the optimiser, as everywhere else in the portal. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.src}
              alt={photo.alt}
              loading="lazy"
              decoding="async"
              style={{ objectPosition: photo.focus }}
              className="block aspect-[4/3] w-full bg-surface-sunken object-cover"
            />
            {photo.caption ? <p className="mt-2 font-mono text-xs text-secondary">{photo.caption}</p> : null}
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function WhiteLabel({ example, audited }: { example: BrandPack | undefined; audited: BrandPack[] }) {
  return (
    <section aria-labelledby="white-label-title" id="white-label" className={SECTION}>
      <div className="page-shell grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <SectionHead id="white-label-title" eyebrow="White label" title="Your college, not ours.">
            <p>
              Alumni see their college&rsquo;s name, crest, colours and photographs on every screen. ifBash is
              named only where members need to know who runs the platform: a &ldquo;Powered by&rdquo; line,
              itself a field in your file, and the privacy page that says what we can and cannot see.
            </p>
          </SectionHead>

          <ol className="mt-10 border-t border-line">
            {WHITE_LABEL.map((item, i) => (
              <li key={item.title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] border-b border-line py-5">
                <span className="font-mono text-sm text-secondary tabular">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="font-body text-lg font-semibold tracking-normal text-primary">{item.title}</h3>
                  <p className="mt-1.5 text-base text-secondary">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {example ? (
          <div className="min-w-0 lg:col-span-7">
            <PackExcerpt pack={example} audited={audited} />
            <CampusStrip pack={example} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------
// Trust
// ---------------------------------------------------------------

const TRUST: Array<{ icon: React.ElementType; title: React.ReactNode; body: string }> = [
  {
    icon: ShieldCheck,
    title: 'Verified against your degree register',
    body: 'Registrations are matched on roll number, name, branch and year against the register from your examinations branch. Clear matches go through. Close calls wait for a person at the college, with the evidence side by side.',
  },
  {
    icon: Lock,
    title: 'The directory is never anonymous',
    body: 'Nobody searches your alumni without signing in. There is no public list for a scraper, or a rival portal, to copy.',
  },
  {
    icon: EyeOff,
    title: 'Students do not get alumni contact details',
    body: 'A final-year student sees names, batches and employers, and an alumnus’s email or phone only if that alumnus accepts the student’s request. Between members, every release needs two yeses: the viewer must be entitled, and the owner’s own setting must allow it. The one exception is your college administrator.',
  },
  {
    icon: KeyRound,
    title: (
      <>
        ifBash <CircleMark className="mx-2">cannot</CircleMark> open your members&rsquo; records
      </>
    ),
    body: 'Our admin role can set up your college, adjust its branding and read the audit log. It has no permission to open a profile, search the directory, export contacts or see a data request. We found and closed a gap here once; automated tests now hold the line.',
  },
  {
    icon: FileSearch,
    title: 'DPDP requests, handled in the console',
    body: 'Members can ask for a copy of their data, a correction or deletion. Each request starts a 30‑day clock and lands in a queue only your college administrator can act on.',
  },
  {
    icon: ScrollText,
    title: 'An audit log of every admin action',
    body: 'Who changed what, and when, with the record before and after. Bulk contact export is limited to the college administrator and logged with a stated reason.',
  },
];

export function Trust() {
  return (
    // The one sunken section below the hero, so the page alternates grounds instead of running eight identical paper bands.
    <section aria-labelledby="privacy-title" id="privacy" className={cn(SECTION, 'bg-surface-sunken')}>
      <div className="page-shell">
        <SectionHead id="privacy-title" eyebrow="Privacy and verification" title="The rules are in the code, not in a policy document.">
          <p>
            Each one is enforced on the server, on every request. Hiding a button is presentation; these are
            permissions.
          </p>
        </SectionHead>

        {/* Two rows of three on a laptop. Row gaps become the second row's margin so each card can be a subgrid. */}
        <ul className="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-y-0">
          {TRUST.map(({ icon: Icon, title, body }, i) => (
            <li key={i} className={cn(SUBGRID_CARD, i >= 3 && 'lg:mt-10')}>
              <Icon className="size-6 text-brand-fg" aria-hidden="true" />
              <h3 className={cn(CARD_TITLE, 'mt-4')}>{title}</h3>
              <p className="mt-2 text-base text-secondary">{body}</p>
            </li>
          ))}
        </ul>

        <div className="mt-14 grid gap-4 border-y border-line py-6 md:grid-cols-[auto_minmax(0,1fr)] md:gap-6">
          <MapPin className="size-6 text-accent-fg" aria-hidden="true" />
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-display text-xl font-bold text-primary">Designed to keep data in India</h3>
              <Tag tone="accent">By design</Tag>
            </div>
            <p className="mt-2 max-w-4xl text-base text-secondary">
              The database and file storage are specified for the AWS Mumbai region (ap-south-1), so the records
              we keep stay in India. Which services deliver email and WhatsApp messages, and where they process
              them, we agree with you and name in your privacy notice. Hosting is not live yet.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------
// How a college goes live
// ---------------------------------------------------------------

/** `next`: the step is the process, but the tool that runs it is not built yet. */
const STEPS: Array<{ who: string; title: string; body: string; next?: boolean }> = [
  {
    who: 'Us, with your college',
    title: 'Your brand pack',
    body: 'We write your college’s file: name, crest, colours, photographs, wording and modules. You review the portal on its own address before anyone else sees it.',
  },
  {
    who: 'Your examinations branch',
    title: 'The degree register',
    body: 'Roll number, name, branch and year of passing for every batch on record. The import shows a dry run of what will be added and what is rejected before anything is written.',
  },
  {
    who: 'Your placement cell',
    title: 'The final-year batch',
    body: 'The placement cell’s final-year roll list becomes the student accounts. Students do not register themselves.',
    next: true,
  },
  {
    who: 'Your alumni and alumni cell',
    title: 'Alumni register',
    body: 'Graduates register with their roll number and are matched against the register. Close calls go to the alumni cell, or to their own HOD.',
  },
];

export function GoLive() {
  return (
    <section aria-labelledby="how-it-works-title" id="how-it-works" className={SECTION}>
      <div className="page-shell">
        <SectionHead id="how-it-works-title" eyebrow="How it works" title="How a college goes live.">
          <p>
            Four steps. The slowest is usually the degree register, because it comes from the examinations
            branch, so we ask for it first.
          </p>
        </SectionHead>

        <ol className="mt-12 grid gap-x-8 gap-y-10 md:grid-cols-2 lg:mt-16 lg:grid-cols-4 lg:gap-y-0">
          {STEPS.map((step, i) => (
            <li key={step.title} className={SUBGRID_CARD_4}>
              <div className="flex items-center gap-3">
                <span className="font-mono text-display-sm text-secondary tabular">{String(i + 1).padStart(2, '0')}</span>
                {step.next ? <Tag>Coming next</Tag> : null}
              </div>
              <p className={cn(LABEL, 'mt-4')}>{step.who}</p>
              <h3 className={cn(CARD_TITLE, 'mt-2')}>{step.title}</h3>
              <p className="mt-3 text-base text-secondary">{step.body}</p>
            </li>
          ))}
        </ol>

        <p className="mt-12 flex max-w-3xl gap-3 text-base text-secondary">
          <RefreshCw className="mt-1 size-4 shrink-0 text-brand-fg" aria-hidden="true" />
          <span>
            <span className="font-semibold text-primary">Then, once a year.</span> After convocation, one reviewed
            step moves the final-year batch to alumni, with a dry run first. It never happens on its own, and nobody
            is migrated to a new system.
          </span>
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------
// What is ready, and what is next
// ---------------------------------------------------------------

const READY = [
  'Directory, profiles and the contact-release rules',
  'Mentorship and referral requests, with limits',
  'Jobs, moderated by the placement cell',
  'Events with seats, tickets and check-in at the door',
  'News and photo galleries',
  'Degree-register import and the verification queue',
  'Roles, audit log, DPDP requests and branding in the admin console',
  'The yearly batch rollover, with a dry run',
  'Giving with FCRA fields, switched off until your FCRA status is confirmed',
  'A demonstration mode that runs the whole portal without a database',
];

const NEXT = [
  'Production hosting, with the live database behind every form',
  'Final-year roll-list import and batch invitations',
  'Email delivery, with bounce handling',
  'WhatsApp Business API messages',
  'Photo and file uploads to storage in India',
  'Online payments through Razorpay, UPI first',
  'The portal on your college’s own domain',
  'The complete browser test suite for permission boundaries',
];

export function Readiness({ links }: { links: ShowcaseLinks }) {
  return (
    <section aria-labelledby="readiness-title" id="readiness" className={SECTION}>
      <div className="page-shell">
        <SectionHead id="readiness-title" eyebrow="Where it stands" title="What is ready, and what is next.">
          <p>
            Everything under &ldquo;In the product today&rdquo; runs now, in demonstration mode on sample data.
            &ldquo;Coming next&rdquo; is what stands between that and your college going live.
          </p>
        </SectionHead>

        <div className="mt-12 grid border-t border-line-strong md:grid-cols-2 lg:mt-16">
          <div className="py-8 md:pr-10">
            <h3 className="flex flex-wrap items-center gap-3 font-display text-xl font-bold text-primary">
              In the product today
              <Tag tone="accent">Built</Tag>
            </h3>
            <ul className="mt-5 divide-y divide-line">
              {READY.map((item) => (
                <li key={item} className="flex gap-3 py-3 text-base text-primary">
                  <Check className="mt-1 size-4 shrink-0 text-accent-fg" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-line py-8 md:border-l md:border-t-0 md:pl-10">
            <h3 className="flex flex-wrap items-center gap-3 font-display text-xl font-bold text-primary">
              Coming next
              <Tag>Not built yet</Tag>
            </h3>
            <ul className="mt-5 divide-y divide-line">
              {NEXT.map((item) => (
                <li key={item} className="flex gap-3 py-3 text-base text-secondary">
                  <CircleDashed className="mt-1 size-4 shrink-0 text-secondary" aria-hidden="true" />
                  <span>
                    <span className="sr-only">Coming next: </span>
                    {item}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-line pt-5">
              <p className="text-base text-secondary">
                Ask where each of these stands against your timeline on the demo call.
              </p>
              {links.requestDemo ? (
                <a
                  href={links.requestDemo}
                  className="mt-1 inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand-fg underline decoration-1 underline-offset-4 hover:decoration-2"
                >
                  Request a demo
                  <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------
// Deployment
// ---------------------------------------------------------------

const OPTIONS: Array<{ tag: string; title: string; body: string; points: string[] }> = [
  {
    tag: 'Option A',
    title: 'Hosted by ifBash',
    body: 'We run the portal and keep it up to date. Your IT team runs nothing.',
    points: [
      'Database and file storage designed to stay in India',
      'Your college administrator holds the member-data permissions, not ifBash',
      'Updates reach every college at once',
    ],
  },
  {
    tag: 'Option B',
    title: 'On your own infrastructure',
    body: 'We hand the portal’s front end to your IT team, to run against your college’s own backend and servers.',
    points: [
      'Suited to colleges whose policy keeps every system in-house',
      'The same product and the same brand pack',
      'Handover worked out with your IT team',
    ],
  },
];

export function Deployment() {
  return (
    <section aria-labelledby="deployment-title" id="deployment" className={SECTION}>
      <div className="page-shell">
        <SectionHead id="deployment-title" eyebrow="Deployment" title="Where it runs is your call.">
          <p>Hosting is not live yet. There are two ways to run it, and we would rather choose with you than for you.</p>
        </SectionHead>

        <div className="mt-12 grid border-y border-line md:grid-cols-2 lg:mt-16">
          {OPTIONS.map((option, i) => (
            <div
              key={option.title}
              className={cn('py-8', i === 0 ? 'md:pr-10' : 'border-t border-line md:border-l md:border-t-0 md:pl-10')}
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className={LABEL}>{option.tag}</span>
                <Tag>To discuss</Tag>
              </div>
              <h3 className="mt-4 font-display text-display-xs font-bold text-primary">{option.title}</h3>
              <p className="mt-2 text-base text-secondary">{option.body}</p>
              <ul className="mt-5 space-y-2.5">
                {option.points.map((point) => (
                  <li key={point} className="flex gap-3 text-base text-primary">
                    <ArrowRight className="mt-1 size-4 shrink-0 text-brand-fg" aria-hidden="true" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------

const PRICES: Array<{ tag: string; title: string; covers: string[] }> = [
  {
    tag: 'Once',
    title: 'Setup',
    covers: ['Your brand pack and preview', 'Degree-register import and checks', 'Your first final-year batch loaded'],
  },
  {
    tag: 'Every year, per college',
    title: 'Subscription',
    covers: ['The portal for your college', 'Every update to it', 'Support for your alumni cell and placement cell'],
  },
];

export function Pricing({ email }: { email: string | undefined }) {
  const talk = email ? demoMailto(email, 'Pricing for our college') : null;

  return (
    <section aria-labelledby="pricing-title" id="pricing" className={SECTION}>
      <div className="page-shell grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <SectionHead id="pricing-title" eyebrow="Pricing" title="A setup fee, then a yearly subscription.">
            <p>
              The numbers depend on the size of your college and how it is hosted, so we quote after a
              conversation, not before one.
            </p>
          </SectionHead>
          {talk ? (
            <ButtonLink href={talk} size="lg" className="mt-8 min-h-11">
              Talk to us
              <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
          ) : null}
        </div>

        <div className="grid border-y border-line sm:grid-cols-2 lg:col-span-7 lg:self-start">
          {PRICES.map((price, i) => (
            <div key={price.title} className={cn('py-8', i === 0 ? 'sm:pr-8' : 'border-t border-line sm:border-l sm:border-t-0 sm:pl-8')}>
              <p className={LABEL}>{price.tag}</p>
              <h3 className="mt-3 font-display text-display-xs font-bold text-primary">{price.title}</h3>
              {talk ? (
                <a
                  href={talk}
                  className="group mt-4 inline-flex min-h-11 items-center gap-2 font-display text-display-sm font-bold text-brand-fg"
                >
                  <span className="underline decoration-1 underline-offset-[0.18em] group-hover:decoration-2">Talk to us</span>
                  <ArrowRight className="size-6 shrink-0" aria-hidden="true" />
                  <span className="sr-only"> about {price.title.toLowerCase()} pricing</span>
                </a>
              ) : (
                <p className="mt-4 font-display text-display-sm font-bold text-brand-fg">Talk to us</p>
              )}
              <p className="text-sm text-secondary">Quoted for your college</p>
              <ul className="mt-6 space-y-2.5 border-t border-line pt-5">
                {price.covers.map((item) => (
                  <li key={item} className="flex gap-3 text-base text-secondary">
                    <Check className="mt-1 size-4 shrink-0 text-accent-fg" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------
// The one dark field
// ---------------------------------------------------------------

/**
 * In dark mode the house band derives to a washed-out mauve, lighter than
 * anything else on the page, because the house primary sits too close to
 * the dark paper. The brand kit's dark UI is a raised panel under a plum
 * rule, so this section remaps its band to those two tokens in dark mode.
 * Token to token, no colour: every band-* pairing still clears AA on it
 * (band-fg 15.6:1, band-muted 12.6:1, band-accent 10.4:1 on the house pack).
 * The same three conditions as the token CSS: light by default, dark by the
 * OS unless the visitor chose light, dark when the visitor chose it.
 */
const FINAL_DARK = '--band:var(--surface-raised);--band-rule:var(--border);border-top:1px solid var(--border)';
const FINAL_CSS =
  `@media(prefers-color-scheme:dark){:root:not([data-theme="light"]) .sc-final{${FINAL_DARK}}}` +
  `[data-theme="dark"] .sc-final{${FINAL_DARK}}`;

export function FinalCta({ links }: { links: ShowcaseLinks }) {
  return (
    <section aria-labelledby="final-cta-title" className="sc-final band-surface">
      <style dangerouslySetInnerHTML={{ __html: FINAL_CSS }} />
      <div className="page-shell grid gap-10 py-16 lg:grid-cols-12 lg:items-end lg:gap-16 lg:py-24">
        <div className="lg:col-span-7">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-band-accent">Next step</p>
          <h2 id="final-cta-title" className="mt-4 font-display text-display-lg font-bold text-band-fg">
            See the portal in your college&rsquo;s colours.
          </h2>
          <p className="mt-5 max-w-2xl text-lg text-band-muted">
            Send us your college&rsquo;s name, crest and colours. We will write its brand pack and show you your own
            portal on the call.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 lg:col-span-5 lg:justify-end">
          {links.requestDemo ? (
            <ButtonLink href={links.requestDemo} variant="band" size="lg" className="min-h-11">
              Request a demo
              <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
          ) : null}
          {links.demoCollege ? (
            <ButtonLink href={links.demoCollege} variant="band-outline" size="lg" className="min-h-11">
              See a demo college
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </section>
  );
}
