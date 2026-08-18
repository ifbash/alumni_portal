import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BadgeCheck, KeyRound, ShieldCheck } from 'lucide-react';
import { getTenantBrand } from '@/lib/tenant';
import { Logo } from '@/components/brand/Logo';
import { GridBackdrop } from '@/components/brand/Marks';
import { PoweredBy } from '@/components/shell/PoweredBy';
import { ThemeToggle } from '@/components/ui';

/**
 * The sign-in frame.
 *
 * A split screen: the college's identity on one side, one job on the
 * other. The brand panel is hidden below `lg` rather than stacked — on a
 * phone, a decorative panel above the form pushes the only control on the
 * page below the fold, and most alumni arrive here from a WhatsApp link
 * on a phone.
 *
 * Nothing in this group is behind a session, and nothing in it may assume
 * one exists.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const resolved = await getTenantBrand();
  if (!resolved) notFound();

  const pack = resolved.brand.pack;
  const { copy, assets } = pack;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* ------------------------------------------------------ Brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-surface-inverse p-10 text-on-inverse lg:flex xl:p-12">
        {assets.authImage ? (
          // Tenant-supplied, arbitrary host — see next.config.ts on why brand
          // imagery bypasses the optimiser.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={assets.authImage}
            alt=""
            className="absolute inset-0 size-full object-cover"
            aria-hidden="true"
          />
        ) : (
          <GridBackdrop />
        )}

        <div className="relative">
          <Link href="/" className="link-quiet" aria-label={`${copy.portalName} — home`}>
            <Logo pack={pack} variant="inverse" height={30} />
          </Link>
        </div>

        <div className="relative max-w-md space-y-6">
          <p className="font-display text-display-sm font-bold text-on-inverse">
            {copy.institutionName}
          </p>
          {copy.tagline ? <p className="text-md text-on-inverse">{copy.tagline}</p> : null}

          <ul className="space-y-4 pt-2">
            <PanelPoint icon={<KeyRound className="size-4" aria-hidden="true" />}>
              No password. A six-digit code goes to the email address the college has for you, and it
              works once.
            </PanelPoint>
            <PanelPoint icon={<BadgeCheck className="size-4" aria-hidden="true" />}>
              Every account is matched against the degree register from the examinations branch
              before it can see anybody.
            </PanelPoint>
            <PanelPoint icon={<ShieldCheck className="size-4" aria-hidden="true" />}>
              Your contact details are released only to the people you have agreed can see them.
              Never to students.
            </PanelPoint>
          </ul>
        </div>

        <p className="relative text-xs text-on-inverse">
          {copy.addressLines[0] ?? copy.institutionName}
        </p>
      </aside>

      {/* ------------------------------------------------------- Form column */}
      <div className="flex min-h-dvh flex-col bg-surface">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 sm:px-8">
          <Link href="/" className="link-quiet lg:hidden" aria-label={`${copy.portalName} — home`}>
            <Logo pack={pack} height={24} />
          </Link>

          <Link
            href="/"
            className="hidden items-center gap-1.5 text-sm font-medium text-secondary transition-colors duration-fast ease-brand hover:text-primary lg:inline-flex"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to {copy.portalName}
          </Link>

          <ThemeToggle />
        </header>

        <main id="main" className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8 sm:py-12">
          <div className="w-full max-w-xl">{children}</div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-6 text-xs text-muted sm:px-8">
          <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href="/privacy" className="link-quiet">
              Privacy notice
            </Link>
            <Link href="/terms" className="link-quiet">
              Terms of use
            </Link>
            {copy.supportEmail ? (
              <a href={`mailto:${copy.supportEmail}`} className="link-quiet">
                Need help signing in?
              </a>
            ) : null}
          </nav>
          <PoweredBy pack={pack} />
        </footer>
      </div>
    </div>
  );
}

function PanelPoint({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm text-on-inverse">
      <span
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-[color-mix(in_srgb,currentColor_30%,transparent)]"
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}
