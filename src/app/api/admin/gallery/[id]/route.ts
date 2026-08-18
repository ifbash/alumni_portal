import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getAlbums } from '@/lib/data/content';
import { logAudit } from '@/lib/audit/log';
import { clientIp, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../../_lib/http';

/**
 * Decide a contributed album.
 *
 * Behind `event.create.any`, the same grant that creates albums: deciding
 * what appears in the archive is the same act as putting it there, and a
 * separate capability would be a tenth entry in the matrix that nobody
 * would remember to revoke.
 *
 * Three outcomes, and **every one of them is written back to the person
 * who sent the photographs in**. That is not a courtesy. A contribution
 * that leaves this queue silently is a contributor who assumes the college
 * lost it, and they do not send a second batch — which is the only reason
 * there is anything in the archive from before the portal existed. So:
 *
 *  - `publish` — live, credited by name.
 *  - `request_changes` — the album stays in the queue and the contributor
 *    is told what would make it publishable. This is what most
 *    contributions actually need; without it a reviewer has only
 *    publish-or-refuse and picks refuse.
 *  - `decline` — refused, with the reason the contributor reads verbatim.
 *    Declining is not deleting: the submission stays on file.
 *
 * The message is required on the two outcomes that carry one, because the
 * endpoint cannot keep the promise the screen makes if there is nothing to
 * send. For the same reason an album with no member credited on it cannot
 * be sent back or declined — there is nobody at the other end.
 */

const NOTE_TOO_SHORT =
  'Write something the contributor can act on. A sentence naming what is wrong beats a form letter, and it is the difference between a corrected album and no second submission.';

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('publish') }),
  z.object({
    action: z.literal('request_changes'),
    message: z.string().trim().min(12, NOTE_TOO_SHORT).max(1200),
  }),
  z.object({
    action: z.literal('decline'),
    /** Which rule it fell foul of. Kept alongside the prose so the queue can be counted later. */
    reasonCode: z.enum(['permission', 'identifiable', 'quality', 'duplicate', 'other']),
    message: z.string().trim().min(12, NOTE_TOO_SHORT).max(1200),
  }),
]);

/** Same rule the gallery console and the member pages use: "Name (BRANCH, YEAR)" is a member credit. */
const MEMBER_CREDIT = /^(.+?)\s*\(([A-Za-z]+),\s*(\d{4})\)$/;

function credit(contributedBy: string | null): { name: string; byMember: boolean } {
  if (!contributedBy) return { name: 'Alumni Cell', byMember: false };
  const match = MEMBER_CREDIT.exec(contributedBy.trim());
  if (!match) return { name: contributedBy, byMember: false };
  return { name: match[1]!, byMember: true };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();

    // Publishing photographs of identifiable students and alumni is an
    // alumni-cell and college-admin job. An HOD holding only
    // `event.create.department` does not reach this decision.
    requireCap(session, 'event.create.any');

    const resolved = await getTenantBrand();
    if (!resolved) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');
    if (!resolved.brand.pack.features.gallery) {
      throw new HttpError(404, 'feature_off', 'The gallery is not enabled for this college.');
    }

    const { id } = await params;
    const body = await readJson(request, Body);

    limit(
      `gallery-review:${session.memberId}`,
      60,
      60 * 60,
      'Sixty decisions in an hour is the limit. A queue moving faster than that is not being read.',
    );

    const album = getAlbums({ includeDrafts: true }).find((a) => a.id === id || a.slug === id);
    if (!album) {
      throw new HttpError(404, 'not_found', 'There is no album with that id.');
    }

    const by = credit(album.contributedBy);

    if (album.published) {
      throw new HttpError(
        409,
        'already_published',
        body.action === 'publish'
          ? `“${album.title}” is already live in the archive. ${by.name} has been told once; telling them twice is worse than not at all.`
          : `“${album.title}” is already published, so it is past this queue. Unpublish it first if it needs to come down — that is a different decision, and the contributor is told about it separately.`,
        { published: true },
      );
    }

    if (body.action !== 'publish' && !by.byMember) {
      throw new HttpError(
        409,
        'no_contributor',
        `Nobody is credited on “${album.title}”, so there is no contributor to send this to. An album the alumni cell created itself is edited or deleted rather than declined.`,
        { contributedBy: album.contributedBy },
      );
    }

    const before = {
      published: album.published,
      title: album.title,
      slug: album.slug,
      photoCount: album.photoCount,
      contributedBy: album.contributedBy,
      reviewState: 'awaiting_review' as const,
    };

    const decidedAt = new Date().toISOString();
    const message = body.action === 'publish' ? null : body.message;

    const after = {
      ...before,
      published: body.action === 'publish',
      // `request_changes` deliberately leaves the album in the queue: it
      // is waiting on the contributor, not on the college, and dropping it
      // out of the list is how it stops being anybody's job.
      reviewState:
        body.action === 'publish'
          ? ('published' as const)
          : body.action === 'decline'
            ? ('declined' as const)
            : ('awaiting_contributor' as const),
      reviewedBy: session.memberId,
      reviewedAt: decidedAt,
      reviewNote: message,
      declineReason: body.action === 'decline' ? body.reasonCode : null,
    };

    await logAudit({
      tenantId: resolved.tenant.id,
      session,
      action:
        body.action === 'publish'
          ? 'gallery.publish'
          : body.action === 'decline'
            ? 'gallery.decline'
            : 'gallery.request_changes',
      resource: 'gallery_albums',
      resourceId: album.id,
      // Whole snapshots rather than a diff: reconstructing state from a
      // diff chain months later, when somebody asks why a photograph of
      // them came down, is exactly when you cannot afford the extra step.
      before,
      after,
      reason: message,
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();

    return json({
      ok: true,
      ...write,
      album: {
        id: album.id,
        slug: album.slug,
        title: album.title,
        photoCount: album.photoCount,
        published: after.published,
        reviewState: after.reviewState,
      },
      contributor: {
        name: by.name,
        /**
         * Every outcome reaches them, publication included — that is the
         * promise the queue makes. It is a statement about what this
         * decision entails, not a claim that a provider has delivered
         * anything: fixture mode carries `persisted: false` alongside it,
         * and the screen says so rather than showing a tick over a message
         * that was never sent.
         */
        messaged: true,
        message,
      },
      decidedAt,
      note:
        body.action === 'publish'
          ? `Live in the archive, credited to ${by.name}. Anyone tagged in a photograph can ask to be untagged, and anyone in one can ask for it to come down.`
          : body.action === 'request_changes'
            ? `${by.name} is sent your note and the album stays in the queue until they reply. Nothing is visible to members in the meantime.`
            : `${by.name} is sent the reason verbatim. The submission stays on file — declining is not deleting, and they can send a corrected album.`,
    });
  } catch (err) {
    return fail(err);
  }
}
