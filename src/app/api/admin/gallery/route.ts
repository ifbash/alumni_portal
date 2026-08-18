import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDepartments, getEventBySlug } from '@/lib/data/repo';
import { getAlbums } from '@/lib/data/content';
import { logAudit } from '@/lib/audit/log';
import { clientIp, draftId, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../_lib/http';

/**
 * Create a gallery album.
 *
 * Behind `event.create.any`, which the alumni cell and the college admin
 * hold: an album is the record of an event, made by the people who run
 * events, and giving it its own capability would mean a tenth role in the
 * matrix that nobody would remember to revoke.
 *
 * The album is created empty and it is created *unpublished by default* —
 * `publish` is explicit. Photographs from a reunion arrive over the
 * following week from six different phones, and an album that goes live
 * the moment it is named is an album members see with nothing in it.
 *
 * Two things this endpoint does not do, on purpose:
 *
 *  - **It does not accept photographs.** Uploads are a separate,
 *    presigned path to object storage in `ap-south-1`; a JSON body is not
 *    where a 4MB JPEG belongs.
 *  - **It does not accept tags.** Tagging happens per photograph, is
 *    opt-out per member, and never releases contact details — a tag is a
 *    link to a profile, and the profile applies its own rules.
 */

const Body = z.object({
  title: z.string().trim().min(4, 'Name the album for the occasion — “Annual Alumni Meet 2026”, not “Photos”.').max(140),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase words separated by hyphens.')
    .min(4)
    .max(90)
    .optional(),
  description: z.string().trim().max(1200).optional(),
  departmentCode: z.string().trim().max(12).optional(),
  batchYear: z.number().int().min(1960).max(2100).optional(),
  /** Links the album to an event, so the event page can show it. */
  eventSlug: z.string().trim().max(90).optional(),
  takenOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date the photographs were taken, as YYYY-MM-DD.')
    .optional(),
  contributedBy: z.string().trim().max(120).optional(),
  /** No default. An empty album going live is the common accident here. */
  publish: z.boolean({
    required_error: 'Say whether this album goes live now or waits. An album published empty is one members open once and do not return to.',
    invalid_type_error: 'publish is true or false.',
  }),
});

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'album'
  );
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    requireCap(session, 'event.create.any');

    const resolved = await getTenantBrand();
    if (!resolved) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');
    if (!resolved.brand.pack.features.gallery) {
      throw new HttpError(404, 'feature_off', 'The gallery is not enabled for this college.');
    }

    const body = await readJson(request, Body);

    limit(
      `gallery-album:${session.memberId}`,
      20,
      60 * 60,
      'Twenty albums in an hour is the limit. If a reunion needs more than that, it needs one album per session, not one per roll of photographs.',
    );

    if (body.departmentCode && !getDepartments().some((d) => d.code === body.departmentCode)) {
      throw new HttpError(422, 'invalid_input', 'That branch does not exist on this tenant.', {
        fieldErrors: { departmentCode: 'Pick a branch, or leave it blank for a college-wide album.' },
      });
    }

    // Checked rather than trusted: a link to an event that does not exist
    // renders as a dead "from this event" line on every photograph.
    if (body.eventSlug && !getEventBySlug(session, body.eventSlug)) {
      throw new HttpError(422, 'invalid_input', 'No event on this tenant has that address.', {
        fieldErrors: { eventSlug: 'Copy the address from the event page, or leave it blank.' },
      });
    }

    const slug = body.slug ?? slugify(body.title);

    // Unpublished albums included: the collision would otherwise surface
    // the day somebody publishes the older one.
    const existing = getAlbums({ includeDrafts: true }).find((a) => a.slug === slug);
    if (existing) {
      throw new HttpError(
        409,
        'slug_taken',
        `“${existing.title}” already uses the address /gallery/${slug}. Add the year, or the branch, to tell them apart.`,
        { slug, fieldErrors: { slug: 'Choose a different address.' } },
      );
    }

    const after = {
      id: draftId('alb'),
      slug,
      title: body.title,
      description: body.description ?? null,
      departmentCode: body.departmentCode ?? null,
      batchYear: body.batchYear ?? null,
      eventSlug: body.eventSlug ?? null,
      takenOn: body.takenOn ?? new Date().toISOString().slice(0, 10),
      contributedBy: body.contributedBy ?? 'Alumni Cell',
      photoCount: 0,
      published: body.publish,
    };

    await logAudit({
      tenantId: resolved.tenant.id,
      session,
      action: body.publish ? 'gallery.album.publish' : 'gallery.album.create',
      resource: 'gallery_albums',
      resourceId: after.id,
      reason: null,
      before: null,
      after,
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();

    return json(
      {
        ok: true,
        ...write,
        album: after,
        href: `/gallery/${slug}`,
        uploads: {
          accepted: false,
          note: 'Photographs are uploaded separately, straight to object storage in ap-south-1. This call creates the album they go into.',
        },
        note: body.publish
          ? 'The album is live and empty. Add the photographs today — an empty album is one members open once and do not come back to.'
          : 'Saved unpublished. Members cannot see it until you publish, so there is no hurry about the photographs.',
      },
      { status: 201 },
    );
  } catch (err) {
    return fail(err);
  }
}
