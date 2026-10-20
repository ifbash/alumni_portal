import * as React from 'react';
import { Check, EyeOff, FileSearch, KeyRound, Lock, MapPin, ScrollText, ShieldCheck, X } from 'lucide-react';
import { CircleMark } from '@/components/brand/Marks';
import { cn } from '@/lib/cn';
import { CELL, LABEL, SECTION } from './styles';
import { SectionHead, Tag } from './parts';

/**
 * Idea three: privacy is a property of the code, not of a policy document.
 *
 * The lead cell shows the vendor boundary as the permission table itself:
 * the three capabilities `platform_admin` holds and the four it does not,
 * pinned by `tests/vendor-boundary.test.ts`. The two cells beside it draw
 * the other two rules a buyer asks about, matching and the two-gate
 * release. The ruled columns under them are the rest, one sentence each.
 */

const CAN = ['tenant.provision', 'tenant.configure', 'audit.read'];
const CANNOT = ['profile.*', 'directory.*', 'member.export', 'data_request.manage'];

const CARD_TITLE = 'font-display text-xl font-bold text-primary';

/** A mono capability name. */
function Cap({ children, denied }: { children: React.ReactNode; denied?: boolean }) {
  const Icon = denied ? X : Check;
  return (
    <li className="flex items-center gap-2 font-mono text-sm">
      <Icon className={cn('size-4 shrink-0', denied ? 'text-danger-fg' : 'text-accent-fg')} aria-hidden="true" />
      <span className={denied ? 'text-secondary line-through decoration-1' : 'text-primary'}>
        <span className="sr-only">{denied ? 'Not held: ' : 'Held: '}</span>
        {children}
      </span>
    </li>
  );
}

/** One box in a flow, in mono. */
function Gate({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-9 items-center border border-line-strong bg-surface px-3 font-mono text-xs uppercase tracking-[0.1em] text-primary">
      {children}
    </span>
  );
}

const RULED: Array<{ icon: React.ElementType; title: React.ReactNode; body: React.ReactNode; tag?: string }> = [
  {
    icon: Lock,
    title: 'The directory is never anonymous',
    body: 'Nobody searches your alumni without signing in, so there is no public list to scrape.',
  },
  {
    icon: FileSearch,
    title: 'DPDP requests, in the console',
    body: 'Copy, correction and deletion requests start a 30-day clock and reach only your college administrator.',
  },
  {
    icon: ScrollText,
    title: 'An audit log of every admin action',
    body: 'Who changed what, and when, before and after. Bulk contact export is the college administrator’s alone.',
  },
  {
    icon: MapPin,
    title: 'Designed to keep data in India',
    tag: 'By design',
    body: 'Database and file storage are specified for AWS Mumbai (ap-south-1). Hosting is not live yet.',
  },
];

export function Privacy() {
  return (
    // The one sunken section on the page, so the page alternates grounds instead of running identical paper bands.
    <section aria-labelledby="privacy-title" id="privacy" className={cn(SECTION, 'bg-surface-sunken')}>
      <div className="page-shell">
        <SectionHead
          id="privacy-title"
          n="03"
          eyebrow="Privacy and verification"
          title="The rules are in the code, not in a policy document."
        >
          <p>Each one is enforced on the server, on every request. Hiding a button is presentation; these are permissions.</p>
        </SectionHead>

        <div className="mt-8 grid gap-4 lg:grid-cols-12">
          {/* The vendor boundary, as the permission table. */}
          <article className={cn(CELL, 'reveal flex flex-col lg:col-span-7 lg:row-span-2')}>
            <KeyRound className="size-6 text-brand-fg" aria-hidden="true" />
            <h3 className="mt-2 font-display text-display-sm font-bold text-primary">
              ifBash <CircleMark className="mx-2">cannot</CircleMark> open your members&rsquo; records
            </h3>
            <p className="mt-3 text-sm text-secondary lg:text-base">
              Our admin role sets up your college, adjusts its branding and reads the audit log. That is all it holds. We
              found and closed a gap here once; automated tests now hold the line.
            </p>
            <div className="mt-auto grid gap-6 border-t border-line pt-5 sm:grid-cols-2">
              <div>
                <p className={LABEL}>The ifBash admin role holds</p>
                <ul className="mt-3 space-y-2">
                  {CAN.map((c) => (
                    <Cap key={c}>{c}</Cap>
                  ))}
                </ul>
              </div>
              <div>
                <p className={LABEL}>and does not hold</p>
                <ul className="mt-3 space-y-2">
                  {CANNOT.map((c) => (
                    <Cap key={c} denied>
                      {c}
                    </Cap>
                  ))}
                </ul>
              </div>
            </div>
          </article>

          <article className={cn(CELL, 'reveal lg:col-span-5')}>
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-6 shrink-0 text-brand-fg" aria-hidden="true" />
              <h3 className={CARD_TITLE}>Verified against your degree register</h3>
            </div>
            <p className="mt-3 text-sm text-secondary">
              Registrations are matched against your examinations branch&rsquo;s register. Clear matches go through;
              close calls wait for a person, with the evidence side by side.
            </p>
            <p aria-hidden="true" className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {['Roll number', 'Name', 'Branch', 'Year'].map((f) => (
                <span key={f} className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.1em] text-secondary">
                  <Check className="size-3.5 text-accent-fg" />
                  {f}
                </span>
              ))}
            </p>
          </article>

          <article className={cn(CELL, 'reveal lg:col-span-5')}>
            <div className="flex items-center gap-3">
              <EyeOff className="size-6 shrink-0 text-brand-fg" aria-hidden="true" />
              <h3 className={CARD_TITLE}>Students do not get alumni contact details</h3>
            </div>
            <p className="mt-3 text-sm text-secondary">
              A final-year student sees names, batches and employers, and an alumnus&rsquo;s email or phone only if that
              alumnus accepts the request. Every release between members needs two yeses; the one exception is your
              college administrator.
            </p>
            <p aria-hidden="true" className="mt-3 flex flex-wrap items-center gap-2 text-xs text-secondary">
              <Gate>Viewer is entitled</Gate>
              <span className="font-mono uppercase">and</span>
              <Gate>Owner allows it</Gate>
            </p>
          </article>
        </div>

        {/* The rest: ruled columns, not boxes. */}
        <ul className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {RULED.map(({ icon: Icon, title, body, tag }, i) => (
            <li key={i} className="reveal border-t border-line-strong pt-4">
              <h3 className="flex items-start gap-2.5 font-display text-lg font-bold leading-snug text-primary">
                <Icon className="mt-0.5 size-5 shrink-0 text-brand-fg" aria-hidden="true" />
                <span>
                  {title}
                  {tag ? (
                    <>
                      {' '}
                      <Tag tone="accent">{tag}</Tag>
                    </>
                  ) : null}
                </span>
              </h3>
              <p className="mt-2 text-sm text-secondary">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
