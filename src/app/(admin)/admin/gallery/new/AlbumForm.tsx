'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Eye, ImageOff, Images, Link2 } from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Field,
  Fieldset,
  FormActions,
  Input,
  Radio,
  Select,
  Textarea,
  describedBy,
  useToast,
} from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';

/**
 * Album composer.
 *
 * The slug is the field that matters most and the one nobody thinks about.
 * Album links get forwarded on WhatsApp for years, so it is derived from
 * the title, shown before it is committed, and checked against the slugs
 * already in use — renaming it later breaks every link anybody has kept.
 *
 * Publishing is deliberately a second decision. An album created ahead of
 * the event it is for has nothing in it, and a member who opens an empty
 * album concludes the gallery is broken rather than early.
 */

interface Option {
  value: string;
  label: string;
}

interface Errors {
  title?: string;
  slug?: string;
  description?: string;
  departmentCode?: string;
  batchYear?: string;
  eventSlug?: string;
}

interface SavedAlbum {
  album: { id: string; slug: string; title: string; published: boolean };
  href: string;
  note: string;
}

const SLUG_RULE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The route's own bounds. A looser client rule is a round trip that exists only to fail. */
const SLUG_MIN = 4;
const SLUG_MAX = 64;

export function AlbumForm({
  departments,
  events,
  years,
  takenSlugs,
  portalName,
}: {
  departments: Option[];
  events: Option[];
  years: number[];
  takenSlugs: string[];
  portalName: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [description, setDescription] = React.useState('');
  const [department, setDepartment] = React.useState('');
  const [batchYear, setBatchYear] = React.useState('');
  const [eventSlug, setEventSlug] = React.useState('');
  const [publish, setPublish] = React.useState(false);

  const [errors, setErrors] = React.useState<Errors>({});
  const [confirming, setConfirming] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [refusal, setRefusal] = React.useState<string | null>(null);
  /** Set when the write ran but nothing was stored, so the screen says so rather than navigating to a list without it. */
  const [unstored, setUnstored] = React.useState<SavedAlbum | null>(null);

  const effectiveSlug = slugEdited ? slug.trim() : slugify(title);
  const taken = takenSlugs.includes(effectiveSlug);

  const branchLabel = department
    ? (departments.find((d) => d.value === department)?.label.split(' — ')[0] ?? department)
    : 'All branches';
  const eventLabel = eventSlug ? (events.find((e) => e.value === eventSlug)?.label ?? eventSlug) : null;

  const audienceLine = publish
    ? `Every verified member — alumni and final-year students alike — can open it as soon as you save.`
    : `Nobody outside the alumni cell. An unpublished album has no page, and a direct link to it returns "not found".`;

  const validate = (): Errors => {
    const e: Errors = {};
    if (title.trim().length < 4) e.title = 'Give the album a title somebody would recognise in a list.';
    if (!effectiveSlug) e.slug = 'A link is required. It is normally derived from the title.';
    else if (!SLUG_RULE.test(effectiveSlug)) {
      e.slug = 'Lowercase letters, numbers and single hyphens only — no spaces, no punctuation.';
    } else if (effectiveSlug.length < SLUG_MIN || effectiveSlug.length > SLUG_MAX) {
      e.slug = `Between ${SLUG_MIN} and ${SLUG_MAX} characters.`;
    } else if (taken) {
      e.slug = 'An album already uses this link. Pick another — the old link must keep working.';
    }
    return e;
  };

  const submit = (wantsPublish: boolean) => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error('Some details need attention', 'The fields with a red note are stopping this from being saved.');
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
    setUnstored(null);

    const outcome = await api.post<SavedAlbum>('/api/admin/gallery', {
      title: title.trim(),
      slug: effectiveSlug,
      description: description.trim() || undefined,
      departmentCode: department || undefined,
      batchYear: batchYear ? Number(batchYear) : undefined,
      eventSlug: eventSlug || undefined,
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
      if (!outcome.persisted) {
        setUnstored(outcome.data);
        return;
      }
      router.push(wentLive ? '/admin/gallery?view=published' : '/admin/gallery?view=review');
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

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            submit(publish);
          }}
          noValidate
        >
          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">What it is</CardTitle>
                <CardDescription>The title and the link are what people forward to each other.</CardDescription>
              </div>
            </CardHeader>
            <CardBody className="space-y-5">
              <Field htmlFor="alb-title" label="Title" required error={errors.title}>
                <Input
                  id="alb-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Annual Alumni Meet 2027"
                  maxLength={120}
                  invalid={Boolean(errors.title)}
                  aria-describedby={describedBy('alb-title', { error: Boolean(errors.title) })}
                />
              </Field>

              <Field
                htmlFor="alb-slug"
                label="Link"
                required
                hint="Derived from the title until you change it. Album links get forwarded for years — renaming it later breaks every copy anybody has kept."
                error={errors.slug}
              >
                <div className="flex items-center gap-2">
                  <span className="shrink-0 font-mono text-xs text-muted">/gallery/</span>
                  <Input
                    id="alb-slug"
                    value={effectiveSlug}
                    onChange={(e) => {
                      setSlugEdited(true);
                      setSlug(e.target.value);
                    }}
                    className="font-mono"
                    placeholder="alumni-meet-2027"
                    invalid={Boolean(errors.slug) || taken}
                    aria-describedby={describedBy('alb-slug', { hint: true, error: Boolean(errors.slug) })}
                  />
                </div>
              </Field>

              <Field
                htmlFor="alb-description"
                label="Description"
                hint="What is in it, and anything a viewer would otherwise have to ask — which building, which year, what has since been demolished."
                error={errors.description}
              >
                <Textarea
                  id="alb-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Department sessions in the morning, the general body meeting after lunch, and the cultural evening that overran by an hour and nobody minded."
                  invalid={Boolean(errors.description)}
                  aria-describedby={describedBy('alb-description', {
                    hint: true,
                    error: Boolean(errors.description),
                  })}
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">Where it is filed</CardTitle>
                <CardDescription>
                  Branch and batch drive the archive filters. Leaving either blank files the album college-wide, and a
                  college-wide album shows up under every filter rather than none.
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  htmlFor="alb-department"
                  label="Branch"
                  hint="Only when the photographs are about one branch."
                  error={errors.departmentCode}
                >
                  <Select
                    id="alb-department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    aria-describedby={describedBy('alb-department', {
                      hint: true,
                      error: Boolean(errors.departmentCode),
                    })}
                  >
                    <option value="">All branches — college-wide</option>
                    {departments.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  htmlFor="alb-batch"
                  label="Batch"
                  hint={
                    years.length
                      ? 'Years the degree register has graduates for.'
                      : 'The degree register has not been loaded yet, so there are no years to pick from.'
                  }
                  error={errors.batchYear}
                >
                  <Select
                    id="alb-batch"
                    value={batchYear}
                    onChange={(e) => setBatchYear(e.target.value)}
                    disabled={years.length === 0}
                    aria-describedby={describedBy('alb-batch', { hint: true, error: Boolean(errors.batchYear) })}
                  >
                    <option value="">Not about one batch</option>
                    {years.map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field
                htmlFor="alb-event"
                label="Linked event"
                hint="Puts a link to the event on the album page, and back the other way once the event has happened."
                error={errors.eventSlug}
              >
                <Select
                  id="alb-event"
                  value={eventSlug}
                  onChange={(e) => setEventSlug(e.target.value)}
                  disabled={events.length === 0}
                  aria-describedby={describedBy('alb-event', { hint: true, error: Boolean(errors.eventSlug) })}
                >
                  <option value="">Not from an event</option>
                  {events.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">Who can open it</CardTitle>
                <CardDescription>Publication is a decision about people, not a save button.</CardDescription>
              </div>
            </CardHeader>
            <CardBody className="space-y-5">
              <Fieldset
                legend="Publication"
                hint="An unpublished album is not merely absent from the list — it has no page at all, and a direct link to it returns not found."
              >
                <Radio
                  id="alb-state-draft"
                  name="publication"
                  label="Save without publishing"
                  hint="The normal case. Create the album, upload into it, publish when it is worth opening."
                  checked={!publish}
                  onChange={() => setPublish(false)}
                />
                <Radio
                  id="alb-state-live"
                  name="publication"
                  label="Publish immediately"
                  hint="Only when the photographs are already in and you are filing the album around them."
                  checked={publish}
                  onChange={() => setPublish(true)}
                />
              </Fieldset>

              {publish ? (
                <Alert tone="warning" title="There are no photographs in this album yet">
                  <p>
                    Publishing now shows every verified member an album with nothing in it. That reads as a broken
                    gallery rather than an early one — save it unpublished and come back after the upload.
                  </p>
                </Alert>
              ) : null}

              <Alert tone="neutral" title="Credit">
                <p>
                  An album created here is credited to the alumni cell. When you are filing photographs a graduate
                  sent in, record them as the contributor instead — their name on the album is the whole of what they
                  get for it, and it is why a second person sends theirs.
                </p>
              </Alert>
            </CardBody>
          </Card>

          {refusal ? (
            <Alert tone="danger" title="Nothing was saved">
              <p>{refusal}</p>
            </Alert>
          ) : null}

          {unstored ? (
            <Alert tone="info" title="Checked and audited, but not stored">
              <p>{unstored.note}</p>
              <p className="mt-2">
                This build runs on seeded data with no database behind it. Your capability was checked, the link{' '}
                <span className="font-mono text-xs">{unstored.href}</span> was found to be free and the audit entry
                was written — the album row itself was not. Nothing you have typed has been lost.
              </p>
            </Alert>
          ) : null}

          <FormActions>
            <p className="mr-auto max-w-prose text-xs text-muted">
              Both buttons post to the gallery API, which owns the link and refuses one an album already uses.
              Photographs go up separately, straight to storage.
            </p>
            <Button type="button" variant="secondary" onClick={() => submit(false)} loading={saving}>
              Save without publishing
            </Button>
            <Button type="button" onClick={() => submit(true)} loading={saving}>
              Publish
            </Button>
          </FormActions>
        </form>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">
                  <span className="flex items-center gap-2">
                    <Eye className="size-4 text-muted" aria-hidden="true" />
                    Preview
                  </span>
                </CardTitle>
                <CardDescription>How the card reads in {portalName}.</CardDescription>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="overflow-hidden rounded-lg border border-line bg-surface">
                <div className="relative flex aspect-[3/2] flex-col items-center justify-center gap-1.5 border-b border-line bg-surface-sunken p-4 text-center">
                  <ImageOff className="size-6 text-muted" aria-hidden="true" />
                  <p className="text-xs font-medium text-secondary">No cover picked yet</p>
                  <p className="text-xs text-muted">Nothing uploaded into this album</p>

                  <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                    <Badge tone={department ? 'brand' : 'outline'}>{branchLabel}</Badge>
                    {batchYear ? <Badge tone="neutral">Batch of {batchYear}</Badge> : null}
                  </div>
                </div>

                <div className="space-y-2 p-4">
                  <p className="font-display text-lg font-semibold leading-snug">
                    {title.trim() || 'Your album title appears here'}
                  </p>
                  <p className="text-sm text-secondary">
                    {description.trim().slice(0, 180) ||
                      'Nobody wrote a description for this one. The photographs are still there.'}
                    {description.trim().length > 180 ? '…' : ''}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Images className="size-3.5" aria-hidden="true" />0 photographs
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" aria-hidden="true" />
                      Today
                    </span>
                    {eventLabel ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Link2 className="size-3.5" aria-hidden="true" />
                        Tied to an event
                      </span>
                    ) : null}
                  </p>
                  <p className="border-t border-line pt-2 text-xs text-muted">Alumni Cell · College record</p>
                </div>
              </div>

              <div className="space-y-1 border-t border-line pt-3 text-sm">
                <p className="font-medium">Who will see this</p>
                <p className="text-secondary">{audienceLine}</p>
              </div>

              <div className="space-y-1 border-t border-line pt-3 text-sm">
                <p className="font-medium">Link</p>
                <p className="break-all font-mono text-xs text-secondary">
                  /gallery/{effectiveSlug || '…'}
                </p>
                {taken ? (
                  <p className="text-xs font-medium text-danger-fg">Already used by another album.</p>
                ) : null}
                {eventLabel ? <p className="text-xs text-muted">Linked to {eventLabel}.</p> : null}
              </div>
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
        title="Publish to members?"
        body={
          <div className="space-y-2">
            <p>
              <strong className="text-primary">{title.trim() || 'This album'}</strong> becomes visible to every
              verified member the moment you confirm, students included.
            </p>
            <p>
              It has no photographs in it yet, so what they will find is an empty album at{' '}
              <span className="font-mono text-xs">/gallery/{effectiveSlug}</span>.
            </p>
            <p>
              Unpublishing later hides the album again, but it does not un-see anything somebody has already opened.
            </p>
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
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
}
