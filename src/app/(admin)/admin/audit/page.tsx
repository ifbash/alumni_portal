import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Search, ShieldAlert, TriangleAlert } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, isVendorOnlySession, require as requireCap } from '@/lib/auth/guard';
import { redactAuditEntry } from '@/lib/audit/redact';
import { getAuditActions, getAuditLog } from '@/lib/data/repo';
import type { AuditEntry } from '@/lib/data/types';
import { getTenantBrand } from '@/lib/tenant';
import { displayNow, formatDate, formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Badge,
  Button,
  ButtonLink,
  ChipNav,
  EmptyState,
  HowThisWorks,
  Input,
  PageHeader,
  Select,
  SummaryLine,
} from '@/components/ui';

import {
  QUICK_FILTERS,
  actionLabel,
  capabilityMismatch,
  isFlagged,
  resourceLabel,
  roleLabel,
} from './audit-taxonomy';

export const metadata = { title: 'Audit log · Staff console' };

const one = (v: string | string[] | undefined): string =>
  (Array.isArray(v) ? v[0] : v)?.trim() ?? '';

function buildHref(next: { action?: string; q?: string; show?: string }): string {
  const params = new URLSearchParams();
  if (next.show) params.set('show', next.show);
  else if (next.action) params.set('action', next.action);
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
  const showRaw = one(params.show);
  const show =
    showRaw === 'mismatch' || Object.prototype.hasOwnProperty.call(QUICK_FILTERS, showRaw) ? showRaw : '';

  // The vendor reads the event, not the member data inside it - and a text
  // search over reasons it cannot read would still be a way to read them, so
  // for that viewer the search runs over what they can see.
  const vendor = isVendorOnlySession(session);
  const scrub = (list: AuditEntry[]) => (vendor ? list.map(redactAuditEntry) : list);
  const matchesQuery = (e: AuditEntry) =>
    !q || `${e.actorName} ${e.action} ${e.resource}`.toLowerCase().includes(q.toLowerCase());

  const entries = vendor
    ? scrub(getAuditLog({ action: action || undefined })).filter(matchesQuery)
    : getAuditLog({ action: action || undefined, q: q || undefined });
  const recorded = getAuditLog({ limit: 10000 }).length;
  const actions = getAuditActions();

  const everything = scrub(getAuditLog({ limit: 10000 }));
  const pack = (await getTenantBrand())?.brand.pack;
  const fmt = { locale: pack?.locale.locale, timeZone: pack?.locale.timeZone };

  // A quick filter covers several machine actions (grants and revocations),
  // so it narrows the whole log rather than the one-action read above.
  const rows: AuditEntry[] = show
    ? everything
        .filter((e) =>
          show === 'mismatch'
            ? capabilityMismatch(e.action, e.actorRole)
            : QUICK_FILTERS[show]!.actions.includes(e.action),
        )
        .filter((e) =>
          q ? `${e.actorName} ${e.action} ${e.resource} ${e.reason ?? ''}`.toLowerCase().includes(q.toLowerCase()) : true,
        )
        .slice(0, 60)
    : entries;

  const filtered = Boolean(action || q || show);

  // The three counts that open the page, over the whole log.
  const monthOf = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: fmt.timeZone ?? 'Asia/Kolkata',
  });
  const monthKey = (d: Date | string) => monthOf.format(typeof d === 'string' ? new Date(d) : d);
  const thisMonth = monthKey(displayNow());
  const exportsThisMonth = everything.filter(
    (e) => e.action === 'member.export' && monthKey(e.createdAt) === thisMonth,
  ).length;
  const roleChanges = everything.filter((e) => QUICK_FILTERS.roles!.actions.includes(e.action)).length;
  const mismatches = everything.filter((e) => capabilityMismatch(e.action, e.actorRole)).length;

  const canManageRoles = can(session, 'role.manage');

  // Day headings: rows arrive most recent first, so consecutive rows that
  // share a calendar day (in the college's time zone) form one group.
  const groups: Array<{ key: string; label: string; rows: AuditEntry[] }> = [];
  const today = formatDate(displayNow(), fmt);
  const yesterday = formatDate(new Date(displayNow().getTime() - 86400000), fmt);
  const ordered = [...rows].sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  for (const e of ordered) {
    const key = formatDate(e.createdAt, fmt);
    const label = key === today ? 'Today' : key === yesterday ? 'Yesterday' : key;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.rows.push(e);
    else groups.push({ key, label, rows: [e] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Audit log"
        description="Who did what, when and why. No one can edit or delete an entry."
      />

      <SummaryLine
        items={[
          {
            value: exportsThisMonth,
            label: exportsThisMonth === 1 ? 'export this month' : 'exports this month',
            href: buildHref({ show: 'exports' }),
          },
          {
            value: roleChanges,
            label: roleChanges === 1 ? 'role change' : 'role changes',
            href: buildHref({ show: 'roles' }),
          },
          {
            value: mismatches,
            label: mismatches === 1 ? 'mismatch to check' : 'mismatches to check',
            href: buildHref({ show: 'mismatch' }),
            tone: 'attention',
          },
        ]}
      />

      {mismatches > 0 ? (
        <section
          aria-labelledby="audit-needs-look"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line border-l-4 border-l-warning bg-surface-raised px-4 py-3 shadow-sm"
        >
          <p id="audit-needs-look" className="flex items-start gap-2 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-fg" aria-hidden="true" />
            <span>
              <span className="font-semibold">Needs a look:</span> {mismatches}{' '}
              {mismatches === 1 ? 'entry' : 'entries'} where the recorded role cannot do the action — check role grants.
            </span>
          </p>
          <span className="flex flex-wrap items-center gap-2">
            <ButtonLink href={buildHref({ show: 'mismatch' })} variant="secondary" size="sm" className="min-h-11 sm:min-h-0">
              See {mismatches === 1 ? 'it' : 'them'}
            </ButtonLink>
            {canManageRoles ? (
              <ButtonLink href="/admin/roles" variant="ghost" size="sm" className="min-h-11 sm:min-h-0">
                Role grants
              </ButtonLink>
            ) : null}
          </span>
        </section>
      ) : null}

      {/* ---- Toolbar: every filter is a GET param, so a view can be pasted into a thread. */}
      <div className="space-y-3">
        <form method="get" role="search" aria-label="Filter the audit log" className="flex flex-wrap items-center gap-2">
          <label htmlFor="audit-q" className="sr-only">
            Search the log
          </label>
          <div className="min-w-0 flex-1 basis-60">
            <Input
              id="audit-q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Search actor, resource or reason"
              leading={<Search className="size-4" />}
            />
          </div>
          <label htmlFor="audit-action" className="sr-only">
            Action
          </label>
          <div className="min-w-0 basis-56">
            <Select id="audit-action" name="action" defaultValue={show ? '' : action}>
              <option value="">Every action</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {actionLabel(a)}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="secondary">
            Filter
          </Button>
          {filtered ? (
            <ButtonLink variant="ghost" href="/admin/audit">
              Clear
            </ButtonLink>
          ) : null}
        </form>

        <ChipNav
          ariaLabel="Quick filters"
          items={[
            { label: 'Everything', href: buildHref({ q }), active: !show && !action },
            ...Object.entries(QUICK_FILTERS).map(([key, f]) => ({
              label: f.label,
              href: buildHref({ show: key, q }),
              active: show === key,
            })),
          ]}
        />
      </div>

      {/* ---- The log ------------------------------------------------ */}
      <section aria-label="Entries" className="space-y-5">
        {rows.length === 0 ? (
          <EmptyState
            variant="inline"
            title="Nothing in the log matches that."
            description={`The log holds ${recorded.toLocaleString('en-IN')} entries; try one filter at a time.`}
            action={
              <Link href="/admin/audit" className="link">
                Clear filters
              </Link>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-line bg-surface-raised">
            {groups.map((g) => (
              <section key={g.key} aria-labelledby={`day-${g.key.replace(/\W+/g, '-')}`}>
                <h2
                  id={`day-${g.key.replace(/\W+/g, '-')}`}
                  className="border-b border-line bg-surface-sunken px-4 py-1 font-body text-xs font-semibold uppercase tracking-wider text-secondary"
                >
                  {g.label}
                </h2>
                <ul className="divide-y divide-line border-b border-line">
                {g.rows.map((e) => {
                  const flagged = isFlagged(e.action);
                  const mismatch = capabilityMismatch(e.action, e.actorRole);
                  const role = roleLabel(e.actorRole);
                  return (
                    <li
                      key={e.id}
                      className={cn(
                        'relative flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-2 text-sm transition-colors duration-fast ease-brand hover:bg-surface-sunken md:py-1.5',
                        'md:grid md:grid-cols-[6rem_minmax(0,17rem)_minmax(0,17rem)_minmax(0,8rem)_minmax(0,1fr)] md:items-center md:gap-x-4',
                        // A left accent, not a fill: a third of the log is flagged, and a
                        // shaded third of a table makes nothing stand out.
                        flagged && 'before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-warning',
                      )}
                    >
                      <span className="order-1 flex min-w-0 basis-full items-center gap-1.5 md:order-3 md:basis-auto">
                        {flagged ? (
                          <ShieldAlert className="size-3.5 shrink-0 text-warning-fg" aria-hidden="true" />
                        ) : null}
                        <Link
                          href={`/admin/audit/${e.id}`}
                          className="-my-3 truncate py-3 font-medium hover:text-brand-fg hover:underline md:my-0 md:py-0"
                        >
                          {actionLabel(e.action)}
                        </Link>
                        {mismatch ? (
                          <Badge tone="danger" className="shrink-0 whitespace-nowrap">
                            Role mismatch
                          </Badge>
                        ) : flagged ? (
                          <Badge tone="warning" className="shrink-0 whitespace-nowrap">
                            Flagged
                          </Badge>
                        ) : null}
                      </span>
                      <span className="order-2 shrink-0 text-xs text-secondary md:order-1 md:text-sm">
                        <time dateTime={e.createdAt} title={formatDateTime(e.createdAt, fmt)}>
                          {formatRelative(e.createdAt, fmt)}
                        </time>
                        <span aria-hidden="true" className="md:hidden">
                          {' '}
                          ·
                        </span>
                      </span>
                      <span
                        className="order-3 min-w-0 flex-1 truncate text-xs text-secondary md:order-2 md:text-sm md:text-primary"
                        title={`${e.actorName ?? 'Unattributed'}${role ? ` · ${role}` : ''}`}
                      >
                        {e.actorName ?? 'Unattributed'}
                        {role ? <span className="text-secondary"> · {role}</span> : null}
                      </span>
                      <span className="order-4 hidden truncate text-secondary md:block">{resourceLabel(e.resource)}</span>
                      <span
                        className={cn(
                          'order-5 basis-full truncate md:basis-auto',
                          'text-secondary',
                        )}
                        title={e.reason ?? undefined}
                      >
                        {e.reason ?? 'No reason recorded'}
                      </span>
                    </li>
                  );
                })}
                </ul>
              </section>
            ))}
          </div>
        )}

        {rows.length > 0 ? (
          <p className="text-xs text-secondary">
            Showing the {rows.length} most recent matching entries of {recorded.toLocaleString('en-IN')}. Narrow the
            search to reach older ones.
          </p>
        ) : null}
      </section>

      <HowThisWorks summary="How the audit log works">
        <p>
          Entries are written and never changed: no role can edit or delete one, including the college admin. Exports
          and role grants carry the reason given at the time, so &ldquo;why&rdquo; can be answered later, not just
          &ldquo;who&rdquo;.
        </p>
        <p>
          The log records that a message was sent, by whom and to whom. It never holds message contents, marks or
          contact details.
        </p>
      </HowThisWorks>
    </div>
  );
}
