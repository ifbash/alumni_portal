'use client';

import * as React from 'react';
import {
  AlertTriangle,
  Check,
  FileJson,
  Image as ImageIcon,
  LayoutGrid,
  Palette,
  Ruler,
  Sparkles,
  Type as TypeIcon,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Disclosure,
  Field,
  Input,
  Spinner,
  Switch,
  Textarea,
  describedBy,
  useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import type { BrandPack } from '@/lib/branding/pack';
import { ColourField, normaliseHex } from '@/components/branding/ColourField';
import { ContrastReport, type ContrastReportValue } from '@/components/branding/ContrastReport';
import { LivePreview, type PreviewCopy } from '@/components/branding/LivePreview';
import { PackImportExport } from '@/components/branding/PackImportExport';
import { PresetGallery, type BasePackOption } from '@/components/branding/PresetGallery';
import { TokenPreview, parseTokenCss } from '@/components/branding/TokenPreview';

/**
 * The branding studio.
 *
 * Editing on the left, the consequence on the right, continuously. Two
 * things make it worth building rather than shipping a colour form:
 *
 *  1. **The preview is the artefact.** Every edit is debounced into
 *     `POST /api/admin/branding?preview=1`, which runs the same resolver
 *     the page renderer runs. The stylesheet that comes back is injected
 *     into isolated frames, so what a registrar approves is byte-for-byte
 *     what their members load.
 *  2. **The contrast audit is a gate, not a report.** It is on screen at
 *     all times and errors disable Publish. A college that picks a marginal
 *     accent is told and left to ship; body text nobody can read is
 *     refused, because it will be refused on the first accessibility
 *     complaint anyway and by then it is on eight thousand screens.
 *
 * The browser form and the pack file are deliberately different surfaces.
 * A registrar edits this; a reseller shipping fifty colleges edits JSON.
 * Fields the form cannot persist are marked, and both roads end at the
 * same schema.
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
    // omitting an asset the tenant already has would silently blank it.
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

const FEATURES: Array<{ key: string; label: string; hint: string }> = [
  { key: 'directory', label: 'Directory', hint: 'The searchable alumni list. Almost everything else assumes it.' },
  { key: 'connections', label: 'Connections', hint: 'Students and alumni asking each other for introductions, mentoring and referrals — under a quota.' },
  { key: 'events', label: 'Events', hint: 'Reunions, guest lectures and campus drives, with registration and check-in.' },
  { key: 'jobs', label: 'Jobs and internships', hint: 'Alumni post openings; final-years apply. Moderated before anything goes live.' },
  { key: 'mentorship', label: 'Mentorship register', hint: 'The opt-in list alumni join from their own profile.' },
  { key: 'donations', label: 'Giving', hint: 'Campaigns, receipts and FCRA segregation. Off until the college confirms its registration.' },
  { key: 'gallery', label: 'Gallery', hint: 'Photographs from events, batch albums, campus.' },
  { key: 'news', label: 'News and notices', hint: 'Announcements from the alumni cell.' },
  { key: 'whatsapp', label: 'WhatsApp notices', hint: 'Sends over WhatsApp Business rather than email alone. Email open rates on Indian alumni lists are poor.' },
  { key: 'publicLanding', label: 'Public landing page', hint: 'A signed-out page describing the portal. The directory itself is never public.' },
];

// ---------------------------------------------------------------

export interface BrandingStudioProps {
  pack: BrandPack;
  basePacks: BasePackOption[];
  /** Every base pack, keyed by id. `''` is the neutral default. */
  packsById: Record<string, BrandPack>;
  currentPackId: string | null;
  /** Filename stem for the export — the tenant's subdomain. */
  exportId: string;
  tenantName: string;
  fcraRegistered: boolean;
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

export function BrandingStudio({
  pack,
  basePacks,
  packsById,
  currentPackId,
  exportId,
  tenantName,
  fcraRegistered,
  initialCss,
  initialFontHref,
  fontFacesByPack,
  initialReport,
}: BrandingStudioProps) {
  const toast = useToast();

  const initialValue = React.useMemo(() => fromPack(pack, currentPackId), [pack, currentPackId]);

  const [value, setValue] = React.useState<StudioValue>(initialValue);
  /** What the tenant is actually serving. Moves only on a successful publish. */
  const [saved, setSaved] = React.useState<StudioValue>(initialValue);
  const [importedBase, setImportedBase] = React.useState<BrandPack | null>(null);
  const [preview, setPreview] = React.useState<PreviewState>({
    css: initialCss,
    fontHref: initialFontHref,
    report: initialReport,
  });
  const [pending, setPending] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [confirming, setConfirming] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [publishedAt, setPublishedAt] = React.useState<string | null>(null);

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
        try {
          const res = await fetch('/api/admin/branding?preview=1', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(toPayload(value)),
            signal: controller.signal,
          });
          const data = (await res.json()) as {
            css?: string;
            fontHref?: string | null;
            report?: ContrastReportValue;
            error?: string;
            fieldErrors?: Record<string, string[] | undefined>;
          };

          // A slower earlier request must never overwrite a newer answer.
          if (sequence.current !== id) return;

          if (res.ok && data.css && data.report) {
            setFieldErrors({});
            setPreviewError(null);
            setPreview({ css: data.css, fontHref: data.fontHref ?? null, report: data.report });
          } else if (res.status === 422 && data.fieldErrors) {
            setFieldErrors(data.fieldErrors);
            setPreviewError(null);
          } else {
            setPreviewError(data.error ?? 'The server refused that combination.');
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          if (sequence.current === id) {
            setPreviewError('Could not reach the server. What you see below is one edit old.');
          }
        } finally {
          if (sequence.current === id) setPending(false);
        }
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
  const exportPack = React.useMemo(
    () => toPackObject(base, value, exportId),
    [base, value, exportId],
  );

  const dirty = React.useMemo(
    () => JSON.stringify(value) !== JSON.stringify(saved),
    [value, saved],
  );

  const report = preview.report;
  const blocked = !report.passes;

  const previewCopy: PreviewCopy = {
    portalName: value.portalName,
    institutionName: value.institutionName,
    shortName: value.shortName,
    tagline: value.tagline,
    heroHeadline: value.heroHeadline,
    heroEmphasis: value.heroEmphasis,
    heroSubhead: value.heroSubhead,
    supportEmail: value.supportEmail,
  };

  const emphasisMissing =
    value.heroEmphasis.trim().length > 0 &&
    !value.heroHeadline.includes(value.heroEmphasis.trim());

  const err = (key: string): string | null => fieldErrors[key]?.[0] ?? null;

  function choosePack(id: string | null) {
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
    try {
      const res = await fetch('/api/admin/branding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(toPayload(value)),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; report?: ContrastReportValue };

      if (!res.ok || !data.ok) {
        if (data.report) setPreview((current) => ({ ...current, report: data.report! }));
        toast.error('Not published', data.error ?? 'The server refused these values.');
        return;
      }

      setConfirming(false);
      setSaved(value);
      setPublishedAt(new Date().toISOString());
      toast.success(
        'Branding published',
        `Every ${tenantName} member sees this on their next page load. The change is in the audit log.`,
      );
    } catch {
      toast.error('Could not reach the server', 'Nothing was published.');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-gutter">
      <SeedsExplainer />

      {/* Action bar. Sits under the app's top bar so Publish and the gate
          state stay reachable however far the controls scroll. */}
      <div className="sticky top-14 z-30 rounded-lg border border-line bg-surface-raised px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {pending ? (
              <span className="inline-flex items-center gap-2 text-sm text-secondary">
                <Spinner className="size-4" />
                Resolving
              </span>
            ) : blocked ? (
              <Badge tone="danger" dot>
                {report.errors.length} contrast failure{report.errors.length === 1 ? '' : 's'}
              </Badge>
            ) : dirty ? (
              <Badge tone="warning" dot>
                Unpublished changes
              </Badge>
            ) : (
              <Badge tone="success" dot>
                Live
              </Badge>
            )}
            <span className="truncate text-xs text-muted">
              {blocked
                ? 'Publishing is disabled until these are fixed.'
                : dirty
                  ? 'Nobody but you sees this until you publish.'
                  : publishedAt
                    ? 'Published. Members pick it up on their next page load.'
                    : `Serving ${tenantName} now.`}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
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
              Discard changes
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={blocked || !dirty || pending || publishing}
              onClick={() => setConfirming(true)}
            >
              Publish
            </Button>
          </div>
        </div>
      </div>

      {previewError ? (
        <Alert tone="warning" title="The preview is stale" icon={<AlertTriangle className="size-4" />}>
          <p>{previewError}</p>
        </Alert>
      ) : null}

      <div className="grid items-start gap-gutter xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        {/* ---------------- Controls ---------------- */}
        <div className="space-y-3">
          <Disclosure
            defaultOpen
            summary={
              <SummaryLine
                icon={<Sparkles className="size-4" />}
                title="Start from a pack"
                note="Inherit a complete identity, then change what differs."
              />
            }
          >
            <PresetGallery
              packs={basePacks}
              value={value.basePackId}
              onSelect={choosePack}
              currentId={currentPackId}
            />
          </Disclosure>

          <Disclosure
            defaultOpen
            summary={
              <SummaryLine
                icon={<Palette className="size-4" />}
                title="Colour"
                note="Four seeds. Ramps, fills, borders and dark mode are computed."
              />
            }
          >
            <div className="space-y-5">
              <ColourField
                id="brand-primary"
                label="Primary"
                hint="The one colour a college always knows. Drives the whole brand ramp, the primary button and the focus ring."
                value={value.primary}
                onChange={(v) => set('primary', v)}
                contrast={{
                  from: tokens.light['--brand-fg'],
                  to: tokens.light['--surface'],
                  label: 'the derived brand text on your page colour',
                  required: 4.5,
                }}
              />

              <ColourField
                id="brand-accent"
                label="Accent"
                optional
                fallback={value.primary}
                derivedNote="Left empty, the accent follows the primary — a monochrome scheme, which always reads as deliberate. Most colleges have one colour, and a second badly chosen one is worse than none."
                value={value.accent}
                onChange={(v) => set('accent', v)}
              />

              <ColourField
                id="brand-surface"
                label="Page colour"
                hint="Warm off-whites read as designed. Pure #FFFFFF reads as unstyled."
                value={value.surface}
                onChange={(v) => set('surface', v)}
                contrast={{
                  from: tokens.light['--text-primary'],
                  to: tokens.light['--surface'],
                  label: 'body text on the page',
                  required: 7,
                }}
              />

              <ColourField
                id="brand-surface-dark"
                label="Dark page colour"
                hint="The whole of dark mode is derived from this one value. Nobody is asked for a second palette — a second palette is a second bad palette."
                value={value.surfaceDark}
                onChange={(v) => set('surfaceDark', v)}
                contrast={{
                  from: tokens.dark['--text-primary'],
                  to: tokens.dark['--surface'],
                  label: 'body text in dark mode',
                  required: 7,
                }}
              />

              <div className="rounded-lg border border-line bg-surface-sunken p-3 text-xs text-secondary">
                <p className="font-semibold text-primary">The three below travel in the pack file</p>
                <p className="mt-1">
                  Publish writes the four seeds above, the type, the shape and the wording into this
                  tenant&rsquo;s record. Ink, marker and neutral chroma are pack-level settings —
                  they are read from the base pack and ship in the JSON you export at the bottom of
                  this page. Editing them here shapes that file.
                </p>
              </div>

              <ColourField
                id="brand-ink"
                label="Ink"
                optional
                packOnly
                fallback={tokens.light['--surface-inverse']}
                derivedNote="The darkest tone: headings, the footer band, inverse buttons. Derived from the neutral ramp when empty."
                value={value.ink}
                onChange={(v) => set('ink', v)}
              />

              <ColourField
                id="brand-marker"
                label="Marker"
                optional
                packOnly
                fallback={tokens.light['--marker']}
                derivedNote="The highlighter stroke under a hero phrase. Decoration only — never a fill, never body text, so it is not contrast-audited."
                value={value.marker}
                onChange={(v) => set('marker', v)}
              />

              <Field
                htmlFor="brand-chroma"
                label="Neutral chroma"
                hint="How much of the brand hue bleeds into the greys. Zero gives neutral greys; higher values tint borders and quiet text toward the brand."
                notice={
                  <span className="inline-flex items-center gap-1.5">
                    <Badge tone="outline">pack file</Badge>
                    <span>Travels in the exported JSON, not in the browser form.</span>
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
          </Disclosure>

          <Disclosure
            summary={
              <SummaryLine
                icon={<TypeIcon className="size-4" />}
                title="Type"
                note="Two families. Loaded at runtime, so a face chosen after deployment still arrives."
              />
            }
          >
            <div className="space-y-5">
              <Field
                htmlFor="font-display"
                label="Display face"
                hint="Headings, the wordmark and the hero. Pick from the list or type any Google Fonts family."
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
                label="Body face"
                hint="Everything else. Noto Sans, Mukta and Hind carry Telugu and Devanagari — worth one of those if the college posts notices in Telugu."
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

              <p className="text-xs text-muted">
                The mono face — roll numbers, amounts, IDs — is set in the pack file and is not worth
                a control. It is <code className="font-mono">{pack.type.mono}</code> here.
              </p>
            </div>
          </Disclosure>

          <Disclosure
            summary={
              <SummaryLine
                icon={<Ruler className="size-4" />}
                title="Shape and density"
                note="Corners, control heights and how much lift a card has."
              />
            }
          >
            <div className="space-y-5">
              <Segmented
                name="radius"
                label="Corners"
                hint="Applies to every button, input, badge, card and dialog at once."
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
                hint="Compact shrinks control heights and gutters. Worth it for staff who spend the day in the verification queue; not worth it for alumni."
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
                hint="Flat suits institutional brands and draws cards with a hairline instead of a shadow. Lifted suits consumer-feeling ones."
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

          <Disclosure
            summary={
              <SummaryLine
                icon={<LayoutGrid className="size-4" />}
                title="Words"
                note="Half of “looks like ours” is wording, not colour."
              />
            }
          >
            <div className="space-y-5">
              <Field
                htmlFor="copy-portal"
                label="Portal name"
                required
                hint="Shown in the header, the browser tab and every email subject line."
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
                hint="The full legal name. Used in the footer, receipts and DPDP notices."
                error={err('institutionName')}
              >
                <Input
                  id="copy-institution"
                  value={value.institutionName}
                  onChange={(e) => set('institutionName', e.target.value)}
                  maxLength={120}
                  aria-describedby={describedBy('copy-institution', { hint: true, error: Boolean(err('institutionName')) })}
                />
              </Field>

              <Field
                htmlFor="copy-short"
                label="Short name"
                hint="Two or three letters. Becomes the logo mark when no crest has been supplied."
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
                hint="One line under the name. Location and year of establishment work better than a slogan."
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
                label="Support address"
                hint="Where a member writes when verification stalls. Goes in the footer and in every system email."
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

              <div className="space-y-5 rounded-lg border border-line bg-surface-sunken p-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-primary">Hero</p>
                  <p className="text-xs text-secondary">
                    The three lines on the signed-out landing page.{' '}
                    <Badge tone="outline">pack file</Badge> They ship in the exported JSON rather
                    than through this form, but the preview shows them.
                  </p>
                </div>

                <Field
                  htmlFor="copy-hero"
                  label="Headline"
                  hint="A sentence, not a slogan. It should say what the portal does for the person reading it."
                >
                  <Textarea
                    id="copy-hero"
                    value={value.heroHeadline}
                    onChange={(e) => set('heroHeadline', e.target.value)}
                    maxLength={120}
                    rows={2}
                    aria-describedby={describedBy('copy-hero', { hint: true })}
                  />
                </Field>

                <Field
                  htmlFor="copy-emphasis"
                  label="Circled phrase"
                  hint="Drawn with a marker stroke inside the headline."
                  error={
                    emphasisMissing
                      ? 'This phrase does not appear in the headline, so the marker stroke has nothing to draw under.'
                      : null
                  }
                >
                  <Input
                    id="copy-emphasis"
                    value={value.heroEmphasis}
                    onChange={(e) => set('heroEmphasis', e.target.value)}
                    maxLength={60}
                    invalid={emphasisMissing}
                    aria-describedby={describedBy('copy-emphasis', { hint: true, error: emphasisMissing })}
                  />
                </Field>

                <Field
                  htmlFor="copy-subhead"
                  label="Subhead"
                  hint="Two sentences at most. Say what is actually behind the sign-in, including that records are verified against the college's own degree register."
                >
                  <Textarea
                    id="copy-subhead"
                    value={value.heroSubhead}
                    onChange={(e) => set('heroSubhead', e.target.value)}
                    maxLength={320}
                    rows={3}
                    aria-describedby={describedBy('copy-subhead', { hint: true })}
                  />
                </Field>
              </div>
            </div>
          </Disclosure>

          <Disclosure
            summary={
              <SummaryLine
                icon={<ImageIcon className="size-4" />}
                title="Logos and images"
                note="Site-relative paths or https URLs. The header falls back to the wordmark."
              />
            }
          >
            <div className="space-y-5">
              <p className="text-xs text-secondary">
                Colleges supply logos inconsistently — often only a crest, frequently a single PNG
                with a baked-in white background that is unusable on a dark header. Every one of
                these is optional and the header degrades to the portal name set in the display
                face, which always renders.
              </p>

              <AssetField id="asset-logo" label="Primary logo" hint="Header lockup on a light ground." value={value.logoPrimary} onChange={(v) => set('logoPrimary', v)} error={err('logoPrimary')} />
              <AssetField id="asset-logo-inv" label="Reversed logo" hint="The same lockup for dark bands. Without it, dark mode falls back to the wordmark." value={value.logoInverse} onChange={(v) => set('logoInverse', v)} error={err('logoInverse')} />
              <AssetField id="asset-mark" label="Logo mark" hint="Square. Used in tight spaces and as the avatar for the institution." value={value.logoMark} onChange={(v) => set('logoMark', v)} error={err('logoMark')} />
              <AssetField id="asset-crest" label="Crest" hint="The college seal, in vector where possible." value={value.crest} onChange={(v) => set('crest', v)} error={err('crest')} />
              <AssetField id="asset-og" label="Share card" hint="1200×630. What appears when a member forwards a link over WhatsApp." value={value.ogImage} onChange={(v) => set('ogImage', v)} error={err('ogImage')} />
              <AssetField id="asset-hero" label="Hero image" hint="Behind the landing page headline. A generated gradient is used when this is empty." value={value.heroImage} onChange={(v) => set('heroImage', v)} error={err('heroImage')} />
            </div>
          </Disclosure>

          <Disclosure
            summary={
              <SummaryLine
                icon={<Check className="size-4" />}
                title="Modules"
                note="What this college has bought, and what it has cleared legally."
              />
            }
          >
            <div className="space-y-4">
              <p className="text-xs text-secondary">
                A switch here is a hard gate in the navigation and in the route guards, not a CSS
                class. <Badge tone="outline">pack file</Badge> These ship in the exported JSON; the
                preview reflects them immediately.
              </p>

              {value.features.donations && !fcraRegistered ? (
                <Alert
                  tone="danger"
                  title="FCRA registration is unconfirmed"
                  icon={<AlertTriangle className="size-4" />}
                >
                  <p>
                    {tenantName} has not confirmed the trust&rsquo;s FCRA registration status. Foreign
                    contributions have to be segregated at the point of collection or not collected
                    at all, so leave Giving switched off until the college answers.
                  </p>
                </Alert>
              ) : null}

              <div className="space-y-4">
                {FEATURES.map((feature) => (
                  <Switch
                    key={feature.key}
                    id={`feature-${feature.key}`}
                    label={feature.label}
                    hint={feature.hint}
                    checked={value.features[feature.key] === true}
                    onChange={(e) =>
                      setValue((current) => ({
                        ...current,
                        features: { ...current.features, [feature.key]: e.target.checked },
                      }))
                    }
                  />
                ))}
              </div>
            </div>
          </Disclosure>

          <Disclosure
            summary={
              <SummaryLine
                icon={<FileJson className="size-4" />}
                title="The pack file"
                note="Download it, hand it to a designer, paste it back."
              />
            }
          >
            <PackImportExport pack={exportPack} packId={exportId} onLoad={loadPack} />
          </Disclosure>
        </div>

        {/* ---------------- Consequence ---------------- */}
        <div className="space-y-4">
          <ContrastReport report={report} pending={pending} />
          <LivePreview
            css={preview.css}
            fontHref={preview.fontHref}
            fontFaceCss={
              importedBase ? '' : (fontFacesByPack[value.basePackId ?? ''] ?? '')
            }
            copy={previewCopy}
            features={value.features}
            pending={pending}
          />
        </div>
      </div>

      <TokenPreview tokens={tokens} />

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
              Every {tenantName} member — alumni, final-years, faculty and staff — sees this on their
              next page load. The change is written to the audit log with your name against it.
            </p>
            <p>
              Colours, type, shape, the logos and the wording above are saved. Ink, marker, neutral
              chroma, the hero lines and the module switches are not stored by this form; they ship
              in the pack file.
            </p>
          </div>
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------
// Local controls
// ---------------------------------------------------------------

function SeedsExplainer() {
  return (
    <Card>
      <CardHeader>
        <div className="min-w-0 space-y-1">
          <CardTitle as="h2">Seeds in, a design system out</CardTitle>
          <CardDescription>
            Only the values you type here are stored. Everything the portal renders is computed from
            them, every time.
          </CardDescription>
        </div>
      </CardHeader>
      <CardBody className="grid gap-4 sm:grid-cols-3">
        <Step
          n="1"
          title="You supply colours you can name"
          body="A primary, sometimes an accent, a page colour. The values a college already has in its style guide — not a palette it has to invent."
        />
        <Step
          n="2"
          title="The system derives the rest"
          body="Ten-stop ramps in OKLCH, hover states, tinted fills, borders, focus rings, the whole of dark mode, and a text colour for every fill — each one walked up the ramp until it clears its contrast target."
        />
        <Step
          n="3"
          title="Nothing is free-form"
          body="A pack may pin named tokens and nothing else. Unbounded CSS turns every support ticket into archaeology and makes the design system unmaintainable across tenants."
        />
      </CardBody>
      <CardBody className="border-t border-line pt-4 text-sm text-secondary">
        <p>
          That is why the result is accessible by construction rather than by review, and why the
          check on the right is a gate rather than a suggestion. Asking a college for eleven stops
          gets eleven bad stops.
        </p>
      </CardBody>
    </Card>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="space-y-1.5">
      <span
        aria-hidden="true"
        className="grid size-7 place-items-center rounded-full bg-brand-soft font-display text-xs font-bold text-brand-soft-fg"
      >
        {n}
      </span>
      <h3 className="font-display text-sm font-semibold">{title}</h3>
      <p className="text-sm text-secondary">{body}</p>
    </div>
  );
}

function SummaryLine({
  icon,
  title,
  note,
}: {
  icon: React.ReactNode;
  title: string;
  note: string;
}) {
  return (
    <span className="flex min-w-0 items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-muted" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-display text-sm font-semibold text-primary">{title}</span>
        <span className="block text-xs font-normal text-secondary">{note}</span>
      </span>
    </span>
  );
}

function AssetField({
  id,
  label,
  hint,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (next: string) => void;
  error: string | null;
}) {
  return (
    <Field htmlFor={id} label={label} hint={hint} error={error}>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="/brand/diet/logo.svg"
        spellCheck={false}
        autoComplete="off"
        invalid={Boolean(error)}
        className="font-mono text-xs"
        aria-describedby={describedBy(id, { hint: true, error: Boolean(error) })}
      />
    </Field>
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
                'block rounded px-3 py-1.5 text-xs font-medium text-secondary',
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
