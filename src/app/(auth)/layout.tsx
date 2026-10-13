import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ChevronLeft } from 'lucide-react';
import { getTenantBrand } from '@/lib/tenant';
import { capitalise } from '@/lib/branding/copy';
import { Crest } from '@/components/brand/Crest';
import { Logo } from '@/components/brand/Logo';
import { PoweredBy } from '@/components/shell/PoweredBy';
import { ThemeToggle } from '@/components/ui';

/**
 * The sign-in frame, shared by /login, /claim, /verify and /pending.
 *
 * Most alumni arrive here from a WhatsApp link on a phone, so the college
 * has to stay visible at every width:
 *
 *  - **Phones** get an identity strip in the college colour as the first
 *    thing in the form column: the full institution name, never
 *    truncated, and no photo (it would push the form below the fold).
 *  - **lg and up** get the brand panel on the left. It is sticky, so the
 *    college stays in view while the long registration form scrolls.
 *
 * Both sit on the college band (`.band-surface`), which is the same colour
 * in light and dark mode — the panel no longer turns into a light slab in
 * dark mode. When the college supplies a photograph (`authImage`, else
 * `heroImage`) it fills the panel and the text moves onto a scrim caption
 * card; without one, the solid band is the designed state, not a gap.
 *
 * The form column comes first in the DOM and the panel is moved left with
 * `lg:order-first`, so keyboard and screen-reader users reach the form
 * before the decoration. The panel and the strip carry no headings: the
 * page supplies the only h1.
 *
 * Nothing in this group is behind a session, and nothing in it may assume
 * one exists.
 */
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
  const address = copy.addressLines.filter((line) => line !== copy.institutionName).join(', ');
  const welcome =
    'Find your batchmates, come back to campus, and help the students coming up behind you.';

  // ---------------------------------------------------------------- strip
  const stripBody = (
    <>
      {home ? <ChevronLeft className="size-4 shrink-0" aria-hidden="true" /> : null}
      <Crest pack={pack} size={36} />
      <span className="min-w-0">
        <span className="block font-display text-base font-semibold leading-snug text-band-fg">
          {copy.institutionName}
        </span>
        <span className="block text-xs text-band-muted">{copy.portalName}</span>
      </span>
      {home ? <span className="sr-only"> — back to the home page</span> : null}
    </>
  );
  const stripClass = 'flex min-h-16 items-center gap-3 px-4 py-3 sm:px-8';

  // ------------------------------------------------------------ panel logo
  const panelLogo = (height: number) =>
    home ? (
      <Link
        href="/"
        aria-label={`${copy.portalName} — home`}
        className="inline-flex min-h-11 items-center self-start"
      >
        <Logo pack={pack} variant="band" height={height} />
      </Link>
    ) : (
      <div className="inline-flex min-h-11 items-center self-start">
        <Logo pack={pack} variant="band" height={height} />
      </div>
    );

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* ------------------------------------------------------- Form column */}
      <div className="flex min-h-dvh flex-col bg-surface">
        {/* Identity on phones. The college colour, the full name, no photo. */}
        <div className="band-surface lg:hidden">
          {home ? (
            <Link href="/" className={stripClass}>
              {stripBody}
            </Link>
          ) : (
            <div className={stripClass}>{stripBody}</div>
          )}
        </div>

        <header className="hidden h-14 items-center justify-between px-8 lg:flex">
          {home ? (
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-secondary transition-colors duration-fast ease-brand hover:text-primary"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to {copy.portalName}
            </Link>
          ) : (
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-secondary transition-colors duration-fast ease-brand hover:text-primary"
            >
              Contact the {office}
            </Link>
          )}
          <ThemeToggle />
        </header>

        <main
          id="main"
          className="flex flex-1 justify-center px-4 pb-12 pt-6 sm:px-8 lg:items-center lg:py-12"
        >
          <div className="w-full max-w-xl">{children}</div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-6 text-xs text-secondary sm:px-8">
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
        <div className="sticky top-0 isolate flex h-dvh flex-col justify-between overflow-hidden p-10 xl:p-12">
          {photo ? (
            <>
              {/*
                Tenant-supplied, arbitrary host — see next.config.ts on why
                brand imagery bypasses the optimiser. Decorative: the caption
                card names the college.
              */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 -z-10 size-full object-cover"
                style={{ objectPosition: focus }}
              />

              {/* Text never sits on the photo itself: only on the audited
                  scrim, and only in band-fg. */}
              <div className="mt-auto max-w-md space-y-4 rounded-lg border border-band-rule bg-scrim p-8">
                <Crest pack={pack} size={48} />
                {panelLogo(28)}
                <p className="font-display text-display-sm font-bold text-band-fg">
                  {copy.institutionName}
                </p>
                {copy.tagline ? <p className="text-md text-band-fg">{copy.tagline}</p> : null}
                <p className="text-md text-band-fg">{welcome}</p>
              </div>
            </>
          ) : (
            <>
              {panelLogo(30)}

              <div className="max-w-md space-y-5">
                <Crest pack={pack} size={64} />
                <p className="text-sm font-semibold text-band-accent">{copy.portalName}</p>
                <p className="font-display text-display-sm font-bold text-band-fg">
                  {copy.institutionName}
                </p>
                {copy.tagline ? <p className="text-md text-band-muted">{copy.tagline}</p> : null}
                {copy.affiliationLine ? (
                  <p className="text-sm text-band-muted">{copy.affiliationLine}</p>
                ) : null}
                <span aria-hidden="true" className="block h-px w-16 bg-band-accent" />
                <p className="text-md text-band-fg">{welcome}</p>
                {address ? <p className="text-sm text-band-muted">{address}</p> : null}
                {copy.supportEmail ? (
                  <p className="text-sm text-band-fg">
                    {capitalise(office)} ·{' '}
                    <a className="underline underline-offset-4" href={`mailto:${copy.supportEmail}`}>
                      {copy.supportEmail}
                    </a>
                  </p>
                ) : null}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
