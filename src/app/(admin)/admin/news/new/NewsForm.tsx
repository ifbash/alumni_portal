'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { BellOff, Eye, Link2, Megaphone, Pin, Send } from 'lucide-react';

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
  FormActions,
  Input,
  Select,
  Switch,
  Textarea,
  describedBy,
  useToast,
} from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';
import type { NewsKind } from '@/lib/data/content';
import type { BadgeTone } from '../kinds';

/**
 * The news composer.
 *
 * Two things are deliberate here. The kind is chosen before anything is
 * written, because it decides whether publishing sends a notification —
 * and the consequence is spelled out beside the control rather than
 * discovered afterwards. And the preview renders an obituary the way the
 * member feed actually renders one: no coloured badge, no headline
 * weight, no read-more. Somebody filing a death notice should be able to
 * see the restraint before they publish it, not take it on trust.
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
  portalName,
  whatsappEnabled,
}: {
  kinds: KindOption[];
  departmentOptions: Array<{ value: string; label: string }>;
  takenSlugs: string[];
  authorDesk: string;
  actorName: string;
  portalName: string;
  whatsappEnabled: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = React.useState('');
  const [slugDraft, setSlugDraft] = React.useState('');
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [kind, setKind] = React.useState<NewsKind>(kinds[0]?.value ?? 'announcement');
  const [summary, setSummary] = React.useState('');
  const [body, setBody] = React.useState('');
  const [department, setDepartment] = React.useState('');
  const [pinned, setPinned] = React.useState(false);

  const [errors, setErrors] = React.useState<Errors>({});
  const [confirming, setConfirming] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  /** The pinned cap is a property of the feed, not of this story, so it does not belong on a field. */
  const [pinConflict, setPinConflict] = React.useState<string | null>(null);
  const [refusal, setRefusal] = React.useState<string | null>(null);
  /** Set when the write ran but nothing was stored, so the screen can say so instead of navigating to a list without it. */
  const [unstored, setUnstored] = React.useState<SavedItem | null>(null);

  // The address follows the headline until somebody takes it over, and
  // then it stops moving. A slug that keeps rewriting itself while a
  // headline is being edited is how a story ends up at /news/annua.
  const slug = slugEdited ? slugDraft : slugify(title);

  const meta = kinds.find((k) => k.value === kind) ?? kinds[0]!;
  const departmentLabel =
    departmentOptions.find((d) => d.value === department)?.label ?? 'Every branch';
  const branchOnly = department ? departmentLabel.split(' — ')[0] : null;

  const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const audienceLine = department
    ? `Everyone in the ${branchOnly} network sees it first; it stays on the feed for every member.`
    : 'Every verified member sees it on the news page.';

  const noticeLine = meta.notifies
    ? `Members are notified ${whatsappEnabled ? 'by WhatsApp and email' : 'by email'} once it is published.`
    : 'Nothing is sent. The notice appears on the news page and is found by members who open the portal.';

  const validate = (): Errors => {
    const e: Errors = {};

    if (title.trim().length < 8) {
      e.title = 'A headline members will recognise in a list. Eight characters is not one.';
    }
    if (!slug) {
      e.slug = 'The address cannot be empty. It is normally taken from the headline.';
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      e.slug = 'Lowercase letters, digits and single hyphens only — this is a URL.';
    } else if (takenSlugs.includes(slug)) {
      e.slug = `/news/${slug} is already taken by another story. Change it, or the old one becomes unreachable.`;
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

    if (Object.keys(found).length > 0) {
      toast.error(
        'Some details are missing',
        'The fields with a red note need attention before this can be saved.',
      );
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
    setUnstored(null);

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
      if (!outcome.persisted) {
        // Nothing was written, so sending the editor to a list that will
        // not contain the story reads as the story having vanished.
        setUnstored(outcome.data);
        return;
      }
      router.push(publish ? '/admin/news?view=published' : '/admin/news?view=drafts');
      return;
    }

    if (outcome.status === 'invalid') {
      setErrors((cur) => ({ ...cur, ...outcome.fieldErrors }));
      return;
    }

    if (outcome.status === 'conflict') {
      // Two 409s, and they land in different places: an address collision
      // is this story's problem and belongs on the address field; the
      // pinned cap is the feed's, and no field on this form caused it.
      if (outcome.code === 'slug_taken') {
        setErrors((cur) => ({ ...cur, slug: outcome.message }));
        return;
      }
      if (outcome.code === 'too_many_pinned') {
        setPinConflict(outcome.message);
        return;
      }
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
            submit(false);
          }}
          noValidate
        >
          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">What kind of story is this?</CardTitle>
                <CardDescription>
                  Kind decides how the feed presents it and whether publishing sends anything.
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody className="space-y-5">
              <Field htmlFor="news-kind" label="Kind" required hint={meta.blurb}>
                <Select
                  id="news-kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as NewsKind)}
                  aria-describedby={describedBy('news-kind', { hint: true })}
                >
                  {kinds.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </Select>
              </Field>

              {meta.restrained ? (
                <Alert tone="neutral" title="An obituary is never sent as a notification" icon={<BellOff className="size-4" />}>
                  <p>
                    It is published to the news page and nothing else happens — no push, no email
                    blast, no WhatsApp message. Members find it when they open the portal. This is an
                    editorial rule and there is no setting on this form that overrides it, because a
                    death notice arriving as an alert on somebody&rsquo;s phone is the kind of thing
                    a college is remembered for.
                  </p>
                </Alert>
              ) : (
                <Alert tone="info" title="Publishing notifies members" icon={<Send className="size-4" />}>
                  <p>
                    {noticeLine} A correction published afterwards does not reach the people who
                    already read the first version, so check the names, the branches and the figures
                    before you publish rather than after.
                  </p>
                </Alert>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">The story</CardTitle>
                <CardDescription>
                  Headline and summary are what most members read. Very few open the page.
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody className="space-y-5">
              <Field htmlFor="news-title" label="Headline" required error={errors.title}>
                <Input
                  id="news-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="The 2013 and 2014 ECE batches funded the new VLSI lab"
                  maxLength={140}
                  invalid={Boolean(errors.title)}
                  aria-describedby={describedBy('news-title', { error: Boolean(errors.title) })}
                />
              </Field>

              <Field
                htmlFor="news-slug"
                label="Address"
                required
                hint="Taken from the headline until you change it. Once a story is published this address gets forwarded on WhatsApp for months, so changing it later breaks those links."
                error={errors.slug}
              >
                <Input
                  id="news-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugEdited(true);
                    setSlugDraft(e.target.value);
                  }}
                  leading={<Link2 className="size-4" />}
                  placeholder="ece-2014-batch-funds-vlsi-lab"
                  spellCheck={false}
                  className="font-mono"
                  invalid={Boolean(errors.slug)}
                  aria-describedby={describedBy('news-slug', { hint: true, error: Boolean(errors.slug) })}
                />
              </Field>

              {slugEdited ? (
                <p className="-mt-2 text-xs text-secondary">
                  <Button
                    type="button"
                    variant="link"
                    className="text-xs"
                    onClick={() => {
                      setSlugEdited(false);
                      setSlugDraft('');
                    }}
                  >
                    Go back to the address taken from the headline
                  </Button>{' '}
                  <span className="font-mono">/news/{slugify(title) || '…'}</span>
                </p>
              ) : null}

              <Field
                htmlFor="news-summary"
                label="Summary"
                required
                hint={`One or two sentences, with the number in it if there is one. This is the line on the feed. ${summary.trim().length}/${SUMMARY_MAX}`}
                error={errors.summary}
              >
                <Textarea
                  id="news-summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                  maxLength={SUMMARY_MAX + 40}
                  placeholder="Forty-one graduates contributed ₹18.4 lakh over eleven months. The lab opened in March with sixteen workstations."
                  invalid={Boolean(errors.summary)}
                  aria-describedby={describedBy('news-summary', { hint: true, error: Boolean(errors.summary) })}
                />
              </Field>

              <Field
                htmlFor="news-body"
                label="Story"
                required
                hint="Plain text. Leave a blank line between paragraphs — that is what the story page renders."
                error={errors.body}
              >
                <Textarea
                  id="news-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={14}
                  placeholder={
                    'The proposal started in a batch WhatsApp group in April 2025 and took eleven months to fund.\n\nForty-one graduates contributed a total of ₹18,40,000. The college matched a third of it from the development fund.'
                  }
                  invalid={Boolean(errors.body)}
                  aria-describedby={describedBy('news-body', { hint: true, error: Boolean(errors.body) })}
                />
              </Field>

              <p className="text-xs text-muted">
                {paragraphs.length === 0
                  ? 'No paragraphs yet.'
                  : `${paragraphs.length} paragraph${paragraphs.length === 1 ? '' : 's'}, ${body.trim().split(/\s+/).filter(Boolean).length} words.`}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">Where it belongs</CardTitle>
                <CardDescription>
                  A branch is a filing decision, not a restriction — every member still sees the
                  story.
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody className="space-y-5">
              <Field
                htmlFor="news-department"
                label="Branch"
                hint="Naming the branch is what puts the story next to that department's other news and gives the reader a way into the directory."
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
                hint="Pinned stories sit above everything else until you unpin them. Two at once and neither is pinned."
              />

              {pinConflict ? (
                <Alert tone="danger" title="The feed already has its three pinned stories">
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
                <Alert tone="warning" title="You are pinning a death notice to the top of every member's feed">
                  <p>
                    It will be the first thing every graduate and every final-year student sees each
                    time they open the portal, for as long as it stays pinned. That is sometimes
                    right — a long-serving head of department — and it is worth a second thought and
                    a word with the family either way.
                  </p>
                </Alert>
              ) : null}
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
                This build runs on seeded data with no database behind it. Your capability was checked, the address{' '}
                <span className="font-mono text-xs">{unstored.href}</span> was found to be free and the audit entry
                was written — the row itself was not. Nothing you have typed has been lost.
              </p>
            </Alert>
          ) : null}

          <FormActions>
            <p className="mr-auto max-w-prose text-xs text-muted">
              Both buttons post to the news desk API, which decides the address, refuses a collision and — for an
              obituary — publishes without notifying anybody.
            </p>
            <Button type="submit" variant="secondary" loading={saving}>
              Save as draft
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
                <CardDescription>How the card reads on the {portalName} feed.</CardDescription>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              {meta.restrained ? (
                // The same restraint the member feed applies: no badge, no
                // headline weight, no read-more.
                <div className="rounded-lg border border-line bg-surface p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted">
                    {meta.label}
                  </p>
                  <p className="mt-2 font-display text-md font-medium leading-snug">
                    {title.trim() || 'The headline appears here'}
                  </p>
                  <p className="mt-1.5 text-sm text-secondary">
                    {summary.trim() || 'The summary appears here.'}
                  </p>
                  <p className="mt-3 text-xs text-muted">{authorDesk}</p>
                </div>
              ) : (
                <div className="space-y-2.5 rounded-lg border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    {pinned ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
                        <Pin className="size-3" aria-hidden="true" />
                        Pinned
                      </span>
                    ) : null}
                  </div>
                  <p className="font-display text-lg font-semibold leading-snug">
                    {title.trim() || 'The headline appears here'}
                  </p>
                  <p className="text-sm text-secondary">
                    {summary.trim() || 'The summary appears here — this is the line most members read.'}
                  </p>
                  <p className="text-xs text-muted">
                    {authorDesk}
                    {department ? ` · ${branchOnly}` : ''}
                  </p>
                </div>
              )}

              <div className="space-y-1.5 border-t border-line pt-3 text-sm">
                <p className="font-medium">Address</p>
                <p className="break-all font-mono text-xs text-secondary">
                  /news/{slug || '…'}
                </p>
              </div>

              <div className="space-y-1.5 border-t border-line pt-3 text-sm">
                <p className="font-medium">On publish</p>
                <p className="text-secondary">{audienceLine}</p>
                <p className="flex items-start gap-2 text-secondary">
                  {meta.notifies ? (
                    <Megaphone className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
                  ) : (
                    <BellOff className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
                  )}
                  <span>{noticeLine}</span>
                </p>
              </div>

              <div className="space-y-1 border-t border-line pt-3 text-sm">
                <p className="font-medium">Filed as</p>
                <p className="text-secondary">
                  {authorDesk} — by {actorName}. The desk is what members see; your name stays in the
                  audit log.
                </p>
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
        confirmLabel={meta.notifies ? 'Publish and notify' : 'Publish quietly'}
        title={meta.notifies ? 'Publish to members?' : 'Publish this notice?'}
        body={
          <div className="space-y-2">
            <p>
              <strong className="text-primary">{title.trim() || 'This story'}</strong> goes on the
              news page at <span className="font-mono text-xs">/news/{slug}</span> immediately.
            </p>
            <p>{audienceLine}</p>
            <p>{noticeLine}</p>
            {pinned ? <p>It will sit above every other story until it is unpinned.</p> : null}
          </div>
        }
      />
    </>
  );
}
