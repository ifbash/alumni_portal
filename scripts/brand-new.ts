#!/usr/bin/env tsx
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BrandPack } from '../src/lib/branding/pack';
import { buildTokens, contrastReport } from '../src/lib/branding/tokens';

/**
 * Scaffold a new customer's brand pack.
 *
 *   npm run brand:new -- --id stmarys \
 *     --name "St Mary's Institute of Technology" \
 *     --short "SMIT" \
 *     --portal "SMIT Alumni" \
 *     --primary "#7B1E23" \
 *     --accent "#B98A2E"
 *
 * Writes `brands/<id>.json`, validates it, runs the contrast audit, and
 * prints the one line to add to the registry.
 *
 * This script is the answer to "how long does it take to onboard the next
 * college". It should stay short enough that the answer is honest.
 */

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (v === undefined || v.startsWith('--')) {
    if (fallback !== undefined) return fallback;
    console.error(`Missing required argument --${name}`);
    process.exit(1);
  }
  return v;
}

const id = arg('id');
if (!/^[a-z0-9-]{2,32}$/.test(id)) {
  console.error('--id must be a lowercase slug, 2-32 characters. It becomes the subdomain.');
  process.exit(1);
}

const institutionName = arg('name');
const shortName = arg('short', institutionName.split(/\s+/)[0]!);
const portalName = arg('portal', `${shortName} Alumni`);
const primary = arg('primary');
const accent = arg('accent', primary);
const surface = arg('surface', '#FBFAF8');

const pack = {
  $comment: [
    `${institutionName} — brand pack.`,
    '',
    'Edit this file and nothing else. The 10-stop ramps, hover states, tinted',
    'fills, dark mode and text pairings are all derived from the seeds below;',
    'see src/lib/branding/tokens.ts. Run `npm run brand:check` after changing a',
    'colour — errors block publication, warnings do not.',
  ],
  id,
  version: 1,
  color: {
    primary,
    accent,
    surface,
    surfaceDark: '#101317',
    neutralChroma: 0.01,
    overrides: {},
    darkOverrides: {},
  },
  type: {
    display: 'Fraunces',
    body: 'Inter',
    mono: 'IBM Plex Mono',
    source: 'google',
    displayTracking: '-0.015em',
    scale: 1,
  },
  shape: { radius: 'subtle', density: 'comfortable', borderWidth: 'hairline', elevation: 'soft' },
  assets: {
    $comment: 'Drop logo files in public/brand/' + id + '/ and reference them here.',
  },
  copy: {
    portalName,
    institutionName,
    shortName,
    tagline: '',
    heroHeadline: `Every ${shortName} graduate, still reachable.`,
    heroEmphasis: 'still reachable',
    heroSubhead:
      'Find the batch you graduated with, mentor the students coming up behind you, and hear about campus events before they happen.',
    addressLines: [],
    poweredBy: 'ifBash',
    poweredByUrl: 'https://ifbash.com',
  },
  features: {
    directory: true,
    connections: true,
    events: true,
    jobs: true,
    mentorship: true,
    // Off until the college confirms FCRA registration. Foreign
    // contributions must be segregated at the point of collection.
    donations: false,
    gallery: true,
    news: true,
    whatsapp: false,
    publicLanding: true,
  },
  locale: { locale: 'en-IN', currency: 'INR', timeZone: 'Asia/Kolkata', dateFormat: 'dd-MM-yyyy' },
};

// Validate through the same schema the app loads with, minus the notes.
const stripped = JSON.parse(JSON.stringify(pack, (k, v) => (k.startsWith('$') ? undefined : v)));
const parsed = BrandPack.safeParse(stripped);

if (!parsed.success) {
  console.error('Generated pack is invalid:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const path = join(process.cwd(), 'brands', `${id}.json`);
if (existsSync(path)) {
  console.error(`brands/${id}.json already exists. Refusing to overwrite.`);
  process.exit(1);
}

writeFileSync(path, `${JSON.stringify(pack, null, 2)}\n`, 'utf8');

const tokens = buildTokens(parsed.data);
const report = contrastReport(parsed.data);

console.log(`\nWrote brands/${id}.json`);
console.log(`\nDerived from ${primary}:`);
console.log(`  page text     ${tokens.light['--text-primary']} on ${tokens.light['--surface']}`);
console.log(`  brand text    ${tokens.light['--brand-fg']}`);
console.log(`  button        ${tokens.light['--button-primary-fg']} on ${tokens.light['--button-primary-bg']}`);
console.log(`  dark button   ${tokens.dark['--button-primary-fg']} on ${tokens.dark['--button-primary-bg']}`);
console.log(`\n${report.summary}`);

for (const issue of report.errors) {
  console.log(`  ERROR   ${issue.token} ${issue.ratio}:1 (needs ${issue.required})`);
}
for (const issue of report.warnings) {
  console.log(`  warning ${issue.token} ${issue.ratio}:1 (needs ${issue.required})`);
}

const registry = join(process.cwd(), 'src', 'lib', 'branding', 'registry.ts');
const alreadyWired = existsSync(registry) && readFileSync(registry, 'utf8').includes(`brands/${id}.json`);

if (!alreadyWired) {
  console.log('\nTwo lines left, in src/lib/branding/registry.ts:');
  console.log(`\n  import ${id.replace(/-/g, '')}Json from '../../../brands/${id}.json';`);
  console.log(`\n  ${id}: load(${id.replace(/-/g, '')}Json, '${id}'),`);
}

console.log(`\nThen: point ${id}.<your-domain> at the deployment, or run locally at http://${id}.localhost:3000\n`);

if (!report.passes) {
  console.error('The pack was written, but it cannot be published until the errors above are fixed.');
  process.exit(1);
}
