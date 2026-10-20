import * as React from 'react';
import { ArrowRight, Check, CircleDashed, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CELL, EYEBROW, H2, LABEL, NUMERAL, SECTION } from './styles';
import { SectionHead, Tag } from './parts';
import type { ShowcaseLinks } from './links';

/**
 * Ideas four, five and six: how a college goes live, what is built and
 * what is not, and where it runs. Each is one screen.
 */

// ---------------------------------------------------------------
// How a college goes live
// ---------------------------------------------------------------

/** `next`: the step is the process, but the tool that runs it is not built yet. */
const STEPS: Array<{ who: string; title: string; body: string; next?: boolean }> = [
  {
    who: 'Us, with your college',
    title: 'Your brand pack',
    body: 'We write your college’s file. You review the portal on its own address before anyone else sees it.',
  },
  {
    who: 'Your examinations branch',
    title: 'The degree register',
    body: 'Roll number, name, branch and year of passing for every batch on record. A dry run shows what will be added and what is rejected before anything is written.',
  },
  {
    who: 'Your placement cell',
    title: 'The final-year batch',
    body: 'The placement cell’s roll list becomes the student accounts. Students do not register themselves.',
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
        <SectionHead id="how-it-works-title" n="04" eyebrow="How it works" title="How a college goes live.">
          <p>Four steps. The slowest is usually the degree register, so we ask for it first.</p>
        </SectionHead>

        {/* A timeline: one hairline, four nodes, a real numeral on each. */}
        <ol className="mt-8 grid gap-x-8 gap-y-8 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="reveal relative border-t border-line-strong pt-5">
              <span aria-hidden="true" className="absolute -top-[5px] left-0 size-2.5 bg-accent-fg" />
              <div className="flex items-start justify-between gap-3">
                <span className={`${NUMERAL} text-[length:calc(var(--display-xl)*1.25)]`}>{String(i + 1).padStart(2, '0')}</span>
                {step.next ? <Tag>Coming next</Tag> : null}
              </div>
              <p className={cn(LABEL, 'mt-4')}>{step.who}</p>
              <h3 className="mt-2 font-display text-xl font-bold text-primary">{step.title}</h3>
              <p className="mt-2 text-sm text-secondary">{step.body}</p>
            </li>
          ))}
        </ol>

        <p className="mt-8 flex max-w-3xl gap-3 text-sm text-secondary">
          <RefreshCw className="mt-1 size-4 shrink-0 text-brand-fg" aria-hidden="true" />
          <span>
            <span className="font-semibold text-primary">Then, once a year.</span> After convocation, one reviewed step
            moves the final-year batch to alumni, with a dry run first. It never happens on its own, and nobody is
            migrated to a new system.
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
        <SectionHead id="readiness-title" n="05" eyebrow="Where it stands" title="What is ready, and what is next.">
          <p>
            &ldquo;In the product today&rdquo; runs now, in demonstration mode on sample data. &ldquo;Coming next&rdquo;
            stands between that and going live.
          </p>
        </SectionHead>

        {/* The proportion, drawn from the two lists below: one square each. */}
        <p aria-hidden="true" className="mt-6 flex gap-1">
          {READY.map((item) => (
            <span key={item} className="h-2 flex-1 bg-accent-fg" />
          ))}
          {NEXT.map((item) => (
            <span key={item} className="h-2 flex-1 border border-dashed border-line-strong" />
          ))}
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-12">
          <div className={cn(CELL, 'reveal flex flex-col lg:col-span-7')}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className={`${NUMERAL} text-display-lg`}>{READY.length}</span>
              <h3 className="font-display text-xl font-bold text-primary">In the product today</h3>
              <Tag tone="accent">Built</Tag>
            </div>
            <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">
              {READY.map((item) => (
                <li key={item} className="flex gap-3 border-t border-line py-2 text-sm text-primary">
                  <Check className="mt-1 size-4 shrink-0 text-accent-fg" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-auto border-t border-line pt-3 text-sm text-secondary">
              Ask where each of these stands against your timeline on the demo call.{' '}
              {links.requestDemo ? (
                <a
                  href={links.requestDemo}
                  className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand-fg underline decoration-1 underline-offset-4 hover:decoration-2"
                >
                  Request a demo
                  <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                </a>
              ) : null}
            </p>
          </div>

          <div className="reveal border border-dashed border-line-strong p-5 lg:col-span-5 lg:p-6">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className={`${NUMERAL} text-display-lg !text-secondary`}>{NEXT.length}</span>
              <h3 className="font-display text-xl font-bold text-primary">Coming next</h3>
              <Tag>Not built yet</Tag>
            </div>
            <ul className="mt-4">
              {NEXT.map((item) => (
                <li key={item} className="flex gap-3 border-t border-line py-1.5 text-sm text-secondary">
                  <CircleDashed className="mt-1 size-4 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="sr-only">Coming next: </span>
                    {item}
                  </span>
                </li>
              ))}
            </ul>
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
      <div className="page-shell grid gap-x-12 gap-y-8 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className={EYEBROW}>
            <span className="tabular">06</span>
            <span aria-hidden="true"> / </span>
            Deployment
          </p>
          <h2 id="deployment-title" className={`${H2} mt-3`}>
            Where it runs is your call.
          </h2>
          <p className="mt-4 text-lg text-secondary">
            Hosting is not live yet. There are two ways to run it, and we would rather choose with you than for you.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-8">
          {OPTIONS.map((option) => (
            <article key={option.title} className={cn(CELL, 'reveal')}>
              <div className="flex flex-wrap items-center gap-3">
                <span className={LABEL}>{option.tag}</span>
                <Tag>To discuss</Tag>
              </div>
              <h3 className="mt-3 font-display text-display-xs font-bold text-primary">{option.title}</h3>
              <p className="mt-2 text-sm text-secondary">{option.body}</p>
              <ul className="mt-3 space-y-1.5">
                {option.points.map((point) => (
                  <li key={point} className="flex gap-3 text-sm text-primary">
                    <ArrowRight className="mt-1 size-4 shrink-0 text-brand-fg" aria-hidden="true" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
