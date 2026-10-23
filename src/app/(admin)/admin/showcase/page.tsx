import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Award } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getPendingShowcase, getShowcaseForCurator } from '@/lib/data/showcase';
import { SHOWCASE_STATE_LABELS, showcaseCategoryLabel, showcaseKindLabel } from '@/lib/community';
import { formatDate } from '@/lib/format';
import { Badge, ButtonLink, Card, CardBody, EmptyState, PageHeader, SummaryLine, Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui';
import { DecisionActions } from '@/components/community/DecisionActions';

/**
 * The showcase, for the people who curate it.
 *
 * Submissions first, in full, with the decision under each: a curator should
 * be able to judge an entry without opening it. Then every entry in a table
 * for lookup. Nothing here edits a member's words; the two choices on a
 * submission are publish it or say what is missing.
 */

export const metadata = { title: 'Showcase · Staff console' };

const TONE = { published: 'success', pending_moderation: 'warning', rejected: 'danger' } as const;

export default async function AdminShowcasePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.showcase) notFound();

  requireCap(session, 'showcase.manage');

  const pending = getPendingShowcase(session);
  const all = getShowcaseForCurator(session);
  const live = all.filter((e) => e.state === 'published').length;
  const timing = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Engagement"
        title="Showcase"
        description="Prominent alumni, achievements and success stories."
        actions={<ButtonLink href="/admin/showcase/new">Add an entry</ButtonLink>}
      />

      <SummaryLine
        items={[
          ...(pending.length > 0 ? [{ value: pending.length, label: pending.length === 1 ? 'submission waiting' : 'submissions waiting', href: '#waiting', tone: 'attention' as const }] : []),
          { value: live, label: live === 1 ? 'entry live' : 'entries live' },
        ]}
      />

      {pending.length > 0 ? (
        <section id="waiting" aria-labelledby="waiting-heading" className="scroll-mt-20 space-y-3">
          <h2 id="waiting-heading" className="font-display text-xl font-semibold">
            Waiting for review
          </h2>
          {pending.map((e) => (
            <Card key={e.id}>
              <CardBody className="space-y-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="accent">{showcaseCategoryLabel(e.category)}</Badge>
                    <Badge tone="outline">{showcaseKindLabel(e.kind)}</Badge>
                  </div>
                  <h3 className="font-display text-lg font-semibold">
                    <Link href={`/showcase/${e.slug}`} className="link-quiet">
                      {e.headline}
                    </Link>
                  </h3>
                  <p className="text-sm text-secondary">
                    Sent by {e.displayName}
                    {e.batchYear ? `, batch of ${e.batchYear}` : ''}
                    {e.achievedOn ? ` · ${formatDate(e.achievedOn, timing)}` : ''}
                  </p>
                </div>
                <p className="max-w-prose text-sm text-secondary">{e.summary}</p>
                <DecisionActions
                  endpoint={`/api/admin/showcase/${e.slug}`}
                  subject={e.headline}
                  recipient={e.member?.fullName.split(/\s+/)[0] ?? 'the member'}
                  approveLabel="Approve and publish"
                  quickReasons={[
                    { label: 'Needs a source', text: 'We cannot publish a claim like this without a source. Resubmit with a link to where it was announced, or the name of the award and who gave it.' },
                    { label: 'Too vague', text: 'There is not enough here to publish. Say specifically what was achieved, when, and who gave the recognition, and resubmit.' },
                  ]}
                />
              </CardBody>
            </Card>
          ))}
        </section>
      ) : null}

      {all.length === 0 ? (
        <EmptyState
          variant="panel"
          icon={<Award className="size-5" />}
          title="The showcase is empty"
          description="Add a prominent alumnus, an achievement or a success story, or wait for members to send their own."
          action={
            <ButtonLink href="/admin/showcase/new" variant="secondary">
              Add the first entry
            </ButtonLink>
          }
        />
      ) : (
        <TableWrap caption="Every showcase entry">
          <Table>
            <THead>
              <TR>
                <TH>Entry</TH>
                <TH>Kind</TH>
                <TH>Status</TH>
                <TH>Added</TH>
              </TR>
            </THead>
            <TBody>
              {all.map((e) => (
                <TR key={e.id}>
                  <TD>
                    <Link href={`/showcase/${e.slug}`} className="link font-medium">
                      {e.headline}
                    </Link>
                    <p className="text-xs text-secondary">{e.displayName}</p>
                  </TD>
                  <TD className="text-sm">
                    {showcaseKindLabel(e.kind)}
                    <span className="block text-xs text-secondary">{showcaseCategoryLabel(e.category)}</span>
                  </TD>
                  <TD>
                    <Badge tone={TONE[e.state]}>{SHOWCASE_STATE_LABELS[e.state]}</Badge>
                  </TD>
                  <TD className="whitespace-nowrap text-sm text-secondary">{formatDate(e.createdAt, timing)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </div>
  );
}
