'use client';

import * as React from 'react';
import { Monitor, Moon, Smartphone, Sun } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { BrandPack } from '@/lib/branding/pack';
import { authPhoto, pickBandPhoto, type BandPhoto } from '@/lib/branding/media';

/**
 * The portal, restyled, live.
 *
 * Four decisions here are load-bearing.
 *
 * **The stylesheet comes from the server.** The studio posts every edit to
 * `POST /api/admin/branding?preview=1` — the same resolver the page
 * renderer runs — and hands the answer in as `css`. Nothing here derives a
 * token. A client-side approximation of the OKLCH ramp, the contrast walk
 * and the dark-mode derivation would agree with the server on the day it
 * was written and drift quietly afterwards.
 *
 * **It is the pages a college judges, not a palette.** The landing page,
 * the sign-in page and the member home, each drawn from the draft: the
 * crest, the logo, the hero and sign-in photos, the campus photos and the
 * college's own words. Designed bare first, like the real pages — with no
 * crest and no photos it shows the solid college band, which is what most
 * colleges have on day one.
 *
 * **Nobody is invented.** The vendor opens this screen too, and a preview
 * is not the place for member names or faces, real or made up. Where a
 * real page would list people or posts, the preview draws quiet
 * placeholder lines.
 *
 * **Scoped, not framed.** The server's token block targets `:root` and
 * `[data-theme="dark"]`; here it is rescoped onto the preview's own root,
 * so custom properties resolve exactly as they do on the page. The layout
 * responds to the preview's width through container queries rather than
 * the viewport, so the Desktop/Phone toggle is simply the frame's width.
 * (The earlier iframe needed a CSP fallback for `frame-src 'none'` anyway,
 * and this is that fallback, made the only path.)
 */

/** Everything the preview draws that is not a colour. */
export interface PreviewDraft {
  portalName: string;
  institutionName: string;
  shortName: string;
  tagline: string;
  heroHeadline: string;
  heroEmphasis: string;
  heroSubhead: string;
  supportEmail: string;
  supportPhone: string;
  websiteUrl: string;
  addressLines: string[];
  greeting: string;
  assets: Pick<
    BrandPack['assets'],
    | 'crest'
    | 'logoPrimary'
    | 'logoInverse'
    | 'heroImage'
    | 'heroImageAlt'
    | 'heroFocus'
    | 'authImage'
    | 'authFocus'
    | 'campusPhotos'
  >;
}

export type PreviewFeatures = Record<string, boolean>;

type Screen = 'landing' | 'signin' | 'home';
type Device = 'desktop' | 'phone';
type Mode = 'light' | 'dark';

const SCREENS: Array<{ value: Screen; label: string }> = [
  { value: 'landing', label: 'Landing' },
  { value: 'signin', label: 'Sign-in' },
  { value: 'home', label: 'Member home' },
];

// ---------------------------------------------------------------
// The preview's own stylesheet
// ---------------------------------------------------------------
//
// Every rule is scoped under `.pv-app` and every value is a token, so no
// literal colour, radius, font, shadow or duration appears in it. Wide
// layouts switch on the preview's own width (`@container`), not the page's.

const FRAME_CSS = `
.pv-app,.pv-app *,.pv-app *::before,.pv-app *::after{box-sizing:border-box}
.pv-app{container-type:inline-size;background:var(--surface);color:var(--text-primary);
  font-family:var(--font-body);font-size:var(--text-sm);line-height:1.55;
  -webkit-font-smoothing:antialiased}
/* Resets at zero specificity, so every component class below wins over them. */
:where(.pv-app) :where(h1,h2,h3,p,ul){margin:0;padding:0}
:where(.pv-app) ul{list-style:none}
:where(.pv-app) img{display:block;max-width:100%}
.pv-display{font-family:var(--font-display);font-weight:700;letter-spacing:var(--tracking-display)}

.pv-band{background:var(--band);color:var(--band-fg)}
.pv-band .pv-display{color:var(--band-fg)}
.pv-muted{color:var(--band-muted)}
.pv-accent{color:var(--band-accent)}
.pv-em{color:var(--band-accent)}
.pv-strip{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--band-rule)}
.pv-strip .pv-grow{flex:1}
.pv-crest{display:grid;place-items:center;flex:none;border-radius:var(--radius-full);background:var(--band-fg);padding:4px}
.pv-crest img{width:100%;height:100%;object-fit:contain}
.pv-word{font-family:var(--font-display);font-weight:700;letter-spacing:var(--tracking-display);
  color:var(--band-fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pv-logo{height:22px;width:auto;object-fit:contain}

.pv-btn{display:inline-flex;align-items:center;justify-content:center;height:var(--control-h);padding:0 14px;
  border-radius:var(--radius);border:var(--border-width) solid transparent;font-weight:600;
  font-size:var(--text-sm);white-space:nowrap}
.pv-btn-sm{height:var(--control-h-sm);padding:0 10px;font-size:var(--text-xs)}
.pv-btn-band{background:var(--band-fg);color:var(--band)}
.pv-btn-band-outline{border-color:var(--band-muted);color:var(--band-fg)}
.pv-btn-primary{background:var(--button-primary-bg);color:var(--button-primary-fg);box-shadow:var(--shadow-sm)}
.pv-btn-secondary{background:var(--surface-raised);color:var(--text-primary);border-color:var(--border)}
.pv-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}

.pv-hero{position:relative;isolation:isolate;overflow:hidden}
.pv-hero-photo,.pv-hero-scrim{display:none}
.pv-hero-strip{width:100%;aspect-ratio:2/1;object-fit:cover}
.pv-hero-body{padding:22px 16px 26px;display:flex;flex-direction:column;gap:12px}
.pv-eyebrow{font-size:var(--text-xs);font-weight:700;text-transform:uppercase;letter-spacing:.08em}
.pv-h1{font-size:var(--display-sm);line-height:1.1}
.pv-sub{max-width:46ch;font-size:var(--text-sm)}

.pv-section{padding:20px 16px;display:flex;flex-direction:column;gap:12px}
.pv-h2{font-family:var(--font-display);font-weight:700;font-size:var(--text-lg);letter-spacing:var(--tracking-display)}
.pv-photos{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pv-photo img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:var(--radius)}
.pv-cap{margin-top:4px;font-size:var(--text-xs);color:var(--text-secondary)}

.pv-foot{padding:18px 16px;display:flex;flex-direction:column;gap:6px;font-size:var(--text-xs)}
.pv-foot-head{display:flex;align-items:center;gap:8px}

.pv-card{background:var(--surface-raised);border:var(--border-width) solid var(--border);
  border-radius:var(--radius-lg);box-shadow:var(--shadow-sm);padding:var(--card-p);
  display:flex;flex-direction:column;gap:10px;color:var(--text-primary)}
.pv-card-title{font-family:var(--font-display);font-weight:600;font-size:var(--text-md)}
.pv-label{font-weight:500}
.pv-input{display:block;width:100%;height:var(--control-h);margin-top:5px;padding:0 10px;
  font-size:var(--text-sm);color:var(--text-secondary);background:var(--surface-raised);
  border:var(--border-width) solid var(--focus-ring);border-radius:var(--radius);
  outline:2px solid var(--focus-ring);outline-offset:2px;display:flex;align-items:center}
.pv-hint{font-size:var(--text-xs);color:var(--text-secondary)}
.pv-link{color:var(--brand-fg);font-weight:600;text-decoration:underline;text-underline-offset:3px}
.pv-line{height:8px;border-radius:var(--radius-full);background:var(--surface-sunken)}
.pv-badge{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:var(--radius-full);
  font-size:var(--text-xs);font-weight:600}
.pv-dot{width:6px;height:6px;border-radius:var(--radius-full);background:currentColor}
.pv-b-success{background:var(--success-soft);color:var(--success-fg)}
.pv-b-warning{background:var(--warning-soft);color:var(--warning-fg)}
.pv-b-brand{background:var(--brand-soft);color:var(--brand-soft-fg)}
.pv-b-accent{background:var(--accent-soft);color:var(--accent-soft-fg)}

.pv-signin{display:flex;flex-direction:column}
.pv-signin-panel{display:none}
.pv-signin-form{padding:24px 16px 32px;display:flex;flex-direction:column;gap:14px}

.pv-shell{display:flex;flex-direction:column}
.pv-side{display:none}
.pv-topbar{display:flex;align-items:center;gap:8px;height:48px;padding:0 14px;background:var(--surface-raised);
  border-bottom:var(--border-width) solid var(--border)}
.pv-topbar .pv-word{color:var(--text-primary)}
.pv-main{padding:14px;display:flex;flex-direction:column;gap:14px}
.pv-home-band{border-radius:0;margin:-14px -14px 0}
.pv-home-band .pv-hero-body{padding:20px 16px}
.pv-home-grid{display:grid;grid-template-columns:1fr;gap:10px}
.pv-tabbar{display:grid;grid-template-columns:repeat(4,1fr);border-top:var(--border-width) solid var(--border);
  background:var(--surface-raised)}
.pv-tab{padding:9px 0;text-align:center;font-size:var(--text-xs);font-weight:500;color:var(--text-secondary)}
.pv-tab-on{color:var(--brand-fg);box-shadow:inset 0 2px 0 var(--button-primary-bg)}
.pv-nav{display:flex;flex-direction:column;gap:2px;padding:10px}
.pv-nav-item{padding:6px 10px;border-radius:var(--radius);font-size:var(--text-xs);font-weight:500;color:var(--text-secondary)}
.pv-nav-on{background:var(--brand-soft);color:var(--brand-soft-fg)}

@container (min-width:640px){
  .pv-strip{padding:12px 28px}
  .pv-hero-strip{display:none}
  .pv-hero-photo{display:block;position:absolute;inset:0;z-index:-2;width:100%;height:100%;object-fit:cover}
  .pv-hero-scrim{display:block;position:absolute;inset:0;z-index:-1;
    background:linear-gradient(to right,var(--scrim) 0%,var(--scrim) 60%,var(--scrim-edge) 100%)}
  .pv-hero-body{padding:48px 28px 52px}
  .pv-has-photo .pv-hero-body{max-width:60%}
  .pv-has-photo .pv-muted,.pv-has-photo .pv-accent{color:var(--band-fg)}
  .pv-has-photo .pv-em{color:var(--band-fg);text-decoration:underline;text-decoration-color:var(--band-accent);
    text-decoration-thickness:.08em;text-underline-offset:.12em}
  .pv-h1{font-size:var(--display-md)}
  .pv-section{padding:28px}
  .pv-photos{grid-template-columns:repeat(4,1fr)}
  .pv-foot{padding:22px 28px}
  .pv-signin{display:grid;grid-template-columns:1fr 1fr;min-height:420px}
  .pv-signin-panel{display:flex;position:relative;isolation:isolate;overflow:hidden;flex-direction:column;
    justify-content:flex-end;padding:24px}
  .pv-signin-strip{display:none}
  .pv-signin-form{justify-content:center;padding:32px}
  .pv-caption{background:var(--scrim);color:var(--band-fg);border-radius:var(--radius-lg);padding:14px;
    display:flex;flex-direction:column;gap:6px}
  .pv-shell{display:grid;grid-template-columns:180px 1fr;min-height:460px}
  .pv-side{display:flex;flex-direction:column;background:var(--surface-raised);
    border-right:var(--border-width) solid var(--border)}
  .pv-side-id{padding:12px 14px;display:flex;align-items:center;gap:8px}
  .pv-topbar-phone,.pv-tabbar{display:none}
  .pv-main{padding:18px}
  .pv-home-band{margin:0;border-radius:var(--radius-xl)}
  .pv-home-band .pv-hero-body{padding:28px}
  .pv-home-grid{grid-template-columns:repeat(3,1fr)}
}
`;

/**
 * `:root{…}` → `.pv-scope{…}`, and the same for the dark block.
 *
 * The media-query block is dropped: the preview carries an explicit
 * `data-theme`, and leaving it in would repaint the light view dark
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

export interface LivePreviewProps {
  /** The token stylesheet the server resolved for the draft. Injected verbatim, rescoped. */
  css: string;
  fontHref: string | null;
  /** `@font-face` rules for a pack that self-hosts its typefaces. */
  fontFaceCss?: string;
  draft: PreviewDraft;
  features: PreviewFeatures;
  pending?: boolean;
  className?: string;
}

export function LivePreview({
  css,
  fontHref,
  fontFaceCss = '',
  draft,
  features,
  pending = false,
  className,
}: LivePreviewProps) {
  const [screen, setScreen] = React.useState<Screen>('landing');
  const [device, setDevice] = React.useState<Device>('desktop');
  const [mode, setMode] = React.useState<Mode>('light');

  // The link only adds `@font-face` declarations, so it changes nothing on
  // the page that is not asking for the family by name.
  React.useEffect(() => {
    if (!fontHref) return;
    const id = 'branding-preview-font';
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (link.href !== fontHref) link.href = fontHref;
  }, [fontHref]);

  const scoped = React.useMemo(() => fontFaceCss + scopeCss(css, '.pv-scope'), [css, fontFaceCss]);

  return (
    <section aria-labelledby="live-preview-title" className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="live-preview-title" className="flex items-center gap-2 font-display text-lg font-semibold">
          Preview
          {pending ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-normal text-secondary">
              <Spinner className="size-3.5" />
              updating
            </span>
          ) : null}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Toggle
            label="Device"
            className="hidden lg:inline-flex"
            value={device}
            onChange={setDevice}
            options={[
              { value: 'desktop', label: 'Desktop', icon: <Monitor className="size-3.5" /> },
              { value: 'phone', label: 'Phone', icon: <Smartphone className="size-3.5" /> },
            ]}
          />
          <Toggle
            label="Colour scheme"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'light', label: 'Light', icon: <Sun className="size-3.5" /> },
              { value: 'dark', label: 'Dark', icon: <Moon className="size-3.5" /> },
            ]}
          />
        </div>
      </div>

      <Toggle label="Page" value={screen} onChange={setScreen} options={SCREENS} wide />

      <style dangerouslySetInnerHTML={{ __html: scoped + FRAME_CSS }} />
      <div
        className={cn(
          'mx-auto w-full max-w-[390px] overflow-hidden rounded-xl border border-line-strong shadow-sm',
          device === 'desktop' && 'lg:max-w-none',
        )}
      >
        <div
          // The preview is a picture of pages, not a set of controls.
          inert
          aria-label={`${SCREENS.find((s) => s.value === screen)?.label} page preview, ${mode} mode`}
          role="img"
          className="pv-scope pv-app max-h-[36rem] overflow-y-auto lg:max-h-none lg:overflow-visible"
          data-theme={mode}
        >
          {screen === 'landing' ? <Landing draft={draft} /> : null}
          {screen === 'signin' ? <SignIn draft={draft} /> : null}
          {screen === 'home' ? <MemberHome draft={draft} features={features} /> : null}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------

function Toggle<T extends string>({
  label,
  value,
  onChange,
  options,
  wide = false,
  className,
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>;
  wide?: boolean;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex rounded-lg border border-line bg-surface-sunken p-0.5',
        wide && 'flex w-full sm:inline-flex sm:w-auto',
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded px-3 text-sm font-medium sm:min-h-9',
            'transition-colors duration-fast ease-brand',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
            value === o.value ? 'bg-surface-raised text-primary shadow-sm' : 'text-secondary hover:text-primary',
          )}
        >
          {o.icon ? <span aria-hidden="true">{o.icon}</span> : null}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function name(draft: PreviewDraft): string {
  return draft.portalName.trim() || 'Alumni Portal';
}

function Crest({ src, size }: { src?: string; size: number }) {
  if (!src) return null;
  return (
    <span className="pv-crest" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" />
    </span>
  );
}

/** The reversed logo on the band, else the portal name set in the display face. */
function BandMark({ draft, size = 17 }: { draft: PreviewDraft; size?: number }) {
  const inverse = draft.assets.logoInverse;
  if (inverse) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="pv-logo" src={inverse} alt="" />;
  }
  return (
    <span className="pv-word" style={{ fontSize: size }}>
      {name(draft)}
    </span>
  );
}

function Headline({ draft }: { draft: PreviewDraft }) {
  const headline =
    draft.heroHeadline.trim() || `Welcome back to ${draft.shortName.trim() || name(draft)}.`;
  const emphasis = draft.heroEmphasis.trim();
  const at = emphasis ? headline.indexOf(emphasis) : -1;
  if (at < 0) return <>{headline}</>;
  return (
    <>
      {headline.slice(0, at)}
      <span className="pv-em">{emphasis}</span>
      {headline.slice(at + emphasis.length)}
    </>
  );
}

function Photo({ photo, className }: { photo: BandPhoto; className: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={photo.src} alt="" style={{ objectPosition: photo.focus }} />;
}

function Footer({ draft }: { draft: PreviewDraft }) {
  const contact = [draft.supportEmail, draft.supportPhone, draft.websiteUrl.replace(/^https?:\/\//, '')]
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <footer className="pv-band pv-foot">
      <div className="pv-foot-head">
        <Crest src={draft.assets.crest} size={28} />
        <span className="pv-display" style={{ fontSize: 15 }}>
          {draft.institutionName.trim() || name(draft)}
        </span>
      </div>
      {draft.addressLines.length ? <p className="pv-muted">{draft.addressLines.join(', ')}</p> : null}
      {contact.length ? <p className="pv-muted">{contact.join(' · ')}</p> : null}
    </footer>
  );
}

// ---------------------------------------------------------------
// Landing
// ---------------------------------------------------------------

function Landing({ draft }: { draft: PreviewDraft }) {
  const a = draft.assets;
  const hero: BandPhoto | null = a.heroImage
    ? { src: a.heroImage, alt: a.heroImageAlt ?? '', focus: a.heroFocus ?? '50% 50%' }
    : null;
  const photos = a.campusPhotos.slice(0, 4);

  return (
    <div>
      <header className="pv-band pv-strip">
        <Crest src={a.crest} size={30} />
        <span className="pv-grow">
          <BandMark draft={draft} />
        </span>
        <span className="pv-btn pv-btn-sm pv-btn-band-outline">Sign in</span>
      </header>

      <section className={cn('pv-band pv-hero', hero && 'pv-has-photo')}>
        {hero ? (
          <>
            <Photo photo={hero} className="pv-hero-strip" />
            <Photo photo={hero} className="pv-hero-photo" />
            <span className="pv-hero-scrim" aria-hidden="true" />
          </>
        ) : null}
        <div className="pv-hero-body">
          {draft.tagline.trim() ? <p className="pv-eyebrow pv-accent">{draft.tagline}</p> : null}
          <h1 className="pv-display pv-h1">
            <Headline draft={draft} />
          </h1>
          {draft.heroSubhead.trim() ? <p className="pv-sub pv-muted">{draft.heroSubhead}</p> : null}
          <div className="pv-row">
            <span className="pv-btn pv-btn-band">Register</span>
            <span className="pv-btn pv-btn-band-outline">Sign in</span>
          </div>
        </div>
      </section>

      {photos.length ? (
        <section className="pv-section">
          <h2 className="pv-h2">Around the campus</h2>
          <ul className="pv-photos">
            {photos.map((p) => (
              <li key={p.src} className="pv-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt="" style={{ objectPosition: p.focus ?? '50% 50%' }} />
                {p.caption ? <p className="pv-cap">{p.caption}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Footer draft={draft} />
    </div>
  );
}

// ---------------------------------------------------------------
// Sign-in
// ---------------------------------------------------------------

function SignIn({ draft }: { draft: PreviewDraft }) {
  const photo = authPhoto({ assets: draft.assets as BrandPack['assets'] });
  const institution = draft.institutionName.trim() || name(draft);

  return (
    <div className="pv-signin">
      <aside className={cn('pv-band pv-signin-panel', photo && 'pv-has-photo')}>
        {photo ? (
          <>
            <Photo photo={photo} className="pv-hero-photo" />
          </>
        ) : null}
        <div className={photo ? 'pv-caption' : ''} style={photo ? undefined : { display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Crest src={draft.assets.crest} size={44} />
          <BandMark draft={draft} size={20} />
          <p className={photo ? '' : 'pv-muted'}>{institution}</p>
        </div>
      </aside>

      <header className="pv-band pv-strip pv-signin-strip">
        <Crest src={draft.assets.crest} size={30} />
        <BandMark draft={draft} />
      </header>

      <div className="pv-signin-form">
        <h1 className="pv-display" style={{ fontSize: 'var(--text-xl)' }}>
          Sign in to {name(draft)}
        </h1>
        <p className="pv-hint">We email you a one-time code. There is no password.</p>
        <label className="pv-label">
          Email address
          <span className="pv-input">name@example.com</span>
        </label>
        <span className="pv-btn pv-btn-primary">Send me a code</span>
        <p className="pv-hint">
          New here? <span className="pv-link">Register with your {institution} details</span>
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Member home
// ---------------------------------------------------------------

const NAV: Array<{ label: string; feature?: string }> = [
  { label: 'Home' },
  { label: 'Directory', feature: 'directory' },
  { label: 'Requests', feature: 'connections' },
  { label: 'Events', feature: 'events' },
  { label: 'Jobs', feature: 'jobs' },
  { label: 'Mentorship', feature: 'mentorship' },
  { label: 'Giving', feature: 'donations' },
  { label: 'News', feature: 'news' },
];

function MemberHome({ draft, features }: { draft: PreviewDraft; features: PreviewFeatures }) {
  const photo = pickBandPhoto({ assets: draft.assets as BrandPack['assets'] }, 'home');
  const nav = NAV.filter((n) => !n.feature || features[n.feature] !== false);
  const institution = draft.institutionName.trim() || name(draft);

  return (
    <div className="pv-shell">
      <aside className="pv-side">
        <div className="pv-band pv-side-id">
          <Crest src={draft.assets.crest} size={28} />
          <span style={{ minWidth: 0 }}>
            <BandMark draft={draft} size={14} />
            <span className="pv-muted" style={{ display: 'block', fontSize: 'var(--text-xs)' }}>
              {institution}
            </span>
          </span>
        </div>
        <nav className="pv-nav">
          {nav.map((n, i) => (
            <span key={n.label} className={cn('pv-nav-item', i === 0 && 'pv-nav-on')}>
              {n.label}
            </span>
          ))}
        </nav>
      </aside>

      <div>
        <div className="pv-topbar pv-topbar-phone">
          <span className="pv-word" style={{ fontSize: 15 }}>
            {name(draft)}
          </span>
        </div>
        <div className="pv-main">
          <section className={cn('pv-band pv-hero pv-home-band', photo && 'pv-has-photo')}>
            {photo ? (
              <>
                <Photo photo={photo} className="pv-hero-photo" />
                <span className="pv-hero-scrim" aria-hidden="true" />
              </>
            ) : null}
            <div className="pv-hero-body">
              <p className="pv-eyebrow pv-accent">{institution}</p>
              <h1 className="pv-display" style={{ fontSize: 'var(--display-xs)' }}>
                {draft.greeting.trim() || 'Namaste'}
              </h1>
              <div className="pv-row">
                <span className="pv-btn pv-btn-sm pv-btn-band">Find your batch</span>
                <span className="pv-btn pv-btn-sm pv-btn-band-outline">Events</span>
              </div>
            </div>
          </section>

          <div className="pv-home-grid">
            <PlaceholderCard title="Needs you" badge={<span className="pv-badge pv-b-warning"><span className="pv-dot" />Closes soon</span>} />
            <PlaceholderCard title="Coming up" badge={<span className="pv-badge pv-b-success"><span className="pv-dot" />Registered</span>} action />
            <PlaceholderCard title="Your batch" badge={<span className="pv-badge pv-b-brand">Your batch</span>} />
          </div>
        </div>
        <div className="pv-tabbar">
          {['Home', 'Directory', 'Requests', 'More'].map((t, i) => (
            <span key={t} className={cn('pv-tab', i === 0 && 'pv-tab-on')}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A card with lines where a real page would list people or posts. Nobody is invented. */
function PlaceholderCard({ title, badge, action = false }: { title: string; badge: React.ReactNode; action?: boolean }) {
  return (
    <div className="pv-card">
      <div className="pv-row" style={{ justifyContent: 'space-between' }}>
        <span className="pv-card-title">{title}</span>
        {badge}
      </div>
      <span className="pv-line" style={{ width: '85%' }} />
      <span className="pv-line" style={{ width: '60%' }} />
      {action ? <span className="pv-btn pv-btn-sm pv-btn-primary" style={{ alignSelf: 'flex-start' }}>Show my ticket</span> : <span className="pv-link" style={{ fontSize: 'var(--text-xs)' }}>See all</span>}
    </div>
  );
}
