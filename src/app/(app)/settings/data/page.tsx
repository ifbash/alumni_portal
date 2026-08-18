import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Download, Landmark, PencilLine, Trash2, Clock } from 'lucide-react';
import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Section,
} from '@/components/ui';
import { getSession } from '@/lib/auth/session';
import { requireSession } from '@/lib/auth/guard';
import { getDataRequests, getOwnProfile } from '@/lib/data/repo';
import { getTenantBrand } from '@/lib/tenant';
import { formatDate, formatRelative } from '@/lib/format';
import type { DataRequest } from '@/lib/data/types';
import { DataRequestForm } from './DataRequestForm';

/**
 * Your data — the DPDP request surface.
 *
 * Three commitments a portal usually leaves implicit are written down
 * here instead: what an export actually contains, how long the college
 * has to answer, and what survives a deletion because the law requires
 * it. The last one is the one nobody states, and it is the reason a
 * member later feels lied to.
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

  const mine = getDataRequests().filter((r) => r.memberId === session.memberId);
  const inFlight = mine.filter((r) => r.state === 'received' || r.state === 'in_progress');
  const settled = mine.filter((r) => r.state === 'fulfilled' || r.state === 'refused');

  const now = Date.now();

  return (
    <>
      {/* ---- Rights ------------------------------------------------------ */}

      <Section
        title="What you can ask for"
        description={`Under the Digital Personal Data Protection Act you can ask the college for a copy of what it holds on you, ask it to correct anything wrong, and ask it to delete your account. It has ${RESPONSE_DAYS} days to answer, counted from the day the request lands — not from the day someone gets round to it.`}
      >
        {inFlight.length ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Open requests</h3>
            {inFlight.map((r) => {
              const overdue = new Date(r.dueAt).getTime() < now;
              return (
                <Card key={r.id} className="p-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <KindIcon kind={r.kind} />
                        {KIND_LABEL[r.kind]}
                      </p>
                      <p className="text-xs text-muted">
                        Raised {formatDate(r.createdAt)} · reference{' '}
                        <span className="font-mono">{r.id}</span>
                      </p>
                    </div>
                    <Badge tone={r.state === 'in_progress' ? 'info' : 'warning'} dot>
                      {STATE_LABEL[r.state]}
                    </Badge>
                  </div>

                  <div
                    className={
                      overdue
                        ? 'mt-3 flex items-center gap-2 rounded border border-line bg-danger-soft px-3 py-2 text-sm text-danger-fg'
                        : 'mt-3 flex items-center gap-2 rounded border border-line bg-surface-sunken px-3 py-2 text-sm text-secondary'
                    }
                  >
                    <Clock className="size-4 shrink-0" aria-hidden="true" />
                    {overdue ? (
                      <span>
                        <strong>Past due.</strong> The statutory answer was owed{' '}
                        {formatDate(r.dueAt)}. You can escalate — see below.
                      </span>
                    ) : (
                      <span>
                        Due {formatDate(r.dueAt)} — {formatRelative(r.dueAt)}
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Alert tone="neutral" title="You have no open requests">
            Nothing is in flight. You can raise one below at any time, and you do not have to give a
            reason for asking.
          </Alert>
        )}

        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle as="h3" className="text-md">
                Raise a request
              </CardTitle>
              <CardDescription>
                Goes to the alumni cell as a tracked item with a due date on it, not as an email
                somebody can lose.
              </CardDescription>
            </div>
          </CardHeader>
          <CardBody>
            <DataRequestForm openKinds={inFlight.map((r) => r.kind)} />
          </CardBody>
        </Card>

        {settled.length ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Answered</h3>
            <ul className="space-y-2">
              {settled.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-3.5 py-2.5"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <KindIcon kind={r.kind} />
                    {KIND_LABEL[r.kind]}
                    <span className="text-xs text-muted">raised {formatDate(r.createdAt)}</span>
                  </span>
                  <Badge tone={r.state === 'fulfilled' ? 'success' : 'danger'}>
                    {STATE_LABEL[r.state]}
                    {r.fulfilledAt ? ` ${formatDate(r.fulfilledAt)}` : ''}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      {/* ---- What is in an export ---------------------------------------- */}

      <Section title="What an export contains">
        <Card>
          <CardBody className="space-y-4">
            <p className="text-sm text-secondary">
              One JSON file and one CSV, covering everything the portal holds that is about you as a
              person:
            </p>
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              {EXPORT_CONTENTS.map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
                  <span className="text-secondary">{c}</span>
                </li>
              ))}
            </ul>
            <p className="border-t border-line pt-3 text-xs text-muted">
              It does not contain other people&rsquo;s data. A message you received names the person
              who sent it, but their profile is theirs to export, not yours.
            </p>
          </CardBody>
        </Card>
      </Section>

      {/* ---- Retention exception ------------------------------------------ */}

      <Section title="What deletion does not remove">
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle as="h3" className="text-md">
                Three things survive a deletion request
              </CardTitle>
              <CardDescription>
                Not a loophole and not a preference — each is a record the college is required to
                keep, and refusing to say so up front is how a member finds out afterwards.
              </CardDescription>
            </div>
            <Landmark className="size-5 shrink-0 text-muted" aria-hidden="true" />
          </CardHeader>

          <CardBody>
            <ul className="space-y-4">
              <li className="space-y-1">
                <p className="text-sm font-semibold">Donations, receipts and 80G certificates</p>
                <p className="text-sm text-secondary">
                  Financial records stay for as long as the Income-tax Act requires the college to
                  keep its books, and where a contribution was foreign, for as long as FCRA
                  reporting requires. Your name stays on a receipt that has already been issued
                  against it.
                </p>
              </li>
              <li className="space-y-1">
                <p className="text-sm font-semibold">The audit trail of staff actions</p>
                <p className="text-sm text-secondary">
                  Who verified you, who exported a list you were in, who changed a role. Deleting
                  the evidence of how your data was handled would destroy the only protection you
                  have that it was handled correctly.
                </p>
              </li>
              <li className="space-y-1">
                <p className="text-sm font-semibold">The college&rsquo;s degree register</p>
                <p className="text-sm text-secondary">
                  The examinations branch&rsquo;s record that you hold a degree is not portal data
                  and is outside what this portal can delete. This page controls your alumni
                  account, not your qualification.
                </p>
              </li>
            </ul>
          </CardBody>
        </Card>
      </Section>

      {/* ---- Escalation ---------------------------------------------------- */}

      <Section title="If you are not satisfied">
        <Card>
          <CardBody className="space-y-3 text-sm">
            <p className="text-secondary">
              Raise it first with the college&rsquo;s grievance contact
              {supportEmail ? (
                <>
                  {' '}
                  at{' '}
                  <a href={`mailto:${supportEmail}`} className="link">
                    {supportEmail}
                  </a>
                </>
              ) : null}
              , quoting the reference number on your request. If the college does not answer within{' '}
              {RESPONSE_DAYS} days, or answers in a way you disagree with, you can complain to the
              Data Protection Board of India.
            </p>
            <p className="text-secondary">
              {profile.fullName}, your requests are listed above with their reference numbers. Keep
              one to hand — it is what makes a complaint traceable.
            </p>
          </CardBody>
        </Card>
      </Section>
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
  'Your profile as it stands, and every field the college has edited',
  'Your contact record — email, mobile, links, and the visibility setting on it',
  'Every connection request you sent or received, with the message text',
  'Event registrations, guests and check-ins',
  'Job postings you made and applications you sent',
  'Your consent log, with the notice version against each entry',
  'Verification: the register row you matched, the confidence, and who approved it',
  'Donations you made, with receipt numbers',
];
