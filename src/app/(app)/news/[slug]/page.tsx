import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Building2, Pin, Users } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { can } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getNews, getNewsBySlug, type NewsItem } from '@/lib/data/content';
import { findMemberById, getDepartments, getMemberBySlug } from '@/lib/data/repo';
import {
  Avatar,
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardTitle,
  PageHeader,
  Section,
} from '@/components/ui';
import { formatDate, formatRelative, memberLine } from '@/lib/format';
import { cn } from '@/lib/cn';
import { KIND_META, newsHref } from '../kinds';

/**
 * One story.
 *
 * `getNewsBySlug` is called without `includeDrafts`, so an unpublished
 * item 404s here exactly as it would for a stranger — the admin console
 * is the only place a draft is addressable.
 *
 * The obituary branch is not styling for its own sake. A notice gets no
 * kind badge, no pinned marker, and no related-stories block full of
 * other people's good news; the two cases diverge in enough places that
 * `restrained` is checked rather than re-derived.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = getNewsBySlug(slug);

  if (!item) return { title: 'Story not found' };

  return {
    title: item.title,
    description: item.summary.slice(0, 180),
  };
}

export default async function NewsStoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.news) notFound();

  const { slug } = await params;
  const item = getNewsBySlug(slug);
  if (!item) notFound();

  const meta = KIND_META[item.kind];
  const Icon = meta.icon;

  const departments = getDepartments();
  const deptName = (code: string | null) =>
    code ? (departments.find((d) => d.code === code)?.name ?? code) : null;
  const departmentName = deptName(item.departmentCode);

  const canOpenDirectory = pack.features.directory && can(session, 'directory.search.alumni');

  /**
   * The member a story is about is resolved through the directory's own
   * rules, not read off the record. If this viewer could not find them by
   * searching, a news story does not become the way around it.
   */
  const aboutSeed = item.aboutMemberId ? findMemberById(item.aboutMemberId) : null;
  const aboutMember =
    aboutSeed && canOpenDirectory ? getMemberBySlug(session, aboutSeed.slug) : null;

  const paragraphs = item.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const related = relatedTo(item);
  // The heading has to describe the list that is actually there. A row of
  // announcements under "More milestones" is worse than no heading.
  const relatedTitle =
    departmentName && related.every((n) => n.departmentCode === item.departmentCode)
      ? `More from ${departmentName}`
      : related.every((n) => n.kind === item.kind)
        ? `More ${meta.tab.toLowerCase()}`
        : 'Elsewhere on the news page';

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: 'News', href: '/news' }, { label: item.title }]} />}
        eyebrow={meta.restrained ? meta.label : (departmentName ?? pack.copy.shortName)}
        title={item.title}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{item.author}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={item.publishedAt ?? undefined}>{formatDate(item.publishedAt)}</time>
            <span aria-hidden="true">·</span>
            <span>{formatRelative(item.publishedAt)}</span>
          </span>
        }
      />

      {/* A notice carries no badge row at all. Everything else is filed
          under a kind, and the kind is worth stating plainly. */}
      {!meta.restrained ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={meta.tone}>
            {Icon ? <Icon className="size-3" /> : null}
            {meta.label}
          </Badge>
          {item.pinned ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
              <Pin className="size-3" aria-hidden="true" />
              Pinned to the top of the feed
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_18rem]">
        <article className="min-w-0 space-y-6">
          <p
            className={cn(
              'max-w-prose border-l-2 border-line pl-4 text-md leading-relaxed',
              meta.restrained ? 'text-secondary' : 'font-medium text-primary',
            )}
          >
            {item.summary}
          </p>

          {/* Bodies are plain text with blank lines between paragraphs.
              `whitespace-pre-line` keeps the single breaks the author typed
              inside a paragraph instead of collapsing them into a run-on. */}
          {/* The restraint is in what is absent — badges, arrows, related
              cheer — not in shrinking the type. A notice still has to be
              comfortable to read. */}
          <div className="max-w-prose space-y-4 text-md leading-relaxed text-secondary">
            {paragraphs.length ? (
              paragraphs.map((p, i) => (
                <p key={i} className="whitespace-pre-line">
                  {p}
                </p>
              ))
            ) : (
              <p className="text-muted">
                Only the summary above was filed with this story. The desk that wrote it can add the
                rest.
              </p>
            )}
          </div>

          {aboutMember ? (
            <Card>
              <CardBody className="flex flex-wrap items-center gap-4">
                <Avatar name={aboutMember.fullName} src={aboutMember.photoUrl} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-md font-semibold">{aboutMember.fullName}</p>
                  <p className="text-sm text-secondary">
                    {memberLine([
                      aboutMember.departmentCode,
                      aboutMember.batchYear,
                      aboutMember.currentCompany,
                    ]) || 'No employer on record'}
                  </p>
                </div>
                <ButtonLink href={`/directory/${aboutMember.slug}`} variant="secondary" size="sm">
                  Open profile
                </ButtonLink>
              </CardBody>
            </Card>
          ) : null}

          {related.length > 0 ? (
            <Section
              title={relatedTitle}
              description={
                meta.restrained
                  ? 'The rest of what this department has published.'
                  : 'Chosen by branch first, then by the kind of story.'
              }
              className="border-t border-line pt-6"
            >
              <ul className="divide-y divide-line">
                {related.map((n) => (
                  <li key={n.id} className="py-3 first:pt-0 last:pb-0">
                    <RelatedRow item={n} departmentName={deptName(n.departmentCode)} />
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </article>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardBody className="space-y-3">
              <CardTitle as="h2" className="text-md">
                Filed by
              </CardTitle>
              <p className="text-sm">
                <span className="font-medium">{item.author}</span>
                <span className="block text-secondary">
                  {departmentName ?? 'Not tied to one branch'}
                </span>
              </p>
              <p className="text-xs text-muted">
                Published <time dateTime={item.publishedAt ?? undefined}>{formatDate(item.publishedAt)}</time>{' '}
                — {formatRelative(item.publishedAt)}. Corrections go to the desk that wrote it
                {pack.copy.supportEmail ? (
                  <>
                    {' '}
                    at{' '}
                    <a href={`mailto:${pack.copy.supportEmail}`} className="link">
                      {pack.copy.supportEmail}
                    </a>
                  </>
                ) : (
                  ', through the alumni cell'
                )}
                .
              </p>
            </CardBody>
          </Card>

          {item.departmentCode && canOpenDirectory ? (
            <Card>
              <CardBody className="space-y-3">
                <CardTitle as="h2" className="text-md">
                  <span className="flex items-center gap-2">
                    <Building2 className="size-4 text-muted" aria-hidden="true" />
                    {departmentName}
                  </span>
                </CardTitle>
                <p className="text-sm text-secondary">
                  {meta.restrained
                    ? `Graduates of the ${item.departmentCode} branch are listed in the directory.`
                    : `Everyone the college has verified out of ${item.departmentCode}, across every batch.`}
                </p>
                <ButtonLink
                  href={`/directory?department=${item.departmentCode}`}
                  variant="secondary"
                  size="sm"
                >
                  <Users className="size-4" aria-hidden="true" />
                  {item.departmentCode} in the directory
                </ButtonLink>
              </CardBody>
            </Card>
          ) : null}

          <ButtonLink href={newsHref(meta.restrained ? null : item.kind)} variant="ghost" size="sm">
            {meta.restrained ? 'Back to news' : `All ${meta.tab.toLowerCase()}`}
          </ButtonLink>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Related
// ---------------------------------------------------------------

/**
 * Related stories, department first and kind second.
 *
 * One rule overrides both: a notice is never offered as further reading
 * under somebody's promotion, and nothing cheerful is offered under a
 * notice. Under an obituary the only thing shown is the rest of that
 * department's news, and where the notice names no department, nothing at
 * all.
 */
function relatedTo(item: NewsItem): NewsItem[] {
  const pool = getNews().filter((n) => n.slug !== item.slug);

  if (KIND_META[item.kind].restrained) {
    if (!item.departmentCode) return [];
    return pool.filter((n) => n.departmentCode === item.departmentCode).slice(0, 3);
  }

  const eligible = pool.filter((n) => !KIND_META[n.kind].restrained);
  const sameDepartment = item.departmentCode
    ? eligible.filter((n) => n.departmentCode === item.departmentCode)
    : [];
  const sameKind = eligible.filter((n) => n.kind === item.kind);

  // Two genuine matches beat three, one of which is filler: a list that
  // is entirely one branch or one kind can be given an honest heading,
  // and a padded one cannot.
  const strong = dedupe([...sameDepartment, ...sameKind]);
  return strong.length >= 2 ? strong.slice(0, 3) : dedupe([...strong, ...eligible]).slice(0, 3);
}

function dedupe(items: NewsItem[]): NewsItem[] {
  const out: NewsItem[] = [];
  for (const item of items) {
    if (!out.some((n) => n.id === item.id)) out.push(item);
  }
  return out;
}

function RelatedRow({ item, departmentName }: { item: NewsItem; departmentName: string | null }) {
  const meta = KIND_META[item.kind];

  return (
    <div className="space-y-1">
      {meta.restrained ? (
        <p className="text-xs font-medium uppercase tracking-wider text-muted">{meta.label}</p>
      ) : (
        <Badge tone={meta.tone}>{meta.label}</Badge>
      )}

      <p className={cn('font-display leading-snug', meta.restrained ? 'font-medium' : 'font-semibold')}>
        <Link href={`/news/${item.slug}`} className="link-quiet">
          {item.title}
        </Link>
      </p>

      <p className="text-xs text-muted">
        {memberLine([item.author, departmentName])} · {formatDate(item.publishedAt)}
      </p>
    </div>
  );
}
