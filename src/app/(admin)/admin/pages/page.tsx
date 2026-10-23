import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { FilePlus2, FileText } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getAllPages } from '@/lib/data/pages';
import { plainText } from '@/lib/content/markdown';
import { excerpt } from '@/lib/community';
import { formatDate } from '@/lib/format';
import {
  Badge,
  ButtonLink,
  EmptyState,
  PageHeader,
  SummaryLine,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';

/**
 * The college's own pages.
 *
 * About, a director's message, community guidelines: written here by the
 * alumni cell, read by members (or by anyone, for a public page). The list
 * is drafts first, because a draft is a page somebody meant to finish.
 */

export const metadata = { title: 'Pages · Staff console' };

export default async function AdminPagesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.pages) notFound();

  requireCap(session, 'page.manage');

  const pages = getAllPages(session);
  const drafts = pages.filter((p) => !p.published);
  const live = pages.filter((p) => p.published);
  const ordered = [...drafts, ...live];
  const timing = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Pages"
        description="Pages the college writes itself, public or for members only."
        actions={
          <ButtonLink href="/admin/pages/new">
            <FilePlus2 className="size-4" aria-hidden="true" />
            New page
          </ButtonLink>
        }
      />

      {pages.length > 0 ? (
        <SummaryLine
          items={[
            { value: live.length, label: live.length === 1 ? 'page live' : 'pages live' },
            { value: drafts.length, label: drafts.length === 1 ? 'draft' : 'drafts', tone: drafts.length > 0 ? 'attention' : undefined },
          ]}
        />
      ) : null}

      {pages.length === 0 ? (
        <EmptyState
          variant="panel"
          icon={<FileText className="size-5" />}
          title="No pages yet"
          description="A short About page and a note from the Director are the two most members look for."
          action={
            <ButtonLink href="/admin/pages/new" variant="secondary">
              Write the first page
            </ButtonLink>
          }
        />
      ) : (
        <TableWrap caption="The college’s pages">
          <Table>
            <THead>
              <TR>
                <TH>Page</TH>
                <TH>Who can read it</TH>
                <TH>Status</TH>
                <TH>Updated</TH>
              </TR>
            </THead>
            <TBody>
              {ordered.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link href={`/admin/pages/${p.slug}`} className="link font-medium">
                      {p.title}
                    </Link>
                    <p className="mt-0.5 line-clamp-1 text-xs text-secondary">{excerpt(plainText(p.body), 110)}</p>
                    <p className="mt-0.5 font-mono text-xs text-secondary">/p/{p.slug}</p>
                  </TD>
                  <TD>
                    <Badge tone={p.audience === 'public' ? 'brand' : 'accent'}>
                      {p.audience === 'public' ? 'Anyone' : 'Members only'}
                    </Badge>
                    {p.showInFooter ? <p className="mt-1 text-xs text-secondary">In the public footer</p> : null}
                  </TD>
                  <TD>
                    {p.published ? <Badge tone="success" dot>Published</Badge> : <Badge tone="neutral">Draft</Badge>}
                  </TD>
                  <TD className="whitespace-nowrap text-sm text-secondary">
                    {formatDate(p.updatedAt, timing)}
                    {p.updatedBy ? <span className="block text-xs">{p.updatedBy}</span> : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </div>
  );
}
