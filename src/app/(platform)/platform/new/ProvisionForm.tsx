'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AtSign,
  BadgeCheck,
  CircleAlert,
  CircleCheck,
  CircleSlash2,
  Database,
  Eye,
  FileJson,
  Globe,
  Landmark,
  Lock,
  Server,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  ConfirmDialog,
  Field,
  Fieldset,
  FormActions,
  Input,
  Radio,
  Separator,
  Skeleton,
  Spinner,
  Switch,
  useToast,
} from '@/components/ui';
import { api, outcomeToast, type ApiOutcome } from '@/lib/client/api';
import { cn } from '@/lib/cn';
import type { Feature } from '@/lib/branding/pack';

/**
 * Onboarding a college.
 *
 * Three steps, and the third one is the point: before anything is written,
 * the form names every row it is about to create. Provisioning a tenant is
 * not reversible by clicking again — a half-created college with a live
 * subdomain and no admin invite is worse than no college at all.
 *
 * That third step is not this file's opinion. Arriving on it posts the
 * whole form to `POST /api/platform/tenants` with `dryRun: true`, and what
 * is listed is what the handler says it would write — same route, same
 * schema, same collision checks, one flag apart from the call the button
 * makes. A summary composed here would drift from the writer the first
 * time the schema moved, and this is the one screen where a description
 * that has quietly stopped being true is expensive.
 *
 * The subdomain check as you type runs against the tenant list the server
 * passed down. A name that is free here can still lose a race, so the API
 * checks it again against both namespaces — existing tenants and the brand
 * pack registry — and answers 409. The real guarantee is the unique index
 * on `tenants.subdomain`; everything before it is courtesy.
 */

export interface PackChoice {
  id: string;
  portalName: string;
  institutionName: string;
  primary: string;
  /** Derived server-side by the same contrast rule the button tokens use. */
  onPrimary: string;
}

type Plan = 'trial' | 'standard' | 'institution';
type Fcra = 'unknown' | 'registered' | 'not_registered';
type Availability = 'empty' | 'invalid' | 'reserved' | 'taken' | 'available';

interface Errors {
  institution?: string;
  shortName?: string;
  subdomain?: string;
  email?: string;
}

const FEATURE_LIST: Array<{ key: Feature; label: string; hint: string }> = [
  { key: 'directory', label: 'Directory', hint: 'Search alumni by branch, batch, company and city. Never anonymous.' },
  { key: 'connections', label: 'Connections', hint: 'Mentorship and referral requests, with per-cohort quotas on both sides.' },
  { key: 'events', label: 'Events', hint: 'Reunions, department sessions, ticketing and check-in.' },
  { key: 'jobs', label: 'Jobs', hint: 'Alumni post roles; the placement cell moderates before anything goes live.' },
  { key: 'mentorship', label: 'Mentorship', hint: 'Availability flags on profiles and structured mentoring requests.' },
  { key: 'gallery', label: 'Gallery', hint: 'Photo sets attached to events and batches.' },
  { key: 'news', label: 'News', hint: 'Announcements on the portal home and, if enabled, the public landing page.' },
  { key: 'whatsapp', label: 'WhatsApp', hint: 'Business API templates. Email open rates on Indian alumni lists are poor.' },
  { key: 'publicLanding', label: 'Public landing page', hint: 'A signed-out marketing page on the college’s subdomain. The directory itself stays behind sign-in either way.' },
];

const PLANS: Array<{ value: Plan; label: string; hint: string }> = [
  {
    value: 'trial',
    label: 'Trial — 90 days',
    hint: 'The whole feature set, no commitment. Converts to a licence or lapses; nothing is deleted when it does.',
  },
  {
    value: 'standard',
    label: 'Standard licence',
    hint: 'Directory, connections, events and jobs. The right shape for a college running its own alumni cell.',
  },
  {
    value: 'institution',
    label: 'Institution licence',
    hint: 'Everything, including giving, segmented communications and multi-department scoping.',
  },
];

const DEFAULT_FEATURES: Record<Feature, boolean> = {
  directory: true,
  connections: true,
  events: true,
  jobs: true,
  mentorship: true,
  donations: false,
  gallery: true,
  news: true,
  whatsapp: false,
  publicLanding: true,
};

const FREE_MAIL = ['gmail.com', 'yahoo.com', 'yahoo.co.in', 'outlook.com', 'hotmail.com', 'rediffmail.com'];

const slugify = (v: string): string =>
  v
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

/** Kept identical to the regex the provisioning endpoint enforces. */
const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,30})[a-z0-9]$/;

const SUBDOMAIN_RULE =
  'Two to thirty-two characters: lowercase letters, digits and hyphens, not starting or ending with a hyphen.';

// ---------------------------------------------------------------
// What the provisioning endpoint answers with
// ---------------------------------------------------------------
//
// The shape of `POST /api/platform/tenants`. Both the dry run and the
// write return it; `dryRun` says which one you are looking at.

interface PlanField {
  label: string;
  value: string;
}

type PlanKey = 'tenant' | 'rls' | 'branding' | 'invite' | 'audit';

interface PlanItem {
  key: PlanKey;
  title: string;
  detail: string;
  fields: PlanField[];
}

interface PlanOmission {
  title: string;
  detail: string;
}

interface ProvisionPlan {
  ok: true;
  dryRun: boolean;
  /** Absent on a real write; `false` when the store is not behind this build. */
  persisted?: boolean;
  tenantId: string;
  subdomain: string;
  host: string;
  packId: string;
  plan: Plan;
  modulesOn: string[];
  creates: PlanItem[];
  notCreated: PlanOmission[];
  warnings: string[];
  isolation: string;
  note: string;
  provisionedAt?: string;
  auditedAs?: string;
}

/** Presentation only. Every word in the list comes from the server. */
const PLAN_ICON: Record<PlanKey, React.ReactNode> = {
  tenant: <Database className="size-4" />,
  rls: <ShieldCheck className="size-4" />,
  branding: <FileJson className="size-4" />,
  invite: <UserPlus className="size-4" />,
  audit: <BadgeCheck className="size-4" />,
};

/** Server field name → the Field on this form that caused it. */
const FIELD_MAP: Record<string, keyof Errors> = {
  institutionName: 'institution',
  shortName: 'shortName',
  subdomain: 'subdomain',
  adminEmail: 'email',
};

function mapFieldErrors(raw: Record<string, unknown>): { mapped: Errors; rest: string[] } {
  const mapped: Errors = {};
  const rest: string[] = [];

  for (const [key, value] of Object.entries(raw)) {
    const text = Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
    if (!text) continue;
    const target = FIELD_MAP[key];
    if (target) mapped[target] = text;
    else rest.push(text);
  }

  return { mapped, rest };
}

export function ProvisionForm({
  packs,
  taken,
  reserved,
  rootDomain,
  actorName,
}: {
  packs: PackChoice[];
  taken: Array<{ subdomain: string; name: string }>;
  reserved: string[];
  rootDomain: string;
  actorName: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = React.useState<1 | 2 | 3>(1);

  const [institution, setInstitution] = React.useState('');
  const [shortName, setShortName] = React.useState('');
  const [shortTouched, setShortTouched] = React.useState(false);
  const [subdomain, setSubdomain] = React.useState('');
  const [subTouched, setSubTouched] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [plan, setPlan] = React.useState<Plan>('trial');

  const [packId, setPackId] = React.useState(packs[0]?.id ?? '');
  const [fcra, setFcra] = React.useState<Fcra>('unknown');
  const [features, setFeatures] = React.useState<Record<Feature, boolean>>(DEFAULT_FEATURES);
  const [seedRegister, setSeedRegister] = React.useState(true);

  const [errors, setErrors] = React.useState<Errors>({});
  const [confirming, setConfirming] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  /** The server's description of this provision. Never composed here. */
  const [blueprint, setBlueprint] = React.useState<ProvisionPlan | null>(null);
  const [blueprintError, setBlueprintError] = React.useState<string | null>(null);
  const [planning, setPlanning] = React.useState(false);
  /** Set once the write has been accepted, so the button cannot fire twice. */
  const [created, setCreated] = React.useState<ProvisionPlan | null>(null);

  const slug = subdomain.trim().toLowerCase();
  const takenBy = taken.find((t) => t.subdomain === slug);

  const availability: Availability = !slug
    ? 'empty'
    : !SUBDOMAIN_RE.test(slug)
      ? 'invalid'
      : reserved.includes(slug)
        ? 'reserved'
        : takenBy
          ? 'taken'
          : 'available';

  const host = `${slug || 'your-college'}.${rootDomain}`;
  const tenantId = `ten-${slug || 'xxx'}`;
  const pack = packs.find((p) => p.id === packId) ?? packs[0];

  const emailDomain = email.includes('@') ? email.split('@')[1]?.toLowerCase() ?? '' : '';
  const freeMail = FREE_MAIL.includes(emailDomain);

  const featuresOn = FEATURE_LIST.filter((f) => features[f.key]);

  // Donations are a legal gate, not a rollout preference. The switch is not
  // merely defaulted off — it cannot be turned on until FCRA status is known.
  const donationsAllowed = fcra === 'registered';
  React.useEffect(() => {
    if (!donationsAllowed && features.donations) {
      setFeatures((f) => ({ ...f, donations: false }));
    }
  }, [donationsAllowed, features.donations]);

  const setInstitutionValue = (v: string) => {
    setInstitution(v);
    if (!shortTouched && !subTouched) {
      const derived = slugify(v);
      setSubdomain(derived.split('-').slice(0, 2).join('-'));
    }
  };

  const setShortNameValue = (v: string) => {
    setShortName(v);
    setShortTouched(true);
    if (!subTouched) setSubdomain(slugify(v));
  };

  const validateStepOne = (): Errors => {
    const e: Errors = {};
    if (institution.trim().length < 4) {
      e.institution = 'The registered name of the institution, as it appears on a degree certificate.';
    }
    if (!shortName.trim()) {
      e.shortName = 'The abbreviation staff actually say out loud — DIET, KIET, SVU.';
    } else if (shortName.trim().length > 24) {
      e.shortName = 'Twenty-four characters at most. This sits next to the crest in the sidebar.';
    }
    if (availability === 'empty') e.subdomain = 'A subdomain is required — it is how the tenant is resolved on every request.';
    if (availability === 'invalid') e.subdomain = SUBDOMAIN_RULE;
    if (availability === 'reserved') e.subdomain = 'That name is reserved for platform infrastructure.';
    if (availability === 'taken') e.subdomain = `${takenBy?.name ?? 'Another college'} already serves from that subdomain.`;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      e.email = 'A working address for the person who will hold college_admin. The first invite goes here.';
    }
    return e;
  };

  const goToStep = (next: 1 | 2 | 3) => {
    if (next > 1) {
      const found = validateStepOne();
      setErrors(found);
      if (Object.keys(found).length > 0) {
        setStep(1);
        toast.error(
          'The institution details need attention',
          'A tenant cannot be created without a valid subdomain and an admin contact.',
        );
        return;
      }
    }
    setStep(next);
  };

  // ---------------------------------------------------------------
  // The request body. One object, sent twice: once with dryRun true to
  // fill the summary, once with it false and the subdomain typed back.
  // ---------------------------------------------------------------

  const payload = React.useMemo(
    () => ({
      institutionName: institution.trim(),
      shortName: shortName.trim(),
      subdomain: slug,
      packId: packId || (packs[0]?.id ?? ''),
      adminEmail: email.trim().toLowerCase(),
      plan,
      fcra,
      features,
      requestDegreeRegister: seedRegister,
    }),
    [institution, shortName, slug, packId, packs, email, plan, fcra, features, seedRegister],
  );

  // Serialised, so the effect below re-runs when the *values* change rather
  // than every time this component re-renders with a fresh object.
  const payloadKey = JSON.stringify(payload);

  /**
   * Refusals, put where they came from.
   *
   * A 422 lands on the Field that caused it and sends the operator back to
   * step one rather than leaving them staring at a summary. A 409 is the
   * subdomain race the availability note cannot win, so it lands on the
   * subdomain Field with the server's own sentence — which names the
   * college already serving from it.
   */
  const applyRefusal = React.useCallback(
    (outcome: Exclude<ApiOutcome<unknown>, { status: 'ok' }>): string => {
      if (outcome.status === 'invalid') {
        const { mapped, rest } = mapFieldErrors(outcome.fieldErrors);
        setErrors(mapped);
        if (Object.keys(mapped).length > 0) setStep(1);
        return [outcome.message, ...rest].join(' ');
      }

      if (outcome.status === 'conflict') {
        setErrors({ subdomain: outcome.message });
        setStep(1);
        return outcome.message;
      }

      return outcome.message;
    },
    [],
  );

  /**
   * The summary step, answered by the handler that would do the writing.
   *
   * Aborted when the operator leaves step three or edits their way back —
   * a plan for a form that has since changed is worse than no plan.
   */
  React.useEffect(() => {
    if (step !== 3 || created) return;

    const controller = new AbortController();
    let live = true;

    setPlanning(true);
    setBlueprintError(null);

    void (async () => {
      const outcome = await api.post<ProvisionPlan>(
        '/api/platform/tenants',
        { ...(JSON.parse(payloadKey) as object), dryRun: true },
        controller.signal,
      );
      if (!live) return;

      setPlanning(false);

      if (outcome.status === 'ok') {
        setBlueprint(outcome.data);
        return;
      }

      setBlueprint(null);

      // A refusal here usually sends the operator back to step one with the
      // field marked, and a Field turning red two screens away is not an
      // explanation. The toast says what happened; the Field says where.
      const message = applyRefusal(outcome);
      setBlueprintError(message);

      const refusal = outcomeToast(outcome, '');
      if (refusal) toast.show({ ...refusal, body: message });
    })();

    return () => {
      live = false;
      controller.abort();
    };
  }, [step, payloadKey, created, applyRefusal, toast]);

  const finish = async () => {
    setSaving(true);

    const outcome = await api.post<ProvisionPlan>('/api/platform/tenants', {
      ...payload,
      dryRun: false,
      // The same phrase the dialog asked for. The server checks it too:
      // the typed confirmation is a guard, not a decoration.
      confirm: slug,
    });

    setSaving(false);
    setConfirming(false);

    if (outcome.status !== 'ok') {
      const message = applyRefusal(outcome);
      const refusal = outcomeToast(outcome, '');
      if (refusal) toast.show({ ...refusal, body: message });
      return;
    }

    setBlueprint(outcome.data);
    setCreated(outcome.data);

    const t = outcomeToast(outcome, `${shortName.trim() || 'The college'} is provisioning`);
    if (t) {
      toast.show(t);
    } else {
      toast.success(
        `${shortName.trim() || 'The college'} is provisioning`,
        `The tenant row and its RLS scope exist. The college_admin invite is queued for ${email.trim()}.`,
      );
    }

    // Only leave the screen when there is something to leave it for. On a
    // build with no writable store the college is not in that list, and
    // navigating to it would be the one lie this whole page avoids.
    if (outcome.persisted) {
      router.push('/platform');
      router.refresh();
    }
  };

  const steps = [
    { n: 1 as const, label: 'Institution' },
    { n: 2 as const, label: 'Brand and features' },
    { n: 3 as const, label: 'Review and confirm' },
  ];

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-6">
          {/* Step indicator. Buttons, not links — nothing is in the URL until
              the tenant exists, and a shareable half-filled form is a trap. */}
          <nav aria-label="Provisioning steps">
            <ol className="flex flex-wrap gap-2">
              {steps.map((s) => {
                const active = s.n === step;
                const done = s.n < step;
                return (
                  <li key={s.n}>
                    <button
                      type="button"
                      onClick={() => goToStep(s.n)}
                      aria-current={active ? 'step' : undefined}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium',
                        'transition-colors duration-fast ease-brand',
                        active
                          ? 'border-line-strong bg-surface-raised text-primary shadow-sm'
                          : 'border-line text-secondary hover:bg-surface-sunken hover:text-primary',
                      )}
                    >
                      <span
                        className={cn(
                          'grid size-5 shrink-0 place-items-center rounded-full font-mono text-[11px]',
                          done
                            ? 'bg-success text-success-on'
                            : active
                              ? 'bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)]'
                              : 'bg-surface-sunken text-muted',
                        )}
                        aria-hidden="true"
                      >
                        {done ? '✓' : s.n}
                      </span>
                      {s.label}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          {step === 1 ? (
            <form
              className="space-y-6"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                goToStep(2);
              }}
            >
              <Card>
                <CardHeader>
                  <div className="min-w-0 space-y-1">
                    <CardTitle>The institution</CardTitle>
                    <CardDescription>
                      These four values become the tenant row. Everything else can be changed later
                      from the college&rsquo;s own console; the subdomain cannot, without breaking every
                      link already shared over WhatsApp.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardBody className="space-y-5">
                  <Field
                    htmlFor="prov-institution"
                    label="Registered name"
                    required
                    hint="As it appears on a degree certificate, including the trust or society if the college uses one."
                    error={errors.institution}
                  >
                    <Input
                      id="prov-institution"
                      value={institution}
                      onChange={(e) => setInstitutionValue(e.target.value)}
                      placeholder="Kakinada Institute of Engineering & Technology"
                      invalid={Boolean(errors.institution)}
                      maxLength={120}
                    />
                  </Field>

                  <Field
                    htmlFor="prov-short"
                    label="Short name"
                    required
                    hint="What staff say out loud. It appears beside the crest, in email subject lines and in the audit log."
                    error={errors.shortName}
                  >
                    <Input
                      id="prov-short"
                      value={shortName}
                      onChange={(e) => setShortNameValue(e.target.value)}
                      placeholder="KIET"
                      invalid={Boolean(errors.shortName)}
                      maxLength={24}
                    />
                  </Field>

                  <Field
                    htmlFor="prov-subdomain"
                    label="Subdomain"
                    required
                    hint="Lowercase letters, digits and hyphens. This is how the tenant is resolved from the Host header on every single request."
                    error={errors.subdomain}
                  >
                    <Input
                      id="prov-subdomain"
                      value={subdomain}
                      onChange={(e) => {
                        setSubdomain(e.target.value.toLowerCase());
                        setSubTouched(true);
                      }}
                      placeholder="kakinada"
                      autoComplete="off"
                      spellCheck={false}
                      className="font-mono"
                      invalid={availability === 'taken' || availability === 'invalid' || availability === 'reserved'}
                      leading={<Globe className="size-4" />}
                    />
                  </Field>

                  <AvailabilityNote
                    availability={availability}
                    host={host}
                    takenByName={takenBy?.name ?? null}
                  />

                  <Field
                    htmlFor="prov-email"
                    label="Admin contact"
                    required
                    hint="The first and only college_admin at provisioning time. They grant every other role themselves."
                    error={errors.email}
                  >
                    <Input
                      id="prov-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="principal@kiet.example.ac.in"
                      autoComplete="off"
                      invalid={Boolean(errors.email)}
                      leading={<AtSign className="size-4" />}
                    />
                  </Field>

                  {freeMail ? (
                    <Alert tone="warning" title="That is a personal mailbox" icon={<CircleAlert className="size-4" />}>
                      <p>
                        A college-domain address survives the person who set the portal up. Handing
                        the only administrator account to a Gmail address means the next registrar
                        inherits nothing, and account recovery becomes a support ticket to us.
                      </p>
                    </Alert>
                  ) : null}

                  <Fieldset
                    legend="Plan"
                    hint="The plan sets the licence and the default feature envelope. It does not gate data — every tenant gets the same isolation, the same audit log and the same DPDP endpoints."
                  >
                    {PLANS.map((p) => (
                      <Radio
                        key={p.value}
                        id={`prov-plan-${p.value}`}
                        name="plan"
                        label={p.label}
                        hint={p.hint}
                        checked={plan === p.value}
                        onChange={() => setPlan(p.value)}
                      />
                    ))}
                  </Fieldset>
                </CardBody>
              </Card>

              <FormActions>
                <Button type="submit">Continue to brand and features</Button>
              </FormActions>
            </form>
          ) : null}

          {step === 2 ? (
            <form
              className="space-y-6"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                goToStep(3);
              }}
            >
              <Card>
                <CardHeader>
                  <div className="min-w-0 space-y-1">
                    <CardTitle>Starting brand pack</CardTitle>
                    <CardDescription>
                      Every pack in <span className="font-mono">brands/</span>. Pick the nearest one
                      now; the college replaces the seeds with its own crest and hex values from its
                      branding console, and nothing else changes.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardBody>
                  <Fieldset
                    legend="Brand pack"
                    hint="A pack supplies colour seeds, typography, shape and copy. The ten-stop ramps, hover states and text-on-brand pairings are derived from the seeds, not chosen."
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      {packs.map((p) => (
                        <div
                          key={p.id}
                          className={cn(
                            'rounded-lg border p-3 transition-colors duration-fast ease-brand',
                            packId === p.id
                              ? 'border-line-strong bg-surface-sunken'
                              : 'border-line hover:border-line-strong',
                          )}
                        >
                          <Radio
                            id={`prov-pack-${p.id}`}
                            name="pack"
                            checked={packId === p.id}
                            onChange={() => setPackId(p.id)}
                            hint={p.institutionName}
                            label={
                              <span className="flex items-center gap-2">
                                <span
                                  className="size-4 shrink-0 rounded-sm border border-line"
                                  style={{ backgroundColor: p.primary }}
                                  aria-hidden="true"
                                />
                                <span className="font-medium">{p.portalName}</span>
                                <span className="font-mono text-xs text-muted">
                                  {p.primary.toUpperCase()}
                                </span>
                              </span>
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </Fieldset>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <div className="min-w-0 space-y-1">
                    <CardTitle>Foreign contributions</CardTitle>
                    <CardDescription>
                      Asked before the switches because it decides one of them.
                    </CardDescription>
                  </div>
                  <Landmark className="size-5 shrink-0 text-muted" aria-hidden="true" />
                </CardHeader>
                <CardBody className="space-y-5">
                  <Fieldset
                    legend="Is the college trust registered under FCRA?"
                    hint="Donations carry source_country and is_foreign_contribution from the first rupee. Segregation is structural — it cannot be applied retrospectively at audit time."
                  >
                    <Radio
                      id="prov-fcra-unknown"
                      name="fcra"
                      label="Not confirmed yet"
                      hint="The default, and the honest answer for most colleges at this stage. Giving stays off."
                      checked={fcra === 'unknown'}
                      onChange={() => setFcra('unknown')}
                    />
                    <Radio
                      id="prov-fcra-no"
                      name="fcra"
                      label="No — domestic contributions only"
                      hint="Giving can still be enabled later, restricted to Indian sources."
                      checked={fcra === 'not_registered'}
                      onChange={() => setFcra('not_registered')}
                    />
                    <Radio
                      id="prov-fcra-yes"
                      name="fcra"
                      label="Yes — registration confirmed in writing"
                      hint="Only tick this against a registration number you have seen. It unlocks the giving module."
                      checked={fcra === 'registered'}
                      onChange={() => setFcra('registered')}
                    />
                  </Fieldset>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <div className="min-w-0 space-y-1">
                    <CardTitle>Feature switches</CardTitle>
                    <CardDescription>
                      Hard gates in the navigation and in every route guard, not CSS classes. A
                      module that is off is not reachable by URL either.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardBody className="space-y-4">
                  <ul className="divide-y divide-line">
                    {FEATURE_LIST.map((f) => (
                      <li key={f.key} className="py-3 first:pt-0 last:pb-0">
                        <Switch
                          id={`prov-feat-${f.key}`}
                          label={f.label}
                          hint={f.hint}
                          checked={features[f.key]}
                          onChange={(e) =>
                            setFeatures((cur) => ({ ...cur, [f.key]: e.target.checked }))
                          }
                        />
                      </li>
                    ))}
                  </ul>

                  <div className="rounded-lg border border-line bg-surface-sunken p-4">
                    <Switch
                      id="prov-feat-donations"
                      label={
                        <span className="flex flex-wrap items-center gap-2">
                          Giving
                          {donationsAllowed ? null : (
                            <Badge tone="warning">
                              <Lock className="size-3" aria-hidden="true" />
                              Locked
                            </Badge>
                          )}
                        </span>
                      }
                      hint={
                        donationsAllowed
                          ? 'Campaigns, Razorpay checkout, 80G receipts, and FCRA-segregated reporting from day one.'
                          : 'Stays off until FCRA registration is confirmed above. This is a legal gate, not a rollout preference.'
                      }
                      checked={features.donations}
                      disabled={!donationsAllowed}
                      onChange={(e) =>
                        setFeatures((cur) => ({ ...cur, donations: e.target.checked }))
                      }
                    />
                  </div>

                  <Checkbox
                    id="prov-seed-register"
                    label="Request the degree register from the examinations branch"
                    hint="Roll number, name, branch and year of passing for every graduate. It has the longest lead time of anything in onboarding, and alumni verification is blocked on it entirely — chase it on day one, not in week six."
                    checked={seedRegister}
                    onChange={(e) => setSeedRegister(e.target.checked)}
                  />
                </CardBody>
              </Card>

              <FormActions>
                <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="submit">Review what will be created</Button>
              </FormActions>
            </form>
          ) : null}

          {step === 3 ? (
            <div className="space-y-6">
              {created ? (
                <Alert
                  tone={created.persisted === false ? 'info' : 'success'}
                  title={
                    created.persisted === false
                      ? `${shortName.trim() || 'The college'} was described, not stored`
                      : `${shortName.trim() || 'The college'} is provisioning`
                  }
                  icon={<CircleCheck className="size-4" />}
                >
                  <p>{created.note}</p>
                </Alert>
              ) : null}

              <Card>
                <CardHeader>
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      What provisioning will create
                      {planning ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-normal text-muted">
                          <Spinner className="size-3.5" />
                          asking the server
                        </span>
                      ) : null}
                    </CardTitle>
                    <CardDescription>
                      Five writes, in one transaction. If any of them fails, none of them lands — a
                      college with a live subdomain and no administrator is worse than no college.
                      This list is the server&rsquo;s answer, not this screen&rsquo;s guess: it comes
                      back from the same handler that does the writing, one flag apart.
                    </CardDescription>
                  </div>
                  <Server className="size-5 shrink-0 text-muted" aria-hidden="true" />
                </CardHeader>
                <CardBody className="space-y-5">
                  {blueprintError ? (
                    <Alert
                      tone="danger"
                      title="The server refused to describe this provision"
                      icon={<CircleAlert className="size-4" />}
                    >
                      <p>{blueprintError}</p>
                      <p>Nothing has been written, and no subdomain has been held.</p>
                    </Alert>
                  ) : null}

                  {!blueprint && !blueprintError ? <PlanSkeleton /> : null}

                  {blueprint ? (
                    <>
                      <ol className="space-y-4">
                        {blueprint.creates.map((item, index) => (
                          <CreateItem
                            key={item.key}
                            n={index + 1}
                            icon={PLAN_ICON[item.key] ?? <Database className="size-4" />}
                            title={item.title}
                          >
                            <p>{item.detail}</p>
                            {item.fields.length ? (
                              <dl className="mt-2 grid gap-x-3 gap-y-1 sm:grid-cols-[auto_minmax(0,1fr)]">
                                {item.fields.map((field) => (
                                  <React.Fragment key={field.label}>
                                    <dt className="font-mono text-xs text-muted">{field.label}</dt>
                                    <dd className="break-all font-mono text-xs text-primary">
                                      {field.value}
                                    </dd>
                                  </React.Fragment>
                                ))}
                              </dl>
                            ) : null}
                          </CreateItem>
                        ))}
                      </ol>

                      {blueprint.warnings.length ? (
                        <Alert
                          tone="warning"
                          title={
                            blueprint.warnings.length === 1
                              ? 'One thing worth fixing first'
                              : `${blueprint.warnings.length} things worth fixing first`
                          }
                          icon={<CircleAlert className="size-4" />}
                        >
                          <ul className="list-disc space-y-1 pl-4">
                            {blueprint.warnings.map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        </Alert>
                      ) : null}

                      <Separator label="And what it will not create" />

                      <ul className="grid gap-3 sm:grid-cols-3">
                        {blueprint.notCreated.map((omission) => (
                          <NotCreated key={omission.title} title={omission.title}>
                            {omission.detail}
                          </NotCreated>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <div className="min-w-0 space-y-1">
                    <CardTitle>How the isolation actually works</CardTitle>
                    <CardDescription>
                      Worth being precise about, because every competing portal claims it.
                    </CardDescription>
                  </div>
                  <Lock className="size-5 shrink-0 text-muted" aria-hidden="true" />
                </CardHeader>
                <CardBody className="space-y-4 text-sm text-secondary">
                  <p>
                    Tenant isolation is enforced in Postgres by row-level security on{' '}
                    <code className="font-mono text-xs text-primary">app.tenant_id</code>, not in
                    application code. Every table in the schema carries a tenant column and a policy
                    that compares it against the session variable set at the start of the request.
                  </p>
                  <p>
                    The practical consequence: a query that forgets its{' '}
                    <code className="font-mono text-xs text-primary">WHERE tenant_id = …</code>{' '}
                    clause returns nothing, not another college&rsquo;s rows. One careless join in a
                    feature written eighteen months from now cannot leak {shortName.trim() || 'this college'}{' '}
                    into somebody else&rsquo;s directory, because the database refuses before the
                    application is consulted.
                  </p>
                  <p>
                    The same discipline applies to us. Your account —{' '}
                    <span className="font-medium text-primary">{actorName}</span> — holds{' '}
                    <code className="font-mono text-xs text-primary">tenant.provision</code>,{' '}
                    <code className="font-mono text-xs text-primary">tenant.configure</code> and{' '}
                    <code className="font-mono text-xs text-primary">audit.read</code>, and no
                    capability that reads a member row. The provisioning endpoint imports nothing
                    that returns one. Creating a college does not make anyone at ifBash a member of
                    it.
                  </p>
                  <p className="flex items-center gap-2 text-xs text-muted">
                    <Globe className="size-3.5 shrink-0" aria-hidden="true" />
                    Postgres and object storage are created in{' '}
                    <span className="font-mono">ap-south-1</span>. No tenant data crosses a border,
                    so DPDP cross-border transfer rules stay out of scope entirely.
                  </p>
                </CardBody>
                <CardFooter>
                  <p className="mr-auto max-w-prose text-xs text-muted">
                    {blueprint?.note ??
                      'The summary above is fetched from the provisioning endpoint before anything is written. Nothing is created until you confirm.'}
                  </p>
                  <Button variant="secondary" onClick={() => setStep(2)} disabled={saving}>
                    Back
                  </Button>
                  <Button
                    onClick={() => setConfirming(true)}
                    loading={saving}
                    disabled={!blueprint || planning || Boolean(created)}
                  >
                    {created ? 'Provisioned' : `Provision ${shortName.trim() || 'this college'}`}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="overflow-hidden">
            <div
              className="space-y-1 p-card"
              style={pack ? { backgroundColor: pack.primary, color: pack.onPrimary } : undefined}
            >
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                <Eye className="size-3.5" aria-hidden="true" />
                Preview
              </p>
              <p className="font-display text-lg font-bold">
                {shortName.trim() || institution.trim() || 'Your college'}
              </p>
              <p className="break-all font-mono text-xs">{host}</p>
            </div>

            <CardBody className="space-y-3 text-sm">
              <div className="space-y-0.5">
                <p className="text-xs uppercase tracking-wide text-muted">Institution</p>
                <p className="font-medium">{institution.trim() || 'Not set'}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs uppercase tracking-wide text-muted">Tenant id</p>
                <p className="font-mono text-xs">{tenantId}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs uppercase tracking-wide text-muted">Brand pack</p>
                <p className="font-mono text-xs">brands/{pack?.id ?? 'default'}.json</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs uppercase tracking-wide text-muted">Plan</p>
                <p className="font-medium capitalize">{plan}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted">
                  Modules on ({featuresOn.length + (features.donations ? 1 : 0)})
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {featuresOn.map((f) => (
                    <li key={f.key}>
                      <Badge tone="neutral">{f.label}</Badge>
                    </li>
                  ))}
                  {features.donations ? (
                    <li>
                      <Badge tone="brand">Giving</Badge>
                    </li>
                  ) : null}
                  {featuresOn.length === 0 && !features.donations ? (
                    <li className="text-xs text-muted">
                      Every module is off. The college would sign in to an empty portal.
                    </li>
                  ) : null}
                </ul>
              </div>
            </CardBody>

            <CardFooter>
              <p className="text-xs text-muted">
                Data residency <span className="font-mono">ap-south-1</span> · isolation by
                row-level security on <span className="font-mono">app.tenant_id</span>
              </p>
            </CardFooter>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={finish}
        pending={saving}
        tone="primary"
        confirmLabel="Provision the tenant"
        requireTyped={slug}
        title={`Provision ${shortName.trim() || 'this college'}?`}
        body={
          <div className="space-y-2">
            <p>
              This creates the tenant row, its branding record and the first{' '}
              <span className="font-mono text-primary">college_admin</span> invite to{' '}
              <span className="font-medium text-primary">{email.trim()}</span>.
            </p>
            <p>
              The subdomain{' '}
              <span className="font-mono text-primary">{blueprint?.host ?? host}</span> becomes live
              immediately and cannot be changed afterwards without breaking every link the college
              has already shared. The phrase you type is sent with the request and checked again on
              the server.
            </p>
          </div>
        }
      />
    </>
  );
}

// ---------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------

function AvailabilityNote({
  availability,
  host,
  takenByName,
}: {
  availability: Availability;
  host: string;
  takenByName: string | null;
}) {
  if (availability === 'empty') {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-dashed border-line bg-surface px-3 py-2.5 text-sm text-muted">
        <Globe className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        The portal address appears here as you type.
      </p>
    );
  }

  const map = {
    available: {
      tone: 'border-success bg-success-soft text-success-fg',
      icon: <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />,
      text: 'Available. This becomes the college’s permanent address.',
    },
    taken: {
      tone: 'border-danger bg-danger-soft text-danger-fg',
      icon: <CircleSlash2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />,
      text: `${takenByName ?? 'Another college'} already serves from this subdomain.`,
    },
    reserved: {
      tone: 'border-danger bg-danger-soft text-danger-fg',
      icon: <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />,
      text: 'Reserved for platform infrastructure. Pick another.',
    },
    invalid: {
      tone: 'border-warning bg-warning-soft text-warning-fg',
      icon: <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />,
      text: SUBDOMAIN_RULE,
    },
  }[availability];

  return (
    <div
      role="status"
      className={cn('flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm', map.tone)}
    >
      {map.icon}
      <span className="min-w-0 space-y-0.5">
        <span className="block break-all font-mono text-xs font-semibold">https://{host}</span>
        <span className="block">{map.text}</span>
      </span>
    </div>
  );
}

/**
 * The waiting shape of the list above, not a spinner in an empty box. Five
 * rows because the answer always has five, so nothing jumps when it lands.
 */
function PlanSkeleton() {
  return (
    <ol className="space-y-4" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((row) => (
        <li key={row} className="flex gap-3">
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-48 max-w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </li>
      ))}
    </ol>
  );
}

function CreateItem({
  n,
  icon,
  title,
  children,
}: {
  n: number;
  icon: React.ReactNode;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-soft-fg"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold">
          <span className="sr-only">Step {n}. </span>
          {title}
        </p>
        <div className="text-sm text-secondary">{children}</div>
      </div>
    </li>
  );
}

function NotCreated({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="space-y-1 rounded-lg border border-line bg-surface p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <CircleSlash2 className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
        {title}
      </p>
      <p className="text-xs text-secondary">{children}</p>
    </li>
  );
}
