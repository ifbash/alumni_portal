import { buildTokens, contrastReport } from '../src/lib/branding/tokens';
import { BrandPack } from '../src/lib/branding/pack';
import { PACKS } from '../src/lib/branding/registry';
import { contrastRatio } from '../src/lib/branding/color';

/**
 * Branding harness.
 *
 * Run with `npm run brand:check`. Feeds a set of deliberately awkward
 * seed colours through the token engine and prints what a customer would
 * be told at save time.
 *
 * The cases that matter are the bad ones: a pale gold, a neon lime, a
 * near-black. Any colour engine looks fine on navy. What decides whether
 * this ships to fifty colleges unattended is whether it *refuses*
 * correctly when a registrar pastes their letterhead yellow.
 */

const CASES: Array<{ label: string; primary: string; surface?: string }> = [
  { label: 'Institutional navy', primary: '#1F3864' },
  { label: 'ifBash brick', primary: '#B23A2B', surface: '#F8F5F1' },
  { label: 'Deep maroon', primary: '#7B1E23' },
  { label: 'Forest green', primary: '#14584C' },
  { label: 'Pale gold (expect failures)', primary: '#E3C567' },
  { label: 'Neon lime (expect failures)', primary: '#B6FF3C' },
  { label: 'Near black', primary: '#111111' },
  { label: 'Saffron', primary: '#E07A2F' },
  { label: 'Royal purple', primary: '#4B2E83' },
  { label: 'Cyan', primary: '#00A8B5' },
  { label: 'Hot pink on dark surface', primary: '#E5399A', surface: '#12121A' },
];

let failures = 0;

for (const c of CASES) {
  const pack = BrandPack.parse({
    id: 'harness',
    color: { primary: c.primary, surface: c.surface ?? '#ffffff' },
    copy: { portalName: 'Harness', institutionName: 'Harness College', shortName: 'HC' },
  });

  const tokens = buildTokens(pack);
  const report = contrastReport(pack);

  const btnRatio = contrastRatio(tokens.light['--button-primary-fg']!, tokens.light['--button-primary-bg']!);
  const bodyRatio = contrastRatio(tokens.light['--text-primary']!, tokens.light['--surface']!);
  const brandFgRatio = contrastRatio(tokens.light['--brand-fg']!, tokens.light['--surface']!);

  console.log(`\n${c.label}  ${c.primary}`);
  console.log(`  publishable      ${report.passes ? 'yes' : 'NO'}`);
  console.log(`  button label     ${btnRatio.toFixed(2)}:1  (fg ${tokens.light['--button-primary-fg']} on ${tokens.light['--button-primary-bg']})`);
  console.log(`  body text        ${bodyRatio.toFixed(2)}:1`);
  console.log(`  brand text       ${brandFgRatio.toFixed(2)}:1  (${tokens.light['--brand-fg']})`);
  console.log(`  ${report.summary}`);

  for (const issue of report.errors) {
    console.log(`    ERROR   ${issue.token}  ${issue.ratio}:1 (needs ${issue.required})`);
  }
  for (const issue of report.warnings) {
    console.log(`    warning ${issue.token}  ${issue.ratio}:1 (needs ${issue.required})`);
  }

  // The derivation exists to make *any* seed safe. A button label that
  // fails against its own fill means the engine picked the wrong
  // foreground, which is a bug here, not a bad colour choice by a
  // customer.
  if (btnRatio < 4.5) {
    console.log('    ✗ FAIL — derived button label is not legible on its own fill');
    failures++;
  }
  if (bodyRatio < 7) {
    console.log('    ✗ FAIL — derived body text is below 7:1 on the page surface');
    failures++;
  }
}

console.log('\n--- shipped packs ---');
for (const pack of Object.values(PACKS)) {
  const report = contrastReport(pack);
  console.log(`${pack.id.padEnd(10)} ${report.passes ? 'passes' : 'FAILS'}  ${report.summary}`);
  for (const issue of report.errors) {
    console.log(`    ERROR   ${issue.token}  ${issue.ratio}:1 (needs ${issue.required})`);
    failures++;
  }
  for (const issue of report.warnings) {
    console.log(`    warning ${issue.token}  ${issue.ratio}:1 (needs ${issue.required})`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} derivation failure(s).`);
  process.exit(1);
}
console.log('\nAll derivations produce legible tokens.');
