'use client';

import * as React from 'react';
import { CalendarDays, UserRound } from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Field,
  FormActions,
  Input,
  Select,
  Textarea,
  describedBy,
  useToast,
} from '@/components/ui';
import { AlbumCard } from '@/components/content';
import { api, outcomeToast } from '@/lib/client/api';
import { cn } from '@/lib/cn';
import type { LocaleSpec } from '@/lib/branding/pack';

/**
 * Album composer.
 *
 * Two ways in, because albums arrive two ways: for an event (pick the
 * event, and its title, date and branch follow), or as photos a graduate
 * sent in (their name, branch and year become the album's credit, in the
 * "Name (BRANCH, YEAR)" form the gallery pages read as a contribution).
 *
 * The link is derived from the title, shown before it is committed, and
 * checked against the links already in use — album links get forwarded
 * for years, and renaming one breaks every copy anybody has kept.
 */

interface Option {
  value: string;
  label: string;
}

interface EventFact {
  slug: string;
  title: string;
  /** YYYY-MM-DD, in the college's time zone. */
  date: string;
  departmentCode: string | null;
}

interface Errors {
  title?: string;
  slug?: string;
  description?: string;
  departmentCode?: string;
  batchYear?: string;
  eventSlug?: string;
  takenOn?: string;
  contributedBy?: string;
}

interface SavedAlbum {
  album: { id: string; slug: string; title: string; published: boolean };
  href: string;
  note: string;
}

type Mode = 'event' | 'graduate';

const SLUG_RULE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The route's own bounds. A looser client rule is a round trip that exists only to fail. */
const SLUG_MIN = 4;
const SLUG_MAX = 64;

export function AlbumForm({
  departments,
  events,
  eventFacts,
  years,
  takenSlugs,
  initialEvent,
  today,
  officeName,
  locale,
}: {
  departments: Option[];
  events: Option[];
  eventFacts: EventFact[];
  years: number[];
  takenSlugs: string[];
  initialEvent: string | null;
  /** YYYY-MM-DD in the college's time zone: the date taken, until changed. */
  today: string;
  officeName: string;
  locale: LocaleSpec;
}) {
  const toast = useToast();

  const first = initialEvent ? eventFacts.find((e) => e.slug === initialEvent) ?? null : null;

  const [mode, setMode] = React.useState<Mode>(events.length === 0 ? 'graduate' : 'event');
  const [title, setTitle] = React.useState(first?.title ?? '');
  const [slug, setSlug] = React.useState('');
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [description, setDescription] = React.useState('');
  const [department, setDepartment] = React.useState(first?.departmentCode ?? '');
  const [batchYear, setBatchYear] = React.useState('');
  const [eventSlug, setEventSlug] = React.useState(first?.slug ?? '');
  const [takenOn, setTakenOn] = React.useState(first?.date ?? today);
  const [person, setPerson] = React.useState('');
  const [personBranch, setPersonBranch] = React.useState('');
  const [personYear, setPersonYear] = React.useState('');

  const [errors, setErrors] = React.useState<Errors>({});
  const [confirming, setConfirming] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [refusal, setRefusal] = React.useState<string | null>(null);
  /** Set once the album is saved, stored or not: the screen turns to adding photos. */
  const [saved, setSaved] = React.useState<(SavedAlbum & { persisted: boolean; live: boolean }) | null>(null);

  const effectiveSlug = slugEdited ? slug.trim() : slugify(title);
  const taken = takenSlugs.includes(effectiveSlug);

  const credit =
    mode === 'graduate' && person.trim() && personBranch && personYear
      ? `${person.trim()} (${personBranch}, ${personYear})`
      : null;

  const pickEvent = (value: string) => {
    setEventSlug(value);
    const fact = eventFacts.find((e) => e.slug === value);
    if (!fact) return;
    // Fill what the event knows. The title only when it has not been typed over.
    if (!title.trim() || eventFacts.some((e) => e.title === title)) setTitle(fact.title);
    setTakenOn(fact.date);
    setDepartment(fact.departmentCode ?? '');
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (title.trim().length < 4) e.title = 'Give the album a title somebody would recognise in a list.';
    if (!effectiveSlug) e.slug = 'A link is required. It is normally taken from the title.';
    else if (!SLUG_RULE.test(effectiveSlug)) {
      e.slug = 'Lowercase letters, numbers and single hyphens only.';
    } else if (effectiveSlug.length < SLUG_MIN || effectiveSlug.length > SLUG_MAX) {
      e.slug = `Between ${SLUG_MIN} and ${SLUG_MAX} characters.`;
    } else if (taken) {
      e.slug = 'An album already uses this link. Pick another; the old link must keep working.';
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(takenOn)) e.takenOn = 'The day the photos were taken.';
    if (mode === 'graduate' && !credit) {
      e.contributedBy = 'Their name, branch and year of passing make the credit on the album.';
    }
    return e;
  };

  const submit = (wantsPublish: boolean) => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error('Some details need attention', 'The fields marked in red are stopping this from being saved.');
      return;
    }
    if (wantsPublish) {
      setConfirming(true);
      return;
    }
    void finish(false);
  };

  const finish = async (wentLive: boolean) => {
    setSaving(true);
    setConfirming(false);
    setRefusal(null);

    const outcome = await api.post<SavedAlbum>('/api/admin/gallery', {
      title: title.trim(),
      slug: effectiveSlug,
      description: description.trim() || undefined,
      departmentCode: department || undefined,
      batchYear: batchYear ? Number(batchYear) : undefined,
      eventSlug: mode === 'event' ? eventSlug || undefined : undefined,
      takenOn: takenOn || undefined,
      contributedBy: mode === 'graduate' ? (credit ?? undefined) : undefined,
      // Explicit on both paths: an album created empty and published by
      // default is the accident this endpoint refuses to make possible.
      publish: wentLive,
    });

    setSaving(false);

    const t = outcomeToast(
      outcome,
      wentLive ? `“${title.trim()}” is published` : `“${title.trim()}” saved, not published`,
    );
    if (t) toast.show(t);

    if (outcome.status === 'ok') {
      setSaved({ ...outcome.data, persisted: outcome.persisted, live: wentLive });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (outcome.status === 'invalid') {
      setErrors((cur) => ({ ...cur, ...outcome.fieldErrors }));
      return;
    }

    if (outcome.status === 'conflict' && outcome.code === 'slug_taken') {
      setErrors((cur) => ({ ...cur, slug: outcome.message }));
      return;
    }

    setRefusal(outcome.message);
  };

  // ---------------------------------------------------------------
  // Preview: the album card as members will see it
  // ---------------------------------------------------------------

  const yy = personYear ? `’${personYear.slice(-2)}` : '';
  const creditLine = credit
    ? `Sent in by ${person.trim().split(/\s+/)[0]} · ${personBranch} ${yy}`
    : `By the ${officeName}`;

  const preview = (
    <AlbumCard
      album={{
        slug: effectiveSlug || 'album',
        title: title.trim() || 'The album title',
        takenOn: /^\d{4}-\d{2}-\d{2}$/.test(takenOn) ? `${takenOn}T12:00:00Z` : `${today}T12:00:00Z`,
        photoCount: 0,
        departmentCode: department || null,
        batchYear: batchYear ? Number(batchYear) : null,
        contributedBy: credit,
      }}
      coverSrc={null}
      href="#album-preview"
      locale={locale}
      credit={creditLine}
    />
  );

  // ---------------------------------------------------------------
  // After saving
  // ---------------------------------------------------------------

  if (saved) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader>
            <div className="min-w-0 space-y-1">
              {saved.persisted ? (
                <Badge tone="success" dot>
                  {saved.live ? 'Published' : 'Saved'}
                </Badge>
              ) : (
                <Badge tone="neutral">Not saved</Badge>
              )}
              <CardTitle as="h2" className="pt-1">
                {saved.live ? 'Album published' : 'Album saved'}
              </CardTitle>
              <p className="text-sm text-secondary">
                {!saved.persisted
                  ? `“${title.trim()}” passed every check.`
                  : saved.live
                    ? `Members can open “${title.trim()}” now.`
                    : `“${title.trim()}” is saved and not published yet.`}
              </p>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/admin/gallery" variant="secondary" className="min-h-11 sm:min-h-0">
                Back to the gallery
              </ButtonLink>
              <Button
                variant="ghost"
                className="min-h-11 sm:min-h-0"
                onClick={() => {
                  setSaved(null);
                  setTitle('');
                  setSlugEdited(false);
                  setSlug('');
                  setDescription('');
                  setPerson('');
                }}
              >
                Create another
              </Button>
            </div>
          </CardBody>
        </Card>
        <aside aria-label="Preview" className="min-w-0">
          {preview}
        </aside>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // The form
  // ---------------------------------------------------------------

  const modes: Array<{ value: Mode; title: string; line: string; icon: React.ReactNode; disabled?: boolean }> = [
    {
      value: 'event',
      title: 'For an event',
      line: 'Pick the event; its title, date and branch follow.',
      icon: <CalendarDays className="size-5" />,
      disabled: events.length === 0,
    },
    {
      value: 'graduate',
      title: 'Photos a graduate sent',
      line: 'They are credited by name on the album.',
      icon: <UserRound className="size-5" />,
    },
  ];

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <form
          className="min-w-0 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
          noValidate
        >
          <fieldset>
            <legend className="sr-only">How this album starts</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {modes.map((m) => {
                const checked = mode === m.value;
                return (
                  <label
                    key={m.value}
                    htmlFor={`album-mode-${m.value}`}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-4 transition-colors duration-fast ease-brand',
                      'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus-ring)]',
                      m.disabled ? 'cursor-not-allowed border-line bg-surface-sunken' : 'cursor-pointer',
                      !m.disabled &&
                        (checked
                          ? 'border-[var(--button-primary-bg)] bg-brand-soft ring-1 ring-[var(--button-primary-bg)]'
                          : 'border-line bg-surface-raised hover:border-line-strong'),
                    )}
                  >
                    <input
                      id={`album-mode-${m.value}`}
                      type="radio"
                      name="album-mode"
                      checked={checked}
                      disabled={m.disabled}
                      onChange={() => setMode(m.value)}
                      className="sr-only"
                    />
                    <span className={cn('mt-0.5 shrink-0', checked ? 'text-brand-fg' : 'text-muted')} aria-hidden="true">
                      {m.icon}
                    </span>
                    <span className="min-w-0 space-y-0.5">
                      <span className="block font-semibold text-primary">{m.title}</span>
                      <span className="block text-sm text-secondary">
                        {m.disabled ? 'There are no events to link yet.' : m.line}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {mode === 'event' ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">The event</CardTitle>
              </CardHeader>
              <CardBody>
                <Field htmlFor="alb-event" label="Event" error={errors.eventSlug}>
                  <Select
                    id="alb-event"
                    value={eventSlug}
                    onChange={(e) => pickEvent(e.target.value)}
                    aria-describedby={describedBy('alb-event', { error: Boolean(errors.eventSlug) })}
                  >
                    <option value="">Choose an event</option>
                    {events.map((e) => (
                      <option key={e.value} value={e.value}>
                        {e.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Who sent them</CardTitle>
              </CardHeader>
              <CardBody className="space-y-4">
                <Field htmlFor="alb-person" label="Name" required error={errors.contributedBy}>
                  <Input
                    id="alb-person"
                    value={person}
                    onChange={(e) => setPerson(e.target.value)}
                    autoComplete="off"
                    maxLength={90}
                    invalid={Boolean(errors.contributedBy)}
                    aria-describedby={describedBy('alb-person', { error: Boolean(errors.contributedBy) })}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field htmlFor="alb-person-branch" label="Their branch" required>
                    <Select id="alb-person-branch" value={personBranch} onChange={(e) => setPersonBranch(e.target.value)}>
                      <option value="">Choose</option>
                      {departments.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field htmlFor="alb-person-year" label="Year of passing" required>
                    <Select id="alb-person-year" value={personYear} onChange={(e) => setPersonYear(e.target.value)}>
                      <option value="">Choose</option>
                      {years.map((y) => (
                        <option key={y} value={String(y)}>
                          {y}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                {credit ? (
                  <p className="text-sm text-secondary">
                    Credited as <span className="font-medium text-primary">{credit}</span>
                  </p>
                ) : null}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle as="h2">The album</CardTitle>
            </CardHeader>
            <CardBody className="space-y-5">
              <Field htmlFor="alb-title" label="Title" required error={errors.title}>
                <Input
                  id="alb-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Annual Alumni Meet 2027"
                  maxLength={120}
                  invalid={Boolean(errors.title)}
                  aria-describedby={describedBy('alb-title', { error: Boolean(errors.title) })}
                />
              </Field>

              <Field
                htmlFor="alb-slug"
                label="Link"
                required
                hint="Taken from the title until you change it. Links get forwarded for years."
                error={errors.slug ?? (taken ? 'Another album already uses this link. Add a word to tell them apart.' : undefined)}
              >
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-sm text-secondary">/gallery/</span>
                  <Input
                    id="alb-slug"
                    value={effectiveSlug}
                    onChange={(e) => {
                      setSlugEdited(true);
                      setSlug(e.target.value);
                    }}
                    placeholder="annual-alumni-meet-2027"
                    spellCheck={false}
                    invalid={Boolean(errors.slug) || taken}
                    aria-describedby={describedBy('alb-slug', { hint: true, error: Boolean(errors.slug) || taken })}
                  />
                </div>
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field htmlFor="alb-taken" label="Date taken" required error={errors.takenOn}>
                  <Input
                    id="alb-taken"
                    type="date"
                    value={takenOn}
                    onChange={(e) => setTakenOn(e.target.value)}
                    invalid={Boolean(errors.takenOn)}
                    aria-describedby={describedBy('alb-taken', { error: Boolean(errors.takenOn) })}
                  />
                </Field>
                <Field htmlFor="alb-department" label="Branch" error={errors.departmentCode}>
                  <Select
                    id="alb-department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    aria-describedby={describedBy('alb-department', { error: Boolean(errors.departmentCode) })}
                  >
                    <option value="">College-wide</option>
                    {departments.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.value}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  htmlFor="alb-batch"
                  label="Batch"
                  hint={years.length ? undefined : 'No batch years are on the degree register yet.'}
                  error={errors.batchYear}
                >
                  <Select
                    id="alb-batch"
                    value={batchYear}
                    onChange={(e) => setBatchYear(e.target.value)}
                    disabled={years.length === 0}
                    aria-describedby={describedBy('alb-batch', {
                      hint: years.length === 0,
                      error: Boolean(errors.batchYear),
                    })}
                  >
                    <option value="">Any batch</option>
                    {years.map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field
                htmlFor="alb-description"
                label="Description"
                hint="What is in it, and anything a viewer would otherwise have to ask."
                error={errors.description}
              >
                <Textarea
                  id="alb-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  invalid={Boolean(errors.description)}
                  aria-describedby={describedBy('alb-description', {
                    hint: true,
                    error: Boolean(errors.description),
                  })}
                />
              </Field>
            </CardBody>
          </Card>

          {refusal ? (
            <Alert tone="danger" title="Nothing was saved">
              <p>{refusal}</p>
            </Alert>
          ) : null}

          <FormActions sticky>
            <Button type="button" variant="secondary" onClick={() => submit(true)} loading={saving}>
              Publish now
            </Button>
            <Button type="submit" loading={saving}>
              Save album
            </Button>
          </FormActions>
        </form>

        <aside aria-label="Preview" className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-md">
                How members see it
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {preview}
              <p className="text-sm text-secondary">Photos are added after the album is saved.</p>
            </CardBody>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void finish(true)}
        pending={saving}
        tone="primary"
        confirmLabel="Publish now"
        title="Publish an empty album?"
        body={
          <div className="space-y-2">
            <p>
              <strong className="text-primary">{title.trim() || 'This album'}</strong> becomes visible to every
              member straight away, final-year students included.
            </p>
            <p>It has no photos yet, so members will open an empty album. Saving it and publishing once the photos are in is usually better.</p>
          </div>
        }
      />
    </>
  );
}

/**
 * Title to link.
 *
 * Diacritics are stripped rather than dropped, because a title like
 * "Convocation 2026 — Batch of ’26" should not produce a link with a hole
 * in the middle of it.
 */
function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
}
