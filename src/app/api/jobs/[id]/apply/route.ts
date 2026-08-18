import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getJobById } from '@/lib/data/repo';
import { draftId, fail, fixtureWrite, HttpError, json, limit, readJsonOptional } from '../../../_lib/http';

/**
 * Apply to a posting.
 *
 * The application carries a note and nothing else. It does not carry
 * CGPA, placement status or a contact block: the poster is an alumnus,
 * and alumni are on the hiring side of this board, not the placement
 * side. What they receive is the applicant's directory profile — the
 * same projection anyone else gets — plus whatever the applicant chose
 * to write.
 */

const Body = z.object({
  note: z
    .string()
    .trim()
    .max(1500, 'Keep it under 1,500 characters. Attach the detail to your CV, not the note.')
    .optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    requireCap(session, 'job.apply');

    const resolved = await getTenantBrand();
    if (!resolved) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');
    if (!resolved.brand.pack.features.jobs) {
      throw new HttpError(404, 'feature_off', 'The jobs board is not enabled for this college.');
    }

    const { id } = await params;

    limit(
      `job-apply:${session.memberId}`,
      30,
      24 * 60 * 60,
      'Thirty applications in a day is the limit. Sending more is not helping your case with the alumni reading them.',
    );

    const job = getJobById(session, id);
    if (!job) {
      throw new HttpError(404, 'not_found', 'That posting is not available.');
    }

    if (job.state !== 'live') {
      throw new HttpError(
        409,
        'not_open',
        job.state === 'closed'
          ? 'This posting has been closed by the person who put it up.'
          : 'This posting is not open for applications yet.',
        { state: job.state },
      );
    }

    if (job.closesOn && new Date(`${job.closesOn}T23:59:59`).getTime() < Date.now()) {
      throw new HttpError(409, 'closed', 'Applications for this role closed on ' + job.closesOn + '.');
    }

    if (job.viewerHasApplied) {
      throw new HttpError(
        409,
        'already_applied',
        'You have already applied to this role. A second application does not move you up the list.',
      );
    }

    if (job.postedBy.id === session.memberId) {
      throw new HttpError(422, 'invalid_input', 'This is your own posting.');
    }

    const { note } = await readJsonOptional(request, Body);
    const write = fixtureWrite();

    return json(
      {
        ok: true,
        ...write,
        application: {
          id: draftId('app'),
          jobId: job.id,
          jobTitle: job.title,
          company: job.company,
          note: note ?? null,
          createdAt: new Date().toISOString(),
        },
        note: `${job.postedBy.fullName} sees your directory profile and this note. Your email is released to them only if your visibility setting allows it.`,
      },
      { status: 201 },
    );
  } catch (err) {
    return fail(err);
  }
}
