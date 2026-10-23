import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { pageSlugTaken } from '@/lib/data/pages';
import { PageCreate } from '@/lib/schemas/pages';
import { slugify } from '@/lib/community';
import { logAudit } from '@/lib/audit/log';
import { clientIp, draftId, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../_lib/http';
import { requireFeature } from '../../_lib/feature';

/**
 * Create a page the college edits itself.
 *
 * Behind `page.manage`, which the alumni cell and the college admin hold.
 * The platform operator does not: a page is the college's own voice, and
 * the vendor writing it for them is the wrong way round.
 *
 * `publish` has no default. A page created and published in one breath is
 * a half-written director's message on the public footer, and the draft
 * state exists so that cannot happen by accident.
 *
 * The body is a small, safe Markdown subset (`lib/content/markdown.ts`).
 * It is stored as the editor wrote it and drawn through a renderer that
 * never produces markup from it, so there is nothing to sanitise here and
 * nothing a long page can smuggle through.
 */

export async function POST(request: Request) {
  try {
    const session = await getSession();
    requireCap(session, 'page.manage');
    const { tenant } = await requireFeature('pages', 'College pages are');

    const body = await readJson(request, PageCreate);

    limit(
      `page-edit:${session.memberId}`,
      60,
      60 * 60,
      'Sixty page saves in an hour is the limit. Edit in the editor and save when you are done.',
    );

    if (body.showInFooter && body.audience === 'members') {
      throw new HttpError(422, 'invalid_input', 'A members-only page cannot be linked from the public footer.', {
        fieldErrors: {
          showInFooter:
            'The public footer is seen by people who are not signed in. Make the page public, or leave it out of the footer.',
        },
      });
    }

    const slug = body.slug ?? slugify(body.title, 80, 'page');
    if (pageSlugTaken(slug)) {
      throw new HttpError(409, 'slug_taken', `A page already uses /p/${slug}. Add a word to tell them apart.`, {
        slug,
        fieldErrors: { slug: 'Choose a different address.' },
      });
    }

    const after = {
      id: draftId('page'),
      slug,
      title: body.title,
      audience: body.audience,
      published: body.publish,
      showInFooter: body.showInFooter,
      sortOrder: body.sortOrder,
      bodyLength: body.body.length,
    };

    await logAudit({
      tenantId: tenant.id,
      session,
      action: body.publish ? 'page.publish' : 'page.create',
      resource: 'cms_pages',
      resourceId: after.id,
      before: null,
      after,
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();

    return json(
      {
        ok: true,
        ...write,
        page: after,
        href: `/p/${slug}`,
        note: body.publish
          ? `Published at /p/${slug}. ${body.audience === 'public' ? 'Anyone can read it.' : 'Signed-in members can read it.'}`
          : 'Saved as a draft. Only people who edit pages can see it.',
      },
      { status: 201 },
    );
  } catch (err) {
    return fail(err);
  }
}
