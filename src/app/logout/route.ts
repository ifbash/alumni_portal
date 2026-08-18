import { NextResponse, type NextRequest } from 'next/server';
import { destroySession } from '@/lib/auth/session';

/**
 * Sign out.
 *
 * A route handler rather than a page, so the cookie is cleared on the
 * server and the browser is redirected in the same response — no
 * intermediate "signing you out…" screen, and no window in which a stale
 * session cookie is still attached to a rendered page.
 *
 * The redirect lands on the public landing page rather than the sign-in
 * screen: someone who has just signed out on a shared machine in the lab
 * should not be looking at a form that offers to sign them back in.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  await destroySession();

  // 303 so the browser follows with a GET regardless of how it arrived,
  // and no-store so a cached redirect cannot resurrect the session view.
  const response = NextResponse.redirect(new URL('/', request.url), 303);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}
