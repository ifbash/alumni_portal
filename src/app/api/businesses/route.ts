import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { require as requireCap, requireActive } from '@/lib/auth/guard';
import { businessSlugTaken, getBusinesses } from '@/lib/data/businesses';
import { BUSINESS_INDUSTRIES, slugify } from '@/lib/community';
import { BusinessCreate } from '@/lib/schemas/businesses';
import { logAudit } from '@/lib/audit/log';
import { clientIp, draftId, fail, fixtureWrite, HttpError, json, limit, parseQuery, readJson } from '../_lib/http';
import { requireFeature } from '../_lib/feature';
import { narrowSummary } from '../_lib/summary';

/**
 * The business directory.
 *
 * Any active member can read live listings. Listing one's own business needs
 * `business.list`, which alumni hold and students do not, and every listing
 * starts in `pending_moderation`: there is no request field that makes it
 * live, in the way there is none on the jobs board.
 *
 * Contact details are two-gate: the viewer must not be a student *and* the
 * owner must have chosen to share them. `lib/data/businesses.ts` does that
 * once; this route returns what it returns and never reads the stored
 * contact fields itself.
 */

const ListQuery = z.object({
  q: z.string().trim().max(120).optional(),
  industry: z.enum(BUSINESS_INDUSTRIES).optional(),
  city: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).max(500).optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getSession();
    requireActive(session);
    await requireFeature('businesses', 'The business directory is');

    const query = parseQuery(request, ListQuery);
    const result = getBusinesses(session, { ...query, perPage: 12 });

    return json({
      total: result.total,
      page: result.page,
      pageCount: result.pageCount,
      items: result.items.map((b) => ({
        id: b.id,
        slug: b.slug,
        name: b.name,
        industry: b.industry,
        description: b.description,
        city: b.city,
        region: b.region,
        country: b.country,
        website: b.website,
        products: b.products,
        services: b.services,
        owner: narrowSummary(session, b.owner),
        // Only present when both gates passed.
        contact: b.contact,
      })),
    });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    requireCap(session, 'business.list');
    const { tenant } = await requireFeature('businesses', 'The business directory is');

    const body = await readJson(request, BusinessCreate);

    limit(
      `business-list:${session.memberId}`,
      3,
      24 * 60 * 60,
      'Three listings in a day is the limit. If you run several businesses, list them one at a time over a few days.',
    );

    // A member lists up to five. Past that it is a catalogue, not a story.
    const mine = getBusinesses(session, { mine: true, perPage: 50 });
    if (mine.total >= 5) {
      throw new HttpError(409, 'listing_limit', 'You already have five listings. Close one before adding another.');
    }

    const slug = body.slug ?? slugify(body.name, 80, 'business');
    if (businessSlugTaken(slug)) {
      throw new HttpError(409, 'slug_taken', `A listing already uses /businesses/${slug}. Add the city, or a word to tell them apart.`, {
        slug,
        fieldErrors: { slug: 'Choose a different address.' },
      });
    }

    const listing = {
      id: draftId('biz'),
      slug,
      name: body.name,
      industry: body.industry,
      description: body.description,
      city: body.city ?? null,
      region: body.region ?? null,
      country: body.country ?? null,
      website: body.website ?? null,
      products: body.products,
      services: body.services,
      showContact: body.showContact,
      // Never `live`. A moderator decides.
      status: 'pending_moderation' as const,
    };

    await logAudit({
      tenantId: tenant.id,
      session,
      action: 'business.submit',
      resource: 'businesses',
      resourceId: listing.id,
      before: null,
      // The contact details are not copied into the audit log.
      after: { name: listing.name, industry: listing.industry, slug, status: listing.status, showContact: listing.showContact },
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();

    return json(
      {
        ok: true,
        ...write,
        business: listing,
        href: `/businesses/${slug}`,
        note: 'Sent for review. It appears in the directory once the alumni cell approves it, and you can see where it stands on your listings.',
      },
      { status: 201 },
    );
  } catch (err) {
    return fail(err);
  }
}
