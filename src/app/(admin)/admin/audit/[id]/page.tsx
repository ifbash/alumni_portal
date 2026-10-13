import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight, History, ScrollText, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, isVendorOnlySession, require as requireCap } from '@/lib/auth/guard';
import { redactAuditEntry } from '@/lib/audit/redact';
import { getAuditLog } from '@/lib/data/repo';
import { getTenantBrand } from '@/lib/tenant';
import { formatDateTime, formatRelative } from '@/lib/format';
import { inSentence, joinList } from '@/lib/branding/copy';
import {
  Alert,
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Disclosure,
  PageHeader,
} from '@/components/ui';

import {
  FLAGGED,
  actionLabel,
  actionSentence,
  capabilityMismatch,
  isFlagged,
  resourceLabel,
  roleLabel as labelForRole,
  rolesAllowed,
  valueLabel,
} from '../audit-taxonomy';

export const metadata = { title: 'Audit entry · Staff console' };

// ---------------------------------------------------------------
// Snapshot diffing
// ---------------------------------------------------------------

/**
 * The diff is computed here, at read time, from two complete snapshots.
 * The database stores whole `before` and `after` documents — see "About
 * the audit log" at the bottom of this page for why that is the right
 * trade.
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

/** A stored value as a reader says it: enums as words ("Alumni", not the enum). */
function renderValue(value: unknown): string {
  if (value === null || value === undefined) return 'not set';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (Array.isArray(value)) return value.length ? value.map((v) => valueLabel(String(v))).join(', ') : 'empty list';
  if (typeof value === 'object') return JSON.stringify(value);
  const text = String(value);
  return text.length ? valueLabel(text) : 'empty';
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
  const found = getAuditLog({ limit: 10000 }).find((e) => e.id === id);
  if (!found) notFound();
  // The vendor reads the event, not the member data inside it.
  const entry = isVendorOnlySession(session) ? redactAuditEntry(found) : found;

  const pack = (await getTenantBrand())?.brand.pack;
  const fmt = { locale: pack?.locale.locale, timeZone: pack?.locale.timeZone };

  const flagged = isFlagged(entry.action);
  const flag = FLAGGED[entry.action];
  const mismatch = capabilityMismatch(entry.action, entry.actorRole);
  const canManageRoles = can(session, 'role.manage');

  const before = asBag(entry.before);
  const after = asBag(entry.after);
  const hasSnapshot = Boolean(before || after);

  const changes = diffSnapshots(before, after);
  const changed = changes.filter((c) => c.kind !== 'same');
  const unchanged = changes.filter((c) => c.kind === 'same');

  const roleLabel = labelForRole(entry.actorRole);
  const actor = entry.actorName ?? 'An unattributed account';
  const when = formatDateTime(entry.createdAt, fmt);
  const allowed = rolesAllowed(entry.action);

  const sentence = [
    `${actor}${roleLabel ? ` (${roleLabel})` : ''} ${actionSentence(entry.action)}`,
    when,
    entry.ip ? `from ${entry.ip}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const facts: Array<{ label: string; value: ReactNode }> = [
    { label: 'Actor', value: entry.actorName ?? 'Unattributed' },
    {
      label: 'Role recorded',
      value: roleLabel ? (
        <span className="flex flex-wrap items-center gap-2">
          {roleLabel}
          {mismatch ? <Badge tone="danger">Role mismatch</Badge> : null}
        </span>
      ) : (
        'None'
      ),
    },
    {
      label: 'When',
      value: (
        <>
          <span className="tabular">{when}</span>
          <span className="block text-xs font-normal text-secondary">{formatRelative(entry.createdAt, fmt)}</span>
        </>
      ),
    },
    {
      label: 'Resource',
      value: (
        <>
          {resourceLabel(entry.resource)}
          <span className="block font-mono text-xs font-normal text-secondary">{entry.resourceId ?? 'no id recorded'}</span>
        </>
      ),
    },
    { label: 'From', value: <span className="font-mono text-xs">{entry.ip ?? '—'}</span> },
    { label: 'Action', value: <span className="font-mono text-xs">{entry.action}</span> },
    { label: 'Entry ID', value: <span className="font-mono text-xs">{entry.id}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Staff console', href: '/admin' },
              { label: 'Audit log', href: '/admin/audit' },
              { label: actionLabel(entry.action) },
            ]}
          />
        }
        eyebrow="Governance"
        title={actionLabel(entry.action)}
        description={sentence}
      />

      {entry.reason ? (
        <blockquote className="border-l-4 border-line-strong pl-4 text-md text-primary">
          <p>&ldquo;{entry.reason}&rdquo;</p>
          <footer className="mt-1 text-xs text-secondary">The reason given at the time</footer>
        </blockquote>
      ) : (
        <p className="text-sm text-secondary">No reason was recorded against this entry.</p>
      )}

      {mismatch && flag ? (
        <Alert tone="danger" title="The recorded role cannot do this" icon={<TriangleAlert className="size-4" />}>
          <p>
            This entry is stamped <strong>{roleLabel}</strong>, and that role cannot {flag.toDo}
            {allowed.length
              ? ` (it needs the ${joinList(allowed.map(inSentence))} role)`
              : ''}
            . The log records one role per entry and a person can hold several, so{' '}
            {entry.actorName ?? 'the actor'} may also have held a role that can. Confirm it against the role grants
            before ruling it out.
          </p>
          {canManageRoles ? (
            <p className="mt-2">
              <Link href="/admin/roles" className="inline-flex min-h-11 items-center gap-1 font-semibold sm:min-h-0">
                Check {entry.actorName ?? 'the actor'}&rsquo;s roles
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </p>
          ) : null}
        </Alert>
      ) : null}

      {flagged && flag ? (
        <Alert tone="warning" title="Flagged for review" icon={<ShieldAlert className="size-4" />}>
          <p>{flag.why}</p>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardBody>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                {facts.map((f) => (
                  <div key={f.label} className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-secondary">{f.label}</dt>
                    <dd className="mt-1 break-words text-sm font-medium">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">What changed</CardTitle>
              {hasSnapshot ? (
                <Badge tone={changed.length ? 'warning' : 'neutral'} className="shrink-0 whitespace-nowrap">
                  {changed.length
                    ? `${changed.length} ${changed.length === 1 ? 'field differs' : 'fields differ'}`
                    : 'No field differences'}
                </Badge>
              ) : null}
            </CardHeader>

            <CardBody className="space-y-5">
              {!hasSnapshot ? (
                <p className="text-sm text-secondary">
                  Exports and sends change no record. The reason and scope above are the record.
                </p>
              ) : changed.length === 0 ? (
                <p className="text-sm text-secondary">
                  Both snapshots are identical: the action ran, but no field ended up different.
                </p>
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
                            <span className="text-sm text-secondary line-through decoration-1">
                              {renderValue(change.before)}
                            </span>
                          ) : null}

                          {change.kind === 'changed' ? (
                            <ArrowRight className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                          ) : null}

                          {change.kind !== 'removed' ? (
                            <span className="rounded-sm bg-success-soft px-2 py-0.5 text-sm font-semibold text-success-fg">
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
                  summary={`${unchanged.length} ${unchanged.length === 1 ? 'field' : 'fields'} carried through unchanged`}
                >
                  <dl className="space-y-1.5">
                    {unchanged.map((change) => (
                      <div key={change.path} className="flex flex-wrap justify-between gap-x-4">
                        <dt className="text-secondary">{fieldLabel(change.path)}</dt>
                        <dd className="text-xs text-secondary">{renderValue(change.after)}</dd>
                      </div>
                    ))}
                  </dl>
                </Disclosure>
              ) : null}

              {hasSnapshot ? (
                <Disclosure summary="Raw snapshots">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Before</p>
                      <pre className="overflow-x-auto rounded border border-line bg-surface-sunken p-3 font-mono text-xs text-secondary">
                        {JSON.stringify(entry.before ?? null, null, 2)}
                      </pre>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-secondary">After</p>
                      <pre className="overflow-x-auto rounded border border-line bg-surface-sunken p-3 font-mono text-xs text-secondary">
                        {JSON.stringify(entry.after ?? null, null, 2)}
                      </pre>
                    </div>
                  </div>
                </Disclosure>
              ) : null}
            </CardBody>
          </Card>

          <Disclosure
            summary={
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4 shrink-0 text-brand-fg" aria-hidden="true" />
                About the audit log
              </span>
            }
          >
            <div className="max-w-prose space-y-2">
              <p>
                No one can edit or delete an entry, at any role. An entry records that an action touched a record; it
                never holds a private message, marks or a contact detail the reader could not otherwise see.
              </p>
              <p>
                Actions that change a record store the whole record before and after, not just the difference, so each
                entry can be read on its own. The comparison above is worked out when you open the page.
              </p>
            </div>
          </Disclosure>
        </div>

        <aside aria-label="Related entries" className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Related</p>
          <ul className="space-y-1">
            {entry.actorName ? (
              <li>
                <ButtonLink
                  variant="ghost"
                  size="sm"
                  className="min-h-11 w-full justify-start lg:min-h-9"
                  href={`/admin/audit?q=${encodeURIComponent(entry.actorName)}`}
                >
                  <History className="size-3.5" aria-hidden="true" />
                  Everything this actor did
                </ButtonLink>
              </li>
            ) : null}
            <li>
              <ButtonLink
                variant="ghost"
                size="sm"
                className="min-h-11 w-full justify-start whitespace-normal text-left lg:min-h-9"
                href={`/admin/audit?action=${encodeURIComponent(entry.action)}`}
              >
                <ScrollText className="size-3.5 shrink-0" aria-hidden="true" />
                Every entry of this kind
              </ButtonLink>
            </li>
            {mismatch && canManageRoles ? (
              <li>
                <ButtonLink
                  variant="ghost"
                  size="sm"
                  className="min-h-11 w-full justify-start lg:min-h-9"
                  href="/admin/roles"
                >
                  <ShieldAlert className="size-3.5" aria-hidden="true" />
                  Role grants
                </ButtonLink>
              </li>
            ) : null}
            <li>
              <ButtonLink
                variant="ghost"
                size="sm"
                className="min-h-11 w-full justify-start lg:min-h-9"
                href="/admin/audit"
              >
                <ArrowRight className="size-3.5 rotate-180" aria-hidden="true" />
                Back to the log
              </ButtonLink>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
