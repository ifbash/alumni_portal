import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Store } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getBusinesses } from '@/lib/data/businesses';
import { BUSINESS_STATE_LABELS } from '@/lib/community';
import { formatDate, memberLine } from '@/lib/format';
import { Badge, Card, CardBody, EmptyState, PageHeader, SummaryLine, Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui';
import { Linkified } from '@/components/community/Linkified';
import { DecisionActions } from '@/components/community/DecisionActions';

/**
 * Business listings, for the people who review them.
 *
 * What is waiting comes first, in full, with the decision under it: a
 * moderator should not have to open each listing to judge it. Everything
 * else is a table underneath for lookup. The moderator reads the listing
 * exactly as the owner wrote it and cannot change a word of it; the two
 * choices are approve it or say what to fix.
 */

export const metadata = { title: 'Businesses · Staff console' };

const TONE = { live: 'success', pending_moderation: 'warning', rejected: 'danger', closed: 'neutral' } as const;

export default async function AdminBusinessesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.businesses) notFound();

  requireCap(session, 'business.moderate');

  const all = getBusinesses(session, { status: 'all', perPage: 50 }).items;
  const waiting = all.filter((b) => b.status === 'pending_moderation');
  const live = all.filter((b) => b.status === 'live').length;
  const timing = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Engagement" title="Businesses" description="Listings members have sent in, and what is in the directory." />

      <SummaryLine
        items={[
          ...(waiting.length > 0 ? [{ value: waiting.length, label: waiting.length === 1 ? 'listing waiting for review' : 'listings waiting for review', href: '#waiting', tone: 'attention' as const }] : []),
          { value: live, label: live === 1 ? 'listed' : 'listed in the directory' },
        ]}
      />

      {waiting.length > 0 ? (
        <section id="waiting" aria-labelledby="waiting-heading" className="scroll-mt-20 space-y-3">
          <h2 id="waiting-heading" className="font-display text-xl font-semibold">
            Waiting for review
          </h2>
          {waiting.map((b) => (
            <Card key={b.id} id={`biz-${b.slug}`}>
              <CardBody className="space-y-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="outline">{b.industry}</Badge>
                    <span className="text-sm text-secondary">{memberLine([b.city, b.country])}</span>
                  </div>
                  <h3 className="font-display text-lg font-semibold">
                    <Link href={`/businesses/${b.slug}`} className="link-quiet">
                      {b.name}
                    </Link>
                  </h3>
                  <p className="text-sm text-secondary">
                    Sent by {b.owner.fullName}
                    {b.owner.batchYear ? `, batch of ${b.owner.batchYear}` : ''}
                    {b.website ? <> · <span className="break-all">{b.website}</span></> : null}
                  </p>
                </div>
                <Linkified text={b.description} className="max-w-prose text-sm text-secondary whitespace-pre-line break-words" />
                {b.products.length + b.services.length > 0 ? (
                  <p className="text-sm text-secondary">
                    <span className="font-medium text-primary">Offers:</span> {[...b.products, ...b.services].join(', ')}
                  </p>
                ) : null}
                <p className="text-sm text-secondary">
                  {b.contactShared ? 'The owner wants contact details shown to alumni.' : 'The owner is not sharing contact details.'}
                </p>
                <DecisionActions
                  endpoint={`/api/admin/businesses/${b.slug}`}
                  subject={b.name}
                  recipient={b.owner.fullName.split(/\s+/)[0] ?? 'the owner'}
                  approveLabel="Approve listing"
                  quickReasons={[
                    { label: 'Promised returns', text: 'A listing cannot promise returns. Resubmit describing what the business does and sells, with its registration or licence number if it has one.' },
                    { label: 'Too little detail', text: 'There is not enough here for a member to decide whether to get in touch. Say what you sell, who it is for and where you work, and resubmit.' },
                  ]}
                />
              </CardBody>
            </Card>
          ))}
        </section>
      ) : null}

      {all.length === 0 ? (
        <EmptyState variant="panel" icon={<Store className="size-5" />} title="No listings yet" description="When an alumnus lists a business it appears here for review." />
      ) : (
        <section aria-labelledby="all-heading" className="space-y-3">
          <h2 id="all-heading" className="sr-only">
            Every listing
          </h2>
          <TableWrap caption="Every business listing">
            <Table>
              <THead>
                <TR>
                  <TH>Business</TH>
                  <TH>Owner</TH>
                  <TH>Status</TH>
                  <TH>Sent</TH>
                </TR>
              </THead>
              <TBody>
                {all.map((b) => (
                  <TR key={b.id}>
                    <TD>
                      <Link href={`/businesses/${b.slug}`} className="link font-medium">
                        {b.name}
                      </Link>
                      <p className="text-xs text-secondary">{b.industry}</p>
                    </TD>
                    <TD className="text-sm">{b.owner.fullName}</TD>
                    <TD>
                      <Badge tone={TONE[b.status]}>{BUSINESS_STATE_LABELS[b.status]}</Badge>
                    </TD>
                    <TD className="whitespace-nowrap text-sm text-secondary">{formatDate(b.createdAt, timing)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </section>
      )}
    </div>
  );
}
