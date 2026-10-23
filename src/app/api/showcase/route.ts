import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getShowcase, showcaseSlugTaken } from '@/lib/data/showcase';
import { slugify } from '@/lib/community';
import { ShowcaseSubmit } from '@/lib/schemas/showcase';
import { logAudit } from '@/lib/audit/log';
import { clientIp, draftId, fail, fixtureWrite, HttpError, json, limit, readJson } from '../_lib/http';
import { requireFeature } from '../_lib/feature';

/**
 * A member puts their own achievement forward.
 *
 * Only about themselves: the route takes no name and no member id, because
 * it records the signed-in member and nobody else. Putting somebody *else*
 * forward is a nomination, and a nomination needs that person's agreement
 * and a human to ask for it, which is the staff route.
 *
 * Submitting is itself the member's consent to be featured, so it is
 * recorded as such. What is submitted is never live: the alumni cell reads
 * it and publishes or says what is missing. There is no request field that
 * skips that.
 */

export async function POST(request: Request) {
  try {
    const session = await getSession();
    requireCap(session, 'showcase.submit');
    const { tenant } = await requireFeature('showcase', 'The showcase is');

    const body = await readJson(request, ShowcaseSubmit);

    limit(
      `showcase-submit:${session.memberId}`,
      3,
      24 * 60 * 60,
      'Three submissions in a day is the limit. Put forward the achievements that matter most, and add the rest later.',
    );

    const mineWaiting = getShowcase(session, { mine: true }).filter((e) => e.state === 'pending_moderation');
    if (mineWaiting.length >= 3) {
      throw new HttpError(409, 'too_many_waiting', 'You already have three submissions waiting. The alumni cell will get to them in turn; wait for a decision before sending more.');
    }

    const slug = body.slug ?? slugify(body.headline, 90, 'achievement');
    if (showcaseSlugTaken(slug)) {
      throw new HttpError(409, 'slug_taken', 'Something with that headline is already in the showcase. Make yours a little more specific.', {
        slug,
        fieldErrors: { headline: 'Make the headline a little more specific.' },
      });
    }

    const entry = {
      id: draftId('show'),
      slug,
      kind: 'achievement' as const,
      category: body.category,
      headline: body.headline,
      summary: body.summary,
      story: body.story ?? null,
      achievedOn: body.achievedOn ?? null,
      memberId: session.memberId,
      source: 'submitted' as const,
      // Never `published`. A person at the college decides.
      state: 'pending_moderation' as const,
    };

    await logAudit({
      tenantId: tenant.id,
      session,
      action: 'showcase.submit',
      resource: 'showcase_entries',
      resourceId: entry.id,
      before: null,
      after: { slug, category: entry.category, headline: entry.headline, state: entry.state, consent: 'self_submitted' },
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();
    return json(
      {
        ok: true,
        ...write,
        entry,
        href: `/showcase/${slug}`,
        note: 'Sent to the alumni cell. It appears in the showcase once they have read it, and you can see where it stands under your submissions.',
      },
      { status: 201 },
    );
  } catch (err) {
    return fail(err);
  }
}
