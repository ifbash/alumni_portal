'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Trash2, BadgeCheck } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  DetailRow,
  Field,
  FormActions,
  Input,
  Select,
  Switch,
  Textarea,
  describedBy,
  useToast,
} from '@/components/ui';
import { formatDate } from '@/lib/format';
import type { EducationEntry, EmploymentEntry } from '@/lib/data/types';

/**
 * The profile editor.
 *
 * Three decisions worth stating:
 *
 *  1. **Identity is read-only and says so.** Roll number, branch and batch
 *     came from the college's degree register. A portal that lets a member
 *     retype their own roll number has thrown away the only evidence its
 *     verification decision was ever based on.
 *  2. **The availability switches carry the commitment, not a label.** A
 *     switch called "Open to mentoring" with no consequence written next
 *     to it gets switched on once and regretted the first time a student
 *     actually writes.
 *  3. **Email is not editable here.** It is the sign-in credential; moving
 *     it is an account-recovery flow with its own verification, not a text
 *     field on a form.
 */

export interface ProfileFormValues {
  fullName: string;
  preferredName: string;
  photoUrl: string;
  bio: string;
  designation: string;
  currentCompany: string;
  industry: string;
  city: string;
  state: string;
  country: string;
  skills: string[];
  openToMentoring: boolean;
  openToReferrals: boolean;
  openToSpeaking: boolean;
  mobile: string;
  linkedin: string;
  github: string;
  portfolio: string;
  employment: EmploymentEntry[];
  education: EducationEntry[];
}

export interface ProfileFormIdentity {
  rollNumber: string | null;
  programme: string | null;
  departmentName: string | null;
  departmentCode: string | null;
  batchYear: number | null;
  admissionYear: number | null;
  email: string | null;
  verifiedAt: string | null;
  isStudent: boolean;
}

type FieldErrors = Record<string, string | undefined>;

export function ProfileForm({
  values: initial,
  identity,
  supportEmail,
}: {
  values: ProfileFormValues;
  identity: ProfileFormIdentity;
  supportEmail: string | null;
}) {
  const router = useRouter();
  const toast = useToast();

  const [values, setValues] = React.useState<ProfileFormValues>(initial);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const nextId = React.useRef(1);

  function set<K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  const dirty = React.useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initial),
    [values, initial],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setErrors({});

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          // Trim the empties out rather than posting blank strings the
          // validator would have to interpret.
          skills: values.skills.map((s) => s.trim()).filter(Boolean),
          employment: values.employment.filter((r) => r.company.trim()),
          education: values.education.filter((r) => r.institution.trim()),
        }),
      });

      if (res.status === 422) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string; fieldErrors?: FieldErrors }
          | null;
        setErrors(body?.fieldErrors ?? {});
        setFormError(body?.error ?? 'Some fields need fixing before this can be saved.');
        toast.error('Not saved', 'Check the fields marked below.');
        return;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `The server refused the change (${res.status}).`);
      }

      toast.success('Profile saved', 'The directory shows the new version immediately.');
      router.push('/profile');
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Nothing was saved.';
      setFormError(message);
      toast.error('That did not save', message);
    } finally {
      setSaving(false);
    }
  }

  // ---- skills -----------------------------------------------------------

  const [skillDraft, setSkillDraft] = React.useState('');

  function addSkill(raw: string) {
    const skill = raw.trim().replace(/,+$/, '');
    if (!skill) return;
    if (values.skills.some((s) => s.toLowerCase() === skill.toLowerCase())) {
      setSkillDraft('');
      return;
    }
    set('skills', [...values.skills, skill]);
    setSkillDraft('');
  }

  function onSkillKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill(skillDraft);
    } else if (e.key === 'Backspace' && !skillDraft && values.skills.length) {
      set('skills', values.skills.slice(0, -1));
    }
  }

  // ---- repeatable rows --------------------------------------------------

  function addEmployment() {
    set('employment', [
      ...values.employment,
      {
        id: `new-emp-${nextId.current++}`,
        company: '',
        designation: '',
        location: '',
        startedOn: '',
        endedOn: null,
        isCurrent: false,
      },
    ]);
  }

  function updateEmployment(id: string, patch: Partial<EmploymentEntry>) {
    set(
      'employment',
      values.employment.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }

  function addEducation() {
    set('education', [
      ...values.education,
      {
        id: `new-edu-${nextId.current++}`,
        institution: '',
        qualification: '',
        field: '',
        startedOn: '',
        endedOn: null,
      },
    ]);
  }

  function updateEducation(id: string, patch: Partial<EducationEntry>) {
    set(
      'education',
      values.education.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {formError ? (
        <Alert tone="danger" title="Nothing was saved">
          {formError}
        </Alert>
      ) : null}

      {/* ---- Identity: read-only ------------------------------------- */}

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle as="h2">Identity</CardTitle>
            <CardDescription>
              These came from the college&rsquo;s degree register. Only the alumni cell can change
              them, and every change is audited.
            </CardDescription>
          </div>
          {identity.verifiedAt ? (
            <Badge tone="success">
              <BadgeCheck className="size-3.5" aria-hidden="true" />
              Verified {formatDate(identity.verifiedAt)}
            </Badge>
          ) : (
            <Badge tone="warning" dot>
              Not verified
            </Badge>
          )}
        </CardHeader>

        <CardBody className="space-y-5">
          <dl className="divide-y divide-line">
            <DetailRow label="Roll number">
              <span className="font-mono">{identity.rollNumber ?? '—'}</span>
            </DetailRow>
            <DetailRow label="Branch">
              {identity.departmentName ?? identity.departmentCode ?? '—'}
            </DetailRow>
            <DetailRow label="Programme and batch">
              {[identity.programme, identity.batchYear].filter(Boolean).join(' · ') || '—'}
            </DetailRow>
            <DetailRow label="Sign-in email">
              <span className="font-mono text-sm">{identity.email ?? '—'}</span>
            </DetailRow>
          </dl>

          <p className="text-xs text-muted">
            Your email is how you sign in — there is no password on this portal. To move your
            account to a different address, write to{' '}
            {supportEmail ? (
              <a href={`mailto:${supportEmail}`} className="link">
                {supportEmail}
              </a>
            ) : (
              'the alumni cell'
            )}{' '}
            from the address you use today.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              htmlFor="preferredName"
              label="Preferred name"
              hint="What people actually call you. Shown next to your full name."
            >
              <Input
                id="preferredName"
                value={values.preferredName}
                onChange={(e) => set('preferredName', e.currentTarget.value)}
                placeholder="Vamsi"
                maxLength={40}
              />
            </Field>

            <Field
              htmlFor="photo"
              label="Photo link"
              hint="A link to an image. The portal does not host photos yet, so this points at wherever it already lives."
              error={errors.photoUrl}
            >
              <Input
                id="photo"
                type="url"
                inputMode="url"
                value={values.photoUrl}
                onChange={(e) => set('photoUrl', e.currentTarget.value)}
                placeholder="https://…"
                invalid={Boolean(errors.photoUrl)}
                aria-describedby={describedBy('photo', { hint: true, error: Boolean(errors.photoUrl) })}
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* ---- About ---------------------------------------------------- */}

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle as="h2">About you</CardTitle>
            <CardDescription>
              Visible to every verified member of the portal. Not to the public — the directory is
              never anonymous.
            </CardDescription>
          </div>
        </CardHeader>

        <CardBody className="space-y-5">
          <Field
            htmlFor="bio"
            label="Short introduction"
            hint={
              identity.isStudent
                ? 'What you are looking for and what you have built. An alumnus decides whether to reply on this alone.'
                : 'What you work on, and what you are happy to be asked about. Two sentences is plenty.'
            }
            error={errors.bio}
          >
            <Textarea
              id="bio"
              value={values.bio}
              onChange={(e) => set('bio', e.currentTarget.value)}
              rows={4}
              maxLength={600}
              invalid={Boolean(errors.bio)}
              aria-describedby={describedBy('bio', { hint: true, error: Boolean(errors.bio) })}
              placeholder="Senior Software Engineer at Amazon. CSE, batch of 2017. Happy to talk to final-years about interview prep."
            />
          </Field>
          <p className="-mt-3 text-right text-xs text-muted tabular">
            {values.bio.length} / 600
          </p>
        </CardBody>
      </Card>

      {/* ---- Current work --------------------------------------------- */}

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle as="h2">Current work and location</CardTitle>
            <CardDescription>
              Company, designation and city are the three fields the directory is searched on most.
            </CardDescription>
          </div>
        </CardHeader>

        <CardBody className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field htmlFor="company" label="Employer" error={errors.currentCompany}>
              <Input
                id="company"
                value={values.currentCompany}
                onChange={(e) => set('currentCompany', e.currentTarget.value)}
                placeholder={identity.isStudent ? 'Internship or none' : 'Amazon'}
                invalid={Boolean(errors.currentCompany)}
              />
            </Field>

            <Field htmlFor="designation" label="Designation" error={errors.designation}>
              <Input
                id="designation"
                value={values.designation}
                onChange={(e) => set('designation', e.currentTarget.value)}
                placeholder="Senior Software Engineer"
                invalid={Boolean(errors.designation)}
              />
            </Field>

            <Field
              htmlFor="industry"
              label="Industry"
              hint="Used to group alumni for placement outreach."
            >
              <Input
                id="industry"
                list="industry-options"
                value={values.industry}
                onChange={(e) => set('industry', e.currentTarget.value)}
                placeholder="Information Technology"
              />
              <datalist id="industry-options">
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i} />
                ))}
              </datalist>
            </Field>

            <Field htmlFor="city" label="City" error={errors.city}>
              <Input
                id="city"
                list="city-options"
                value={values.city}
                onChange={(e) => set('city', e.currentTarget.value)}
                placeholder="Hyderabad"
                invalid={Boolean(errors.city)}
              />
              <datalist id="city-options">
                {CITIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>

            <Field htmlFor="state" label="State or region">
              <Input
                id="state"
                value={values.state}
                onChange={(e) => set('state', e.currentTarget.value)}
                placeholder="Telangana"
              />
            </Field>

            <Field htmlFor="country" label="Country">
              <Select
                id="country"
                value={values.country}
                onChange={(e) => set('country', e.currentTarget.value)}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* ---- Skills ---------------------------------------------------- */}

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle as="h2">Skills</CardTitle>
            <CardDescription>
              Three or more. Below that you only appear in searches for your own name.
            </CardDescription>
          </div>
        </CardHeader>

        <CardBody className="space-y-3">
          {values.skills.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {values.skills.map((s) => (
                <li key={s}>
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-soft-fg">
                    {s}
                    <button
                      type="button"
                      onClick={() => set('skills', values.skills.filter((x) => x !== s))}
                      aria-label={`Remove ${s}`}
                      className="grid size-4 place-items-center rounded-full hover:bg-surface-raised"
                    >
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <Field
            htmlFor="skills"
            label="Add a skill"
            hint="Press Enter or comma after each one. Backspace removes the last."
          >
            <div className="flex gap-2">
              <Input
                id="skills"
                value={skillDraft}
                onChange={(e) => setSkillDraft(e.currentTarget.value)}
                onKeyDown={onSkillKeyDown}
                onBlur={() => addSkill(skillDraft)}
                placeholder="System Design"
                aria-describedby={describedBy('skills', { hint: true })}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => addSkill(skillDraft)}
                disabled={!skillDraft.trim()}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add
              </Button>
            </div>
          </Field>
        </CardBody>
      </Card>

      {/* ---- Contact --------------------------------------------------- */}

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle as="h2">Contact details</CardTitle>
            <CardDescription>
              Held in a separate table from your profile and released only under the rule you set
              on the privacy page. Adding a number here does not publish it.
            </CardDescription>
          </div>
        </CardHeader>

        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field
            htmlFor="mobile"
            label="Mobile"
            hint="For account recovery and WhatsApp. Never used to sign in, never shown in the directory."
            error={errors.mobile}
          >
            <Input
              id="mobile"
              type="tel"
              inputMode="tel"
              value={values.mobile}
              onChange={(e) => set('mobile', e.currentTarget.value)}
              placeholder="+91 98480 00000"
              invalid={Boolean(errors.mobile)}
              aria-describedby={describedBy('mobile', { hint: true, error: Boolean(errors.mobile) })}
            />
          </Field>

          <Field htmlFor="linkedin" label="LinkedIn" error={errors.linkedin}>
            <Input
              id="linkedin"
              type="url"
              inputMode="url"
              value={values.linkedin}
              onChange={(e) => set('linkedin', e.currentTarget.value)}
              placeholder="https://linkedin.com/in/…"
              invalid={Boolean(errors.linkedin)}
            />
          </Field>

          <Field htmlFor="github" label="GitHub" error={errors.github}>
            <Input
              id="github"
              type="url"
              inputMode="url"
              value={values.github}
              onChange={(e) => set('github', e.currentTarget.value)}
              placeholder="https://github.com/…"
              invalid={Boolean(errors.github)}
            />
          </Field>

          <Field htmlFor="portfolio" label="Website or portfolio" error={errors.portfolio}>
            <Input
              id="portfolio"
              type="url"
              inputMode="url"
              value={values.portfolio}
              onChange={(e) => set('portfolio', e.currentTarget.value)}
              placeholder="https://…"
              invalid={Boolean(errors.portfolio)}
            />
          </Field>
        </CardBody>
      </Card>

      {/* ---- Availability ---------------------------------------------- */}

      <Card id="availability">
        <CardHeader>
          <div className="space-y-1">
            <CardTitle as="h2">What you are open to</CardTitle>
            <CardDescription>
              Each one is a standing yes to being asked. None of them obliges you to say yes to a
              particular person.
            </CardDescription>
          </div>
        </CardHeader>

        <CardBody className="space-y-5">
          <Switch
            id="openToMentoring"
            label="Open to mentoring"
            hint="Students may send you a mentorship request with a message. Five open requests each, ten a month — so you will not be flooded. Declining is silent."
            checked={values.openToMentoring}
            onChange={(e) => set('openToMentoring', e.currentTarget.checked)}
          />
          <Switch
            id="openToReferrals"
            label="Open to referral requests"
            hint={
              values.currentCompany.trim()
                ? `Students may ask you to refer them at ${values.currentCompany.trim()}. You see who is asking and what they have built before you decide.`
                : 'Add your employer above first — a referral request needs a company to point at.'
            }
            checked={values.openToReferrals}
            disabled={!values.currentCompany.trim()}
            onChange={(e) => set('openToReferrals', e.currentTarget.checked)}
          />
          <Switch
            id="openToSpeaking"
            label="Open to speaking on campus"
            hint="The alumni cell may invite you to a session — usually two hours on a Saturday, in Ganguru or over video. An invitation, not a booking."
            checked={values.openToSpeaking}
            onChange={(e) => set('openToSpeaking', e.currentTarget.checked)}
          />
        </CardBody>
      </Card>

      {/* ---- Employment history ---------------------------------------- */}

      <Card id="employment">
        <CardHeader>
          <div className="space-y-1">
            <CardTitle as="h2">Work history</CardTitle>
            <CardDescription>
              A student changing tracks wants to find somebody who already made that jump. This is
              how they find you.
            </CardDescription>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addEmployment}>
            <Plus className="size-4" aria-hidden="true" />
            Add a role
          </Button>
        </CardHeader>

        <CardBody className="space-y-5">
          {values.employment.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-secondary">
              No roles listed yet.
            </p>
          ) : null}

          {values.employment.map((row, i) => (
            <fieldset key={row.id} className="space-y-4 rounded-lg border border-line p-4">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                Role {i + 1}
              </legend>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor={`emp-company-${row.id}`} label="Company" required>
                  <Input
                    id={`emp-company-${row.id}`}
                    value={row.company}
                    onChange={(e) => updateEmployment(row.id, { company: e.currentTarget.value })}
                    placeholder="Infosys"
                  />
                </Field>
                <Field htmlFor={`emp-title-${row.id}`} label="Designation">
                  <Input
                    id={`emp-title-${row.id}`}
                    value={row.designation ?? ''}
                    onChange={(e) => updateEmployment(row.id, { designation: e.currentTarget.value })}
                    placeholder="Systems Engineer"
                  />
                </Field>
                <Field htmlFor={`emp-loc-${row.id}`} label="Location">
                  <Input
                    id={`emp-loc-${row.id}`}
                    value={row.location ?? ''}
                    onChange={(e) => updateEmployment(row.id, { location: e.currentTarget.value })}
                    placeholder="Hyderabad"
                  />
                </Field>
                <Field htmlFor={`emp-start-${row.id}`} label="Started">
                  <Input
                    id={`emp-start-${row.id}`}
                    type="date"
                    value={(row.startedOn ?? '').slice(0, 10)}
                    onChange={(e) => updateEmployment(row.id, { startedOn: e.currentTarget.value })}
                  />
                </Field>
                {!row.isCurrent ? (
                  <Field htmlFor={`emp-end-${row.id}`} label="Ended">
                    <Input
                      id={`emp-end-${row.id}`}
                      type="date"
                      value={(row.endedOn ?? '').slice(0, 10)}
                      onChange={(e) => updateEmployment(row.id, { endedOn: e.currentTarget.value })}
                    />
                  </Field>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <Switch
                  id={`emp-current-${row.id}`}
                  label="This is my current role"
                  checked={row.isCurrent}
                  onChange={(e) =>
                    updateEmployment(row.id, {
                      isCurrent: e.currentTarget.checked,
                      endedOn: e.currentTarget.checked ? null : row.endedOn,
                    })
                  }
                  className="max-w-md"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    set('employment', values.employment.filter((r) => r.id !== row.id))
                  }
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Remove
                </Button>
              </div>
            </fieldset>
          ))}
        </CardBody>
      </Card>

      {/* ---- Education -------------------------------------------------- */}

      <Card id="education">
        <CardHeader>
          <div className="space-y-1">
            <CardTitle as="h2">Education</CardTitle>
            <CardDescription>
              Your DIET degree comes from the register and stays. Add anything you studied after it.
            </CardDescription>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addEducation}>
            <Plus className="size-4" aria-hidden="true" />
            Add a qualification
          </Button>
        </CardHeader>

        <CardBody className="space-y-5">
          {values.education.map((row, i) => (
            <fieldset key={row.id} className="space-y-4 rounded-lg border border-line p-4">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                Qualification {i + 1}
              </legend>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor={`edu-inst-${row.id}`} label="Institution" required>
                  <Input
                    id={`edu-inst-${row.id}`}
                    value={row.institution}
                    onChange={(e) => updateEducation(row.id, { institution: e.currentTarget.value })}
                    placeholder="NIT Warangal"
                  />
                </Field>
                <Field htmlFor={`edu-qual-${row.id}`} label="Qualification">
                  <Input
                    id={`edu-qual-${row.id}`}
                    value={row.qualification ?? ''}
                    onChange={(e) => updateEducation(row.id, { qualification: e.currentTarget.value })}
                    placeholder="M.Tech"
                  />
                </Field>
                <Field htmlFor={`edu-field-${row.id}`} label="Field">
                  <Input
                    id={`edu-field-${row.id}`}
                    value={row.field ?? ''}
                    onChange={(e) => updateEducation(row.id, { field: e.currentTarget.value })}
                    placeholder="Computer Science"
                  />
                </Field>
                <Field htmlFor={`edu-start-${row.id}`} label="Started">
                  <Input
                    id={`edu-start-${row.id}`}
                    type="date"
                    value={(row.startedOn ?? '').slice(0, 10)}
                    onChange={(e) => updateEducation(row.id, { startedOn: e.currentTarget.value })}
                  />
                </Field>
                <Field htmlFor={`edu-end-${row.id}`} label="Ended">
                  <Input
                    id={`edu-end-${row.id}`}
                    type="date"
                    value={(row.endedOn ?? '').slice(0, 10)}
                    onChange={(e) => updateEducation(row.id, { endedOn: e.currentTarget.value })}
                  />
                </Field>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => set('education', values.education.filter((r) => r.id !== row.id))}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Remove
                </Button>
              </div>
            </fieldset>
          ))}
        </CardBody>
      </Card>

      <FormActions>
        <p className="mr-auto text-xs text-muted">
          {dirty ? 'Unsaved changes.' : 'No changes yet.'} Saving updates the directory immediately.
        </p>
        <ButtonLink href="/profile" variant="secondary">
          Cancel
        </ButtonLink>
        <Button type="submit" loading={saving} disabled={!dirty}>
          Save profile
        </Button>
      </FormActions>
    </form>
  );
}

const INDUSTRIES = [
  'Information Technology',
  'Product Engineering',
  'Banking & Finance',
  'Consulting',
  'Manufacturing',
  'Construction & Infrastructure',
  'Semiconductors',
  'Healthcare & Pharma',
  'Education',
  'Government & Public Sector',
  'Energy & Utilities',
  'E-commerce',
  'Telecom',
];

const CITIES = [
  'Hyderabad',
  'Bengaluru',
  'Chennai',
  'Pune',
  'Mumbai',
  'Vijayawada',
  'Visakhapatnam',
  'Guntur',
  'Tirupati',
  'Noida',
  'Gurugram',
  'Kochi',
  'Kolkata',
  'Ahmedabad',
  'Bhubaneswar',
  'Nellore',
];

const COUNTRIES = [
  { code: 'IN', label: 'India' },
  { code: 'US', label: 'United States' },
  { code: 'CA', label: 'Canada' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'DE', label: 'Germany' },
  { code: 'IE', label: 'Ireland' },
  { code: 'CH', label: 'Switzerland' },
  { code: 'AE', label: 'United Arab Emirates' },
  { code: 'QA', label: 'Qatar' },
  { code: 'SG', label: 'Singapore' },
  { code: 'AU', label: 'Australia' },
];
