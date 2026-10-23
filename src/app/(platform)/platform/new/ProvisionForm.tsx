'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ArrowUpRight,
  AtSign,
  BadgeCheck,
  CircleAlert,
  CircleCheck,
  CircleSlash2,
  Database,
  FileJson,
  Globe,
  Landmark,
  Lock,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  ConfirmDialog,
  Disclosure,
  Field,
  Fieldset,
  FormActions,
  Input,
  Radio,
  Skeleton,
  Switch,
  useToast,
} from '@/components/ui';
import { api, outcomeToast, type ApiOutcome } from '@/lib/client/api';
import { cn } from '@/lib/cn';
import type { BrandPack, Feature } from '@/lib/branding/pack';

import type { BrandVerdict } from '../_shared/brand-check';
import { MiniPortal } from '../_shared/MiniPortal';
import { LABEL as MONO_LABEL, VerdictText } from '../_shared/parts';

/**
 * Setting up a college.
 *
 * Three steps, and the third one is the point: before anything is written,
 * the server names every row it is about to create. Setting a college up
 * is not reversible by clicking again — a half-created college with a live
 * address and no admin invite is worse than no college at all.
 *
 * That third step is not this file's opinion. Arriving on it posts the
 * whole form to `POST /api/platform/tenants` with `dryRun: true`, and what
 * is shown is what the handler says it would write — same route, same
 * schema, same collision checks, one flag apart from the call the button
 * makes. The human summary is built only from fields the server returned
 * (plus the admin's email the operator typed); the verbatim list sits in a
 * disclosure for anyone who wants the rows.
 *
 * The address check as you type runs against the lists the server passed
 * down. A name that is free here can still lose a race, so the API checks
 * it again against both namespaces — existing colleges and the brand pack
 * registry — and answers 409. The real guarantee is the unique index on
 * `tenants.subdomain`; everything before it is courtesy.
 */

export interface PackChoice {
  id: string;
  portalName: string;
  institutionName: string;
  primary: string;
  /** Derived server-side by the same contrast rule the button tokens use. */
  onPrimary: string;
  pack: BrandPack;
  /** The pack's scoped preview CSS, computed on the server. */
  css: string;
  fontHref: string | null;
  /** The house pack or a demo pack: a starting point, not a college's own. */
  template: boolean;
  /** Colleges already using the pack. */
  inUseBy: string[];
  /** Where the pack answers on its own, for a live look. */
  previewHref: string;
  /** The pack's `brand:check` result, worked out on the server. */
  verdict: BrandVerdict;
}

type Plan = 'trial' | 'standard' | 'institution';
type Fcra = 'unknown' | 'registered' | 'not_registered';
type Availability = 'empty' | 'invalid' | 'reserved' | 'pack' | 'taken' | 'available';

interface Errors {
  institution?: string;
  shortName?: string;
  subdomain?: string;
  email?: string;
}

/** Every module but giving, which has its own switch under the legal gate. */
const FEATURE_LIST: Array<{ key: Exclude<Feature, 'donations'>; label: string; hint: string }> = [
  { key: 'directory', label: 'Directory', hint: 'Alumni find each other by branch, batch, company and city.' },
  { key: 'connections', label: 'Requests', hint: 'Final-year students ask alumni for mentoring and referrals, within quotas on both sides.' },
  { key: 'mentorship', label: 'Mentorship', hint: 'Alumni say when they are open to mentoring.' },
  { key: 'events', label: 'Events', hint: 'Reunions and department sessions, with registration.' },
  { key: 'jobs', label: 'Jobs', hint: 'Alumni post roles; the placement cell checks them before they go live.' },
  { key: 'news', label: 'News', hint: 'Stories and announcements from the college.' },
  { key: 'gallery', label: 'Gallery', hint: 'Photo albums from events and batches.' },
  { key: 'publicLanding', label: 'Public front page', hint: 'A signed-out page on the college’s address. The directory stays behind sign-in either way.' },
  { key: 'whatsapp', label: 'WhatsApp messages', hint: 'A WhatsApp channel for staff messages. The college’s Business account is connected separately.' },
  { key: 'groups', label: 'Groups and chapters', hint: 'Chapters by city and interest groups, each with a noticeboard and leads.' },
  { key: 'feed', label: 'Community feed', hint: 'Short posts from alumni. Needs someone at the college to look at reports.' },
  { key: 'businesses', label: 'Business directory', hint: 'Alumni businesses, reviewed before they appear.' },
  { key: 'showcase', label: 'Showcase', hint: 'Prominent alumni, achievements and success stories, with the featured person’s agreement.' },
  { key: 'helpdesk', label: 'Help desk', hint: 'A place for members to ask and give feedback. Read only by the college.' },
  { key: 'pages', label: 'College pages', hint: 'About, a director’s message and other pages the college edits itself.' },
  { key: 'invites', label: 'Invitations', hint: 'Members invite batchmates who have not registered, within a weekly limit.' },
];

const LABEL: Record<Feature, string> = {
  ...(Object.fromEntries(FEATURE_LIST.map((f) => [f.key, f.label])) as Record<Exclude<Feature, 'donations'>, string>),
  donations: 'Giving',
};

const PLANS: Array<{ value: Plan; label: string; hint: string }> = [
  {
    value: 'trial',
    label: 'Trial',
    hint: 'For a college still deciding. The everyday modules are on; WhatsApp and giving are not.',
  },
  {
    value: 'standard',
    label: 'Standard',
    hint: 'The core network: directory, requests, mentorship, events, jobs and the public front page.',
  },
  {
    value: 'institution',
    label: 'Institution',
    hint: 'Everything, including WhatsApp messages, and giving once FCRA registration is confirmed.',
  },
];

/**
 * What each plan switches on. Picking a plan resets the switches to its
 * envelope; the operator can still change any of them afterwards. Giving
 * is in the institution envelope but stays under the FCRA gate below.
 */
const ENVELOPE: Record<Plan, Record<Feature, boolean>> = {
  trial: {
    directory: true, connections: true, events: true, jobs: true, mentorship: true,
    donations: false, gallery: true, news: true, whatsapp: false, publicLanding: true,
    // The light community modules: nothing here needs a moderator to be
    // appointed before it is safe to switch on.
    groups: false, feed: false, businesses: false, showcase: false,
    helpdesk: true, pages: true, invites: true,
  },
  standard: {
    directory: true, connections: true, events: true, jobs: true, mentorship: true,
    donations: false, gallery: false, news: false, whatsapp: false, publicLanding: true,
    groups: true, feed: false, businesses: false, showcase: false,
    helpdesk: true, pages: true, invites: true,
  },
  institution: {
    directory: true, connections: true, events: true, jobs: true, mentorship: true,
    donations: true, gallery: true, news: true, whatsapp: true, publicLanding: true,
    groups: true, feed: true, businesses: true, showcase: true,
    helpdesk: true, pages: true, invites: true,
  },
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
  defaultPackId,
  taken,
  reserved,
  rootDomain,
  actorName,
  haveInHand,
}: {
  packs: PackChoice[];
  defaultPackId: string;
  taken: Array<{ subdomain: string; name: string }>;
  reserved: string[];
  /** The apex every college's subdomain sits under, e.g. `localhost:3000`. */
  rootDomain: string;
  actorName: string;
  haveInHand: Array<{ title: string; when: string }>;
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

  const [packId, setPackId] = React.useState(defaultPackId);
  const [fcra, setFcra] = React.useState<Fcra>('unknown');
  const [features, setFeatures] = React.useState<Record<Feature, boolean>>(ENVELOPE.trial);
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
        : packs.some((p) => p.id === slug)
          ? 'pack'
          : takenBy
            ? 'taken'
            : 'available';

  // One address: the server's, once it has answered for this subdomain.
  const host =
    blueprint && blueprint.subdomain === slug ? blueprint.host : `${slug || 'your-college'}.${rootDomain}`;
  const tenantId = `ten-${slug || 'xxx'}`;
  const pack = packs.find((p) => p.id === packId) ?? packs[0];
  const displayName = shortName.trim() || institution.trim() || 'the new college';
  const names = { shortName: shortName.trim(), institutionName: institution.trim() };

  const emailDomain = email.includes('@') ? email.split('@')[1]?.toLowerCase() ?? '' : '';
  const freeMail = FREE_MAIL.includes(emailDomain);

  const envelope = ENVELOPE[plan];
  const changed = (Object.keys(envelope) as Feature[]).filter(
    (k) => features[k] !== (k === 'donations' ? envelope[k] && fcra === 'registered' : envelope[k]),
  );

  // Donations are a legal gate, not a rollout preference. The switch is not
  // merely defaulted off — it cannot be turned on until FCRA status is known.
  const donationsAllowed = fcra === 'registered';
  React.useEffect(() => {
    if (!donationsAllowed && features.donations) {
      setFeatures((f) => ({ ...f, donations: false }));
    }
  }, [donationsAllowed, features.donations]);

  /** A plan resets the switches to its envelope; giving still waits on FCRA. */
  const choosePlan = (next: Plan) => {
    setPlan(next);
    setFeatures({ ...ENVELOPE[next], donations: ENVELOPE[next].donations && donationsAllowed });
  };

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
      e.institution = 'The registered name of the college, as it appears on a degree certificate.';
    }
    if (!shortName.trim()) {
      e.shortName = 'The letters staff say out loud, as on the crest.';
    } else if (shortName.trim().length > 24) {
      e.shortName = 'Twenty-four characters at most. It sits beside the crest in the sidebar.';
    }
    if (availability === 'empty') e.subdomain = 'An address is needed. It is how every page finds the college.';
    if (availability === 'invalid') e.subdomain = SUBDOMAIN_RULE;
    if (availability === 'reserved') e.subdomain = 'That name is kept for the platform itself. Pick another.';
    if (availability === 'pack') e.subdomain = 'A brand pack already answers on that address. Pick another.';
    if (availability === 'taken') e.subdomain = `${takenBy?.name ?? 'Another college'} already uses that address.`;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      e.email = 'A working address for the first admin. Their invite goes here.';
    }
    return e;
  };

  const goToStep = (next: 1 | 2 | 3) => {
    if (next > 1) {
      const found = validateStepOne();
      setErrors(found);
      if (Object.keys(found).length > 0) {
        setStep(1);
        toast.error('Check the college’s details', 'The address and the first admin’s email are needed before anything else.');
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
    { n: 1 as const, label: 'The college', short: 'College' },
    { n: 2 as const, label: 'Look and modules', short: 'Look' },
    { n: 3 as const, label: 'Review', short: 'Review' },
  ];

  const templates = packs.filter((p) => p.template);
  const inUse = packs.filter((p) => !p.template);
  const current = blueprint && blueprint.subdomain === slug && !planning ? blueprint : null;

  return (
    <>
      {/* Phones: what is being set up, pinned under the top bar. */}
      <div
        className="sticky top-14 z-20 -mx-4 flex items-center gap-3 border-y border-line bg-[color-mix(in_srgb,var(--surface-raised)_95%,transparent)] px-4 py-2 backdrop-blur lg:hidden"
        aria-label="Summary"
        role="region"
      >
        <span
          aria-hidden="true"
          className="size-3 shrink-0 rounded-full border border-line"
          style={pack ? { backgroundColor: pack.primary } : undefined}
        />
        <p className="min-w-0 flex-1 truncate text-sm">
          <span className="font-semibold text-primary">{shortName.trim() || institution.trim() || 'New college'}</span>{' '}
          <span className="font-mono text-xs text-secondary">{host}</span>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          {/* Step indicator. Buttons, not links — nothing is in the URL until
              the college exists, and a shareable half-filled form is a trap. */}
          <nav aria-label="Set-up steps">
            <ol className="grid grid-cols-3 gap-3 sm:gap-5">
              {steps.map((s) => {
                const active = s.n === step;
                const done = s.n < step;
                return (
                  <li key={s.n} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => goToStep(s.n)}
                      aria-current={active ? 'step' : undefined}
                      className={cn(
                        'group block min-h-11 w-full border-t-2 pt-3 text-left transition-colors duration-fast ease-brand',
                        active ? 'border-[var(--button-primary-bg)]' : done ? 'border-accent-fg' : 'border-line hover:border-line-strong',
                      )}
                    >
                      <span
                        className={cn(MONO_LABEL,
                          'block tabular',
                          done ? 'text-accent-fg' : active ? 'text-primary' : null,
                        )}
                      >
                        {String(s.n).padStart(2, '0')}
                        {done ? <span> · done</span> : null}
                      </span>
                      <span
                        className={cn(
                          'mt-1 block truncate text-sm font-medium',
                          active ? 'text-primary' : 'text-secondary group-hover:text-primary',
                        )}
                      >
                        <span className="sm:hidden">{s.short}</span>
                        <span className="hidden sm:inline">{s.label}</span>
                      </span>
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
                    <CardTitle as="h2">The college</CardTitle>
                    <CardDescription>
                      Everything here except the address can be changed later from the college’s own console.
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
                      invalid={Boolean(errors.institution)}
                      maxLength={120}
                    />
                  </Field>

                  <Field
                    htmlFor="prov-short"
                    label="Short name"
                    required
                    hint="The letters staff say out loud, as on the crest."
                    error={errors.shortName}
                  >
                    <Input
                      id="prov-short"
                      value={shortName}
                      onChange={(e) => setShortNameValue(e.target.value)}
                      invalid={Boolean(errors.shortName)}
                      maxLength={24}
                      className="sm:max-w-xs"
                    />
                  </Field>

                  <Field
                    htmlFor="prov-subdomain"
                    label="Address"
                    required
                    hint="This becomes the college’s web address. Pick something short staff will say aloud — it cannot be changed later."
                    error={errors.subdomain}
                  >
                    <Input
                      id="prov-subdomain"
                      value={subdomain}
                      onChange={(e) => {
                        setSubdomain(e.target.value.toLowerCase());
                        setSubTouched(true);
                      }}
                      autoComplete="off"
                      spellCheck={false}
                      className="font-mono sm:max-w-xs"
                      invalid={
                        availability === 'taken' ||
                        availability === 'invalid' ||
                        availability === 'reserved' ||
                        availability === 'pack'
                      }
                      leading={<Globe className="size-4" />}
                    />
                  </Field>

                  <AvailabilityNote availability={availability} host={host} takenByName={takenBy?.name ?? null} />

                  <Field
                    htmlFor="prov-email"
                    label="First admin’s email"
                    required
                    hint="They sign in first and add the rest of the staff themselves."
                    error={errors.email}
                  >
                    <Input
                      id="prov-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@college-domain.ac.in"
                      autoComplete="off"
                      invalid={Boolean(errors.email)}
                      leading={<AtSign className="size-4" />}
                    />
                  </Field>

                  {freeMail ? (
                    <Alert tone="warning" title="That is a personal mailbox" icon={<CircleAlert className="size-4" />}>
                      <p>
                        An address on the college’s own domain outlives the person who set the portal up. With a
                        personal one, the next registrar inherits nothing.
                      </p>
                    </Alert>
                  ) : null}
                </CardBody>
              </Card>

              <FormActions>
                <Button type="submit">
                  Continue to look and modules
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
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
                    <CardTitle as="h2">Starting look</CardTitle>
                    <CardDescription>
                      The look {displayName} opens with. The college’s own crest and colours replace it later.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardBody className="space-y-5">
                  <fieldset className="space-y-5">
                    <legend className="sr-only">Brand pack</legend>
                    <PackGroup title="Starting templates" packs={templates} value={packId} onChange={setPackId} />
                    {inUse.length ? (
                      <PackGroup title="Already in use" packs={inUse} value={packId} onChange={setPackId} />
                    ) : null}
                  </fieldset>

                  {pack?.verdict.blocked ? (
                    <Alert tone="danger" icon={<CircleAlert className="size-4" />}>
                      <p>This pack fails the brand check, so it cannot be published. Pick another, or fix its colours first.</p>
                    </Alert>
                  ) : null}

                  {pack && !pack.template && pack.inUseBy.length ? (
                    <Alert tone="warning" icon={<CircleAlert className="size-4" />}>
                      <p>
                        In use by {pack.inUseBy[0]}: its name and wording would show on {displayName}’s portal.
                      </p>
                    </Alert>
                  ) : null}

                  <p className="flex min-h-11 items-center text-sm sm:min-h-0">
                    <Link href="/platform/brands" className="link">
                      Using the college’s own colours? Add its brand pack first
                    </Link>
                  </p>
                  {/* Every pack's band, scoped, so each tile wears its own colours. */}
                  <style dangerouslySetInnerHTML={{ __html: packs.map((p) => p.css).join('') }} />
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <div className="min-w-0 space-y-1">
                    <CardTitle as="h2">Foreign contributions</CardTitle>
                    <CardDescription>Asked before the modules because it decides one of them.</CardDescription>
                  </div>
                  <Landmark className="size-5 shrink-0 text-muted" aria-hidden="true" />
                </CardHeader>
                <CardBody>
                  <Fieldset
                    legend="Is the college trust registered under FCRA?"
                    hint="Foreign gifts have to be kept apart from the first rupee, so giving waits on this answer."
                  >
                    <Radio
                      id="prov-fcra-unknown"
                      name="fcra"
                      label="Not confirmed yet"
                      hint="The usual answer at this stage. Giving stays off."
                      checked={fcra === 'unknown'}
                      onChange={() => setFcra('unknown')}
                    />
                    <Radio
                      id="prov-fcra-no"
                      name="fcra"
                      label="No — domestic gifts only"
                      hint="Giving can still be switched on later, for Indian sources only."
                      checked={fcra === 'not_registered'}
                      onChange={() => setFcra('not_registered')}
                    />
                    <Radio
                      id="prov-fcra-yes"
                      name="fcra"
                      label="Yes — registration confirmed in writing"
                      hint="Only against a registration number you have seen. It unlocks giving."
                      checked={fcra === 'registered'}
                      onChange={() => setFcra('registered')}
                    />
                  </Fieldset>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <div className="min-w-0 space-y-1">
                    <CardTitle as="h2">Plan and modules</CardTitle>
                    <CardDescription>A plan sets the modules it includes. Any of them can be changed below.</CardDescription>
                  </div>
                </CardHeader>
                <CardBody className="space-y-6">
                  <Fieldset legend="Plan">
                    <div className="grid gap-3 md:grid-cols-3">
                      {PLANS.map((p) => (
                        <div
                          key={p.value}
                          className={cn(
                            'rounded-lg border p-3 transition-colors duration-fast ease-brand',
                            plan === p.value ? 'border-line-strong bg-surface-sunken' : 'border-line',
                          )}
                        >
                          <Radio
                            id={`prov-plan-${p.value}`}
                            name="plan"
                            label={<span className="font-medium">{p.label}</span>}
                            hint={p.hint}
                            checked={plan === p.value}
                            onChange={() => choosePlan(p.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </Fieldset>

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-primary">Modules</p>
                      {changed.length ? (
                        <p className="flex flex-wrap items-center gap-2 text-xs text-secondary">
                          {changed.length} changed from the {PLANS.find((p) => p.value === plan)?.label} plan
                          <Button type="button" variant="ghost" size="sm" onClick={() => choosePlan(plan)}>
                            Reset to the plan
                          </Button>
                        </p>
                      ) : (
                        <p className="text-xs text-secondary">
                          As the {PLANS.find((p) => p.value === plan)?.label} plan sets them
                        </p>
                      )}
                    </div>

                    <ul className="divide-y divide-line rounded-lg border border-line px-4">
                      {FEATURE_LIST.map((f) => (
                        <li key={f.key} className="py-3">
                          <Switch
                            id={`prov-feat-${f.key}`}
                            label={f.label}
                            hint={f.hint}
                            checked={features[f.key]}
                            onChange={(e) => setFeatures((cur) => ({ ...cur, [f.key]: e.target.checked }))}
                          />
                        </li>
                      ))}
                      <li className="py-3">
                        <Switch
                          id="prov-feat-donations"
                          label={
                            <span className="flex flex-wrap items-center gap-2">
                              Giving
                              {donationsAllowed ? null : (
                                <Badge tone="neutral">
                                  <Lock className="size-3" aria-hidden="true" />
                                  Locked until FCRA is confirmed
                                </Badge>
                              )}
                            </span>
                          }
                          hint={
                            donationsAllowed
                              ? 'Campaigns and the giving form, with foreign gifts held apart. Online payment is connected separately.'
                              : 'Stays off until FCRA registration is confirmed above. This is a legal gate, not a preference.'
                          }
                          checked={features.donations}
                          disabled={!donationsAllowed}
                          onChange={(e) => setFeatures((cur) => ({ ...cur, donations: e.target.checked }))}
                        />
                      </li>
                    </ul>
                  </div>

                  <Checkbox
                    id="prov-seed-register"
                    label="Request the degree register from the examinations branch"
                    hint="It takes longest of anything in set-up, and verification waits on it. Ask on day one."
                    checked={seedRegister}
                    onChange={(e) => setSeedRegister(e.target.checked)}
                  />
                </CardBody>
              </Card>

              <FormActions>
                <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="submit">
                  Review
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </FormActions>
            </form>
          ) : null}

          {step === 3 ? (
            created ? (
              <SetUpDone
                created={created}
                name={displayName}
                pack={pack}
                names={names}
                note={created.note}
              />
            ) : (
              <Card>
                <CardHeader>
                  <div className="min-w-0 space-y-1">
                    <CardTitle as="h2">Review {displayName}</CardTitle>
                    <CardDescription>The server’s answer to what you entered. Nothing is written until you confirm.</CardDescription>
                  </div>
                </CardHeader>

                <CardBody className="space-y-5">
                  {blueprintError ? (
                    <Alert tone="danger" title="The server refused this set-up" icon={<CircleAlert className="size-4" />}>
                      <p>{blueprintError}</p>
                      <p>Nothing has been written, and no address has been held.</p>
                    </Alert>
                  ) : null}

                  {!current && !blueprintError ? <PlanWaiting name={displayName} /> : null}

                  {current ? (
                    <>
                      <dl className="divide-y divide-line rounded-lg border border-line">
                        <SummaryRow label="Address">
                          <span className="break-all font-mono text-sm">{current.host}</span>
                        </SummaryRow>
                        <SummaryRow label="Look">
                          {packs.find((p) => p.id === current.packId)?.portalName ?? current.packId} pack
                        </SummaryRow>
                        <SummaryRow label="Plan">{PLANS.find((p) => p.value === current.plan)?.label ?? current.plan}</SummaryRow>
                        <SummaryRow label="Modules">
                          {current.modulesOn.length
                            ? current.modulesOn.map((k) => LABEL[k as Feature] ?? k).join(', ')
                            : 'None'}
                        </SummaryRow>
                        <SummaryRow label="First admin">
                          <span className="break-all">{email.trim()}</span>
                        </SummaryRow>
                      </dl>

                      {pack ? (
                        <div className="space-y-2 lg:hidden">
                          <p className="text-sm font-medium text-primary">How it will look</p>
                          <MiniPortal pack={pack.pack} css={pack.css} fontHref={pack.fontHref} names={names} size="sm" />
                        </div>
                      ) : null}

                      <p className="text-sm text-secondary">
                        Recorded in {displayName}’s own audit log as set up by {actorName}.
                      </p>

                      <Disclosure summary="What gets created">
                        <div className="space-y-5">
                          <ol className="space-y-4">
                            {current.creates.map((item, index) => (
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
                                        <dt className="font-mono text-xs text-secondary">{field.label}</dt>
                                        <dd className="break-all font-mono text-xs text-primary">{field.value}</dd>
                                      </React.Fragment>
                                    ))}
                                  </dl>
                                ) : null}
                              </CreateItem>
                            ))}
                          </ol>
                          <div className="space-y-2 border-t border-line pt-4">
                            <p className="text-sm font-medium text-primary">And what it does not create</p>
                            <ul className="grid gap-3 sm:grid-cols-3">
                              {current.notCreated.map((omission) => (
                                <NotCreated key={omission.title} title={omission.title}>
                                  {omission.detail}
                                </NotCreated>
                              ))}
                            </ul>
                          </div>
                          <p className="text-xs text-secondary">{current.note}</p>
                        </div>
                      </Disclosure>
                    </>
                  ) : null}
                </CardBody>

                <CardFooter className="flex-col items-stretch gap-4 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    {current && current.warnings.length ? (
                      <Alert
                        tone="warning"
                        title={
                          current.warnings.length === 1
                            ? 'One thing worth fixing first'
                            : `${current.warnings.length} things worth fixing first`
                        }
                        icon={<CircleAlert className="size-4" />}
                      >
                        <ul className="list-disc space-y-1 pl-4">
                          {current.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      </Alert>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-3">
                    <Button variant="secondary" onClick={() => setStep(2)} disabled={saving}>
                      Back
                    </Button>
                    <Button
                      onClick={() => setConfirming(true)}
                      loading={saving}
                      disabled={!current || planning || Boolean(created)}
                    >
                      Set up {shortName.trim() || 'the college'}
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            )
          ) : null}
        </div>

        <aside aria-label="What is being set up" className="hidden space-y-4 lg:sticky lg:top-20 lg:block lg:self-start">
          <Card>
            <CardBody className="space-y-4">
              <div className="space-y-1">
                <p className="eyebrow font-mono text-brand-fg">Preview</p>
                <p className={cn(MONO_LABEL, 'pt-2')}>Address</p>
                <p className="break-all font-mono text-md font-semibold text-primary">{host}</p>
                <p className="text-sm text-secondary">
                  {shortName.trim() || institution.trim() ? (
                    <>
                      <span className="font-medium text-primary">{shortName.trim() || institution.trim()}</span>
                      {shortName.trim() && institution.trim() ? ` · ${institution.trim()}` : null}
                    </>
                  ) : (
                    'Name the college to see it here.'
                  )}
                </p>
              </div>
              {pack ? (
                <MiniPortal pack={pack.pack} css={pack.css} fontHref={pack.fontHref} names={names} size="sm" />
              ) : null}
              {pack ? (
                <p className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                  <span className={MONO_LABEL}>Brand check</span>
                  <VerdictText verdict={pack.verdict} />
                </p>
              ) : null}
              <p className="border-t border-line pt-3 text-xs text-secondary">
                <span className="font-medium">Technical</span>{' '}
                <span className="break-all font-mono">
                  {slug ? tenantId : 'ten-…'} · brands/{pack?.id ?? 'default'}.json
                </span>
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader variant="stack">
              <CardTitle as="h2" className="text-md">
                What to have in hand
              </CardTitle>
            </CardHeader>
            <CardBody>
              <ul className="space-y-2.5">
                {haveInHand.map((item) => (
                  <li key={item.title} className="flex items-start justify-between gap-3 text-sm">
                    <span className="min-w-0 text-primary">{item.title}</span>
                    <Badge tone="neutral" className="shrink-0 whitespace-nowrap">
                      {item.when}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={finish}
        pending={saving}
        tone="primary"
        confirmLabel={`Set up ${shortName.trim() || 'the college'}`}
        requireTyped={slug}
        title={`Set up ${shortName.trim() || 'this college'}?`}
        body={
          <div className="space-y-2">
            <p>
              This creates {displayName}’s record, its look and an invite for its first admin at{' '}
              <span className="font-medium text-primary">{email.trim()}</span>.
            </p>
            <p>
              <span className="font-mono text-primary">{host}</span> becomes its permanent address. It cannot be
              changed later without breaking every link the college has shared. What you type is checked again on
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

function PackGroup({
  title,
  packs,
  value,
  onChange,
}: {
  title: string;
  packs: PackChoice[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className={MONO_LABEL}>{title}</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {packs.map((p) => {
          const selected = value === p.id;
          return (
            <label
              key={p.id}
              htmlFor={`prov-pack-${p.id}`}
              className={cn(
                'relative block cursor-pointer overflow-hidden rounded-lg border-2 bg-surface-raised transition-colors duration-fast ease-brand',
                'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus-ring)]',
                selected ? 'border-[var(--button-primary-bg)]' : 'border-line hover:border-line-strong',
              )}
            >
              <input
                id={`prov-pack-${p.id}`}
                type="radio"
                name="pack"
                value={p.id}
                checked={selected}
                onChange={() => onChange(p.id)}
                className="sr-only"
              />
              {/* The pack's own band and wordmark, in its scoped tokens. */}
              <span className={cn(`pack-${p.id} mode-light`, 'band-surface flex h-16 items-center px-4')}>
                <PackWordmark pack={p.pack} />
              </span>
              <span className="flex items-start justify-between gap-2 p-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-primary">{p.portalName}</span>
                  <span className="block truncate text-xs text-secondary">
                    {p.inUseBy.length && !p.template ? `In use by ${p.inUseBy.join(', ')}` : p.institutionName}
                  </span>
                  <VerdictText verdict={p.verdict} className="mt-1 text-xs" />
                </span>
                {selected ? (
                  <CircleCheck className="size-5 shrink-0 text-brand-fg" aria-hidden="true" />
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** The band logo when the pack has one, else its name in its own display face. */
function PackWordmark({ pack }: { pack: BrandPack }) {
  if (pack.assets.logoInverse) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={pack.assets.logoInverse} alt="" className="h-6 w-auto object-contain" />;
  }
  return <span className="truncate font-display text-lg font-bold text-band-fg">{pack.copy.portalName}</span>;
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-secondary">{label}</dt>
      <dd className="min-w-0 text-sm font-medium text-primary">{children}</dd>
    </div>
  );
}

function SetUpDone({
  created,
  name,
  pack,
  names,
  note,
}: {
  created: ProvisionPlan;
  name: string;
  pack: PackChoice | undefined;
  names: { shortName: string; institutionName: string };
  note: string;
}) {
  const stored = created.persisted !== false;
  return (
    <Card>
      <CardHeader>
        <div className="min-w-0 space-y-1">
          <CardTitle as="h2" className="flex items-center gap-2">
            <CircleCheck className="size-5 shrink-0 text-success-fg" aria-hidden="true" />
            {stored ? `${name} is set up` : `${name} passed every check`}
          </CardTitle>
          <CardDescription>{note}</CardDescription>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        {pack ? <MiniPortal pack={pack.pack} css={pack.css} fontHref={pack.fontHref} names={names} /> : null}
        <div className="flex flex-wrap gap-3">
          {pack ? (
            <ButtonLink href={pack.previewHref} target="_blank" rel="noreferrer">
              Open preview
              <ArrowUpRight className="size-4" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </ButtonLink>
          ) : null}
          <ButtonLink href="/platform" variant="secondary">
            Go to Colleges
          </ButtonLink>
          {stored ? (
            <ButtonLink href={`/platform/${created.tenantId}#setup`} variant="secondary">
              Open {name}’s checklist
            </ButtonLink>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

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
      <p className="flex items-start gap-2 rounded-lg border border-line bg-surface-sunken px-3 py-2.5 text-sm text-secondary">
        <Globe className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        The college’s address appears here as you type.
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
      text: `${takenByName ?? 'Another college'} already uses this address.`,
    },
    pack: {
      tone: 'border-danger bg-danger-soft text-danger-fg',
      icon: <CircleSlash2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />,
      text: 'A brand pack already answers on this address. Pick another.',
    },
    reserved: {
      tone: 'border-danger bg-danger-soft text-danger-fg',
      icon: <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />,
      text: 'Kept for the platform itself. Pick another.',
    },
    invalid: {
      tone: 'border-warning bg-warning-soft text-warning-fg',
      icon: <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />,
      text: SUBDOMAIN_RULE,
    },
  }[availability];

  return (
    <div role="status" className={cn('flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm', map.tone)}>
      {map.icon}
      <span className="min-w-0 space-y-0.5">
        <span className="block break-all font-mono text-xs font-semibold">{host}</span>
        <span className="block">{map.text}</span>
      </span>
    </div>
  );
}

/**
 * The waiting shape of the summary, not a spinner in an empty box. It
 * says what is happening, so a slow answer does not read as a stuck page.
 */
function PlanWaiting({ name }: { name: string }) {
  return (
    <div className="space-y-4" role="status">
      <p className="text-sm font-medium text-primary">Checking the address and building {name}’s plan…</p>
      <div className="divide-y divide-line rounded-lg border border-line" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="grid gap-2 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className={cn('h-4', row % 2 ? 'w-1/2' : 'w-3/4')} />
          </div>
        ))}
      </div>
    </div>
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
      {/* Bare, per the house rule: no tile behind an icon. */}
      <span className="mt-0.5 shrink-0 text-accent-fg" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold text-primary">
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
      <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
        <CircleSlash2 className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
        {title}
      </p>
      <p className="text-xs text-secondary">{children}</p>
    </li>
  );
}
