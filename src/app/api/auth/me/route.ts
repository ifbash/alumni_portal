import { getSession } from '@/lib/auth/session';
import { requireSession } from '@/lib/auth/guard';
import { fail, json } from '../../_lib/http';
import { sessionView } from '../../_lib/session-view';

/**
 * Who am I, and what may I do.
 *
 * The capability list is the whole point: a client that has to infer
 * permissions from role names ends up with its own copy of the matrix,
 * and two copies of an authorisation rule is one rule and one bug. The
 * navigation, the action buttons and the empty states all read from this
 * list; the server still refuses independently on every route, because
 * hiding a control is presentation, not authorisation.
 *
 * Never cached. A revoked HOD must lose the admin nav on their next
 * request, not when a CDN entry happens to age out.
 */

export async function GET() {
  try {
    const session = await getSession();
    requireSession(session);
    return json(sessionView(session));
  } catch (err) {
    return fail(err);
  }
}
