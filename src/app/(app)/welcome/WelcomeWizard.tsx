'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Briefcase,
  Check,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Fieldset,
  Input,
  Progress,
  Radio,
  Select,
  Switch,
  describedBy,
  useToast,
} from '@/components/ui';
import type { ContactVisibility } from '@/lib/data/types';
import type { ProfileCheck } from '../profile/completeness';

/**
 * The first-run wizard.
 *
 * Four steps, each of which can be skipped with a button that is as
 * prominent as the one that continues. The two things worth defending:
 *
 *  1. **Each step saves on its own.** A member who fills in step one and
 *     closes the tab keeps step one. A wizard that only writes at the end
 *     throws away most of what people actually typed.
 *  2. **The availability step states the commitment, not the label.** A
 *     switch called "Open to mentoring" with nothing written next to it
 *     gets turned on once and regretted the first time a student writes at
 *     eleven at night. "Not right now" is rendered as an equal choice
 *     because for a lot of people it is the correct one, and a greyed-out
 *     afterthought reads as disapproval.
 */

export interface WelcomeValues {
  currentCompany: string;
  designation: string;
  industry: string;
  city: string;
  state: string;
  country: string;
  skills: string[];
  openToMentoring: boolean;
  openToReferrals: boolean;
  openToSpeaking: boolean;
  visibility: ContactVisibility;
}

type FieldErrors = Record<string, string | undefined>;

const STEP_COUNT = 4;

export function WelcomeWizard({
  values: initial,
  checks,
  isStudent,
  noticeVersion,
  shortName,
  connectionsOn,
  mentorshipOn,
  directoryOn,
}: {
  values: WelcomeValues;
  checks: ProfileCheck[];
  isStudent: boolean;
  noticeVersion: string;
  shortName: string;
  connectionsOn: boolean;
  mentorshipOn: boolean;
  directoryOn: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = React.useState(0);
  const [values, setValues] = React.useState<WelcomeValues>(initial);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  /** Null until the first save; false once a route has told us it did not store. */
  const [stored, setStored] = React.useState<boolean | null>(null);

  const done = React.useMemo(
    () => new Set(checks.filter((c) => c.done).map((c) => c.id)),
    [checks],
  );

  // Availability is an alumni-side idea: the switches say what a student
  // may ask *you*. A final-year has nobody below them in the directory, so
  // the step says that plainly instead of offering a control that does
  // nothing until their batch rolls over.
  const availabilityApplies = !isStudent && connectionsOn;

  const sectionRef = React.useRef<HTMLElement>(null);
  const mounted = React.useRef(false);

  React.useEffect(() => {
    // Move focus to the step, but not on first paint — stealing focus from
    // the top of the page on arrival is its own accessibility failure.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    sectionRef.current?.focus();
  }, [step]);

  function set<K extends keyof WelcomeValues>(key: K, value: WelcomeValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  // ---- saving -----------------------------------------------------------

  async function post(url: string, payload: Record<string, unknown>): Promise<boolean> {
    setSaving(true);
    setFormError(null);
    setErrors({});

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 422) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string; fieldErrors?: FieldErrors }
          | null;
        setErrors(body?.fieldErrors ?? {});
        setFormError(body?.error ?? 'Some fields need fixing before this can be saved.');
        return false;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `The server refused that (${res.status}).`);
      }

      const body = (await res.json().catch(() => null)) as { persisted?: boolean } | null;
      // The route ran every guard, the validation and the audit write, then
      // told us there is no store behind it. Saying "saved" over that would
      // be the one dishonest sentence in the product.
      if (body?.persisted === false) setStored(false);
      else setStored(true);

      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Nothing was saved.';
      setFormError(message);
      toast.error('That did not save', message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function payloadFor(index: number): Record<string, unknown> {
    if (index === 0) {
      return {
        currentCompany: values.currentCompany.trim(),
        designation: values.designation.trim(),
        industry: values.industry.trim(),
      };
    }
    if (index === 1) {
      return {
        city: values.city.trim(),
        state: values.state.trim(),
        country: values.country,
      };
    }
    return availabilityApplies
      ? {
          skills: values.skills.map((s) => s.trim()).filter(Boolean),
          openToMentoring: values.openToMentoring,
          openToReferrals: values.openToReferrals,
          openToSpeaking: values.openToSpeaking,
        }
      : { skills: values.skills.map((s) => s.trim()).filter(Boolean) };
  }

  function unchanged(index: number): boolean {
    if (index === 0) {
      return (
        values.currentCompany === initial.currentCompany &&
        values.designation === initial.designation &&
        values.industry === initial.industry
      );
    }
    if (index === 1) {
      return (
        values.city === initial.city &&
        values.state === initial.state &&
        values.country === initial.country
      );
    }
    return (
      JSON.stringify(values.skills) === JSON.stringify(initial.skills) &&
      values.openToMentoring === initial.openToMentoring &&
      values.openToReferrals === initial.openToReferrals &&
      values.openToSpeaking === initial.openToSpeaking
    );
  }

  function finish() {
    router.push('/dashboard');
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (step === 3) {
      if (values.visibility !== initial.visibility) {
        // The notice version travels with the consent. If the college has
        // published a new notice since this page loaded, the route refuses
        // rather than record agreement to text nobody was shown.
        const ok = await post('/api/settings/privacy', {
          visibility: values.visibility,
          noticeVersion,
        });
        if (!ok) return;
      }
      toast.success('You are set up', 'Everything here can be changed later from your profile.');
      finish();
      return;
    }

    if (!unchanged(step)) {
      const ok = await post('/api/profile', payloadFor(step));
      if (!ok) return;
    }

    setStep(step + 1);
  }

  function onSkip() {
    setErrors({});
    setFormError(null);
    if (step === 3) {
      finish();
      return;
    }
    setStep(step + 1);
  }

  // ---- skills chips -----------------------------------------------------

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

  // ---- availability choice ---------------------------------------------

  const anyAvailability =
    values.openToMentoring || values.openToReferrals || values.openToSpeaking;
  const [openToAsking, setOpenToAsking] = React.useState(anyAvailability);

  function chooseNotRightNow() {
    setOpenToAsking(false);
    setValues((v) => ({
      ...v,
      openToMentoring: false,
      openToReferrals: false,
      openToSpeaking: false,
    }));
  }

  // ---- steps ------------------------------------------------------------

  const steps = [
    { label: 'Work', doneId: 'work' },
    { label: 'Location', doneId: 'city' },
    { label: isStudent ? 'Skills' : 'Skills and availability', doneId: 'skills' },
    { label: 'Privacy', doneId: null },
  ] as const;

  const current = steps[step]!;
  const alreadyFilled = current.doneId ? done.has(current.doneId) : false;

  return (
    <div className="space-y-4">
      {/* ---- Progress ---------------------------------------------------- */}

      <div className="space-y-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm font-medium" aria-live="polite">
            Step {step + 1} of {STEP_COUNT}
            <span className="ml-2 font-normal text-secondary">{current.label}</span>
          </p>
          <Link href="/dashboard" className="link text-xs">
            Skip all of this and open my dashboard
          </Link>
        </div>

        <Progress
          value={step}
          max={STEP_COUNT}
          tone="brand"
          label={`Step ${step + 1} of ${STEP_COUNT}`}
        />

        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {steps.map((s, i) => (
            <li
              key={s.label}
              className={i === step ? 'font-semibold text-primary' : undefined}
              aria-current={i === step ? 'step' : undefined}
            >
              <span className="tabular">{i + 1}.</span> {s.label}
              {i < step ? (
                <>
                  <Check className="ml-1 inline size-3 text-success-fg" aria-hidden="true" />
                  <span className="sr-only"> done</span>
                </>
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      <form onSubmit={onSubmit}>
        <section
          ref={sectionRef}
          tabIndex={-1}
          aria-labelledby="welcome-step-title"
          className="focus:outline-none"
        >
          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2" id="welcome-step-title">
                  {step === 0
                    ? isStudent
                      ? 'Where are you interning?'
                      : 'Where do you work now?'
                    : null}
                  {step === 1 ? 'Which city are you in?' : null}
                  {step === 2
                    ? isStudent
                      ? 'What can you already do?'
                      : 'What can students ask you about?'
                    : null}
                  {step === 3 ? 'Who can see your email and mobile?' : null}
                </CardTitle>
                <CardDescription>
                  {step === 0
                    ? isStudent
                      ? 'An alumnus reading a request from you looks at this line first. An internship, a project role, or nothing at all — all three are fine.'
                      : 'Company and designation are the two fields the directory is searched on most. This is how your batch finds you fourteen years later.'
                    : null}
                  {step === 1
                    ? isStudent
                      ? 'Alumni working in the city you are aiming at are the ones best placed to answer you. It is also how the alumni cell decides where to hold a placement drive.'
                      : 'Batch meets are organised city by city. An unlisted city gets no invitation — that is the whole reason this field exists.'
                    : null}
                  {step === 2
                    ? isStudent
                      ? 'Skills are how an alumnus decides whether they are the right person to reply. Without them you appear only in searches for your own name.'
                      : 'Skills are what a student filters on before they write to anyone, and the switches below decide whether they are told they may write at all.'
                    : null}
                  {step === 3
                    ? 'Your contact details are held in a separate table from your profile. Releasing them needs two things at once: the person asking must be entitled, and you must have agreed. This is your half.'
                    : null}
                </CardDescription>
              </div>

              {alreadyFilled ? (
                <Badge tone="success">
                  <Check className="size-3.5" aria-hidden="true" />
                  Already filled in
                </Badge>
              ) : null}
            </CardHeader>

            <CardBody className="space-y-5">
              {formError ? (
                <Alert tone="danger" title="That step was not saved">
                  {formError}
                </Alert>
              ) : null}

              {/* ---- Step 1: current work ------------------------------- */}

              {step === 0 ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      htmlFor="w-company"
                      label={isStudent ? 'Company, if you are interning' : 'Employer'}
                      error={errors.currentCompany}
                    >
                      <Input
                        id="w-company"
                        value={values.currentCompany}
                        onChange={(e) => set('currentCompany', e.currentTarget.value)}
                        placeholder={isStudent ? 'Cognizant' : 'Amazon'}
                        autoComplete="organization"
                        invalid={Boolean(errors.currentCompany)}
                      />
                    </Field>

                    <Field
                      htmlFor="w-designation"
                      label={isStudent ? 'Role' : 'Designation'}
                      error={errors.designation}
                    >
                      <Input
                        id="w-designation"
                        value={values.designation}
                        onChange={(e) => set('designation', e.currentTarget.value)}
                        placeholder={isStudent ? 'Software Intern' : 'Senior Software Engineer'}
                        autoComplete="organization-title"
                        invalid={Boolean(errors.designation)}
                      />
                    </Field>
                  </div>

                  <Field
                    htmlFor="w-industry"
                    label="Industry"
                    hint="Used to group alumni when the placement cell goes looking for a particular sector. It is never shown as a filter to students on its own."
                    error={errors.industry}
                  >
                    <Input
                      id="w-industry"
                      list="w-industry-options"
                      value={values.industry}
                      onChange={(e) => set('industry', e.currentTarget.value)}
                      placeholder="Information Technology"
                      invalid={Boolean(errors.industry)}
                      aria-describedby={describedBy('w-industry', {
                        hint: true,
                        error: Boolean(errors.industry),
                      })}
                    />
                    <datalist id="w-industry-options">
                      {INDUSTRIES.map((i) => (
                        <option key={i} value={i} />
                      ))}
                    </datalist>
                  </Field>

                  <WhyNote icon={<Briefcase className="size-4" />}>
                    {isStudent
                      ? 'Nothing here is checked against the college record — an internship is yours to state. Your roll number, branch and batch came from the register and are not editable by anyone but the alumni cell.'
                      : 'This is the field that goes stale first. Change it whenever you move; the directory shows the new version on the next page load, and nobody is notified.'}
                  </WhyNote>
                </>
              ) : null}

              {/* ---- Step 2: location ----------------------------------- */}

              {step === 1 ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field htmlFor="w-city" label="City" error={errors.city}>
                      <Input
                        id="w-city"
                        list="w-city-options"
                        value={values.city}
                        onChange={(e) => set('city', e.currentTarget.value)}
                        placeholder="Hyderabad"
                        autoComplete="address-level2"
                        invalid={Boolean(errors.city)}
                      />
                      <datalist id="w-city-options">
                        {CITIES.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </Field>

                    <Field htmlFor="w-state" label="State or region" error={errors.state}>
                      <Input
                        id="w-state"
                        value={values.state}
                        onChange={(e) => set('state', e.currentTarget.value)}
                        placeholder="Telangana"
                        autoComplete="address-level1"
                        invalid={Boolean(errors.state)}
                      />
                    </Field>
                  </div>

                  <Field
                    htmlFor="w-country"
                    label="Country"
                    hint="Alumni outside India get the video sessions rather than the campus ones, and the reunion mail goes out on a timetable that suits their time zone."
                  >
                    <Select
                      id="w-country"
                      value={values.country}
                      onChange={(e) => set('country', e.currentTarget.value)}
                      aria-describedby={describedBy('w-country', { hint: true })}
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <WhyNote icon={<MapPin className="size-4" />}>
                    Only the city, state and country are stored — never an address. A city is enough
                    to be invited to the Vijayawada meet or the Bengaluru one; a street is not
                    something the portal has any use for.
                  </WhyNote>
                </>
              ) : null}

              {/* ---- Step 3: skills and availability -------------------- */}

              {step === 2 ? (
                <>
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
                    htmlFor="w-skills"
                    label="Add a skill"
                    hint="Press Enter or comma after each one. Three is the point at which you start appearing in searches that are not for your own name."
                    error={errors.skills}
                  >
                    <div className="flex gap-2">
                      <Input
                        id="w-skills"
                        value={skillDraft}
                        onChange={(e) => setSkillDraft(e.currentTarget.value)}
                        onKeyDown={onSkillKeyDown}
                        onBlur={() => addSkill(skillDraft)}
                        placeholder={isStudent ? 'React' : 'System Design'}
                        invalid={Boolean(errors.skills)}
                        aria-describedby={describedBy('w-skills', {
                          hint: true,
                          error: Boolean(errors.skills),
                        })}
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

                  {availabilityApplies ? (
                    <div className="space-y-4 border-t border-line pt-5">
                      <Fieldset
                        legend="Can students send you a request?"
                        hint="Both answers are ordinary. Roughly half the directory has all three switches off, and nobody is shown a list of who said no."
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <ChoiceCard selected={openToAsking}>
                            <Radio
                              id="w-open-yes"
                              name="availability"
                              value="yes"
                              label="Yes, they can ask"
                              hint="You choose what they may ask about on the next line. Every request still needs your reply — none of this is automatic."
                              checked={openToAsking}
                              onChange={() => setOpenToAsking(true)}
                            />
                          </ChoiceCard>

                          <ChoiceCard selected={!openToAsking}>
                            <Radio
                              id="w-open-no"
                              name="availability"
                              value="no"
                              label="Not right now"
                              hint="No request reaches you and no student is told to ask. You stay in the directory with your batch, branch and employer, which is most of what people search on."
                              checked={!openToAsking}
                              onChange={chooseNotRightNow}
                            />
                          </ChoiceCard>
                        </div>
                      </Fieldset>

                      {openToAsking ? (
                        <div className="space-y-5 rounded-lg border border-line p-4">
                          <Switch
                            id="w-mentoring"
                            label="Mentoring"
                            hint="A student may send you one message asking for guidance — preparation, higher studies, which way to go next. Five open requests each and ten a month across the whole portal, so you cannot be flooded. Declining is silent: they are not told why, and they cannot ask again while a request is open."
                            checked={values.openToMentoring}
                            onChange={(e) => set('openToMentoring', e.currentTarget.checked)}
                          />
                          <Switch
                            id="w-referrals"
                            label="Referrals"
                            hint={
                              values.currentCompany.trim()
                                ? `A student may ask you to refer them at ${values.currentCompany.trim()}. You see their name, branch, batch and what they have built before you decide. It commits you to reading a request — never to making the referral.`
                                : 'Add your employer on the first step and this switch has a company to point at. A referral request with no company attached is not a request anyone can act on.'
                            }
                            checked={values.openToReferrals}
                            disabled={!values.currentCompany.trim()}
                            onChange={(e) => set('openToReferrals', e.currentTarget.checked)}
                          />
                          <Switch
                            id="w-speaking"
                            label="Speaking on campus"
                            hint="The alumni cell may invite you to a session — usually two hours on a Saturday, at Ganguru or over video. An invitation you can turn down, not a booking. Students cannot invite you directly."
                            checked={values.openToSpeaking}
                            onChange={(e) => set('openToSpeaking', e.currentTarget.checked)}
                          />

                          {!anyAvailability ? (
                            <p className="text-xs text-muted">
                              None of the three is on yet, so this is the same as choosing
                              &ldquo;not right now&rdquo;. Turn on whichever you actually mean.
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <Alert tone="neutral" title="Nothing will be sent to you">
                          <p>
                            {mentorshipOn
                              ? 'You will not appear on the mentorship page and no student is prompted to write to you. '
                              : 'No student is prompted to write to you. '}
                            This can be turned on from your profile at any time, and the portal will
                            not ask you again.
                          </p>
                        </Alert>
                      )}
                    </div>
                  ) : (
                    <Alert
                      tone="neutral"
                      title={
                        isStudent
                          ? 'Mentoring and referrals come later'
                          : 'Requests are switched off for this college'
                      }
                    >
                      {isStudent
                        ? 'The mentoring, referral and speaking switches belong to alumni — they are how an alumnus says what a final-year may ask them. Your account gets them when your batch is rolled over after graduation. Nothing to set today.'
                        : `Connection requests are not enabled on ${shortName} yet, so there is nothing for these switches to control. Your skills still make you findable in the directory.`}
                    </Alert>
                  )}
                </>
              ) : null}

              {/* ---- Step 4: privacy ------------------------------------ */}

              {step === 3 ? (
                <>
                  <Fieldset
                    legend="Who can see your contact details"
                    hint="This is consent, and it can be changed whenever you like. Changing it narrows what is released next — it does not withdraw an address already given to somebody whose request you accepted."
                  >
                    <div className="space-y-3">
                      {VISIBILITY_OPTIONS.map((o) => (
                        // A plain div, not a wrapping label: `Radio` renders
                        // its own label, and a label inside a label is
                        // invalid and confuses every screen reader
                        // differently.
                        <ChoiceCard key={o.value} selected={values.visibility === o.value}>
                          <Radio
                            id={`w-visibility-${o.value}`}
                            name="visibility"
                            value={o.value}
                            label={o.label}
                            hint={o.hint}
                            checked={values.visibility === o.value}
                            onChange={() => set('visibility', o.value)}
                          />
                        </ChoiceCard>
                      ))}
                    </div>
                  </Fieldset>

                  <Alert tone="neutral" title="Two things this setting does not change" icon={<ShieldCheck className="size-4" />}>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      <li>
                        Your mobile number is never listed in the directory at any setting. It is
                        released only on a connection you have accepted, or to the college admin.
                      </li>
                      <li>
                        The college admin can export contact details in bulk for things like a NAAC
                        submission. It is the only role that can, and every export is written to the
                        audit log with who did it and why.
                      </li>
                    </ul>
                  </Alert>

                  <p className="text-xs text-muted">
                    Recorded against privacy notice{' '}
                    <span className="font-mono">{noticeVersion}</span>. The full control, the
                    role-by-role table of what each member of staff can see, and your consent
                    history are on{' '}
                    <Link href="/settings/privacy" className="link">
                      your privacy settings
                    </Link>
                    .
                  </p>
                </>
              ) : null}

              {/* ---- Actions -------------------------------------------- */}

              <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                {step > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep(step - 1)}
                    disabled={saving}
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Back
                  </Button>
                ) : null}

                <div className="ml-auto flex flex-wrap items-center gap-3">
                  {/* Deliberately a real button of the same size as the one
                      beside it. Skipping is a legitimate answer, and a
                      wizard that renders it as a whisper is a wizard that
                      collects bad data. */}
                  <Button type="button" variant="secondary" onClick={onSkip} disabled={saving}>
                    {step === 3 ? 'Decide this later' : 'Skip this step'}
                  </Button>

                  <Button type="submit" loading={saving}>
                    {step === 3 ? (
                      <>
                        <Sparkles className="size-4" aria-hidden="true" />
                        Finish and open my dashboard
                      </>
                    ) : (
                      'Save and continue'
                    )}
                  </Button>
                </div>
              </div>

              {stored === false ? (
                <p className="text-xs text-muted">
                  This deployment runs on the seeded dataset and has no writable store yet.
                  Validation, the permission checks and the audit entry all ran on that save;
                  nothing was written. What you typed stays on this screen until you leave it.
                </p>
              ) : null}
            </CardBody>
          </Card>
        </section>
      </form>

      {!directoryOn ? (
        <p className="text-xs text-muted">
          The member directory is switched off for {shortName} at the moment, so nothing you fill in
          here is visible to another member yet. It is held against your record for when the college
          turns it on.
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------

/**
 * A radio option with the weight of a card.
 *
 * The selected border uses the derived primary token rather than a ramp
 * stop, so it stays legible on both grounds without a second definition.
 */
function ChoiceCard({ selected, children }: { selected: boolean; children: React.ReactNode }) {
  return (
    <div
      className={
        selected
          ? 'rounded-lg border border-[var(--button-primary-bg)] bg-surface-sunken p-3.5 transition-colors duration-fast ease-brand'
          : 'rounded-lg border border-line p-3.5 transition-colors duration-fast ease-brand hover:bg-surface-sunken'
      }
    >
      {children}
    </div>
  );
}

function WhyNote({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="flex gap-2.5 border-t border-line pt-4 text-xs text-secondary">
      <span className="mt-0.5 shrink-0 text-muted" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}

// ---------------------------------------------------------------
// Copy
// ---------------------------------------------------------------

const VISIBILITY_OPTIONS: Array<{ value: ContactVisibility; label: string; hint: string }> = [
  {
    value: 'on_accept',
    label: 'Only people whose request I accept',
    hint: 'The default, and the setting the network is designed around. Anyone else sees a masked address and is told that release is your decision, not a restriction the college applied to them.',
  },
  {
    value: 'alumni_only',
    label: 'Alumni and faculty',
    hint: 'They see your email and mobile without asking. Students cannot, whatever they ask for — they still have to send a request.',
  },
  {
    value: 'all_members',
    label: 'Every verified member',
    hint: 'Your email is shown to any signed-in, verified member. Your mobile number is still never listed. Nothing here is ever public: the directory has no anonymous view.',
  },
  {
    value: 'private',
    label: 'Nobody',
    hint: 'No member sees your email or mobile through the portal. People can still send you a request and you can reply from your own inbox — declining to publish an address is not the same as declining to be reachable.',
  },
];

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
