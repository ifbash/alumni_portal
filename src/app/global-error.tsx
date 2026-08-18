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
 * use anything from the design system: the tenant's tokens are exactly
 * what failed to resolve, so `var(--surface)` would be undefined and the
 * page would render as unstyled black on white. Every value here is
 * hardcoded on purpose — it is the only file in the codebase where that
 * is the right call.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: '2rem',
          background: '#faf9f7',
          color: '#18181b',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <main style={{ maxWidth: '34rem' }}>
          <p
            style={{
              margin: 0,
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#b42318',
            }}
          >
            Something went wrong
          </p>

          <h1 style={{ margin: '0.5rem 0 0', fontSize: '1.75rem', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            The portal could not start.
          </h1>

          <p style={{ margin: '1rem 0 0', lineHeight: 1.6, color: '#52525b' }}>
            This is a fault on our side, not something you did. Nothing you were working on has been
            lost. Try again — and if it keeps happening, tell your alumni cell what you were doing
            and quote the reference below.
          </p>

          {error.digest ? (
            <p
              style={{
                margin: '1rem 0 0',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '0.8125rem',
                color: '#71717a',
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={reset}
              style={{
                height: '2.5rem',
                padding: '0 1.25rem',
                border: 'none',
                borderRadius: '8px',
                background: '#18181b',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>

            <a
              href="/"
              style={{
                height: '2.5rem',
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0 1.25rem',
                borderRadius: '8px',
                border: '1px solid #e4e4e7',
                color: '#18181b',
                fontSize: '0.875rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Back to the start
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
