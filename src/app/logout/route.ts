import { NextResponse } from 'next/server';
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

export async function GET() {
  await destroySession();

  // 303 so the browser follows with a GET regardless of how it arrived,
  // and no-store so a cached redirect cannot resurrect the session view.
  //
  // `Location` is relative on purpose. `NextResponse.redirect()` needs an
  // absolute URL, and the only one to hand is `request.url` - which behind
  // a proxy, or in a standalone build bound to 0.0.0.0, is the internal
  // address, not the one in the browser's address bar.
  return new NextResponse(null, {
    status: 303,
    headers: { Location: '/', 'Cache-Control': 'no-store, max-age=0' },
  });
}
