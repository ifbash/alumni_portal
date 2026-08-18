'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, ShieldCheck } from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardDescription,
  CardTitle,
  Checkbox,
  Field,
  FormActions,
  Input,
  Select,
  Switch,
  Textarea,
  describedBy,
  useToast,
} from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';

/**
 * The posting form.
 *
 * Client-side because the internship toggle, the skill chips and the
 * required-field errors all need to respond before a round trip.
 *
 * It submits to `POST /api/jobs`, which puts every new posting into
 * `pending_moderation` — there is no request parameter that skips the
 * queue. Two consequences are designed for rather than tolerated:
 *
 *  1. **A submitted posting must never look lost.** On a real write the
 *     poster is taken straight to their posting, where its state reads
 *     "with the placement cell" in the header. A form that clears itself
 *     and says nothing is why people stop posting.
 *  2. **The server's rules are the rules.** The checks below are here to
 *     save a round trip, not to be the authority — anything the API
 *     refuses comes back as a field error and lands on the field that
 *     caused it.
 */

const EXPERIENCE_OPTIONS = [
  'Fresher',
  'Internship',
  '0–2 years',
  '1–3 years',
  '2–5 years',
  '5–8 years',
  '8+ years',
];

const DESCRIPTION_MAX = 4000;
/** The API's floor, repeated here so the refusal arrives before the round trip. */
const DESCRIPTION_MIN = 80;

/** API field name → the field on this form that owns the error. */
const SERVER_FIELD: Record<string, keyof FormState> = {
  title: 'title',
  company: 'company',
  location: 'location',
  isInternship: 'isInternship',
  description: 'description',
  applyUrl: 'applyUrl',
  closesOn: 'closesOn',
  experienceYears: 'experience',
  salaryRange: 'salary',
  skills: 'skills',
};

interface CreatedJob {
  job: {
    id: string;
    title: string;
    company: string;
    state: 'pending_moderation';
  };
  note: string;
}

interface FormState {
  title: string;
  company: string;
  location: string;
  isInternship: boolean;
  experience: string;
  salary: string;
  skills: string;
  description: string;
  applyUrl: string;
  closesOn: string;
  confirmed: boolean;
}

export function JobForm({
  defaultCompany,
  posterName,
  shortName,
  supportEmail,
}: {
  defaultCompany: string;
  posterName: string;
  shortName: string;
  supportEmail: string | null;
}) {
  const toast = useToast();
  const router = useRouter();

  const [form, setForm] = React.useState<FormState>({
    title: '',
    company: defaultCompany,
    location: '',
    isInternship: false,
    experience: '',
    salary: '',
    skills: '',
    description: '',
    applyUrl: '',
    closesOn: '',
    confirmed: false,
  });

  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [submitted, setSubmitted] = React.useState<{ note: string; persisted: boolean } | null>(
    null,
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const skills = form.skills
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;

    const next: Partial<Record<keyof FormState, string>> = {};
    if (form.title.trim().length < 4) {
      next.title = 'A student scanning the board reads this first. Name the role as the company advertises it.';
    }
    if (form.company.trim().length < 2) {
      next.company = 'The cell will not publish a posting with no employer on it.';
    }
    if (form.description.trim().length < DESCRIPTION_MIN) {
      next.description =
        'Write at least a couple of lines — the cell sends back anything shorter than about eighty characters. Say what the work is and what you screen for.';
    }
    if (form.applyUrl.trim() && !/^(https:\/\/|mailto:)/i.test(form.applyUrl.trim())) {
      next.applyUrl = 'Use an https:// link or a mailto: address.';
    }
    if (!form.confirmed) {
      next.confirmed = 'The cell rejects agency listings on sight. Confirm this is a direct opening.';
    }

    setErrors(next);
    setFormError(null);

    if (Object.keys(next).length > 0) {
      toast.error('Some fields need attention', 'Nothing has been submitted.');
      return;
    }

    const blank = (v: string) => (v.trim() ? v.trim() : null);

    setBusy(true);
    const outcome = await api.post<CreatedJob>('/api/jobs', {
      title: form.title.trim(),
      company: form.company.trim(),
      location: blank(form.location),
      isInternship: form.isInternship,
      description: form.description.trim(),
      applyUrl: blank(form.applyUrl),
      closesOn: blank(form.closesOn),
      experienceYears: blank(form.experience),
      salaryRange: blank(form.salary),
      skills,
    });
    setBusy(false);

    if (outcome.status === 'invalid') {
      // Land each refusal on the field that caused it. Anything the form
      // has no field for — a skill entry, say — is said above the actions
      // rather than swallowed.
      const mapped: Partial<Record<keyof FormState, string>> = {};
      const spare: string[] = [];

      for (const [key, message] of Object.entries(outcome.fieldErrors)) {
        const field = SERVER_FIELD[key.split('.')[0] ?? key];
        if (field) mapped[field] = message;
        else spare.push(message);
      }

      setErrors(mapped);
      setFormError(spare.length ? spare.join(' ') : Object.keys(mapped).length ? null : outcome.message);

      const t = outcomeToast(outcome, '');
      if (t) toast.show(t);
      return;
    }

    if (outcome.status !== 'ok') {
      setFormError(outcome.message);
      const t = outcomeToast(outcome, '');
      if (t) toast.show(t);
      return;
    }

    setSubmitted({ note: outcome.data.note, persisted: outcome.persisted });

    const t = outcomeToast(outcome, 'Submitted to the placement cell');
    if (t) toast.show(t);

    // A real write means the posting exists and can be opened. Go to it:
    // seeing the row, marked "with the placement cell", is the difference
    // between "submitted" and "vanished".
    if (outcome.persisted) {
      router.push(`/jobs/${outcome.data.job.id}`);
      router.refresh();
    }
  };

  if (submitted) {
    return (
      <div className="space-y-4">
        {submitted.persisted ? (
          <Alert
            tone="success"
            title="Submitted — it is with the placement cell"
            icon={<ShieldCheck className="size-4" />}
          >
            <p>{submitted.note}</p>
            <p className="mt-2">
              Opening your posting now. It sits in your{' '}
              <span className="font-medium">My postings</span> tab marked{' '}
              <span className="font-medium">with the placement cell</span> until they publish it —
              it is not lost and it is not public.
            </p>
          </Alert>
        ) : (
          <Alert
            tone="info"
            title="Checked and refused a write — nothing was stored"
            icon={<ShieldCheck className="size-4" />}
          >
            <p>
              Your posting has not reached the placement cell. This build runs on seeded data with
              no database behind it: the capability check, the daily posting limit, the closing-date
              check and the audit entry all ran on the server, and the write did not.
            </p>
            <p className="mt-2">
              With a store behind it, the posting is created in{' '}
              <span className="font-medium">with the placement cell</span> state — never live — and
              you are taken straight to it, so it never looks as though it vanished.
              {supportEmail ? (
                <>
                  {' '}
                  Until then, email the details to{' '}
                  <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
                </>
              ) : null}
            </p>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle as="h2">What you filled in</CardTitle>
            <CardDescription>
              {submitted.persisted
                ? 'This is the posting the cell has received.'
                : 'This is the posting the cell would have received.'}
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-4 pt-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {form.isInternship ? <Badge tone="accent">Internship</Badge> : null}
                <Badge tone="warning" dot>
                  With the placement cell
                </Badge>
              </div>
              <h3 className="mt-2 font-display text-lg font-semibold">{form.title}</h3>
              <p className="text-sm text-secondary">
                {[form.company, form.location].filter(Boolean).join(' · ')}
              </p>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <Summary label="Experience" value={form.experience} />
              <Summary label="Compensation" value={form.salary} />
              <Summary label="Closes on" value={form.closesOn} />
              <Summary label="External link" value={form.applyUrl} />
            </dl>

            {skills.length ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Skills</p>
                <ul className="mt-1.5 flex flex-wrap gap-1">
                  {skills.map((s) => (
                    <li key={s}>
                      <Badge tone="outline">{s}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Description</p>
              <div className="mt-1.5 max-w-prose whitespace-pre-line text-sm leading-relaxed text-secondary">
                {form.description}
              </div>
            </div>

            <p className="text-xs text-muted">
              {submitted.persisted
                ? `Posted as ${posterName}. It carries ${shortName}'s name once the cell publishes it.`
                : `Would be posted as ${posterName}, and would carry ${shortName}'s name once published.`}
            </p>
          </CardBody>
        </Card>

        <FormActions className="justify-start">
          <ButtonLink href="/jobs?tab=mine" variant="secondary">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to my postings
          </ButtonLink>
          {submitted.persisted ? null : (
            <Button variant="ghost" onClick={() => setSubmitted(null)}>
              Edit what I wrote
            </Button>
          )}
        </FormActions>
      </div>
    );
  }

  return (
    <Card as="section">
      <CardHeader>
        <CardTitle as="h2">The opening</CardTitle>
        <CardDescription>
          Everything except the description is optional, but a posting with a pay band and a
          location gets several times the applications of one without.
        </CardDescription>
      </CardHeader>

      <CardBody>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <Field
            htmlFor="job-title"
            label="Role title"
            required
            hint="How the company advertises it — “Software Engineer I”, not “good coder wanted”."
            error={errors.title}
          >
            <Input
              id="job-title"
              name="title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              invalid={Boolean(errors.title)}
              aria-describedby={describedBy('job-title', { hint: true, error: Boolean(errors.title) })}
              placeholder="Associate Software Engineer"
              autoComplete="off"
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              htmlFor="job-company"
              label="Company"
              required
              hint="Prefilled from your profile. Change it if you are referring elsewhere."
              error={errors.company}
            >
              <Input
                id="job-company"
                name="company"
                value={form.company}
                onChange={(e) => set('company', e.target.value)}
                invalid={Boolean(errors.company)}
                aria-describedby={describedBy('job-company', { hint: true, error: Boolean(errors.company) })}
                placeholder="Infosys"
                autoComplete="organization"
              />
            </Field>

            <Field
              htmlFor="job-location"
              label="Location"
              hint="City, or “Remote (India)”. Write “Bengaluru / Hyderabad” if there is a choice."
              error={errors.location}
            >
              <Input
                id="job-location"
                name="location"
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                invalid={Boolean(errors.location)}
                aria-describedby={describedBy('job-location', {
                  hint: true,
                  error: Boolean(errors.location),
                })}
                placeholder="Hyderabad"
              />
            </Field>
          </div>

          <div className="rounded-lg border border-line bg-surface-sunken p-4">
            <Switch
              id="job-internship"
              label="This is an internship"
              hint="Internships are filtered separately on the board — final-years look for them by name."
              checked={form.isInternship}
              onChange={(e) => set('isInternship', e.target.checked)}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              htmlFor="job-experience"
              label="Experience"
              hint="What the company will actually screen on."
            >
              <Select
                id="job-experience"
                name="experience"
                value={form.experience}
                onChange={(e) => set('experience', e.target.value)}
                aria-describedby="job-experience-hint"
              >
                <option value="">Not specified</option>
                {EXPERIENCE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              htmlFor="job-salary"
              label="Compensation"
              hint="“₹6–9 LPA” or “₹40,000 per month”. A band beats “as per industry standards”."
              error={errors.salary}
            >
              <Input
                id="job-salary"
                name="salary"
                value={form.salary}
                onChange={(e) => set('salary', e.target.value)}
                invalid={Boolean(errors.salary)}
                aria-describedby={describedBy('job-salary', {
                  hint: true,
                  error: Boolean(errors.salary),
                })}
                placeholder="₹6–9 LPA"
              />
            </Field>
          </div>

          <Field
            htmlFor="job-skills"
            label="Skills screened for"
            hint="Comma separated. Four or five is plenty — a list of twenty stops students applying."
            error={errors.skills}
          >
            <Input
              id="job-skills"
              name="skills"
              value={form.skills}
              onChange={(e) => set('skills', e.target.value)}
              invalid={Boolean(errors.skills)}
              aria-describedby={describedBy('job-skills', {
                hint: true,
                error: Boolean(errors.skills),
              })}
              placeholder="Java, Spring Boot, SQL"
            />
          </Field>

          {skills.length ? (
            <ul className="-mt-3 flex flex-wrap gap-1" aria-label="Skills as they will be listed">
              {skills.map((s) => (
                <li key={s}>
                  <Badge tone="outline">{s}</Badge>
                </li>
              ))}
            </ul>
          ) : null}

          <Field
            htmlFor="job-description"
            label="Description"
            required
            hint="What the team does, what the role involves, and what you screen for. Line breaks are kept exactly as you type them."
            error={errors.description}
          >
            <Textarea
              id="job-description"
              name="description"
              rows={9}
              maxLength={DESCRIPTION_MAX}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              invalid={Boolean(errors.description)}
              aria-describedby={describedBy('job-description', {
                hint: true,
                error: Boolean(errors.description),
              })}
              placeholder={
                'We are hiring for the payments platform team.\n\n' +
                'What you would work on: the reconciliation service, mostly Java and PostgreSQL.\n\n' +
                'What we screen for: fundamentals, one thing you have built end to end, and the ability to explain a decision you got wrong.'
              }
            />
          </Field>
          <p className="-mt-3 text-right text-xs tabular text-muted">
            {form.description.length} / {DESCRIPTION_MAX}
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              htmlFor="job-apply-url"
              label="Company application link"
              hint="Optional. Students can still apply through the portal, which is how you know they are from here."
              error={errors.applyUrl}
            >
              <Input
                id="job-apply-url"
                name="applyUrl"
                type="url"
                inputMode="url"
                value={form.applyUrl}
                onChange={(e) => set('applyUrl', e.target.value)}
                invalid={Boolean(errors.applyUrl)}
                aria-describedby={describedBy('job-apply-url', {
                  hint: true,
                  error: Boolean(errors.applyUrl),
                })}
                placeholder="https://careers.example.com/req/12345"
              />
            </Field>

            <Field
              htmlFor="job-closes"
              label="Closes on"
              hint="Leave empty for “open until filled”. A date that has already passed is refused."
              error={errors.closesOn}
            >
              <Input
                id="job-closes"
                name="closesOn"
                type="date"
                value={form.closesOn}
                onChange={(e) => set('closesOn', e.target.value)}
                invalid={Boolean(errors.closesOn)}
                aria-describedby={describedBy('job-closes', {
                  hint: true,
                  error: Boolean(errors.closesOn),
                })}
              />
            </Field>
          </div>

          <div
            className={
              errors.confirmed
                ? 'rounded-lg border border-danger bg-danger-soft p-4'
                : 'rounded-lg border border-line bg-surface-sunken p-4'
            }
          >
            <Checkbox
              id="job-confirm"
              checked={form.confirmed}
              onChange={(e) => set('confirmed', e.target.checked)}
              label="This is a direct opening at the company named above"
              hint="I am hiring for it, or I can refer for it from inside. It is not a staffing-agency listing and no candidate will be asked for money."
            />
            {errors.confirmed ? (
              <p role="alert" className="mt-2 flex gap-1.5 text-xs font-medium text-danger-fg">
                <span aria-hidden="true">⚠</span>
                <span>{errors.confirmed}</span>
              </p>
            ) : null}
          </div>

          {formError ? (
            <Alert tone="danger" title="This was not submitted">
              <p>{formError}</p>
            </Alert>
          ) : null}

          <FormActions>
            <ButtonLink href="/jobs" variant="ghost">
              Cancel
            </ButtonLink>
            <Button type="submit" loading={busy}>
              <Send className="size-4" aria-hidden="true" />
              Submit for review
            </Button>
          </FormActions>
        </form>
      </CardBody>
    </Card>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="break-words text-sm">{value.trim() ? value : <span className="text-muted">Not stated</span>}</dd>
    </div>
  );
}
