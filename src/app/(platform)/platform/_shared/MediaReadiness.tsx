import * as React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { CircleCheck, Circle, Image as ImageIcon, Images, LogIn, Share2, Shield, Type } from 'lucide-react';

import type { BrandPack } from '@/lib/branding/pack';
import type { TenantSummary } from '@/lib/data/types';
import { cn } from '@/lib/cn';
import { DEFAULT_PACK } from '@/lib/branding/pack';

import { brandVerdict } from './brand-check';

/**
 * What a college has sent, and what to ask it for.
 *
 * Presence is read from `pack.assets`, and a local path counts only when
 * its file is in /public: a pack that names a share card nobody uploaded
 * is still missing one. Thumbnails are drawn as background images, so a
 * file never shows a broken-image icon.
 *
 * The set-up checklist lives here too, because four of its five steps are
 * the same presence checks.
 */

/**
 * A pack path, or null when it names a file that is not there. Only paths
 * under /public are checked (a remote URL is taken as given); a slot whose
 * file is missing is something to ask for, not something to tick.
 */
function reachable(src: string | null | undefined): string | null {
  if (!src) return null;
  if (!src.startsWith('/')) return src;
  const publicDir = path.join(process.cwd(), 'public');
  const file = path.resolve(publicDir, (src.split('?')[0] ?? src).replace(/^\/+/, ''));
  if (!file.startsWith(publicDir + path.sep)) return null;
  return fs.existsSync(file) ? src : null;
}

// ---------------------------------------------------------------
// Asks — one line each, reused by the checklist and the set-up form
// ---------------------------------------------------------------

export const COLLEGE_ASKS = {
  adminEmail: {
    title: 'A college email for the first admin',
    ask: 'An address on the college’s own domain outlives the person who set the portal up.',
    when: 'Needed now',
  },
  register: {
    title: 'The degree register',
    ask: 'Roll number, name, branch and year of passing for every batch, from the examinations branch. It takes longest, and verification waits on it.',
    when: 'Ask first',
  },
  headcounts: {
    title: 'Headcounts by branch',
    ask: 'Sanctioned intake, current enrolment and staff count. They decide how much registration help the college will need.',
    when: 'Before the demo',
  },
  brand: {
    title: 'Crest and colours',
    ask: 'The crest in vector and the official colour values — ask the principal’s office.',
    when: 'Can follow',
  },
  photos: {
    title: 'Campus photos',
    ask: 'One landscape photo for the front page and three to five more the college owns, each with a line on what it shows.',
    when: 'Can follow',
  },
  adminAccepted: {
    title: 'First admin signed in',
    ask: 'The first admin accepts the invite and adds the rest of the staff themselves.',
    when: 'Not tracked yet',
  },
  previousExport: {
    title: 'Previous portal’s export',
    ask: 'If the college used another alumni portal, ask for its member export before that contract’s retention window closes.',
    when: 'Not tracked yet',
  },
} as const;

// ---------------------------------------------------------------
// Set-up steps
// ---------------------------------------------------------------

export type SetupKey = 'created' | 'pack' | 'check' | 'mark' | 'photos';

export interface SetupStep {
  key: SetupKey;
  label: string;
  done: boolean;
  /** What to ask the college for while the step is open. */
  ask: string;
}

export function hasMark(pack: BrandPack | null): boolean {
  const a = pack?.assets;
  return Boolean(
    a && (reachable(a.crest) || reachable(a.logoPrimary) || reachable(a.logoInverse) || reachable(a.logoMark)),
  );
}

export function hasPhotos(pack: BrandPack | null): boolean {
  const a = pack?.assets;
  return Boolean(
    a && (reachable(a.heroImage) || reachable(a.authImage) || a.campusPhotos.some((p) => reachable(p.src))),
  );
}

/**
 * The five derived steps, in the order they get done. Every one is read
 * from the pack file. "First members" is not among them: whether anyone
 * has joined is a fact about the college's members, and the vendor holds
 * no capability that would say. FCRA is not one either: it is the trust's
 * legal status, not something set-up finishes.
 */
export function setupSteps(_tenant: TenantSummary, pack: BrandPack | null): SetupStep[] {
  return [
    { key: 'created', label: 'College created', done: true, ask: '' },
    {
      key: 'pack',
      label: 'Brand pack assigned',
      done: pack !== null,
      ask: 'Pick a starting pack from Brand packs until the college’s own is written.',
    },
    {
      key: 'check',
      label: 'Brand check passed',
      done: pack !== null && !brandVerdict(pack).blocked,
      ask: pack
        ? 'Some colour pairings in the pack fail contrast. Run npm run brand:check; it names each one.'
        : 'Assign a pack first; the check runs on its colours.',
    },
    { key: 'mark', label: 'Crest or logo', done: hasMark(pack), ask: COLLEGE_ASKS.brand.ask },
    { key: 'photos', label: 'Campus photos', done: hasPhotos(pack), ask: COLLEGE_ASKS.photos.ask },
  ];
}

// ---------------------------------------------------------------
// Media slots
// ---------------------------------------------------------------

type Ground = 'page' | 'band' | 'photo';

interface Slot {
  key: string;
  label: string;
  src: string | null;
  ground: Ground;
  /** Shown under a present slot. */
  detail?: string;
  ask: string;
  icon: React.ReactNode;
}

function slots(pack: BrandPack): Slot[] {
  const a = pack.assets;
  const tags = [
    ...new Set(
      a.campusPhotos.flatMap((p) => [
        ...(p.use ?? []),
        ...(p.batchYear ? [`batch ${p.batchYear}`] : []),
        ...(p.departmentCode ? [p.departmentCode] : []),
      ]),
    ),
  ];
  const count = a.campusPhotos.length;

  return [
    { key: 'crest', label: 'Crest', src: reachable(a.crest), ground: 'page', ask: 'The crest in vector — ask the principal’s office.', icon: <Shield /> },
    { key: 'logo', label: 'Logo', src: reachable(a.logoPrimary), ground: 'page', ask: 'A logo for light pages, in vector.', icon: <Type /> },
    {
      key: 'logoInverse',
      label: 'Logo on the band',
      src: reachable(a.logoInverse),
      ground: 'band',
      ask: 'A white or reversed logo for the college colour. Until then the name is set in type.',
      icon: <Type />,
    },
    {
      key: 'hero',
      label: 'Front-page photo',
      src: reachable(a.heroImage),
      ground: 'photo',
      detail: a.heroImageAlt,
      ask: 'One landscape campus photo the college owns.',
      icon: <ImageIcon />,
    },
    {
      key: 'signIn',
      label: 'Sign-in photo',
      src: reachable(a.authImage),
      ground: 'photo',
      ask: a.heroImage
        ? 'An upright campus photo. The front-page photo stands in until then.'
        : 'An upright campus photo for the sign-in panel.',
      icon: <LogIn />,
    },
    {
      key: 'campus',
      label: 'Campus photos',
      src: reachable(a.campusPhotos.find((p) => reachable(p.src))?.src),
      ground: 'photo',
      detail: `${count} ${count === 1 ? 'photo' : 'photos'} · ${tags.length ? `tagged ${tags.join(', ')}` : 'none tagged'}`,
      ask: 'Three to five photos, each with a line on what it shows.',
      icon: <Images />,
    },
    {
      key: 'share',
      label: 'Share card',
      src: reachable(a.ogImage),
      ground: 'photo',
      ask: 'The picture a link shows when it is shared on WhatsApp.',
      icon: <Share2 />,
    },
  ];
}

/** A `url()` for a pack path, with the one character that could end it escaped. */
function cssUrl(src: string): string {
  return `url("${src.replace(/"/g, '%22')}")`;
}

/** How many media slots a pack has filled, for a meter. No pack: none of them. */
export function mediaSummary(pack: BrandPack | null): { present: number; total: number } {
  const all = slots(pack ?? DEFAULT_PACK);
  return { present: pack ? all.filter((s) => s.src).length : 0, total: all.length };
}

export function MediaReadiness({
  pack,
  name,
  variant = 'grid',
  className,
}: {
  pack: BrandPack;
  /** The college's short name, for "To ask DIET for". */
  name?: string;
  /** `grid`: thumbnails of what is in, a list of what to ask for. `row`: one line of chips, for a card. */
  variant?: 'grid' | 'row';
  className?: string;
}) {
  const all = slots(pack);

  if (variant === 'row') {
    return (
      <ul className={cn('flex flex-wrap gap-1.5', className)} aria-label="Media in the pack">
        {all.map((s) => (
          <li
            key={s.key}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs',
              s.src ? 'bg-success-soft text-success-fg' : 'text-secondary',
            )}
          >
            {s.src ? (
              <CircleCheck className="size-3 shrink-0" aria-hidden="true" />
            ) : (
              <Circle className="size-3 shrink-0 text-muted" aria-hidden="true" />
            )}
            {s.label}
            <span className="sr-only">{s.src ? ', in the pack' : ', still to ask for'}</span>
          </li>
        ))}
      </ul>
    );
  }

  const present = all.filter((s) => s.src);
  const missing = all.filter((s) => !s.src);

  return (
    <div className={cn('space-y-4', className)}>
      <p className="text-sm text-secondary">
        {present.length ? (
          <>
            <span className="font-semibold tabular text-primary">
              {present.length} of {all.length}
            </span>{' '}
            media slots filled
          </>
        ) : (
          'No media in the pack yet.'
        )}
      </p>

      {present.length ? (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4" aria-label="In the pack">
          {present.map((s) => (
            <li key={s.key} className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface-raised">
              <div
                role="img"
                aria-label={`${s.label}, from the pack`}
                className="aspect-[16/9] border-b border-line bg-surface-sunken bg-center bg-no-repeat"
                style={{
                  backgroundImage: cssUrl(s.src!),
                  backgroundSize: s.ground === 'photo' ? 'cover' : 'contain',
                  backgroundOrigin: 'content-box',
                  padding: s.ground === 'photo' ? 0 : '12%',
                  // A logo sits on the ground it was drawn for; a photo fills its frame.
                  backgroundColor:
                    s.ground === 'band' ? pack.color.primary : s.ground === 'page' ? pack.color.surface : undefined,
                }}
              />
              <div className="flex items-start gap-1.5 p-3">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-success-fg" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary">{s.label}</p>
                  <p className="line-clamp-2 text-xs text-secondary">{s.detail ?? 'In the pack'}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {missing.length ? (
        <div className="rounded-lg border border-line bg-surface-raised p-4">
          <p className="text-sm font-semibold text-primary">{name ? `To ask ${name} for` : 'To ask for'}</p>
          <ul className="mt-3 grid gap-x-8 gap-y-3 md:grid-cols-2">
            {missing.map((s) => (
              <li key={s.key} className="flex min-w-0 gap-3">
                {/* Bare, per the house rule: no tile behind an icon. */}
                <span className="mt-0.5 shrink-0 text-secondary [&>svg]:size-4" aria-hidden="true">
                  {s.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary">{s.label}</p>
                  <p className="text-xs text-secondary">{s.ask}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
