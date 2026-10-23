import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { UsersRound } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getGroupRequests, getGroups } from '@/lib/data/groups';
import { Badge, ButtonLink, EmptyState, PageHeader, SummaryLine, Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui';

/**
 * Groups and chapters, for the people who run them.
 *
 * Members do not start groups: a group has a name the college stands behind
 * and leads who look after it, so creating one is a staff action. The list
 * puts the groups with no lead first, because a group nobody leads is a
 * noticeboard nobody is watching, and the ones with requests waiting next.
 */

export const metadata = { title: 'Groups · Staff console' };

export default async function AdminGroupsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  if (!resolved.brand.pack.features.groups) notFound();

  requireCap(session, 'group.manage');

  const groups = getGroups(session);
  const waiting = (slug: string) => getGroupRequests(session, slug).length;
  const unled = groups.filter((g) => g.leads.length === 0 && !g.archived);
  const withRequests = groups.filter((g) => waiting(g.slug) > 0);

  const ordered = [...groups].sort(
    (a, b) =>
      Number(b.leads.length === 0) - Number(a.leads.length === 0) ||
      waiting(b.slug) - waiting(a.slug) ||
      a.name.localeCompare(b.name),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Groups"
        description="Chapters by city and groups by interest, and who leads each one."
        actions={<ButtonLink href="/admin/groups/new">New group</ButtonLink>}
      />

      {groups.length > 0 ? (
        <SummaryLine
          items={[
            { value: groups.length, label: groups.length === 1 ? 'group' : 'groups' },
            ...(unled.length > 0 ? [{ value: unled.length, label: unled.length === 1 ? 'has no lead' : 'have no lead', tone: 'attention' as const }] : []),
            ...(withRequests.length > 0 ? [{ value: withRequests.length, label: withRequests.length === 1 ? 'has requests waiting' : 'have requests waiting', tone: 'attention' as const }] : []),
          ]}
        />
      ) : null}

      {groups.length === 0 ? (
        <EmptyState
          variant="panel"
          icon={<UsersRound className="size-5" />}
          title="No groups yet"
          description="Start with the chapters alumni ask for by city, then the interest groups."
          action={
            <ButtonLink href="/admin/groups/new" variant="secondary">
              Create the first group
            </ButtonLink>
          }
        />
      ) : (
        <TableWrap caption="Groups and chapters">
          <Table>
            <THead>
              <TR>
                <TH>Group</TH>
                <TH>Kind</TH>
                <TH>Members</TH>
                <TH>Leads</TH>
                <TH>Requests</TH>
              </TR>
            </THead>
            <TBody>
              {ordered.map((g) => {
                const w = waiting(g.slug);
                return (
                  <TR key={g.id}>
                    <TD>
                      <Link href={`/admin/groups/${g.slug}`} className="link font-medium">
                        {g.name}
                      </Link>
                      <p className="font-mono text-xs text-secondary">/groups/{g.slug}</p>
                      {g.archived ? <Badge tone="neutral">Archived</Badge> : null}
                    </TD>
                    <TD>
                      <Badge tone={g.kind === 'chapter' ? 'brand' : 'accent'}>{g.kind === 'chapter' ? 'Chapter' : 'Interest'}</Badge>
                      {g.joinPolicy === 'approval' ? <p className="mt-1 text-xs text-secondary">By request</p> : null}
                    </TD>
                    <TD className="tabular">{g.memberCount.toLocaleString('en-IN')}</TD>
                    <TD className="text-sm">
                      {g.leads.length === 0 ? (
                        <Badge tone="warning">No lead</Badge>
                      ) : (
                        <span className="line-clamp-2 text-secondary">{g.leads.map((l) => l.fullName).join(', ')}</span>
                      )}
                    </TD>
                    <TD className="tabular">{w > 0 ? <Badge tone="warning">{w}</Badge> : <span className="text-muted">None</span>}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </div>
  );
}
