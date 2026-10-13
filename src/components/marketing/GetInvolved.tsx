import Link from 'next/link';
import { ArrowRight, Briefcase, HandHeart, Handshake, Mic, Users } from 'lucide-react';
import { can, type Session } from '@/lib/auth/guard';
import type { Capability } from '@/lib/auth/permissions';
import { cn } from '@/lib/cn';
import type { FeatureSpec } from '@/lib/branding/pack';

/**
 * "Get involved" — three or four ways back in, under the hero (Brown's
 * action blocks, with SMU's habit of saying what each one costs you in
 * time).
 *
 * Every row is a real link to the real module. Signed out, a row needs
 * only its feature: middleware sends the visitor to `/login?next=…`, and
 * the closing line says why. Signed in, a row also needs the capability,
 * so nobody is shown a door they will be refused at — which is also how
 * the Give row stays away from students, who never hold `donation.give`.
 *
 * Give is its own full-width row under the panel, never one of the
 * pathways: asking for money sits apart from asking for time.
 */

const PANEL_COLS: Record<number, string> = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' };

interface Row {
  icon: React.ReactNode;
  title: string;
  line: string;
  href: string;
}

export function GetInvolved({
  features,
  session,
  shortName,
  office,
  firstBatch,
  rollMid,
}: {
  features: FeatureSpec;
  session: Session | null;
  shortName: string;
  office: string;
  /** The register's oldest batch, or null when the register is empty. */
  firstBatch: number | null;
  rollMid: string;
}) {
  const allowed = (feature: boolean, cap?: Capability) => feature && (!session || !cap || can(session, cap));

  const icon = (I: typeof Users) => <I className="size-5" aria-hidden="true" />;

  const rows: Row[] = [
    ...(allowed(features.directory, 'directory.search.alumni')
      ? [{ icon: icon(Users), title: 'Find your batchmates', line: 'Search by batch, branch, company or city.', href: '/directory' }]
      : []),
    ...(allowed(features.mentorship && features.connections, 'connection.receive')
      ? [{ icon: icon(Handshake), title: 'Mentor a final-year student', line: 'At your own pace. You can decline any request.', href: '/mentorship' }]
      : []),
    ...(allowed(features.jobs, 'job.post')
      ? [{ icon: icon(Briefcase), title: `Hire from ${shortName}`, line: 'Post a role. The placement cell checks it before students see it.', href: '/jobs/new' }]
      : []),
    ...(allowed(features.events)
      ? [{ icon: icon(Mic), title: 'Speak at a session', line: `About an hour, on campus or online. Tell the ${office} what you could talk about.`, href: '/contact#help' }]
      : []),
  ];

  const give: Row | null = allowed(features.donations, 'donation.give')
    ? { icon: icon(HandHeart), title: `Give to ${shortName}`, line: 'Campaigns the college has opened to alumni.', href: '/giving' }
    : null;

  if (!rows.length && !give) return null;

  return (
    <section
      id="get-involved"
      aria-labelledby="involved-title"
      className="scroll-mt-20 border-y border-line bg-surface-sunken py-10 md:py-section"
    >
      <div className="page-shell">
        <h2 id="involved-title" className="font-display text-display-xs font-bold">
          Get involved
        </h2>
        <p className="mt-2 max-w-prose text-secondary">
          Whether you passed out last year or {firstBatch !== null ? `in ${firstBatch}` : 'long ago'}, there is a
          place for you at {shortName}.
        </p>

        {rows.length ? (
          <ul
            className={cn(
              'mt-6 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface-raised lg:grid lg:divide-x lg:divide-y-0',
              PANEL_COLS[rows.length],
            )}
          >
            {rows.map((r) => (
              <li key={r.href}>
                <PathwayLink row={r} />
              </li>
            ))}
          </ul>
        ) : null}

        {give ? (
          <div
            className={cn(
              'overflow-hidden rounded-lg border border-line bg-surface-raised',
              rows.length ? 'mt-3' : 'mt-6',
            )}
          >
            <PathwayLink row={give} />
          </div>
        ) : null}

        {!session ? (
          <p className="mt-4 text-sm text-secondary">
            These open once the college has confirmed your registration.{' '}
            <Link className="link" href="/claim">
              Register with your {rollMid}
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}

function PathwayLink({ row }: { row: Row }) {
  return (
    <Link
      href={row.href}
      className="group flex min-h-11 items-start gap-3 p-4 transition-colors duration-fast ease-brand hover:bg-surface-sunken focus-visible:outline-offset-[-2px] sm:gap-4 sm:p-card lg:h-full lg:flex-col"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded bg-brand-soft text-brand-soft-fg">
        {row.icon}
      </span>
      <div className="min-w-0">
        <h3 className="font-display text-lg font-semibold">{row.title}</h3>
        <p className="mt-1 text-sm text-secondary">{row.line}</p>
      </div>
      <ArrowRight className="ml-auto size-4 shrink-0 self-center text-brand-fg lg:ml-0 lg:mt-auto lg:self-start" aria-hidden="true" />
    </Link>
  );
}
