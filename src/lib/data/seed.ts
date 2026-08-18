import type {
  Department,
  MemberDetail,
  MemberSummary,
  ContactDetails,
  ConnectionRequest,
  EventItem,
  JobPosting,
  JobApplication,
  DegreeRecord,
  VerificationClaim,
  DonationCampaign,
  Donation,
  AuditEntry,
  DataRequest,
  NotificationItem,
  TenantSummary,
  EventRegistration,
  Role,
  MemberStatus,
} from './types';

/**
 * The seeded dataset behind fixture mode.
 *
 * Every value here is generated from a fixed seed, so the portal looks
 * identical on every machine and every restart. That matters more than it
 * sounds: a demo where the numbers move between refreshes reads as
 * broken, and a screenshot in a proposal has to still be true next week.
 *
 * The data is shaped to be *awkward* on purpose, because a dataset where
 * everything is tidy hides exactly the screens that need design work:
 *
 *  - Members with no photo, no company, no city — the common case for a
 *    2014 graduate who signed up once.
 *  - Names that break naive matching: initials before and after the
 *    surname, `Ch.` and `K.` prefixes, transliteration variants.
 *  - A verification queue with genuine ambiguity in it, including two
 *    people who share a name in the same branch and year.
 *  - Alumni abroad, so FCRA segregation has something to segregate.
 *  - Unclaimed rows from the degree register with no account attached,
 *    which is what most of the register looks like in month one.
 */

// ---------------------------------------------------------------
// Deterministic RNG
// ---------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260817);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const pickN = <T,>(arr: readonly T[], n: number): T[] => {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) out.push(...copy.splice(Math.floor(rand() * copy.length), 1));
  return out;
};
const chance = (p: number) => rand() < p;
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

/** Fixed "now" so relative dates in the UI do not drift between builds. */
export const SEED_NOW = new Date('2026-08-17T09:30:00+05:30');

const daysFromNow = (d: number) => new Date(SEED_NOW.getTime() + d * 86400000).toISOString();

// ---------------------------------------------------------------
// Pools
// ---------------------------------------------------------------

const SURNAMES = [
  'Kandula', 'Nallamothu', 'Yalamanchili', 'Chintalapudi', 'Bhogireddy', 'Gudivada',
  'Pothineni', 'Vemulapalli', 'Konduru', 'Mandava', 'Sanikommu', 'Bandaru',
  'Kolli', 'Dasari', 'Perumalla', 'Chalasani', 'Gollapudi', 'Alluri',
  'Muppalla', 'Tummala', 'Vadlamudi', 'Kanumuri', 'Sagi', 'Uppalapati',
  'Devarapalli', 'Kotagiri', 'Battula', 'Namburi', 'Pallapothu', 'Rayudu',
  'Shaik', 'Syed', 'Mohammad', 'Pathan', 'Begum',
  'Reddy', 'Naidu', 'Chowdary', 'Varma', 'Raju', 'Prasad', 'Rao',
];

const FIRST_M = [
  'Venkata', 'Sai', 'Naga', 'Hari', 'Rama', 'Krishna', 'Surya', 'Aditya', 'Rohit',
  'Praveen', 'Manoj', 'Kiran', 'Vamsi', 'Karthik', 'Bharath', 'Yeswanth', 'Charan',
  'Dinesh', 'Ganesh', 'Jagadeesh', 'Lokesh', 'Mahesh', 'Nikhil', 'Pavan', 'Rajesh',
  'Sandeep', 'Tarun', 'Uday', 'Vishnu', 'Abhilash', 'Chaitanya', 'Deepak', 'Gopi',
  'Sreekanth', 'Prudhvi', 'Rakesh', 'Anil', 'Sumanth', 'Tejaswi', 'Naveen',
];

const FIRST_F = [
  'Lakshmi', 'Sravani', 'Divya', 'Anusha', 'Harika', 'Bhavana', 'Keerthi', 'Madhuri',
  'Navya', 'Padmaja', 'Ramya', 'Sindhu', 'Swathi', 'Tejaswini', 'Vaishnavi', 'Yamini',
  'Aishwarya', 'Deepika', 'Gayathri', 'Jyothi', 'Kavya', 'Manasa', 'Nikitha', 'Pravallika',
  'Sahithi', 'Sowmya', 'Vandana', 'Akhila', 'Bhargavi', 'Chandrika', 'Hemalatha', 'Sirisha',
];

/** Second given names, which is where transliteration drift usually lands. */
const MIDDLE = ['Sai', 'Venkata', 'Naga', 'Sri', 'Lakshmi', 'Durga', 'Siva', 'Rama', ''];

export const DEPARTMENTS: Department[] = [
  { id: 'dep-cse', code: 'CSE', name: 'Computer Science & Engineering', established: 2009, intake: 240 },
  { id: 'dep-ece', code: 'ECE', name: 'Electronics & Communication Engineering', established: 2009, intake: 120 },
  { id: 'dep-eee', code: 'EEE', name: 'Electrical & Electronics Engineering', established: 2009, intake: 60 },
  { id: 'dep-mech', code: 'MECH', name: 'Mechanical Engineering', established: 2009, intake: 60 },
  { id: 'dep-civil', code: 'CIVIL', name: 'Civil Engineering', established: 2011, intake: 60 },
  { id: 'dep-it', code: 'IT', name: 'Information Technology', established: 2010, intake: 60 },
  { id: 'dep-aiml', code: 'AIML', name: 'Artificial Intelligence & Machine Learning', established: 2020, intake: 60 },
];

const DEPT_CODES = DEPARTMENTS.map((d) => d.code);

/** Weighted so CSE dominates, which is what an intake sheet actually looks like. */
const DEPT_WEIGHTED = ['CSE', 'CSE', 'CSE', 'CSE', 'ECE', 'ECE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'IT', 'AIML'];

const COMPANIES = [
  'Tata Consultancy Services', 'Infosys', 'Wipro', 'Cognizant', 'Accenture', 'Capgemini',
  'HCLTech', 'Tech Mahindra', 'LTIMindtree', 'Mphasis', 'Virtusa', 'Persistent Systems',
  'Amazon', 'Microsoft', 'Google', 'Oracle', 'SAP Labs', 'Adobe', 'Salesforce', 'ServiceNow',
  'Qualcomm', 'Intel', 'Nvidia', 'Cisco', 'Dell Technologies', 'IBM',
  'Zoho', 'Freshworks', 'Flipkart', 'Swiggy', 'Zomato', 'PhonePe', 'Razorpay', 'CRED',
  'Deloitte', 'EY', 'KPMG', 'PwC', 'JPMorgan Chase', 'Goldman Sachs', 'Morgan Stanley',
  'L&T Construction', 'Bharat Heavy Electricals', 'NTPC', 'Ashok Leyland', 'Bosch',
  'Amara Raja Batteries', 'Hetero Drugs', 'Divis Laboratories',
];

const STARTUPS = ['Vahan', 'Kisan Network', 'Bijak', 'Skyroot Aerospace', 'Agnikul Cosmos', 'Dhruva Space'];

const DESIGNATIONS = [
  'Software Engineer', 'Senior Software Engineer', 'Staff Engineer', 'Engineering Manager',
  'Systems Engineer', 'Data Engineer', 'Data Scientist', 'ML Engineer', 'DevOps Engineer',
  'SRE', 'QA Engineer', 'Product Manager', 'Technical Architect', 'Principal Engineer',
  'Business Analyst', 'Consultant', 'Senior Consultant', 'Project Manager',
  'Design Engineer', 'Site Engineer', 'Project Engineer', 'Assistant Manager',
  'Associate Professor', 'Assistant Professor', 'Founder', 'Co-founder',
];

const INDUSTRIES = [
  'Information Technology', 'Product Engineering', 'Banking & Finance', 'Consulting',
  'Manufacturing', 'Construction & Infrastructure', 'Semiconductors', 'Healthcare & Pharma',
  'Education', 'Government & Public Sector', 'Energy & Utilities', 'E-commerce', 'Telecom',
];

const CITIES_IN: Array<[string, string]> = [
  ['Hyderabad', 'Telangana'], ['Bengaluru', 'Karnataka'], ['Chennai', 'Tamil Nadu'],
  ['Pune', 'Maharashtra'], ['Mumbai', 'Maharashtra'], ['Vijayawada', 'Andhra Pradesh'],
  ['Visakhapatnam', 'Andhra Pradesh'], ['Guntur', 'Andhra Pradesh'], ['Tirupati', 'Andhra Pradesh'],
  ['Noida', 'Uttar Pradesh'], ['Gurugram', 'Haryana'], ['Kochi', 'Kerala'], ['Kolkata', 'West Bengal'],
  ['Ahmedabad', 'Gujarat'], ['Bhubaneswar', 'Odisha'], ['Nellore', 'Andhra Pradesh'],
];

const CITIES_ABROAD: Array<[string, string, string]> = [
  ['Seattle', 'Washington', 'US'], ['San Jose', 'California', 'US'], ['Austin', 'Texas', 'US'],
  ['Toronto', 'Ontario', 'CA'], ['Dubai', 'Dubai', 'AE'], ['Singapore', '', 'SG'],
  ['London', 'England', 'GB'], ['Berlin', 'Berlin', 'DE'], ['Sydney', 'NSW', 'AU'],
  ['Dublin', 'Leinster', 'IE'], ['Zurich', 'Zurich', 'CH'], ['Doha', 'Doha', 'QA'],
];

const SKILLS_BY_DEPT: Record<string, string[]> = {
  CSE: ['Java', 'Python', 'React', 'Node.js', 'Spring Boot', 'AWS', 'Kubernetes', 'PostgreSQL', 'System Design', 'Go', 'TypeScript', 'Microservices'],
  IT: ['Java', 'Angular', '.NET', 'SQL Server', 'Azure', 'Selenium', 'ServiceNow', 'Salesforce', 'Power BI'],
  AIML: ['Python', 'PyTorch', 'TensorFlow', 'NLP', 'Computer Vision', 'MLOps', 'LLMs', 'Pandas', 'Scikit-learn'],
  ECE: ['VLSI', 'Verilog', 'Embedded C', 'RTOS', 'Signal Processing', 'MATLAB', 'PCB Design', 'IoT', 'FPGA'],
  EEE: ['Power Systems', 'PLC', 'SCADA', 'MATLAB', 'AutoCAD Electrical', 'Solar PV', 'Substation Design'],
  MECH: ['AutoCAD', 'SolidWorks', 'CATIA', 'ANSYS', 'GD&T', 'Lean Manufacturing', 'Thermal Analysis'],
  CIVIL: ['AutoCAD', 'STAAD Pro', 'Revit', 'Primavera', 'Quantity Surveying', 'Site Supervision', 'Estimation'],
};

const SOFT_SKILLS = ['Mentoring', 'Public Speaking', 'Technical Writing', 'Interviewing', 'Campus Recruitment'];

// ---------------------------------------------------------------
// Name generation
// ---------------------------------------------------------------

interface GeneratedName {
  full: string;
  /** How the same person appears in the college register — often not identical. */
  registerForm: string;
}

function makeName(): GeneratedName {
  const female = chance(0.36);
  const first = female ? pick(FIRST_F) : pick(FIRST_M);
  const middle = pick(MIDDLE);
  const surname = pick(SURNAMES);

  const full = [first, middle, surname].filter(Boolean).join(' ');

  // The register is typed by hand from mark sheets. Surname-first order,
  // collapsed initials and dropped middle names are all normal, and the
  // matcher has to survive every one of them.
  const style = int(0, 5);
  let registerForm = full;
  if (style === 0) registerForm = `${surname} ${first}`;
  else if (style === 1 && middle) registerForm = `${first} ${middle[0]}. ${surname}`;
  else if (style === 2) registerForm = `${surname.slice(0, 2)}. ${first} ${middle}`.trim();
  else if (style === 3) registerForm = `${first} ${surname}`;
  else if (style === 4) registerForm = full.toUpperCase();

  return { full, registerForm };
}

function slugify(name: string, n: number): string {
  return `${name.toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, '-')}-${n}`;
}

function rollNumber(admissionYear: number, deptCode: string, n: number): string {
  // JNTUK pattern: 2-digit year + college code + branch code + serial.
  const branch = { CSE: '05', ECE: '04', EEE: '02', MECH: '03', CIVIL: '01', IT: '12', AIML: '42' }[deptCode] ?? '05';
  return `${String(admissionYear).slice(2)}JN1A${branch}${String(n).padStart(2, '0')}`;
}

// ---------------------------------------------------------------
// Members
// ---------------------------------------------------------------

/**
 * A stored member row.
 *
 * `contactVisibility` and `hasAcceptedConnection` are omitted because they
 * are not properties of the person — they are the answer to "why was this
 * viewer refused", computed per request in `getMemberBySlug`. Storing them
 * on the row would invite a caller to trust a value that was true for
 * somebody else.
 */
export interface SeedMember extends Omit<MemberDetail, 'contactVisibility' | 'hasAcceptedConnection'> {
  /** Full contact record. Never returned to the UI without both gates. */
  privateContact: ContactDetails;
  emailLower: string;
  createdAt: string;
  lastLoginAt: string | null;
  degreeRecordId: string | null;
}

const GRAD_YEARS = [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

function buildAlumnus(i: number): SeedMember {
  const name = makeName();
  const batchYear = pick(GRAD_YEARS);
  const admissionYear = batchYear - 4;
  const deptCode = pick(DEPT_WEIGHTED);
  const dept = DEPARTMENTS.find((d) => d.code === deptCode)!;
  const yearsOut = 2026 - batchYear;

  // Engagement decays with distance from graduation. A 2013 batch that
  // looks as complete as the 2024 batch is a fiction, and designing
  // against it means never designing the "we know almost nothing about
  // this person" card that most of the directory actually is.
  const completeness = Math.max(0.25, 1 - yearsOut * 0.055);

  const abroad = chance(0.12 + Math.min(0.1, yearsOut * 0.01));
  const employed = chance(completeness + 0.15);

  const [city, state, country] = abroad
    ? pick(CITIES_ABROAD)
    : [...pick(CITIES_IN), 'IN'] as [string, string, string];

  const company = employed ? (chance(0.06) ? pick(STARTUPS) : pick(COMPANIES)) : null;
  const designation = employed ? pick(DESIGNATIONS) : null;

  const deptSkills = SKILLS_BY_DEPT[deptCode] ?? SKILLS_BY_DEPT.CSE!;
  const skills = chance(completeness)
    ? [...pickN(deptSkills, int(2, 5)), ...(chance(0.3) ? pickN(SOFT_SKILLS, 1) : [])]
    : [];

  const emailUser = name.full.toLowerCase().replace(/[^a-z]/g, '.').replace(/\.+/g, '.').slice(0, 24);
  const email = `${emailUser}${int(1, 99)}@${pick(['gmail.com', 'gmail.com', 'gmail.com', 'outlook.com', 'yahoo.co.in', 'proton.me'])}`;

  const seniorityYears = Math.max(0, yearsOut);
  const employment: MemberDetail['employment'] = [];
  if (company) {
    employment.push({
      id: `emp-${i}-0`,
      company,
      designation,
      location: `${city}${country === 'IN' ? '' : `, ${country}`}`,
      startedOn: `${2026 - Math.min(seniorityYears, int(1, 4))}-04-01`,
      endedOn: null,
      isCurrent: true,
    });
    if (seniorityYears > 3 && chance(0.55)) {
      employment.push({
        id: `emp-${i}-1`,
        company: pick(COMPANIES),
        designation: pick(DESIGNATIONS),
        location: pick(CITIES_IN)[0],
        startedOn: `${batchYear}-07-01`,
        endedOn: `${2026 - Math.min(seniorityYears, int(1, 4))}-03-31`,
        isCurrent: false,
      });
    }
  }

  const education: MemberDetail['education'] = [
    {
      id: `edu-${i}-0`,
      institution: 'Dhanekula Institute of Engineering & Technology',
      qualification: 'B.Tech',
      field: dept.name,
      startedOn: `${admissionYear}-08-01`,
      endedOn: `${batchYear}-05-31`,
    },
  ];
  if (chance(0.16)) {
    education.unshift({
      id: `edu-${i}-1`,
      institution: pick(['IIT Madras', 'NIT Warangal', 'BITS Pilani', 'IIIT Hyderabad', 'Arizona State University', 'University of Texas at Dallas', 'TU Munich']),
      qualification: pick(['M.Tech', 'M.S.', 'MBA']),
      field: pick(['Computer Science', 'Data Science', 'VLSI Design', 'Structural Engineering', 'Operations']),
      startedOn: `${batchYear + 1}-08-01`,
      endedOn: `${batchYear + 3}-05-31`,
    });
  }

  const mentoring = chance(0.3 + (yearsOut > 4 ? 0.18 : 0));
  const referrals = chance(0.24) && Boolean(company);
  const speaking = chance(0.12 + (yearsOut > 6 ? 0.1 : 0));

  const visibility: ContactDetails['visibility'] = pick([
    'on_accept', 'on_accept', 'on_accept', 'alumni_only', 'alumni_only', 'all_members', 'private',
  ]);

  return {
    id: `mem-a-${i}`,
    slug: slugify(name.full, i),
    fullName: name.full,
    preferredName: chance(0.15) ? name.full.split(' ')[0]! : null,
    photoUrl: null,
    bio: chance(completeness * 0.7)
      ? bioFor(designation, company, dept.name, batchYear, mentoring)
      : null,
    batchYear,
    admissionYear,
    programme: 'B.Tech',
    departmentCode: deptCode,
    departmentName: dept.name,
    currentCompany: company,
    designation,
    industry: employed ? pick(INDUSTRIES) : null,
    city,
    state: state || null,
    country,
    skills,
    openToMentoring: mentoring,
    openToReferrals: referrals,
    openToSpeaking: speaking,
    status: 'active_alumni' as MemberStatus,
    isStudent: false,
    employment,
    education,
    verifiedAt: daysFromNow(-int(20, 700)),
    verificationMethod: pick(['auto_roll_match', 'auto_roll_match', 'auto_roll_match', 'admin_manual', 'bulk_import']),
    roles: [{ role: 'alumni' as Role, departmentCode: null }],
    contact: null,
    rollNumber: rollNumber(admissionYear, deptCode, (i % 90) + 1),
    privateContact: {
      email,
      mobile: `+91 ${int(70, 99)}${String(int(0, 99999999)).padStart(8, '0')}`,
      linkedin: chance(completeness) ? `https://linkedin.com/in/${slugify(name.full, i)}` : null,
      github: deptCode === 'CSE' || deptCode === 'IT' || deptCode === 'AIML' ? (chance(0.4) ? `https://github.com/${emailUser.split('.')[0]}${i}` : null) : null,
      portfolio: chance(0.08) ? `https://${emailUser.split('.')[0]}${i}.dev` : null,
      visibility,
    },
    emailLower: email.toLowerCase(),
    createdAt: daysFromNow(-int(30, 900)),
    lastLoginAt: chance(completeness) ? daysFromNow(-int(0, 220)) : null,
    degreeRecordId: `deg-${i}`,
  };
}

function bioFor(
  designation: string | null,
  company: string | null,
  deptName: string,
  batchYear: number,
  mentoring: boolean,
): string {
  const parts: string[] = [];
  if (designation && company) parts.push(`${designation} at ${company}.`);
  parts.push(`${deptName.split(' &')[0]} graduate, batch of ${batchYear}.`);
  if (mentoring) parts.push(pick([
    'Happy to talk to final-years about interview prep — ask before you apply, not after.',
    'Open to mentoring students on placements and higher studies.',
    'Glad to review resumes for anyone from the department.',
    'Ask me about switching from service to product companies.',
  ]));
  return parts.join(' ');
}

function buildStudent(i: number): SeedMember {
  const name = makeName();
  const batchYear = pick([2026, 2027]);
  const admissionYear = batchYear - 4;
  const deptCode = pick(DEPT_WEIGHTED);
  const dept = DEPARTMENTS.find((d) => d.code === deptCode)!;
  const deptSkills = SKILLS_BY_DEPT[deptCode] ?? SKILLS_BY_DEPT.CSE!;

  const emailUser = name.full.toLowerCase().replace(/[^a-z]/g, '.').replace(/\.+/g, '.').slice(0, 22);
  const roll = rollNumber(admissionYear, deptCode, (i % 90) + 1);

  const placed = batchYear === 2026 && chance(0.42);

  return {
    id: `mem-s-${i}`,
    slug: slugify(name.full, 9000 + i),
    fullName: name.full,
    preferredName: null,
    photoUrl: null,
    bio: chance(0.35) ? `Final-year ${deptCode} student. Looking for ${pick(['SDE', 'data', 'embedded', 'core', 'analyst'])} roles and open to guidance from alumni.` : null,
    batchYear,
    admissionYear,
    programme: 'B.Tech',
    departmentCode: deptCode,
    departmentName: dept.name,
    currentCompany: null,
    designation: null,
    industry: null,
    city: 'Vijayawada',
    state: 'Andhra Pradesh',
    country: 'IN',
    skills: pickN(deptSkills, int(1, 4)),
    openToMentoring: false,
    openToReferrals: false,
    openToSpeaking: false,
    status: 'active_student' as MemberStatus,
    isStudent: true,
    employment: [],
    education: [
      {
        id: `edu-s-${i}`,
        institution: 'Dhanekula Institute of Engineering & Technology',
        qualification: 'B.Tech',
        field: dept.name,
        startedOn: `${admissionYear}-08-01`,
        endedOn: null,
      },
    ],
    verifiedAt: daysFromNow(-int(5, 300)),
    verificationMethod: 'placement_cell_import',
    roles: [{ role: 'student' as Role, departmentCode: null }],
    contact: null,
    rollNumber: roll,
    // Placement-side only. Present in the seed because the placement
    // officer's screens need it; the projection layer is what keeps it
    // away from everyone else.
    cgpa: Number((6 + rand() * 3.6).toFixed(2)),
    placementStatus: placed ? pick(['Placed — Infosys', 'Placed — TCS', 'Placed — Cognizant', 'Placed — Amazon']) : pick(['Not placed', 'In process', 'Opted out — higher studies']),
    privateContact: {
      email: `${roll.toLowerCase()}@diet.ac.in`,
      mobile: `+91 ${int(70, 99)}${String(int(0, 99999999)).padStart(8, '0')}`,
      linkedin: chance(0.5) ? `https://linkedin.com/in/${slugify(name.full, i)}` : null,
      github: chance(0.45) ? `https://github.com/${emailUser.split('.')[0]}${i}` : null,
      portfolio: null,
      visibility: 'on_accept',
    },
    emailLower: `${roll.toLowerCase()}@diet.ac.in`,
    createdAt: daysFromNow(-int(10, 400)),
    lastLoginAt: daysFromNow(-int(0, 40)),
    degreeRecordId: null,
  };
}

// ---------------------------------------------------------------
// Demo accounts
// ---------------------------------------------------------------

/**
 * Fixed accounts, one per role.
 *
 * A demo where the salesperson has to hunt for "a user who happens to be
 * an HOD" does not survive contact with a live call. These are stable,
 * documented on the sign-in screen in fixture mode, and never present
 * when a database is configured.
 */
export interface DemoAccount {
  email: string;
  label: string;
  description: string;
  roles: Array<{ role: Role; departmentCode: string | null }>;
  memberId: string;
}

export function buildSeed() {
  const alumni = Array.from({ length: 214 }, (_, i) => buildAlumnus(i));
  const students = Array.from({ length: 96 }, (_, i) => buildStudent(i));

  // Two people, same name, same branch, same year. This is the case the
  // verification queue exists for, and it is not rare in a cohort of 240.
  const twinA = alumni[7]!;
  const twinB = alumni[8]!;
  twinB.fullName = twinA.fullName;
  twinB.departmentCode = twinA.departmentCode;
  twinB.departmentName = twinA.departmentName;
  twinB.batchYear = twinA.batchYear;
  twinB.admissionYear = twinA.admissionYear;
  twinB.slug = `${twinA.slug}-2`;

  const members: SeedMember[] = [...alumni, ...students];

  // ---- Demo identities -------------------------------------------------

  const promote = (m: SeedMember, roles: Array<{ role: Role; departmentCode: string | null }>, email: string) => {
    m.roles = roles;
    m.privateContact.email = email;
    m.emailLower = email.toLowerCase();
    return m;
  };

  const adminMember = promote(alumni[0]!, [
    { role: 'alumni', departmentCode: null },
    { role: 'college_admin', departmentCode: null },
  ], 'admin@diet.ac.in');
  adminMember.fullName = 'Dr. Padmaja Vemulapalli';
  adminMember.designation = 'Dean, Alumni Relations';
  adminMember.currentCompany = 'Dhanekula Institute of Engineering & Technology';
  adminMember.openToMentoring = true;

  const operatorMember = promote(alumni[1]!, [
    { role: 'alumni', departmentCode: null },
    { role: 'alumni_cell_operator', departmentCode: null },
  ], 'alumnicell@diet.ac.in');
  operatorMember.fullName = 'Sridevi Kandula';
  operatorMember.designation = 'Alumni Cell Coordinator';

  const hodMember = promote(alumni[2]!, [
    { role: 'faculty', departmentCode: 'CSE' },
    { role: 'hod', departmentCode: 'CSE' },
  ], 'hod.cse@diet.ac.in');
  hodMember.fullName = 'Dr. Ramesh Chalasani';
  hodMember.departmentCode = 'CSE';
  hodMember.departmentName = 'Computer Science & Engineering';
  hodMember.designation = 'Head of Department, CSE';
  hodMember.currentCompany = 'Dhanekula Institute of Engineering & Technology';

  const placementMember = promote(alumni[3]!, [
    { role: 'faculty', departmentCode: null },
    { role: 'placement_officer', departmentCode: null },
  ], 'tpo@diet.ac.in');
  placementMember.fullName = 'Srinivas Gollapudi';
  placementMember.designation = 'Training & Placement Officer';
  placementMember.currentCompany = 'Dhanekula Institute of Engineering & Technology';

  const financeMember = promote(alumni[4]!, [{ role: 'finance', departmentCode: null }], 'finance@diet.ac.in');
  financeMember.fullName = 'Anjaneyulu Bandaru';
  financeMember.designation = 'Accounts Officer';

  const facultyMember = promote(alumni[5]!, [{ role: 'faculty', departmentCode: 'ECE' }], 'faculty.ece@diet.ac.in');
  facultyMember.fullName = 'Dr. Hemalatha Namburi';
  facultyMember.departmentCode = 'ECE';
  facultyMember.departmentName = 'Electronics & Communication Engineering';
  facultyMember.designation = 'Associate Professor, ECE';

  const alumniMember = promote(alumni[9]!, [{ role: 'alumni', departmentCode: null }], 'alumni@example.com');
  alumniMember.fullName = 'Vamsi Krishna Pothineni';
  alumniMember.currentCompany = 'Amazon';
  alumniMember.designation = 'Senior Software Engineer';
  alumniMember.city = 'Hyderabad';
  alumniMember.state = 'Telangana';
  alumniMember.country = 'IN';
  alumniMember.batchYear = 2017;
  alumniMember.admissionYear = 2013;
  alumniMember.openToMentoring = true;
  alumniMember.openToReferrals = true;
  alumniMember.skills = ['Java', 'AWS', 'System Design', 'Kubernetes', 'Mentoring'];
  alumniMember.bio = 'Senior Software Engineer at Amazon. CSE, batch of 2017. Happy to talk to final-years about interview prep — ask before you apply, not after.';
  alumniMember.privateContact.visibility = 'on_accept';

  const studentMember = promote(students[0]!, [{ role: 'student', departmentCode: null }], 'student@diet.ac.in');
  studentMember.fullName = 'Harika Nallamothu';
  studentMember.departmentCode = 'CSE';
  studentMember.departmentName = 'Computer Science & Engineering';
  studentMember.batchYear = 2026;
  studentMember.skills = ['Java', 'React', 'PostgreSQL'];

  const platformMember = promote(alumni[10]!, [{ role: 'platform_admin', departmentCode: null }], 'platform@ifbash.com');
  platformMember.fullName = 'ifBash Platform Operations';
  platformMember.designation = 'Platform Operations';
  platformMember.currentCompany = 'ifBash';

  const demoAccounts: DemoAccount[] = [
    { email: 'student@diet.ac.in', label: 'Final-year student', description: 'Searches alumni, requests mentorship. Cannot see contact details or donations.', roles: studentMember.roles, memberId: studentMember.id },
    { email: 'alumni@example.com', label: 'Alumnus', description: 'Full directory, posts jobs, mentors students, gives to campaigns.', roles: alumniMember.roles, memberId: alumniMember.id },
    { email: 'faculty.ece@diet.ac.in', label: 'Faculty (ECE)', description: 'Sees students in the department and the alumni directory.', roles: facultyMember.roles, memberId: facultyMember.id },
    { email: 'hod.cse@diet.ac.in', label: 'HOD (CSE)', description: 'Verification queue and comms, scoped to CSE only.', roles: hodMember.roles, memberId: hodMember.id },
    { email: 'tpo@diet.ac.in', label: 'Placement officer', description: 'CGPA and placement status, job moderation, applicant exports.', roles: placementMember.roles, memberId: placementMember.id },
    { email: 'alumnicell@diet.ac.in', label: 'Alumni cell operator', description: 'Runs verification and events. No bulk export, by design.', roles: operatorMember.roles, memberId: operatorMember.id },
    { email: 'finance@diet.ac.in', label: 'Finance', description: 'Donation reconciliation and reports. No directory access.', roles: financeMember.roles, memberId: financeMember.id },
    { email: 'admin@diet.ac.in', label: 'College admin', description: 'Everything, including bulk export and role management.', roles: adminMember.roles, memberId: adminMember.id },
    { email: 'platform@ifbash.com', label: 'Platform admin (ifBash)', description: 'Provisions tenants. Deliberately cannot read member data.', roles: platformMember.roles, memberId: platformMember.id },
  ];

  return { members, alumni, students, demoAccounts };
}

export const SEED = buildSeed();

// ---------------------------------------------------------------
// Degree register
// ---------------------------------------------------------------

/**
 * The college's authoritative record. Critically, it contains rows with
 * *no* matching account — that is what most of the register looks like,
 * and the unclaimed count is the number the alumni cell is actually
 * trying to move.
 */
export const DEGREE_REGISTER: DegreeRecord[] = (() => {
  const out: DegreeRecord[] = [];

  SEED.alumni.forEach((m, i) => {
    out.push({
      id: `deg-${i}`,
      rollNumber: m.rollNumber ?? rollNumber(m.admissionYear ?? 2012, m.departmentCode ?? 'CSE', i + 1),
      // Register spelling, not portal spelling — this is the gap the
      // matcher is scored against.
      name: makeName().registerForm === m.fullName ? m.fullName : registerVariant(m.fullName),
      departmentCode: m.departmentCode,
      programme: 'B.Tech',
      admissionYear: m.admissionYear,
      yearOfPassing: m.batchYear,
      sourceFile: `DIET_${m.batchYear}_${m.departmentCode}.csv`,
    });
  });

  // Graduates who never signed up. In month one this is ~90% of the file.
  for (let i = 0; i < 620; i++) {
    const n = makeName();
    const batchYear = pick(GRAD_YEARS);
    const deptCode = pick(DEPT_WEIGHTED);
    out.push({
      id: `deg-u-${i}`,
      rollNumber: rollNumber(batchYear - 4, deptCode, (i % 90) + 1),
      name: n.registerForm,
      departmentCode: deptCode,
      programme: 'B.Tech',
      admissionYear: batchYear - 4,
      yearOfPassing: batchYear,
      sourceFile: `DIET_${batchYear}_${deptCode}.csv`,
    });
  }

  return out;
})();

function registerVariant(name: string): string {
  const parts = name.split(' ');
  const style = int(0, 3);
  if (style === 0 && parts.length > 2) return `${parts[parts.length - 1]} ${parts[0]}`;
  if (style === 1 && parts.length > 2) return `${parts[0]} ${parts[1]![0]}. ${parts[parts.length - 1]}`;
  if (style === 2) return name.toUpperCase();
  return name;
}

// ---------------------------------------------------------------
// Verification queue
// ---------------------------------------------------------------

export const VERIFICATION_CLAIMS: VerificationClaim[] = (() => {
  const out: VerificationClaim[] = [];

  const scenarios: Array<{ decision: VerificationClaim['decision']; count: number }> = [
    { decision: 'review', count: 14 },
    { decision: 'auto_approve', count: 6 },
    { decision: 'reject', count: 3 },
  ];

  let n = 0;
  for (const s of scenarios) {
    for (let i = 0; i < s.count; i++, n++) {
      const source = DEGREE_REGISTER[int(0, DEGREE_REGISTER.length - 1)]!;
      const claimedName = s.decision === 'reject' ? makeName().full : registerVariant(source.name);

      const candidates =
        s.decision === 'reject'
          ? []
          : [
              {
                record: source,
                confidence: s.decision === 'auto_approve' ? 0.96 + rand() * 0.03 : 0.62 + rand() * 0.2,
                reasons:
                  s.decision === 'auto_approve'
                    ? ['Roll number exact match', 'Name token overlap 100%', 'Year of passing matches']
                    : pickN(
                        [
                          'Roll number exact match',
                          'Name tokens overlap 2 of 3',
                          'Surname order differs',
                          'Year of passing matches',
                          'Department matches',
                          'Middle name absent in claim',
                        ],
                        3,
                      ),
              },
              ...(s.decision === 'review' && chance(0.45)
                ? [
                    {
                      record: DEGREE_REGISTER[int(0, DEGREE_REGISTER.length - 1)]!,
                      confidence: 0.41 + rand() * 0.15,
                      reasons: ['Same name, different roll number', 'Year of passing differs by 1'],
                    },
                  ]
                : []),
            ];

      const decided = s.decision !== 'review' || chance(0.15);

      out.push({
        id: `claim-${n}`,
        submittedAt: daysFromNow(-int(0, 26)),
        claimedName,
        claimedRoll: s.decision === 'reject' ? `${int(10, 26)}JN1A05${int(10, 99)}` : source.rollNumber,
        claimedDepartmentCode: source.departmentCode,
        claimedBatchYear: source.yearOfPassing,
        email: `${claimedName.toLowerCase().replace(/[^a-z]/g, '.').slice(0, 20)}@gmail.com`,
        mobile: `+91 ${int(70, 99)}${String(int(0, 99999999)).padStart(8, '0')}`,
        status: decided ? (s.decision === 'reject' ? 'rejected' : 'approved') : 'queued',
        candidates,
        decision: s.decision,
        reviewedBy: decided ? 'Sridevi Kandula' : null,
        reviewedAt: decided ? daysFromNow(-int(0, 20)) : null,
        reviewNote: decided && s.decision === 'reject' ? 'No matching record in the degree register for this roll number.' : null,
      });
    }
  }

  return out.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
})();

// ---------------------------------------------------------------
// Events
// ---------------------------------------------------------------

export const EVENTS: EventItem[] = [
  {
    id: 'evt-1', slug: 'alumni-meet-2026', title: 'Annual Alumni Meet 2026',
    description:
      'The full-day reunion on campus. Department sessions in the morning, the general body meeting after lunch, and the cultural evening in the open-air auditorium. Batch coordinators will have your batch table numbers at the registration desk.',
    venue: 'Main Auditorium, DIET Campus, Ganguru',
    startsAt: daysFromNow(38), endsAt: daysFromNow(38.4),
    departmentCode: null, studentEligible: true, alumniOnly: false,
    capacity: 600, registeredCount: 341, ticketPrice: 500, published: true,
    coverImage: null, viewerRegistration: null,
  },
  {
    id: 'evt-2', slug: 'cse-industry-connect', title: 'CSE Industry Connect — Placement Prep',
    description:
      'Six alumni working in product companies take questions from the 2027 batch on interview preparation, system design and the switch from service to product roles. Bring your resume; the last hour is review.',
    venue: 'Seminar Hall 2, CSE Block',
    startsAt: daysFromNow(11), endsAt: daysFromNow(11.2),
    departmentCode: 'CSE', studentEligible: true, alumniOnly: false,
    capacity: 120, registeredCount: 118, ticketPrice: 0, published: true,
    coverImage: null, viewerRegistration: null,
  },
  {
    id: 'evt-3', slug: 'women-in-tech-panel', title: 'Women in Engineering — Careers Panel',
    description: 'Alumnae from four batches on the first five years after graduation, career breaks, and returning to work.',
    venue: 'Online — link sent on registration',
    startsAt: daysFromNow(4), endsAt: daysFromNow(4.1),
    departmentCode: null, studentEligible: true, alumniOnly: false,
    capacity: null, registeredCount: 87, ticketPrice: 0, published: true,
    coverImage: null, viewerRegistration: null,
  },
  {
    id: 'evt-4', slug: 'batch-2015-decade-reunion', title: 'Batch of 2015 — Ten Year Reunion',
    description: 'Dinner in Vijayawada for the 2015 batch and families. Alumni only.',
    venue: 'Hotel Gateway, Vijayawada',
    startsAt: daysFromNow(63), endsAt: daysFromNow(63.3),
    departmentCode: null, studentEligible: false, alumniOnly: true,
    capacity: 150, registeredCount: 42, ticketPrice: 1200, published: true,
    coverImage: null, viewerRegistration: null,
  },
  {
    id: 'evt-5', slug: 'ece-vlsi-workshop', title: 'VLSI Design Workshop',
    description: 'Two-day hands-on workshop run by ECE alumni working in semiconductor firms. Limited to 40 seats.',
    venue: 'VLSI Lab, ECE Block',
    startsAt: daysFromNow(25), endsAt: daysFromNow(26),
    departmentCode: 'ECE', studentEligible: true, alumniOnly: false,
    capacity: 40, registeredCount: 40, ticketPrice: 0, published: true,
    coverImage: null, viewerRegistration: null,
  },
  {
    id: 'evt-6', slug: 'convocation-2026', title: 'Convocation 2026',
    description: 'Degree ceremony for the graduating batch.',
    venue: 'Main Auditorium, DIET Campus',
    startsAt: daysFromNow(-22), endsAt: daysFromNow(-21.8),
    departmentCode: null, studentEligible: true, alumniOnly: false,
    capacity: 800, registeredCount: 612, ticketPrice: 0, published: true,
    coverImage: null, viewerRegistration: null,
  },
  {
    id: 'evt-7', slug: 'mech-alumni-lecture', title: 'Guest Lecture — Manufacturing at Scale',
    description: 'Draft. Speaker confirmed, date not fixed.',
    venue: 'MECH Seminar Hall',
    startsAt: daysFromNow(48), endsAt: null,
    departmentCode: 'MECH', studentEligible: true, alumniOnly: false,
    capacity: 90, registeredCount: 0, ticketPrice: 0, published: false,
    coverImage: null, viewerRegistration: null,
  },
];

export const EVENT_REGISTRATIONS: EventRegistration[] = (() => {
  const out: EventRegistration[] = [];
  let n = 0;
  for (const evt of EVENTS.filter((e) => e.published)) {
    const sample = pickN(SEED.members, Math.min(evt.registeredCount, 24));
    for (const m of sample) {
      out.push({
        id: `reg-${n++}`,
        eventId: evt.id,
        eventTitle: evt.title,
        memberId: m.id,
        memberName: m.fullName,
        batchYear: m.batchYear,
        guests: chance(0.3) ? int(1, 3) : 0,
        amountPaid: evt.ticketPrice,
        checkedInAt: new Date(evt.startsAt) < SEED_NOW && chance(0.8) ? evt.startsAt : null,
        createdAt: daysFromNow(-int(1, 30)),
      });
    }
  }
  return out;
})();

// ---------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------

export const JOBS: JobPosting[] = (() => {
  const templates: Array<Partial<JobPosting> & { title: string; company: string }> = [
    { title: 'Software Engineer I', company: 'Amazon', location: 'Hyderabad', experienceYears: '0–2 years', salaryRange: '₹18–24 LPA', skills: ['Java', 'AWS', 'Data Structures'], isInternship: false },
    { title: 'Associate Software Engineer', company: 'Infosys', location: 'Bengaluru / Hyderabad', experienceYears: 'Fresher', salaryRange: '₹4.5–6.5 LPA', skills: ['Java', 'SQL', 'Spring Boot'], isInternship: false },
    { title: 'Data Analyst Intern', company: 'PhonePe', location: 'Bengaluru (Hybrid)', experienceYears: 'Internship', salaryRange: '₹40,000/month', skills: ['SQL', 'Python', 'Power BI'], isInternship: true },
    { title: 'Embedded Software Engineer', company: 'Qualcomm', location: 'Hyderabad', experienceYears: '1–3 years', salaryRange: '₹16–22 LPA', skills: ['Embedded C', 'RTOS', 'ARM'], isInternship: false },
    { title: 'Site Engineer — Highways', company: 'L&T Construction', location: 'Vijayawada', experienceYears: '0–2 years', salaryRange: '₹4–6 LPA', skills: ['AutoCAD', 'Site Supervision', 'Quantity Surveying'], isInternship: false },
    { title: 'ML Engineer', company: 'Freshworks', location: 'Chennai', experienceYears: '2–4 years', salaryRange: '₹22–30 LPA', skills: ['Python', 'PyTorch', 'MLOps'], isInternship: false },
    { title: 'ServiceNow Developer', company: 'ifBash', location: 'Remote (India)', experienceYears: '1–4 years', salaryRange: '₹9–18 LPA', skills: ['ServiceNow', 'JavaScript', 'ITSM'], isInternship: false },
    { title: 'QA Automation Engineer', company: 'Cognizant', location: 'Hyderabad', experienceYears: '1–3 years', salaryRange: '₹6–10 LPA', skills: ['Selenium', 'Java', 'TestNG'], isInternship: false },
    { title: 'Design Engineer — Powertrain', company: 'Ashok Leyland', location: 'Chennai', experienceYears: '0–2 years', salaryRange: '₹5–7 LPA', skills: ['CATIA', 'GD&T', 'ANSYS'], isInternship: false },
    { title: 'Backend Engineer', company: 'Razorpay', location: 'Bengaluru', experienceYears: '2–5 years', salaryRange: '₹25–38 LPA', skills: ['Go', 'PostgreSQL', 'Microservices'], isInternship: false },
    { title: 'Summer Intern — VLSI', company: 'Intel', location: 'Bengaluru', experienceYears: 'Internship', salaryRange: '₹60,000/month', skills: ['Verilog', 'VLSI', 'Python'], isInternship: true },
    { title: 'Consultant — Technology', company: 'Deloitte', location: 'Hyderabad', experienceYears: '1–3 years', salaryRange: '₹9–14 LPA', skills: ['SQL', 'Business Analysis', 'Power BI'], isInternship: false },
  ];

  const states: JobPosting['state'][] = ['live', 'live', 'live', 'live', 'live', 'live', 'live', 'live', 'pending_moderation', 'pending_moderation', 'closed', 'rejected'];

  return templates.map((t, i) => {
    const poster = SEED.alumni[int(10, 60)]!;
    const state = states[i]!;
    return {
      id: `job-${i}`,
      title: t.title,
      company: t.company,
      location: t.location ?? null,
      isInternship: t.isInternship ?? false,
      description:
        `${t.title} at ${t.company}.\n\n` +
        `We are hiring from the DIET network. ${t.isInternship ? 'Six-month internship with a pre-placement offer for strong performers.' : 'Full-time role, immediate joiners preferred.'}\n\n` +
        `What we look for: solid fundamentals, evidence you have built something end to end, and the ability to explain a decision you got wrong.\n\n` +
        `Referrals from this posting go straight to the hiring manager — apply here rather than through the careers portal.`,
      applyUrl: chance(0.5) ? `https://careers.example.com/${t.company.toLowerCase().replace(/\s+/g, '-')}/${i}` : null,
      state,
      closesOn: state === 'closed' ? daysFromNow(-int(2, 30)) : daysFromNow(int(10, 60)),
      createdAt: daysFromNow(-int(1, 45)),
      experienceYears: t.experienceYears ?? null,
      salaryRange: t.salaryRange ?? null,
      skills: t.skills ?? [],
      postedBy: toSummary(poster),
      applicationCount: state === 'live' ? int(0, 34) : 0,
      viewerHasApplied: false,
      moderationNote: state === 'rejected' ? 'Posting is a third-party staffing listing, not a direct opening. Placement cell policy is direct employers only.' : null,
    };
  });
})();

export const JOB_APPLICATIONS: JobApplication[] = (() => {
  const out: JobApplication[] = [];
  let n = 0;
  for (const job of JOBS.filter((j) => j.state === 'live')) {
    for (const s of pickN(SEED.students, Math.min(job.applicationCount, 12))) {
      out.push({
        id: `app-${n++}`,
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        note: chance(0.5) ? 'Final-year CSE. Built a payments sandbox as my capstone; happy to walk through the design.' : null,
        createdAt: daysFromNow(-int(0, 20)),
        applicant: toSummary(s),
      });
    }
  }
  return out;
})();

// ---------------------------------------------------------------
// Connections
// ---------------------------------------------------------------

export const CONNECTIONS: ConnectionRequest[] = (() => {
  const out: ConnectionRequest[] = [];
  const states: ConnectionRequest['state'][] = [
    'pending', 'pending', 'pending', 'accepted', 'accepted', 'accepted', 'accepted', 'declined', 'expired', 'withdrawn',
  ];

  const messages = [
    'Hello sir, I am a final-year CSE student. I saw you work at Amazon — could you tell me what to focus on for the online assessment? I have four weeks.',
    'Hi, I am applying to the same team next month. Would you be willing to look at my resume before I submit?',
    'Namaste. I am from the 2027 batch, ECE. Could I ask you about switching from core to software after graduation?',
    'Hello, I am organising the CSE Industry Connect session and would like to invite you to speak. It is a two-hour slot on a Saturday.',
    'Hi, I graduated two years after you from the same branch. Could we talk about the higher-studies route to Germany?',
    null,
  ];

  for (let i = 0; i < 46; i++) {
    const state = states[i % states.length]!;
    const isStudentSender = chance(0.7);
    const from = isStudentSender ? SEED.students[int(0, SEED.students.length - 1)]! : SEED.alumni[int(10, 200)]!;
    const to = SEED.alumni[int(10, 200)]!;
    if (from.id === to.id) continue;

    const createdAt = daysFromNow(-int(0, 90));
    out.push({
      id: `conn-${i}`,
      kind: pick(['mentorship', 'mentorship', 'referral', 'introduction', 'speaking'] as const),
      state,
      message: pick(messages),
      createdAt,
      respondedAt: state === 'pending' ? null : daysFromNow(-int(0, 40)),
      expiresAt: state === 'pending' ? daysFromNow(int(3, 25)) : null,
      from: toSummary(from),
      to: toSummary(to),
    });
  }

  return out;
})();

// ---------------------------------------------------------------
// Donations — present in data, gated off in the UI until FCRA is confirmed
// ---------------------------------------------------------------

export const CAMPAIGNS: DonationCampaign[] = [
  {
    id: 'camp-1', slug: 'library-modernisation', title: 'Library Modernisation Fund',
    description: 'Digital catalogue, 40 reading terminals, and a two-year IEEE and ACM subscription for the central library.',
    target: 2500000, raised: 1418500, donorCount: 143,
    startsOn: daysFromNow(-120), endsOn: daysFromNow(90), active: true, coverImage: null,
  },
  {
    id: 'camp-2', slug: 'merit-scholarship', title: 'Alumni Merit Scholarship',
    description: 'Full tuition for eight students per year, selected on merit and family income by a committee that includes two alumni.',
    target: 1800000, raised: 1802000, donorCount: 96,
    startsOn: daysFromNow(-300), endsOn: daysFromNow(-10), active: false, coverImage: null,
  },
  {
    id: 'camp-3', slug: 'incubation-lab', title: 'Student Incubation Lab',
    description: 'Seed equipment and a mentor stipend for the student startup cell.',
    target: 900000, raised: 217000, donorCount: 31,
    startsOn: daysFromNow(-45), endsOn: daysFromNow(135), active: true, coverImage: null,
  },
];

export const DONATIONS: Donation[] = (() => {
  const out: Donation[] = [];
  for (let i = 0; i < 68; i++) {
    const donor = SEED.alumni[int(0, SEED.alumni.length - 1)]!;
    const foreign = donor.country !== 'IN';
    const camp = pick(CAMPAIGNS);
    out.push({
      id: `don-${i}`,
      campaignTitle: camp.title,
      donorName: donor.fullName,
      amount: pick([1000, 2500, 5000, 10000, 11000, 25000, 50000, 100000]),
      currency: 'INR',
      sourceCountry: donor.country,
      // FCRA segregation is structural, recorded at the point of
      // collection — not a report someone runs later.
      isForeignContribution: foreign,
      state: pick(['succeeded', 'succeeded', 'succeeded', 'succeeded', 'initiated', 'failed', 'refunded'] as const),
      gatewayRef: `pay_${Math.floor(rand() * 1e14).toString(36)}`,
      receipt80gNo: chance(0.6) ? `80G/2026/${1000 + i}` : null,
      createdAt: daysFromNow(-int(0, 300)),
    });
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
})();

// ---------------------------------------------------------------
// Audit, DPDP, notifications
// ---------------------------------------------------------------

export const AUDIT_LOG: AuditEntry[] = (() => {
  const actions: Array<[string, string, string | null]> = [
    ['member.verify', 'member', 'Approved against degree register, confidence 0.94'],
    ['member.reject', 'member', 'No matching roll number in the register'],
    ['member.export', 'member', 'NAAC criterion 5 submission — 1,214 rows, contact fields included'],
    ['role.grant', 'member_role', 'Appointed HOD, CSE'],
    ['role.revoke', 'member_role', 'Left the institution'],
    ['branding.publish', 'tenant_branding', null],
    ['degree_register.import', 'degree_register', '2019 batch, 612 rows, 4 rejected'],
    ['job.moderate', 'job_posting', 'Third-party staffing listing'],
    ['event.create', 'event', null],
    ['comms.send', 'campaign', 'Reunion invite — 8,142 recipients'],
    ['rollover.execute', 'member', 'Batch of 2026 promoted to alumni — 388 rows'],
    ['data_request.fulfil', 'data_request', 'DPDP export delivered'],
    ['member.merge', 'member', 'Duplicate account from Hoopstr import'],
    ['tenant.configure', 'tenant', null],
  ];

  const actors: Array<[string, Role]> = [
    ['Dr. Padmaja Vemulapalli', 'college_admin'],
    ['Sridevi Kandula', 'alumni_cell_operator'],
    ['Dr. Ramesh Chalasani', 'hod'],
    ['Srinivas Gollapudi', 'placement_officer'],
    ['Anjaneyulu Bandaru', 'finance'],
  ];

  return Array.from({ length: 84 }, (_, i) => {
    const [action, resource, reason] = actions[i % actions.length]!;
    const [actorName, actorRole] = actors[i % actors.length]!;
    return {
      id: `audit-${i}`,
      actorName,
      actorRole,
      action,
      resource,
      resourceId: `${resource}-${int(1, 400)}`,
      reason,
      ip: `49.207.${int(0, 255)}.${int(1, 254)}`,
      createdAt: daysFromNow(-i * 0.4 - rand()),
      before: action.includes('verify') ? { status: 'pending' } : null,
      after: action.includes('verify') ? { status: 'active_alumni' } : null,
    };
  });
})();

export const DATA_REQUESTS: DataRequest[] = Array.from({ length: 9 }, (_, i) => {
  const m = SEED.alumni[int(0, SEED.alumni.length - 1)]!;
  const kind = pick(['export', 'export', 'export', 'deletion', 'correction'] as const);
  const createdAt = daysFromNow(-int(0, 40));
  return {
    id: `dr-${i}`,
    memberId: m.id,
    memberName: m.fullName,
    kind,
    state: pick(['received', 'in_progress', 'fulfilled', 'fulfilled'] as const),
    createdAt,
    fulfilledAt: chance(0.5) ? daysFromNow(-int(0, 10)) : null,
    // 30 days from receipt. Shown as a countdown so a request cannot
    // quietly age past the statutory window.
    dueAt: new Date(new Date(createdAt).getTime() + 30 * 86400000).toISOString(),
  };
});

/**
 * Notifications, owned.
 *
 * Every row names the member it belongs to. The connection notification
 * is addressed to the alumnus being asked, not to whoever happens to be
 * signed in — which was the bug: the list had no owner, so the vendor's
 * platform admin saw a named final-year student's mentorship request on
 * every page of the console.
 *
 * The system notice is the one thing that genuinely goes to everybody,
 * and it is fanned out per member rather than left ownerless, because
 * "this row has no owner" is precisely the shape the bug had.
 */
export const NOTIFICATIONS: NotificationItem[] = (() => {
  const demoAlumnus = SEED.alumni[9]!;   // alumni@example.com
  const demoStudent = SEED.students[0]!; // student@diet.ac.in

  const owned: NotificationItem[] = [
    { id: 'n-1', memberId: demoAlumnus.id, kind: 'connection', title: 'Harika Nallamothu wants to connect', body: 'Final-year CSE student asking about interview preparation.', href: '/connections', readAt: null, createdAt: daysFromNow(-0.2) },
    { id: 'n-2', memberId: demoAlumnus.id, kind: 'event', title: 'CSE Industry Connect is in 11 days', body: 'You are registered. Seminar Hall 2, 10:00 AM.', href: '/events/cse-industry-connect', readAt: null, createdAt: daysFromNow(-1) },
    { id: 'n-3', memberId: demoAlumnus.id, kind: 'job', title: 'Your posting was approved', body: 'ServiceNow Developer at ifBash is now live in the jobs board.', href: '/jobs', readAt: daysFromNow(-2), createdAt: daysFromNow(-2.5) },
    { id: 'n-4', memberId: demoStudent.id, kind: 'verification', title: 'Your account is verified', body: 'Matched against the degree register. Full directory access is open.', href: '/directory', readAt: daysFromNow(-30), createdAt: daysFromNow(-31) },
    { id: 'n-5', memberId: demoStudent.id, kind: 'connection', title: 'Vamsi Krishna Pothineni accepted your request', body: 'Their contact details are now visible on their profile.', href: '/connections', readAt: null, createdAt: daysFromNow(-2) },
  ];

  // The privacy notice reaches every member, addressed individually.
  const systemNotice = SEED.members.map((m, i) => ({
    id: `n-sys-${i}`,
    memberId: m.id,
    kind: 'system' as const,
    title: 'Privacy notice updated',
    body: 'Version 2026-08-01. Review what the college holds about you.',
    href: '/settings/privacy',
    readAt: null,
    createdAt: daysFromNow(-6),
  }));

  return [...owned, ...systemNotice];
})();

// ---------------------------------------------------------------
// Tenants — the platform-admin view
// ---------------------------------------------------------------

export const TENANTS: TenantSummary[] = [
  {
    id: 'ten-diet', name: 'Dhanekula Institute of Engineering & Technology', shortName: 'DIET',
    subdomain: 'diet', packId: 'diet', established: 2009,
    memberCount: SEED.members.length, alumniCount: SEED.alumni.length, studentCount: SEED.students.length,
    verifiedCount: SEED.members.length, fcraRegistered: false,
    createdAt: daysFromNow(-210), plan: 'institution', status: 'active',
  },
  {
    id: 'ten-demo', name: 'ifBash Demo College', shortName: 'Demo',
    subdomain: 'demo', packId: 'ifbash', established: 2020,
    memberCount: 420, alumniCount: 300, studentCount: 120, verifiedCount: 288, fcraRegistered: false,
    createdAt: daysFromNow(-60), plan: 'trial', status: 'active',
  },
  // Prospects, not customers. They exist so the platform console has a
  // realistic spread of states to render — a trial mid-evaluation and one
  // still provisioning — and so the branding studio has packs to switch
  // between during a demo.
  {
    id: 'ten-svu', name: 'Sri Vydehi University', shortName: 'SVU',
    subdomain: 'srivarsity', packId: 'srivarsity', established: 1994,
    memberCount: 1840, alumniCount: 1602, studentCount: 238, verifiedCount: 1204, fcraRegistered: true,
    createdAt: daysFromNow(-24), plan: 'standard', status: 'active',
  },
  {
    id: 'ten-ngp', name: 'Northgate Polytechnic', shortName: 'NGP',
    subdomain: 'northgate', packId: 'northgate', established: 1978,
    memberCount: 0, alumniCount: 0, studentCount: 0, verifiedCount: 0, fcraRegistered: false,
    createdAt: daysFromNow(-2), plan: 'trial', status: 'provisioning',
  },
];

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

export function toSummary(m: SeedMember): MemberSummary {
  return {
    id: m.id,
    slug: m.slug,
    fullName: m.fullName,
    photoUrl: m.photoUrl,
    batchYear: m.batchYear,
    departmentCode: m.departmentCode,
    departmentName: m.departmentName,
    currentCompany: m.currentCompany,
    designation: m.designation,
    industry: m.industry,
    city: m.city,
    state: m.state,
    country: m.country,
    skills: m.skills,
    openToMentoring: m.openToMentoring,
    openToReferrals: m.openToReferrals,
    openToSpeaking: m.openToSpeaking,
    status: m.status,
    isStudent: m.isStudent,
  };
}
