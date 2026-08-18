import type { Role } from '../auth/permissions';
import type { MemberStatus } from '../auth/guard';

/**
 * The shapes the UI consumes.
 *
 * Deliberately *not* the Prisma row types. A page that renders a Prisma
 * model is a page that leaks whatever column someone adds next — the
 * `members` table carries CGPA and placement status, and neither has any
 * business reaching a component that renders an alumni card.
 *
 * Contact details are their own type and are only ever present when
 * `releaseContact()` has said so. If a `MemberSummary` could carry an
 * email, every list view would be one careless spread away from a leak.
 */

export type { Role, MemberStatus };

export interface Department {
  id: string;
  code: string;
  name: string;
  established?: number;
  intake?: number;
}

export interface MemberSummary {
  id: string;
  slug: string;
  fullName: string;
  photoUrl: string | null;
  batchYear: number | null;
  departmentCode: string | null;
  departmentName: string | null;
  currentCompany: string | null;
  designation: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  skills: string[];
  openToMentoring: boolean;
  openToReferrals: boolean;
  openToSpeaking: boolean;
  status: MemberStatus;
  isStudent: boolean;
}

export interface EmploymentEntry {
  id: string;
  company: string;
  designation: string | null;
  location: string | null;
  startedOn: string | null;
  endedOn: string | null;
  isCurrent: boolean;
}

export interface EducationEntry {
  id: string;
  institution: string;
  qualification: string | null;
  field: string | null;
  startedOn: string | null;
  endedOn: string | null;
}

export interface ContactDetails {
  email: string | null;
  mobile: string | null;
  linkedin: string | null;
  github: string | null;
  portfolio: string | null;
  visibility: ContactVisibility;
}

export type ContactVisibility = 'private' | 'on_accept' | 'alumni_only' | 'all_members';

export interface MemberDetail extends MemberSummary {
  bio: string | null;
  preferredName: string | null;
  admissionYear: number | null;
  programme: string | null;
  employment: EmploymentEntry[];
  education: EducationEntry[];
  verifiedAt: string | null;
  verificationMethod: string | null;
  roles: Array<{ role: Role; departmentCode: string | null }>;
  /** Present only when both release gates pass. Never populate speculatively. */
  contact: Partial<ContactDetails> | null;
  /**
   * The owner's visibility choice, carried even when `contact` is null.
   *
   * It is not contact data — it is the *reason* the contact was withheld,
   * and without it the UI can only say "you cannot see this" instead of
   * "released once they accept your request". That difference is what
   * turns a dead end into the next step, so the setting travels with the
   * refusal rather than being lost alongside it.
   */
  contactVisibility: ContactVisibility | null;
  /** Whether an accepted connection exists between viewer and owner. */
  hasAcceptedConnection: boolean;
  /** Placement-side only. Never populated below the `privileged` tier. */
  rollNumber?: string | null;
  cgpa?: number | null;
  placementStatus?: string | null;
}

export interface DirectoryQuery {
  q?: string;
  department?: string;
  batchFrom?: number;
  batchTo?: number;
  company?: string;
  city?: string;
  country?: string;
  industry?: string;
  skill?: string;
  /** Availability filters — the reason a student is searching at all. */
  mentoring?: boolean;
  referrals?: boolean;
  speaking?: boolean;
  cohort?: 'alumni' | 'students' | 'all';
  sort?: 'relevance' | 'recent' | 'batch' | 'name';
  page?: number;
  perPage?: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
}

export interface FacetCount {
  value: string;
  label: string;
  count: number;
}

export interface DirectoryFacets {
  departments: FacetCount[];
  batches: FacetCount[];
  companies: FacetCount[];
  cities: FacetCount[];
  industries: FacetCount[];
  skills: FacetCount[];
}

// ---------------------------------------------------------------
// Connections
// ---------------------------------------------------------------

export type ConnectionKind = 'mentorship' | 'referral' | 'introduction' | 'speaking';
export type ConnectionState = 'pending' | 'accepted' | 'declined' | 'expired' | 'withdrawn' | 'blocked';

export interface ConnectionRequest {
  id: string;
  kind: ConnectionKind;
  state: ConnectionState;
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
  expiresAt: string | null;
  from: MemberSummary;
  to: MemberSummary;
}

export interface ConnectionQuota {
  openRequests: number;
  openLimit: number;
  usedThisMonth: number;
  monthlyLimit: number;
  /** False when either limit is reached; the UI must say which. */
  canSend: boolean;
  reason: string | null;
}

// ---------------------------------------------------------------
// Events
// ---------------------------------------------------------------

export interface EventItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  venue: string | null;
  startsAt: string;
  endsAt: string | null;
  departmentCode: string | null;
  studentEligible: boolean;
  alumniOnly: boolean;
  capacity: number | null;
  registeredCount: number;
  ticketPrice: number;
  published: boolean;
  coverImage: string | null;
  /** Set when the viewer has a registration. */
  viewerRegistration: { id: string; guests: number; checkedIn: boolean } | null;
}

export interface EventRegistration {
  id: string;
  eventId: string;
  eventTitle: string;
  memberId: string;
  memberName: string;
  batchYear: number | null;
  guests: number;
  amountPaid: number;
  checkedInAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------

export type JobState = 'draft' | 'pending_moderation' | 'live' | 'rejected' | 'closed';

export interface JobPosting {
  id: string;
  title: string;
  company: string;
  location: string | null;
  isInternship: boolean;
  description: string | null;
  applyUrl: string | null;
  state: JobState;
  closesOn: string | null;
  createdAt: string;
  experienceYears: string | null;
  salaryRange: string | null;
  skills: string[];
  postedBy: MemberSummary;
  applicationCount: number;
  viewerHasApplied: boolean;
  moderationNote: string | null;
}

export interface JobApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  note: string | null;
  createdAt: string;
  applicant: MemberSummary;
}

// ---------------------------------------------------------------
// Verification
// ---------------------------------------------------------------

export interface DegreeRecord {
  id: string;
  rollNumber: string;
  name: string;
  departmentCode: string | null;
  programme: string | null;
  admissionYear: number | null;
  yearOfPassing: number | null;
  sourceFile: string | null;
}

export interface VerificationClaim {
  id: string;
  submittedAt: string;
  claimedName: string;
  claimedRoll: string;
  claimedDepartmentCode: string | null;
  claimedBatchYear: number | null;
  email: string;
  mobile: string | null;
  status: 'queued' | 'approved' | 'rejected';
  /**
   * The candidate register rows the matcher surfaced, with confidence and
   * reasons. An approver must never be asked to decide against no
   * evidence — the queue shows the claim and the candidates side by side.
   */
  candidates: Array<{ record: DegreeRecord; confidence: number; reasons: string[] }>;
  decision: 'auto_approve' | 'review' | 'reject';
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

// ---------------------------------------------------------------
// Donations
// ---------------------------------------------------------------

export interface DonationCampaign {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  target: number | null;
  raised: number;
  donorCount: number;
  startsOn: string | null;
  endsOn: string | null;
  active: boolean;
  coverImage: string | null;
}

export interface Donation {
  id: string;
  campaignTitle: string | null;
  donorName: string;
  amount: number;
  currency: string;
  sourceCountry: string | null;
  isForeignContribution: boolean;
  state: 'initiated' | 'succeeded' | 'failed' | 'refunded';
  gatewayRef: string | null;
  receipt80gNo: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------
// Admin
// ---------------------------------------------------------------

export interface AuditEntry {
  id: string;
  actorName: string | null;
  actorRole: Role | null;
  action: string;
  resource: string;
  resourceId: string | null;
  reason: string | null;
  ip: string | null;
  createdAt: string;
  before: unknown;
  after: unknown;
}

export interface DataRequest {
  id: string;
  memberId: string;
  memberName: string;
  kind: 'export' | 'deletion' | 'correction';
  state: 'received' | 'in_progress' | 'fulfilled' | 'refused';
  createdAt: string;
  fulfilledAt: string | null;
  /** Statutory clock. DPDP responses are not open-ended. */
  dueAt: string;
}

export interface NotificationItem {
  id: string;
  /**
   * Whose notification this is. Required, and the reason it is required:
   * without it the list was global, so a named student's mentorship
   * request appeared in the vendor's console — "Harika Nallamothu wants
   * to connect" rendered on every page `platform_admin` opened. A
   * notification is a message about one person's business and carries an
   * owner or it is not a notification.
   */
  memberId: string;
  kind: 'connection' | 'event' | 'job' | 'verification' | 'system';
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface TenantSummary {
  id: string;
  name: string;
  shortName: string;
  subdomain: string;
  packId: string | null;
  established: number | null;
  memberCount: number;
  alumniCount: number;
  studentCount: number;
  verifiedCount: number;
  fcraRegistered: boolean;
  createdAt: string;
  plan: 'trial' | 'standard' | 'institution';
  status: 'active' | 'provisioning' | 'suspended';
}

// ---------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------

export interface EngagementStats {
  totalMembers: number;
  alumni: number;
  students: number;
  verified: number;
  unclaimed: number;
  pendingVerification: number;
  connectionsThisMonth: number;
  acceptRate: number;
  eventsUpcoming: number;
  jobsLive: number;
  openToMentoring: number;
  /** Registrations per month, oldest first. Drives the sparkline. */
  signupTrend: Array<{ label: string; value: number }>;
  batchDistribution: Array<{ label: string; value: number }>;
  departmentDistribution: Array<{ label: string; value: number }>;
  topCompanies: Array<{ label: string; value: number }>;
  topCities: Array<{ label: string; value: number }>;
}
