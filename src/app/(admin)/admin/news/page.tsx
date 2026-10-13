import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { BellOff, Eye, Newspaper, PenLine } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getNews, type NewsItem } from '@/lib/data/content';
import { getDepartments } from '@/lib/data/repo';
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  ChipNav,
  CopyButton,
  EmptyState,
  PageHeader,
  SegmentedNav,
  SummaryLine,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { StoryCard } from '@/components/content';
import { daysUntil, formatDate } from '@/lib/format';
import { siteOrigin } from '@/lib/share';
import { storyShareText } from '@/lib/share-text';
import { KIND_ICON, KIND_META, PINNED_CAP } from './kinds';

/**
 * The news desk.
 *
 * Every item is here, drafts included — this is the only surface in the
 * portal where `includeDrafts` is passed, and the member routes are
 * written so that they could not pass it by accident.
 *
 * The list is the feed as members see it, so the desk judges a story by
 * the card it will actually become. A compact table stays one toggle away.
 */

export const metadata = { title: 'News · Staff console' };

type Show = 'all' | 'published' | 'drafts';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.news) notFound();

  // Publishing a story addresses a segment of the membership, so it sits
  // behind the same capability as a segmented broadcast. An HOD who can
  // only mail their own branch does not get an editorial surface.
  requireCap(session, 'comms.send.segment');

  const params = await searchParams;
  const show: Show = ((v) => (v === 'published' || v === 'drafts' ? v : 'all'))(one(params.show));
  const table = one(params.view) === 'table';

  const all = getNews({ includeDrafts: true });
  const published = all.filter((n) => n.published);
  const drafts = all.filter((n) => !n.published);
  const pinned = published.filter((n) => n.pinned);
  const latest = published.filter((n) => !n.pinned);

  const departments = getDepartments();
  const deptName = (code: string | null) =>
    code ? (departments.find((d) => d.code === code)?.name ?? code) : 'Every branch';

  const tz = pack.locale.timeZone;
  const timing = { locale: pack.locale.locale, timeZone: tz };
  const origin = await siteOrigin();
  const shareFor = (n: NewsItem) => `${storyShareText(pack, n)} ${origin}/news/${n.slug}`;

  // `getNews` sorts pinned first, so the head of the list is not
  // necessarily the most recent thing the desk put out.
  const newest = published.reduce<NewsItem | null>(
    (latestSoFar, n) => (!latestSoFar || (n.publishedAt ?? '') > (latestSoFar.publishedAt ?? '') ? n : latestSoFar),
    null,
  );
  const quietDays = newest?.publishedAt ? -daysUntil(newest.publishedAt, tz) : null;

  const href = (patch: { show?: Show; table?: boolean }) => {
    const qs = new URLSearchParams();
    const s = patch.show ?? show;
    const t = patch.table ?? table;
    if (s !== 'all') qs.set('show', s);
    if (t) qs.set('view', 'table');
    const q = qs.toString();
    return q ? `/admin/news?${q}` : '/admin/news';
  };

  const tableRows = show === 'published' ? published : show === 'drafts' ? drafts : all;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="News"
        description="Stories on the member feed, and drafts still being written."
        actions={
          <ButtonLink href="/admin/news/new">
            <PenLine className="size-4" aria-hidden="true" />
            Write a story
          </ButtonLink>
        }
      />

      <SummaryLine
        items={[
          { value: published.length, label: 'live', href: href({ show: 'published' }) },
          quietDays === null
            ? { value: 0, label: 'stories yet' }
            : quietDays <= 0
              ? { value: 'Today', label: 'the last story went out' }
              : { value: `${quietDays} day${quietDays === 1 ? '' : 's'}`, label: 'since the last story' },
          { value: drafts.length, label: drafts.length === 1 ? 'draft' : 'drafts', href: href({ show: 'drafts' }) },
        ]}
      />

      {quietDays !== null && quietDays > 14 ? (
        <Alert tone="warning" title={`Nothing new for ${quietDays} days`}>
          <p>
            A quiet feed is one members stop opening.{' '}
            <Link href="/admin/news/new">Write a story</Link>
          </p>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ChipNav
          ariaLabel="Stories"
          items={[
            { label: 'All', href: href({ show: 'all' }), active: show === 'all' },
            { label: 'Published', href: href({ show: 'published' }), active: show === 'published', count: published.length },
            { label: 'Drafts', href: href({ show: 'drafts' }), active: show === 'drafts', count: drafts.length },
          ]}
        />
        <SegmentedNav
          className="hidden sm:inline-flex"
          items={[
            { label: 'Feed', href: href({ table: false }), active: !table },
            { label: 'Table', href: href({ table: true }), active: table },
          ]}
        />
      </div>

      {all.length === 0 ? (
        <EmptyState
          icon={<Newspaper className="size-5" />}
          title="The news desk is empty"
          description="Announcements, graduates’ achievements and press coverage all start here."
          action={
            <ButtonLink href="/admin/news/new" variant="secondary">
              Write the first one
            </ButtonLink>
          }
        />
      ) : table ? (
        <TableWrap caption="Stories with their kind, desk, date and state">
          <Table>
            <THead>
              <TR>
                <TH>Story</TH>
                <TH>Kind</TH>
                <TH>Desk</TH>
                <TH>Published</TH>
                <TH>State</TH>
              </TR>
            </THead>
            <TBody>
              {tableRows.map((item) => (
                <TR key={item.id}>
                  <TD>
                    <StoryTitle item={item} />
                    {item.pinned ? <p className="mt-0.5 text-xs text-secondary">Pinned</p> : null}
                  </TD>
                  <TD>
                    <KindCell item={item} />
                  </TD>
                  <TD>
                    <p className="text-sm">{item.author}</p>
                    <p className="text-xs text-secondary">{deptName(item.departmentCode)}</p>
                  </TD>
                  <TD className="whitespace-nowrap text-sm">
                    {item.publishedAt ? formatDate(item.publishedAt, timing) : <span className="text-secondary">Not yet</span>}
                  </TD>
                  <TD>
                    {item.published ? <Badge tone="success">Live</Badge> : <Badge tone="neutral">Draft</Badge>}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      ) : (
        <div className="space-y-6">
          {show !== 'drafts' && pinned.length > 0 ? (
            <FeedGroup title={`Pinned (${pinned.length} of ${PINNED_CAP})`}>
              {pinned.map((n) => (
                <StoryRow key={n.id} item={n} locale={pack.locale} share={shareFor(n)} />
              ))}
            </FeedGroup>
          ) : null}

          {show !== 'drafts' && latest.length > 0 ? (
            <FeedGroup title="Latest">
              {latest.map((n) => (
                <StoryRow key={n.id} item={n} locale={pack.locale} share={shareFor(n)} />
              ))}
            </FeedGroup>
          ) : null}

          {show !== 'published' ? (
            drafts.length > 0 ? (
              <FeedGroup title="Drafts" note="Members cannot see a draft until it is published.">
                {drafts.map((n) => (
                  <DraftRow key={n.id} item={n} />
                ))}
              </FeedGroup>
            ) : show === 'drafts' ? (
              <p className="text-sm text-secondary">No drafts. A story saved without publishing waits here.</p>
            ) : null
          ) : null}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Rows
// ---------------------------------------------------------------

function FeedGroup({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="space-y-2" aria-label={title}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold text-secondary">{title}</h2>
        {note ? <p className="text-sm text-secondary">{note}</p> : null}
      </div>
      <Card>
        <ul className="divide-y divide-line">{children}</ul>
      </Card>
    </section>
  );
}

function Eyebrow({ item }: { item: NewsItem }) {
  const meta = KIND_META[item.kind];
  const Icon = KIND_ICON[item.kind];
  return (
    <>
      <Icon aria-hidden="true" />
      {meta.label}
      {!meta.notifies ? <span className="sr-only">, published without a notification</span> : null}
    </>
  );
}

function StoryRow({
  item,
  locale,
  share,
}: {
  item: NewsItem;
  locale: Parameters<typeof StoryCard>[0]['locale'];
  share: string;
}) {
  return (
    <li className="flex flex-col gap-1 px-4 sm:flex-row sm:items-center sm:gap-4">
      <StoryCard
        story={item}
        href={`/news/${item.slug}`}
        locale={locale}
        variant="row"
        eyebrow={<Eyebrow item={item} />}
        className="min-w-0 flex-1"
      />
      <div className="flex shrink-0 flex-wrap items-center gap-1 pb-3 sm:pb-0">
        <ButtonLink href={`/news/${item.slug}`} variant="ghost" size="sm" className="min-h-11 sm:min-h-0">
          <Eye className="size-4" aria-hidden="true" />
          View as member
        </ButtonLink>
        <CopyButton text={share} label="Copy for WhatsApp" copiedLabel="Copied for WhatsApp" variant="ghost" size="sm" />
      </div>
    </li>
  );
}

function DraftRow({ item }: { item: NewsItem }) {
  const meta = KIND_META[item.kind];
  const Icon = KIND_ICON[item.kind];
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex items-center gap-1.5 text-xs font-medium text-secondary">
          <Icon className="size-3.5" aria-hidden="true" />
          {meta.label} · {item.author}
        </p>
        <h3 className="font-semibold leading-snug">
          <StoryTitle item={item} />
        </h3>
      </div>
      <Badge tone="neutral">Draft</Badge>
    </li>
  );
}

/**
 * A draft has no member-facing address, so its title is not a link. An
 * admin clicking through to a 404 learns nothing except that the console
 * is unreliable.
 */
function StoryTitle({ item }: { item: NewsItem }) {
  if (!item.published) {
    return (
      <span className="font-semibold">
        {item.title}
        <span className="sr-only"> — draft, no member page</span>
      </span>
    );
  }

  return (
    <Link href={`/news/${item.slug}`} className="font-semibold hover:text-brand-fg hover:underline">
      {item.title}
    </Link>
  );
}

function KindCell({ item }: { item: NewsItem }) {
  const meta = KIND_META[item.kind];
  return (
    <div className="space-y-0.5">
      <Badge tone={meta.tone}>{meta.label}</Badge>
      {!meta.notifies ? (
        <p className="flex items-center gap-1 text-xs text-secondary">
          <BellOff className="size-3" aria-hidden="true" />
          Not notified
        </p>
      ) : null}
    </div>
  );
}
