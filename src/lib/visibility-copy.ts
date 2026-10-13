import type { ContactVisibility } from './data/types';

/**
 * The four contact-visibility settings, as the owner chooses between them.
 *
 * Each line must describe what `releaseContact()` in
 * `src/lib/members/projection.ts` actually does, including what a
 * final-year student gets. A privacy setting whose description is kinder
 * than its behaviour is the worst kind of bug: nobody files it. If the
 * projection changes, these lines change in the same commit.
 *
 *  - private: nobody but the owner and an admin holding
 *    `directory.view.contact`.
 *  - on_accept: anyone whose request the owner accepted — a student
 *    included.
 *  - alumni_only: every alumnus and faculty member; never a student, with
 *    or without an accepted request.
 *  - all_members: alumni and faculty get email and profile links, never
 *    the mobile; never a student.
 */

export interface VisibilityOption {
  value: ContactVisibility;
  label: string;
  line: string;
  recommended?: boolean;
}

export const VISIBILITY_OPTIONS: readonly VisibilityOption[] = [
  {
    value: 'private',
    label: 'Nobody',
    line: 'Nobody sees your email or mobile. People can still send you a request.',
  },
  {
    value: 'on_accept',
    label: 'Only people whose request I accept',
    line: 'Your email and mobile are shown only to people whose request you accept, final-year students included.',
    recommended: true,
  },
  {
    value: 'alumni_only',
    label: 'Alumni and faculty',
    line: 'Alumni and faculty can see your email and mobile. Students never see them, even if you accept their request.',
  },
  {
    value: 'all_members',
    label: 'Alumni and faculty, email only',
    line: 'Alumni and faculty can see your email and profile links. Your mobile stays private. Students never see them.',
  },
];

/** Said once, under the options: the one role that sees everything, and why. */
export const VISIBILITY_FOOTNOTE = 'The college admin can see your contact details to run the portal.';

export function visibilityOption(value: ContactVisibility | null | undefined): VisibilityOption | null {
  return VISIBILITY_OPTIONS.find((o) => o.value === value) ?? null;
}
