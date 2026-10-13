import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@/lib/branding/color';
import { inSentence, joinList } from '@/lib/branding/copy';
import {
  AssetSpec,
  BrandPack,
  CampusPhoto,
  CopySpec,
  DEFAULT_PACK,
  OVERRIDABLE_TOKENS,
  mergePack,
  type BrandPackInput,
  type DeepPartial,
} from '@/lib/branding/pack';
import { deskFor, greetingFor, jobReviewLine, receiptLabel, vendorLabel } from '@/lib/branding/copy';
import { PACKS, resolvePack } from '@/lib/branding/registry';
import { scopedTokensCss } from '@/lib/branding/scope';
import { buildTokens, contrastReport, densityCss, tokensToCss } from '@/lib/branding/tokens';
import { getPublicEvents, isOnlineVenue, pickLeadEvent } from '@/lib/data/public-events';

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
        // …and on the raised surface, where most focusable things sit: the
        // header bar, cards, chips and inputs. Measured against the page
        // alone, the dark ring shipped at 2.83:1 on every one of them.
        expect(ratio('--focus-ring', t['--surface-raised']!), 'focus ring on a raised surface').toBeGreaterThanOrEqual(3);
        // Hovering must not take the button label below AA either.
        expect(
          ratio('--button-primary-fg', t['--button-primary-hover']!),
          'button label on its hover fill',
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe('the primary button and the raised surface', () => {
  it('fill the primary button with the seed itself when a light label reads on it', () => {
    for (const id of ['diet', 'srivarsity', 'northgate'] as const) {
      const p = PACKS[id]!;
      const light = buildTokens(p).light;
      expect(light['--button-primary-bg']!.toLowerCase(), id).toBe(p.color.primary.toLowerCase());
      expect(contrastRatio(light['--button-primary-fg']!, light['--button-primary-bg']!)).toBeGreaterThanOrEqual(7);
    }
  });

  it('keep a dark-mode button a mid-tone with a light label, not a pastel with a dark one', () => {
    for (const id of ['diet', 'srivarsity', 'northgate'] as const) {
      const dark = buildTokens(PACKS[id]!).dark;
      expect(dark['--button-primary-fg']!.toLowerCase(), id).toBe('#ffffff');
    }
  });

  it('raise a near-white page toward white, never into the neutral ramp hue', () => {
    // DIET's surface is near-achromatic, so neutral-50 carries an arbitrary
    // warm anchor and came out pink (#FFF8F6) under every card and input.
    const light = buildTokens(PACKS.diet!).light;
    expect(light['--surface-raised']!.toLowerCase()).not.toBe(light['--neutral-50']!.toLowerCase());
    expect(contrastRatio(light['--surface-raised']!, '#ffffff')).toBeLessThan(1.03);
  });
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

describe('the public-pages schema additions', () => {
  it('parse all four packs, and default what a pack leaves out', () => {
    expect(Object.keys(PACKS).sort()).toEqual(['diet', 'ifbash', 'northgate', 'srivarsity']);
    for (const [id, p] of Object.entries(PACKS)) {
      expect(BrandPack.safeParse(p).success, id).toBe(true);
    }
    expect(DEFAULT_PACK.copy.officeName).toBe('alumni cell');
    expect(DEFAULT_PACK.copy.rollNumberLabel).toBe('Roll number');
    expect(DEFAULT_PACK.assets.campusPhotos).toEqual([]);
  });
});

describe('the college band', () => {
  it('raises no band or scrim issue for any pack, in either mode', () => {
    for (const [id, p] of Object.entries(PACKS)) {
      const t = buildTokens(p);
      const bandIssues = t.issues.filter((i) => i.token.startsWith('--band') || i.token.startsWith('--scrim'));
      expect(bandIssues, id).toEqual([]);
      for (const mode of MODES) {
        expect(t[mode]['--band'], `${id} ${mode}`).toBeTruthy();
        expect(t[mode]['--scrim'], `${id} ${mode}`).toBeTruthy();
        expect(t[mode]['--focus-ring-surface'], `${id} ${mode}`).toBe(t[mode]['--focus-ring']);
      }
    }
  });

  it('holds band text to 7:1 on every pack', () => {
    for (const [id, p] of Object.entries(PACKS)) {
      const t = buildTokens(p);
      for (const mode of MODES) {
        expect(contrastRatio(t[mode]['--band-fg']!, t[mode]['--band']!), `${id} ${mode}`).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it('is the seed in both modes, stepping lighter in dark only when the seed matches the dark page', () => {
    const diet = buildTokens(PACKS.diet!);
    expect(diet.light['--band']).toBe('#1F3864');
    expect(diet.dark['--band']).toBe('#1F3864');

    // ifBash's seed aubergine is within 1.3:1 of its own dark page.
    const ifbash = buildTokens(PACKS.ifbash!);
    expect(ifbash.light['--band']).toBe('#2A1830');
    expect(ifbash.dark['--band']).not.toBe('#2A1830');
  });

  it('takes a hex --band override and ignores anything else with a warning', () => {
    const pinned = buildTokens(pack({ primary: '#1F3864', overrides: { '--band': '#0A2342' } }));
    expect(pinned.light['--band']).toBe('#0A2342');

    const bad = buildTokens(pack({ primary: '#1F3864', overrides: { '--band': 'navy' } }));
    expect(bad.light['--band']).toBe('#1F3864');
    expect(bad.issues.some((i) => i.token === '--band' && i.severity === 'warning')).toBe(true);
    expect(bad.blocking).toBe(false);
  });
});

describe('media slots', () => {
  it('accept only a direct .mp4 or .webm hero video', () => {
    const withVideo = (heroVideo: string) =>
      AssetSpec.safeParse({ heroImage: '/brand/x/hero.webp', heroVideo }).success;

    expect(withVideo('https://www.youtube.com/watch?v=x')).toBe(false);
    expect(withVideo('/media/a.mov')).toBe(false);
    expect(withVideo('/brand/x/hero.mp4')).toBe(true);
    expect(withVideo('https://b.s3.ap-south-1.amazonaws.com/x/h.webm?v=2')).toBe(true);
  });

  it('refuse a hero video without a hero image to be its poster', () => {
    const r = AssetSpec.safeParse({ heroVideo: '/brand/x/hero.mp4' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['heroVideo']);
  });

  it('require alt text on every campus photo, and at most eight of them', () => {
    expect(CampusPhoto.safeParse({ src: '/brand/x/a.jpg', alt: '' }).success).toBe(false);
    expect(CampusPhoto.safeParse({ src: '/brand/x/a.jpg', alt: 'The main block' }).success).toBe(true);

    const photo = { src: '/brand/x/a.jpg', alt: 'The main block' };
    expect(AssetSpec.safeParse({ campusPhotos: Array(8).fill(photo) }).success).toBe(true);
    expect(AssetSpec.safeParse({ campusPhotos: Array(9).fill(photo) }).success).toBe(false);
  });
});

describe('copy helpers', () => {
  it('put a label mid-sentence without breaking an acronym', () => {
    expect(inSentence('Roll number')).toBe('roll number');
    expect(inSentence('USN')).toBe('USN');
    expect(inSentence('B.Tech memo')).toBe('B.Tech memo');
  });

  it('join a list the way a sentence does', () => {
    expect(joinList([])).toBe('');
    expect(joinList(['a'])).toBe('a');
    expect(joinList(['a', 'b'])).toBe('a and b');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b and c');
  });
});

describe('public events', () => {
  it('match online venues on whole words only', () => {
    expect(isOnlineVenue('Alumni Meet Hall')).toBe(false);
    expect(isOnlineVenue('Online — link sent on registration')).toBe(true);
    expect(isOnlineVenue(null)).toBe(false);
  });

  it('lead with the first college-wide, in-person event', () => {
    // The fixture's first upcoming event is an online panel; the reunion
    // after it is the one the landing page should put in front.
    const lead = pickLeadEvent(getPublicEvents('upcoming'));
    expect(lead?.event.title).toBe('Annual Alumni Meet 2026');
    expect(lead?.onCampus).toBe(true);
    expect(lead?.event.departmentCode).toBeNull();
    expect(isOnlineVenue(lead?.event.venue ?? null)).toBe(false);
  });
});

describe('chart tokens', () => {
  it.each(Object.keys(PACKS))('draw %s bars at 3:1 or better on a card, in both modes', (id) => {
    const t = buildTokens(PACKS[id]!);
    for (const mode of MODES) {
      const s = t[mode];
      const card = s['--surface-raised']!;
      expect(contrastRatio(s['--chart-bar']!, card), `${mode} bar`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(s['--chart-bar-highlight']!, card), `${mode} highlight`).toBeGreaterThanOrEqual(3);
      // A highlight the same colour as the bars highlights nothing.
      expect(s['--chart-bar-highlight']!.toLowerCase(), `${mode} highlight differs`).not.toBe(
        s['--chart-bar']!.toLowerCase(),
      );
      expect(s['--chart-track'], `${mode} track`).toBe(s['--border-strong']);
    }
  });

  it.each(SEEDS)('stay at 3:1 for $label', ({ primary, surface }) => {
    const t = buildTokens(pack({ primary, surface }));
    for (const mode of MODES) {
      const s = t[mode];
      expect(contrastRatio(s['--chart-bar']!, s['--surface-raised']!), mode).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('density and scoping', () => {
  it('emit the compact density for one element, from a width up', () => {
    const css = densityCss('compact', '.console-density', 1024);
    expect(css.startsWith('@media (min-width:1024px){.console-density{')).toBe(true);
    expect(css).toContain('--control-h:34px');
    expect(densityCss('comfortable', '.x')).toBe(
      '.x{--control-h-sm:32px;--control-h:40px;--control-h-lg:48px;--gutter:24px;--section-y:72px;--card-p:20px;--row-h:52px}',
    );
  });

  it('scope a college’s tokens to a wrapper, following the document or forced', () => {
    const t = buildTokens(PACKS.srivarsity!);
    const auto = scopedTokensCss(t, '.preview');
    expect(auto).not.toContain(':root{');
    expect(auto).toContain(`.preview{`);
    expect(auto).toContain(`:root:not([data-theme="light"]) .preview{`);
    expect(auto).toContain(`[data-theme="dark"] .preview{`);
    expect(auto).toContain(`--band:${t.light['--band']}`);

    const dark = scopedTokensCss(t, '.p', 'dark');
    expect(dark).not.toContain('@media');
    // Light first, then dark: the later declaration wins inside one block.
    expect(dark.lastIndexOf(`--surface:${t.dark['--surface']}`)).toBeGreaterThan(dark.indexOf(`--surface:${t.light['--surface']}`));
    expect(scopedTokensCss(t, '.p', 'light')).not.toContain(`--surface:${t.dark['--surface']}`);
  });
});

describe('signed-in pack fields', () => {
  const base = { portalName: 'Test Portal', institutionName: 'Test Institute', shortName: 'TIE' };

  it('default to no promise and plain words', () => {
    const copy = CopySpec.parse(base);
    expect(copy.greeting).toBe('Namaste');
    expect(copy.newsDesks).toEqual({});
    expect(copy.jobReviewTurnaround).toBeUndefined();
    expect(copy.donationReceiptNote).toBeUndefined();
    expect(copy.receiptLabel).toBeUndefined();

    expect(greetingFor(copy)).toBe('Namaste');
    expect(deskFor(copy, 'college_admin')).toBe('College administration');
    expect(deskFor(copy, 'alumni_cell_operator')).toBe('Alumni cell');
    expect(deskFor(copy, 'placement_officer')).toBe('Placement cell');
    expect(vendorLabel(copy)).toBe('the portal provider');
    expect(jobReviewLine(copy)).toBeNull();
    expect(receiptLabel(copy)).toBe('Receipt');
  });

  it('carry the college’s own words when it sets them', () => {
    const copy = CopySpec.parse({
      ...base,
      greeting: 'Vanakkam',
      newsDesks: { placement_officer: 'Training and Placement' },
      jobReviewTurnaround: 'two working days',
      receiptLabel: '80G receipt',
      poweredBy: 'Acme',
    });
    expect(greetingFor(copy)).toBe('Vanakkam');
    expect(deskFor(copy, 'placement_officer')).toBe('Training and Placement');
    expect(deskFor(copy, 'college_admin')).toBe('College administration');
    expect(jobReviewLine(copy)).toBe('usually within two working days');
    expect(receiptLabel(copy)).toBe('80G receipt');
    expect(vendorLabel(copy)).toBe('Acme');
    expect(CopySpec.safeParse({ ...base, greeting: 'x' }).success).toBe(false);
  });

  it('let a campus photo be tagged with where it may appear', () => {
    const photo = { src: '/brand/x/a.jpg', alt: 'The main block' };
    const tagged = CampusPhoto.parse({ ...photo, use: ['home', 'giving'], batchYear: 2015, departmentCode: 'CSE' });
    expect(tagged).toMatchObject({ use: ['home', 'giving'], batchYear: 2015, departmentCode: 'CSE' });

    const plain = CampusPhoto.parse(photo);
    expect(plain.use).toBeUndefined();
    expect(plain.batchYear).toBeUndefined();

    expect(CampusPhoto.safeParse({ ...photo, use: ['directory'] }).success).toBe(false);
    expect(CampusPhoto.safeParse({ ...photo, batchYear: 1900 }).success).toBe(false);
  });

  it('parse every shipped pack unchanged', () => {
    for (const p of Object.values(PACKS)) expect(p.copy.greeting).toBe('Namaste');
  });
});
