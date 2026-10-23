import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getAllPages } from '@/lib/data/pages';
import { PageUpdate } from '@/lib/schemas/pages';
import { logAudit } from '@/lib/audit/log';
import { clientIp, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../../_lib/http';
import { requireFeature } from '../../../_lib/feature';

/**
 * Change or remove a page.
 *
 * The address never changes. A page's link is forwarded, printed and
 * bookmarked, and an edit that moved it would break every copy; to retire an
 * address, unpublish the page. Every change is audited with the page as it
 * was and as it is, the body by length rather than whole (a long page in the
 * audit log is a page nobody reads in the audit log).
 */

type Ctx = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const session = await getSession();
  requireCap(session, 'page.manage');
  const { tenant } = await requireFeature('pages', 'College pages are');
  const before = getAllPages(session).find((p) => p.slug === slug);
  if (!before) throw new HttpError(404, 'not_found', 'There is no page at that address.');
  return { session, tenant, before };
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { slug } = await params;
    const { session, tenant, before } = await load(slug);
    const body = await readJson(request, PageUpdate);

    limit(`page-edit:${session.memberId}`, 60, 60 * 60, 'Sixty page saves in an hour is the limit.');

    const audience = body.audience ?? before.audience;
    const showInFooter = body.showInFooter ?? before.showInFooter;
    if (showInFooter && audience === 'members') {
      throw new HttpError(422, 'invalid_input', 'A members-only page cannot be linked from the public footer.', {
        fieldErrors: {
          showInFooter:
            'The public footer is seen by people who are not signed in. Make the page public, or leave it out of the footer.',
        },
      });
    }

    const summary = (p: { title: string; audience: string; published: boolean; showInFooter: boolean; sortOrder: number; body: string }) => ({
      title: p.title,
      audience: p.audience,
      published: p.published,
      showInFooter: p.showInFooter,
      sortOrder: p.sortOrder,
      bodyLength: p.body.length,
    });

    const after = {
      ...before,
      title: body.title ?? before.title,
      body: body.body ?? before.body,
      audience,
      showInFooter,
      sortOrder: body.sortOrder ?? before.sortOrder,
      published: body.publish ?? before.published,
    };

    const action =
      body.publish === true && !before.published
        ? 'page.publish'
        : body.publish === false && before.published
          ? 'page.unpublish'
          : 'page.update';

    await logAudit({
      tenantId: tenant.id,
      session,
      action,
      resource: 'cms_pages',
      resourceId: before.id,
      before: summary(before),
      after: summary(after),
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();
    return json({ ok: true, ...write, page: { ...summary(after), slug: before.slug, id: before.id }, href: `/p/${before.slug}` });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const { slug } = await params;
    const { session, tenant, before } = await load(slug);

    limit(`page-delete:${session.memberId}`, 20, 60 * 60, 'Twenty page deletions in an hour is the limit.');

    await logAudit({
      tenantId: tenant.id,
      session,
      action: 'page.delete',
      resource: 'cms_pages',
      resourceId: before.id,
      before: { slug: before.slug, title: before.title, audience: before.audience, published: before.published, bodyLength: before.body.length },
      after: null,
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();
    return json({ ok: true, ...write, deleted: before.slug });
  } catch (err) {
    return fail(err);
  }
}
