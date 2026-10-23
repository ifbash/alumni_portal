import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getGroupBySlug, getGroupMembers, getGroupRequests } from '@/lib/data/groups';
import { memberLine } from '@/lib/format';
import {
  Alert,
  Breadcrumbs,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  PageHeader,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { GroupEditor } from '../GroupEditor';
import { LeadControls } from '../LeadControls';

export const metadata = { title: 'Group · Staff console' };

export default async function AdminGroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  if (!resolved.brand.pack.features.groups) notFound();

  requireCap(session, 'group.manage');

  const { slug } = await params;
  const group = getGroupBySlug(session, slug);
  if (!group) notFound();

  const members = getGroupMembers(session, slug);
  const requests = getGroupRequests(session, slug);

  return (
    <div className="space-y-8">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Staff console', href: '/admin' },
              { label: 'Groups', href: '/admin/groups' },
              { label: group.name },
            ]}
          />
        }
        eyebrow={group.kind === 'chapter' ? 'Chapter' : 'Interest group'}
        title={group.name}
        description={`${group.memberCount.toLocaleString('en-IN')} ${group.memberCount === 1 ? 'member' : 'members'}. Members see it at /groups/${group.slug}.`}
      />

      {group.leads.length === 0 && !group.archived ? (
        <Alert tone="warning" title="Nobody leads this group">
          <p>
            Without a lead nobody approves requests or looks after the noticeboard. Make one of the members below a lead.
          </p>
        </Alert>
      ) : null}

      <GroupEditor
        mode="edit"
        takenSlugs={[]}
        initial={{
          slug: group.slug,
          name: group.name,
          kind: group.kind,
          description: group.description ?? '',
          city: group.city ?? '',
          country: group.country ?? '',
          joinPolicy: group.joinPolicy,
          archived: group.archived,
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle as="h2">Members and leads</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {requests.length > 0 ? (
            <p className="text-sm text-secondary">
              {requests.length} {requests.length === 1 ? 'request is' : 'requests are'} waiting. Leads decide them on the{' '}
              <Link href={`/groups/${group.slug}?tab=requests`} className="link">
                group’s page
              </Link>
              .
            </p>
          ) : null}
          {members.length === 0 ? (
            <p className="text-sm text-secondary">Nobody has joined yet.</p>
          ) : (
            <TableWrap caption={`Members of ${group.name}`}>
              <Table>
                <THead>
                  <TR>
                    <TH>Member</TH>
                    <TH className="text-right">Role</TH>
                  </TR>
                </THead>
                <TBody>
                  {members.map((m) => (
                    <TR key={m.member.id}>
                      <TD>
                        <p className="font-medium">{m.member.fullName}</p>
                        <p className="text-xs text-secondary">
                          {memberLine([m.member.departmentCode, m.member.batchYear ? `Batch of ${m.member.batchYear}` : null, m.member.isStudent ? 'Final year' : m.member.currentCompany])}
                        </p>
                      </TD>
                      <TD className="text-right">
                        <LeadControls
                          slug={group.slug}
                          memberId={m.member.id}
                          name={m.member.fullName}
                          isLead={m.role === 'lead'}
                          canLead={!m.member.isStudent}
                        />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
