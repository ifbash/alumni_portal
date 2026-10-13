import { describe, expect, it } from 'vitest';
import { authPhoto, photoForBatch, photoForBranch, pickBandPhoto } from '@/lib/branding/media';
import { mergePack } from '@/lib/branding/pack';
import { PACKS } from '@/lib/branding/registry';

/**
 * Which college photo a signed-in band shows.
 *
 * A photo must never read as a claim about what it shows, so batch and
 * branch pages only ever show a photo the college tagged for them, and
 * the college-level bands share the rest without repeating one another.
 */

const diet = PACKS.diet!;
const sri = PACKS.srivarsity!;

describe('college-level bands', () => {
  it('deal srivarsity a different photo to home, giving and profile', () => {
    expect(sri.assets.heroImage).toBeTruthy();
    expect(sri.assets.campusPhotos).toHaveLength(4);

    const home = pickBandPhoto(sri, 'home');
    const giving = pickBandPhoto(sri, 'giving');
    const profile = pickBandPhoto(sri, 'profile');

    expect(home?.src).toBe(sri.assets.heroImage);
    expect(home?.alt).toBe(sri.assets.heroImageAlt);
    expect(home?.focus).toBe(sri.assets.heroFocus);

    const srcs = [home, giving, profile].map((p) => p?.src);
    expect(srcs.every(Boolean)).toBe(true);
    expect(new Set(srcs).size).toBe(3);
    expect(giving?.focus).toBe('50% 50%');
  });

  it('let a photo tagged for a surface win over the hero and the pool', () => {
    const tagged = mergePack(sri, {
      assets: {
        campusPhotos: [
          ...sri.assets.campusPhotos,
          { src: '/brand/x/giving.jpg', alt: 'The library reading room', use: ['giving'], focus: '40% 60%' },
        ],
      },
    });
    expect(pickBandPhoto(tagged, 'giving')).toEqual({
      src: '/brand/x/giving.jpg',
      alt: 'The library reading room',
      focus: '40% 60%',
    });
    // A tagged photo leaves the untagged pool: the other bands are unchanged.
    expect(pickBandPhoto(tagged, 'profile')).toEqual(pickBandPhoto(sri, 'profile'));
    expect(pickBandPhoto(tagged, 'home')?.src).toBe(sri.assets.heroImage);
  });

  it('give the sign-in panel its own photo, else the hero', () => {
    expect(authPhoto(sri)?.src).toBe(sri.assets.authImage);
    expect(authPhoto({ assets: { ...sri.assets, authImage: undefined } })?.src).toBe(sri.assets.heroImage);
  });
});

describe('batch and branch bands', () => {
  it('show nothing when no photo is tagged for them', () => {
    expect(photoForBatch(sri, 2015)).toBeNull();
    expect(photoForBranch(sri, 'CSE')).toBeNull();
  });

  it('show only the photo tagged with that batch or branch', () => {
    const tagged = mergePack(sri, {
      assets: {
        campusPhotos: [
          ...sri.assets.campusPhotos,
          { src: '/brand/x/2015.jpg', alt: 'The 2015 batch at their farewell', batchYear: 2015 },
          { src: '/brand/x/cse.jpg', alt: 'The CSE block', departmentCode: 'CSE' },
        ],
      },
    });
    expect(photoForBatch(tagged, 2015)?.src).toBe('/brand/x/2015.jpg');
    expect(photoForBatch(tagged, 2016)).toBeNull();
    expect(photoForBranch(tagged, 'cse')?.src).toBe('/brand/x/cse.jpg');
    expect(photoForBranch(tagged, 'ECE')).toBeNull();
    // Tagged photos never reach the college-level bands.
    for (const surface of ['home', 'giving', 'profile'] as const) {
      expect(['/brand/x/2015.jpg', '/brand/x/cse.jpg']).not.toContain(pickBandPhoto(tagged, surface)?.src);
    }
  });
});

describe('a college with no photographs', () => {
  it('gets the solid band everywhere', () => {
    for (const surface of ['home', 'giving', 'profile'] as const) expect(pickBandPhoto(diet, surface)).toBeNull();
    expect(authPhoto(diet)).toBeNull();
    expect(photoForBatch(diet, 2017)).toBeNull();
    expect(photoForBranch(diet, 'CSE')).toBeNull();
  });
});
