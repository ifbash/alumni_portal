import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { isActive } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDegreeRegisterStats } from '@/lib/data/repo';
import { getInviteQuota, getMyInvitations, INVITE_VALID_DAYS } from '@/lib/data/invites';
import { batchShareText, portalShareText } from '@/lib/share-text';
import { siteOrigin, whatsappShareUrl } from '@/lib/share';
import { viewerBatchYear } from '@/lib/identity';
import { formatRelative } from '@/lib/format';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  ShareActions,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { InviteForm } from '@/components/community/InviteForm';

/**
 * Bring batchmates in.
 *
 * The quickest way is a link on WhatsApp, which is where batches actually
 * talk, so that comes first and has no limit. Inviting by email is for the
 * batchmate you only have an address for, and is limited: ten a week.
 *
 * The list below is yours alone. It is not visible to the college or to
 * anyone else, and it says so, because it is a list of people who have not
 * agreed to anything yet.
 */

export const metadata: Metadata = { title: 'Invite batchmates' };

const STATE_TONE = { sent: 'brand', joined: 'success', expired: 'neutral' } as const;
const STATE_LABEL = { sent: 'Invited', joined: 'Joined', expired: 'Expired' } as const;

export default async function InvitePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!isActive(session)) redirect('/pending');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.invites) notFound();

  const origin = await siteOrigin();
  const batch = viewerBatchYear(session);
  const quota = getInviteQuota(session);
  const invitations = getMyInvitations(session);
  const years = getDegreeRegisterStats().byYear.map((y) => y.year).sort((a, b) => b - a);
  const timing = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };

  const generalUrl = `${origin}/`;
  const generalText = portalShareText(pack);
  const batchUrl = batch ? `${origin}/claim?year=${batch}` : null;
  const batchText = batch ? batchShareText(pack, batch) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your account"
        title="Invite batchmates"
        description="People you studied with who have not registered yet."
      />

      <Card>
        <CardHeader>
          <CardTitle as="h2">Send them the link</CardTitle>
        </CardHeader>
        <CardBody className="space-y-5">
          <p className="text-sm text-secondary">
            The fastest way is a message in your batch group. The link opens registration, where they match themselves against the college’s records.
          </p>
          {batchUrl && batchText ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Your batch, the class of {batch}</p>
              <ShareActions url={batchUrl} whatsappHref={whatsappShareUrl(batchText, batchUrl)} title={`Class of ${batch}`} />
            </div>
          ) : null}
          <div className="space-y-2">
            <p className="text-sm font-medium">Anyone</p>
            <ShareActions url={generalUrl} whatsappHref={whatsappShareUrl(generalText, generalUrl)} title={pack.copy.portalName} />
          </div>
        </CardBody>
      </Card>

      <InviteForm years={years} remaining={quota.remaining} defaultBatch={batch} />

      <section aria-labelledby="mine-heading" className="space-y-3">
        <h2 id="mine-heading" className="font-display text-xl font-semibold">
          Your invitations
        </h2>
        <p className="text-sm text-secondary">
          Only you can see this list. It is not shared with the college, and an invitation expires after {INVITE_VALID_DAYS} days.
        </p>
        {invitations.length === 0 ? (
          <EmptyState variant="inline" title="You have not invited anyone by email yet" description="Invitations you send appear here, and change to Joined when the person registers." />
        ) : (
          <TableWrap caption="Your invitations">
            <Table>
              <THead>
                <TR>
                  <TH>Who</TH>
                  <TH>Batch</TH>
                  <TH>Status</TH>
                  <TH>Sent</TH>
                </TR>
              </THead>
              <TBody>
                {invitations.map((i) => (
                  <TR key={i.id}>
                    <TD>
                      <p className="font-medium">{i.name ?? 'No name given'}</p>
                      <p className="break-all text-xs text-secondary">{i.email}</p>
                    </TD>
                    <TD className="tabular text-sm">{i.batchYear ?? '—'}</TD>
                    <TD>
                      <Badge tone={STATE_TONE[i.state]} dot={i.state === 'joined'}>
                        {STATE_LABEL[i.state]}
                      </Badge>
                    </TD>
                    <TD className="whitespace-nowrap text-sm text-secondary">{formatRelative(i.createdAt, timing)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </section>
    </div>
  );
}
