import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Info } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getPageBySlug } from '@/lib/data/pages';
import { plainText } from '@/lib/content/markdown';
import { excerpt } from '@/lib/community';
import { formatDate } from '@/lib/format';
import { Alert, ButtonLink } from '@/components/ui';
import { RichText } from '@/components/content';
import { PageHero } from '@/components/marketing/PageHero';

/**
 * A page the college wrote.
 *
 * About, a director's message, community guidelines: whatever the alumni
 * cell puts in the console, at `/p/<address>`. Two audiences.
 *
 *  - **Public** pages read like About. Anyone can open them.
 *  - **Members-only** pages are for signed-in, active members. A visitor
 *    who is not signed in is sent to sign in and brought back, and that is
 *    the answer for an address that does not exist too, so the sign-in
 *    redirect cannot be used to find out which members-only pages exist.
 *
 * A draft is visible to the people who edit pages, with a banner saying so,
 * and to nobody else.
 */

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const session = await getSession();
  const page = getPageBySlug(session, slug);
  if (!page) return { title: 'Page' };
  return {
    title: page.title,
    description: excerpt(plainText(page.body), 155) || undefined,
    // A members-only page has no business in a search index.
    robots: page.audience === 'members' ? { index: false, follow: false } : undefined,
  };
}

export default async function CollegePage({ params }: Params) {
  const { slug } = await params;

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.pages) notFound();

  const session = await getSession();
  const page = getPageBySlug(session, slug);

  if (!page) {
    if (!session) redirect(`/login?next=${encodeURIComponent(`/p/${slug}`)}`);
    notFound();
  }

  const editor = Boolean(session && can(session, 'page.manage'));

  return (
    <>
      <PageHero id="page-title" eyebrow={pack.copy.institutionName} title={page.title} glyph={pack.copy.shortName} />

      <div className="page-shell py-10 md:py-14">
        <div className="max-w-prose space-y-6">
          {!page.published ? (
            <Alert tone="neutral" icon={<Info className="size-4 text-brand-fg" />} title="This page is a draft">
              Only people who edit the college&apos;s pages can see it. Publish it from the staff console when it is ready.
            </Alert>
          ) : null}

          {page.audience === 'members' ? (
            <p className="text-sm text-secondary">For members of the network. Signed-in members only.</p>
          ) : null}

          <article aria-labelledby="page-title">
            <RichText source={page.body} />
          </article>

          <p className="text-sm text-secondary">
            Last updated {formatDate(page.updatedAt, { locale: pack.locale.locale, timeZone: pack.locale.timeZone })}
          </p>

          {editor ? (
            <ButtonLink href={`/admin/pages/${page.slug}`} variant="secondary" className="min-h-11">
              Edit this page
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </>
  );
}
