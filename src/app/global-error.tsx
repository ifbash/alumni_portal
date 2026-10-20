'use client';

/**
 * Last-resort error boundary.
 *
 * This one catches failures in the root layout itself — which, on this
 * app, means tenant resolution or brand-token generation threw. That is
 * the one failure the ordinary `error.tsx` cannot handle, because
 * `error.tsx` renders *inside* the layout that just died.
 *
 * It therefore has to supply its own `<html>` and `<body>`, and it cannot
 * rely on the design system: the tenant's tokens are exactly what failed
 * to resolve, so `var(--band)` may be undefined and Tailwind's stylesheet
 * is not guaranteed to be in the document. Everything below is a plain
 * stylesheet in one `<style>` element, system fonts, no imports.
 *
 * Every colour is a literal, on purpose — the only file in the codebase
 * where that is the right call. They are the same neutral-navy fallbacks
 * `globals.css` defines on `:root` (brand 600 for the band, the neutral
 * ramp for the ground), and each is written as `var(--token, literal)`, so
 * if a tenant's tokens did survive, the screen is the college's colour,
 * and if not it is still a designed screen rather than black on white.
 *
 * Same shape as `StatusPanel` (a lit band, one sentence, one primary and
 * one secondary action, the reference folded under "Technical details"),
 * restated here because that component is Tailwind.
 */

const CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: 1.25rem;
    background: var(--surface, #faf9f7);
    color: var(--text-primary, #18181b);
    font-family: var(--font-body, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif);
    -webkit-font-smoothing: antialiased;
  }
  .ge-wrap { width: 100%; max-width: 44rem; }

  .ge-band {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    border-radius: 18px;
    padding: 2.5rem 1.5rem;
    background: var(--band, #1f3864);
    color: var(--band-fg, #ffffff);
    box-shadow: 0 12px 32px -8px rgba(24, 24, 27, 0.28), inset 0 0 0 1px rgba(255, 255, 255, 0.16);
    animation: ge-in 520ms cubic-bezier(0.32, 0.72, 0, 1) both;
  }
  @media (min-width: 40rem) { .ge-band { padding: 3.5rem 3.5rem; } }

  /* Soft light behind the words, as on every college band. Transform-only drift. */
  .ge-aurora { position: absolute; inset: 0; z-index: -2; overflow: hidden; pointer-events: none; }
  .ge-aurora::before, .ge-aurora::after { content: ""; position: absolute; border-radius: 9999px; filter: blur(56px); }
  .ge-aurora::before {
    width: 34rem; height: 34rem; right: -10rem; top: -14rem;
    background: radial-gradient(closest-side, rgba(246, 217, 160, 0.24), transparent 72%);
    animation: ge-drift 26s ease-in-out infinite alternate;
  }
  .ge-aurora::after {
    width: 28rem; height: 28rem; left: -12rem; bottom: -16rem;
    background: radial-gradient(closest-side, rgba(255, 255, 255, 0.12), transparent 70%);
    animation: ge-drift 32s ease-in-out infinite alternate-reverse;
  }
  .ge-grain {
    position: absolute; inset: 0; z-index: -1; pointer-events: none; opacity: 0.16; mix-blend-mode: soft-light;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 .9 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
    background-size: 160px 160px;
  }

  .ge-eyebrow {
    display: inline-flex; align-items: center; gap: 0.75rem; margin: 0;
    font-size: 0.75rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--band-accent, #f6d9a0);
  }
  .ge-eyebrow::before { content: ""; width: 2rem; height: 1px; background: currentColor; opacity: 0.55; }

  .ge-title {
    margin: 0.75rem 0 0;
    font-family: var(--font-display, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif);
    font-size: clamp(1.85rem, 5.5vw, 2.6rem);
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.02em;
    text-wrap: balance;
    color: var(--band-fg, #ffffff);
  }
  .ge-copy { margin: 1rem 0 0; max-width: 36rem; font-size: 1.0625rem; line-height: 1.6; color: var(--band-muted, #dbe4f2); }

  .ge-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 2rem; }
  .ge-btn {
    display: inline-flex; align-items: center; justify-content: center;
    min-height: 3rem; padding: 0 1.5rem;
    border-radius: 12px; font: inherit; font-size: 1.0625rem; font-weight: 600;
    text-decoration: none; cursor: pointer;
    transition: background-color 120ms ease, transform 120ms ease;
  }
  .ge-btn:active { transform: translateY(1px); }
  .ge-btn:focus-visible { outline: 2px solid var(--band-fg, #ffffff); outline-offset: 3px; }
  .ge-primary { border: 0; background: var(--band-fg, #ffffff); color: var(--band, #1f3864); }
  .ge-primary:hover { background: var(--band-muted, #dbe4f2); }
  .ge-secondary { border: 1px solid var(--band-muted, #dbe4f2); background: transparent; color: var(--band-fg, #ffffff); }
  .ge-secondary:hover { background: rgba(255, 255, 255, 0.12); }

  .ge-details {
    margin-top: 1rem;
    border: 1px solid var(--border, #e4e4e7);
    border-radius: 12px;
    background: var(--surface-raised, #ffffff);
    font-size: 0.875rem;
    color: var(--text-secondary, #52525b);
  }
  .ge-details summary {
    display: flex; align-items: center; gap: 0.5rem;
    min-height: 2.75rem; padding: 0 1rem; cursor: pointer; list-style: none; font-weight: 600;
    border-radius: 12px;
  }
  .ge-details summary::-webkit-details-marker { display: none; }
  .ge-details summary:hover { color: var(--text-primary, #18181b); }
  .ge-details summary:focus-visible { outline: 2px solid var(--focus-ring, #1f3864); outline-offset: 2px; }
  .ge-details summary::before {
    content: ""; width: 0.45rem; height: 0.45rem;
    border-right: 2px solid currentColor; border-bottom: 2px solid currentColor;
    transform: rotate(-45deg); transition: transform 120ms ease;
  }
  .ge-details[open] summary::before { transform: rotate(45deg); }
  .ge-details-body { padding: 0.75rem 1rem 1rem; border-top: 1px solid var(--border, #e4e4e7); }
  .ge-details-body p { margin: 0; line-height: 1.55; }
  .ge-details-body p + p { margin-top: 0.75rem; }
  .ge-ref { display: block; margin-top: 0.25rem; word-break: break-all; user-select: all;
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 0.875rem; color: var(--text-primary, #18181b); }
  .ge-label { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted, #71717a); }

  @media (prefers-color-scheme: dark) {
    body { background: var(--surface, #101317); color: var(--text-primary, #fafafa); }
    .ge-details { background: var(--surface-raised, #181b21); border-color: var(--border, #2a2f38); color: var(--text-secondary, #a1a1aa); }
    .ge-details-body { border-color: var(--border, #2a2f38); }
    .ge-details summary:hover, .ge-ref { color: var(--text-primary, #fafafa); }
    .ge-details summary:focus-visible { outline-color: #ffffff; }
  }

  @keyframes ge-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
  @keyframes ge-drift { from { transform: translate3d(0, 0, 0) scale(1); } to { transform: translate3d(-6%, 8%, 0) scale(1.12); } }
  @media (prefers-reduced-motion: reduce) {
    .ge-band, .ge-aurora::before, .ge-aurora::after { animation: none; }
    .ge-btn { transition: none; }
  }
`;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>The portal could not start</title>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <main className="ge-wrap">
          <section className="ge-band" aria-labelledby="ge-title">
            <div className="ge-aurora" aria-hidden="true" />
            <div className="ge-grain" aria-hidden="true" />

            <p className="ge-eyebrow">Something went wrong</p>
            <h1 id="ge-title" className="ge-title">
              The portal could not start
            </h1>
            <p className="ge-copy">
              A fault on our side stopped the portal from opening. It is not something you did, and
              nothing you were working on has been lost. Try again. If it keeps happening, tell your
              alumni cell what you were doing and quote the reference under Technical details.
            </p>

            <div className="ge-actions">
              <button type="button" className="ge-btn ge-primary" onClick={reset}>
                Try again
              </button>
              {/* A plain anchor on purpose: this boundary replaces the root layout, and the client router may be exactly what failed. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" className="ge-btn ge-secondary">
                Back to the start
              </a>
            </div>
          </section>

          <details className="ge-details">
            <summary>Technical details</summary>
            <div className="ge-details-body">
              <p>
                <span className="ge-label">Reference</span>
                <code className="ge-ref">{error.digest ?? 'not recorded'}</code>
              </p>
              <p>It is what the alumni cell can search the server logs on.</p>
            </div>
          </details>
        </main>
      </body>
    </html>
  );
}
