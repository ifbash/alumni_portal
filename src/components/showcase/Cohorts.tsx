import * as React from 'react';
import { BookOpenCheck, Building2, GraduationCap, Presentation } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CELL, NUMERAL, SECTION } from './styles';
import { Dash, SectionHead, Tag } from './parts';

/**
 * Idea one: a college has two cohorts, and the portal knows both.
 *
 * A bento, not a row of equal cards: the two cohorts are the big cells, the
 * count of roles is the numeral, and the staff who run them are a ruled
 * strip underneath. The nine is a real count of the roles in
 * `src/lib/auth/permissions.ts`.
 */

const TITLE = 'font-display text-display-xs font-bold text-primary';

function CellHead({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="size-6 shrink-0 text-brand-fg" aria-hidden="true" />
      <h3 className={TITLE}>{title}</h3>
    </div>
  );
}

export function Cohorts() {
  return (
    <section aria-labelledby="for-your-college-title" id="for-your-college" className={SECTION}>
      <div className="page-shell">
        <SectionHead
          id="for-your-college-title"
          n="01"
          eyebrow="Who it is for"
          title="Built for the two cohorts a college actually has."
        >
          <p>
            Most alumni portals only know graduates. This one starts with the final-year batch, so the students who
            used it in their last year are still on it after convocation.
          </p>
        </SectionHead>

        <div className="mt-8 grid gap-4 lg:grid-cols-12">
          {/* The two cohorts: the big cells. */}
          <article className={cn(CELL, 'reveal flex flex-col lg:col-span-5')}>
            <CellHead icon={BookOpenCheck} title="Final-year students" />
            <ul className="mt-4 space-y-2.5">
              <Dash>Search alumni by branch, batch and company, and ask for mentorship or a referral, five open requests at a time.</Dash>
              <Dash>Apply to jobs alumni post. After graduation the same account becomes an alumni account.</Dash>
              {/* The roll-list import that creates these accounts is not built yet; the tag says so. */}
              <Dash>
                Accounts come from the placement cell&rsquo;s final-year roll list, not an open sign-up form.{' '}
                <Tag>Import coming next</Tag>
              </Dash>
            </ul>
          </article>

          <article className={cn(CELL, 'reveal flex flex-col lg:col-span-5')}>
            <CellHead icon={GraduationCap} title="Alumni" />
            <ul className="mt-4 space-y-2.5">
              <Dash>Find batchmates by batch, branch, company or city, after signing in.</Dash>
              <Dash>Decide who sees your email and phone, and switch mentoring, referrals and speaking on or off.</Dash>
              <Dash>Post jobs for your college&rsquo;s students and register for reunions and events.</Dash>
            </ul>
          </article>

          <article className="reveal flex flex-col justify-between border border-line-strong p-5 lg:col-span-2 lg:p-6">
            <p className={`${NUMERAL} text-[length:calc(var(--display-xl)*1.7)]`}>9</p>
            <h3 className="mt-3 font-display text-lg font-bold leading-snug text-primary">roles, one permission table</h3>
          </article>

          {/* The people who run it. */}
          <div className="reveal grid gap-6 lg:col-span-12 lg:grid-cols-2 lg:gap-12">
            <div>
              <h3 className="flex items-center gap-3 font-display text-lg font-bold text-primary">
                <Presentation className="size-5 text-brand-fg" aria-hidden="true" />
                Faculty and HODs
              </h3>
              <p className="mt-1.5 text-sm text-secondary">
                HODs review registrations from their own department, and only theirs. Faculty search both cohorts.
                CGPA stays with the placement cell.
              </p>
            </div>
            <div>
              <h3 className="flex items-center gap-3 font-display text-lg font-bold text-primary">
                <Building2 className="size-5 text-brand-fg" aria-hidden="true" />
                Alumni cell and placement cell
              </h3>
              <p className="mt-1.5 text-sm text-secondary">
                Work a verification queue that shows the degree-register record beside every close call. Run events
                with check-in and publish news. The placement cell approves every job before students see it.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
