import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@/lib/branding/color';
import {
  BrandPack,
  DEFAULT_PACK,
  OVERRIDABLE_TOKENS,
  mergePack,
  type BrandPackInput,
  type DeepPartial,
} from '@/lib/branding/pack';
import { PACKS, resolvePack } from '@/lib/branding/registry';
import { buildTokens, contrastReport, tokensToCss } from '@/lib/branding/tokens';

/**
 * The token engine.
 *
 * The claim being sold is that a college supplies one hex code and gets a
 * complete, accessible design system. That claim is only worth anything
 * if it survives the colour a registrar actually pastes in — letterhead
 * gold, a crest maroon nobody has checked, or #FF0000 because it was on
 * the prospectus. Every seed below is one of those.
 */

function pack(over: {
  primary: string;
  accent?: string;
  surface?: string;
  surfaceDark?: string;
  overrides?: Record<string, string>;
  darkOverrides?: Record<string, string>;
}): BrandPack {
  return BrandPack.parse({
    id: 'under-test',
    color: {
      primary: over.primary,
      accent: over.accent,
      surface: over.surface ?? '#ffffff',
      surfaceDark: over.surfaceDark ?? '#0f1115',
      overrides: over.overrides ?? {},
      darkOverrides: over.darkOverrides ?? {},
    },
    copy: {
      portalName: 'Test Portal',
      institutionName: 'Test Institute of Engineering',
      shortName: 'TIE',
    },
  });
}

/**
 * Awkward on purpose. Any ramp algorithm looks competent on navy; what
 * decides whether this ships to fifty colleges unattended is what it does
 * with the rest.
 */
const SEEDS: Array<{ label: string; primary: string; surface?: string }> = [
  { label: 'pale gold', primary: '#E3C567' },
  { label: 'neon lime', primary: '#B6FF3C' },
  { label: 'near black', primary: '#111111' },
  { label: 'near white', primary: '#FAFAF7' },
  { label: 'hot pink', primary: '#E5399A' },
  { label: 'saturated cyan', primary: '#00E5FF' },
  { label: 'pure red', primary: '#FF0000' },
  { label: 'pure blue', primary: '#0000FF' },
  { label: 'institutional navy', primary: '#1F3864' },
  { label: 'oxford navy', primary: '#0A2342' },
  { label: 'deep maroon', primary: '#7B1E23' },
  { label: 'brick maroon on bone', primary: '#8C2F39', surface: '#F8F5F1' },
  { label: 'forest green', primary: '#14584C' },
  { label: 'royal purple', primary: '#4B2E83' },
];

const MODES = ['light', 'dark'] as const;

describe('derivation is legible for any seed', () => {
  for (const seed of SEEDS) {
    for (const mode of MODES) {
      it(`${seed.label} (${seed.primary}) — ${mode}`, () => {
        const t = buildTokens(pack({ primary: seed.primary, surface: seed.surface }))[mode];
        const surface = t['--surface']!;

        const ratio = (token: string, against: string) => contrastRatio(t[token]!, against);

        // A label that fails against its own fill is the engine picking
        // the wrong foreground, not the customer picking a bad colour.
        expect(
          ratio('--button-primary-fg', t['--button-primary-bg']!),
          'button label on its own fill',
        ).toBeGreaterThanOrEqual(4.5);

        // Body copy is read for minutes at a time on a phone in daylight.
        // AA (4.5) is the floor for incidental text; body gets AAA.
        expect(ratio('--text-primary', surface), 'body text on the page ground').toBeGreaterThanOrEqual(7);

        expect(ratio('--brand-fg', surface), 'brand-coloured text').toBeGreaterThanOrEqual(4.5);

        // WCAG 1.4.11: non-text UI that carries meaning. A focus ring
        // nobody can see makes keyboard navigation unusable.
        expect(ratio('--focus-ring', surface), 'focus ring').toBeGreaterThanOrEqual(3);
      });
    }
  }
});

describe('mergePack', () => {
  const patch: DeepPartial<BrandPackInput> = { color: { primary: '#7B1E23' } };

  it('leaves the base intact where the patch says nothing', () => {
    const merged = mergePack(PACKS.diet!, patch);
    expect(merged.color.primary).toBe('#7B1E23');
    expect(merged.color.accent).toBe(PACKS.diet!.color.accent);
    expect(merged.color.surface).toBe(PACKS.diet!.color.surface);
    expect(merged.copy.portalName).toBe(PACKS.diet!.copy.portalName);
    expect(merged.copy.institutionName).toBe(PACKS.diet!.copy.institutionName);
    expect(merged.type.display).toBe(PACKS.diet!.type.display);
    expect(merged.shape.radius).toBe(PACKS.diet!.shape.radius);
    expect(merged.features.donations).toBe(PACKS.diet!.features.donations);
    expect(merged.locale.currency).toBe(PACKS.diet!.locale.currency);
  });

  it('does not blank a field a sparse patch mentions as undefined', () => {
    // A form that serialises every input, empty ones included, is the
    // normal way a saved override arrives. It must not wipe the pack.
    const merged = mergePack(PACKS.diet!, {
      copy: { tagline: undefined, portalName: 'Renamed' },
      color: { accent: undefined },
    });
    expect(merged.copy.portalName).toBe('Renamed');
    expect(merged.copy.tagline).toBe(PACKS.diet!.copy.tagline);
    expect(merged.color.accent).toBe(PACKS.diet!.color.accent);
  });

  it('merges overrides key by key rather than replacing the map', () => {
    const base = pack({ primary: '#1F3864', overrides: { '--marker': '#B98A2E' } });
    const merged = mergePack(base, { color: { overrides: { '--focus-ring': '#1F3864' } } });
    expect(merged.color.overrides['--marker']).toBe('#B98A2E');
    expect(merged.color.overrides['--focus-ring']).toBe('#1F3864');
  });
});

describe('resolvePack precedence', () => {
  it('falls back to DEFAULT_PACK when no pack file is named', () => {
    expect(resolvePack({ packId: null })).toEqual(DEFAULT_PACK);
    expect(resolvePack({ packId: 'no-such-college' })).toEqual(DEFAULT_PACK);
  });

  it('takes the pack file over DEFAULT_PACK', () => {
    const resolved = resolvePack({ packId: 'diet' });
    expect(resolved.color.primary).toBe(PACKS.diet!.color.primary);
    expect(resolved.copy.portalName).toBe(PACKS.diet!.copy.portalName);
    expect(resolved.copy.portalName).not.toBe(DEFAULT_PACK.copy.portalName);
  });

  it('runs DEFAULT_PACK → file → saved → preview, each layer winning over the last', () => {
    const resolved = resolvePack({
      packId: 'diet',
      saved: { color: { primary: '#7B1E23' }, copy: { portalName: 'Saved Portal' } },
      preview: { color: { primary: '#14584C' } },
    });

    // preview beats saved
    expect(resolved.color.primary).toBe('#14584C');
    // saved beats the file
    expect(resolved.copy.portalName).toBe('Saved Portal');
    // the file beats DEFAULT_PACK where nothing above it spoke
    expect(resolved.copy.institutionName).toBe(PACKS.diet!.copy.institutionName);
    // DEFAULT_PACK supplies what nobody set
    expect(resolved.locale.timeZone).toBe(DEFAULT_PACK.locale.timeZone);
  });
});

describe('overrides', () => {
  it('beat the derived value in the mode they belong to', () => {
    const t = buildTokens(
      pack({
        primary: '#1F3864',
        overrides: { '--brand-fg': '#123456' },
        darkOverrides: { '--brand-fg': '#abcdef' },
      }),
    );
    expect(t.light['--brand-fg']).toBe('#123456');
    expect(t.dark['--brand-fg']).toBe('#abcdef');
  });

  it('apply to light only; darkOverrides apply to dark only', () => {
    const derived = buildTokens(pack({ primary: '#1F3864' }));

    const lightOnly = buildTokens(pack({ primary: '#1F3864', overrides: { '--marker': '#FF0000' } }));
    expect(lightOnly.light['--marker']).toBe('#FF0000');
    expect(lightOnly.dark['--marker']).toBe(derived.dark['--marker']);

    const darkOnly = buildTokens(pack({ primary: '#1F3864', darkOverrides: { '--marker': '#00FF00' } }));
    expect(darkOnly.dark['--marker']).toBe('#00FF00');
    expect(darkOnly.light['--marker']).toBe(derived.light['--marker']);
  });

  it('pinning --text-primary does not make dark mode unreadable', () => {
    // The real bug this separation exists for: a brand guideline pins the
    // heading ink, the pin is applied to both modes, and dark mode
    // becomes ink on ink for exactly the customers whose guidelines were
    // most specific.
    const t = buildTokens(pack({ primary: '#1F3864', overrides: { '--text-primary': '#101014' } }));

    expect(t.light['--text-primary']).toBe('#101014');
    expect(t.dark['--text-primary']).not.toBe('#101014');
    expect(contrastRatio(t.dark['--text-primary']!, t.dark['--surface']!)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(t.light['--text-primary']!, t.light['--surface']!)).toBeGreaterThanOrEqual(7);
    expect(t.issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('are audited after derivation, so a bad pin is refused', () => {
    // The escape hatch is also the most likely source of an inaccessible
    // token, which is why the audit runs last rather than first.
    const t = buildTokens(pack({ primary: '#1F3864', overrides: { '--text-primary': '#EEEEEE' } }));
    expect(t.blocking).toBe(true);
    expect(t.issues.some((i) => i.token === '--text-primary' && i.severity === 'error')).toBe(true);
  });

  it('reject a token that is not in OVERRIDABLE_TOKENS', () => {
    // No free-form CSS. Unbounded theming turns every support ticket into
    // CSS archaeology.
    const bad = BrandPack.safeParse({
      id: 'bad',
      color: { primary: '#1F3864', overrides: { '--not-a-real-token': '#ffffff' } },
      copy: { portalName: 'Bad', institutionName: 'Bad College', shortName: 'BC' },
    });
    expect(bad.success).toBe(false);
  });

  it('reject a real token that is deliberately not overridable', () => {
    // `--brand-500` exists, and is still not a customer's to pin: the
    // ramps are absolute in both modes and everything derived from them
    // assumes that.
    expect(OVERRIDABLE_TOKENS).not.toContain('--brand-500');
    const bad = BrandPack.safeParse({
      id: 'bad',
      color: { primary: '#1F3864', darkOverrides: { '--brand-500': '#ffffff' } },
      copy: { portalName: 'Bad', institutionName: 'Bad College', shortName: 'BC' },
    });
    expect(bad.success).toBe(false);
  });

  it('accept every token that is in OVERRIDABLE_TOKENS', () => {
    for (const token of OVERRIDABLE_TOKENS) {
      const ok = BrandPack.safeParse({
        id: 'ok',
        color: { primary: '#1F3864', overrides: { [token]: '#123456' } },
        copy: { portalName: 'OK', institutionName: 'OK College', shortName: 'OK' },
      });
      expect(ok.success, `${token} should be overridable`).toBe(true);
    }
  });
});

describe('shipped packs', () => {
  it('ifbash publishes with no contrast errors', () => {
    const report = contrastReport(PACKS.ifbash!);
    expect(report.errors, report.summary).toEqual([]);
    expect(report.passes).toBe(true);
  });

  it('diet publishes with no contrast errors', () => {
    const report = contrastReport(PACKS.diet!);
    expect(report.errors, report.summary).toEqual([]);
    expect(report.passes).toBe(true);
  });

  it('every pack in the registry publishes', () => {
    // Adding a customer is meant to be a JSON file and one line in the
    // registry. This is the check that stops that being a way to ship an
    // unreadable portal.
    for (const [id, p] of Object.entries(PACKS)) {
      const report = contrastReport(p);
      expect(report.errors.map((e) => `${id} ${e.token}`), report.summary).toEqual([]);
    }
  });
});

describe('tokensToCss', () => {
  const css = tokensToCss(buildTokens(PACKS.diet!));

  it('emits the :root block with the base and light tokens', () => {
    expect(css.startsWith(':root{')).toBe(true);
    expect(css).toContain('--radius-sm:');
    expect(css).toContain('--font-body:');
    expect(css).toContain('--surface:');
  });

  it('emits the prefers-color-scheme block guarded against an explicit light choice', () => {
    // Without :not([data-theme="light"]) the OS setting would beat the
    // user's own toggle, which reads as the toggle being broken.
    expect(css).toContain('@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){');
  });

  it('emits the [data-theme="dark"] block so the toggle wins in both directions', () => {
    expect(css).toContain('[data-theme="dark"]{');
  });

  it('puts identical declarations in both dark blocks', () => {
    const media = css.match(/@media\(prefers-color-scheme:dark\)\{:root:not\(\[data-theme="light"\]\)\{([^}]*)\}\}/);
    const attr = css.match(/\[data-theme="dark"\]\{([^}]*)\}/);
    expect(media?.[1]).toBeTruthy();
    expect(attr?.[1]).toBe(media?.[1]);
  });
});
