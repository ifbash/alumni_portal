'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

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
  Radio,
  Switch,
  Textarea,
  describedBy,
  useToast,
} from '@/components/ui';
import { RichText } from '@/components/content';
import { api, outcomeToast } from '@/lib/client/api';
import { MARKDOWN_MAX_LENGTH } from '@/lib/content/markdown';
import { SLUG_PATTERN, slugify } from '@/lib/community';

/**
 * The page editor.
 *
 * Writing on the left, the page as members will read it on the right. The
 * preview is the real renderer, not a lookalike: what the editor sees is
 * what a reader gets, including the places where something they typed is
 * not drawn (an image, a raw tag, a link to anything but a web or mail
 * address), which is exactly what an editor needs to find out before
 * publishing rather than after.
 *
 * The address is chosen once. A page's link is forwarded and printed, so an
 * edit never moves it; to retire an address, unpublish the page.
 */

export interface EditablePage {
  slug: string;
  title: string;
  body: string;
  audience: 'public' | 'members';
  published: boolean;
  showInFooter: boolean;
  sortOrder: number;
}

interface Errors {
  title?: string;
  slug?: string;
  body?: string;
  audience?: string;
  showInFooter?: string;
  sortOrder?: string;
}

export function PageEditor({
  mode,
  initial,
  takenSlugs,
}: {
  mode: 'create' | 'edit';
  initial?: EditablePage;
  takenSlugs: string[];
}) {
  const toast = useToast();
  const router = useRouter();

  const [title, setTitle] = React.useState(initial?.title ?? '');
  const [slug, setSlug] = React.useState(initial?.slug ?? '');
  const [slugEdited, setSlugEdited] = React.useState(mode === 'edit');
  const [body, setBody] = React.useState(initial?.body ?? '');
  const [audience, setAudience] = React.useState<'public' | 'members'>(initial?.audience ?? 'public');
  const [showInFooter, setShowInFooter] = React.useState(initial?.showInFooter ?? false);
  const [sortOrder, setSortOrder] = React.useState(String(initial?.sortOrder ?? 100));
  const [published, setPublished] = React.useState(initial?.published ?? false);

  const [errors, setErrors] = React.useState<Errors>({});
  const [saving, setSaving] = React.useState(false);
  const [refusal, setRefusal] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [view, setView] = React.useState<'write' | 'preview'>('write');
  const [savedAt, setSavedAt] = React.useState<{ persisted: boolean; href: string } | null>(null);

  const effectiveSlug = slugEdited ? slug.trim() : slugify(title, 80, '');
  const taken = mode === 'create' && takenSlugs.includes(effectiveSlug);

  // Members-only pages are never in the public footer.
  React.useEffect(() => {
    if (audience === 'members') setShowInFooter(false);
  }, [audience]);

  const validate = (): Errors => {
    const e: Errors = {};
    if (title.trim().length < 3) e.title = 'Give the page a title readers will recognise.';
    if (mode === 'create') {
      if (!effectiveSlug) e.slug = 'An address is required. It is normally taken from the title.';
      else if (!SLUG_PATTERN.test(effectiveSlug)) e.slug = 'Lowercase letters, numbers and single hyphens only.';
      else if (effectiveSlug.length < 3 || effectiveSlug.length > 80) e.slug = 'Between 3 and 80 characters.';
      else if (taken) e.slug = 'A page already uses this address. Add a word to tell them apart.';
    }
    if (body.trim().length < 10) e.body = 'A page with no words in it is not a page.';
    if (body.length > MARKDOWN_MAX_LENGTH) e.body = 'That is longer than a page should be. Split it into two pages.';
    const n = Number(sortOrder);
    if (!Number.isInteger(n) || n < 0 || n > 999) e.sortOrder = 'A whole number from 0 to 999.';
    return e;
  };

  const save = async (publish: boolean) => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error('Some details need attention', 'The fields marked in red are stopping this from being saved.');
      return;
    }

    setSaving(true);
    setRefusal(null);

    const payload = {
      title: title.trim(),
      body,
      audience,
      showInFooter,
      sortOrder: Number(sortOrder),
    };

    const outcome =
      mode === 'create'
        ? await api.post<{ href: string }>('/api/admin/pages', { ...payload, slug: effectiveSlug, publish })
        : await api.patch<{ href: string }>(`/api/admin/pages/${initial!.slug}`, { ...payload, publish });

    setSaving(false);

    const t = outcomeToast(outcome, publish ? 'Page published' : 'Page saved');
    if (t) toast.show(t);

    if (outcome.status === 'ok') {
      setPublished(publish);
      setSavedAt({ persisted: outcome.persisted, href: outcome.data.href });
      if (outcome.persisted) router.refresh();
      return;
    }
    if (outcome.status === 'invalid') {
      setErrors((cur) => ({ ...cur, ...outcome.fieldErrors }));
      return;
    }
    if (outcome.status === 'conflict') {
      setErrors((cur) => ({ ...cur, slug: outcome.message }));
      return;
    }
    setRefusal(outcome.message);
  };

  const remove = async () => {
    if (!initial) return;
    setSaving(true);
    const outcome = await api.del(`/api/admin/pages/${initial.slug}`);
    setSaving(false);
    setConfirmDelete(false);

    const t = outcomeToast(outcome, 'Page deleted');
    if (t) toast.show(t);
    if (outcome.status === 'ok') router.push('/admin/pages');
    else setRefusal(outcome.status === 'denied' || outcome.status === 'error' ? outcome.message : 'That could not be deleted.');
  };

  const length = body.length;

  const writing = (
    <div className="min-w-0 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle as="h2">The page</CardTitle>
        </CardHeader>
        <CardBody className="space-y-5">
          <Field htmlFor="pg-title" label="Title" required error={errors.title}>
            <Input
              id="pg-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. A message from the Director"
              maxLength={120}
              invalid={Boolean(errors.title)}
              aria-describedby={describedBy('pg-title', { error: Boolean(errors.title) })}
            />
          </Field>

          <Field
            htmlFor="pg-slug"
            label="Address"
            required={mode === 'create'}
            hint={
              mode === 'create'
                ? 'Taken from the title until you change it. It cannot be changed afterwards, because links get forwarded.'
                : 'Fixed. To retire this address, unpublish the page.'
            }
            error={errors.slug}
          >
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-secondary">/p/</span>
              <Input
                id="pg-slug"
                value={effectiveSlug}
                readOnly={mode === 'edit'}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(e.target.value);
                }}
                spellCheck={false}
                invalid={Boolean(errors.slug)}
                aria-describedby={describedBy('pg-slug', { hint: true, error: Boolean(errors.slug) })}
              />
            </div>
          </Field>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-primary">Who can read it</legend>
            <Radio
              id="pg-aud-public"
              name="audience"
              checked={audience === 'public'}
              onChange={() => setAudience('public')}
              label="Anyone"
              hint="Readable without signing in, like About. May be linked from the footer."
            />
            <Radio
              id="pg-aud-members"
              name="audience"
              checked={audience === 'members'}
              onChange={() => setAudience('members')}
              label="Members only"
              hint="For signed-in members. Never in the public footer, never in a search index."
            />
          </fieldset>

          <Switch
            id="pg-footer"
            checked={showInFooter}
            disabled={audience === 'members'}
            onChange={(e) => setShowInFooter(e.target.checked)}
            label="Link from the public footer"
            hint={audience === 'members' ? 'Only public pages can be linked from the footer.' : 'Shown under “Alumni”, ordered by the number below.'}
          />
          {errors.showInFooter ? <p role="alert" className="text-xs font-medium text-danger-fg">{errors.showInFooter}</p> : null}

          <Field
            htmlFor="pg-order"
            label="Order"
            hint="Lower numbers come first in the footer. Leave at 100 if you are not sure."
            error={errors.sortOrder}
            className="max-w-40"
          >
            <Input
              id="pg-order"
              inputMode="numeric"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              invalid={Boolean(errors.sortOrder)}
              aria-describedby={describedBy('pg-order', { hint: true, error: Boolean(errors.sortOrder) })}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">The words</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <Field
            htmlFor="pg-body"
            label="Text"
            required
            hint="## Heading, **bold**, *italic*, - bullet, 1. numbered, > quote, [text](https://…). Nothing else is drawn."
            error={errors.body}
          >
            <Textarea
              id="pg-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={16}
              className="font-mono text-[0.9rem]"
              invalid={Boolean(errors.body)}
              aria-describedby={describedBy('pg-body', { hint: true, error: Boolean(errors.body) })}
            />
          </Field>
          <p className={length > MARKDOWN_MAX_LENGTH * 0.9 ? 'text-xs text-warning-fg' : 'text-xs text-secondary'}>
            {length.toLocaleString('en-IN')} of {MARKDOWN_MAX_LENGTH.toLocaleString('en-IN')} characters
          </p>
        </CardBody>
      </Card>
    </div>
  );

  const preview = (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle as="h2" className="text-md">
          How readers see it
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <h3 className="font-display text-xl font-semibold text-primary">{title.trim() || 'The page title'}</h3>
        {body.trim() ? (
          <RichText source={body} />
        ) : (
          <p className="text-sm text-secondary">Start writing and the page appears here.</p>
        )}
      </CardBody>
    </Card>
  );

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Phones switch between writing and the preview; from lg both are in view. */}
        <div className="flex gap-2 lg:hidden" role="tablist" aria-label="Editor view">
          {(['write', 'preview'] as const).map((v) => (
            <Button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              variant={view === v ? 'primary' : 'secondary'}
              className="min-h-11 flex-1"
              onClick={() => setView(v)}
            >
              {v === 'write' ? 'Write' : 'Preview'}
            </Button>
          ))}
        </div>

        <div className={view === 'write' ? 'space-y-6 lg:block' : 'hidden lg:block'}>{writing}</div>
        <aside
          aria-label="Preview"
          className={view === 'preview' ? 'min-w-0 lg:sticky lg:top-20 lg:self-start' : 'hidden min-w-0 lg:block lg:sticky lg:top-20 lg:self-start'}
        >
          {preview}
        </aside>
      </div>

      {refusal ? (
        <Alert tone="danger" title="Nothing was saved" className="mt-6">
          <p>{refusal}</p>
        </Alert>
      ) : null}

      {savedAt ? (
        <Alert tone={savedAt.persisted ? 'success' : 'neutral'} title={published ? 'Published' : 'Saved as a draft'} className="mt-6">
          <p>
            {published ? 'Readers can open it at ' : 'Only people who edit pages can open it at '}
            <a className="link" href={savedAt.href}>
              {savedAt.href}
            </a>
            .
          </p>
        </Alert>
      ) : null}

      <FormActions sticky className="mt-6">
        {mode === 'edit' ? (
          <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)} disabled={saving}>
            Delete page
          </Button>
        ) : (
          <ButtonLink href="/admin/pages" variant="ghost">
            Cancel
          </ButtonLink>
        )}
        {mode === 'edit' && published ? <Badge tone="success" dot>Published</Badge> : null}
        <Button type="button" variant="secondary" onClick={() => void save(false)} loading={saving}>
          {mode === 'edit' && published ? 'Unpublish and save' : 'Save draft'}
        </Button>
        <Button type="button" onClick={() => void save(true)} loading={saving}>
          {mode === 'edit' && published ? 'Save changes' : 'Publish'}
        </Button>
      </FormActions>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
        pending={saving}
        tone="danger"
        confirmLabel="Delete page"
        requireTyped={initial?.slug}
        title="Delete this page?"
        body={
          <p>
            <strong className="text-primary">{initial?.title}</strong> is removed for everyone, and any link to it stops
            working. To keep the address but hide the page, unpublish it instead.
          </p>
        }
      />
    </>
  );
}
