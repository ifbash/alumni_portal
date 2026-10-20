import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';
import { Mail, Users } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { can, isActive } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getNews, getNewsBySlug, type NewsItem } from '@/lib/data/content';
import { findMemberById, getDepartments, getMemberBySlug } from '@/lib/data/repo';
import {
  Avatar,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CopyButton,
  MediaFrame,
  Section,
  ShareActions,
} from '@/components/ui';
import { StoryCard } from '@/components/content';
import { formatDate, memberLine } from '@/lib/format';
import { mailto } from '@/lib/mailto';
import { storyShareText } from '@/lib/share-text';
import { siteOrigin, whatsappShareUrl } from '@/lib/share';
import { KIND_META } from '../kinds';

/**
 * One story.
 *
 * `getNewsBySlug` is called without `includeDrafts`, so an unpublished
 * item 404s here exactly as it would for a stranger — the admin console
 * is the only place a draft is addressable.
 *
 * The page is an article: the kind and branch as an eyebrow, the headline,
 * a lede, a byline, the body. Beside it sits at most one card that does
 * something with the story — congratulate the graduate it is about, find
 * the branch's alumni, or write to the office in memory of someone. A
 * notice gets no share button in the brand colour and no directory
 * promotion; the two cases diverge in enough places that `restrained` is
 * checked rather than re-derived.
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
  if (!isActive(session)) redirect('/pending');

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
        : 'More stories';

  const locale = pack.locale;
  const office = pack.copy.officeName;
  const support = pack.copy.supportEmail ?? null;
  const origin = await siteOrigin();
  const url = `${origin}/news/${item.slug}`;
  const obituary = meta.restrained;
  const words = `${item.summary} ${item.body}`.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  const eyebrow = [meta.label, departmentName].filter(Boolean).join(' · ');

  // ---------------------------------------------------------------
  // The one thing to do with this story
  // ---------------------------------------------------------------

  let context: ReactNode = null;

  if (obituary) {
    const name = item.title.replace(/^in memoriam:\s*/i, '').trim();
    context = support ? (
      <Card>
        <CardBody className="space-y-3">
          <h2 className="font-display text-md font-semibold">Write to the {office}</h2>
          <p className="text-sm text-secondary">Share a memory or a message for the family.</p>
          <ButtonLink
            href={mailto(support, `In memory of ${name}`, [''])}
            variant="secondary"
            className="min-h-11 w-full"
          >
            <Mail className="size-4 shrink-0" aria-hidden="true" />
            Write to the {office}
          </ButtonLink>
        </CardBody>
      </Card>
    ) : null;
  } else if (item.kind === 'achievement' && aboutMember) {
    context = (
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={aboutMember.fullName} src={aboutMember.photoUrl} size="lg" />
            <div className="min-w-0">
              <h2 className="font-display text-md font-semibold">{aboutMember.fullName}</h2>
              <p className="text-sm text-secondary">
                {memberLine([aboutMember.departmentCode, aboutMember.batchYear, aboutMember.currentCompany])}
              </p>
            </div>
          </div>
          <ButtonLink href={`/directory/${aboutMember.slug}`} className="min-h-11 w-full">
            Congratulate
          </ButtonLink>
        </CardBody>
      </Card>
    );
  } else if ((item.kind === 'milestone' || item.kind === 'achievement') && item.departmentCode && canOpenDirectory) {
    context = (
      <Card>
        <CardBody className="space-y-3">
          <h2 className="font-display text-md font-semibold">{departmentName}</h2>
          <p className="text-sm text-secondary">Graduates of this branch, across every batch.</p>
          <ButtonLink href={`/directory/branch/${item.departmentCode}`} variant="secondary" className="min-h-11 w-full">
            <Users className="size-4 shrink-0" aria-hidden="true" />
            Find {item.departmentCode} alumni
          </ButtonLink>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'News', href: '/news' }, { label: item.title }]} />

        {/* The masthead runs wider than the text column: the headline wants
            the room, the paragraphs want a short line. */}
        <header className="stagger max-w-4xl space-y-4">
          <p style={{ '--i': 0 } as CSSProperties} className="eyebrow text-brand-fg">
            {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
            {eyebrow}
          </p>
          <h1
            style={{ '--i': 1 } as CSSProperties}
            className="font-display text-display-lg font-bold tracking-tight [text-wrap:balance]"
          >
            {item.title}
          </h1>
          <p style={{ '--i': 2 } as CSSProperties} className="max-w-3xl text-lg leading-relaxed text-secondary sm:text-xl">
            {item.summary}
          </p>
          <div
            style={{ '--i': 3 } as CSSProperties}
            className="flex flex-col gap-3 border-y border-line py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-secondary">
              <span className="font-medium text-primary">{item.author}</span>
              <span aria-hidden="true" className="px-1.5 text-muted">·</span>
              <time dateTime={item.publishedAt ?? undefined}>{formatDate(item.publishedAt, locale)}</time>
              <span aria-hidden="true" className="px-1.5 text-muted">·</span>
              {minutes} min read
            </p>
            {obituary ? (
              <CopyButton text={url} label="Copy link" copiedLabel="Link copied" size="sm" />
            ) : (
              <ShareActions
                url={url}
                whatsappHref={whatsappShareUrl(storyShareText(pack, item), url)}
                title={item.title}
                size="sm"
              />
            )}
          </div>
        </header>

        {item.coverImage ? (
          <div className="max-w-5xl">
            <MediaFrame src={item.coverImage} alt="" aspect="16/9" loading="eager" className="lg:[&>div]:aspect-[21/9]" />
          </div>
        ) : null}
      </div>

      <div
        className={
          context ? 'grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,68ch)_18rem] lg:gap-16' : undefined
        }
      >
        <article className="min-w-0 max-w-[68ch] space-y-6">
          {/* Bodies are plain text with blank lines between paragraphs.
              `whitespace-pre-line` keeps the single breaks the author typed
              inside a paragraph instead of collapsing them into a run-on.
              A drop cap opens a story; a notice does not get one. */}
          {paragraphs.length ? (
            <div className="space-y-5 text-md leading-[1.75] text-primary">
              {paragraphs.map((p, i) => (
                <p
                  key={i}
                  className={
                    i === 0 && !obituary
                      ? 'whitespace-pre-line first-letter:float-left first-letter:mr-1.5 first-letter:mt-1 first-letter:font-display first-letter:text-5xl first-letter:font-bold first-letter:leading-[0.85] first-letter:text-brand-fg'
                      : 'whitespace-pre-line'
                  }
                >
                  {p}
                </p>
              ))}
            </div>
          ) : null}

          {support ? (
            <p className="border-t border-line pt-4 text-sm text-secondary">
              Corrections:{' '}
              <a href={`mailto:${support}`} className="link">
                {support}
              </a>
            </p>
          ) : null}
        </article>

        {context ? (
          <aside aria-label="About this story" className="min-w-0 lg:sticky lg:top-20 lg:self-start">
            {context}
          </aside>
        ) : null}
      </div>

      {related.length > 0 ? (
        <Section title={relatedTitle} className="border-t border-line pt-6">
          {obituary ? (
            <ul className="divide-y divide-line">
              {related.map((n) => (
                <li key={n.id}>
                  <StoryCard
                    story={n}
                    href={`/news/${n.slug}`}
                    locale={locale}
                    variant="row"
                    eyebrow={KIND_META[n.kind].label}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-3">
              {related.map((n) => {
                const RelIcon = KIND_META[n.kind].icon;
                return (
                  <li key={n.id} className="min-w-0">
                    <StoryCard
                      story={n}
                      href={`/news/${n.slug}`}
                      locale={locale}
                      variant={KIND_META[n.kind].restrained ? 'row' : 'card'}
                      className="[&_figure>div]:aspect-[21/9]"
                      eyebrow={
                        <>
                          {RelIcon ? <RelIcon className="text-muted" aria-hidden="true" /> : null}
                          {KIND_META[n.kind].label}
                        </>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      ) : null}
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
