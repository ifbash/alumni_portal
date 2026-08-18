import { SEED, DEPARTMENTS, DEGREE_REGISTER, CAMPAIGNS, DONATIONS, EVENTS, JOBS, CONNECTIONS, SEED_NOW } from './seed';
import { getDegreeRegisterStats } from './repo';
import type { SeedMember } from './seed';

/**
 * Accreditation reporting.
 *
 * This is the module that gets the purchase order signed.
 *
 * Every NAAC cycle and every NIRF submission, somebody at the college
 * spends three weeks rebuilding the same numbers from a spreadsheet an
 * assistant maintained by hand — how many graduates are traceable, what
 * they contributed, how many events the association ran, what proportion
 * of the batch progressed to higher study. The numbers are usually
 * defensible and almost never reproducible, which is exactly what an
 * assessor asks about.
 *
 * Because this portal holds the degree register *and* the member records,
 * those numbers are a query rather than an archaeology project. Each
 * figure below carries the criterion it answers and the definition it was
 * computed under, so the same question next cycle gets the same answer
 * for the same reason.
 *
 * Two rules this module does not bend:
 *
 *  1. **Nothing is inflated.** Coverage is reported against the degree
 *     register, not against the members who signed up. A portal that
 *     reports "97% of alumni are engaged" because it only counts people
 *     who are on it is useless to the person defending the figure.
 *  2. **Every number states its denominator.** An assessor's first
 *     question is "out of what", and a report that cannot answer it in
 *     the same row has already failed.
 */

export interface ReportMetric {
  /** e.g. "5.4.1" for NAAC, "GO" for NIRF. */
  code: string;
  label: string;
  value: number | string;
  /** What the value is out of. Stated because it is always asked. */
  denominator?: string;
  /** How this was computed, in a sentence an assessor can check. */
  definition: string;
  /** Set when the figure cannot be produced honestly yet. */
  caveat?: string;
}

export interface ReportSection {
  title: string;
  framework: 'NAAC' | 'NIRF' | 'AICTE' | 'Internal';
  criterion: string;
  description: string;
  metrics: ReportMetric[];
}

const YEAR = SEED_NOW.getFullYear();

function pct(n: number, d: number): string {
  if (!d) return '—';
  return `${((n / d) * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------
// NAAC Criterion 5 — Student Support and Progression
// ---------------------------------------------------------------

function alumniEngagement(): ReportSection {
  const register = getDegreeRegisterStats();
  const alumni = SEED.alumni;

  const contactable = alumni.filter(
    (m) => m.privateContact.email || m.privateContact.mobile,
  ).length;

  const activeLastYear = alumni.filter(
    (m) => m.lastLoginAt && m.lastLoginAt > new Date(SEED_NOW.getTime() - 365 * 86400000).toISOString(),
  ).length;

  const volunteering = alumni.filter(
    (m) => m.openToMentoring || m.openToReferrals || m.openToSpeaking,
  ).length;

  return {
    title: 'Alumni engagement',
    framework: 'NAAC',
    criterion: '5.4.1',
    description:
      'The extent and nature of alumni association activity. NAAC asks for evidence of a registered body and of contribution — financial, non-financial, or both. Traceability is the number that limits every other figure here, so it is reported first.',
    metrics: [
      {
        code: '5.4.1',
        label: 'Graduates in the degree register',
        value: register.total,
        denominator: 'all recorded graduates since the first graduating batch',
        definition: 'Row count of the degree register loaded from the examinations branch.',
      },
      {
        code: '5.4.1',
        label: 'Graduates traceable on the portal',
        value: `${register.claimed} (${pct(register.claimed, register.total)})`,
        denominator: `${register.total} recorded graduates`,
        definition:
          'Register rows matched to a verified member account. Deliberately reported against the full register rather than against signed-up members, because the latter is always near 100% and answers nothing.',
      },
      {
        code: '5.4.1',
        label: 'Graduates with a working contact route',
        value: `${contactable} (${pct(contactable, register.total)})`,
        denominator: `${register.total} recorded graduates`,
        definition: 'Verified members holding at least one of a confirmed email address or mobile number.',
        caveat:
          'Hard-bounce handling is not yet wired to the email provider, so this figure will overstate reachability until it is. See the backlog.',
      },
      {
        code: '5.4.1',
        label: 'Graduates active in the last 12 months',
        value: `${activeLastYear} (${pct(activeLastYear, alumni.length)})`,
        denominator: `${alumni.length} verified alumni members`,
        definition: 'Members with a recorded sign-in inside the last 365 days.',
      },
      {
        code: '5.4.1',
        label: 'Graduates volunteering to support students',
        value: volunteering,
        denominator: `${alumni.length} verified alumni members`,
        definition:
          'Members who have set at least one of mentoring, referrals or speaking to available. This is a standing consent recorded by the member, not an estimate.',
      },
    ],
  };
}

function alumniContribution(): ReportSection {
  const succeeded = DONATIONS.filter((d) => d.state === 'succeeded');
  const domestic = succeeded.filter((d) => !d.isForeignContribution);
  const foreign = succeeded.filter((d) => d.isForeignContribution);
  const total = succeeded.reduce((n, d) => n + d.amount, 0);
  const domesticTotal = domestic.reduce((n, d) => n + d.amount, 0);
  const foreignTotal = foreign.reduce((n, d) => n + d.amount, 0);

  const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return {
    title: 'Alumni financial contribution',
    framework: 'NAAC',
    criterion: '5.4.2',
    description:
      'NAAC bands alumni contribution by amount received during the assessment period. Domestic and foreign contributions are reported separately throughout, because FCRA requires them to be segregated at the point of collection rather than reconciled afterwards.',
    metrics: [
      {
        code: '5.4.2',
        label: 'Total received',
        value: inr(total),
        denominator: 'all successful contributions in the period',
        definition: 'Sum of contributions in the `succeeded` state. Initiated, failed and refunded rows are excluded.',
      },
      {
        code: '5.4.2',
        label: 'Domestic contributions',
        value: `${inr(domesticTotal)} from ${domestic.length} contributions`,
        definition: 'Contributions with a source country of India.',
      },
      {
        code: 'FCRA',
        label: 'Foreign contributions',
        value: `${inr(foreignTotal)} from ${foreign.length} contributions`,
        definition:
          'Contributions with a source country outside India, flagged at the point of collection. Reportable separately under the Foreign Contribution (Regulation) Act.',
        caveat:
          'The college has not yet confirmed FCRA registration. Until it does, the donations module is switched off and this row exists to show the segregation, not to report receipts.',
      },
      {
        code: '5.4.2',
        label: 'Distinct contributors',
        value: new Set(succeeded.map((d) => d.donorName)).size,
        denominator: `${SEED.alumni.length} verified alumni members`,
        definition: 'Distinct donor names across successful contributions.',
      },
      {
        code: '5.4.2',
        label: 'Active campaigns',
        value: CAMPAIGNS.filter((c) => c.active).length,
        definition: 'Fundraising campaigns currently open for contribution.',
      },
    ],
  };
}

function studentProgression(): ReportSection {
  const finalYear = SEED.students.filter((m) => m.batchYear === YEAR);
  const placed = finalYear.filter((m) => (m.placementStatus ?? '').startsWith('Placed'));
  const higherStudies = finalYear.filter((m) => (m.placementStatus ?? '').includes('higher studies'));

  const postgrad = SEED.alumni.filter((m) =>
    m.education.some((e) => e.qualification && /M\.?Tech|M\.?S\.?|MBA|Ph\.?D/i.test(e.qualification)),
  );

  return {
    title: 'Student progression',
    framework: 'NAAC',
    criterion: '5.2.1 / 5.2.2',
    description:
      'Progression to employment and to higher education. The placement figures come from the placement cell; the higher-study figures are derived from what graduates have since recorded about themselves, which is a different and weaker kind of evidence. Both are labelled as such.',
    metrics: [
      {
        code: '5.2.1',
        label: 'Final-year students placed',
        value: `${placed.length} (${pct(placed.length, finalYear.length)})`,
        denominator: `${finalYear.length} students in the ${YEAR} graduating batch`,
        definition: 'Students whose placement record from the placement cell shows an accepted offer.',
      },
      {
        code: '5.2.2',
        label: 'Progressed to higher education',
        value: `${higherStudies.length} (${pct(higherStudies.length, finalYear.length)})`,
        denominator: `${finalYear.length} students in the ${YEAR} graduating batch`,
        definition: 'Students recorded by the placement cell as opting out of placement for higher study.',
      },
      {
        code: '5.2.2',
        label: 'Graduates holding a postgraduate qualification',
        value: postgrad.length,
        denominator: `${SEED.alumni.length} verified alumni members`,
        definition:
          'Alumni whose self-recorded education history includes a masters or doctoral qualification.',
        caveat:
          'Self-reported and therefore a floor, not a count. It only covers graduates who both signed up and filled in their education history.',
      },
      {
        code: '5.2.1',
        label: 'Offers attributable to an alumni referral',
        value: JOBS.filter((j) => j.state === 'live' || j.state === 'closed').reduce((n, j) => n + j.applicationCount, 0),
        definition:
          'Applications made through job postings placed by graduates on this portal. Counts applications, not confirmed offers — the portal cannot see an offer letter.',
        caveat: 'Reported as applications. Do not present this as a placement figure.',
      },
    ],
  };
}

// ---------------------------------------------------------------
// NIRF
// ---------------------------------------------------------------

function nirfOutcomes(): ReportSection {
  const register = getDegreeRegisterStats();
  const recent = register.byYear.filter((y) => y.year >= YEAR - 3);
  const recentTotal = recent.reduce((n, y) => n + y.total, 0);

  return {
    title: 'Graduation outcomes and perception',
    framework: 'NIRF',
    criterion: 'GO / PR',
    description:
      'NIRF asks for graduating-cohort sizes and outcomes over a three-year window, and separately conducts a perception survey for which the institution supplies a contactable alumni list. The second is where an untraceable alumni body costs a college marks directly.',
    metrics: [
      {
        code: 'GO',
        label: 'Graduating cohort, last three years',
        value: recentTotal,
        denominator: `${YEAR - 3}–${YEAR}`,
        definition: 'Degree register rows with a year of passing inside the window.',
      },
      {
        code: 'GUE',
        label: 'Median cohort size per year',
        value: recent.length ? Math.round(recentTotal / recent.length) : 0,
        definition: 'Mean graduates per year across the window, from the register.',
      },
      {
        code: 'PR',
        label: 'Contactable alumni available for the perception survey',
        value: SEED.alumni.filter((m) => m.privateContact.email).length,
        denominator: `${register.total} recorded graduates`,
        definition:
          'Verified members holding an email address. This is the list an institution can honestly supply for the NIRF perception exercise.',
      },
      {
        code: 'OI',
        label: 'Graduates working outside the home state',
        value: SEED.alumni.filter((m) => m.state && m.state !== 'Andhra Pradesh').length,
        denominator: `${SEED.alumni.length} verified alumni members`,
        definition: 'Members whose recorded location is outside the institution\'s state, including abroad.',
      },
      {
        code: 'OI',
        label: 'Graduates working outside India',
        value: SEED.alumni.filter((m) => m.country && m.country !== 'IN').length,
        denominator: `${SEED.alumni.length} verified alumni members`,
        definition: 'Members whose recorded country is not India.',
      },
    ],
  };
}

// ---------------------------------------------------------------
// Internal / association activity
// ---------------------------------------------------------------

function associationActivity(): ReportSection {
  const published = EVENTS.filter((e) => e.published);
  const attendance = published.reduce((n, e) => n + e.registeredCount, 0);
  const answered = CONNECTIONS.filter((c) => c.state === 'accepted' || c.state === 'declined');
  const accepted = answered.filter((c) => c.state === 'accepted');

  return {
    title: 'Association activity',
    framework: 'Internal',
    criterion: '—',
    description:
      'Evidence of a functioning association rather than a registered one. These are the figures an assessor asks for after reading the constitution, and the ones a college most often cannot produce.',
    metrics: [
      {
        code: '—',
        label: 'Events held or scheduled',
        value: published.length,
        definition: 'Published events, past and upcoming.',
      },
      {
        code: '—',
        label: 'Total event registrations',
        value: attendance,
        definition: 'Sum of registrations across published events. Counts registrations, not distinct attendees.',
      },
      {
        code: '—',
        label: 'Student-to-alumni requests made',
        value: CONNECTIONS.length,
        definition: 'Connection requests of every state, including withdrawn and expired.',
      },
      {
        code: '—',
        label: 'Response rate to student requests',
        value: pct(accepted.length, answered.length),
        denominator: `${answered.length} requests that received a decision`,
        definition:
          'Accepted as a proportion of requests that were answered either way. Requests still pending or expired unanswered are excluded from the denominator, since they measure alumni latency rather than willingness.',
      },
      {
        code: '—',
        label: 'Live job and internship postings from graduates',
        value: JOBS.filter((j) => j.state === 'live').length,
        definition: 'Postings placed by alumni or faculty and approved by the placement cell.',
      },
    ],
  };
}

// ---------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------

export function getReportSections(): ReportSection[] {
  return [
    alumniEngagement(),
    alumniContribution(),
    studentProgression(),
    nirfOutcomes(),
    associationActivity(),
  ];
}

export const REPORT_FRAMEWORKS = ['NAAC', 'NIRF', 'AICTE', 'Internal'] as const;
export type ReportFramework = (typeof REPORT_FRAMEWORKS)[number];

/** Register coverage per year — the single most-requested breakdown. */
export function getCoverageByYear() {
  return getDegreeRegisterStats().byYear.map((y) => ({
    ...y,
    unclaimed: y.total - y.claimed,
    coverage: y.total ? y.claimed / y.total : 0,
  }));
}

/** Register coverage per department, for a department-wise NAAC annexure. */
export function getCoverageByDepartment() {
  return DEPARTMENTS.map((d) => {
    const registerRows = DEGREE_REGISTER.filter((r) => r.departmentCode === d.code).length;
    const claimed = SEED.alumni.filter((m) => m.departmentCode === d.code).length;
    const mentoring = SEED.alumni.filter((m) => m.departmentCode === d.code && m.openToMentoring).length;
    return {
      code: d.code,
      name: d.name,
      registerRows,
      claimed,
      unclaimed: Math.max(0, registerRows - claimed),
      coverage: registerRows ? claimed / registerRows : 0,
      mentoring,
    };
  }).sort((a, b) => b.registerRows - a.registerRows);
}

/**
 * Flatten a report to CSV.
 *
 * Assessors want a spreadsheet, and a college that has to retype numbers
 * out of a web page into one will introduce an error and then have to
 * defend it. The definition column travels with the figure on purpose —
 * it is the part that makes the submission reproducible next cycle.
 */
export function reportToCsv(sections: ReportSection[]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = [
    ['Framework', 'Criterion', 'Section', 'Metric', 'Value', 'Denominator', 'Definition', 'Caveat'],
    ...sections.flatMap((section) =>
      section.metrics.map((m) => [
        section.framework,
        m.code,
        section.title,
        m.label,
        m.value,
        m.denominator ?? '',
        m.definition,
        m.caveat ?? '',
      ]),
    ),
  ];

  return rows.map((r) => r.map(esc).join(',')).join('\n');
}

/**
 * The alumni list for the NIRF perception survey.
 *
 * Bulk contact data, so the route that calls this must hold
 * `member.export` — `college_admin` only — and must audit-log the actor,
 * the scope and a written reason. There is no version of this function
 * that is safe to call without that.
 */
export function perceptionSurveyList(): Array<{
  rollNumber: string | null;
  name: string;
  batchYear: number | null;
  department: string | null;
  email: string | null;
}> {
  return SEED.alumni
    .filter((m: SeedMember) => Boolean(m.privateContact.email))
    .map((m) => ({
      rollNumber: m.rollNumber ?? null,
      name: m.fullName,
      batchYear: m.batchYear,
      department: m.departmentCode,
      email: m.privateContact.email,
    }));
}
