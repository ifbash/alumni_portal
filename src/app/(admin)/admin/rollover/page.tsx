import { redirect } from 'next/navigation';
import { CalendarCheck2, GraduationCap, History, Mail, ScrollText, ShieldAlert } from 'lucide-react';

import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  DetailRow,
  PageHeader,
  Section,
  Stat,
} from '@/components/ui';
import { getSession, getSessionMember } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getDepartments, getMembersForAdmin, searchDegreeRegister } from '@/lib/data/repo';
import { formatDate, formatNumber } from '@/lib/format';
import { RolloverRunner, type BatchPreview } from './RolloverRunner';

export const metadata = { title: 'Annual rollover' };

/** Previous runs. Kept visible because a rollover is a once-a-year action nobody remembers doing. */
const PAST_RUNS = [
  { year: 2025, at: '2025-09-12T10:20:00+05:30', moved: 198, actor: 'Dr. Padmaja Vemulapalli' },
  { year: 2024, at: '2024-09-04T15:05:00+05:30', moved: 211, actor: 'Dr. Padmaja Vemulapalli' },
];

export default async function RolloverPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  requireCap(session, 'rollover.execute');

  const { member } = await getSessionMember();
  const departments = getDepartments();

  const students = getMembersForAdmin({ status: 'active_student', perPage: 5000 }).items;

  // Roll numbers the examinations branch has actually supplied. A student
  // whose roll is not in the register still rolls over — they are simply
  // marked as verified by the rollover rather than by the register, and
  // the alumni cell can re-verify once the batch file lands.
  const registerRolls = new Set(
    searchDegreeRegister('', { perPage: 100000 }).items.map((r) => r.rollNumber.toUpperCase()),
  );

  const years = [...new Set(students.map((s) => s.batchYear).filter((y): y is number => y !== null))].sort();

  const batches: BatchPreview[] = years.map((year) => {
    const cohort = students.filter((s) => s.batchYear === year);

    const byDept = new Map<string, number>();
    for (const s of cohort) {
      const code = s.departmentCode ?? 'Unrecorded';
      byDept.set(code, (byDept.get(code) ?? 0) + 1);
    }

    return {
      year,
      total: cohort.length,
      departments: [...byDept.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([code, count]) => ({
          code,
          name: departments.find((d) => d.code === code)?.name ?? 'Branch not recorded',
          count,
        })),
      // Every student account is on a college mailbox that is deactivated
      // shortly after they leave. This is the single biggest cause of a
      // dead alumni list, and the rollover is the last moment anyone can
      // do something about it.
      collegeEmailOnly: cohort.filter((s) => (s.contact?.email ?? '').toLowerCase().endsWith('@diet.ac.in')).length,
      withRegisterRow: cohort.filter((s) => s.rollNumber && registerRolls.has(s.rollNumber.toUpperCase())).length,
      sample: cohort.slice(0, 8).map((s) => ({
        name: s.fullName,
        roll: s.rollNumber ?? '—',
        department: s.departmentCode ?? '—',
      })),
    };
  });

  const nextBatch = batches[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Identity"
        title="Annual rollover"
        description="Moves a graduating batch from student to alumnus. One batch at a time, triggered by a person, previewed before it runs, and written to the audit log with the before and after snapshot."
      />

      <Alert tone="warning" title="This never runs on its own" icon={<ShieldAlert className="size-4" />}>
        <p>
          There is no scheduled job and no trigger tied to a date. A rollover happens when a college admin runs it,
          after the results are out and the batch has actually graduated — which in Andhra Pradesh is rarely the month
          anyone expects. Running it early turns final-years into alumni, which changes what they can see, how many
          people they may contact, and whether the giving module appears for them.
        </p>
      </Alert>

      <div className="grid gap-gutter sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Students on the portal"
          value={formatNumber(students.length)}
          hint={`${batches.length} batch${batches.length === 1 ? '' : 'es'} present`}
          icon={<GraduationCap className="size-4" />}
        />
        <Stat
          label="Next batch out"
          value={nextBatch ? nextBatch.year : '—'}
          hint={nextBatch ? `${nextBatch.total} members would move` : 'No student cohort loaded'}
          icon={<CalendarCheck2 className="size-4" />}
        />
        <Stat
          label="On a college mailbox"
          value={nextBatch ? nextBatch.collegeEmailOnly : 0}
          hint="Lose the address, lose the account"
          icon={<Mail className="size-4" />}
        />
        <Stat
          label="Already in the register"
          value={nextBatch ? `${nextBatch.withRegisterRow} of ${nextBatch.total}` : '—'}
          hint="Degree rows supplied by the examinations branch"
          icon={<ScrollText className="size-4" />}
        />
      </div>

      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <RolloverRunner batches={batches} actorName={member?.fullName ?? 'You'} />

        <div className="space-y-gutter">
          <Card>
            <CardHeader>
              <div className="space-y-1">
                <CardTitle as="h2">What changes for a person</CardTitle>
                <CardDescription>Same row in the same table. Only the status and the roles move.</CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <dl className="divide-y divide-line">
                <DetailRow label="Status">
                  <span className="font-mono text-xs">active_student → active_alumni</span>
                </DetailRow>
                <DetailRow label="Roles">
                  <span className="font-mono text-xs">student → alumni</span>
                  <span className="mt-1 block text-xs font-normal text-secondary">
                    Any other role a person holds — faculty, HOD — is untouched.
                  </span>
                </DetailRow>
                <DetailRow label="Directory">
                  Appears in the alumni cohort, and becomes searchable by the students still on campus.
                </DetailRow>
                <DetailRow label="Request quota">
                  <span className="tabular">5 open / 10 a month → 25 open / 60 a month</span>
                </DetailRow>
                <DetailRow label="Gains">Posting jobs, receiving mentorship requests, the giving module.</DetailRow>
                <DetailRow label="Loses">
                  Student-only events, and the placement cell&rsquo;s view of their CGPA and placement status — that
                  data stays placement-side and is never exposed to the alumni network.
                </DetailRow>
                <DetailRow label="Untouched">
                  Contact details, visibility settings, consent records, connections and every past registration.
                </DetailRow>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="space-y-1">
                <CardTitle as="h2">Previous rollovers</CardTitle>
                <CardDescription>Once a year, by a named person.</CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <ul className="space-y-3">
                {PAST_RUNS.map((r) => (
                  <li key={r.year} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium tabular">Batch of {r.year}</p>
                      <p className="text-xs text-secondary">
                        {r.actor} · {formatDate(r.at)}
                      </p>
                    </div>
                    <Badge tone="neutral">
                      <History className="size-3.5" aria-hidden="true" />
                      {r.moved} moved
                    </Badge>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-secondary">
                Both entries are reconstructed from <span className="font-mono">audit_log</span>. Nothing about a
                rollover happens outside it.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      <Section title="Why students are not a separate table">
        <Card>
          <CardBody className="max-w-prose space-y-3 text-sm text-secondary">
            <p>
              Students and alumni are one row each in <span className="font-mono">members</span>, keyed on roll number,
              separated by a status enum. The rollover flips the status and the role — it does not copy anything
              anywhere.
            </p>
            <p>
              The alternative, a <span className="font-mono">students</span> table beside an{' '}
              <span className="font-mono">alumni</span> table, makes every graduating batch a manual data migration with
              its own foreign-key repair job, and quietly breaks every connection, event registration and job
              application the person made while they were still on campus. It is the single decision that most often
              makes a college portal unmaintainable by its third year.
            </p>
          </CardBody>
        </Card>
      </Section>
    </div>
  );
}
