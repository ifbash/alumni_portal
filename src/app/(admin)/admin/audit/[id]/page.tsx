import { notFound, redirect } from 'next/navigation';
import {
  ArrowRight,
  Database,
  History,
  Info,
  ScrollText,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getAuditLog } from '@/lib/data/repo';
import { ROLE_LABELS } from '@/lib/navigation';
import { formatDateTime, formatRelative } from '@/lib/format';
import {
  Alert,
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  DetailRow,
  Disclosure,
  PageHeader,
  Separator,
} from '@/components/ui';

import { FLAGGED, actionLabel, capabilityMismatch, isFlagged } from '../audit-taxonomy';

export const metadata = { title: 'Audit entry' };

// ---------------------------------------------------------------
// Snapshot diffing
// ---------------------------------------------------------------

/**
 * The diff is computed here, at read time, from two complete snapshots.
 * The database stores whole `before` and `after` documents — see the note
 * rendered at the bottom of this page for why that is the right trade.
 */

type Bag = Record<string, unknown>;

function asBag(value: unknown): Bag | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Bag) : null;
}

/** `{ contact: { email: 'x' } }` → `{ 'contact.email': 'x' }`. */
function flatten(bag: Bag, prefix = ''): Bag {
  const out: Bag = {};
  for (const [key, value] of Object.entries(bag)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const nested = asBag(value);
    if (nested) Object.assign(out, flatten(nested, path));
    else out[path] = value;
  }
  return out;
}

type ChangeKind = 'added' | 'removed' | 'changed' | 'same';

interface FieldChange {
  path: string;
  before: unknown;
  after: unknown;
  kind: ChangeKind;
}

const equal = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function diffSnapshots(before: Bag | null, after: Bag | null): FieldChange[] {
  const b = before ? flatten(before) : {};
  const a = after ? flatten(after) : {};
  const paths = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort();

  return paths.map((path) => {
    const inBefore = path in b;
    const inAfter = path in a;
    const kind: ChangeKind = !inBefore
      ? 'added'
      : !inAfter
        ? 'removed'
        : equal(b[path], a[path])
          ? 'same'
          : 'changed';
    return { path, before: b[path], after: a[path], kind };
  });
}

/** Field paths read better as words than as snake_case keys. */
function fieldLabel(path: string): string {
  return path
    .split('.')
    .map((segment) => segment.replace(/_/g, ' '))
    .join(' → ')
    .replace(/^./, (c) => c.toUpperCase());
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return 'not set';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (Array.isArray(value)) return value.length ? value.map(String).join(', ') : 'empty list';
  if (typeof value === 'object') return JSON.stringify(value);
  const text = String(value);
  return text.length ? text : 'empty';
}

const CHANGE_BADGE: Record<Exclude<ChangeKind, 'same'>, { label: string; tone: 'warning' | 'success' | 'danger' }> = {
  changed: { label: 'Changed', tone: 'warning' },
  added: { label: 'Added', tone: 'success' },
  removed: { label: 'Removed', tone: 'danger' },
};

// ---------------------------------------------------------------
// Page
// ---------------------------------------------------------------

export default async function AuditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  requireCap(session, 'audit.read');

  const { id } = await params;
  const entry = getAuditLog({ limit: 10000 }).find((e) => e.id === id);
  if (!entry) notFound();

  const flagged = isFlagged(entry.action);
  const flag = FLAGGED[entry.action];
  const mismatch = capabilityMismatch(entry.action, entry.actorRole);

  const before = asBag(entry.before);
  const after = asBag(entry.after);
  const hasSnapshot = Boolean(before || after);

  const changes = diffSnapshots(before, after);
  const changed = changes.filter((c) => c.kind !== 'same');
  const unchanged = changes.filter((c) => c.kind === 'same');

  const roleLabel = entry.actorRole ? (ROLE_LABELS[entry.actorRole] ?? entry.actorRole) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Governance' },
              { label: 'Audit log', href: '/admin/audit' },
              { label: entry.id },
            ]}
          />
        }
        eyebrow="Audit entry"
        title={actionLabel(entry.action)}
        description={
          entry.reason ??
          'No reason was recorded against this entry. Actions that carry consequence for a member are required to state one; the rest are recorded without.'
        }
        actions={
          <ButtonLink variant="secondary" href="/admin/audit">
            Back to the log
          </ButtonLink>
        }
      />

      {flagged && flag ? (
        <Alert tone="warning" title="Flagged for incident review" icon={<ShieldAlert className="size-4" />}>
          <p>{flag.why}</p>
        </Alert>
      ) : null}

      {mismatch && flag ? (
        <Alert tone="danger" title="The recorded role does not carry this action" icon={<TriangleAlert className="size-4" />}>
          <p>
            This entry is stamped <strong>{roleLabel}</strong>, and the capability matrix does not
            grant <code className="font-mono">{flag.capability}</code> to that role. The log records
            one role per entry while a person may hold several, so the innocent reading is that{' '}
            {entry.actorName ?? 'the actor'} also held a role that did. Confirm it against the role
            grants before you rule it out.
          </p>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">What changed</CardTitle>
                <CardDescription>
                  {hasSnapshot
                    ? `${changed.length} field${changed.length === 1 ? '' : 's'} differ between the snapshot taken before this action and the one taken after.`
                    : 'This entry carries no before-and-after snapshot.'}
                </CardDescription>
              </div>
              {hasSnapshot ? (
                <Badge tone={changed.length ? 'warning' : 'neutral'}>
                  {changed.length ? `${changed.length} changed` : 'No field differences'}
                </Badge>
              ) : null}
            </CardHeader>

            <CardBody className="space-y-5">
              {!hasSnapshot ? (
                <div className="space-y-3 rounded-lg border border-dashed border-line bg-surface p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Info className="size-4 text-muted" aria-hidden="true" />
                    Nothing was mutated, so nothing was snapshotted
                  </p>
                  <p className="text-sm text-secondary">
                    Snapshots are written by actions that change a row. An export reads and produces
                    a file; a campaign send, a moderation decision and a settings publish record
                    their outcome in the resource itself. For those, the reason, the actor and the
                    scope above <em>are</em> the record.
                  </p>
                  <p className="text-sm text-secondary">
                    Where an action plainly did change a member row and no snapshot appears here,
                    that is itself the finding: the write path skipped the snapshot columns, and the
                    entry cannot be used to reconstruct anything.
                  </p>
                </div>
              ) : changed.length === 0 ? (
                <div className="rounded-lg border border-dashed border-line bg-surface p-4">
                  <p className="text-sm font-semibold">Both snapshots are identical</p>
                  <p className="mt-1 text-sm text-secondary">
                    The action ran and wrote a pair of snapshots, but no field ended up different —
                    usually a re-save of an unchanged form. Worth knowing, and worth not mistaking
                    for a change.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {changed.map((change) => {
                    const badge = CHANGE_BADGE[change.kind as Exclude<ChangeKind, 'same'>];
                    return (
                      <li
                        key={change.path}
                        className="grid gap-2 py-3.5 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:gap-5"
                      >
                        <div className="space-y-1.5">
                          <p className="text-sm font-medium">{fieldLabel(change.path)}</p>
                          {/* Colour never carries the meaning alone — the word does. */}
                          <Badge tone={badge.tone}>{badge.label}</Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                          {change.kind !== 'added' ? (
                            <span className="font-mono text-sm text-muted line-through decoration-1">
                              {renderValue(change.before)}
                            </span>
                          ) : null}

                          {change.kind === 'changed' ? (
                            <ArrowRight className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                          ) : null}

                          {change.kind !== 'removed' ? (
                            <span className="rounded-sm bg-success-soft px-2 py-0.5 font-mono text-sm font-semibold text-success-fg">
                              {renderValue(change.after)}
                            </span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {unchanged.length ? (
                <Disclosure
                  summary={`${unchanged.length} field${unchanged.length === 1 ? '' : 's'} carried through unchanged`}
                >
                  <dl className="space-y-1.5">
                    {unchanged.map((change) => (
                      <div key={change.path} className="flex flex-wrap justify-between gap-x-4">
                        <dt className="text-secondary">{fieldLabel(change.path)}</dt>
                        <dd className="font-mono text-xs text-muted">{renderValue(change.after)}</dd>
                      </div>
                    ))}
                  </dl>
                </Disclosure>
              ) : null}

              {hasSnapshot ? (
                <Disclosure summary="Raw snapshots">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Before</p>
                      <pre className="overflow-x-auto rounded border border-line bg-surface-sunken p-3 font-mono text-xs text-secondary">
                        {JSON.stringify(entry.before ?? null, null, 2)}
                      </pre>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">After</p>
                      <pre className="overflow-x-auto rounded border border-line bg-surface-sunken p-3 font-mono text-xs text-secondary">
                        {JSON.stringify(entry.after ?? null, null, 2)}
                      </pre>
                    </div>
                  </div>
                </Disclosure>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">Why the log stores whole snapshots, not diffs</CardTitle>
                <CardDescription>
                  A design decision that only ever pays out on the worst day of the year.
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody className="max-w-prose space-y-4 text-sm text-secondary">
              <p>
                A chain of diffs is smaller, and on an ordinary day it holds the same information.
                The day you open this screen is not an ordinary day. Answering “what did this record
                look like on 3 March” from a diff chain means replaying every entry since the row was
                created, in order, and trusting that none of them was written by a build that
                serialised a field differently. That is an extra step at exactly the moment you
                cannot afford one — and it fails whenever a single entry in the middle is malformed,
                which is the same class of bug that caused the incident.
              </p>
              <p>
                Storing <code className="font-mono text-primary">before</code> and{' '}
                <code className="font-mono text-primary">after</code> in full makes every entry
                independently readable. One row is one complete answer. The comparison you are
                looking at is computed at read time, so it can be presented differently later — a
                field renamed, a value formatted for humans — without anyone rewriting history to
                make the display work.
              </p>
              <p>
                The cost is storage, which is the cheap part, and duplication, which is the point.
              </p>
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Entry</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="divide-y divide-line">
                <DetailRow label="Actor">{entry.actorName ?? 'Unattributed'}</DetailRow>
                <DetailRow label="Role recorded">
                  {roleLabel ? (
                    <span className="flex flex-wrap items-center gap-2">
                      {roleLabel}
                      {mismatch ? <Badge tone="danger">Capability mismatch</Badge> : null}
                    </span>
                  ) : (
                    <span className="text-muted">None</span>
                  )}
                </DetailRow>
                <DetailRow label="Action">
                  <span className="font-mono text-xs">{entry.action}</span>
                </DetailRow>
                <DetailRow label="When">
                  <span className="tabular">{formatDateTime(entry.createdAt)}</span>
                  <span className="block text-xs font-normal text-muted">
                    {formatRelative(entry.createdAt)}
                  </span>
                </DetailRow>
                <DetailRow label="Resource">
                  <span className="capitalize">{entry.resource.replace(/_/g, ' ')}</span>
                  <span className="block font-mono text-xs font-normal text-muted">
                    {entry.resourceId ?? 'no id recorded'}
                  </span>
                </DetailRow>
                <DetailRow label="Reason">
                  {entry.reason ?? <span className="text-muted">None recorded</span>}
                </DetailRow>
                <DetailRow label="From">
                  <span className="font-mono text-xs">{entry.ip ?? '—'}</span>
                </DetailRow>
                <DetailRow label="Entry id">
                  <span className="font-mono text-xs">{entry.id}</span>
                </DetailRow>
              </dl>
            </CardBody>
            <CardFooter className="flex-col items-stretch gap-2">
              <ButtonLink
                variant="secondary"
                size="sm"
                href={`/admin/audit?q=${encodeURIComponent(entry.actorName ?? '')}`}
              >
                <History className="size-3.5" aria-hidden="true" />
                Everything this actor did
              </ButtonLink>
              <ButtonLink
                variant="ghost"
                size="sm"
                href={`/admin/audit?action=${encodeURIComponent(entry.action)}`}
              >
                <ScrollText className="size-3.5" aria-hidden="true" />
                Every {actionLabel(entry.action).toLowerCase()}
              </ButtonLink>
            </CardFooter>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Database className="size-4 text-brand-fg" aria-hidden="true" />
                What this row cannot be
              </p>
              <Separator />
              <p className="text-sm text-secondary">
                This entry cannot be edited or deleted by anyone, at any role. It also cannot be
                widened: an audit row records that an action touched a resource, never the contents
                of a private message, a CGPA, or a contact detail the viewer was not entitled to.
                An audit log that quietly becomes a second copy of the data is a second breach.
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
