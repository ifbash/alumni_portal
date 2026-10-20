'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send } from 'lucide-react';

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
  Disclosure,
  Field,
  FormActions,
  Input,
  Select,
  Switch,
  Textarea,
  describedBy,
  useToast,
} from '@/components/ui';
import { JobTile, type JobTileData } from '../JobCard';
import { cn } from '@/lib/cn';
import type { LocaleSpec } from '@/lib/branding/pack';
import type { MemberSummary } from '@/lib/data/types';
import { api, outcomeToast } from '@/lib/client/api';

/**
 * The posting form, with the card students will see built live beside it.
 *
 * It submits to `POST /api/jobs`, which puts every new posting into
 * `pending_moderation` — there is no request parameter that skips the
 * queue. Two consequences are designed for rather than tolerated:
 *
 *  1. **A submitted posting must never look lost.** On a real write the
 *     poster is taken straight to their posting, where its state reads
 *     "with the placement cell". A form that clears itself and says
 *     nothing is why people stop posting.
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
  poster,
  shortName,
  locale,
  reviewLine,
}: {
  defaultCompany: string;
  /** Name, photo, branch and batch only — built on the server for the preview. */
  poster: MemberSummary;
  shortName: string;
  locale: LocaleSpec;
  /** "usually within two working days", or null when the college promises nothing. */
  reviewLine: string | null;
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

  // The card as students will see it, from what has been typed so far.
  const preview: JobTileData = {
    id: 'preview',
    title: form.title.trim() || 'Role title',
    company: form.company.trim() || 'Company',
    location: form.location.trim() || null,
    isInternship: form.isInternship,
    experienceYears: form.experience || null,
    salaryRange: form.salary.trim() || null,
    closesOn: form.closesOn || null,
    postedBy: poster,
    viewerHasApplied: false,
    skills,
    description: form.description.trim() || null,
  };

  const previewCard = (
    // `inert`: a picture of the card, not a second set of links.
    <div inert>
      <JobTile job={preview} href="/jobs" locale={locale} showPoster />
    </div>
  );

  const steps = <ReviewSteps reviewLine={reviewLine} />;

  if (submitted) {
    return (
      <div className="max-w-2xl space-y-4">
        {/* Fixture honesty is the Demo data marker and the toast, not this panel. */}
        <Alert tone="success" title="Submitted. It is with the placement cell.">
          <p>
            {submitted.persisted
              ? 'Opening your posting now. You can follow it under My postings.'
              : 'The placement cell checks it before members see it.'}
          </p>
        </Alert>

        <Card>
          <CardHeader variant="stack">
            <CardTitle as="h2">What you wrote</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            {previewCard}
            {skills.length ? (
              <ul className="flex flex-wrap gap-1" aria-label="Skills">
                {skills.map((s) => (
                  <li key={s}>
                    <Badge tone="outline">{s}</Badge>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="max-w-prose whitespace-pre-line text-sm leading-relaxed text-secondary">
              {form.description}
            </div>
          </CardBody>
        </Card>

        <FormActions className="justify-start">
          <ButtonLink href="/jobs?tab=mine" variant="secondary" className="min-h-11">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to my postings
          </ButtonLink>
          {submitted.persisted ? null : (
            <Button variant="ghost" className="min-h-11" onClick={() => setSubmitted(null)}>
              Edit what I wrote
            </Button>
          )}
        </FormActions>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card as="section" aria-labelledby="job-form-title" className="min-w-0">
        <CardHeader variant="stack">
          <CardTitle as="h2" id="job-form-title">
            Your posting
          </CardTitle>
          <CardDescription>Only the title, company and description are required.</CardDescription>
        </CardHeader>

        <CardBody>
          <form onSubmit={onSubmit} noValidate className="space-y-8">
            <Group n={1} legend="The role">
              <Field htmlFor="job-title" label="Role title" required error={errors.title}>
                <Input
                  id="job-title"
                  name="title"
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  invalid={Boolean(errors.title)}
                  aria-describedby={describedBy('job-title', { error: Boolean(errors.title) })}
                  placeholder="Associate Software Engineer"
                  autoComplete="off"
                />
              </Field>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field htmlFor="job-company" label="Company" required error={errors.company}>
                  <Input
                    id="job-company"
                    name="company"
                    value={form.company}
                    onChange={(e) => set('company', e.target.value)}
                    invalid={Boolean(errors.company)}
                    aria-describedby={describedBy('job-company', { error: Boolean(errors.company) })}
                    placeholder="Infosys"
                    autoComplete="organization"
                  />
                </Field>

                <Field htmlFor="job-location" label="Location" error={errors.location}>
                  <Input
                    id="job-location"
                    name="location"
                    value={form.location}
                    onChange={(e) => set('location', e.target.value)}
                    invalid={Boolean(errors.location)}
                    aria-describedby={describedBy('job-location', { error: Boolean(errors.location) })}
                    placeholder="Hyderabad, or Remote (India)"
                  />
                </Field>
              </div>

              <Switch
                id="job-internship"
                label="This is an internship"
                checked={form.isInternship}
                onChange={(e) => set('isInternship', e.target.checked)}
              />
            </Group>

            <Group n={2} legend="Who you want">
              <Field htmlFor="job-experience" label="Experience">
                <Select
                  id="job-experience"
                  name="experience"
                  value={form.experience}
                  onChange={(e) => set('experience', e.target.value)}
                >
                  <option value="">Not specified</option>
                  {EXPERIENCE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field htmlFor="job-skills" label="Skills you screen for, separated by commas" error={errors.skills}>
                <Input
                  id="job-skills"
                  name="skills"
                  value={form.skills}
                  onChange={(e) => set('skills', e.target.value)}
                  invalid={Boolean(errors.skills)}
                  aria-describedby={describedBy('job-skills', { error: Boolean(errors.skills) })}
                  placeholder="Java, Spring Boot, SQL"
                />
              </Field>

              {skills.length ? (
                <ul className="-mt-2 flex flex-wrap gap-1" aria-label="Skills as they will be listed">
                  {skills.map((s) => (
                    <li key={s}>
                      <Badge tone="outline">{s}</Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Group>

            <Group n={3} legend="Details">
              <Field
                htmlFor="job-salary"
                label="Pay"
                hint="A band, such as ₹6–9 LPA or ₹40,000 a month, rather than “as per industry standards”."
                error={errors.salary}
              >
                <Input
                  id="job-salary"
                  name="salary"
                  value={form.salary}
                  onChange={(e) => set('salary', e.target.value)}
                  invalid={Boolean(errors.salary)}
                  aria-describedby={describedBy('job-salary', { hint: true, error: Boolean(errors.salary) })}
                  placeholder="₹6–9 LPA"
                />
              </Field>

              <div className="space-y-1.5">
                <Field
                  htmlFor="job-description"
                  label="Description"
                  required
                  hint={`At least ${DESCRIPTION_MIN} characters: what the work is and what you screen for. Line breaks are kept.`}
                  error={errors.description}
                >
                  <Textarea
                    id="job-description"
                    name="description"
                    rows={8}
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
                <p className="text-right text-xs tabular text-secondary">
                  {form.description.length} / {DESCRIPTION_MAX}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field htmlFor="job-apply-url" label="Company application link" error={errors.applyUrl}>
                  <Input
                    id="job-apply-url"
                    name="applyUrl"
                    type="url"
                    inputMode="url"
                    value={form.applyUrl}
                    onChange={(e) => set('applyUrl', e.target.value)}
                    invalid={Boolean(errors.applyUrl)}
                    aria-describedby={describedBy('job-apply-url', { error: Boolean(errors.applyUrl) })}
                    placeholder="https://careers.example.com/role"
                  />
                </Field>

                <Field htmlFor="job-closes" label="Closes on" error={errors.closesOn}>
                  <Input
                    id="job-closes"
                    name="closesOn"
                    type="date"
                    value={form.closesOn}
                    onChange={(e) => set('closesOn', e.target.value)}
                    invalid={Boolean(errors.closesOn)}
                    aria-describedby={describedBy('job-closes', { error: Boolean(errors.closesOn) })}
                  />
                </Field>
              </div>
            </Group>

            <div
              className={cn(
                'rounded-lg border p-4',
                errors.confirmed ? 'border-danger bg-danger-soft' : 'border-line bg-surface-sunken',
              )}
            >
              <Checkbox
                id="job-confirm"
                required
                checked={form.confirmed}
                onChange={(e) => set('confirmed', e.target.checked)}
                label="I am hiring for this role or can refer for it. It is not an agency listing and nobody will be asked for money."
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

            {/* On a phone the preview waits in a disclosure; the rail shows it from lg. */}
            <div className="space-y-4 lg:hidden">
              <Disclosure summary="Preview the card students will see">
                <div className="space-y-4">{previewCard}</div>
              </Disclosure>
              {steps}
            </div>

            <FormActions sticky>
              <ButtonLink href="/jobs" variant="ghost" className="min-h-11">
                Cancel
              </ButtonLink>
              <Button type="submit" loading={busy} className="min-h-11">
                <Send className="size-4" aria-hidden="true" />
                Submit for review
              </Button>
            </FormActions>
          </form>
        </CardBody>
      </Card>

      <aside aria-label={`Preview for ${shortName} final-year students`} className="hidden space-y-4 lg:sticky lg:top-20 lg:block lg:self-start">
        <p className="eyebrow text-xs text-secondary">What students will see</p>
        {previewCard}
        {steps}
      </aside>
    </div>
  );
}

/** A form section with a heading-weight legend. */
function Group({ n, legend, children }: { n: number; legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-5">
      <legend className="flex items-center gap-2.5 font-display text-md font-semibold text-primary">
        <span
          className="grid size-6 place-items-center rounded-full bg-brand-soft text-xs font-bold tabular text-brand-soft-fg"
          aria-hidden="true"
        >
          {n}
        </span>
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

function ReviewSteps({ reviewLine }: { reviewLine: string | null }) {
  const items = [
    'Submitted',
    `The placement cell reviews it${reviewLine ? ` (${reviewLine})` : ''}`,
    'Live to final-year students',
  ];
  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface-raised p-4">
      <ol className="relative space-y-3.5 before:absolute before:bottom-2.5 before:left-[0.5625rem] before:top-2.5 before:w-px before:bg-line before:content-['']">
        {items.map((label, i) => (
          <li key={label} className="relative flex items-start gap-2.5 text-sm">
            <span
              className="relative z-[1] grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold tabular text-brand-soft-fg ring-4 ring-[var(--surface-raised)]"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <span className="text-primary">{label}</span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-secondary">
        The college checks every posting so no student is sent to an agency listing or asked for money.
      </p>
    </div>
  );
}
