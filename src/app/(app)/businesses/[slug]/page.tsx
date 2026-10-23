import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Globe, Mail, MapPin, Phone } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, isActive } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getBusinessBySlug } from '@/lib/data/businesses';
import { BUSINESS_STATE_LABELS } from '@/lib/community';
import { memberLine } from '@/lib/format';
import { Alert, Avatar, Badge, Breadcrumbs, ButtonLink, Card, CardBody, CardHeader, CardTitle, PageHeader } from '@/components/ui';
import { Linkified } from '@/components/community/Linkified';
import { CloseListingButton } from '@/components/community/CloseListingButton';
import { DecisionActions } from '@/components/community/DecisionActions';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const session = await getSession();
  const business = session ? getBusinessBySlug(session, slug) : null;
  return { title: business ? business.name : 'Business not found' };
}

/**
 * One business.
 *
 * Contact details are the one part of this page governed by a rule rather
 * than by the listing: both gates (the viewer is not a student, and the
 * owner chose to share) are applied in `getBusinessBySlug()`, and this page
 * only draws what comes back. When there is nothing to draw it says why, in
 * the words that fit the reason, because "no contact details" with no reason
 * reads as a broken page.
 */

export default async function BusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!isActive(session)) redirect('/pending');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.businesses) notFound();

  const { slug } = await params;
  const b = getBusinessBySlug(session, slug);
  if (!b) notFound();

  const owns = b.owner.id === session.memberId;
  const moderator = can(session, 'business.moderate');
  const student = session.roles.some((r) => r.role === 'student');
  const place = memberLine([b.city, b.region, b.country && b.country !== 'IN' ? b.country : null]);
  const ownerLine = memberLine([b.owner.departmentCode, b.owner.batchYear ? `Batch of ${b.owner.batchYear}` : null, b.owner.designation]);
  const canOpenOwner = pack.features.directory && !b.owner.isStudent;
  const live = b.status === 'live';

  const contactNote = student
    ? 'Contact details on listings are for alumni.'
    : b.contactShared
      ? 'The owner shares contact details, but none are on file.'
      : 'The owner has not shared contact details here.';

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: 'Businesses', href: '/businesses' }, { label: b.name }]} />}
        eyebrow={b.industry}
        title={b.name}
        description={place || undefined}
        meta={!live ? <Badge tone={b.status === 'pending_moderation' ? 'warning' : b.status === 'rejected' ? 'danger' : 'neutral'}>{BUSINESS_STATE_LABELS[b.status]}</Badge> : undefined}
      />

      {(owns || moderator) && !live ? (
        <Alert
          tone={b.status === 'rejected' ? 'warning' : 'neutral'}
          title={b.status === 'pending_moderation' ? 'Waiting for review' : b.status === 'rejected' ? 'Not listed' : 'Closed'}
        >
          {b.status === 'pending_moderation' ? (
            <p>{owns ? 'The alumni cell is looking at this. It appears in the directory once it is approved.' : 'This listing is waiting for a decision.'}</p>
          ) : b.status === 'rejected' && b.moderationNote ? (
            <p>{b.moderationNote}</p>
          ) : (
            <p>It is not shown to other members.</p>
          )}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardBody className="space-y-4">
              <Linkified text={b.description} className="max-w-prose text-md leading-relaxed text-primary whitespace-pre-line break-words" />

              {b.products.length > 0 || b.services.length > 0 ? (
                <div className="grid gap-5 border-t border-line pt-4 sm:grid-cols-2">
                  {b.products.length > 0 ? (
                    <section aria-labelledby="products-h">
                      <h2 id="products-h" className="text-sm font-semibold">
                        Products
                      </h2>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-secondary marker:text-muted">
                        {b.products.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                  {b.services.length > 0 ? (
                    <section aria-labelledby="services-h">
                      <h2 id="services-h" className="text-sm font-semibold">
                        Services
                      </h2>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-secondary marker:text-muted">
                        {b.services.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </div>
              ) : null}
            </CardBody>
          </Card>

          {owns ? (
            <Card>
              <CardBody className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-secondary">This is your listing.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <ButtonLink href={`/businesses/${b.slug}/edit`} variant="secondary" className="min-h-11">
                    {b.status === 'rejected' ? 'Fix and resubmit' : 'Edit and resubmit'}
                  </ButtonLink>
                  {b.status !== 'closed' ? <CloseListingButton slug={b.slug} name={b.name} /> : null}
                </div>
              </CardBody>
            </Card>
          ) : null}

          {moderator && b.status === 'pending_moderation' ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Your decision</CardTitle>
              </CardHeader>
              <CardBody>
                <DecisionActions
                  endpoint={`/api/admin/businesses/${b.slug}`}
                  subject={b.name}
                  recipient={b.owner.fullName.split(/\s+/)[0] ?? 'the owner'}
                  approveLabel="Approve listing"
                  declineLabel="Decline"
                  quickReasons={[
                    { label: 'Promised returns', text: 'A listing cannot promise returns. Resubmit describing what the business does and sells, with its registration or licence number if it has one.' },
                    { label: 'Too little detail', text: 'There is not enough here for a member to decide whether to get in touch. Say what you sell, who it is for and where you work, and resubmit.' },
                  ]}
                />
              </CardBody>
            </Card>
          ) : null}
        </div>

        <aside aria-label="About the owner and how to reach them" className="min-w-0 space-y-4">
          <Card>
            <CardBody className="space-y-3">
              <h2 className="text-sm font-semibold">Run by</h2>
              <div className="flex items-start gap-3">
                <Avatar name={b.owner.fullName} src={b.owner.photoUrl ?? undefined} size="md" />
                <div className="min-w-0">
                  {canOpenOwner ? (
                    <Link href={`/directory/${b.owner.slug}`} className="link-quiet font-semibold">
                      {b.owner.fullName}
                    </Link>
                  ) : (
                    <span className="font-semibold">{b.owner.fullName}</span>
                  )}
                  {ownerLine ? <p className="text-sm text-secondary">{ownerLine}</p> : null}
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <h2 className="text-sm font-semibold">Get in touch</h2>
              {b.website ? (
                <ButtonLink href={b.website} target="_blank" rel="noopener noreferrer nofollow ugc" variant="secondary" className="min-h-11 w-full">
                  <Globe className="size-4" aria-hidden="true" />
                  Visit the website
                  <span className="sr-only"> (opens in a new tab)</span>
                </ButtonLink>
              ) : null}

              {b.contact ? (
                <ul className="space-y-2 text-sm">
                  {b.contact.email ? (
                    <li className="flex items-center gap-2">
                      <Mail className="size-4 shrink-0 text-muted" aria-hidden="true" />
                      <a href={`mailto:${b.contact.email}`} className="link break-all">
                        {b.contact.email}
                      </a>
                    </li>
                  ) : null}
                  {b.contact.phone ? (
                    <li className="flex items-center gap-2">
                      <Phone className="size-4 shrink-0 text-muted" aria-hidden="true" />
                      <a href={`tel:${b.contact.phone.replace(/[^\d+]/g, '')}`} className="link">
                        {b.contact.phone}
                      </a>
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className="text-sm text-secondary">
                  {contactNote}
                  {canOpenOwner && !student ? (
                    <>
                      {' '}
                      You can ask {b.owner.fullName.split(/\s+/)[0]} for an introduction from{' '}
                      <Link href={`/directory/${b.owner.slug}`} className="link">
                        their profile
                      </Link>
                      .
                    </>
                  ) : null}
                </p>
              )}
              {!b.website && !b.contact && !canOpenOwner ? <p className="flex items-start gap-2 text-sm text-secondary"><MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />{place || 'No address given.'}</p> : null}
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
