'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Plus, Trash2, X } from 'lucide-react';
import {
  Alert,
  Avatar,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardTitle,
  Field,
  FormActions,
  Input,
  Select,
  Switch,
  Textarea,
  describedBy,
  useToast,
} from '@/components/ui';
import { outcomeToast } from '@/lib/client/api';
import { availabilityCopy, type AvailabilityContext } from '@/lib/availability-copy';
import type { EducationEntry, EmploymentEntry } from '@/lib/data/types';

/**
 * The profile editor.
 *
 * Three blocks, in the order a member thinks about them: what everyone
 * sees, how people reach you and what you are open to, then the history.
 * Identity (name, roll number, branch, batch, sign-in email) came from the
 * college register and is shown as facts, not as inputs. The save bar
 * appears only once something has changed, and stays pinned to the bottom
 * of the screen, so a change made halfway down is saved where it was made.
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

/** College copy the form needs. Resolved on the server; never tenant facts in here. */
export interface ProfileFormCollege {
  shortName: string;
  officeName: string;
  rollNumberLabel: string;
  whatsapp: boolean;
  /** `faculty` for faculty without the alumni role: no referrals entry. */
  audience: AvailabilityContext['audience'];
  openLimit: number;
}

type FieldErrors = Record<string, string | undefined>;

const SECTIONS = [
  { id: 'basics', label: 'Basics' },
  { id: 'about', label: 'About' },
  { id: 'work', label: 'Work' },
  { id: 'skills-section', label: 'Skills' },
  { id: 'contact', label: 'Contact' },
  { id: 'availability', label: 'Open to' },
  { id: 'employment', label: 'Experience' },
  { id: 'education', label: 'Education' },
] as const;

/** Anchored inputs land below the sticky top bar with their label in view. */
const ANCHORED = 'scroll-mt-32';

export function ProfileForm({
  values: initial,
  identity,
  supportEmail,
  college,
}: {
  values: ProfileFormValues;
  identity: ProfileFormIdentity;
  supportEmail: string | null;
  college: ProfileFormCollege;
}) {
  const router = useRouter();
  const toast = useToast();

  const [values, setValues] = React.useState<ProfileFormValues>(initial);
  // What "unchanged" means. Moves forward when a save is recorded but not
  // stored (demo data), so the bar does not keep asking to save it again.
  const [baseline, setBaseline] = React.useState<ProfileFormValues>(initial);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const nextId = React.useRef(1);

  function set<K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  const dirty = React.useMemo(
    () => JSON.stringify(values) !== JSON.stringify(baseline),
    [values, baseline],
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

      const body = (await res.json().catch(() => null)) as { persisted?: boolean } | null;
      const persisted = body?.persisted !== false;
      const t = outcomeToast({ status: 'ok', data: body, persisted }, 'Profile saved');
      if (t) toast.show(t);

      if (persisted) {
        router.push('/profile');
        router.refresh();
      } else {
        setBaseline(values);
      }
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

  // ---- availability -----------------------------------------------------

  const ctx: AvailabilityContext = {
    audience: college.audience,
    company: values.currentCompany,
    officeName: college.officeName,
    openLimit: college.openLimit,
  };
  const mentoring = availabilityCopy('mentoring', ctx);
  const referrals = availabilityCopy('referrals', ctx);
  const speaking = availabilityCopy('speaking', ctx);

  const photoPreview = /^https?:\/\/\S+\.\S+/.test(values.photoUrl.trim()) ? values.photoUrl.trim() : null;

  return (
    <form onSubmit={onSubmit} className="lg:grid lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-gutter">
      {/* Jump-nav over the form's sections, lg only. */}
      <nav aria-label="Profile sections" className="hidden lg:block">
        <ul className="sticky top-20 space-y-0.5">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="flex min-h-9 items-center rounded px-3 text-sm font-medium text-secondary transition-colors duration-fast ease-brand hover:bg-surface-sunken hover:text-primary"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 space-y-8">
        {formError ? (
          <Alert tone="danger" title="Nothing was saved">
            {formError}
          </Alert>
        ) : null}

        {/* ================================================================
            Public profile
            ================================================================ */}

        <section aria-labelledby="block-public" className="space-y-4">
          <BlockHeading id="block-public" title="Public profile" line="What signed-in members see when they find you." />

          <Card id="basics" className="scroll-mt-20">
            <CardBody className="space-y-5">
              <CardTitle as="h3" className="text-md">
                Basics
              </CardTitle>

              <div className="rounded-lg border border-line bg-surface p-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-medium text-secondary">
                  <Lock className="size-3.5 text-muted" aria-hidden="true" />
                  From the college register. The {college.officeName} can correct these.
                </p>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <Fact label="Name">{values.fullName}</Fact>
                  <Fact label={college.rollNumberLabel}>
                    <span className="font-mono">{identity.rollNumber ?? '—'}</span>
                  </Fact>
                  <Fact label="Branch">{identity.departmentName ?? identity.departmentCode ?? '—'}</Fact>
                  <Fact label={identity.isStudent ? 'Programme' : 'Programme and batch'}>
                    {[identity.programme, identity.isStudent ? null : identity.batchYear]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </Fact>
                  <Fact label="Sign-in email" className="sm:col-span-2">
                    <span className="break-all">{identity.email ?? '—'}</span>
                    <span className="mt-0.5 block text-xs font-normal text-secondary">
                      To change it, write to{' '}
                      {supportEmail ? (
                        <a href={`mailto:${supportEmail}`} className="link">
                          {supportEmail}
                        </a>
                      ) : (
                        `the ${college.officeName}`
                      )}{' '}
                      from this address.
                    </span>
                  </Fact>
                </dl>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  htmlFor="preferredName"
                  label="Preferred name"
                  hint="Shown next to your full name."
                >
                  <Input
                    id="preferredName"
                    value={values.preferredName}
                    onChange={(e) => set('preferredName', e.currentTarget.value)}
                    maxLength={40}
                    aria-describedby={describedBy('preferredName', { hint: true })}
                  />
                </Field>

                <Field
                  htmlFor="photo"
                  label="Photo link"
                  hint="A link to a photo that is already online."
                  error={errors.photoUrl}
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={values.fullName} src={photoPreview} size="md" />
                    <Input
                      id="photo"
                      type="url"
                      inputMode="url"
                      value={values.photoUrl}
                      onChange={(e) => set('photoUrl', e.currentTarget.value)}
                      placeholder="https://…"
                      invalid={Boolean(errors.photoUrl)}
                      aria-describedby={describedBy('photo', { hint: true, error: Boolean(errors.photoUrl) })}
                      className={ANCHORED}
                    />
                  </div>
                </Field>
              </div>
            </CardBody>
          </Card>

          <Card id="about" className="scroll-mt-20">
            <CardBody className="space-y-4">
              <CardTitle as="h3" className="text-md">
                About
              </CardTitle>
              <Field
                htmlFor="bio"
                label="Short introduction"
                hint={
                  identity.isStudent
                    ? 'What you are looking for, and what you have built.'
                    : 'What you work on, and what you are happy to be asked about.'
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
                  className={ANCHORED}
                />
              </Field>
              <p className="-mt-2 text-right text-xs text-secondary tabular">{values.bio.length} / 600</p>
            </CardBody>
          </Card>

          <Card id="work" className="scroll-mt-20">
            <CardBody className="space-y-4">
              <div className="space-y-1">
                <CardTitle as="h3" className="text-md">
                  Work and location
                </CardTitle>
                <CardDescription>The fields students search on most.</CardDescription>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field htmlFor="company" label="Employer" error={errors.currentCompany}>
                  <Input
                    id="company"
                    value={values.currentCompany}
                    onChange={(e) => set('currentCompany', e.currentTarget.value)}
                    placeholder={identity.isStudent ? 'Internship, if any' : undefined}
                    invalid={Boolean(errors.currentCompany)}
                    className={ANCHORED}
                  />
                </Field>

                <Field htmlFor="designation" label="Designation" error={errors.designation}>
                  <Input
                    id="designation"
                    value={values.designation}
                    onChange={(e) => set('designation', e.currentTarget.value)}
                    invalid={Boolean(errors.designation)}
                  />
                </Field>

                <Field htmlFor="industry" label="Industry">
                  <Input
                    id="industry"
                    list="industry-options"
                    value={values.industry}
                    onChange={(e) => set('industry', e.currentTarget.value)}
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
                    invalid={Boolean(errors.city)}
                    className={ANCHORED}
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

          <Card id="skills-section" className="scroll-mt-20">
            <CardBody className="space-y-4">
              <div className="space-y-1">
                <CardTitle as="h3" className="text-md">
                  Skills
                </CardTitle>
                <CardDescription>Three or more, so you turn up when the directory is filtered.</CardDescription>
              </div>

              {values.skills.length ? (
                <ul className="flex flex-wrap gap-1.5" aria-label="Your skills">
                  {values.skills.map((s) => (
                    <li key={s}>
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-soft py-0.5 pl-3 pr-0.5 text-sm font-medium text-brand-soft-fg">
                        {s}
                        <button
                          type="button"
                          onClick={() => set('skills', values.skills.filter((x) => x !== s))}
                          aria-label={`Remove ${s}`}
                          className="relative grid size-7 place-items-center rounded-full transition-colors duration-fast ease-brand after:absolute after:-inset-2 after:content-[''] hover:bg-surface-raised"
                        >
                          <X className="size-3.5" aria-hidden="true" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <Field htmlFor="skills" label="Add a skill" hint="Press Enter or a comma after each one.">
                <div className="flex gap-2">
                  <Input
                    id="skills"
                    value={skillDraft}
                    onChange={(e) => setSkillDraft(e.currentTarget.value)}
                    onKeyDown={onSkillKeyDown}
                    onBlur={() => addSkill(skillDraft)}
                    aria-describedby={describedBy('skills', { hint: true })}
                    className={ANCHORED}
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
        </section>

        {/* ================================================================
            Contact and availability
            ================================================================ */}

        <section aria-labelledby="block-contact" className="space-y-4">
          <BlockHeading
            id="block-contact"
            title="Contact and availability"
            line="How people reach you, and what you are happy to be asked."
          />

          <Card id="contact" className="scroll-mt-20">
            <CardBody className="space-y-4">
              <div className="space-y-1">
                <CardTitle as="h3" className="text-md">
                  Contact details
                </CardTitle>
                <CardDescription>
                  Shown only as your{' '}
                  <Link href="/settings/privacy" className="link">
                    privacy setting
                  </Link>{' '}
                  allows.
                </CardDescription>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  htmlFor="mobile"
                  label="Mobile"
                  hint={
                    college.whatsapp
                      ? 'For account recovery and WhatsApp. Never used to sign in.'
                      : 'For account recovery. Never used to sign in.'
                  }
                  error={errors.mobile}
                >
                  <Input
                    id="mobile"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={values.mobile}
                    onChange={(e) => set('mobile', e.currentTarget.value)}
                    placeholder="+91"
                    invalid={Boolean(errors.mobile)}
                    aria-describedby={describedBy('mobile', { hint: true, error: Boolean(errors.mobile) })}
                    className={ANCHORED}
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
                    className={ANCHORED}
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
                    className={ANCHORED}
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
              </div>
            </CardBody>
          </Card>

          <Card id="availability" className="scroll-mt-20">
            <CardBody className="space-y-5">
              <div className="space-y-1">
                <CardTitle as="h3" className="text-md">
                  Open to
                </CardTitle>
                <CardDescription>
                  {identity.isStudent
                    ? 'Final-year students are not asked for mentoring, referrals or talks.'
                    : 'Each is a standing yes to being asked. You still choose who to help.'}
                </CardDescription>
              </div>

              {identity.isStudent ? null : (
                <>
                  {mentoring ? (
                    <Switch
                      id="openToMentoring"
                      label={mentoring.label}
                      hint={mentoring.line}
                      checked={values.openToMentoring}
                      onChange={(e) => set('openToMentoring', e.currentTarget.checked)}
                    />
                  ) : null}
                  {referrals ? (
                    <Switch
                      id="openToReferrals"
                      label={referrals.label}
                      hint={values.currentCompany.trim() ? referrals.line : 'Add your employer above first.'}
                      checked={values.openToReferrals}
                      disabled={!values.currentCompany.trim()}
                      onChange={(e) => set('openToReferrals', e.currentTarget.checked)}
                    />
                  ) : null}
                  {speaking ? (
                    <Switch
                      id="openToSpeaking"
                      label={speaking.label}
                      hint={speaking.line}
                      checked={values.openToSpeaking}
                      onChange={(e) => set('openToSpeaking', e.currentTarget.checked)}
                    />
                  ) : null}
                </>
              )}
            </CardBody>
          </Card>
        </section>

        {/* ================================================================
            Experience and education
            ================================================================ */}

        <section aria-labelledby="block-history" className="space-y-4">
          <BlockHeading id="block-history" title="Experience and education" />

          <Card id="employment" className="scroll-mt-20">
            <CardBody className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle as="h3" className="text-md">
                    Experience
                  </CardTitle>
                  <CardDescription>
                    {identity.isStudent ? 'Internships count.' : 'Where you have worked, most recent first.'}
                  </CardDescription>
                </div>
                <Button type="button" variant="secondary" size="sm" className="min-h-11" onClick={addEmployment}>
                  <Plus className="size-4" aria-hidden="true" />
                  Add a role
                </Button>
              </div>

              {values.employment.length === 0 ? (
                <p className="text-sm text-secondary">No roles yet.</p>
              ) : null}

              {values.employment.map((row, i) => (
                <fieldset key={row.id} className="space-y-4 rounded-lg border border-line p-4">
                  <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-secondary">
                    {row.company.trim() || `Role ${i + 1}`}
                  </legend>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field htmlFor={`emp-company-${row.id}`} label="Company" required>
                      <Input
                        id={`emp-company-${row.id}`}
                        value={row.company}
                        onChange={(e) => updateEmployment(row.id, { company: e.currentTarget.value })}
                      />
                    </Field>
                    <Field htmlFor={`emp-title-${row.id}`} label="Designation">
                      <Input
                        id={`emp-title-${row.id}`}
                        value={row.designation ?? ''}
                        onChange={(e) => updateEmployment(row.id, { designation: e.currentTarget.value })}
                      />
                    </Field>
                    <Field htmlFor={`emp-loc-${row.id}`} label="Location">
                      <Input
                        id={`emp-loc-${row.id}`}
                        value={row.location ?? ''}
                        onChange={(e) => updateEmployment(row.id, { location: e.currentTarget.value })}
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
                      className="min-h-11"
                      onClick={() => set('employment', values.employment.filter((r) => r.id !== row.id))}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      Remove
                    </Button>
                  </div>
                </fieldset>
              ))}
            </CardBody>
          </Card>

          <Card id="education" className="scroll-mt-20">
            <CardBody className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle as="h3" className="text-md">
                    Education
                  </CardTitle>
                  <CardDescription>
                    Your {college.shortName} degree comes from the register and stays. Add anything you
                    studied after it.
                  </CardDescription>
                </div>
                <Button type="button" variant="secondary" size="sm" className="min-h-11" onClick={addEducation}>
                  <Plus className="size-4" aria-hidden="true" />
                  Add a qualification
                </Button>
              </div>

              {values.education.map((row, i) => (
                <fieldset key={row.id} className="space-y-4 rounded-lg border border-line p-4">
                  <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-secondary">
                    {row.institution.trim() || `Qualification ${i + 1}`}
                  </legend>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field htmlFor={`edu-inst-${row.id}`} label="Institution" required>
                      <Input
                        id={`edu-inst-${row.id}`}
                        value={row.institution}
                        onChange={(e) => updateEducation(row.id, { institution: e.currentTarget.value })}
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
                      className="min-h-11"
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
        </section>

        {dirty ? (
          <FormActions sticky>
            <p className="mr-auto text-sm font-medium" role="status">
              Unsaved changes
            </p>
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => setValues(baseline)}>
              Discard
            </Button>
            <Button type="submit" className="min-h-11" loading={saving}>
              Save profile
            </Button>
          </FormActions>
        ) : null}
      </div>
    </form>
  );
}

function BlockHeading({ id, title, line }: { id: string; title: string; line?: string }) {
  return (
    <div className="space-y-0.5">
      <h2 id={id} className="font-display text-xl font-semibold">
        {title}
      </h2>
      {line ? <p className="text-sm text-secondary">{line}</p> : null}
    </div>
  );
}

function Fact({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-secondary">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
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

/** Large Indian cities only, alphabetical. The field still takes any city. */
const CITIES = [
  'Ahmedabad',
  'Bengaluru',
  'Chennai',
  'Delhi',
  'Gurugram',
  'Hyderabad',
  'Kochi',
  'Kolkata',
  'Mumbai',
  'Noida',
  'Pune',
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
