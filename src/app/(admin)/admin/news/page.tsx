import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { BellOff, FileText, Newspaper, PenLine, Pin, Send } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getNews, type NewsItem } from '@/lib/data/content';
import { getDepartments } from '@/lib/data/repo';
import {
  Alert,
  Badge,
  ButtonLink,
  DefinitionCard,
  EmptyState,
  PageHeader,
  Stat,
  Table,
  TableWrap,
  Tabs,
  TBody,
  TD,
  TH,
  THead,
  TR,
  type TabItem,
} from '@/components/ui';
import { MarginNote } from '@/components/brand/Marks';
import { formatDate, formatRelative, memberLine } from '@/lib/format';
import { KIND_META } from './kinds';

/**
 * The news desk.
 *
 * Every item is here, drafts included — this is the only surface in the
 * portal where `includeDrafts` is passed, and the member routes are
 * written so that they could not pass it by accident.
 *
 * The console owes the desk two facts on every row: whether members can
 * see it, and whether publishing it would send anything. They are not the
 * same question, and the second one is the reason an obituary is treated
 * differently from everything else here.
 */

export const metadata = { title: 'News' };

type View = 'all' | 'published' | 'drafts' | 'pinned';

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
  const view: View = ((v) =>
    v === 'published' || v === 'drafts' || v === 'pinned' ? v : 'all')(one(params.view));

  const all = getNews({ includeDrafts: true });
  const published = all.filter((n) => n.published);
  const drafts = all.filter((n) => !n.published);
  const pinned = all.filter((n) => n.pinned);

  const rows =
    view === 'published' ? published : view === 'drafts' ? drafts : view === 'pinned' ? pinned : all;

  const departments = getDepartments();
  const deptName = (code: string | null) =>
    code ? (departments.find((d) => d.code === code)?.name ?? code) : 'Every branch';

  // `getNews` sorts pinned first, so the head of the list is not
  // necessarily the most recent thing the desk put out.
  const newest = published.reduce<NewsItem | null>(
    (latest, n) => (!latest || (n.publishedAt ?? '') > (latest.publishedAt ?? '') ? n : latest),
    null,
  );
  const notNotified = published.filter((n) => !KIND_META[n.kind].notifies).length;

  const tabs: TabItem[] = [
    { label: 'Everything', href: '/admin/news?view=all', count: all.length, active: view === 'all' },
    {
      label: 'Published',
      href: '/admin/news?view=published',
      count: published.length,
      active: view === 'published',
    },
    { label: 'Drafts', href: '/admin/news?view=drafts', count: drafts.length, active: view === 'drafts' },
    { label: 'Pinned', href: '/admin/news?view=pinned', count: pinned.length, active: view === 'pinned' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="News"
        description="Everything the college has published to the member feed, and everything still being written. A draft has no page for members — not a locked one, not an empty one."
        actions={
          <ButtonLink href="/admin/news/new">
            <PenLine className="size-4" aria-hidden="true" />
            Write a story
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Published"
          value={published.length}
          hint={newest ? `Latest ${formatRelative(newest.publishedAt)}` : 'Nothing on the feed yet'}
          icon={<Newspaper className="size-4" />}
        />
        <Stat
          label="Drafts"
          value={drafts.length}
          hint={drafts.length ? 'Visible on this screen only' : 'Nothing part-written'}
          icon={<FileText className="size-4" />}
        />
        <Stat
          label="Pinned"
          value={pinned.length}
          hint={pinned.length ? 'Held at the top of the member feed' : 'The feed is in date order'}
          icon={<Pin className="size-4" />}
        />
        <Stat
          label="Published without notice"
          value={notNotified}
          hint="Obituaries. Never pushed, by rule"
          icon={<BellOff className="size-4" />}
        />
      </div>

      <Alert tone="info" title="What publishing does" icon={<Send className="size-4" />}>
        <p>
          A published story appears on the member feed immediately and members are notified —
          {pack.features.whatsapp ? ' by WhatsApp and email' : ' by email'}, on the schedule the
          communications settings define. One exception, and it is not configurable:{' '}
          <strong className="font-semibold">an obituary is never sent as a notification.</strong> It
          goes on the page and is found by people who open the portal. A death notice arriving as a
          push on somebody&rsquo;s phone is a thing a college is remembered for.
        </p>
      </Alert>

      <Tabs items={tabs} ariaLabel="News lists" />

      {view === 'drafts' && drafts.length > 0 ? (
        <Alert tone="warning" title="These stories do not exist as far as members are concerned">
          <p>
            A draft is absent from the feed, has no story page and appears in no notification. It
            becomes real the moment you publish it, so check the names and the figures first — a
            correction published later does not reach the people who read the first version.
          </p>
        </Alert>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={<Newspaper className="size-5" />}
          title={
            view === 'drafts'
              ? 'No drafts'
              : view === 'pinned'
                ? 'Nothing is pinned'
                : view === 'published'
                  ? 'Nothing published yet'
                  : 'The news desk is empty'
          }
          description={
            view === 'drafts'
              ? 'Anything saved without publishing waits here. Use a draft when the facts are still being confirmed — a placement figure before the cell has closed the season, for instance.'
              : view === 'pinned'
                ? 'Pinned stories sit above the rest of the feed until you unpin them. Registration for the annual meet is the usual candidate; two pinned at once is already too many.'
                : 'Announcements, graduates’ achievements, what the network has funded and press coverage all start here.'
          }
          action={
            view !== 'pinned' ? (
              <ButtonLink href="/admin/news/new" variant="secondary">
                Write the first one
              </ButtonLink>
            ) : null
          }
        />
      ) : (
        <>
          <TableWrap
            caption="News items with their kind, author, publication date and state"
            className="hidden sm:block"
          >
            <Table>
              <THead>
                <TR>
                  <TH>Story</TH>
                  <TH>Kind</TH>
                  <TH>Author</TH>
                  <TH>Published</TH>
                  <TH>Pinned</TH>
                  <TH>State</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((item) => (
                  <TR key={item.id} interactive className={item.published ? undefined : 'bg-surface-sunken'}>
                    <TD>
                      <StoryTitle item={item} />
                      <p className="mt-0.5 font-mono text-xs text-muted">/news/{item.slug}</p>
                    </TD>
                    <TD>
                      <KindCell item={item} />
                    </TD>
                    <TD>
                      <p className="text-sm">{item.author}</p>
                      <p className="text-xs text-muted">{deptName(item.departmentCode)}</p>
                    </TD>
                    <TD className="whitespace-nowrap">
                      {item.publishedAt ? (
                        <>
                          <p className="text-sm">{formatDate(item.publishedAt)}</p>
                          <p className="text-xs text-muted">{formatRelative(item.publishedAt)}</p>
                        </>
                      ) : (
                        <span className="text-sm text-muted">Not published</span>
                      )}
                    </TD>
                    <TD>
                      {item.pinned ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                          <Pin className="size-3.5 text-muted" aria-hidden="true" />
                          Pinned
                        </span>
                      ) : (
                        <span className="text-sm text-muted">—</span>
                      )}
                    </TD>
                    <TD>
                      <StateBadge item={item} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>

          {/* Below sm a six-column table is unreadable however it scrolls. */}
          <div className="space-y-3 sm:hidden">
            {rows.map((item) => (
              <DefinitionCard
                key={item.id}
                title={<StoryTitle item={item} />}
                subtitle={memberLine([item.author, deptName(item.departmentCode)])}
                rows={[
                  { label: 'Kind', value: <KindCell item={item} /> },
                  {
                    label: 'Published',
                    value: item.publishedAt ? formatDate(item.publishedAt) : 'Not published',
                  },
                  { label: 'Pinned', value: item.pinned ? 'Yes' : 'No' },
                  { label: 'State', value: <StateBadge item={item} /> },
                ]}
                actions={
                  item.published ? (
                    <ButtonLink href={`/news/${item.slug}`} variant="secondary" size="sm">
                      Read it as a member
                    </ButtonLink>
                  ) : null
                }
              />
            ))}
          </div>
        </>
      )}

      <MarginNote className="max-w-prose border-t border-line pt-4">
        Editing and unpublishing are not wired in this build — the composer validates and confirms,
        then stops short of writing. When it is connected, every change here will land in the audit
        log with the before and after, because &ldquo;who changed that figure&rdquo; is the first
        question anybody asks about a published number.
      </MarginNote>
    </div>
  );
}

// ---------------------------------------------------------------
// Cells
// ---------------------------------------------------------------

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
        <p className="flex items-center gap-1 text-xs text-muted">
          <BellOff className="size-3" aria-hidden="true" />
          Not notified
        </p>
      ) : null}
    </div>
  );
}

function StateBadge({ item }: { item: NewsItem }) {
  if (!item.published) {
    return (
      <Badge tone="warning" dot>
        Draft — not visible to members
      </Badge>
    );
  }
  return (
    <Badge tone="success" dot>
      Published
    </Badge>
  );
}
