import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Clock, Download, PencilLine, Trash2 } from 'lucide-react';
import { Badge, Card, Disclosure, EmptyState } from '@/components/ui';
import { getSession } from '@/lib/auth/session';
import { requireSession } from '@/lib/auth/guard';
import { getDataRequests, getOwnProfile } from '@/lib/data/repo';
import { getTenantBrand } from '@/lib/tenant';
import { displayNow, formatDate, formatRelative } from '@/lib/format';
import type { DataRequest } from '@/lib/data/types';
import { DataRequestForm } from './DataRequestForm';

/**
 * Your data — the data-request surface.
 *
 * Open requests come first, with their due date, because a statutory
 * clock the member cannot see running is a clock nobody chases. Then the
 * three things a member can ask for. What an export contains and what a
 * deletion leaves behind are kept one click away, because the second is
 * the one nobody states and the reason a member later feels misled.
 */

export const metadata: Metadata = {
  title: 'Your data',
};

const RESPONSE_DAYS = 30;

export default async function DataSettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  requireSession(session);

  const profile = getOwnProfile(session);
  if (!profile) notFound();

  const resolved = await getTenantBrand();
  const pack = resolved?.brand.pack;
  const supportEmail = pack?.copy.supportEmail ?? null;
  const timing = pack ? { locale: pack.locale.locale, timeZone: pack.locale.timeZone } : {};

  const mine = getDataRequests().filter((r) => r.memberId === session.memberId);
  const inFlight = mine.filter((r) => r.state === 'received' || r.state === 'in_progress');
  const settled = mine.filter((r) => r.state === 'fulfilled' || r.state === 'refused');

  // The fixture clock, as on every other screen: never the wall clock.
  const now = displayNow().getTime();

  return (
    <>
      {/* ---- Open requests ------------------------------------------------ */}

      {inFlight.length ? (
        <section aria-labelledby="open-requests" className="space-y-3">
          <h2 id="open-requests" className="font-display text-xl font-semibold">
            Open requests
          </h2>
          <ul className="space-y-3">
            {inFlight.map((r) => {
              const overdue = new Date(r.dueAt).getTime() < now;
              return (
                <li key={r.id}>
                  <Card className="p-4 sm:p-card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          <KindIcon kind={r.kind} />
                          {KIND_LABEL[r.kind]}
                        </p>
                        <p className="text-xs text-secondary">
                          Asked {formatDate(r.createdAt, timing)} · reference{' '}
                          <span className="font-mono">{r.id}</span>
                        </p>
                      </div>
                      {overdue ? (
                        <Badge tone="danger" dot>
                          Overdue
                        </Badge>
                      ) : (
                        <Badge tone={r.state === 'in_progress' ? 'brand' : 'neutral'} dot>
                          {STATE_LABEL[r.state]}
                        </Badge>
                      )}
                    </div>
                    <p
                      className={
                        overdue
                          ? 'mt-3 flex items-center gap-2 text-sm font-medium text-danger-fg'
                          : 'mt-3 flex items-center gap-2 text-sm text-secondary'
                      }
                    >
                      <Clock className="size-4 shrink-0" aria-hidden="true" />
                      {overdue
                        ? `The answer was due ${formatDate(r.dueAt, timing)}. You can take it further; see below.`
                        : `Answer due ${formatDate(r.dueAt, timing)}, ${formatRelative(r.dueAt, timing)}.`}
                    </p>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <EmptyState variant="inline" title="You have no open requests." />
      )}

      {/* ---- Ask ----------------------------------------------------------- */}

      <DataRequestForm openKinds={inFlight.map((r) => r.kind)} responseDays={RESPONSE_DAYS} />

      {settled.length ? (
        <section aria-labelledby="answered" className="space-y-2">
          <h2 id="answered" className="text-sm font-semibold">
            Answered
          </h2>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface-raised">
            {settled.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="flex items-center gap-2 text-sm">
                  <KindIcon kind={r.kind} />
                  {KIND_LABEL[r.kind]}
                  <span className="text-xs text-secondary">asked {formatDate(r.createdAt, timing)}</span>
                </span>
                <Badge tone={r.state === 'fulfilled' ? 'success' : 'danger'}>
                  {STATE_LABEL[r.state]}
                  {r.fulfilledAt ? ` ${formatDate(r.fulfilledAt, timing)}` : ''}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- What it covers -------------------------------------------------- */}

      <div className="space-y-3">
        <Disclosure id="export-contents" summary="What an export contains">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {EXPORT_CONTENTS.map((c) => (
              <li key={c} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-line pt-3">
            It does not contain other people&rsquo;s data. A request you received names the person
            who sent it, but their profile is theirs to ask for.
          </p>
        </Disclosure>

        <Disclosure id="kept-after-deletion" summary="What deletion does not remove">
          <ul className="space-y-3">
            <li>
              <p className="font-semibold text-primary">Donation records and tax receipts</p>
              <p>
                Kept for as long as the law requires the college to keep its accounts. Your name
                stays on a receipt that has already been issued.
              </p>
            </li>
            <li>
              <p className="font-semibold text-primary">The record of staff actions</p>
              <p>
                Who verified you, who exported a list you were in, who changed a role. It is how you
                can check that your data was handled properly.
              </p>
            </li>
            <li>
              <p className="font-semibold text-primary">The college&rsquo;s degree register</p>
              <p>
                The record that you hold a degree belongs to the examinations branch. Deleting your
                account does not touch it.
              </p>
            </li>
          </ul>
        </Disclosure>
      </div>

      {/* ---- Grievance ------------------------------------------------------ */}

      <p className="max-w-prose text-sm text-secondary">
        Not satisfied with an answer? Write to the college&rsquo;s grievance contact
        {supportEmail ? (
          <>
            {' '}
            at{' '}
            <a href={`mailto:${supportEmail}`} className="link">
              {supportEmail}
            </a>
          </>
        ) : null}
        , quoting the reference on your request. If the college does not answer within{' '}
        {RESPONSE_DAYS} days, you can complain to the Data Protection Board of India.
      </p>
    </>
  );
}

function KindIcon({ kind }: { kind: DataRequest['kind'] }) {
  const Icon = kind === 'export' ? Download : kind === 'correction' ? PencilLine : Trash2;
  return <Icon className="size-4 shrink-0 text-muted" aria-hidden="true" />;
}

const KIND_LABEL: Record<DataRequest['kind'], string> = {
  export: 'Copy of your data',
  correction: 'Correction',
  deletion: 'Account deletion',
};

const STATE_LABEL: Record<DataRequest['state'], string> = {
  received: 'Received',
  in_progress: 'Being prepared',
  fulfilled: 'Answered',
  refused: 'Refused',
};

const EXPORT_CONTENTS = [
  'Your profile, and every change the college made to it',
  'Your contact details and who you share them with',
  'Requests you sent or received, with their messages',
  'Event registrations and check-ins',
  'Jobs you posted and applications you sent',
  'Your consent history',
  'How your registration was verified, and by whom',
  'Donations you made, with receipt numbers',
];
