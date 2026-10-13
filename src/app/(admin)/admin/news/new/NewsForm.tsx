'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { BellOff, Eye, Megaphone } from 'lucide-react';

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
  CopyButton,
  Field,
  FormActions,
  Input,
  Select,
  Sheet,
  Switch,
  Textarea,
  describedBy,
  useToast,
} from '@/components/ui';
import { StoryCard } from '@/components/content';
import { api, outcomeToast } from '@/lib/client/api';
import { cn } from '@/lib/cn';
import { displayNow } from '@/lib/format';
import { storyShareText } from '@/lib/share-text';
import type { BrandPack } from '@/lib/branding/pack';
import type { NewsKind } from '@/lib/data/content';
import { KIND_ICON, type BadgeTone } from '../kinds';

/**
 * The news composer.
 *
 * The kind is chosen before anything is written, because it decides
 * whether publishing notifies anybody — and the consequence is spelled out
 * beside the control rather than discovered afterwards. The preview is the
 * member feed's own card, so an obituary shows its restraint before it is
 * published, not after.
 */

export interface KindOption {
  value: NewsKind;
  label: string;
  tone: BadgeTone;
  blurb: string;
  notifies: boolean;
  restrained: boolean;
}

interface Errors {
  title?: string;
  slug?: string;
  summary?: string;
  body?: string;
  departmentCode?: string;
}

interface SavedItem {
  item: { id: string; slug: string; published: boolean; notifies: boolean };
  href: string;
  note: string;
}

const SUMMARY_MAX = 220;

/**
 * The route refuses a story shorter than this, so the form does too. A
 * client rule looser than the server's is a round trip that exists only to
 * fail.
 */
const BODY_MIN = 80;

/**
 * Headline → address.
 *
 * Decomposing first means an accented character keeps its base letter
 * instead of becoming a hyphen; everything else that is not a letter or a
 * digit collapses into a single hyphen, and a trailing one is trimmed
 * after the truncation rather than before it.
 */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
    .replace(/-+$/g, '');
}

export function NewsForm({
  kinds,
  departmentOptions,
  takenSlugs,
  authorDesk,
  actorName,
  share,
  origin,
  pinnedCount,
  pinnedCap,
}: {
  kinds: KindOption[];
  departmentOptions: Array<{ value: string; label: string }>;
  takenSlugs: string[];
  authorDesk: string;
  actorName: string | null;
  share: Pick<BrandPack, 'copy' | 'locale'>;
  origin: string;
  /** Published stories pinned now, counted as the server counts them. */
  pinnedCount: number;
  pinnedCap: number;
}) {
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = React.useState('');
  const [slugDraft, setSlugDraft] = React.useState('');
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [slugOpen, setSlugOpen] = React.useState(false);
  const [kind, setKind] = React.useState<NewsKind>(kinds[0]?.value ?? 'announcement');
  const [summary, setSummary] = React.useState('');
  const [body, setBody] = React.useState('');
  const [department, setDepartment] = React.useState('');
  const [pinned, setPinned] = React.useState(false);

  const [errors, setErrors] = React.useState<Errors>({});
  const [confirming, setConfirming] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  /** The pinned cap is a property of the feed, not of this story, so it does not belong on a field. */
  const [pinConflict, setPinConflict] = React.useState<string | null>(null);
  const [refusal, setRefusal] = React.useState<string | null>(null);
  /** Set once a story is published, stored or not: the screen turns to sharing it. */
  const [published, setPublished] = React.useState<(SavedItem & { persisted: boolean }) | null>(null);

  // The address follows the headline until somebody takes it over, and
  // then it stops moving. A slug that keeps rewriting itself while a
  // headline is being edited is how a story ends up at /news/annua.
  const slug = slugEdited ? slugDraft : slugify(title);

  const meta = kinds.find((k) => k.value === kind) ?? kinds[0]!;
  const departmentLabel = departmentOptions.find((d) => d.value === department)?.label ?? 'Every branch';
  const branchOnly = department ? departmentLabel.split(' — ')[0] : null;

  const audienceLine = branchOnly
    ? `Filed under ${branchOnly}. Every member can read it.`
    : 'Every member can read it on the news page.';

  const noticeLine = meta.notifies
    ? 'Members are notified when it is published.'
    : 'Nobody is notified. It appears on the news page only.';

  const validate = (): Errors => {
    const e: Errors = {};

    if (title.trim().length < 8) {
      e.title = 'A headline members will recognise in a list. At least eight characters.';
    }
    if (!slug) {
      e.slug = 'The link cannot be empty. It is normally taken from the headline.';
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      e.slug = 'Lowercase letters, digits and single hyphens only.';
    } else if (takenSlugs.includes(slug)) {
      e.slug = `/news/${slug} is already used by another story.`;
    }
    if (summary.trim().length < 20) {
      e.summary = 'The summary is the whole story for most readers. Write one full sentence at least.';
    } else if (summary.trim().length > SUMMARY_MAX) {
      e.summary = `The feed cuts the summary at ${SUMMARY_MAX} characters.`;
    }
    if (body.trim().length < BODY_MIN) {
      e.body = 'The story itself is missing. Leave a blank line between paragraphs.';
    }

    return e;
  };

  const submit = (publish: boolean) => {
    const found = validate();
    setErrors(found);
    if (found.slug) setSlugOpen(true);

    if (Object.keys(found).length > 0) {
      toast.error('Some details are missing', 'The fields marked in red need attention before this can be saved.');
      return;
    }

    if (publish) {
      setConfirming(true);
      return;
    }
    void finish(false);
  };

  const finish = async (publish: boolean) => {
    setSaving(true);
    setConfirming(false);
    setPinConflict(null);
    setRefusal(null);

    const outcome = await api.post<SavedItem>('/api/admin/news', {
      title: title.trim(),
      slug,
      kind,
      summary: summary.trim(),
      body: body.trim(),
      departmentCode: department || undefined,
      pinned,
      // Explicit on both paths. Saving a draft and publishing to the whole
      // network are different acts and the route refuses to guess.
      publish,
    });

    setSaving(false);

    const t = outcomeToast(
      outcome,
      publish ? `“${title.trim()}” is published` : `“${title.trim()}” saved as a draft`,
    );
    if (t) toast.show(t);

    if (outcome.status === 'ok') {
      if (publish) {
        setPublished({ ...outcome.data, persisted: outcome.persisted });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      // A draft that was not stored stays on screen; the toast has said so.
      if (!outcome.persisted) return;
      router.push('/admin/news?show=drafts');
      return;
    }

    if (outcome.status === 'invalid') {
      setErrors((cur) => ({ ...cur, ...outcome.fieldErrors }));
      if (outcome.fieldErrors.slug) setSlugOpen(true);
      return;
    }

    if (outcome.status === 'conflict') {
      // Two 409s, and they land in different places: an address collision
      // is this story's problem and belongs on the address field; the
      // pinned cap is the feed's, and no field on this form caused it.
      if (outcome.code === 'slug_taken') {
        setErrors((cur) => ({ ...cur, slug: outcome.message }));
        setSlugOpen(true);
        return;
      }
      if (outcome.code === 'too_many_pinned') {
        setPinConflict(outcome.message);
        return;
      }
    }

    setRefusal(outcome.message);
  };

  // ---------------------------------------------------------------
  // Preview: the feed's own card
  // ---------------------------------------------------------------

  const year = String(displayNow().getFullYear());
  const preview = (
    <div className="space-y-4">
      <StoryCard
        story={{
          slug: slug || 'preview',
          kind,
          title: title.trim() || 'The headline appears here',
          summary: summary.trim() || 'The summary appears here. It is the line most members read.',
          coverImage: null,
          departmentCode: department || null,
          publishedAt: displayNow().toISOString(),
        }}
        href="#news-preview"
        locale={share.locale}
        variant="card"
        eyebrow={<KindEyebrow kind={kind} label={meta.label} />}
        motif={branchOnly ?? year}
      />
      <div className="space-y-1.5 text-sm">
        <p className="font-medium text-primary">On publish</p>
        <p className="flex items-start gap-2 text-secondary">
          {meta.notifies ? (
            <Megaphone className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
          ) : (
            <BellOff className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
          )}
          <span>{noticeLine}</span>
        </p>
        <p className="text-secondary">{audienceLine}</p>
        {pinned ? <p className="text-secondary">Pinned above the other stories.</p> : null}
        <p className="text-secondary">
          Published under {authorDesk}
          {actorName ? `; your name is kept in the audit log` : ''}.
        </p>
      </div>
    </div>
  );

  // ---------------------------------------------------------------
  // After publishing
  // ---------------------------------------------------------------

  if (published) {
    const link = `${origin}/news/${published.item.slug || slug}`;
    const text = `${storyShareText(share, { title: title.trim() })} ${link}`;
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <div className="min-w-0 space-y-1">
              {published.persisted ? (
                <Badge tone="success" dot>
                  Published
                </Badge>
              ) : (
                <Badge tone="neutral">Not saved</Badge>
              )}
              <CardTitle as="h2" className="pt-1">
                Share it
              </CardTitle>
              <p className="text-sm text-secondary">
                {published.persisted
                  ? 'Batch groups pass a story on further than the feed does.'
                  : 'The story passed every check. This is what to share once it is live.'}
              </p>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <CopyButton text={text} label="Copy for WhatsApp" copiedLabel="Copied for WhatsApp" variant="primary" />
            <p className="rounded border border-line bg-surface p-3 text-sm text-secondary">{text}</p>
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <ButtonLink href="/admin/news" variant="ghost" className="min-h-11 sm:min-h-0">
                Back to news
              </ButtonLink>
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

  const pinHint =
    pinnedCount >= pinnedCap
      ? `Up to ${pinnedCap} stories can be pinned, and ${pinnedCount} already are. Unpin one first.`
      : `Pinned stories sit above the rest. Up to ${pinnedCap} at once; ${pinnedCount} ${pinnedCount === 1 ? 'is' : 'are'} pinned now.`;

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <form
          className="min-w-0 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
          noValidate
        >
          <Card>
            <CardHeader>
              <CardTitle as="h2">Kind</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <fieldset>
                <legend className="sr-only">Kind of story</legend>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {kinds.map((k) => {
                    const Icon = KIND_ICON[k.value];
                    const checked = kind === k.value;
                    return (
                      <label
                        key={k.value}
                        htmlFor={`news-kind-${k.value}`}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors duration-fast ease-brand',
                          'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus-ring)]',
                          k.restrained
                            ? checked
                              ? 'border-line-strong bg-surface-sunken'
                              : 'border-line bg-surface hover:border-line-strong'
                            : checked
                              ? 'border-[var(--button-primary-bg)] bg-brand-soft ring-1 ring-[var(--button-primary-bg)]'
                              : 'border-line bg-surface-raised hover:border-line-strong',
                        )}
                      >
                        <input
                          id={`news-kind-${k.value}`}
                          type="radio"
                          name="news-kind"
                          value={k.value}
                          checked={checked}
                          onChange={() => setKind(k.value)}
                          className="sr-only"
                        />
                        <Icon
                          className={cn(
                            'mt-0.5 size-4 shrink-0',
                            k.restrained ? 'text-muted' : checked ? 'text-brand-fg' : 'text-muted',
                          )}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 space-y-0.5">
                          <span className={cn('block text-sm', k.restrained ? 'font-medium text-secondary' : 'font-semibold text-primary')}>
                            {k.label}
                          </span>
                          <span className="block text-xs text-secondary">{k.blurb}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {meta.restrained ? (
                <Alert tone="neutral" title="An obituary is never sent as a notification" icon={<BellOff className="size-4" />}>
                  <p>It goes on the news page and nothing else happens. Members find it when they open the portal.</p>
                </Alert>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">The story</CardTitle>
            </CardHeader>
            <CardBody className="space-y-5">
              <div className="space-y-2">
                <Field htmlFor="news-title" label="Headline" required error={errors.title}>
                  <Input
                    id="news-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Batch of 2014 marks ten years"
                    maxLength={140}
                    invalid={Boolean(errors.title)}
                    aria-describedby={describedBy('news-title', { error: Boolean(errors.title) })}
                  />
                </Field>

                {slugOpen ? (
                  <Field
                    htmlFor="news-slug"
                    label="Link"
                    required
                    hint="Links get forwarded for months, so change it now rather than later."
                    error={errors.slug}
                  >
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-sm text-secondary">/news/</span>
                      <Input
                        id="news-slug"
                        value={slug}
                        autoFocus
                        onChange={(e) => {
                          setSlugEdited(true);
                          setSlugDraft(e.target.value);
                        }}
                        placeholder="batch-of-2014-marks-ten-years"
                        spellCheck={false}
                        invalid={Boolean(errors.slug)}
                        aria-describedby={describedBy('news-slug', { hint: true, error: Boolean(errors.slug) })}
                      />
                    </div>
                    {slugEdited ? (
                      <Button
                        type="button"
                        variant="link"
                        className="mt-1.5 text-xs"
                        onClick={() => {
                          setSlugEdited(false);
                          setSlugDraft('');
                        }}
                      >
                        Use the link from the headline again
                      </Button>
                    ) : null}
                  </Field>
                ) : (
                  <p className="flex flex-wrap items-center gap-x-1 text-sm text-secondary">
                    <span>Link:</span>
                    <span className="break-all text-primary">/news/{slug || '…'}</span>
                    <span aria-hidden="true">·</span>
                    <Button type="button" variant="link" className="min-h-11 text-sm sm:min-h-0" onClick={() => setSlugOpen(true)}>
                      Change
                      <span className="sr-only"> the link</span>
                    </Button>
                  </p>
                )}
              </div>

              <Field
                htmlFor="news-summary"
                label="Summary"
                required
                hint={`The line on the feed. ${summary.trim().length} of ${SUMMARY_MAX} characters.`}
                error={errors.summary}
              >
                <Textarea
                  id="news-summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                  maxLength={SUMMARY_MAX + 40}
                  placeholder="One or two sentences. Put the number in it if there is one."
                  invalid={Boolean(errors.summary)}
                  aria-describedby={describedBy('news-summary', { hint: true, error: Boolean(errors.summary) })}
                />
              </Field>

              <Field
                htmlFor="news-body"
                label="Story"
                required
                hint="Plain text. Leave a blank line between paragraphs."
                error={errors.body}
              >
                <Textarea
                  id="news-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  invalid={Boolean(errors.body)}
                  aria-describedby={describedBy('news-body', { hint: true, error: Boolean(errors.body) })}
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Where it sits</CardTitle>
            </CardHeader>
            <CardBody className="space-y-5">
              <Field
                htmlFor="news-department"
                label="Branch"
                hint="Files the story with that branch’s news. Every member can still read it."
                error={errors.departmentCode}
              >
                <Select
                  id="news-department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  aria-describedby={describedBy('news-department', {
                    hint: true,
                    error: Boolean(errors.departmentCode),
                  })}
                >
                  {departmentOptions.map((d) => (
                    <option key={d.value || 'all'} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Switch
                id="news-pinned"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                label="Pin to the top of the feed"
                hint={pinHint}
              />

              {pinConflict ? (
                <Alert tone="danger" title={`The feed already has ${pinnedCap} pinned stories`}>
                  <p>{pinConflict}</p>
                  <p className="mt-2">
                    <Button
                      type="button"
                      variant="link"
                      className="text-sm"
                      onClick={() => {
                        setPinned(false);
                        setPinConflict(null);
                      }}
                    >
                      Save this one unpinned instead
                    </Button>
                  </p>
                </Alert>
              ) : null}

              {pinned && meta.restrained ? (
                <Alert tone="warning" title="You are pinning a death notice to the top of the feed">
                  <p>Every member sees it first each time they open the portal, for as long as it stays pinned.</p>
                </Alert>
              ) : null}
            </CardBody>
          </Card>

          {refusal ? (
            <Alert tone="danger" title="Nothing was saved">
              <p>{refusal}</p>
            </Alert>
          ) : null}

          <FormActions sticky>
            <Button type="button" variant="ghost" className="mr-auto lg:hidden" onClick={() => setPreviewOpen(true)}>
              <Eye className="size-4" aria-hidden="true" />
              Preview
            </Button>
            <Button type="submit" variant="secondary" loading={saving}>
              Save as draft
            </Button>
            <Button type="button" onClick={() => submit(true)} loading={saving}>
              Publish
            </Button>
          </FormActions>
        </form>

        <aside aria-label="Preview" className="hidden min-w-0 lg:sticky lg:top-20 lg:block lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-md">
                How it reads on the feed
              </CardTitle>
            </CardHeader>
            <CardBody>{preview}</CardBody>
          </Card>
        </aside>
      </div>

      <Sheet open={previewOpen} onClose={() => setPreviewOpen(false)} title="Preview">
        {preview}
      </Sheet>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void finish(true)}
        pending={saving}
        tone="primary"
        confirmLabel={meta.notifies ? 'Publish and notify' : 'Publish quietly'}
        title={meta.notifies ? 'Publish to members?' : 'Publish this notice?'}
        body={
          <div className="space-y-2">
            <p>
              <strong className="text-primary">{title.trim() || 'This story'}</strong> goes on the news page straight
              away.
            </p>
            <p>{noticeLine}</p>
            {pinned ? <p>It sits above the other stories until it is unpinned.</p> : null}
          </div>
        }
      />
    </>
  );
}

function KindEyebrow({ kind, label }: { kind: NewsKind; label: string }) {
  const Icon = KIND_ICON[kind];
  return (
    <>
      <Icon aria-hidden="true" />
      {label}
    </>
  );
}
