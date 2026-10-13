/**
 * The fixture clock.
 *
 * Every relative date in fixture mode ("in 11 days", "oldest 3 weeks") is
 * measured from this instant rather than from the wall clock, so a seeded
 * demo says the same thing every time it is opened instead of drifting
 * into "3 weeks ago" a month later.
 *
 * It lives here, not in the seed, so that client components which format
 * a date (and therefore import `format.ts`) do not bundle the whole
 * fixture dataset to learn one timestamp. `seed.ts` re-exports it for the
 * callers that already import it from there.
 *
 * Read it through `displayNow()` in `format.ts`: that is the one place to
 * change when the portal starts reading the real clock.
 */
export const SEED_NOW = new Date('2026-08-17T09:30:00+05:30');
