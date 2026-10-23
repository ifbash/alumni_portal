import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getDepartments, getEventBySlug } from '@/lib/data/repo';
import { getMyGroups } from '@/lib/data/groups';
import { displayNow } from '@/lib/format';
import { slugify } from '@/lib/community';
import { EventProposal, PROPOSAL_LEAD_DAYS } from '@/lib/schemas/events';
import { logAudit } from '@/lib/audit/log';
import { clientIp, draftId, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../_lib/http';
import { requireFeature } from '../../_lib/feature';

/**
 * A member puts an event forward.
 *
 * Alumni and faculty hold `event.propose`; students do not. What comes out
 * the other end is never a published event: it is a proposal that is hidden
 * from every list until the alumni cell approves it (`event.create.any`,
 * `PATCH /api/admin/events/[id]`). There is no request field that skips
 * that, in the way there is none on the jobs board.
 *
 * Three rules beyond the shape:
 *
 *  - **A week's notice.** The cell needs time to read a proposal, agree a
 *    venue and tell people. Something starting tomorrow is a message to the
 *    cell, not a proposal.
 *  - **A group the proposer is in.** A chapter's meetup is proposed by
 *    someone in that chapter. Naming a group one is not in would let a
 *    stranger attach events to somebody else's noticeboard.
 *  - **Never `published`, never approved.** The reply says so.
 */

const MS_PER_DAY = 86_400_000;

export async function POST(request: Request) {
  try {
    const session = await getSession();
    requireCap(session, 'event.propose');
    const { tenant } = await requireFeature('events', 'Events are');

    const body = await readJson(request, EventProposal);

    limit(
      `event-propose:${session.memberId}`,
      5,
      24 * 60 * 60,
      'Five proposals in a day is the limit. If you have a whole programme in mind, put it forward as one event and describe the sessions in it.',
    );

    const startsAt = new Date(body.startsAt);
    const earliest = displayNow().getTime() + PROPOSAL_LEAD_DAYS * MS_PER_DAY;
    if (startsAt.getTime() < earliest) {
      throw new HttpError(422, 'invalid_input', `Proposals need at least ${PROPOSAL_LEAD_DAYS} days of notice.`, {
        fieldErrors: {
          startsAt: `Pick a date at least ${PROPOSAL_LEAD_DAYS} days from now, so the alumni cell has time to read it and tell people.`,
        },
      });
    }

    if (body.groupSlug && !getMyGroups(session).some((g) => g.slug === body.groupSlug)) {
      throw new HttpError(422, 'invalid_input', 'You can only host an event for a group you belong to.', {
        fieldErrors: { groupSlug: 'Pick one of your own groups, or leave it blank.' },
      });
    }

    if (body.departmentCode && !getDepartments().some((d) => d.code === body.departmentCode)) {
      throw new HttpError(422, 'invalid_input', 'That branch does not exist on this college.', {
        fieldErrors: { departmentCode: 'Pick a branch from the list, or leave it blank.' },
      });
    }

    const slug = slugify(body.title, 80, 'event');
    if (getEventBySlug(session, slug)) {
      throw new HttpError(
        409,
        'slug_taken',
        `An event already uses the address /events/${slug}. Add the year, or the place, to tell them apart.`,
        { slug, fieldErrors: { title: 'Change the title slightly so the address is not taken.' } },
      );
    }

    const proposal = {
      id: draftId('evt'),
      slug,
      title: body.title,
      description: body.description,
      venue: body.venue,
      startsAt: startsAt.toISOString(),
      endsAt: body.endsAt ? new Date(body.endsAt).toISOString() : null,
      departmentCode: body.departmentCode ?? null,
      alumniOnly: body.audience === 'alumni_only',
      studentEligible: body.audience === 'both',
      capacity: body.capacity ?? null,
      ticketPrice: body.ticketPrice,
      kind: body.kind,
      mode: body.mode,
      meetingUrl: body.meetingUrl ?? null,
      batchYear: body.batchYear ?? null,
      groupSlug: body.groupSlug ?? null,
      // Always. There is no field that makes it anything else.
      published: false,
      reviewState: 'pending' as const,
    };

    await logAudit({
      tenantId: tenant.id,
      session,
      action: 'event.propose',
      resource: 'events',
      resourceId: proposal.id,
      before: null,
      after: { ...proposal, proposedBy: session.memberId },
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();

    return json(
      {
        ok: true,
        ...write,
        event: proposal,
        href: `/events/${slug}`,
        note: 'Sent to the alumni cell. It is not visible to other members until it is approved, and the decision appears on your Events page.',
      },
      { status: 201 },
    );
  } catch (err) {
    return fail(err);
  }
}
