import type { Session } from '@/lib/auth/guard';
import type { MemberSummary } from '@/lib/data/types';
import { project, tierFor } from '@/lib/members/projection';

/**
 * Narrow a member summary to the viewer's tier.
 *
 * The fixture connections and job postings carry whole summaries, built
 * once when the dataset was assembled and therefore built for nobody in
 * particular. Handing one of those straight back would quietly widen a
 * student's view — city, state and industry are `member` tier, not
 * `student` tier — so every summary that leaves a route handler goes
 * through the same `project()` the directory uses.
 *
 * Selecting *into* the tier's field list, never deleting keys from a full
 * record: adding a column upstream can then never widen a response here.
 */
export function narrowSummary(session: Session, summary: MemberSummary): Partial<MemberSummary> {
  const projected = project(
    {
      id: summary.id,
      slug: summary.slug,
      fullName: summary.fullName,
      photoUrl: summary.photoUrl,
      // Summaries never carry these three; the projection needs the shape.
      bio: null,
      cgpa: null,
      placementStatus: null,
      rollNumber: null,
      batchYear: summary.batchYear,
      departmentCode: summary.departmentCode,
      currentCompany: summary.currentCompany,
      designation: summary.designation,
      industry: summary.industry,
      city: summary.city,
      state: summary.state,
      country: summary.country,
      skills: summary.skills,
      openToMentoring: summary.openToMentoring,
      openToReferrals: summary.openToReferrals,
      openToSpeaking: summary.openToSpeaking,
      status: summary.status,
    },
    tierFor(session),
  );

  return {
    ...(projected as Partial<MemberSummary>),
    // Derived from fields the tier already permits, so they widen nothing.
    id: summary.id,
    slug: summary.slug,
    fullName: summary.fullName,
    departmentName: summary.departmentName,
    isStudent: summary.isStudent,
    skills: projected.skills ?? [],
  };
}
