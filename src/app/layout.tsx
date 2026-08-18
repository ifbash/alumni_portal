import type { Metadata, Viewport } from 'next';
import { getTenantBrand } from '@/lib/tenant';
import { THEME_BOOT } from '@/lib/theme-boot';
import { ToastProvider } from '@/components/ui/toast';
import './globals.css';

/**
 * Branding is applied server-side, in the head, before first paint.
 *
 * A client-side theme swap would show default colours for a frame and
 * then repaint. On a white-label portal that does not read as loading —
 * it reads as a broken site, and it is the first thing a college notices.
 * The cost is that every page is dynamic, which is correct here anyway:
 * almost nothing in this app is publicly cacheable.
 */

export async function generateMetadata(): Promise<Metadata> {
  const resolved = await getTenantBrand();
  if (!resolved) return { title: 'Alumni Portal' };

  const { pack } = resolved.brand;

  return {
    title: {
      default: pack.copy.portalName,
      template: `%s · ${pack.copy.portalName}`,
    },
    description: pack.copy.tagline ?? `Alumni portal for ${pack.copy.institutionName}`,
    applicationName: pack.copy.portalName,
    icons: pack.assets.favicon ? { icon: pack.assets.favicon, apple: pack.assets.favicon } : undefined,
    openGraph: {
      title: pack.copy.portalName,
      description: pack.copy.tagline ?? undefined,
      images: pack.assets.ogImage ? [pack.assets.ogImage] : undefined,
      siteName: pack.copy.portalName,
      locale: pack.locale.locale.replace('-', '_'),
      type: 'website',
    },
    // Nothing is indexed until a college explicitly opts in to a public
    // marketing surface. The directory sits behind auth; a crawler that
    // reaches it means something is already wrong.
    robots: { index: false, follow: false },
  };
}

/**
 * Async, because `themeColor` is tenant data.
 *
 * This is what paints the browser chrome around the page on Android — the
 * status bar and the address bar. Hardcoding it meant every college got
 * the same white frame around their own colours, which is the one place a
 * white-label portal is most obviously not white-labelled, and the one
 * place nobody thinks to look.
 *
 * Falls back to plain white and the default dark ground when no tenant
 * resolves, which is the same situation the layout below renders for.
 */
export async function generateViewport(): Promise<Viewport> {
  const resolved = await getTenantBrand();
  const tokens = resolved?.brand.tokens;

  return {
    width: 'device-width',
    initialScale: 1,
    themeColor: [
      { media: '(prefers-color-scheme: light)', color: tokens?.light['--surface'] ?? '#ffffff' },
      { media: '(prefers-color-scheme: dark)', color: tokens?.dark['--surface'] ?? '#0f1115' },
    ],
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const resolved = await getTenantBrand();

  // The one screen in the product that is allowed literal colours, and the
  // reason is structural: no tenant resolved, so no design tokens exist to
  // reference. Everything below is deliberately system-font, inline-styled
  // and dependency-free so it renders even if the stylesheet never loads.
  if (!resolved) {
    return (
      <html lang="en">
        <body>
          <main style={{ padding: '4rem 1.5rem', maxWidth: '32rem', margin: '0 auto', fontFamily: 'system-ui' }}>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Portal not found</h1>
            <p style={{ color: '#52525b', lineHeight: 1.6 }}>
              No college is configured for this address. If you reached this from a link your
              institution sent you, check the address bar — the subdomain is part of it.
            </p>
          </main>
        </body>
      </html>
    );
  }

  const { brand } = resolved;

  return (
    <html lang={brand.pack.locale.locale} suppressHydrationWarning>
      <head>
        {brand.fontHref ? (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
            <link rel="stylesheet" href={brand.fontHref} />
          </>
        ) : null}

        <style id="tenant-brand" dangerouslySetInnerHTML={{ __html: brand.css }} />

        {/*
          Applies a stored theme preference before paint. Allowed through
          the CSP by hash rather than nonce — see lib/theme-boot.ts for
          why: a per-request nonce is not serialised to the client by
          React and produces a hydration mismatch on every page load.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-dvh bg-surface font-body text-primary antialiased">
        <a
          href="#main"
          className="sr-only-focusable absolute left-4 top-4 z-[200] rounded bg-surface-inverse px-4 py-2 text-sm font-semibold text-on-inverse"
        >
          Skip to content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
