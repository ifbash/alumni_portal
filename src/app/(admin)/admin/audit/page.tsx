import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Fingerprint,
  ListFilter,
  ScrollText,
  Search,
  ShieldAlert,
  TriangleAlert,
  UserRound,
} from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getAuditActions, getAuditLog } from '@/lib/data/repo';
import { ROLE_LABELS } from '@/lib/navigation';
import { formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  DefinitionCard,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Section,
  Select,
  Stat,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';

import { FLAGGED, actionLabel, capabilityMismatch, isFlagged } from './audit-taxonomy';

export const metadata = { title: 'Audit log' };

const one = (v: string | string[] | undefined): string =>
  (Array.isArray(v) ? v[0] : v)?.trim() ?? '';

function buildHref(next: { action?: string; q?: string }): string {
  const params = new URLSearchParams();
  if (next.action) params.set('action', next.action);
  if (next.q) params.set('q', next.q);
  const qs = params.toString();
  return qs ? `/admin/audit?${qs}` : '/admin/audit';
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  // Hiding the nav link is presentation. This is the authorisation.
  requireCap(session, 'audit.read');

  const params = await searchParams;
  const action = one(params.action);
  const q = one(params.q);

  const entries = getAuditLog({ action: action || undefined, q: q || undefined });
  const recorded = getAuditLog({ limit: 10000 }).length;
  const actions = getAuditActions();

  const filtered = Boolean(action || q);
  const flaggedCount = entries.filter((e) => isFlagged(e.action)).length;
  const mismatchCount = entries.filter((e) => capabilityMismatch(e.action, e.actorRole)).length;
  const actorCount = new Set(entries.map((e) => e.actorName ?? 'unattributed')).size;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Audit log"
        description="Every administrative mutation, with the person who made it, the reason they gave and the address they made it from. Append-only: there is no capability in the matrix that edits or deletes a row here, deliberately."
        actions={
          <Badge tone="outline">
            <ScrollText className="size-3.5" aria-hidden="true" />
            {recorded.toLocaleString('en-IN')} entries recorded
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Entries in view"
          value={entries.length}
          icon={<ListFilter className="size-4" />}
          hint={filtered ? `filtered from ${recorded.toLocaleString('en-IN')}` : 'most recent first'}
        />
        <Stat
          label="Flagged for review"
          value={flaggedCount}
          icon={<ShieldAlert className="size-4" />}
          hint="exports, role grants, merges, rollovers"
        />
        <Stat
          label="Distinct actors"
          value={actorCount}
          icon={<UserRound className="size-4" />}
          hint="staff accounts appearing in this view"
        />
        <Stat
          label="Capability mismatches"
          value={mismatchCount}
          icon={<TriangleAlert className="size-4" />}
          hint={
            mismatchCount
              ? 'recorded role does not carry the action'
              : 'every flagged action matches its role'
          }
        />
      </div>

      <Card>
        <CardHeader>
          <div className="min-w-0 space-y-1">
            <CardTitle as="h2">Narrow the log</CardTitle>
            <CardDescription>
              Free text matches the actor, the action, the resource and the reason. Both filters
              stay in the URL, so a link you paste into an incident thread opens the same view.
            </CardDescription>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <form
            method="get"
            className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)] sm:items-start"
          >
            <Field htmlFor="audit-q" label="Search" hint="Actor name, resource, or words from the reason">
              <Input
                id="audit-q"
                name="q"
                type="search"
                defaultValue={q}
                placeholder="NAAC, Sridevi, duplicate, 1,214 rows…"
                leading={<Search className="size-4" />}
              />
            </Field>

            <Field htmlFor="audit-action" label="Action" hint="One action type at a time">
              <Select id="audit-action" name="action" defaultValue={action}>
                <option value="">All actions</option>
                {actions.map((a) => (
                  <option key={a} value={a}>
                    {actionLabel(a)}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <Button type="submit">Apply filters</Button>
              {filtered ? (
                <ButtonLink variant="ghost" href="/admin/audit">
                  Clear
                </ButtonLink>
              ) : null}
            </div>
          </form>

          <div className="space-y-2 border-t border-line pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Start an incident here
            </p>
            <ul className="flex flex-wrap gap-2">
              {Object.keys(FLAGGED).map((a) => {
                const active = action === a;
                return (
                  <li key={a}>
                    <Link
                      href={active ? buildHref({ q }) : buildHref({ action: a, q })}
                      aria-current={active ? 'true' : undefined}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
                        'transition-colors duration-fast ease-brand',
                        active
                          ? 'border-warning bg-warning-soft text-warning-fg'
                          : 'border-line text-secondary hover:border-line-strong hover:text-primary',
                      )}
                    >
                      <ShieldAlert className="size-3.5" aria-hidden="true" />
                      {actionLabel(a)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </CardBody>
      </Card>

      <Section
        title="Entries"
        description="Shaded rows are the four actions an incident review starts from. Everything else is the context around them."
      >
        {entries.length === 0 ? (
          <EmptyState
            icon={<Search className="size-5" />}
            title="Nothing in the log matches that"
            description={
              action && q
                ? `No ${actionLabel(action).toLowerCase()} entry mentions “${q}”. The log holds ${recorded.toLocaleString('en-IN')} entries in total — try one filter at a time.`
                : `The log holds ${recorded.toLocaleString('en-IN')} entries. Widen the search, or clear the filters to see the most recent activity.`
            }
            action={
              <ButtonLink variant="secondary" href="/admin/audit">
                Clear filters
              </ButtonLink>
            }
          />
        ) : (
          <>
            {/* Wide table scrolls inside its own region rather than widening the page. */}
            <TableWrap
              className="hidden sm:block"
              caption="Audit log entries, most recent first"
            >
              <Table className="min-w-[62rem]">
                <THead>
                  <TR>
                    <TH>When</TH>
                    <TH>Actor</TH>
                    <TH>Action</TH>
                    <TH>Resource</TH>
                    <TH>Reason</TH>
                    <TH>From</TH>
                    <TH>
                      <span className="sr-only">Open entry</span>
                    </TH>
                  </TR>
                </THead>
                <TBody>
                  {entries.map((e) => {
                    const flagged = isFlagged(e.action);
                    const mismatch = capabilityMismatch(e.action, e.actorRole);
                    return (
                      <TR
                        key={e.id}
                        className={
                          flagged
                            ? 'bg-warning-soft'
                            : 'transition-colors duration-fast ease-brand hover:bg-surface-sunken'
                        }
                      >
                        <TD className="whitespace-nowrap align-top">
                          <p className="font-medium tabular">{formatDateTime(e.createdAt)}</p>
                          <p className="text-xs text-muted">{formatRelative(e.createdAt)}</p>
                        </TD>

                        <TD className="align-top">
                          <p className="font-medium">{e.actorName ?? 'Unattributed'}</p>
                          <p className="text-xs text-muted">
                            {e.actorRole ? (ROLE_LABELS[e.actorRole] ?? e.actorRole) : 'no role recorded'}
                          </p>
                        </TD>

                        <TD className="align-top">
                          <p className="flex items-center gap-1.5 font-medium">
                            {flagged ? (
                              <ShieldAlert className="size-3.5 shrink-0 text-warning-fg" aria-hidden="true" />
                            ) : null}
                            {actionLabel(e.action)}
                          </p>
                          <p className="font-mono text-xs text-muted">{e.action}</p>
                          {mismatch ? (
                            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-danger-fg">
                              <TriangleAlert className="size-3 shrink-0" aria-hidden="true" />
                              Role does not carry this action
                            </p>
                          ) : null}
                        </TD>

                        <TD className="align-top">
                          <p className="text-secondary">{e.resource}</p>
                          <p className="font-mono text-xs text-muted">{e.resourceId ?? '—'}</p>
                        </TD>

                        <TD className="max-w-[22rem] align-top">
                          {e.reason ? (
                            <span className="text-secondary">{e.reason}</span>
                          ) : (
                            <span className="text-muted">No reason recorded</span>
                          )}
                        </TD>

                        <TD className="whitespace-nowrap align-top font-mono text-xs text-muted">
                          {e.ip ?? '—'}
                        </TD>

                        <TD className="align-top">
                          <ButtonLink
                            variant="ghost"
                            size="sm"
                            href={`/admin/audit/${e.id}`}
                            aria-label={`Open the ${actionLabel(e.action).toLowerCase()} entry from ${formatDateTime(e.createdAt)}`}
                          >
                            Open
                            <ArrowRight className="size-3.5" aria-hidden="true" />
                          </ButtonLink>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableWrap>

            {/* Below sm a seven-column table is unreadable however it scrolls. */}
            <ul className="space-y-3 sm:hidden">
              {entries.map((e) => {
                const flagged = isFlagged(e.action);
                const mismatch = capabilityMismatch(e.action, e.actorRole);
                return (
                  <li key={e.id}>
                    <DefinitionCard
                      className={flagged ? 'bg-warning-soft' : undefined}
                      title={
                        <span className="flex flex-wrap items-center gap-2">
                          {actionLabel(e.action)}
                          {flagged ? (
                            <Badge tone="warning">
                              <ShieldAlert className="size-3" aria-hidden="true" />
                              Flagged
                            </Badge>
                          ) : null}
                        </span>
                      }
                      subtitle={<span className="font-mono">{e.action}</span>}
                      rows={[
                        { label: 'When', value: formatDateTime(e.createdAt) },
                        {
                          label: 'Actor',
                          value: `${e.actorName ?? 'Unattributed'}${
                            e.actorRole ? ` · ${ROLE_LABELS[e.actorRole] ?? e.actorRole}` : ''
                          }`,
                        },
                        {
                          label: 'Resource',
                          value: <span className="font-mono text-xs">{e.resourceId ?? e.resource}</span>,
                        },
                        { label: 'Reason', value: e.reason ?? 'None recorded' },
                        { label: 'From', value: <span className="font-mono text-xs">{e.ip ?? '—'}</span> },
                        ...(mismatch
                          ? [
                              {
                                label: 'Check',
                                value: (
                                  <span className="font-semibold text-danger-fg">
                                    Role does not carry this action
                                  </span>
                                ),
                              },
                            ]
                          : []),
                      ]}
                      actions={
                        <ButtonLink variant="secondary" size="sm" href={`/admin/audit/${e.id}`}>
                          Open entry
                          <ArrowRight className="size-3.5" aria-hidden="true" />
                        </ButtonLink>
                      }
                    />
                  </li>
                );
              })}
            </ul>

            <p className="text-xs text-muted">
              Showing the {entries.length} most recent matching entries of{' '}
              {recorded.toLocaleString('en-IN')}. Older activity is reachable by narrowing the
              filters, never by paging past the end — an incident review that has to click through
              forty pages stops at page three.
            </p>
          </>
        )}
      </Section>

      <Card>
        <CardHeader>
          <div className="min-w-0 space-y-1">
            <CardTitle as="h2">How to read this log</CardTitle>
            <CardDescription>Three properties it is built to have, and one it is not.</CardDescription>
          </div>
        </CardHeader>
        <CardBody>
          <dl className="grid gap-5 md:grid-cols-3">
            <div className="space-y-1.5">
              <dt className="flex items-center gap-2 text-sm font-semibold">
                <ScrollText className="size-4 text-brand-fg" aria-hidden="true" />
                Append-only
              </dt>
              <dd className="text-sm text-secondary">
                Rows are written, never updated or removed. No role in the capability matrix can
                edit this table, including college_admin — a log its own administrator can rewrite
                answers no question worth asking.
              </dd>
            </div>
            <div className="space-y-1.5">
              <dt className="flex items-center gap-2 text-sm font-semibold">
                <Fingerprint className="size-4 text-brand-fg" aria-hidden="true" />
                Reason, not just record
              </dt>
              <dd className="text-sm text-secondary">
                A bulk export or a role grant carries the actor’s stated purpose. “Who exported the
                list” is answerable from a timestamp; “why” is only answerable if the product asked
                at the time.
              </dd>
            </div>
            <div className="space-y-1.5">
              <dt className="flex items-center gap-2 text-sm font-semibold">
                <ShieldAlert className="size-4 text-brand-fg" aria-hidden="true" />
                Not a message log
              </dt>
              <dd className="text-sm text-secondary">
                Connection and message bodies never appear here. The log records that a message was
                sent, by whom and to whom — no role reads the contents, and no entry in this table
                is a way around that.
              </dd>
            </div>
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}
