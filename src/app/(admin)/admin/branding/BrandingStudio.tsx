'use client';

import * as React from 'react';
import {
  AlertTriangle,
  Check,
  Image as ImageIcon,
  Images,
  Palette,
  RotateCcw,
  Shapes,
  Type as TypeIcon,
  Wrench,
  Ruler,
  ShieldCheck,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  Disclosure,
  Field,
  Input,
  Spinner,
  StickyActionBar,
  describedBy,
  useToast,
} from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';
import { cn } from '@/lib/cn';
import type { BrandPack } from '@/lib/branding/pack';
import { AssetSlotCard } from '@/components/branding/AssetSlotCard';
import { ColourField, normaliseHex } from '@/components/branding/ColourField';
import { ContrastReport, type ContrastReportValue } from '@/components/branding/ContrastReport';
import { LivePreview, type PreviewDraft } from '@/components/branding/LivePreview';
import { PackImportExport } from '@/components/branding/PackImportExport';
import { PresetGallery, type BasePackOption } from '@/components/branding/PresetGallery';
import { TokenPreview, parseTokenCss } from '@/components/branding/TokenPreview';

/**
 * The branding studio.
 *
 * Organised around what a college actually has: a crest and logos, some
 * campus photos, a colour or two from its style guide, and its own words.
 * Everything else — type, shape, the pack file, the settings only the
 * vendor changes — is collapsed below that, marked for what it is.
 *
 * Two things make it worth building rather than shipping a colour form:
 *
 *  1. **The preview is the artefact.** Every edit is debounced into
 *     `POST /api/admin/branding?preview=1`, which runs the same resolver
 *     the page renderer runs, and the answer restyles the landing,
 *     sign-in and member-home previews.
 *  2. **The contrast audit is a gate, not a report.** Its verdict sits in
 *     the sticky bar beside Publish at all times, and errors disable
 *     Publish. Warnings do not.
 *
 * Publish saves only what the form can save (`BrandingInput`). Anything
 * that lives in the pack file is shown read-only, or sits under "For your
 * vendor", marked "Not saved by Publish".
 */

// ---------------------------------------------------------------
// Editor state
// ---------------------------------------------------------------

type Radius = BrandPack['shape']['radius'];
type Density = BrandPack['shape']['density'];
type Elevation = BrandPack['shape']['elevation'];

interface StudioValue {
  basePackId: string | null;

  primary: string;
  accent: string;
  surface: string;
  surfaceDark: string;
  ink: string;
  marker: string;
  neutralChroma: number;

  fontDisplay: string;
  fontBody: string;

  radius: Radius;
  density: Density;
  elevation: Elevation;

  logoPrimary: string;
  logoInverse: string;
  logoMark: string;
  crest: string;
  ogImage: string;
  heroImage: string;

  portalName: string;
  institutionName: string;
  shortName: string;
  tagline: string;
  heroHeadline: string;
  heroEmphasis: string;
  heroSubhead: string;
  supportEmail: string;

  features: Record<string, boolean>;
}

function fromPack(pack: BrandPack, basePackId: string | null): StudioValue {
  return {
    basePackId,
    primary: pack.color.primary,
    accent: pack.color.accent ?? '',
    surface: pack.color.surface,
    surfaceDark: pack.color.surfaceDark,
    ink: pack.color.ink ?? '',
    marker: pack.color.marker ?? '',
    neutralChroma: pack.color.neutralChroma,
    fontDisplay: pack.type.display,
    fontBody: pack.type.body,
    radius: pack.shape.radius,
    density: pack.shape.density,
    elevation: pack.shape.elevation,
    logoPrimary: pack.assets.logoPrimary ?? '',
    logoInverse: pack.assets.logoInverse ?? '',
    logoMark: pack.assets.logoMark ?? '',
    crest: pack.assets.crest ?? '',
    ogImage: pack.assets.ogImage ?? '',
    heroImage: pack.assets.heroImage ?? '',
    portalName: pack.copy.portalName,
    institutionName: pack.copy.institutionName,
    shortName: pack.copy.shortName,
    tagline: pack.copy.tagline ?? '',
    heroHeadline: pack.copy.heroHeadline ?? '',
    heroEmphasis: pack.copy.heroEmphasis ?? '',
    heroSubhead: pack.copy.heroSubhead ?? '',
    supportEmail: pack.copy.supportEmail ?? '',
    features: { ...pack.features },
  };
}

const blank = (s: string): string | undefined => (s.trim() ? s.trim() : undefined);

/** Editor state → the shape `BrandingInput` accepts. */
function toPayload(v: StudioValue) {
  return {
    basePackId: v.basePackId,
    primary: v.primary,
    accent: blank(v.accent),
    surface: v.surface,
    surfaceDark: v.surfaceDark,
    // Carried through untouched. Publishing writes the whole row, so
    // omitting an asset the college already has would silently blank it.
    logoPrimary: blank(v.logoPrimary),
    logoInverse: blank(v.logoInverse),
    logoMark: blank(v.logoMark),
    crest: blank(v.crest),
    ogImage: blank(v.ogImage),
    heroImage: blank(v.heroImage),
    fontDisplay: v.fontDisplay,
    fontBody: v.fontBody,
    portalName: v.portalName,
    institutionName: blank(v.institutionName),
    shortName: blank(v.shortName),
    tagline: blank(v.tagline),
    supportEmail: blank(v.supportEmail),
    radius: v.radius,
    density: v.density,
    elevation: v.elevation,
  };
}

/**
 * Editor state → a complete brand pack, for export.
 *
 * Built as a plain object over the chosen base and handed to the server to
 * validate, rather than parsed here. The schema lives in one place and the
 * file that lands on disk is the one the validator produced.
 */
function toPackObject(base: BrandPack, v: StudioValue, id: string): object | null {
  if (!normaliseHex(v.primary) || !normaliseHex(v.surface) || !normaliseHex(v.surfaceDark)) return null;
  if (v.accent.trim() && !normaliseHex(v.accent)) return null;
  if (v.ink.trim() && !normaliseHex(v.ink)) return null;
  if (v.marker.trim() && !normaliseHex(v.marker)) return null;

  return {
    ...base,
    id,
    version: base.version,
    color: {
      ...base.color,
      primary: v.primary,
      accent: blank(v.accent),
      surface: v.surface,
      surfaceDark: v.surfaceDark,
      ink: blank(v.ink),
      marker: blank(v.marker),
      neutralChroma: v.neutralChroma,
    },
    type: { ...base.type, display: v.fontDisplay, body: v.fontBody },
    shape: { ...base.shape, radius: v.radius, density: v.density, elevation: v.elevation },
    assets: {
      ...base.assets,
      logoPrimary: blank(v.logoPrimary),
      logoInverse: blank(v.logoInverse),
      logoMark: blank(v.logoMark),
      crest: blank(v.crest),
      ogImage: blank(v.ogImage),
      heroImage: blank(v.heroImage),
    },
    copy: {
      ...base.copy,
      portalName: v.portalName,
      institutionName: v.institutionName,
      shortName: v.shortName,
      tagline: blank(v.tagline),
      heroHeadline: blank(v.heroHeadline),
      heroEmphasis: blank(v.heroEmphasis),
      heroSubhead: blank(v.heroSubhead),
      supportEmail: blank(v.supportEmail),
    },
    features: { ...v.features },
    locale: base.locale,
  };
}

/** `validateBranding` flattens a Zod error, so a value may arrive as an array of messages. */
function firstMessages(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const text = Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
    if (text) out[key] = text;
  }
  return out;
}

// ---------------------------------------------------------------
// Curated typefaces
// ---------------------------------------------------------------

const DISPLAY_FONTS = [
  'Fraunces',
  'Playfair Display',
  'Lora',
  'Source Serif 4',
  'Libre Baskerville',
  'Spectral',
  'IBM Plex Serif',
  'Bitter',
  'Crimson Pro',
  'Instrument Serif',
  'Space Grotesk',
  'Bricolage Grotesque',
  'Outfit',
  'Sora',
  'Manrope',
];

const BODY_FONTS = [
  'Inter',
  'IBM Plex Sans',
  'Source Sans 3',
  'Work Sans',
  'DM Sans',
  'Public Sans',
  'Figtree',
  'Karla',
  'Mulish',
  'Rubik',
  'Lato',
  'Open Sans',
  'Noto Sans',
  'Mukta',
  'Hind',
];

const MODULES: Array<{ key: string; label: string }> = [
  { key: 'directory', label: 'Directory' },
  { key: 'connections', label: 'Requests' },
  { key: 'events', label: 'Events' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'mentorship', label: 'Mentorship' },
  { key: 'donations', label: 'Giving' },
  { key: 'gallery', label: 'Gallery' },
  { key: 'news', label: 'News' },
  { key: 'whatsapp', label: 'WhatsApp messages' },
  { key: 'publicLanding', label: 'Public page' },
];

// ---------------------------------------------------------------

export interface BrandingStudioProps {
  pack: BrandPack;
  basePacks: BasePackOption[];
  /** Every template pack, keyed by id. `''` is the neutral default. */
  packsById: Record<string, BrandPack>;
  currentPackId: string | null;
  /** Filename stem for the export, and the folder asset paths suggest — the college's subdomain. */
  exportId: string;
  tenantName: string;
  fcraRegistered: boolean;
  /** Fixture mode validates and audits a publish, then stores nothing. */
  isFixture: boolean;
  initialCss: string;
  initialFontHref: string | null;
  /** `@font-face` rules per base pack, for packs that self-host. */
  fontFacesByPack: Record<string, string>;
  initialReport: ContrastReportValue;
}

interface PreviewState {
  css: string;
  fontHref: string | null;
  report: ContrastReportValue;
}

interface PreviewResponse {
  css?: string;
  fontHref?: string | null;
  report?: ContrastReportValue;
}

export function BrandingStudio({
  pack,
  basePacks,
  packsById,
  currentPackId,
  exportId,
  tenantName,
  fcraRegistered,
  isFixture,
  initialCss,
  initialFontHref,
  fontFacesByPack,
  initialReport,
}: BrandingStudioProps) {
  const toast = useToast();

  const initialValue = React.useMemo(() => fromPack(pack, currentPackId), [pack, currentPackId]);

  const [value, setValue] = React.useState<StudioValue>(initialValue);
  /** What the college is actually serving. Moves only on a publish that stored something. */
  const [saved, setSaved] = React.useState<StudioValue>(initialValue);
  const [importedBase, setImportedBase] = React.useState<BrandPack | null>(null);
  const [preview, setPreview] = React.useState<PreviewState>({
    css: initialCss,
    fontHref: initialFontHref,
    report: initialReport,
  });
  const [pending, setPending] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [confirming, setConfirming] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [templateChoice, setTemplateChoice] = React.useState<{ id: string | null } | null>(null);

  const set = React.useCallback(<K extends keyof StudioValue>(key: K, next: StudioValue[K]) => {
    setValue((current) => ({ ...current, [key]: next }));
  }, []);

  // ---------------------------------------------------------------
  // Debounced preview — the same resolver the renderer uses
  // ---------------------------------------------------------------

  const sequence = React.useRef(0);

  React.useEffect(() => {
    const id = ++sequence.current;
    const controller = new AbortController();
    setPending(true);

    const timer = window.setTimeout(() => {
      void (async () => {
        const outcome = await api.post<PreviewResponse>(
          '/api/admin/branding?preview=1',
          toPayload(value),
          controller.signal,
        );

        // A slower earlier request must never overwrite a newer answer.
        if (sequence.current !== id) return;
        setPending(false);

        if (outcome.status === 'ok') {
          if (outcome.data.css && outcome.data.report) {
            setFieldErrors({});
            setPreviewError(null);
            setPreview({ css: outcome.data.css, fontHref: outcome.data.fontHref ?? null, report: outcome.data.report });
          } else {
            setPreviewError('The server answered without a stylesheet, so the preview is one edit old.');
          }
          return;
        }
        if (outcome.status === 'invalid') {
          setFieldErrors(firstMessages(outcome.fieldErrors));
          setPreviewError(null);
          return;
        }
        // An aborted request is this effect changing its mind, not a failure.
        if (outcome.status === 'offline' && outcome.message === 'Cancelled.') return;
        setPreviewError(
          outcome.status === 'offline' ? 'Could not reach the server. The preview is one edit old.' : outcome.message,
        );
      })();
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  // ---------------------------------------------------------------

  const tokens = React.useMemo(() => parseTokenCss(preview.css), [preview.css]);
  const base = importedBase ?? packsById[value.basePackId ?? ''] ?? pack;
  const exportPack = React.useMemo(() => toPackObject(base, value, exportId), [base, value, exportId]);

  const dirty = React.useMemo(() => JSON.stringify(value) !== JSON.stringify(saved), [value, saved]);

  const report = preview.report;
  const blocked = !report.passes;
  const failures = report.errors.length;
  const scrimIssue = [...report.errors, ...report.warnings].find((i) => i.token.startsWith('--scrim'));

  const draft: PreviewDraft = {
    portalName: value.portalName,
    institutionName: value.institutionName,
    shortName: value.shortName,
    tagline: value.tagline,
    heroHeadline: value.heroHeadline,
    heroEmphasis: value.heroEmphasis,
    heroSubhead: value.heroSubhead,
    supportEmail: value.supportEmail,
    supportPhone: base.copy.supportPhone ?? '',
    websiteUrl: base.copy.websiteUrl ?? '',
    addressLines: base.copy.addressLines,
    greeting: base.copy.greeting,
    assets: {
      crest: blank(value.crest),
      logoPrimary: blank(value.logoPrimary),
      logoInverse: blank(value.logoInverse),
      heroImage: blank(value.heroImage),
      heroImageAlt: base.assets.heroImageAlt,
      heroFocus: base.assets.heroFocus,
      authImage: base.assets.authImage,
      authFocus: base.assets.authFocus,
      campusPhotos: base.assets.campusPhotos,
    },
  };

  const err = (key: string): string | null => fieldErrors[key] ?? null;
  const assetPath = (file: string) => `/brand/${exportId}/${file}`;
  const portalName = value.portalName.trim() || 'portal';

  const logos = [value.crest, value.logoPrimary, value.logoInverse, value.logoMark, value.ogImage];
  const logosSupplied = logos.filter((x) => x.trim()).length;
  const photoCount =
    base.assets.campusPhotos.length + (value.heroImage.trim() ? 1 : 0) + (base.assets.authImage ? 1 : 0);

  function applyTemplate(id: string | null) {
    const next = packsById[id ?? ''];
    setImportedBase(null);
    setValue(next ? fromPack(next, id) : (current) => ({ ...current, basePackId: id }));
  }

  function loadPack(loaded: BrandPack) {
    setImportedBase(loaded);
    setValue(fromPack(loaded, null));
  }

  async function publish() {
    setPublishing(true);
    const outcome = await api.post<{ ok?: boolean; report?: ContrastReportValue }>(
      '/api/admin/branding',
      toPayload(value),
    );
    setPublishing(false);

    if (outcome.status === 'ok') {
      setConfirming(false);
      if (isFixture || !outcome.persisted) {
        // Everything ran — validation, the contrast gate, the audit entry —
        // and nothing was stored. The draft stays unpublished, because it is.
        toast.info('Branding checked', 'Checked and recorded in the audit log. Demo mode does not save.');
        return;
      }
      setSaved(value);
      toast.success('Branding published', `Every ${tenantName} member sees this on their next page load.`);
      return;
    }

    if (outcome.status === 'invalid') {
      setFieldErrors(firstMessages(outcome.fieldErrors));
    }
    const t = outcomeToast(outcome, 'Branding published');
    if (t) toast.show(t);
  }

  const gateChip = (
    <span
      role="status"
      className={cn(
        'inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-semibold',
        blocked
          ? 'border-[color-mix(in_srgb,var(--danger)_40%,var(--border))] bg-danger-soft text-danger-fg'
          : 'border-[color-mix(in_srgb,var(--success)_40%,var(--border))] bg-success-soft text-success-fg',
      )}
    >
      {pending ? (
        <Spinner className="size-3.5" />
      ) : blocked ? (
        <AlertTriangle className="size-3.5" aria-hidden="true" />
      ) : (
        <Check className="size-3.5" aria-hidden="true" />
      )}
      {blocked ? `${failures} ${failures === 1 ? 'failure' : 'failures'}` : 'All checks pass'}
    </span>
  );

  const discardButton = (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={!dirty || publishing}
      onClick={() => {
        setImportedBase(null);
        setValue(saved);
      }}
    >
      <RotateCcw className="size-3.5" aria-hidden="true" />
      Discard
    </Button>
  );

  const publishButton = (
    <Button
      type="button"
      size="sm"
      disabled={blocked || !dirty || pending || publishing}
      onClick={() => setConfirming(true)}
    >
      Publish
    </Button>
  );

  return (
    <div className="space-y-gutter">
      {/* Action bar. Under the app's top bar at lg+, so Publish and the gate
          stay in reach however far the sections scroll. Phones get the same
          controls pinned to the bottom instead. */}
      <div className="rounded-lg border border-line bg-surface-raised px-4 py-3 shadow-sm lg:sticky lg:top-16 lg:z-30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {gateChip}
            <span className="text-sm text-secondary">
              {blocked
                ? 'Publish stays off until the contrast failures are fixed.'
                : dirty
                  ? 'Unpublished changes. Only you can see them.'
                  : `This is what ${tenantName} members see now.`}
            </span>
          </div>
          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            {discardButton}
            {publishButton}
          </div>
          <div className="lg:hidden">{discardButton}</div>
        </div>
      </div>

      {previewError ? (
        <Alert tone="warning" title="The preview is one edit old" icon={<AlertTriangle className="size-4" />}>
          <p>{previewError}</p>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-gutter lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        {/* ---------------- Preview (first on phones) ---------------- */}
        <div className="min-w-0 lg:sticky lg:top-36 lg:order-last lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto">
          <LivePreview
            css={preview.css}
            fontHref={preview.fontHref}
            fontFaceCss={importedBase ? '' : (fontFacesByPack[value.basePackId ?? ''] ?? '')}
            draft={draft}
            features={value.features}
            pending={pending}
          />
        </div>

        {/* ---------------- Sections ---------------- */}
        <div className="min-w-0 space-y-3">
          {/* 1. Crest and logos */}
          <Disclosure
            defaultOpen
            summary={
              <SectionSummary
                icon={<Shapes className="size-4" />}
                title="Crest and logos"
                note={`${logosSupplied} of ${logos.length} supplied`}
              />
            }
          >
            <div className="space-y-3">
              <AssetSlotCard
                label="Crest"
                format="SVG, or a 1024px PNG with a transparent background"
                usedOn={['Header band', 'Sign-in page', 'Footer']}
                src={value.crest}
                emptyAsk={`No crest yet — the header shows the ${portalName} wordmark. Ask the college for the crest in vector.`}
                edit={{
                  id: 'asset-crest',
                  value: value.crest,
                  onChange: (v) => set('crest', v),
                  error: err('crest'),
                  placeholder: assetPath('crest.svg'),
                }}
              />
              <AssetSlotCard
                label="Logo"
                format="SVG, or a PNG at least 600px wide, for light backgrounds"
                usedOn={['Header', 'Printed annexures']}
                src={value.logoPrimary}
                emptyAsk={`No logo yet — the ${portalName} wordmark stands in. Ask for the logo as SVG.`}
                edit={{
                  id: 'asset-logo',
                  value: value.logoPrimary,
                  onChange: (v) => set('logoPrimary', v),
                  error: err('logoPrimary'),
                  placeholder: assetPath('logo.svg'),
                }}
              />
              <AssetSlotCard
                label="Reversed logo"
                format="The same logo drawn for dark backgrounds, SVG or transparent PNG"
                usedOn={['College band', 'Sidebar', 'Footer']}
                src={value.logoInverse}
                emptyAsk="No reversed logo yet — the band shows the portal name as a wordmark. Ask for a version for dark backgrounds."
                edit={{
                  id: 'asset-logo-inverse',
                  value: value.logoInverse,
                  onChange: (v) => set('logoInverse', v),
                  error: err('logoInverse'),
                  placeholder: assetPath('logo-reversed.svg'),
                }}
              />
              <AssetSlotCard
                label="Logo mark"
                format="Square, SVG or a 512px transparent PNG"
                usedOn={['Small spaces']}
                src={value.logoMark}
                emptyAsk="No mark yet — small spaces fall back to the crest or the wordmark. Ask for a square version."
                edit={{
                  id: 'asset-mark',
                  value: value.logoMark,
                  onChange: (v) => set('logoMark', v),
                  error: err('logoMark'),
                  placeholder: assetPath('mark.svg'),
                }}
              />
              <AssetSlotCard
                label="Share card"
                format="1200×630 PNG or JPEG"
                usedOn={['WhatsApp link previews', 'Other link previews']}
                src={value.ogImage}
                kind="photo"
                emptyAsk="No share card yet — shared links show the portal name only."
                edit={{
                  id: 'asset-og',
                  value: value.ogImage,
                  onChange: (v) => set('ogImage', v),
                  error: err('ogImage'),
                  placeholder: assetPath('share-card.png'),
                }}
              />
            </div>
          </Disclosure>

          {/* 2. Campus photos */}
          <Disclosure
            summary={
              <SectionSummary
                icon={<Images className="size-4" />}
                title="Campus photos"
                note={photoCount ? `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}` : 'None supplied yet'}
              />
            }
          >
            <div className="space-y-3">
              <p
                className={cn(
                  'flex items-start gap-2 rounded border px-3 py-2.5 text-sm',
                  scrimIssue && scrimIssue.severity === 'error'
                    ? 'border-[color-mix(in_srgb,var(--danger)_40%,var(--border))] bg-danger-soft text-danger-fg'
                    : 'border-line bg-surface text-secondary',
                )}
              >
                {scrimIssue ? (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-fg" aria-hidden="true" />
                )}
                <span>
                  {scrimIssue
                    ? `Text over photos is hard to read: ${scrimIssue.ratio.toFixed(2)}:1 over a white patch, and it needs ${scrimIssue.required}:1. Darken the primary colour.`
                    : 'Text over photos stays readable: the tint behind it clears 4.5:1 even over a white patch.'}
                </span>
              </p>

              <AssetSlotCard
                label="Landing photo"
                format="Landscape, 2400×1350 or larger, WebP or JPEG under 350 KB"
                usedOn={['Landing page', 'Member home band']}
                src={value.heroImage}
                kind="photo"
                focus={base.assets.heroFocus}
                emptyAsk="No landing photo yet — the landing page shows the solid college band. Ask for a wide campus photo."
                edit={{
                  id: 'asset-hero',
                  value: value.heroImage,
                  onChange: (v) => set('heroImage', v),
                  error: err('heroImage'),
                  placeholder: assetPath('hero.jpg'),
                }}
              >
                <ReadOnlyFacts
                  rows={[
                    ['Description', base.assets.heroImageAlt ?? 'None — the photo is treated as decorative'],
                    ['Crop focus', base.assets.heroFocus],
                  ]}
                />
              </AssetSlotCard>

              <AssetSlotCard
                label="Sign-in photo"
                format="Portrait or square, 1200px or larger"
                usedOn={['Sign-in page', 'Welcome panel']}
                src={base.assets.authImage}
                kind="photo"
                focus={base.assets.authFocus}
                emptyAsk="No sign-in photo — the sign-in page uses the landing photo, then the solid band."
                readOnlyNote="Set in the pack file by your vendor."
              />

              <AssetSlotCard
                label="Landing video"
                format="MP4 or WebM, 10–20 seconds, 6 MB or less, muted"
                usedOn={['Landing page, desktops only']}
                src={base.assets.heroVideo}
                kind="file"
                emptyAsk="No video — the landing photo is used. A video is optional and never plays on phones."
                readOnlyNote="Set in the pack file by your vendor."
              />

              <section className="space-y-3 rounded-lg border border-line bg-surface-raised p-4">
                <header className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">Campus photos</h3>
                    <p className="text-xs text-secondary">Up to eight, each with a description and a caption</p>
                  </div>
                  <Badge tone={base.assets.campusPhotos.length ? 'success' : 'neutral'} className="shrink-0 whitespace-nowrap">
                    {base.assets.campusPhotos.length ? `${base.assets.campusPhotos.length} supplied` : 'Not supplied yet'}
                  </Badge>
                </header>
                {base.assets.campusPhotos.length ? (
                  <ul className="grid grid-cols-2 gap-3">
                    {base.assets.campusPhotos.map((p) => {
                      const tags = [
                        ...(p.use ?? []).map((u) => `${u.charAt(0).toUpperCase()}${u.slice(1)} band`),
                        p.batchYear ? `Batch of ${p.batchYear}` : null,
                        p.departmentCode ? `Branch ${p.departmentCode}` : null,
                      ].filter(Boolean) as string[];
                      return (
                        <li key={p.src} className="min-w-0 space-y-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.src}
                            alt={p.alt}
                            className="aspect-[4/3] w-full rounded border border-line object-cover"
                            style={p.focus ? { objectPosition: p.focus } : undefined}
                          />
                          <p className="text-xs font-medium">{p.caption ?? 'No caption'}</p>
                          <p className="text-xs text-secondary">{tags.length ? tags.join(' · ') : 'Untagged'}</p>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-secondary">
                    No campus photos yet — the landing page leaves out the campus section. Ask the college for four to
                    six photos, each with a caption.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-secondary">Used on</span>
                  {['Landing page', 'Member home, giving and profile bands'].map((u) => (
                    <Badge key={u} tone="neutral" className="whitespace-nowrap">
                      {u}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-secondary">
                  Set in the pack file by your vendor. A photo tagged with a batch or a branch appears only on that
                  batch&rsquo;s or branch&rsquo;s page.
                </p>
              </section>
            </div>
          </Disclosure>

          {/* 3. Colours */}
          <Disclosure
            defaultOpen
            summary={
              <SectionSummary
                icon={<Palette className="size-4" />}
                title="Colours"
                note="The colours from your style guide. Everything else is worked out and checked."
              />
            }
          >
            <div className="space-y-5">
              <ColourField
                id="brand-primary"
                label="Primary"
                hint="The one colour the college always uses. It becomes the college band, buttons and links."
                value={value.primary}
                onChange={(v) => set('primary', v)}
                contrast={{
                  from: tokens.light['--brand-fg'] ?? '',
                  to: tokens.light['--surface'] ?? '',
                  label: 'brand text on your page colour',
                  required: 4.5,
                }}
              />

              <ColourField
                id="brand-accent"
                label="Accent"
                optional
                fallback={value.primary}
                derivedNote="Left empty, the accent follows the primary. Most colleges have one colour, and that is fine."
                value={value.accent}
                onChange={(v) => set('accent', v)}
              />

              <ColourField
                id="brand-surface"
                label="Page colour"
                hint="A warm off-white reads as designed; pure white reads as unstyled."
                value={value.surface}
                onChange={(v) => set('surface', v)}
                contrast={{
                  from: tokens.light['--text-primary'] ?? '',
                  to: tokens.light['--surface'] ?? '',
                  label: 'body text on the page',
                  required: 7,
                }}
              />

              <ColourField
                id="brand-surface-dark"
                label="Dark page colour"
                hint="Dark mode is worked out from this one colour."
                value={value.surfaceDark}
                onChange={(v) => set('surfaceDark', v)}
                contrast={{
                  from: tokens.dark['--text-primary'] ?? '',
                  to: tokens.dark['--surface'] ?? '',
                  label: 'body text in dark mode',
                  required: 7,
                }}
              />
            </div>
          </Disclosure>

          {/* 4. Words */}
          <Disclosure
            summary={
              <SectionSummary
                icon={<TypeIcon className="size-4" />}
                title="Words"
                note="The college's names, address and landing page lines."
              />
            }
          >
            <div className="space-y-5">
              <Field
                htmlFor="copy-portal"
                label="Portal name"
                required
                hint="In the header, the browser tab and every email subject."
                error={err('portalName')}
              >
                <Input
                  id="copy-portal"
                  value={value.portalName}
                  onChange={(e) => set('portalName', e.target.value)}
                  maxLength={60}
                  aria-describedby={describedBy('copy-portal', { hint: true, error: Boolean(err('portalName')) })}
                />
              </Field>

              <Field
                htmlFor="copy-institution"
                label="Institution name"
                hint="The full name, as on the degree certificate."
                error={err('institutionName')}
              >
                <Input
                  id="copy-institution"
                  value={value.institutionName}
                  onChange={(e) => set('institutionName', e.target.value)}
                  maxLength={120}
                  aria-describedby={describedBy('copy-institution', {
                    hint: true,
                    error: Boolean(err('institutionName')),
                  })}
                />
              </Field>

              <Field
                htmlFor="copy-short"
                label="Short name"
                hint="What people call the college in a sentence."
                error={err('shortName')}
              >
                <Input
                  id="copy-short"
                  value={value.shortName}
                  onChange={(e) => set('shortName', e.target.value)}
                  maxLength={24}
                  className="max-w-40"
                  aria-describedby={describedBy('copy-short', { hint: true, error: Boolean(err('shortName')) })}
                />
              </Field>

              <Field
                htmlFor="copy-tagline"
                label="Tagline"
                hint="One line above the landing headline. The place name works well."
                error={err('tagline')}
              >
                <Input
                  id="copy-tagline"
                  value={value.tagline}
                  onChange={(e) => set('tagline', e.target.value)}
                  maxLength={160}
                  aria-describedby={describedBy('copy-tagline', { hint: true, error: Boolean(err('tagline')) })}
                />
              </Field>

              <Field
                htmlFor="copy-support"
                label="Support email"
                hint="Where members write for help. In the footer and on the contact page."
                error={err('supportEmail')}
              >
                <Input
                  id="copy-support"
                  type="email"
                  value={value.supportEmail}
                  onChange={(e) => set('supportEmail', e.target.value)}
                  invalid={Boolean(err('supportEmail'))}
                  aria-describedby={describedBy('copy-support', { hint: true, error: Boolean(err('supportEmail')) })}
                />
              </Field>

              <div className="space-y-2 rounded-lg border border-line bg-surface p-3">
                <p className="text-sm font-semibold">Set in the pack file by your vendor</p>
                <ReadOnlyFacts
                  rows={[
                    ['Address', base.copy.addressLines.length ? base.copy.addressLines.join(', ') : 'Not supplied yet'],
                    ['Phone', base.copy.supportPhone ?? 'Not supplied yet'],
                    ['Website', base.copy.websiteUrl ?? 'Not supplied yet'],
                    ['Landing headline', value.heroHeadline || 'Not set'],
                    ['Highlighted phrase', value.heroEmphasis || 'Not set'],
                    ['Landing subhead', value.heroSubhead || 'Not set'],
                  ]}
                />
              </div>
            </div>
          </Disclosure>

          {/* 5. Advanced */}
          <Disclosure
            summary={
              <SectionSummary
                icon={<Ruler className="size-4" />}
                title="Advanced: type, shape and density"
                note={`${value.fontDisplay} and ${value.fontBody} · ${value.radius} corners`}
              />
            }
          >
            <div className="space-y-5">
              <Field
                htmlFor="font-display"
                label="Heading typeface"
                hint="Headings and the wordmark. Pick from the list or type any Google Fonts family."
                error={err('fontDisplay')}
              >
                <Input
                  id="font-display"
                  list="display-fonts"
                  value={value.fontDisplay}
                  onChange={(e) => set('fontDisplay', e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby={describedBy('font-display', { hint: true, error: Boolean(err('fontDisplay')) })}
                />
                <datalist id="display-fonts">
                  {DISPLAY_FONTS.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </Field>

              <Field
                htmlFor="font-body"
                label="Body typeface"
                hint="Everything else. Noto Sans, Mukta and Hind also carry Telugu and Devanagari."
                error={err('fontBody')}
              >
                <Input
                  id="font-body"
                  list="body-fonts"
                  value={value.fontBody}
                  onChange={(e) => set('fontBody', e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby={describedBy('font-body', { hint: true, error: Boolean(err('fontBody')) })}
                />
                <datalist id="body-fonts">
                  {BODY_FONTS.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </Field>

              <Segmented
                name="radius"
                label="Corners"
                hint="Every button, field, card and dialog at once."
                value={value.radius}
                onChange={(v) => set('radius', v)}
                options={[
                  { value: 'none', label: 'Square' },
                  { value: 'subtle', label: 'Subtle' },
                  { value: 'rounded', label: 'Rounded' },
                  { value: 'pill', label: 'Pill' },
                ]}
              />

              <Segmented
                name="density"
                label="Density"
                hint="Member screens only. The staff console is always compact on large screens."
                value={value.density}
                onChange={(v) => set('density', v)}
                options={[
                  { value: 'comfortable', label: 'Comfortable' },
                  { value: 'compact', label: 'Compact' },
                ]}
              />

              <Segmented
                name="elevation"
                label="Elevation"
                hint="Flat draws cards with a hairline; lifted gives them a shadow."
                value={value.elevation}
                onChange={(v) => set('elevation', v)}
                options={[
                  { value: 'flat', label: 'Flat' },
                  { value: 'soft', label: 'Soft' },
                  { value: 'lifted', label: 'Lifted' },
                ]}
              />
            </div>
          </Disclosure>

          {/* 6. For your vendor */}
          <Disclosure
            summary={
              <SectionSummary
                icon={<Wrench className="size-4" />}
                title="For your vendor"
                note="The pack file, fine colour settings and modules."
                badge="Not saved by Publish"
              />
            }
          >
            <div className="space-y-6">
              <p className="text-sm text-secondary">
                Nothing in this section is saved by Publish. Changes here shape the pack file you can download below;
                your vendor puts that file live.
              </p>

              <div className="space-y-5">
                <ColourField
                  id="brand-ink"
                  label="Ink"
                  optional
                  packOnly
                  fallback={tokens.light['--surface-inverse']}
                  derivedNote="The darkest tone, for headings and inverse buttons. Worked out from the page colour when empty."
                  value={value.ink}
                  onChange={(v) => set('ink', v)}
                />

                <ColourField
                  id="brand-marker"
                  label="Marker"
                  optional
                  packOnly
                  fallback={tokens.light['--marker']}
                  derivedNote="The highlighter stroke used for decoration only."
                  value={value.marker}
                  onChange={(v) => set('marker', v)}
                />

                <Field
                  htmlFor="brand-chroma"
                  label="Neutral tint"
                  hint="How much of the brand colour tints the greys. Zero gives neutral greys."
                  notice={
                    <span className="inline-flex items-center gap-1.5">
                      <Badge tone="outline" className="shrink-0 whitespace-nowrap">
                        pack file
                      </Badge>
                      <span>Saved in the pack file, not by Publish.</span>
                    </span>
                  }
                >
                  <div className="flex items-center gap-3">
                    <input
                      id="brand-chroma"
                      type="range"
                      min={0}
                      max={0.05}
                      step={0.002}
                      value={value.neutralChroma}
                      onChange={(e) => set('neutralChroma', Number(e.target.value))}
                      aria-describedby={describedBy('brand-chroma', { hint: true })}
                      className="h-2 w-full cursor-pointer accent-[var(--button-primary-bg)]"
                    />
                    <output
                      htmlFor="brand-chroma"
                      className="w-14 shrink-0 text-right font-mono text-xs tabular text-secondary"
                    >
                      {value.neutralChroma.toFixed(3)}
                    </output>
                  </div>
                </Field>
              </div>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Modules</h3>
                <ul className="divide-y divide-line rounded border border-line bg-surface text-sm">
                  {MODULES.map((m) => {
                    const on = value.features[m.key] === true;
                    return (
                      <li key={m.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
                        <span className="font-medium">{m.label}</span>
                        {m.key === 'donations' && !on ? (
                          <span className="text-xs text-secondary">
                            {fcraRegistered
                              ? 'Switched on by your vendor on request'
                              : 'Switched on by your vendor once FCRA status is confirmed'}
                          </span>
                        ) : (
                          <Badge tone={on ? 'success' : 'neutral'} dot className="shrink-0">
                            {on ? 'On' : 'Off'}
                          </Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">The pack file</h3>
                <PackImportExport pack={exportPack} packId={exportId} onLoad={loadPack} />
              </section>
            </div>
          </Disclosure>

          {/* Templates */}
          <Disclosure
            summary={
              <SectionSummary
                icon={<ImageIcon className="size-4" />}
                title="Start again from a template"
                note="Replaces the colours, type and words above."
              />
            }
          >
            <PresetGallery
              packs={basePacks}
              value={value.basePackId}
              onSelect={(id) => {
                if (id !== value.basePackId) setTemplateChoice({ id });
              }}
              currentId={currentPackId}
            />
          </Disclosure>

          {/* The full contrast report */}
          <Disclosure
            summary={
              <SectionSummary
                icon={blocked ? <AlertTriangle className="size-4" /> : <Check className="size-4" />}
                title="Contrast checks"
                note={report.summary}
              />
            }
          >
            <ContrastReport report={report} pending={pending} />
          </Disclosure>
        </div>
      </div>

      <Disclosure summary="For designers: every derived token">
        <TokenPreview tokens={tokens} />
      </Disclosure>

      <StickyActionBar label="Publish branding">
        {gateChip}
        {publishButton}
      </StickyActionBar>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={publish}
        pending={publishing}
        tone="primary"
        title="Publish this branding?"
        confirmLabel="Publish"
        body={
          <div className="space-y-2">
            <p>
              Every {tenantName} member — alumni, final-year students, faculty and staff — sees this on their next
              page load. It is recorded in the audit log with your name.
            </p>
            <p>
              Publish saves the crest and logos, the landing photo, the colours, the words you can edit, and the type
              and shape. Anything under &ldquo;For your vendor&rdquo; is not saved.
            </p>
          </div>
        }
      />

      <ConfirmDialog
        open={templateChoice !== null}
        onClose={() => setTemplateChoice(null)}
        onConfirm={() => {
          if (templateChoice) applyTemplate(templateChoice.id);
          setTemplateChoice(null);
        }}
        tone="primary"
        title="Replace your changes with this template?"
        confirmLabel="Use the template"
        body={
          <p>
            The colours, type, shape, logos and words in every section are replaced with the template&rsquo;s. Nothing
            is published until you press Publish, and Discard brings back what is live.
          </p>
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------
// Local pieces
// ---------------------------------------------------------------

function SectionSummary({
  icon,
  title,
  note,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  note: string;
  badge?: string;
}) {
  return (
    <span className="flex min-w-0 items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-secondary" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-display text-sm font-semibold text-primary">{title}</span>
          {badge ? (
            <Badge tone="warning" className="shrink-0 whitespace-nowrap">
              {badge}
            </Badge>
          ) : null}
        </span>
        <span className="block text-xs font-normal text-secondary">{note}</span>
      </span>
    </span>
  );
}

function ReadOnlyFacts({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
      {rows.map(([label, text]) => (
        <React.Fragment key={label}>
          <dt className="text-secondary">{label}</dt>
          <dd className="min-w-0 break-words text-primary">{text}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

/**
 * A segmented choice built from real radios.
 *
 * The labels are styled off `peer-checked`, so the control keeps native
 * keyboard behaviour, native form semantics and a correct screen-reader
 * announcement without a line of ARIA.
 */
function Segmented<T extends string>({
  name,
  label,
  hint,
  value,
  onChange,
  options,
}: {
  name: string;
  label: string;
  hint?: string;
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium text-primary">{label}</legend>
      {hint ? <p className="text-xs text-secondary">{hint}</p> : null}

      <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-line bg-surface-sunken p-0.5">
        {options.map((option) => (
          <label key={option.value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span
              className={cn(
                'flex min-h-11 items-center rounded px-3 text-xs font-medium text-secondary sm:min-h-8',
                'transition-colors duration-fast ease-brand',
                'peer-checked:bg-surface-raised peer-checked:text-primary peer-checked:shadow-sm',
                'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus-ring)]',
              )}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
