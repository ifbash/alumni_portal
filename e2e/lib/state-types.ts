/**
 * The shape of `e2e/.state/fixtures.json`.
 *
 * Kept in its own module because two processes share it: `fixtures/collect.ts`
 * runs under `tsx` and writes the file; everything else runs under Playwright
 * and reads it. Neither imports the other's world.
 */

export interface RoleSession {
  cookie: string;
  memberId: string;
  email: string;
  label: string;
}

export interface VisibilityTarget {
  slug: string;
  id: string;
  fullName: string;
  /** The exact contact strings that must not appear in a refused response. */
  email: string | null;
  mobile: string | null;
  rollNumber: string | null;
}

export interface StateFile {
  generatedAt: string;
  tenant: { id: string; subdomain: string };
  cookieName: string;
  sessions: Record<string, RoleSession>;
  foreignPoster: { cookie: string; memberId: string; fullName: string };
  ids: {
    memberSlug: string;
    memberId: string;
    studentSlug: string;
    studentId: string;
    studentRollNumber: string;
    ownSlug: string;

    visibilityPrivate: VisibilityTarget;
    visibilityAlumniOnly: VisibilityTarget;
    visibilityAllMembers: VisibilityTarget;
    visibilityOnAccept: VisibilityTarget;

    jobId: string;
    jobPostedByOther: string;
    jobPostedByDemoAlumnus: string | null;

    eventSlug: string;
    eventPastSlug: string;
    eventTicketSlug: string;
    hasAlumnusTicket: boolean;
    connectionId: string;
    campaignSlug: string;
    auditId: string;
    dataRequestId: string;
    verificationId: string;
    degreeRecordId: string;
    albumSlug: string;
    newsSlug: string;
    mentorTopic: string;
    departmentCode: string;
    batchYear: number;
    reportFramework: string;
    tenantId: string;
    otherTenantId: string;
  };
  secrets: {
    emails: string[];
    mobiles: string[];
    rollNumbers: string[];
  };
  counts: {
    members: number;
    alumni: number;
    students: number;
    jobs: number;
  };
}
