import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getCampaigns } from '@/lib/data/repo';
import { logAudit } from '@/lib/audit/log';
import { clientIp, draftId, fail, fixtureWrite, HttpError, json, limit, readJson } from '../_lib/http';

/**
 * Record a contribution.
 *
 * Four things here are structural and are not to be relaxed into
 * application-level convenience:
 *
 *  1. **Students are refused on the cohort, not only on the flag.** The
 *     donations module is invisible to the student cohort by product rule,
 *     so the check runs whether or not `features.donations` is on and
 *     whether or not a role set has somehow acquired `donation.give`. Two
 *     independent gates, because either one alone is a single point of
 *     failure for a rule that must not fail.
 *  2. **Source country is classified at the point of collection.** A
 *     contribution from outside India is a foreign contribution under the
 *     FCRA even when it arrives in rupees from an NRE account. It is
 *     stamped `isForeignContribution` here, before any payment exists —
 *     never reconciled into the right bucket afterwards.
 *  3. **An unregistered trust refuses foreign money.** Accepting first and
 *     sorting it out later is the offence, not the fix. So the endpoint
 *     says no, with the reason, rather than taking it and holding it.
 *  4. **PAN above ₹50,000.** An 80G receipt issued without one cannot be
 *     filed against a return, so it is required at the threshold rather
 *     than chased by the accounts officer three months later.
 *
 * No payment is created. Razorpay — UPI first — is not wired up, so this
 * validates, authorises, audits and then says `persisted: false`. The
 * form prints that instead of a receipt.
 */

/** PAN is mandatory for an 80G receipt above this, in rupees. */
const PAN_THRESHOLD = 50_000;
const MIN_AMOUNT = 100;
/** Anything larger is a cheque and a conversation with the accounts officer. */
const MAX_AMOUNT = 20_00_000;

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const Body = z
  .object({
    campaignSlug: z.string().trim().min(1, 'Which campaign is this for?').max(120),

    amount: z.coerce
      .number({ invalid_type_error: 'Enter the amount in rupees.' })
      .int('Whole rupees only — no paise.')
      .min(MIN_AMOUNT, `The smallest contribution the portal takes is ₹${MIN_AMOUNT}.`)
      .max(
        MAX_AMOUNT,
        'Contributions above ₹20,00,000 are arranged with the accounts officer directly, not through this form.',
      ),

    /**
     * ISO-3166 alpha-2, or `OTHER` when the giver picks "somewhere else".
     * Everything that is not `IN` is a foreign contribution.
     */
    sourceCountry: z
      .string()
      .trim()
      .regex(/^([A-Za-z]{2}|OTHER|other)$/, 'Pick the country the money leaves from.'),

    pan: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine((v) => v === '' || PAN_RE.test(v), 'Ten characters, like ABCDE1234F.')
      .optional(),

    /** Off means the gift is still receipted, just published without a name. */
    listPublicly: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.amount > PAN_THRESHOLD && !v.pan) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pan'],
        message: `PAN is required above ₹${PAN_THRESHOLD.toLocaleString('en-IN')} — the 80G receipt cannot be filed without it.`,
      });
    }
  });

export async function POST(request: Request) {
  try {
    const session = await getSession();
    requireCap(session, 'donation.give');

    // Gate one: the cohort. Students never see the donations module, and
    // that is not a consequence of the feature flag or of the capability
    // matrix happening to agree today.
    if (session.roles.some((r) => r.role === 'student')) {
      throw new HttpError(
        403,
        'student_cohort',
        'The donations module is not open to the student cohort. Final-year students are asked for nothing.',
      );
    }

    // Gate two: the tenant's feature flag, checked independently.
    const resolved = await getTenantBrand();
    if (!resolved) {
      throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');
    }
    const { tenant, brand } = resolved;
    if (!brand.pack.features.donations) {
      throw new HttpError(404, 'feature_off', 'Giving is not enabled for this college.');
    }

    limit(
      `donation:${session.memberId}:${clientIp(request)}`,
      10,
      60 * 60,
      'That is a lot of attempts in an hour. Wait a few minutes, or write to the alumni cell and they will take it by hand.',
    );

    const body = await readJson(request, Body);

    const campaign = getCampaigns().find((c) => c.slug === body.campaignSlug);
    if (!campaign) {
      throw new HttpError(404, 'not_found', 'That campaign does not exist.');
    }
    if (!campaign.active) {
      throw new HttpError(
        409,
        'campaign_closed',
        `${campaign.title} is closed and is no longer taking contributions. The alumni cell publishes what each closed campaign paid for.`,
      );
    }

    const sourceCountry = body.sourceCountry.toUpperCase();
    const isForeignContribution = sourceCountry !== 'IN';

    // The FCRA gate. Refused at collection, in the same request that
    // classified it — there is no state in which the money is held while
    // somebody works out whether it was allowed.
    if (isForeignContribution && !tenant.fcraRegistered) {
      throw new HttpError(
        403,
        'fcra_not_registered',
        `${tenant.shortName} has not confirmed FCRA registration for the trust, so a contribution from outside India cannot be accepted. It is refused here rather than accepted and returned later — under the Foreign Contribution (Regulation) Act, accepting it first is the offence. If you are resident in India and giving from an Indian account, change the source country.`,
        { sourceCountry, isForeignContribution: true },
      );
    }

    const donationId = draftId('don');
    const createdAt = new Date().toISOString();

    // On the record before a payment is attempted, and without the PAN in
    // it: the audit log answers "who gave what, from where, under which
    // FCRA classification", and a tax identifier is not part of that
    // question.
    await logAudit({
      tenantId: tenant.id,
      session,
      action: 'donation.initiate',
      resource: 'donations',
      resourceId: donationId,
      before: null,
      after: {
        campaignSlug: campaign.slug,
        campaignTitle: campaign.title,
        amount: body.amount,
        currency: brand.pack.locale.currency,
        sourceCountry,
        isForeignContribution,
        panProvided: Boolean(body.pan),
        listPublicly: body.listPublicly,
        state: 'initiated',
        createdAt,
      },
      ip: request.headers.get('x-forwarded-for'),
    });

    const write = fixtureWrite();

    return json(
      {
        ok: true,
        ...write,
        donation: {
          id: donationId,
          campaignSlug: campaign.slug,
          campaignTitle: campaign.title,
          amount: body.amount,
          currency: brand.pack.locale.currency,
          sourceCountry,
          isForeignContribution,
          panProvided: Boolean(body.pan),
          listPublicly: body.listPublicly,
          state: 'initiated' as const,
          gatewayRef: null,
          receipt80gNo: null,
          createdAt,
        },
        // Said plainly, because the one thing this route must never do is
        // let a screen show a receipt for money nobody has taken.
        paymentRequired: true,
        gateway: null,
        note: isForeignContribution
          ? 'Recorded as a foreign contribution and segregated from domestic funds from this point on. No payment has been created — Razorpay is not connected in this build, so nothing has been charged and no 80G receipt exists.'
          : 'No payment has been created — Razorpay, UPI first, is not connected in this build. Nothing has been charged and no 80G receipt exists.',
      },
      { status: 201 },
    );
  } catch (err) {
    return fail(err);
  }
}
