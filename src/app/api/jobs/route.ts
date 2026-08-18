import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { can, require as requireCap, requireSession } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getJobs } from '@/lib/data/repo';
import { logAudit } from '@/lib/audit/log';
import { draftId, fail, fixtureWrite, flagParam, HttpError, json, limit, parseQuery, readJson } from '../_lib/http';
import { narrowSummary } from '../_lib/summary';

/**
 * The jobs board.
 *
 * Alumni post here, students apply. That asymmetry is the reason CGPA and
 * placement status never leave the placement side of the product: an
 * alumnus posting a role must not be able to sort the final year by
 * marks, and there is no capability that would let them.
 *
 * Everything new lands in `pending_moderation`. A board where a stranger's
 * post is live before anybody reads it becomes a recruitment-consultancy
 * spam channel inside a month, and the college's name is on it.
 */

const ListQuery = z.object({
  state: z.enum(['draft', 'pending_moderation', 'live', 'rejected', 'closed', 'all']).optional(),
  q: z.string().trim().max(120).optional(),
  internships: flagParam,
  mine: flagParam,
});

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-09-30.');

const CreateBody = z.object({
  title: z
    .string()
    .trim()
    .min(4, 'Give the role its actual title — "Software Engineer", not "opening".')
    .max(120),
  company: z.string().trim().min(2, 'Which company is hiring?').max(120),
  location: z.string().trim().max(120).nullable().optional(),
  isInternship: z.boolean().default(false),
  description: z
    .string()
    .trim()
    .min(80, 'Say what the work is, what is expected, and how to apply. A line and a link gets rejected.')
    .max(6000),
  applyUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) => v.startsWith('https://') || v.startsWith('mailto:'),
      'Use an https link or a mailto: address.',
    )
    .nullable()
    .optional(),
  closesOn: isoDate.nullable().optional(),
  experienceYears: z.string().trim().max(40).nullable().optional(),
  salaryRange: z.string().trim().max(60).nullable().optional(),
  skills: z.array(z.string().trim().min(1).max(40)).max(12, 'Twelve skills is plenty.').default([]),
});

async function jobsFeature() {
  const resolved = await getTenantBrand();
  if (!resolved) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');
  if (!resolved.brand.pack.features.jobs) {
    throw new HttpError(404, 'feature_off', 'The jobs board is not enabled for this college.');
  }
  return resolved;
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    requireSession(session);
    await jobsFeature();

    const query = parseQuery(request, ListQuery);

    // `state=all` is a moderator view. The repository already returns
    // nothing to anyone else, but refusing here says why.
    if (query.state === 'all' && !can(session, 'job.moderate')) {
      throw new HttpError(403, 'forbidden', 'Only a moderator can list every posting, whatever its state.');
    }

    const items = getJobs(session, {
      state: query.state ?? 'live',
      q: query.q,
      internshipsOnly: query.internships,
      mine: query.mine,
    });

    return json({
      state: query.state ?? 'live',
      total: items.length,
      canPost: can(session, 'job.post'),
      canModerate: can(session, 'job.moderate'),
      items: items.map((j) => ({
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location,
        isInternship: j.isInternship,
        description: j.description,
        applyUrl: j.applyUrl,
        state: j.state,
        closesOn: j.closesOn,
        createdAt: j.createdAt,
        experienceYears: j.experienceYears,
        salaryRange: j.salaryRange,
        skills: j.skills,
        applicationCount: j.applicationCount,
        viewerHasApplied: j.viewerHasApplied,
        // Only a moderator has any business reading the rejection note.
        moderationNote: can(session, 'job.moderate') ? j.moderationNote : null,
        postedBy: narrowSummary(session, j.postedBy),
      })),
    });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    requireCap(session, 'job.post');
    const { tenant } = await jobsFeature();

    limit(
      `job-post:${session.memberId}`,
      5,
      24 * 60 * 60,
      'Five postings in a day is the limit. If you are hiring at scale, the placement cell can post in bulk for you.',
    );

    const body = await readJson(request, CreateBody);

    if (body.closesOn) {
      const closes = new Date(`${body.closesOn}T23:59:59`);
      if (Number.isNaN(closes.getTime()) || closes.getTime() < Date.now()) {
        throw new HttpError(422, 'invalid_input', 'That closing date has already passed.', {
          fieldErrors: { closesOn: 'Pick a date in the future, or leave it blank.' },
        });
      }
    }

    const job = {
      id: draftId('job'),
      title: body.title,
      company: body.company,
      location: body.location ?? null,
      isInternship: body.isInternship,
      description: body.description,
      applyUrl: body.applyUrl ?? null,
      // Never `live`. There is no request parameter that skips the queue.
      state: 'pending_moderation' as const,
      closesOn: body.closesOn ?? null,
      createdAt: new Date().toISOString(),
      experienceYears: body.experienceYears ?? null,
      salaryRange: body.salaryRange ?? null,
      skills: body.skills,
      applicationCount: 0,
      viewerHasApplied: false,
      moderationNote: null,
    };

    // Postings are moderated content with the college's name attached, so
    // the submission is on the record before anyone reviews it.
    await logAudit({
      tenantId: tenant.id,
      session,
      action: 'job.submit',
      resource: 'job_posting',
      resourceId: job.id,
      after: { title: job.title, company: job.company, state: job.state, isInternship: job.isInternship },
      ip: request.headers.get('x-forwarded-for'),
    });

    const write = fixtureWrite();

    return json(
      {
        ok: true,
        ...write,
        job,
        note: 'Your posting is with the placement cell. They publish or refuse it, usually the same working day, and you are told either way.',
      },
      { status: 201 },
    );
  } catch (err) {
    return fail(err);
  }
}
