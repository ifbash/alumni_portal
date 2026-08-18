import { getSession } from '@/lib/auth/session';
import { AuthzError, can, requireSession } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getMemberBySlug } from '@/lib/data/repo';
import { fail, HttpError, json } from '../../_lib/http';

/**
 * One member's profile.
 *
 * `getMemberBySlug` runs both contact-release gates: the viewer must be
 * entitled *and* the owner must have consented via their visibility
 * setting. Role alone is never sufficient — that is DPDP purpose
 * limitation, and it is the part most implementations skip. The `contact`
 * key is absent, not empty, when release is refused.
 *
 * A profile the viewer may not see and a slug that never existed both
 * answer 404. Distinguishing them would let anyone walk the student roll
 * by trying URLs, which is precisely why students cannot list students.
 */

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await getSession();
    requireSession(session);

    const resolved = await getTenantBrand();
    if (!resolved) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');
    if (!resolved.brand.pack.features.directory) {
      throw new HttpError(404, 'feature_off', 'The directory is not enabled for this college.');
    }

    if (!can(session, 'directory.search.alumni') && !can(session, 'directory.search.students')) {
      throw new AuthzError(403, 'forbidden', 'Your account cannot open member profiles.');
    }

    const { slug } = await params;
    const member = getMemberBySlug(session, slug);

    if (!member) {
      throw new HttpError(
        404,
        'not_found',
        'That profile is not available. The link may be old, or the record may not be one you can open.',
      );
    }

    return json({
      member,
      // Says out loud why a contact block is missing, so the client can
      // write "ask to connect" instead of showing an empty row that reads
      // as a data-quality problem.
      contactReleased: member.contact !== null,
      self: member.id === session.memberId,
    });
  } catch (err) {
    return fail(err);
  }
}
