import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Award, Search } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, isActive } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getShowcase, getShowcaseCategoryCounts, getShowcaseKindCounts } from '@/lib/data/showcase';
import { SHOWCASE_CATEGORY_VALUES, SHOWCASE_KINDS, SHOWCASE_KIND_VALUES, showcaseCategoryLabel } from '@/lib/community';
import { Button, ButtonLink, ChipNav, EmptyState, Input, PageHeader, Tabs } from '@/components/ui';
import { ShowcaseCard } from '@/components/community/ShowcaseCard';
import type { ShowcaseCategory, ShowcaseKind } from '@/lib/data/types';

/**
 * Prominent alumni, achievements and success stories.
 *
 * The page a college is proud of, and the one that matters to a final-year
 * deciding whether the degree leads anywhere. It opens on the people (the
 * prominent alumni), with the categories as chips and their counts, so
 * "how many of us are in civil services" is a number on the screen and not
 * an assumption.
 *
 * Every entry is about a named person and was published with their
 * agreement (or from a public source, for somebody not on the portal). That
 * is decided where entries are created; this page only draws what is live,
 * plus the viewer's own submissions under their own tab.
 */

export const metadata: Metadata = { title: 'Showcase' };

type View = ShowcaseKind | 'mine';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function href(view: View, category: ShowcaseCategory | undefined, q: string): string {
  const qs = new URLSearchParams();
  if (view !== 'prominent') qs.set('view', view);
  if (category) qs.set('category', category);
  if (q) qs.set('q', q);
  const s = qs.toString();
  return s ? `/showcase?${s}` : '/showcase';
}

export default async function ShowcasePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!isActive(session)) redirect('/pending');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.showcase) notFound();

  const params = await searchParams;
  const rawView = one(params.view) ?? 'prominent';
  const view: View = rawView === 'mine' ? 'mine' : (SHOWCASE_KIND_VALUES as readonly string[]).includes(rawView) ? (rawView as ShowcaseKind) : 'prominent';
  const rawCategory = one(params.category) ?? '';
  const category = (SHOWCASE_CATEGORY_VALUES as readonly string[]).includes(rawCategory) ? (rawCategory as ShowcaseCategory) : undefined;
  const q = one(params.q)?.trim().slice(0, 100) ?? '';

  const canSubmit = can(session, 'showcase.submit');
  const kindCounts = getShowcaseKindCounts();
  const countOf = (k: ShowcaseKind) => kindCounts.find((c) => c.kind === k)?.count ?? 0;
  const mineAll = getShowcase(session, { mine: true });

  const entries =
    view === 'mine'
      ? mineAll
      : getShowcase(session, { kind: view, category, q: q || undefined });
  const categories = view === 'mine' ? [] : getShowcaseCategoryCounts(view);
  const featured = view !== 'mine' && !category && !q ? entries.filter((e) => e.featured).slice(0, 2) : [];
  const rest = entries.filter((e) => !featured.some((f) => f.id === e.id));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Showcase"
        title="Showcase"
        description={`The people and the work that make ${pack.copy.shortName} proud.`}
        actions={
          canSubmit ? (
            <ButtonLink href="/showcase/submit">
              <Award className="size-4" aria-hidden="true" />
              Share an achievement
            </ButtonLink>
          ) : undefined
        }
      />

      <Tabs
        ariaLabel="Showcase"
        items={[
          ...SHOWCASE_KINDS.map((k) => ({ label: k.plural, href: href(k.value, undefined, ''), count: countOf(k.value), active: view === k.value })),
          ...(canSubmit ? [{ label: 'Your submissions', href: href('mine', undefined, ''), count: mineAll.length, active: view === 'mine' }] : []),
        ]}
      />

      {view !== 'mine' ? (
        <div className="space-y-3">
          <form action="/showcase" method="get" role="search" aria-label="Search the showcase" className="flex max-w-xl gap-2">
            {view !== 'prominent' ? <input type="hidden" name="view" value={view} /> : null}
            {category ? <input type="hidden" name="category" value={category} /> : null}
            <div className="min-w-0 flex-1">
              <Input name="q" defaultValue={q} placeholder="Search by name or achievement" aria-label="Search the showcase" leading={<Search className="size-4" />} />
            </div>
            <Button type="submit" variant="secondary" className="min-h-11 sm:min-h-0">
              Search
            </Button>
          </form>

          {categories.length > 1 || category ? (
            <ChipNav
              ariaLabel="Category"
              items={[
                { label: 'Everyone', href: href(view, undefined, q), active: !category },
                ...categories.map((c) => ({ label: `${showcaseCategoryLabel(c.category)} (${c.count})`, href: href(view, c.category, q), active: category === c.category })),
              ]}
            />
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-secondary">
          What you have put forward and where it stands. A submission appears to other members once the {pack.copy.officeName} publishes it.
        </p>
      )}

      {entries.length === 0 ? (
        view === 'mine' ? (
          <EmptyState
            icon={<Award className="size-5" />}
            title="You have not put anything forward"
            description="A promotion, an award, a project you finished. Send it in and the alumni cell reads it."
            action={
              <ButtonLink href="/showcase/submit" variant="secondary">
                Share an achievement
              </ButtonLink>
            }
          />
        ) : q || category ? (
          <EmptyState
            variant="inline"
            title="Nothing matches that."
            action={
              <Link href={href(view, undefined, '')} className="link inline-flex min-h-11 items-center">
                Clear the filters
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={<Award className="size-5" />}
            title="Nothing here yet"
            description={`The ${pack.copy.officeName} adds people and achievements as they are agreed and confirmed.`}
          />
        )
      ) : (
        <div className="space-y-6">
          {featured.length > 0 ? (
            <ul className="grid gap-4 lg:grid-cols-2">
              {featured.map((e) => (
                <li key={e.id} className="min-w-0">
                  <ShowcaseCard entry={e} size="lead" />
                </li>
              ))}
            </ul>
          ) : null}
          {rest.length > 0 ? (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rest.map((e) => (
                <li key={e.id} className="min-w-0">
                  <ShowcaseCard entry={e} showState={view === 'mine'} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
