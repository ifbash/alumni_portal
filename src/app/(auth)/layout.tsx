import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getTenantBrand } from '@/lib/tenant';
import { yearIn } from '@/lib/format';
import { PoweredBy } from '@/components/shell/PoweredBy';
import { ThemeToggle } from '@/components/ui';
import { AuthPanel, AuthStrip } from './_components/AuthPanel';

/**
 * The sign-in frame, shared by /login, /claim, /verify and /pending.
 *
 * Most alumni arrive here from a WhatsApp link on a phone, so the college
 * has to stay visible at every width:
 *
 *  - **Phones** get a short identity band as the first thing in the form
 *    column: the full institution name, never truncated, the photograph
 *    behind a scrim when the college supplied one.
 *  - **lg and up** get the brand panel on the left, sticky and one
 *    viewport tall, so the college stays in view while the long
 *    registration form scrolls. Photo colleges get the photograph and a
 *    caption card; the rest get aurora, grain and the batch ribbon. See
 *    `_components/AuthPanel.tsx`.
 *
 * Both sit on the college band (`.band-surface`), which is the same colour
 * in light and dark mode.
 *
 * The form column comes first in the DOM and the panel is moved left with
 * `lg:order-first`, so keyboard and screen-reader users reach the form
 * before the decoration. The panel and the strip carry no headings: the
 * page supplies the only h1.
 *
 * Nothing in this group is behind a session, and nothing in it may assume
 * one exists.
 */

/*
 * Keyframes the shared tailwind set does not have, named for this group.
 * Durations and easing come from the tokens where they are used. The
 * global reduced-motion rule shortens every animation to nothing.
 */
const KEYFRAMES = `
@keyframes auth-shake {
  10%, 90% { transform: translateX(-1px); }
  20%, 80% { transform: translateX(3px); }
  30%, 50%, 70% { transform: translateX(-5px); }
  40%, 60% { transform: translateX(5px); }
}
@keyframes auth-slide-in {
  from { opacity: 0; transform: translateX(18px); }
  to   { opacity: 1; transform: none; }
}
`;

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const resolved = await getTenantBrand();
  if (!resolved) notFound();

  const pack = resolved.brand.pack;
  const { copy, assets, features } = pack;

  // With publicLanding off (northgate), `/` redirects straight back to
  // /login, so nothing in the frame may link there.
  const home = features.publicLanding;

  const photo = assets.authImage ?? assets.heroImage;
  const focus = assets.authImage ? assets.authFocus : assets.heroFocus;

  const office = copy.officeName;
  const year = yearIn(pack.locale.timeZone);

  const backLink =
    'inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-secondary transition-colors duration-fast ease-brand hover:text-primary';

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* ------------------------------------------------------- Form column */}
      <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-surface">
        <AuthStrip pack={pack} home={home} photo={photo} focus={focus} />

        {/* A wash of the college colour behind the form: depth without a pattern. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] [background:radial-gradient(60%_100%_at_75%_0%,color-mix(in_srgb,var(--brand-500)_10%,transparent),transparent)]"
        />

        <header className="relative hidden h-14 items-center justify-between px-8 lg:flex">
          {home ? (
            <Link href="/" className={backLink}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to {copy.portalName}
            </Link>
          ) : (
            <Link href="/contact" className={backLink}>
              Contact the {office}
            </Link>
          )}
          <ThemeToggle />
        </header>

        <main
          id="main"
          className="relative flex flex-1 justify-center px-4 pb-12 pt-8 sm:px-8 lg:items-center lg:py-12"
        >
          <div className="w-full max-w-xl">{children}</div>
        </main>

        <footer className="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-6 text-xs text-secondary sm:px-8">
          <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-4">
            <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-primary">
              Privacy notice
            </Link>
            <Link href="/terms" className="inline-flex min-h-11 items-center hover:text-primary">
              Terms of use
            </Link>
            <Link
              href="/contact#cannot-sign-in"
              className="inline-flex min-h-11 items-center hover:text-primary"
            >
              Help signing in
            </Link>
          </nav>
          <ThemeToggle size="lg" className="lg:hidden" />
          <PoweredBy pack={pack} />
        </footer>
      </div>

      {/* ------------------------------------------------------- Brand panel */}
      <aside
        aria-label={copy.institutionName}
        className="band-surface relative hidden lg:order-first lg:block"
      >
        <div className="sticky top-0 h-dvh">
          <AuthPanel pack={pack} home={home} photo={photo} focus={focus} year={year} />
        </div>
      </aside>
    </div>
  );
}
