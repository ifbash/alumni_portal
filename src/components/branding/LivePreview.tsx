'use client';

import * as React from 'react';
import { AlertTriangle, Check, Moon, Sun } from 'lucide-react';
import { Alert, Badge, Card, CardBody, CardDescription, CardHeader, CardTitle, Spinner } from '@/components/ui';
import { api } from '@/lib/client/api';
import { cn } from '@/lib/cn';
import type { ContrastReportValue } from './ContrastReport';

/**
 * The portal, restyled, live.
 *
 * Four decisions here are load-bearing.
 *
 * **The stylesheet comes from the server.** Given a `resolve` payload this
 * panel posts it to `POST /api/admin/branding?preview=1` — the same
 * resolver the page renderer runs — debounces at 300ms, and aborts the
 * request in flight when a newer edit arrives. It never derives a token
 * itself. A client-side approximation of the OKLCH ramp, the contrast
 * walk and the dark-mode derivation would agree with the server on the
 * day it was written and drift quietly afterwards, and the entire claim of
 * this screen is that what is previewed is what ships. While a request is
 * in flight the previous frame stays on screen — a preview that blanks
 * between keystrokes is unreadable, and a blank frame reads as a broken
 * brand rather than a pending request.
 *
 * **It is a real screen, not a palette.** A registrar looking at forty
 * colour chips cannot tell you whether their college's portal looks right.
 * A registrar looking at their own wordmark, their own wording, a member
 * card and a primary button can tell you in two seconds. So the frame
 * renders a header, a hero, a search field with a visible focus ring, a
 * status badge row, two member cards — one deliberately sparse, because
 * most records are — a table of roll numbers, an alert and a dark footer
 * band. Every audited token appears somewhere in it.
 *
 * **It prefers an iframe.** The CSS the server returns targets `:root` and
 * `[data-theme="dark"]`. Rewriting those selectors to scope them into the
 * page means previewing something subtly other than what ships, and the
 * whole claim of this screen is that the preview *is* the artefact. An
 * iframe isolates the custom properties genuinely, which is also what lets
 * both modes render side by side at the same instant — dark mode is
 * derived, never configured, so seeing it is the only way to confirm the
 * derivation held.
 *
 * **It survives a strict CSP.** `frame-src` is `'none'` in this app's
 * middleware, and browsers disagree about whether that blocks an
 * `about:srcdoc` frame. If the frame comes up empty, the same markup is
 * rendered inline with the token block rescoped, and the panel says so.
 * A flagship screen that silently shows two blank boxes on a hardened
 * deployment is worse than one that degrades and admits it.
 *
 * The frame markup is written once and never re-mounted. Colours arrive by
 * replacing the text of a `<style>`, and wording by setting text nodes, so
 * nothing flashes between edits.
 */

export interface PreviewCopy {
  portalName: string;
  institutionName: string;
  shortName: string;
  tagline: string;
  heroHeadline: string;
  heroEmphasis: string;
  heroSubhead: string;
  supportEmail: string;
}

export type PreviewFeatures = Record<string, boolean>;

// ---------------------------------------------------------------
// The preview's own stylesheet
// ---------------------------------------------------------------
//
// Every rule is scoped under `.pv-app` and every value is a token, so the
// same string works inside the frame and inline in the page. No literal
// colour, radius, font, shadow or duration appears in it.

const FRAME_CSS = `
.pv-app,.pv-app *,.pv-app *::before,.pv-app *::after{box-sizing:border-box}
.pv-app{display:flex;flex-direction:column;background:var(--surface);color:var(--text-primary);
  font-family:var(--font-body);font-size:var(--text-sm);line-height:1.55;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
.pv-app h1,.pv-app p,.pv-app table{margin:0}
.pv-app h1{font-family:var(--font-display);font-weight:700;
  letter-spacing:var(--tracking-display);color:var(--text-primary)}

.pv-top{display:flex;align-items:center;gap:8px;height:48px;padding:0 12px;
  background:var(--surface-raised);border-bottom:var(--border-width) solid var(--border)}
.pv-mark{display:grid;place-items:center;width:24px;height:24px;flex:none;
  border-radius:var(--radius-sm);background:var(--button-primary-bg);
  color:var(--button-primary-fg);font-family:var(--font-display);
  font-weight:700;font-size:var(--text-xs)}
.pv-word{font-family:var(--font-display);font-weight:700;font-size:var(--text-sm);
  letter-spacing:var(--tracking-display);white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis;max-width:9rem}
.pv-nav{display:flex;gap:1px;margin-left:auto;overflow:hidden}
.pv-link{padding:5px 7px;border-radius:var(--radius-sm);font-size:var(--text-xs);
  font-weight:500;color:var(--text-secondary);text-decoration:none;white-space:nowrap}
.pv-link[hidden]{display:none}
.pv-link-on{color:var(--brand-fg);background:var(--brand-soft)}
.pv-face{display:grid;place-items:center;flex:none;border-radius:var(--radius-full);
  background:var(--brand-soft);color:var(--brand-soft-fg);font-weight:600;
  box-shadow:inset 0 0 0 1px var(--border)}
.pv-face-sm{width:24px;height:24px;font-size:var(--text-xs)}
.pv-face-lg{width:38px;height:38px;font-size:var(--text-sm)}

.pv-main{flex:1;display:flex;flex-direction:column;gap:14px;padding:16px 12px 20px}
.pv-eyebrow{font-size:var(--text-xs);font-weight:700;text-transform:uppercase;
  letter-spacing:.09em;color:var(--brand-fg)}
.pv-h1{font-size:var(--display-xs);line-height:1.15;margin-top:4px}
.pv-em{background-color:transparent;color:inherit;padding-inline:.08em;
  background-image:linear-gradient(transparent 62%,var(--marker) 62%,
    var(--marker) 92%,transparent 92%);
  background-repeat:no-repeat;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.pv-sub{font-size:var(--text-sm);color:var(--text-secondary);max-width:48ch}

.pv-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.pv-btn{display:inline-flex;align-items:center;height:var(--control-h);padding:0 14px;
  border-radius:var(--radius);border:var(--border-width) solid transparent;
  font-family:inherit;font-size:var(--text-sm);font-weight:600;cursor:default}
.pv-btn-primary{background:var(--button-primary-bg);color:var(--button-primary-fg);
  box-shadow:var(--shadow-sm)}
.pv-btn-secondary{background:var(--surface-raised);color:var(--text-primary);
  border-color:var(--border)}

.pv-field{display:flex;flex-direction:column;gap:5px}
.pv-label{font-size:var(--text-sm);font-weight:500;color:var(--text-primary)}
.pv-input{display:block;width:100%;height:var(--control-h);margin-top:5px;padding:0 10px;
  font-family:inherit;font-size:var(--text-sm);color:var(--text-primary);
  background:var(--surface-raised);border:var(--border-width) solid var(--focus-ring);
  border-radius:var(--radius);outline:2px solid var(--focus-ring);outline-offset:2px}
.pv-hint{font-size:var(--text-xs);color:var(--text-secondary)}

.pv-badges{display:flex;flex-wrap:wrap;gap:5px}
.pv-badge{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;
  border-radius:var(--radius-full);font-size:var(--text-xs);font-weight:600}
.pv-dot{width:6px;height:6px;border-radius:var(--radius-full);background:currentColor}
.pv-b-success{background:var(--success-soft);color:var(--success-fg)}
.pv-b-warning{background:var(--warning-soft);color:var(--warning-fg)}
.pv-b-info{background:var(--info-soft);color:var(--info-fg)}
.pv-b-brand{background:var(--brand-soft);color:var(--brand-soft-fg)}
.pv-b-accent{background:var(--accent-soft);color:var(--accent-soft-fg)}
.pv-b-neutral{background:var(--surface-sunken);color:var(--text-secondary)}
.pv-b-outline{border:var(--border-width) solid var(--border-strong);color:var(--text-secondary)}

.pv-cards{display:grid;gap:10px;grid-template-columns:1fr}
@media (min-width:32rem){.pv-cards{grid-template-columns:1fr 1fr}}
.pv-card{display:flex;flex-direction:column;gap:8px;padding:var(--card-p);
  background:var(--surface-raised);border:var(--border-width) solid var(--border);
  border-radius:var(--radius-lg);box-shadow:var(--shadow-sm)}
.pv-card-head{display:flex;gap:10px;align-items:flex-start}
.pv-name{font-family:var(--font-display);font-size:var(--text-md);font-weight:600;line-height:1.25}
.pv-meta{font-size:var(--text-xs);color:var(--text-secondary)}
.pv-quiet{font-size:var(--text-xs);color:var(--text-muted)}

.pv-tablewrap{overflow:hidden;background:var(--surface-raised);
  border:var(--border-width) solid var(--border);border-radius:var(--radius-lg)}
.pv-table{width:100%;border-collapse:collapse;font-size:var(--text-sm)}
.pv-table thead{background:var(--surface-sunken);
  border-bottom:var(--border-width) solid var(--border)}
.pv-table th{padding:8px 10px;text-align:left;font-size:var(--text-xs);font-weight:600;
  text-transform:uppercase;letter-spacing:.05em;color:var(--text-secondary);white-space:nowrap}
.pv-table td{padding:9px 10px;border-top:var(--border-width) solid var(--border)}
.pv-table tbody tr:first-child td{border-top:0}
.pv-mono{font-family:var(--font-mono);font-size:var(--text-xs);font-variant-numeric:tabular-nums}

.pv-alert{display:flex;gap:9px;padding:11px 12px;font-size:var(--text-xs);
  background:var(--warning-soft);color:var(--warning-fg);border-radius:var(--radius-lg);
  border:var(--border-width) solid color-mix(in srgb,currentColor 26%,transparent)}
.pv-alert strong{display:block;font-size:var(--text-sm)}

.pv-foot{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;padding:12px;
  background:var(--surface-inverse);color:var(--text-on-inverse);font-size:var(--text-xs)}
`;

/**
 * The markup. Hooks are `data-pv` attributes rather than ids, because the
 * inline fallback puts both modes in one document and duplicate ids there
 * would be invalid and would break the lookups.
 */
const FRAME_BODY = `
<div class="pv-app" inert>
  <header class="pv-top">
    <span class="pv-mark" data-pv="mark">DI</span>
    <span class="pv-word" data-pv="portal">DIET Connect</span>
    <nav class="pv-nav">
      <a class="pv-link pv-link-on" data-feature="directory" href="#">Directory</a>
      <a class="pv-link" data-feature="connections" href="#">Connections</a>
      <a class="pv-link" data-feature="events" href="#">Events</a>
      <a class="pv-link" data-feature="jobs" href="#">Jobs</a>
      <a class="pv-link" data-feature="donations" href="#">Giving</a>
    </nav>
    <span class="pv-face pv-face-sm">RK</span>
  </header>

  <main class="pv-main">
    <div>
      <p class="pv-eyebrow" data-pv="tagline">Ganguru, Vijayawada</p>
      <h1 class="pv-h1" data-pv="hero">Every graduate, still reachable.</h1>
    </div>
    <p class="pv-sub" data-pv="sub"></p>

    <div class="pv-row">
      <span class="pv-btn pv-btn-primary">Invite the 2019 batch</span>
      <span class="pv-btn pv-btn-secondary">Open the degree register</span>
    </div>

    <div class="pv-field">
      <label class="pv-label">Search alumni
        <input class="pv-input" value="CSE 2017 Hyderabad" readonly tabindex="-1">
      </label>
      <p class="pv-hint">Name, roll number, branch, company or city. Contact details stay hidden
        until the alumnus has agreed to share them.</p>
    </div>

    <div class="pv-badges">
      <span class="pv-badge pv-b-success"><span class="pv-dot"></span>Verified</span>
      <span class="pv-badge pv-b-warning"><span class="pv-dot"></span>Awaiting review</span>
      <span class="pv-badge pv-b-info">Final year</span>
      <span class="pv-badge pv-b-brand">Refers</span>
      <span class="pv-badge pv-b-accent">Speaks</span>
      <span class="pv-badge pv-b-neutral">Unclaimed</span>
    </div>

    <div class="pv-cards">
      <article class="pv-card">
        <div class="pv-card-head">
          <span class="pv-face pv-face-lg">SK</span>
          <div>
            <p class="pv-name">Sravani Kolli</p>
            <p class="pv-meta">CSE &middot; Batch of 2017</p>
          </div>
        </div>
        <p class="pv-meta">Senior Engineer &middot; Zoho</p>
        <p class="pv-meta">Chennai, Tamil Nadu</p>
        <div class="pv-badges">
          <span class="pv-badge pv-b-outline">Java</span>
          <span class="pv-badge pv-b-outline">Distributed systems</span>
        </div>
        <div class="pv-badges">
          <span class="pv-badge pv-b-success"><span class="pv-dot"></span>Mentors</span>
          <span class="pv-badge pv-b-brand"><span class="pv-dot"></span>Refers</span>
        </div>
      </article>

      <article class="pv-card">
        <div class="pv-card-head">
          <span class="pv-face pv-face-lg">MI</span>
          <div>
            <p class="pv-name">Md. Imran Basha</p>
            <p class="pv-meta">ECE &middot; Batch of 2014</p>
          </div>
        </div>
        <p class="pv-quiet">No details shared yet</p>
        <p class="pv-quiet">Most records look like this one. The card has to read as finished with
          nothing but a name, a branch and a year.</p>
      </article>
    </div>

    <div class="pv-tablewrap">
      <table class="pv-table">
        <thead>
          <tr><th>Roll number</th><th>Name</th><th>Branch</th><th>Status</th></tr>
        </thead>
        <tbody>
          <tr>
            <td class="pv-mono">17KN1A0512</td><td>Sravani Kolli</td><td>CSE</td>
            <td><span class="pv-badge pv-b-success"><span class="pv-dot"></span>Verified</span></td>
          </tr>
          <tr>
            <td class="pv-mono">14KN1A0431</td><td>Md. Imran Basha</td><td>ECE</td>
            <td><span class="pv-badge pv-b-warning"><span class="pv-dot"></span>Review</span></td>
          </tr>
          <tr>
            <td class="pv-mono">21KN1A05B7</td><td>Harika Vemuri</td><td>CSE</td>
            <td><span class="pv-badge pv-b-info">Final year</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pv-alert">
      <div>
        <strong>Giving is switched off</strong>
        The donations module stays dark until the college confirms its FCRA registration. Foreign
        contributions have to be segregated at the point of collection, or not collected at all.
      </div>
    </div>
  </main>

  <footer class="pv-foot">
    <span data-pv="inst">Dhanekula Institute of Engineering &amp; Technology</span>
    <span aria-hidden="true">&middot;</span>
    <span data-pv="support">alumni@diet.ac.in</span>
  </footer>
</div>
`;

function frameDoc(mode: 'light' | 'dark'): string {
  return `<!doctype html><html lang="en" data-theme="${mode}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link data-pv="font" rel="stylesheet">
<style data-pv="faces"></style>
<style data-pv="tokens"></style>
<style>html,body{margin:0;padding:0}.pv-app{min-height:100vh}${FRAME_CSS}</style>
</head><body>${FRAME_BODY}</body></html>`;
}

const DOC_LIGHT = frameDoc('light');
const DOC_DARK = frameDoc('dark');

// ---------------------------------------------------------------

/** What the resolver answered. Handed up so the parent can gate Publish. */
export interface PreviewResolution {
  css: string;
  fontHref: string | null;
  report: ContrastReportValue;
  /** False when the audit found errors. Publishing must stay disabled. */
  publishable: boolean;
}

/** The body `POST /api/admin/branding?preview=1` returns. */
interface PreviewResponse {
  css?: string;
  fontHref?: string | null;
  report?: ContrastReportValue;
  publishable?: boolean;
}

/**
 * Long enough that a colour picker being dragged does not fire a request
 * per frame, short enough that a typed hex feels live. Every edit still
 * aborts the request the previous one started.
 */
const DEBOUNCE_MS = 300;

export interface LivePreviewProps {
  /**
   * The branding payload to resolve, in the shape `BrandingInput` accepts.
   * Supplied, this panel keeps itself current from the server. Omitted, it
   * renders whatever `css` it is handed and resolves nothing.
   */
  resolve?: unknown;
  /**
   * Every successful resolution, including the contrast report. The gate
   * is `report.passes`: a parent must not allow Publish while it is false.
   */
  onResolve?: (resolution: PreviewResolution) => void;
  /** A 422 from the resolver, keyed by input name, for the parent's Fields. */
  onInvalid?: (fieldErrors: Record<string, string>) => void;

  /**
   * The stylesheet to render. In resolving mode this is the first frame —
   * server-rendered, already correct — and the resolver's answer replaces
   * it from the first edit onwards. Injected verbatim into the frame.
   */
  css: string;
  fontHref: string | null;
  /** The contrast report for `css`, until a resolution supplies its own. */
  report?: ContrastReportValue;
  /** `@font-face` rules for a pack that self-hosts its typefaces. */
  fontFaceCss?: string;
  copy: PreviewCopy;
  features: PreviewFeatures;
  pending?: boolean;
  className?: string;
}

export function LivePreview({
  resolve,
  onResolve,
  onInvalid,
  css,
  fontHref,
  report,
  fontFaceCss = '',
  copy,
  features,
  pending = false,
  className,
}: LivePreviewProps) {
  const [degraded, setDegraded] = React.useState(false);
  const onBlocked = React.useCallback(() => setDegraded(true), []);

  const [resolved, setResolved] = React.useState<PreviewResolution | null>(null);
  const [resolving, setResolving] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);

  // Callbacks are read through a ref so a parent that rebuilds them each
  // render cannot restart the request loop. Only the payload does that.
  const handlers = React.useRef({ onResolve, onInvalid });
  React.useEffect(() => {
    handlers.current = { onResolve, onInvalid };
  });

  // Serialised, so the effect keys off the values rather than the identity
  // of an object the parent almost certainly rebuilds on every keystroke.
  const payload = React.useMemo(
    () => (resolve === undefined ? null : JSON.stringify(resolve)),
    [resolve],
  );

  React.useEffect(() => {
    if (payload === null) return;

    const controller = new AbortController();
    let live = true;

    // Set before the debounce, not after it: the panel is out of date from
    // the keystroke, not from the moment the request leaves.
    setResolving(true);

    const timer = window.setTimeout(() => {
      void (async () => {
        const outcome = await api.post<PreviewResponse>(
          '/api/admin/branding?preview=1',
          JSON.parse(payload) as object,
          controller.signal,
        );

        // A newer edit has already taken over. Its answer is the only one
        // that may touch the frame.
        if (!live) return;

        setResolving(false);

        if (outcome.status === 'ok') {
          const { css: nextCss, report: nextReport } = outcome.data;
          if (!nextCss || !nextReport) {
            // A 200 with nothing in it. Not worth a crash, and not worth
            // pretending either — the frame stays on the last good answer.
            setProblem(
              'The resolver answered without a stylesheet, so the panels below are one edit old.',
            );
            return;
          }

          const next: PreviewResolution = {
            css: nextCss,
            fontHref: outcome.data.fontHref ?? null,
            report: nextReport,
            publishable: outcome.data.publishable ?? nextReport.passes,
          };
          setProblem(null);
          setResolved(next);
          handlers.current.onResolve?.(next);
          return;
        }

        // Everything below keeps the previous frame. A refusal is a reason
        // the preview is one edit old, not a reason to blank it.
        if (outcome.status === 'invalid') {
          handlers.current.onInvalid?.(normaliseFieldErrors(outcome.fieldErrors));
          setProblem(outcome.message);
          return;
        }

        setProblem(
          outcome.status === 'offline'
            ? 'Nothing reached the server, so the panels below are one edit old.'
            : outcome.message,
        );
      })();
    }, DEBOUNCE_MS);

    return () => {
      live = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [payload]);

  // Once a resolution has arrived it is the whole answer, `null` fonts
  // included: a pack that self-hosts its typefaces returns no href, and
  // falling back to the seed's would reload a family nothing asks for.
  const activeCss = resolved ? resolved.css : css;
  const activeFontHref = resolved ? resolved.fontHref : fontHref;
  const activeReport = resolved ? resolved.report : (report ?? null);
  const busy = pending || resolving;

  const shared = {
    css: activeCss,
    fontHref: activeFontHref,
    fontFaceCss,
    copy,
    features,
    onBlocked,
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="min-w-0 space-y-1">
          <CardTitle as="h2" className="flex flex-wrap items-center gap-2">
            Live preview
            {busy ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-normal text-muted">
                <Spinner className="size-3.5" />
                resolving
              </span>
            ) : null}
          </CardTitle>
          <CardDescription>
            A real fragment of the portal in two panels, styled by the stylesheet the server just
            returned — the same resolver that runs on every page render.
          </CardDescription>
        </div>
      </CardHeader>

      <CardBody className="space-y-3" aria-busy={busy}>
        {activeReport ? <ContrastGate report={activeReport} busy={busy} /> : null}

        {problem ? (
          <Alert
            tone="warning"
            title="These panels are one edit old"
            icon={<AlertTriangle className="size-4" />}
          >
            <p>{problem}</p>
          </Alert>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Panel mode="light" doc={DOC_LIGHT} degraded={degraded} {...shared} />
          <Panel mode="dark" doc={DOC_DARK} degraded={degraded} {...shared} />
        </div>

        <p className="text-xs text-muted">
          Colours, type, corners and density come from the returned stylesheet. The wording and the
          module switches are applied inside the panel — they ship in the pack file rather than
          through this form, so they are shown here but are not part of what Publish writes.
        </p>

        {degraded ? (
          <p className="text-xs text-warning-fg">
            This browser refused the isolated frame — the app&rsquo;s content security policy sets{' '}
            <code className="font-mono">frame-src &lsquo;none&rsquo;</code>. The preview below is
            rendered in the page with the token block rescoped, which is accurate but shares the
            page&rsquo;s width for its own breakpoints.
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

/**
 * The gate, on screen at all times rather than on submit.
 *
 * It states the verdict in words as well as colour, because a red panel is
 * not a reason anybody can act on — and because the one thing an
 * administrator must not be able to miss is that Publish is disabled and
 * why. The full issue list, with the remedy for each token, is the
 * `ContrastReport` card; this is the line that travels with the preview.
 */
function ContrastGate({ report, busy }: { report: ContrastReportValue; busy: boolean }) {
  const failures = report.errors.length;

  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2.5 text-sm',
        report.passes
          ? 'border-success bg-success-soft text-success-fg'
          : 'border-danger bg-danger-soft text-danger-fg',
      )}
    >
      <span className="flex items-center gap-2 font-semibold">
        {report.passes ? (
          <Check className="size-4 shrink-0" aria-hidden="true" />
        ) : (
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        )}
        {report.passes
          ? 'Publishable'
          : `${failures} contrast failure${failures === 1 ? '' : 's'} — publishing is blocked`}
      </span>
      <span className="min-w-0 flex-1 text-xs">{report.summary}</span>
      {busy ? <Badge tone="neutral">rechecking</Badge> : null}
    </div>
  );
}

/**
 * `validateBranding` flattens a Zod error, so each value arrives as an
 * array of messages. The forms want one string per field.
 */
function normaliseFieldErrors(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const text = Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
    if (text) out[key] = text;
  }
  return out;
}

interface PanelProps {
  mode: 'light' | 'dark';
  doc: string;
  degraded: boolean;
  css: string;
  fontHref: string | null;
  fontFaceCss: string;
  copy: PreviewCopy;
  features: PreviewFeatures;
  onBlocked: () => void;
}

function Panel(props: PanelProps) {
  return (
    <figure className="m-0 space-y-1.5">
      <figcaption className="flex items-center gap-1.5 text-xs font-medium text-secondary">
        {props.mode === 'light' ? (
          <Sun className="size-3.5" aria-hidden="true" />
        ) : (
          <Moon className="size-3.5" aria-hidden="true" />
        )}
        {props.mode === 'light' ? 'Light' : 'Dark'}
        {props.mode === 'dark' ? <Badge tone="outline">derived</Badge> : null}
      </figcaption>

      {props.degraded ? <InlinePanel {...props} /> : <FramePanel {...props} />}
    </figure>
  );
}

// ---------------------------------------------------------------
// Preferred: an isolated document
// ---------------------------------------------------------------

function FramePanel({ doc, mode, css, fontHref, fontFaceCss, copy, features, onBlocked }: PanelProps) {
  const ref = React.useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = React.useState(0);
  const [height, setHeight] = React.useState(600);

  /**
   * A frame the browser refused still fires `load`, on an empty document.
   * The marker element is the difference between "refused" and "slow".
   */
  React.useEffect(() => {
    const check = () => {
      const frameDocument = ref.current?.contentDocument;
      if (!frameDocument || !frameDocument.querySelector('[data-pv="tokens"]')) onBlocked();
    };
    const timer = window.setTimeout(check, 1200);
    return () => window.clearTimeout(timer);
  }, [onBlocked]);

  /** The frame is not flow-sized, so its height has to be told to it. */
  React.useEffect(() => {
    const frame = ref.current;
    const body = frame?.contentDocument?.body;
    if (!body || typeof ResizeObserver !== 'function') return;

    const observer = new ResizeObserver(() => {
      const next = frame.contentDocument?.documentElement.scrollHeight ?? 0;
      if (next > 0) setHeight((current) => (Math.abs(current - next) > 2 ? next : current));
    });
    observer.observe(body);
    return () => observer.disconnect();
  }, [loaded]);

  React.useEffect(() => {
    const frame = ref.current;
    const frameDocument = frame?.contentDocument;
    const root = frameDocument?.body;
    if (!frameDocument || !root) return;

    const tokens = frameDocument.querySelector('[data-pv="tokens"]');
    if (tokens && tokens.textContent !== css) tokens.textContent = css;

    const faces = frameDocument.querySelector('[data-pv="faces"]');
    if (faces && faces.textContent !== fontFaceCss) faces.textContent = fontFaceCss;

    const link = frameDocument.querySelector('[data-pv="font"]');
    if (link instanceof HTMLLinkElement) {
      // Removed rather than blanked: an empty `href` resolves to the
      // document itself and the browser parses the page as a stylesheet.
      if (fontHref) {
        if (link.getAttribute('href') !== fontHref) link.setAttribute('href', fontHref);
      } else {
        link.removeAttribute('href');
      }
    }

    applyCopy(frameDocument, root, copy);
    applyFeatures(root, features);

    const next = frameDocument.documentElement.scrollHeight;
    if (next > 0) setHeight((current) => (Math.abs(current - next) > 2 ? next : current));
  }, [loaded, css, fontHref, fontFaceCss, copy, features]);

  return (
    <iframe
      ref={ref}
      title={`Portal preview, ${mode} mode`}
      srcDoc={doc}
      onLoad={() => setLoaded((n) => n + 1)}
      className="block w-full overflow-hidden rounded-lg border border-line bg-surface"
      style={{ height }}
    />
  );
}

// ---------------------------------------------------------------
// Fallback: same markup, token block rescoped into the page
// ---------------------------------------------------------------

function InlinePanel({ mode, css, fontHref, fontFaceCss, copy, features }: PanelProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const scopeClass = `pv-scope-${mode}`;

  React.useEffect(() => {
    const root = ref.current;
    if (!root) return;
    applyCopy(document, root, copy);
    applyFeatures(root, features);
  }, [copy, features]);

  /**
   * The frame would have loaded the typeface itself. Inline, the link has
   * to go in the host document — it only adds `@font-face` declarations,
   * so it changes nothing that is not asking for the family by name.
   */
  React.useEffect(() => {
    if (!fontHref) return;
    const id = 'branding-preview-font';
    let link = document.getElementById(id);
    if (!(link instanceof HTMLLinkElement)) {
      link = document.createElement('link');
      link.id = id;
      (link as HTMLLinkElement).rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if ((link as HTMLLinkElement).href !== fontHref) (link as HTMLLinkElement).href = fontHref;
  }, [fontHref]);

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <style dangerouslySetInnerHTML={{ __html: fontFaceCss + scopeCss(css, `.${scopeClass}`) }} />
      <style dangerouslySetInnerHTML={{ __html: FRAME_CSS }} />
      <div
        ref={ref}
        className={scopeClass}
        data-theme={mode}
        // Static markup authored in this file. No customer value reaches it
        // as HTML — the wording is written into text nodes by applyCopy.
        dangerouslySetInnerHTML={{ __html: FRAME_BODY }}
      />
    </div>
  );
}

/**
 * `:root{…}` → `.pv-scope-light{…}`, and the same for the dark block.
 *
 * The media-query block is dropped: both panels carry an explicit
 * `data-theme`, and leaving it in would repaint the light panel dark
 * whenever the reviewer's operating system happened to be in dark mode.
 * No token value contains a brace, so the blocks split cleanly.
 */
function scopeCss(css: string, scope: string): string {
  return css
    .replace(/@media\(prefers-color-scheme:dark\)\{[\s\S]*?\}\}/g, '')
    .replace(/\[data-theme="dark"\]\{/g, `${scope}[data-theme="dark"]{`)
    .replace(/:root\{/g, `${scope}{`);
}

// ---------------------------------------------------------------
// Wording and module switches, applied without re-mounting
// ---------------------------------------------------------------

function applyCopy(doc: Document, root: ParentNode, copy: PreviewCopy): void {
  setText(root, 'portal', copy.portalName.trim() || 'Alumni Portal');
  setText(root, 'mark', markInitials(copy));
  setText(root, 'tagline', copy.tagline.trim() || copy.institutionName.trim());
  setText(root, 'sub', copy.heroSubhead.trim() || defaultSubhead(copy));
  setText(root, 'inst', copy.institutionName.trim() || copy.portalName.trim());
  setText(root, 'support', copy.supportEmail.trim() || 'no support address set');

  const hero = root.querySelector('[data-pv="hero"]');
  if (!hero) return;

  const headline =
    copy.heroHeadline.trim() || `Every ${copy.shortName.trim() || 'college'} graduate, still reachable.`;
  const emphasis = copy.heroEmphasis.trim();

  hero.textContent = '';

  const at = emphasis ? headline.indexOf(emphasis) : -1;
  if (at < 0) {
    // Text nodes only — customer copy never reaches innerHTML.
    hero.appendChild(doc.createTextNode(headline));
    return;
  }

  hero.appendChild(doc.createTextNode(headline.slice(0, at)));
  const em = doc.createElement('mark');
  em.className = 'pv-em';
  em.textContent = emphasis;
  hero.appendChild(em);
  hero.appendChild(doc.createTextNode(headline.slice(at + emphasis.length)));
}

function applyFeatures(root: ParentNode, features: PreviewFeatures): void {
  root.querySelectorAll<HTMLElement>('[data-feature]').forEach((node) => {
    const key = node.dataset.feature;
    if (!key) return;
    node.hidden = features[key] === false;
  });
}

function setText(root: ParentNode, name: string, text: string): void {
  const el = root.querySelector(`[data-pv="${name}"]`);
  if (el && el.textContent !== text) el.textContent = text;
}

function markInitials(copy: PreviewCopy): string {
  const source = copy.shortName.trim() || copy.portalName.trim() || 'AL';
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words
      .slice(0, 2)
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function defaultSubhead(copy: PreviewCopy): string {
  const name = copy.shortName.trim() || 'the college';
  return `Find the batch you graduated with, mentor the students coming up behind you, and hear about ${name} events before they happen. Verified against the college's own degree records.`;
}
