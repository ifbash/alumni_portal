'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, MapPin, Plus, X } from 'lucide-react';
import {
  Alert,
  Avatar,
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
import { cn } from '@/lib/cn';
import { outcomeToast } from '@/lib/client/api';
import { availabilityEntries } from '@/lib/availability-copy';
import { VISIBILITY_FOOTNOTE, VISIBILITY_OPTIONS } from '@/lib/visibility-copy';
import type { ContactVisibility } from '@/lib/data/types';
import type { ProfileCheck } from '../profile/completeness';

/**
 * The first-run wizard.
 *
 * A welcome panel, four steps, and a last screen. Each step can be
 * skipped with a button as prominent as the one that continues. The two
 * things worth defending:
 *
 *  1. **Each step saves on its own.** A member who fills in step one and
 *     closes the tab keeps step one. A wizard that only writes at the end
 *     throws away most of what people actually typed.
 *  2. **The availability step states the commitment, not the label.** The
 *     lines come from `availabilityCopy()`, the same words the profile form
 *     and the home page use. "Not right now" is rendered as an equal choice
 *     because for a lot of people it is the correct one.
 *
 * The welcome band, the header shown during the steps and the last screen
 * are rendered on the server and passed in; this component only chooses
 * which is showing. `StartSetupButton`, placed in the band by the page,
 * reaches the wizard through context.
 */

export interface WelcomeValues {
  photoUrl: string;
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

/** Who is being welcomed: it changes the words, never what is saved. */
export type WelcomeAudience = 'alumni' | 'faculty' | 'student';

type FieldErrors = Record<string, string | undefined>;

const STEP_COUNT = 4;

const StartContext = React.createContext<(() => void) | null>(null);

/** "Set up in a minute", for the welcome band. Starts step one. */
export function StartSetupButton() {
  const start = React.useContext(StartContext);
  return (
    <Button type="button" variant="band" className="min-h-11" onClick={() => start?.()}>
      Set up in a minute
      <ArrowRight className="size-4" aria-hidden="true" />
    </Button>
  );
}

export function WelcomeWizard({
  intro,
  header,
  done: doneScreen,
  name,
  values: initial,
  checks,
  audience,
  noticeVersion,
  shortName,
  officeName,
  openLimit,
  connectionsOn,
  mentorshipOn,
  directoryOn,
}: {
  /** The welcome band, shown before step one. */
  intro: React.ReactNode;
  /** The compact band shown above the steps and the last screen. */
  header: React.ReactNode;
  /** The last screen. */
  done: React.ReactNode;
  /** The member's own name, for the photo preview's initials. */
  name: string;
  values: WelcomeValues;
  checks: ProfileCheck[];
  audience: WelcomeAudience;
  noticeVersion: string;
  shortName: string;
  /** The pack's office, mid-sentence ("alumni cell"). */
  officeName: string;
  /** The per-student open-request limit, for the referrals explanation. */
  openLimit: number;
  connectionsOn: boolean;
  mentorshipOn: boolean;
  directoryOn: boolean;
}) {
  const toast = useToast();
  const isStudent = audience === 'student';

  const [stage, setStage] = React.useState<'intro' | 'steps' | 'done'>('intro');
  const [step, setStep] = React.useState(0);
  const [values, setValues] = React.useState<WelcomeValues>(initial);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  /** Whether the "checked, not saved" note has been shown once already. */
  const toldUnsaved = React.useRef(false);

  const filled = React.useMemo(
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
  }, [step, stage]);

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
      // told us there is no store behind it. Say so once, the way every
      // other form does, rather than on every step.
      if (body?.persisted === false && !toldUnsaved.current) {
        toldUnsaved.current = true;
        const t = outcomeToast({ status: 'ok', data: null, persisted: false }, 'Step checked');
        if (t) toast.show(t);
      }

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
        photoUrl: values.photoUrl.trim() || null,
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
        values.photoUrl === initial.photoUrl &&
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
    setErrors({});
    setFormError(null);
    setStage('done');
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

  const entries = availabilityEntries({
    audience: audience === 'faculty' ? 'faculty' : 'alumni',
    company: values.currentCompany,
    officeName,
    openLimit,
  });
  const FIELD = {
    mentoring: 'openToMentoring',
    referrals: 'openToReferrals',
    speaking: 'openToSpeaking',
  } as const;

  // ---- steps ------------------------------------------------------------

  const steps = [
    { label: 'Work', long: isStudent ? 'Internship or project' : 'Work', doneIds: ['work'] },
    { label: 'City', long: 'City', doneIds: ['city'] },
    {
      label: availabilityApplies ? 'Skills and availability' : 'Skills',
      long: availabilityApplies ? 'Skills and what you are open to' : 'Skills',
      doneIds: ['skills'],
    },
    { label: 'Contact', long: 'Who sees your contact', doneIds: [] as string[] },
  ];

  const current = steps[step]!;
  const alreadyFilled = current.doneIds.length > 0 && current.doneIds.every((id) => filled.has(id));

  const photoPreview = /^(https:\/\/|\/)/.test(values.photoUrl.trim()) ? values.photoUrl.trim() : null;

  const benefit = BENEFIT[audience][step]!;

  if (stage === 'intro') {
    return (
      <StartContext.Provider value={() => setStage('steps')}>
        {intro}
        <section aria-labelledby="welcome-steps-title" className="rounded-lg border border-line bg-surface-raised p-card shadow-sm">
          <h2 id="welcome-steps-title" className="text-sm font-semibold text-primary">
            Four short steps
          </h2>
          <ol className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.label} className="flex items-center gap-2.5 text-sm text-primary">
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold tabular text-brand-soft-fg"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                {s.long}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-secondary">Each one saves on its own, and you can skip any of them.</p>
        </section>
      </StartContext.Provider>
    );
  }

  if (stage === 'done') {
    return (
      <>
        {header}
        <section ref={sectionRef} tabIndex={-1} aria-label="Set up finished" className="focus:outline-none">
          {doneScreen}
        </section>
      </>
    );
  }

  return (
    <>
      {header}

      {/* ---- Progress ---------------------------------------------------- */}

      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium" aria-live="polite">
            Step {step + 1} of {STEP_COUNT}
            <span className="font-normal text-secondary"> · {current.label}</span>
          </p>
          <Link
            href="/dashboard"
            className="-my-2 inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-brand-fg hover:underline"
          >
            Skip for now
          </Link>
        </div>

        <Progress
          value={step}
          max={STEP_COUNT}
          tone="brand"
          label={`Step ${step + 1} of ${STEP_COUNT}`}
        />

        <ol className="hidden gap-x-5 text-xs text-secondary sm:flex">
          {steps.map((s, i) => (
            <li
              key={s.label}
              className={cn('inline-flex items-center gap-1', i === step && 'font-semibold text-primary')}
              aria-current={i === step ? 'step' : undefined}
            >
              {i < step ? (
                <>
                  <Check className="size-3.5 text-success-fg" aria-hidden="true" />
                  <span className="sr-only">Done: </span>
                </>
              ) : (
                <span className="tabular">{i + 1}.</span>
              )}
              {s.label}
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
            <CardHeader variant="stack">
              <div className="flex w-full items-start justify-between gap-3">
                <CardTitle as="h2" id="welcome-step-title" className="min-w-0">
                  {step === 0 ? (isStudent ? 'Where are you interning?' : 'Where do you work now?') : null}
                  {step === 1 ? 'Which city are you in?' : null}
                  {step === 2
                    ? isStudent
                      ? 'What can you already do?'
                      : 'What can students ask you about?'
                    : null}
                  {step === 3 ? 'Who can see your email and mobile?' : null}
                </CardTitle>
                {alreadyFilled ? (
                  <Badge tone="success" className="mt-1 shrink-0">
                    <Check className="size-3.5" aria-hidden="true" />
                    Filled in
                  </Badge>
                ) : null}
              </div>
              <CardDescription>{benefit}</CardDescription>
            </CardHeader>

            <CardBody className="space-y-5">
              {formError ? (
                <Alert tone="danger" title="That step was not saved">
                  {formError}
                </Alert>
              ) : null}

              {/* ---- Step 1: work and photo ---------------------------- */}

              {step === 0 ? (
                <>
                  <div className="flex items-end gap-4">
                    <Avatar name={name} src={photoPreview} size="lg" />
                    <Field
                      htmlFor="w-photo"
                      label="Photo link"
                      hint="An https link to a photo of you. Optional."
                      error={errors.photoUrl}
                      className="min-w-0 flex-1"
                    >
                      <Input
                        id="w-photo"
                        type="url"
                        inputMode="url"
                        value={values.photoUrl}
                        onChange={(e) => set('photoUrl', e.currentTarget.value)}
                        placeholder="https://"
                        invalid={Boolean(errors.photoUrl)}
                        aria-describedby={describedBy('w-photo', {
                          hint: true,
                          error: Boolean(errors.photoUrl),
                        })}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field
                      htmlFor="w-company"
                      label={isStudent ? 'Company, if you are interning' : 'Employer'}
                      error={errors.currentCompany}
                    >
                      <Input
                        id="w-company"
                        value={values.currentCompany}
                        onChange={(e) => set('currentCompany', e.currentTarget.value)}
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
                        autoComplete="organization-title"
                        invalid={Boolean(errors.designation)}
                      />
                    </Field>
                  </div>

                  <Field htmlFor="w-industry" label="Industry" error={errors.industry}>
                    <Input
                      id="w-industry"
                      list="w-industry-options"
                      value={values.industry}
                      onChange={(e) => set('industry', e.currentTarget.value)}
                      invalid={Boolean(errors.industry)}
                    />
                    <datalist id="w-industry-options">
                      {INDUSTRIES.map((i) => (
                        <option key={i} value={i} />
                      ))}
                    </datalist>
                  </Field>
                </>
              ) : null}

              {/* ---- Step 2: city --------------------------------------- */}

              {step === 1 ? (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field htmlFor="w-city" label="City" error={errors.city}>
                      <Input
                        id="w-city"
                        list="w-city-options"
                        value={values.city}
                        onChange={(e) => set('city', e.currentTarget.value)}
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
                        autoComplete="address-level1"
                        invalid={Boolean(errors.state)}
                      />
                    </Field>
                  </div>

                  <Field htmlFor="w-country" label="Country">
                    <Select
                      id="w-country"
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

                  <p className="flex gap-2 text-sm text-secondary">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                    Only your city, state and country are stored, never an address.
                  </p>
                </>
              ) : null}

              {/* ---- Step 3: skills and availability -------------------- */}

              {step === 2 ? (
                <>
                  {values.skills.length ? (
                    <ul className="flex flex-wrap gap-1.5" aria-label="Your skills">
                      {values.skills.map((s) => (
                        <li key={s}>
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-1 pl-2.5 pr-1 text-xs font-semibold text-brand-soft-fg">
                            {s}
                            <button
                              type="button"
                              onClick={() => set('skills', values.skills.filter((x) => x !== s))}
                              aria-label={`Remove ${s}`}
                              className="relative grid size-6 place-items-center rounded-full after:absolute after:-inset-2.5 after:content-[''] hover:bg-surface-raised"
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
                    hint="Press Enter or a comma after each one."
                    error={errors.skills}
                  >
                    <div className="flex gap-2">
                      <Input
                        id="w-skills"
                        value={skillDraft}
                        onChange={(e) => setSkillDraft(e.currentTarget.value)}
                        onKeyDown={onSkillKeyDown}
                        onBlur={() => addSkill(skillDraft)}
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
                        hint="Either answer is fine. You can change it from your profile at any time."
                      >
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <ChoiceCard selected={openToAsking}>
                            <Radio
                              id="w-open-yes"
                              name="availability"
                              value="yes"
                              label="Yes, they can ask"
                              hint="Choose what about below. You reply to each request yourself."
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
                              hint={
                                mentorshipOn
                                  ? 'You stay in the directory, but not on the mentorship page.'
                                  : 'You stay in the directory with your batch, branch and employer.'
                              }
                              checked={!openToAsking}
                              onChange={chooseNotRightNow}
                            />
                          </ChoiceCard>
                        </div>
                      </Fieldset>

                      {openToAsking ? (
                        <ul className="space-y-4 rounded-lg border border-line p-4">
                          {entries.map((a) => {
                            const needsCompany = a.key === 'referrals' && !values.currentCompany.trim();
                            return (
                              <li key={a.key}>
                                <Switch
                                  id={`w-${a.key}`}
                                  label={a.label}
                                  hint={needsCompany ? 'Add your employer on the first step to turn this on.' : a.line}
                                  checked={values[FIELD[a.key]]}
                                  disabled={needsCompany}
                                  onChange={(e) => set(FIELD[a.key], e.currentTarget.checked)}
                                />
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </div>
                  ) : isStudent ? (
                    <p className="border-t border-line pt-4 text-sm text-secondary">
                      After you graduate, this is where you can offer to help the final-year students
                      who come after you.
                    </p>
                  ) : null}
                </>
              ) : null}

              {/* ---- Step 4: who sees your contact ---------------------- */}

              {step === 3 ? (
                <fieldset className="space-y-3">
                  {/* The card title already asks the question on screen. */}
                  <legend className="sr-only">Who can see your email and mobile</legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                          label={
                            o.recommended ? (
                              <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                                {o.label}
                                <Badge tone="brand">Recommended</Badge>
                              </span>
                            ) : (
                              o.label
                            )
                          }
                          hint={o.line}
                          checked={values.visibility === o.value}
                          onChange={() => set('visibility', o.value)}
                        />
                      </ChoiceCard>
                    ))}
                  </div>
                  <p className="text-sm text-secondary">
                    {VISIBILITY_FOOTNOTE}{' '}
                    <Link href="/settings/privacy" className="link">
                      Privacy settings
                    </Link>
                  </p>
                </fieldset>
              ) : null}

              {/* ---- Actions -------------------------------------------- */}

              <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                {step > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep(step - 1)}
                    disabled={saving}
                    className="min-h-11"
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Back
                  </Button>
                ) : null}

                <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
                  {/* Deliberately a real button of the same size as the one
                      beside it. Skipping is a legitimate answer, and a
                      wizard that renders it as a whisper is a wizard that
                      collects bad data. */}
                  <Button type="button" variant="secondary" onClick={onSkip} disabled={saving} className="min-h-11">
                    {step === 3 ? 'Decide later' : 'Skip this step'}
                  </Button>

                  <Button type="submit" loading={saving} className="min-h-11">
                    {step === 3 ? 'Save and finish' : 'Save and continue'}
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </section>
      </form>

      {!directoryOn ? (
        <p className="text-sm text-secondary">
          The directory is switched off for {shortName} at the moment, so other members cannot see
          this yet.
        </p>
      ) : null}
    </>
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

// ---------------------------------------------------------------
// Copy
// ---------------------------------------------------------------

/** One line per step: what filling it in does for this member. */
const BENEFIT: Record<WelcomeAudience, readonly string[]> = {
  alumni: [
    'Batchmates and final-year students search the directory by company and role.',
    'Batchmates can find you by city in the directory.',
    'Final-year students filter on skills before they ask anyone for help.',
    'You decide who sees them, and you can change it at any time.',
  ],
  faculty: [
    'Graduates and final-year students search the directory by role.',
    'Graduates can find you by city in the directory.',
    'Final-year students filter on skills before they ask anyone for help.',
    'You decide who sees them, and you can change it at any time.',
  ],
  student: [
    'Faculty and the placement cell see this on your profile.',
    'Your profile stays with you when you graduate, so this is ready then.',
    'Faculty and the placement cell can find you by skill.',
    'You decide who sees them, and you can change it at any time.',
  ],
};

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

/** Suggestions only: large Indian cities, alphabetical. The field takes any city. */
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
