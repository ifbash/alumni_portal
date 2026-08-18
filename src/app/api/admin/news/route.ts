import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDepartments } from '@/lib/data/repo';
import { getNews } from '@/lib/data/content';
import { logAudit } from '@/lib/audit/log';
import { clientIp, draftId, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../_lib/http';

/**
 * Write a story, or publish one.
 *
 * Behind `comms.send.segment` rather than a separate editorial
 * capability, and on purpose: publishing is a send. A published story
 * notifies the members it concerns, so the grant that decides who may
 * write to the network is the grant that decides who may publish to it.
 * A "publish" permission that did not imply "notify" would be a way of
 * mailing eight thousand people without holding the capability to mail
 * anybody.
 *
 * Two editorial rules are enforced here rather than left to whoever is at
 * the desk at 11pm:
 *
 *  - **An obituary is published quietly.** It goes on the news page and
 *    nothing is pushed — no notification, no WhatsApp, no email. A death
 *    notice arriving as a marketing-style alert is the kind of thing a
 *    college apologises for afterwards.
 *  - **Three pinned stories is none pinned.** The pin is what makes the
 *    top of the feed mean something; a feed where everything is pinned
 *    has simply been reordered.
 *
 * `publish` is explicit. Saving a draft and publishing to the whole
 * network are different acts and do not share a default.
 */

const KINDS = ['achievement', 'announcement', 'obituary', 'milestone', 'press'] as const;

/** Kinds that push a notification when published. */
const NOTIFIES: Record<(typeof KINDS)[number], boolean> = {
  achievement: true,
  announcement: true,
  milestone: true,
  press: true,
  obituary: false,
};

const MAX_PINNED = 3;

const Body = z.object({
  title: z
    .string()
    .trim()
    .min(8, 'Write a headline somebody could recognise the story by.')
    .max(160),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase words separated by hyphens.')
    .min(4)
    .max(90)
    .optional(),
  kind: z.enum(KINDS),
  summary: z
    .string()
    .trim()
    .min(20, 'The summary is what appears in the feed and in the notification. Say what happened, with the number in it.')
    .max(300),
  body: z
    .string()
    .trim()
    .min(80, 'A story shorter than eighty characters belongs in the summary, not in a published item.')
    .max(20000),
  departmentCode: z.string().trim().max(12).optional(),
  aboutMemberId: z.string().trim().max(64).optional(),
  pinned: z.boolean().default(false),
  /** No default. Publishing notifies members; saving a draft does not. */
  publish: z.boolean({
    required_error: 'Say whether this is a draft or a publish. Publishing notifies members and cannot be recalled.',
    invalid_type_error: 'publish is true or false.',
  }),
});

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'story'
  );
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    requireCap(session, 'comms.send.segment');

    const resolved = await getTenantBrand();
    if (!resolved) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');
    if (!resolved.brand.pack.features.news) {
      throw new HttpError(404, 'feature_off', 'News is not enabled for this college — this tenant runs it on the main college site.');
    }

    const body = await readJson(request, Body);

    limit(
      `news-write:${session.memberId}`,
      20,
      60 * 60,
      'Twenty story writes in an hour is the limit. If a published item needs correcting, edit it rather than posting it again.',
    );

    if (body.departmentCode && !getDepartments().some((d) => d.code === body.departmentCode)) {
      throw new HttpError(422, 'invalid_input', 'That branch does not exist on this tenant.', {
        fieldErrors: { departmentCode: 'Pick a branch from the list, or leave it blank for a college-wide story.' },
      });
    }

    const slug = body.slug ?? slugify(body.title);

    // Drafts included in the check. Two items cannot share an address even
    // when one of them has not gone out yet — the draft is published later
    // and the collision surfaces then, with a link already in circulation.
    const existing = getNews({ includeDrafts: true }).find((n) => n.slug === slug);
    if (existing) {
      throw new HttpError(
        409,
        'slug_taken',
        `“${existing.title}” already uses the address /news/${slug}. Once a story is published that address gets forwarded on WhatsApp for months, so it cannot be reused.`,
        { slug, fieldErrors: { slug: 'Choose a different address.' } },
      );
    }

    const notifies = body.publish && NOTIFIES[body.kind];

    if (body.pinned && body.publish) {
      const pinned = getNews().filter((n) => n.pinned).length;
      if (pinned >= MAX_PINNED) {
        throw new HttpError(
          409,
          'too_many_pinned',
          `${pinned} stories are already pinned. The pin is what makes the top of the feed mean something — unpin one before pinning another.`,
          { pinnedCount: pinned, limit: MAX_PINNED },
        );
      }
    }

    const publishedAt = body.publish ? new Date().toISOString() : null;

    const after = {
      id: draftId('news'),
      slug,
      kind: body.kind,
      title: body.title,
      summary: body.summary,
      departmentCode: body.departmentCode ?? null,
      aboutMemberId: body.aboutMemberId ?? null,
      pinned: body.pinned,
      published: body.publish,
      publishedAt,
      notifies,
      bodyLength: body.body.length,
    };

    await logAudit({
      tenantId: resolved.tenant.id,
      session,
      action: body.publish ? 'news.publish' : 'news.draft',
      resource: 'news_items',
      resourceId: after.id,
      reason: null,
      // A create has no before. Recorded as null rather than omitted, so
      // the entry reads the same shape as an edit does.
      before: null,
      after,
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();

    return json(
      {
        ok: true,
        ...write,
        item: after,
        href: `/news/${slug}`,
        note: body.publish
          ? notifies
            ? `Published. Members are notified ${resolved.brand.pack.features.whatsapp ? 'by WhatsApp and email' : 'by email'}. A correction published afterwards does not reach the people who read the first version.`
            : 'Published to the news page. Nothing is pushed — no notification, no email — because this is a notice, not an announcement.'
          : 'Saved as a draft. Nothing has gone to anybody; it appears only to staff who can publish.',
      },
      { status: 201 },
    );
  } catch (err) {
    return fail(err);
  }
}
