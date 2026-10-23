import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ExternalLink } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, isActive } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getShowcaseBySlug } from '@/lib/data/showcase';
import { SHOWCASE_STATE_LABELS, showcaseCategoryLabel, showcaseKindLabel } from '@/lib/community';
import { formatDate, memberLine } from '@/lib/format';
import { Alert, Avatar, Badge, Breadcrumbs, Card, CardBody, CardHeader, CardTitle, PageHeader } from '@/components/ui';
import { DecisionActions } from '@/components/community/DecisionActions';
import { UnpublishEntry } from '@/components/community/UnpublishEntry';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const session = await getSession();
  const entry = session ? getShowcaseBySlug(session, slug) : null;
  return { title: entry ? entry.headline : 'Entry not found' };
}

/**
 * One showcase entry.
 *
 * The page for a person is also the page where they can see exactly what is
 * said about them: the entry is theirs to read, and a submission awaiting
 * review shows its reviewer's note to them. A curator sees the decision
 * controls here, and the take-down for a published entry.
 */

export default async function ShowcaseEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!isActive(session)) redirect('/pending');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.showcase) notFound();

  const { slug } = await params;
  const e = getShowcaseBySlug(session, slug);
  if (!e) notFound();

  const curator = can(session, 'showcase.manage');
  const mine = e.member?.id === session.memberId;
  const timing = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };
  const paragraphs = (e.story ?? '').split(/\n{2,}/).filter(Boolean);
  const line = memberLine([e.batchYear ? `Batch of ${e.batchYear}` : null, e.departmentCode]);
  const canOpenProfile = e.member && pack.features.directory && !e.member.isStudent;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: 'Showcase', href: '/showcase' }, { label: e.displayName }]} />}
        eyebrow={`${showcaseKindLabel(e.kind)} · ${showcaseCategoryLabel(e.category)}`}
        title={e.headline}
        meta={e.state !== 'published' ? <Badge tone={e.state === 'rejected' ? 'danger' : 'warning'}>{SHOWCASE_STATE_LABELS[e.state]}</Badge> : undefined}
      />

      {e.state !== 'published' ? (
        <Alert tone={e.state === 'rejected' ? 'warning' : 'neutral'} title={e.state === 'rejected' ? 'Not published' : 'Waiting for review'}>
          {e.state === 'rejected' && e.moderationNote ? <p>{e.moderationNote}</p> : <p>Only you and the people who curate the showcase can see this until it is published.</p>}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article className="min-w-0 space-y-5">
          <p className="max-w-prose text-lg leading-relaxed text-primary">{e.summary}</p>

          {paragraphs.length > 0 ? (
            <div className="max-w-prose space-y-4 text-md leading-relaxed text-secondary">
              {paragraphs.map((p, i) => (
                <p key={i} className="whitespace-pre-line break-words">
                  {p}
                </p>
              ))}
            </div>
          ) : null}

          {e.sourceUrl ? (
            <p className="text-sm">
              <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer nofollow ugc" className="link inline-flex min-h-11 items-center gap-1.5">
                Where this was published
                <ExternalLink className="size-3.5" aria-hidden="true" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </p>
          ) : null}
        </article>

        <aside aria-label="About this entry" className="min-w-0 space-y-4">
          <Card>
            <CardBody className="space-y-3">
              <div className="flex items-start gap-3">
                <Avatar name={e.displayName} src={e.member?.photoUrl ?? undefined} size="lg" />
                <div className="min-w-0">
                  {canOpenProfile ? (
                    <Link href={`/directory/${e.member!.slug}`} className="link-quiet font-semibold">
                      {e.displayName}
                    </Link>
                  ) : (
                    <p className="font-semibold">{e.displayName}</p>
                  )}
                  {line ? <p className="text-sm text-secondary">{line}</p> : null}
                </div>
              </div>
              {e.achievedOn ? <p className="text-sm text-secondary">{formatDate(e.achievedOn, timing)}</p> : null}
              {mine ? <p className="text-sm text-secondary">This is about you. To have it taken down, write to the {pack.copy.officeName} and it comes down at once.</p> : null}
            </CardBody>
          </Card>

          {curator && e.state === 'pending_moderation' ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2" className="text-md">
                  Your decision
                </CardTitle>
              </CardHeader>
              <CardBody>
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
          ) : null}

          {curator && e.state === 'published' ? (
            <Card>
              <CardBody className="space-y-2">
                <p className="text-sm text-secondary">Somebody asked to be removed, or something here is wrong.</p>
                <UnpublishEntry slug={e.slug} headline={e.headline} />
              </CardBody>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
